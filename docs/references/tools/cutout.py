"""
Cut-out pipeline feasibility (R3 art direction). Usage:
  PYTHONPATH=<here>/pylib python cutout.py <out_dir> key=url[@x0,y0,x1,y1] [...]   (optional source crop in 1200px coords)
Downloads each photo at 1200px, runs ISNet (rembg's isnet-general-use.onnx) to get an alpha
mask, trims to the subject, pads to a square with 6% air, saves <key>.png (transparent, 900px), <key>.webp (720px, ship this)
and <key>_preview.png (cut-out on a tinted rounded tile with a contact shadow) for review.
"""
import io, os, sys, urllib.request
import numpy as np
import onnxruntime as ort
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sess = ort.InferenceSession(os.path.join(HERE, 'isnet.onnx'), providers=['CPUExecutionProvider'])


def mask_for(img):
    im = img.convert('RGB').resize((1024, 1024), Image.LANCZOS)
    a = np.array(im).astype(np.float32)
    a = a / max(a.max(), 1e-6)
    a = (a - np.array([0.485, 0.456, 0.406], dtype=np.float32)) / 1.0
    a = a.transpose(2, 0, 1)[None].astype(np.float32)
    pred = sess.run(None, {sess.get_inputs()[0].name: a})[0][:, 0, :, :]
    pred = (pred - pred.min()) / max(pred.max() - pred.min(), 1e-6)
    m = Image.fromarray((pred.squeeze() * 255).astype('uint8'), 'L').resize(img.size, Image.LANCZOS)
    # firm up the edge a little: lift mid-greys, kill faint haze
    arr = np.array(m).astype(np.float32) / 255
    arr = np.clip((arr - 0.12) / 0.76, 0, 1)
    return Image.fromarray((arr * 255).astype('uint8'), 'L')


def cut(key, url, out, crop=None):
    url = url.replace('w=800&h=800', 'w=1200&h=1200')
    data = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=60).read()
    img = Image.open(io.BytesIO(data)).convert('RGB')
    if crop:
        img = img.crop(crop)
    m = mask_for(img)
    rgba = img.copy(); rgba.putalpha(m)
    bbox = m.point(lambda v: 255 if v > 24 else 0).getbbox()
    rgba = rgba.crop(bbox)
    w, h = rgba.size; side = int(max(w, h) * 1.06)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(rgba, ((side - w) // 2, side - h - int(side * 0.03)), rgba)  # sit near the bottom
    sq = sq.resize((900, 900), Image.LANCZOS)
    sq.save(os.path.join(out, f'{key}.png'), optimize=True)
    sq.resize((720, 720), Image.LANCZOS).save(os.path.join(out, f'{key}.webp'), 'WEBP', quality=84, method=6)
    # preview: 360 tile, tint, contact shadow
    T = 360
    tile = Image.new('RGBA', (T, T), (0, 0, 0, 0))
    bg = Image.new('RGBA', (T, T), (233, 220, 203, 255))
    mk = Image.new('L', (T, T), 0); ImageDraw.Draw(mk).rounded_rectangle([0, 0, T - 1, T - 1], 40, fill=255)
    tile.paste(bg, (0, 0), mk)
    sh = Image.new('L', (T, T), 0); ImageDraw.Draw(sh).ellipse([T * 0.2, T * 0.83, T * 0.8, T * 0.91], fill=90)
    sh = sh.filter(ImageFilter.GaussianBlur(10))
    tile.paste(Image.new('RGBA', (T, T), (59, 38, 24, 255)), (0, 0), sh)
    p = sq.resize((int(T * 0.86), int(T * 0.86)), Image.LANCZOS)
    tile.alpha_composite(p, ((T - p.width) // 2, int(T * 0.02)))
    tile.save(os.path.join(out, f'{key}_preview.png'))
    print('ok', key, img.size, '->', bbox)


if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    for arg in sys.argv[2:]:
        k, u = arg.split('=', 1)
        crop = None
        if '@' in u:
            u, c = u.rsplit('@', 1)
            crop = tuple(int(v) for v in c.split(','))
        try:
            cut(k, u, out, crop)
        except Exception as e:  # keep going
            print('FAIL', k, e)
