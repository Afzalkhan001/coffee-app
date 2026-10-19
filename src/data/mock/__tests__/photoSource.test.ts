import { CATEGORY_PHOTOS, PRODUCTS } from '../menu';
import { PROMOTIONS, REWARDS } from '../marketing';
import { PHOTOS } from '../photos';
import { isCutoutPhoto, localPhoto, localPhotoKey, photoSource } from '../photoSource';

describe('photoSource', () => {
  it('resolves every bundled key the mock data uses (offline demo)', () => {
    const images = [
      ...Object.values(PHOTOS),
      ...Object.values(CATEGORY_PHOTOS),
      ...PRODUCTS.map((p) => p.image),
      ...PROMOTIONS.map((p) => p.image),
      ...REWARDS.map((r) => r.image),
    ];
    for (const image of images) {
      expect(image.startsWith('local:')).toBe(true);
      expect(localPhotoKey(image)).not.toBeNull();
      expect(photoSource(image)).not.toBeNull();
      expect(typeof photoSource(image)).not.toBe('string');
    }
  });

  it('marks product photos as cut-outs and scenes as opaque', () => {
    for (const p of PRODUCTS) expect(isCutoutPhoto(p.image)).toBe(true);
    expect(isCutoutPhoto(PHOTOS.cafeInterior)).toBe(false);
    expect(isCutoutPhoto(PHOTOS.latteArt)).toBe(false);
    expect(isCutoutPhoto('https://example.com/a.png')).toBe(false);
  });

  it('maps Unsplash URLs persisted by earlier builds onto the bundled art', () => {
    const legacy = 'https://images.unsplash.com/photo-1654921469305-28d0081c7a79?w=240&h=240&q=80&auto=format&fit=crop';
    expect(localPhotoKey(legacy)).toBe('latte');
    expect(photoSource(legacy)).toBe(photoSource(localPhoto('latte')));
    expect(isCutoutPhoto(legacy)).toBe(true);
  });

  it('passes other URLs through and tolerates empty or unknown values', () => {
    expect(photoSource('https://example.com/a.png')).toEqual({ uri: 'https://example.com/a.png' });
    expect(photoSource('')).toBeNull();
    expect(photoSource(undefined)).toBeNull();
    expect(photoSource('local:nope')).toBeNull();
    expect(localPhotoKey('local:nope')).toBeNull();
  });
});
