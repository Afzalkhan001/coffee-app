/**
 * Per-cut-out placement metrics (measured from the alpha of `assets/products/*.webp`, 900×900).
 *
 * Every cut-out is framed the same way (subject bottom 3.1% above the box bottom, ≥ 6% clear space),
 * but a framing box is not a footprint: a croissant's horns and a tiramisu's front corner reach the
 * box bottom while the body they rest on sits higher, so those items hovered 4–15pt above their
 * contact shadow; and a wedge of cheesecake framed edge to edge read bigger than a cup and saucer.
 *
 *  - `contact`: where the subject actually rests under the shadow's centre (fraction of the box
 *    above its bottom; the median bottom of the columns under the 62%-wide shadow).
 *  - `scale`: display scale so the whole set reads as one scale (cups on saucers = 1).
 *  - `top` / `left` / `right`: the subject's alpha bounding box (fractions of the box).
 *
 * `artPlacement()` turns them into one transform (scale about the box centre, then shift) that puts
 * the contact point back on the shared baseline, so every renderer — `ProductArt`, the product hero,
 * the flying fly-to-cart clone — places a cut-out identically and the hand-offs line up.
 */
import { localPhotoKey } from './photoSource';

/** Where a cut-out's base meets its contact shadow (fraction of the box above its bottom). */
export const ART_BASELINE = 0.031;

interface Metrics {
  top: number;
  left: number;
  right: number;
  contact?: number;
  scale?: number;
}

const METRICS: Readonly<Record<string, Metrics>> = {
  americano: { top: 0.309, left: 0.061, right: 0.938 },
  avocadoToast: { top: 0.198, left: 0.062, right: 0.938 },
  bananaBread: { top: 0.288, left: 0.061, right: 0.939, contact: 0.048 },
  breakfastSandwich: { top: 0.274, left: 0.064, right: 0.936 },
  brownie: { top: 0.153, left: 0.154, right: 0.847, contact: 0.05 },
  cappuccino: { top: 0.283, left: 0.061, right: 0.939 },
  caramelMacchiato: { top: 0.16, left: 0.179, right: 0.819 },
  chaiLatte: { top: 0.428, left: 0.062, right: 0.939 },
  cheesecake: { top: 0.277, left: 0.06, right: 0.939, contact: 0.06, scale: 0.84 },
  coldBrew: { top: 0.193, left: 0.154, right: 0.846 },
  cookie: { top: 0.178, left: 0.151, right: 0.849 },
  croissant: { top: 0.346, left: 0.061, right: 0.939, contact: 0.08, scale: 0.98 },
  espresso: { top: 0.329, left: 0.06, right: 0.939 },
  flatWhite: { top: 0.233, left: 0.061, right: 0.939 },
  icedLatte: { top: 0.091, left: 0.26, right: 0.739 },
  icedPeachTea: { top: 0.091, left: 0.31, right: 0.69 },
  latte: { top: 0.256, left: 0.07, right: 0.93 },
  matchaLatte: { top: 0.199, left: 0.154, right: 0.844 },
  mocha: { top: 0.091, left: 0.169, right: 0.831 },
  spanishLatte: { top: 0.092, left: 0.243, right: 0.756 },
  tiramisu: { top: 0.347, left: 0.062, right: 0.939, contact: 0.07, scale: 0.96 },
};

/** Unknown / remote images: a generic centred subject. */
const FALLBACK: Metrics = { top: 0.25, left: 0.08, right: 0.92 };

function metricsFor(image: string | null | undefined): Metrics {
  const key = localPhotoKey(image);
  return (key ? METRICS[key] : undefined) ?? FALLBACK;
}

export interface ArtPlacement {
  /** Display scale about the box centre. */
  scale: number;
  /** Downward shift after scaling, as a fraction of the box. */
  shift: number;
}

const IDENTITY: ArtPlacement = { scale: 1, shift: 0 };

/** Scale + shift that seat `image`'s contact point on the shared baseline. Identity for cups. */
export function artPlacement(image: string | null | undefined): ArtPlacement {
  const key = localPhotoKey(image);
  const m = key ? METRICS[key] : undefined;
  if (!m || (m.contact == null && m.scale == null)) return IDENTITY;
  const scale = m.scale ?? 1;
  const contactY = 1 - (m.contact ?? ART_BASELINE);
  const shift = 1 - ART_BASELINE - 0.5 - scale * (contactY - 0.5);
  return { scale, shift };
}

/** The placement as a style transform for a `size` box, or undefined when it's the identity. */
export function artPlacementTransform(image: string | null | undefined, size: number): { transform: ({ translateY: number } | { scale: number })[] } | undefined {
  const p = artPlacement(image);
  if (p.scale === 1 && p.shift === 0) return undefined;
  return { transform: [{ translateY: Math.round(p.shift * size * 10) / 10 }, { scale: p.scale }] };
}

/** Where the subject's top edge lands after placement (fraction of the box). */
export function placedSubjectTop(image: string | null | undefined): number {
  const p = artPlacement(image);
  return 0.5 + p.shift + p.scale * (metricsFor(image).top - 0.5);
}

/** Where the subject's right edge lands after placement (fraction of the box). */
export function placedSubjectRight(image: string | null | undefined): number {
  const p = artPlacement(image);
  return 0.5 + p.scale * (metricsFor(image).right - 0.5);
}

/** The subject's top edge as framed in the asset (fraction of the box); unknown images → 0.25. */
export function rawSubjectTop(image: string | null | undefined): number {
  return metricsFor(image).top;
}
