/**
 * Onboarding geometry (DESIGN.md §R3.B "Onboarding ×3", 390×844 reference).
 *
 * Fixed, screen-level chrome shared by all three pages:
 *  - the sage capsule: left 0.30 W, bleeding 32px off the right edge, 140 tall (112 on short
 *    phones), top 0.448 H;
 *  - the 96px glossy arrow button bleeding 14px off the right edge, 20px above the safe area, with
 *    the page dots vertically centred on it at left 24;
 *  - the doodle field from the screen top to 16px above the capsule.
 * Each page's text starts 34px below the capsule. When the tallest page's text would run into the
 * dots (short phones), the capsule and text move up together, and the doodle field shrinks with
 * them (its y scale is min(1, band / 362)).
 */
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const PAGE_COUNT = 3;
export const LAST_PAGE = PAGE_COUNT - 1;
/** Phone-width column on tablets / desktop web. */
export const MAX_FRAME = 520;
export const GUTTER = 24;
/** Window height under which the pages tighten (iPhone SE / 8: 667pt). */
const SHORT_BELOW = 720;

/** The big arrow button (R3: 96px, 14px past the right edge, 20px above the safe area). */
export const BUTTON = 96;
export const BUTTON_BLEED = 14;
const BUTTON_LIFT = 20;
/** Peach progress arc radius around the button (128px box). */
export const ARC_RADIUS = 61;
export const ARC_BOX = 128;

/** The doodle field is designed for a 362px band (capsule top − 16 on the 390×844 frame). */
export const FIELD_REFERENCE_BAND = 362;
/** The R3.A9 table assumes a 47pt safe area; web and older phones report less, so never shift by more than this. */
const MIN_FIELD_SAFE_TOP = 24;

/** Body / toggle block under the headline: 12 + two 22px lines (body, permission notes) or 16 + the 32px switch row. */
const BODY_BLOCK = 12 + 44;
const TOGGLE_BLOCK = 16 + 32;
/** Air kept between the lowest text and the page dots. */
const DOTS_CLEARANCE = 18;
/** Widest headline line in em ("nearest café", Outfit Light with −1.6 tracking at 52), rounded up. */
const HEADLINE_WIDEST_EM = 5.9;

export interface OnboardingMetrics {
  width: number;
  height: number;
  /** Page width (window width, capped at MAX_FRAME). */
  frame: number;
  /** Left edge of the centred frame. */
  frameLeft: number;
  insetTop: number;
  insetBottom: number;
  /** Safe-area top the doodle table is shifted by (R3.A9: + safeTop − 47). */
  fieldSafeTop: number;
  /** Short phone (< 720pt tall). */
  short: boolean;
  capsule: { left: number; top: number; width: number; height: number };
  /** Height of the doodle band (screen top → capsule top − 16). */
  band: number;
  /** Top of every page's headline. */
  headTop: number;
  headline: { fontSize: number; lineHeight: number; letterSpacing: number };
  /** Max width for the body copy and the toggle row (clear of the button's arc). */
  bodyWidth: number;
  /** Button box (frame-relative left, bottom from the screen bottom) and its centre line. */
  button: { left: number; bottom: number; centerY: number };
}

/**
 * @param measured The screen root's laid-out size once known. Android edge-to-edge window
 *   dimensions don't always match the real layout box, so the measured size wins.
 */
export function useOnboardingMetrics(measured?: { width: number; height: number } | null): OnboardingMetrics {
  const windowSize = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const width = measured?.width ?? windowSize.width;
  const height = measured?.height ?? windowSize.height;
  return onboardingMetrics(width, height, insets.top, insets.bottom);
}

export function onboardingMetrics(width: number, height: number, insetTop: number, insetBottom: number): OnboardingMetrics {
  const frame = Math.min(width, MAX_FRAME);
  const short = height < SHORT_BELOW;

  // Headline: display 52/56 (44/48 on short phones), never wider than the column.
  const base = short ? 44 : 52;
  const fontSize = Math.min(base, Math.floor((frame - GUTTER * 2) / HEADLINE_WIDEST_EM));
  const lineHeight = Math.round(fontSize * (short ? 48 / 44 : 56 / 52));
  const letterSpacing = -Math.round(fontSize * (1.6 / 52) * 10) / 10;

  // Button + dots.
  const buttonBottom = insetBottom + BUTTON_LIFT;
  const centerY = height - buttonBottom - BUTTON / 2;
  const buttonLeft = frame + BUTTON_BLEED - BUTTON;
  const arcLeft = buttonLeft + BUTTON / 2 - ARC_RADIUS;

  // Capsule.
  const capH = short ? 112 : Math.min(140, Math.round(height * 0.166));
  const capLeft = Math.round(frame * 0.3);
  const gap = short ? 26 : 34;
  let capTop = Math.round(height * 0.448);
  let headTop = capTop + capH + gap;

  // The tallest page (three headline lines, or two plus a body / toggle block) must clear the dots.
  const content = Math.max(lineHeight * 3, lineHeight * 2 + Math.max(BODY_BLOCK, TOGGLE_BLOCK));
  const limit = centerY - 3 - DOTS_CLEARANCE;
  const overflow = headTop + content - limit;
  if (overflow > 0) {
    capTop -= overflow;
    headTop -= overflow;
  }

  return {
    width,
    height,
    frame,
    frameLeft: (width - frame) / 2,
    insetTop,
    insetBottom,
    fieldSafeTop: Math.max(insetTop, MIN_FIELD_SAFE_TOP),
    short,
    capsule: { left: capLeft, top: capTop, width: frame - capLeft + 32, height: capH },
    band: Math.max(0, capTop - 16),
    headTop,
    headline: { fontSize, lineHeight, letterSpacing },
    bodyWidth: Math.max(200, arcLeft - GUTTER - 10),
    button: { left: buttonLeft, bottom: buttonBottom, centerY },
  };
}
