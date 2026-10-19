/**
 * Photo helpers shared by every domain surface: `sizedPhoto` (width-bucketed remote URLs; bundled
 * art normalised to `local:<key>`), the hero prefetch, and the legacy `Photo` / `ThumbStack`
 * wrappers (now R3 cut-out tiles, see ./productArt).
 * Image strings resolve through `photoSource()` (data/mock/photoSource): bundled `local:<key>`
 * cut-outs/scenes, legacy Unsplash URLs mapped onto them, or any http(s) URL.
 */
import { Image, type ImageProps } from 'expo-image';
import { PixelRatio, type StyleProp, type ViewStyle } from 'react-native';
import { isCutoutPhoto, localPhoto, localPhotoKey } from '@/data/mock/photoSource';
import type { HeroTint } from '@/theme';
import { ArtStack, ArtTile, ProductArt, tileRadius } from './productArt';

/** Width buckets keep the image cache warm across cards that render at similar sizes. */
const WIDTH_BUCKETS = [120, 168, 240, 360, 480, 720, 1080] as const;

const W_PARAM = /([?&])w=(\d+)/;
const H_PARAM = /([?&])h=(\d+)/;

/**
 * Rewrites an Unsplash URL's `w=` to the smallest bucket that covers `displaySize` dp at device
 * density. A fixed `h=` is scaled with it: with `fit=crop`, `w=120&h=800` would return a tall
 * 120×800 strip that `contentFit="cover"` then magnifies into a blurry close-up.
 * Bundled art (`local:<key>`, and legacy Unsplash URLs that map onto it) comes back as the
 * normalised `local:<key>` string: one file serves every size, so card, clone and hero all match.
 */
export function sizedPhoto(url: string, displaySize: number): string {
  const local = localPhotoKey(url);
  if (local) return localPhoto(local);
  if (!url.includes('images.unsplash.com')) return url;
  const px = displaySize * Math.min(3, PixelRatio.get());
  const w = WIDTH_BUCKETS.find((b) => b >= px) ?? WIDTH_BUCKETS[WIDTH_BUCKETS.length - 1];
  const ow = Number(W_PARAM.exec(url)?.[2] ?? 0);
  const oh = Number(H_PARAM.exec(url)?.[2] ?? 0);
  const sized = url.replace(W_PARAM, `$1w=${w}`);
  return ow > 0 && oh > 0 ? sized.replace(H_PARAM, `$1h=${Math.round((w * oh) / ow)}`) : sized;
}

/**
 * Diameter of the product-detail hero photo for a window — mirrors `useProductLayout()` in
 * components/product/layout.ts (hero ≈46% of the screen, plate between the top bar and the sheet
 * notch, 168–300dp). Used to prefetch the exact hero bucket on card press-in so the photo is in
 * cache before the flight lands (DESIGN §7 checklist #3).
 */
export function heroPhotoSize(windowWidth: number, windowHeight: number, insetTop: number): number {
  const heroHeight = Math.max(Math.round(windowHeight * 0.46), 330);
  const sheetTop = heroHeight - 32;
  const regionTop = insetTop + 8 + 40;
  const band = sheetTop - 6 - regionTop - 18;
  return Math.round(Math.min(300, Math.max(168, Math.min(windowWidth * 0.64, band))));
}

/** Warm the memory/disk cache with the hero-sized photo (fire and forget). Bundled art needs no prefetch. */
export function prefetchHeroPhoto(url: string, windowWidth: number, windowHeight: number, insetTop: number) {
  if (localPhotoKey(url)) return;
  void Image.prefetch(sizedPhoto(url, heroPhotoSize(windowWidth, windowHeight, insetTop)), 'memory-disk').catch(
    () => undefined,
  );
}

export interface PhotoProps {
  uri: string;
  size: number;
  /** Corner radius of the tile. Default: the R3 thumbnail radius for the size (never a circle). */
  radius?: number;
  /** Tile tint key or colour. Default: the image's product category tint. */
  tint?: HeroTint | string;
  recyclingKey?: string;
  priority?: ImageProps['priority'];
  /** Web: load immediately instead of lazily (above-the-fold images). */
  eager?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * @deprecated R3 retired circular product photos. Kept so older call sites keep rendering, now as
 * an R3 list thumbnail: the cut-out standing on a tinted rounded square with a contact shadow
 * (`ArtTile`), or a cover image in a rounded square for remote/scene images. New code uses
 * `ArtThumb` / `ArtTile` / `ProductArt` from ./productArt.
 */
export function Photo({ uri, size, radius, tint, recyclingKey, priority = 'normal', eager, style }: PhotoProps) {
  if (!isCutoutPhoto(uri)) {
    return (
      <ProductArt
        image={uri}
        size={size}
        recyclingKey={recyclingKey}
        priority={priority}
        eager={eager}
        style={style}
      />
    );
  }
  return (
    <ArtTile
      image={uri}
      tint={tint}
      width={size}
      radius={radius ?? tileRadius(size)}
      artSize={Math.round(size * 0.906)}
      recyclingKey={recyclingKey}
      priority={priority}
      eager={eager}
      style={style}
    />
  );
}

export interface ThumbStackProps {
  images: string[];
  size?: number;
  /** Maximum pieces (≤ 3). R3: no "+N" bubble. */
  max?: number;
  /** @deprecated R3 has no rings; ignored. */
  ringColor?: string;
  /** Fraction of each piece hidden under its neighbour. */
  overlap?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * @deprecated R3 retired ringed thumbnail stacks. Kept for older call sites; renders `ArtStack`
 * (overlapping cut-outs, no rings, no "+N"). New code uses `ArtStack` / `ArtCluster`.
 */
export function ThumbStack({ images, size = 44, max = 3, overlap = 0.34, style }: ThumbStackProps) {
  return <ArtStack images={images} size={size} max={max} overlap={Math.round(size * overlap)} style={style} />;
}
