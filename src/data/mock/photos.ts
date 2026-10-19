import { localPhoto } from './photoSource';

/**
 * Every image the mock data uses, bundled in the app so the demo works offline.
 *  - Products: transparent cut-outs in `assets/products/<key>.webp` (900×900, centred, base 3% above
 *    the bottom edge). Render them with `contentFit="contain"` on a tinted plane.
 *  - Scenes: opaque banners in `assets/scenes/<key>.webp` (1200px wide).
 * Values are plain `local:<key>` strings (products, cart lines and orders persist them); resolve
 * them with `photoSource()` from `./photoSource`.
 * Source photos come from Unsplash (free Unsplash License); photographers are credited in
 * docs/research/photos/CREDITS.md. Swap in the client's own cut-outs for the production build.
 */
export const PHOTOS = {
  espresso: localPhoto('espresso'),
  cappuccino: localPhoto('cappuccino'),
  latte: localPhoto('latte'),
  flatWhite: localPhoto('flatWhite'),
  caramelMacchiato: localPhoto('caramelMacchiato'),
  mocha: localPhoto('mocha'),
  americano: localPhoto('americano'),
  spanishLatte: localPhoto('spanishLatte'),
  matchaLatte: localPhoto('matchaLatte'),
  chaiLatte: localPhoto('chaiLatte'),
  coldBrew: localPhoto('coldBrew'),
  icedLatte: localPhoto('icedLatte'),
  icedPeachTea: localPhoto('icedPeachTea'),
  croissant: localPhoto('croissant'),
  avocadoToast: localPhoto('avocadoToast'),
  breakfastSandwich: localPhoto('breakfastSandwich'),
  bananaBread: localPhoto('bananaBread'),
  cookie: localPhoto('cookie'),
  cheesecake: localPhoto('cheesecake'),
  brownie: localPhoto('brownie'),
  tiramisu: localPhoto('tiramisu'),
  latteArt: localPhoto('latteArt'),
  beans: localPhoto('beans'),
  pastries: localPhoto('pastries'),
  cafeInterior: localPhoto('cafeInterior'),
} as const;

export type PhotoKey = keyof typeof PHOTOS;
