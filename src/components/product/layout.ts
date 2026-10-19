/**
 * Product-detail geometry (DESIGN.md §R3.B "Product detail"): one place that turns the window, the
 * safe area and the product name into the hero, title, art box and sheet rects, so every layer lines
 * up on any phone — and so the hero flight knows where the cut-out lands before the first layout.
 *
 *  - hero: clamp(H × 0.56, 380, 520) including the safe area, flat `heroTints[tint]`; short phones
 *    (< 720pt) use H × 0.545 (≈ 364 on 667pt) so the size caption and the quantity row stay in the
 *    first viewport
 *  - title: left 24, top safeTop + 64, width W − 48, ≤ 2 lines (30/36), then one 18px meta line
 *  - art box: min(W × 0.80, 320, the room under the meta line), centred, bottom = heroH − 40, so
 *    the plate and its shadow sit in clear air above the sheet's shoulders (not cut by them)
 *  - sheet: top = heroH − 42, a concave notch 22 deep × 260 wide under the plate
 */
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { layout as themeLayout, radii, type as typeScale } from '@/theme';

/** Depth of the concave notch in the sheet's top edge (the plate sits in it). */
export const NOTCH_DEPTH = 22;
/** Width of the sheet's notch. */
export const NOTCH_WIDTH = 260;
/** Height of the sheet's SVG top edge (its corner radius). */
export const SHEET_EDGE = radii.sheet;
/** Back / cart circles in the top bar (R3.A8 header buttons). */
export const TOP_BUTTON = themeLayout.headerButton;
/** Widest the sheet content and the action bar get (web on wide screens). */
export const CONTENT_MAX_WIDTH = 600;
/** Title block: left inset and its top below the safe area. */
export const TITLE_LEFT = 24;
export const TITLE_TOP = 64;
export const TITLE_SIZE = typeScale.titleBold.fontSize;
export const TITLE_LINE = typeScale.titleBold.lineHeight;
/** The "★ 4.5 · 6 min" line under the title. */
const META_GAP = 4;
const META_LINE = 18;
/** The sheet starts this far above the hero's bottom; the art box ends `ART_BASE` above the hero's. */
const SHEET_RISE = 42;
const ART_BASE = 40;
/**
 * The cut-outs carry ≥ 6% clear space above the subject (most far more), so the art box may tuck
 * this far under the meta line before a subject could touch it.
 */
const ART_TUCK = 14;

const HERO_RATIO = 0.56;
const HERO_MIN = 380;
const HERO_MAX = 520;
/**
 * Short phones (< 720pt, e.g. 375×667): a slightly shorter hero (≈ 364) and tighter sheet spacing
 * (`compact`) so the ingredients line, S / M / L, the size caption and the quantity row all sit
 * above the sticky bar in the first viewport.
 */
const COMPACT_HEIGHT = 720;
const HERO_RATIO_COMPACT = 0.545;
const HERO_MIN_COMPACT = 340;

/**
 * Lines the split title ("**Caramel** Macchiato", 30px) wraps to in `width`. A width estimate from
 * Outfit's average advance (bold ≈ 0.56em, light ≈ 0.5em) so the art box is known before layout
 * (the hero flight needs its landing rect on the first frame). Never more than 2.
 */
export function titleLines(name: string, width: number): 1 | 2 {
  const [first = '', ...rest] = name.split(' ');
  const restText = rest.join(' ');
  const estimate = TITLE_SIZE * (first.length * 0.56 + (restText ? restText.length * 0.5 + 0.3 : 0));
  return estimate > width * 0.96 ? 2 : 1;
}

export interface ProductLayout {
  width: number;
  height: number;
  insetTop: number;
  insetBottom: number;
  /** Top of the back / cart row. */
  topBarTop: number;
  /** Height of the compact header that fades in once the sheet reaches the top. */
  headerHeight: number;
  /** Height of the tinted hero plane. */
  heroHeight: number;
  /** Title block (window coordinates at rest). */
  titleTop: number;
  titleWidth: number;
  /** Bottom of the meta line under the title. */
  titleBottom: number;
  /** Where the sheet's top edge starts in the scroll content (and on screen at rest). */
  sheetTop: number;
  /** The cut-out's art box (square). */
  artSize: number;
  /** Top / left of the art box (window coordinates at rest). */
  artTop: number;
  artLeft: number;
  /** Bottom padding of the scroll content so the last row clears the sticky bar. */
  barSpace: number;
  /** Bottom inset of the sticky bar. */
  barBottom: number;
  /** A short phone: the sheet tightens its first-viewport spacing. */
  compact: boolean;
}

export function useProductLayout(name: string): ProductLayout {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const topBarTop = insets.top + 8;
  const headerHeight = topBarTop + TOP_BUTTON + 8;
  const compact = height < COMPACT_HEIGHT;
  const heroHeight = compact
    ? Math.min(HERO_MAX, Math.max(HERO_MIN_COMPACT, Math.round(height * HERO_RATIO_COMPACT)))
    : Math.min(HERO_MAX, Math.max(HERO_MIN, Math.round(height * HERO_RATIO)));
  const sheetTop = heroHeight - SHEET_RISE;

  const titleTop = insets.top + TITLE_TOP;
  const titleWidth = Math.min(width, CONTENT_MAX_WIDTH) - TITLE_LEFT * 2;
  const titleBottom = titleTop + titleLines(name, titleWidth) * TITLE_LINE + META_GAP + META_LINE;

  const room = heroHeight - ART_BASE - titleBottom + ART_TUCK;
  const artSize = Math.round(Math.max(150, Math.min(width * 0.8, 320, room)));
  const artTop = heroHeight - ART_BASE - artSize;
  const artLeft = Math.round((width - artSize) / 2);

  const barBottom = Math.max(insets.bottom, 16);
  const barSpace = themeLayout.ctaHeight + barBottom + 40;

  return {
    width,
    height,
    insetTop: insets.top,
    insetBottom: insets.bottom,
    topBarTop,
    headerHeight,
    heroHeight,
    titleTop,
    titleWidth,
    titleBottom,
    sheetTop,
    artSize,
    artTop,
    artLeft,
    barSpace,
    barBottom,
    compact,
  };
}

/** Art scale for the selected size (R3.C2: S 0.9 / M 1.0 / L 1.08). No size yet → 1. */
export function heroScaleForSize(index: number, count: number): number {
  if (index < 0 || count <= 1) return 1;
  if (count === 3) return [0.9, 1, 1.08][index] ?? 1;
  return 0.9 + (0.18 * index) / (count - 1);
}
