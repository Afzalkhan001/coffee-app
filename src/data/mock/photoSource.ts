/**
 * Resolves the image strings stored on products, cart lines, orders and rewards into expo-image
 * sources. Every product photo is a bundled, transparent cut-out (assets/products, 900×900 WebP) and
 * every banner a bundled scene (assets/scenes), so the demo works fully offline.
 *
 * Image fields stay plain strings (persisted carts/orders store them): bundled art is addressed as
 * `local:<key>`, http(s) URLs pass through untouched, and the Unsplash URLs that earlier builds
 * persisted are mapped onto the matching bundled cut-out so old carts and orders render the new art.
 */
import type { ImageSource } from 'expo-image';

export const LOCAL_PHOTO_PREFIX = 'local:';

const PRODUCT_ASSETS = {
  espresso: require('../../../assets/products/espresso.webp'),
  cappuccino: require('../../../assets/products/cappuccino.webp'),
  latte: require('../../../assets/products/latte.webp'),
  flatWhite: require('../../../assets/products/flatWhite.webp'),
  caramelMacchiato: require('../../../assets/products/caramelMacchiato.webp'),
  mocha: require('../../../assets/products/mocha.webp'),
  americano: require('../../../assets/products/americano.webp'),
  spanishLatte: require('../../../assets/products/spanishLatte.webp'),
  matchaLatte: require('../../../assets/products/matchaLatte.webp'),
  chaiLatte: require('../../../assets/products/chaiLatte.webp'),
  coldBrew: require('../../../assets/products/coldBrew.webp'),
  icedLatte: require('../../../assets/products/icedLatte.webp'),
  icedPeachTea: require('../../../assets/products/icedPeachTea.webp'),
  croissant: require('../../../assets/products/croissant.webp'),
  avocadoToast: require('../../../assets/products/avocadoToast.webp'),
  breakfastSandwich: require('../../../assets/products/breakfastSandwich.webp'),
  bananaBread: require('../../../assets/products/bananaBread.webp'),
  cookie: require('../../../assets/products/cookie.webp'),
  cheesecake: require('../../../assets/products/cheesecake.webp'),
  brownie: require('../../../assets/products/brownie.webp'),
  tiramisu: require('../../../assets/products/tiramisu.webp'),
} as const satisfies Record<string, number>;

const SCENE_ASSETS = {
  latteArt: require('../../../assets/scenes/latteArt.webp'),
  beans: require('../../../assets/scenes/beans.webp'),
  pastries: require('../../../assets/scenes/pastries.webp'),
  cafeInterior: require('../../../assets/scenes/cafeInterior.webp'),
} as const satisfies Record<string, number>;

export type ProductPhotoKey = keyof typeof PRODUCT_ASSETS;
export type ScenePhotoKey = keyof typeof SCENE_ASSETS;
export type LocalPhotoKey = ProductPhotoKey | ScenePhotoKey;

const ASSETS: Readonly<Record<string, number>> = { ...PRODUCT_ASSETS, ...SCENE_ASSETS };

/** Unsplash photo ids persisted by earlier builds → the bundled art that replaced them. */
const LEGACY_UNSPLASH: Readonly<Record<string, LocalPhotoKey>> = {
  '1642090111860-3f132abbc0dd': 'espresso',
  '1621135177072-57c9b6242e7a': 'cappuccino',
  '1654921469305-28d0081c7a79': 'latte',
  '1676506129134-c8aef41eb4d3': 'flatWhite',
  '1729853259792-d0fcaf735ca8': 'caramelMacchiato',
  '1619286310410-a95de97b0aec': 'mocha',
  '1522120260484-0c13c92f4aa1': 'americano',
  '1562447457-579fc34967fb': 'spanishLatte',
  '1561658286-ecb9fe9d8480': 'matchaLatte',
  '1741321725204-13e3452ff7fc': 'chaiLatte',
  '1731681963953-b959cb773c1a': 'coldBrew',
  '1589985902809-39d25db22101': 'icedLatte',
  '1784735694665-8c601c531ce8': 'icedPeachTea',
  '1681218079567-35aef7c8e7e4': 'croissant',
  '1588137378633-dea1336ce1e2': 'avocadoToast',
  '1559962956-34e40045254f': 'breakfastSandwich',
  '1779282832757-fe41c2177d03': 'bananaBread',
  '1584369372650-359b4003e743': 'cookie',
  '1582623196338-9454316891dd': 'cheesecake',
  '1636743715220-d8f8dd900b87': 'brownie',
  '1724116379273-ba32b70d112c': 'tiramisu',
  '1541167760496-1628856ab772': 'latteArt',
  '1517668808822-9ebb02f2a0e6': 'beans',
  '1623334044303-241021148842': 'pastries',
  '1633583960343-e258fb899aef': 'cafeInterior',
};

const UNSPLASH_ID = /images\.unsplash\.com\/photo-(\d+-[0-9a-f]+)/;

/** `'local:latte'` for a bundled key (what product/reward/promo `image` fields hold). */
export function localPhoto(key: LocalPhotoKey): string {
  return `${LOCAL_PHOTO_PREFIX}${key}`;
}

/** The bundled key an image string points at (`local:<key>` or a legacy Unsplash URL), else null. */
export function localPhotoKey(image: string | null | undefined): LocalPhotoKey | null {
  if (!image) return null;
  if (image.startsWith(LOCAL_PHOTO_PREFIX)) {
    const key = image.slice(LOCAL_PHOTO_PREFIX.length);
    return key in ASSETS ? (key as LocalPhotoKey) : null;
  }
  const id = UNSPLASH_ID.exec(image)?.[1];
  return id ? (LEGACY_UNSPLASH[id] ?? null) : null;
}

/**
 * True when the image is a transparent product cut-out (square canvas, ~6% padding, no backdrop):
 * render it with `contentFit="contain"` on a tinted tile or hero. False for scenes and remote photos,
 * which are opaque rectangles that want `cover`.
 */
export function isCutoutPhoto(image: string | null | undefined): boolean {
  const key = localPhotoKey(image);
  return key != null && key in PRODUCT_ASSETS;
}

/**
 * expo-image `source` for a stored image string: the bundled module for local/legacy keys, `{ uri }`
 * for any other URL, null for an empty value. Works on iOS, Android and web.
 */
export function photoSource(image: string | null | undefined): ImageSource | number | null {
  if (!image) return null;
  const key = localPhotoKey(image);
  if (key) return ASSETS[key];
  if (image.startsWith(LOCAL_PHOTO_PREFIX)) return null; // unknown bundled key: render the placeholder fill
  return { uri: image };
}
