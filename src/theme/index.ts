/**
 * Design tokens — DESIGN.md §R3.A (light) and §R4 (dark mode).
 *
 * Colours are SCHEME-AWARE: read them at render time with `useTheme()` / `useColors()` or
 * `makeStyles((c, t) => …)` from this module (see `theming.tsx`, BUILD_CONTRACT → Theming). The
 * static `colors` / `heroTints` / `tileTints` / `shadows` exports below are the LIGHT palette, kept
 * only so screens that haven't been converted yet still compile; themed code must not import them
 * (ESLint `no-restricted-imports` enforces it in converted folders).
 *
 * Everything else here (spacing, radii, fonts, type, springs, durations, layout) is scheme-independent.
 *
 * Three planes (R3.A1): `bg` canvas (cream) → `tileTints` (category-tinted product tiles and
 * heroes, a visible step darker and warmer) → `surface` white (lists, forms and the two notched
 * sheets only). `night` is the full-screen dark plane (splash, onboarding, auth top, confirmation,
 * payment reveal); it is the same in both schemes.
 */
import type { TextStyle, ViewStyle } from 'react-native';
import { lightColors, lightHeroTints, lightTileTints, type HeroTint } from './palette';

export {
  darkBoxShadows,
  darkColors,
  darkContact,
  darkHeroTints,
  darkTileTints,
  lightBoxShadows,
  lightColors,
  lightContact,
  lightHeroTints,
  lightTileTints,
  type BoxShadowTokens,
  type ColorScheme,
  type ColorTokens,
  type ContactShadowTokens,
  type HeroTint,
} from './palette';
export {
  darkTheme,
  lightTheme,
  makeStyles,
  makeThemed,
  ThemeProvider,
  ThemeScope,
  themeFor,
  useColors,
  useTheme,
  type ShadowStyles,
  type Theme,
} from './theming';
export {
  APPEARANCE_LABEL,
  APPEARANCE_PREFERENCES,
  FOLLOW_SYSTEM_SCHEME,
  resolveScheme,
  sanitizeAppearance,
  type AppearancePreference,
} from './appearance';

/**
 * @deprecated Static LIGHT palette for screens not yet on the theme. Themed code reads
 * `useColors()` / `makeStyles((c) => …)` instead.
 */
export const colors = lightColors;

/** @deprecated Static LIGHT hero planes; themed code reads `useTheme().heroTints`. */
export const heroTints = lightHeroTints;

/** @deprecated Static LIGHT tile tints; themed code reads `useTheme().tileTints`. */
export const tileTints: Record<HeroTint, string> = lightTileTints;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  gutter: 20,
} as const;

/**
 * R3.A2 shape language. Rounded squares hold products (`tile` ≥140px, `category` 64px tiles,
 * `thumb` 64px list thumbnails, `thumbSmall` ≤56px); `sheet` for the white sheets and notched
 * sheets, `banner` for the promo and peach cards. Circles are reserved for controls.
 */
export const radii = {
  xs: 8,
  sm: 12,
  md: 20,
  lg: 28,
  xl: 36,
  tile: 28,
  category: 22,
  thumb: 20,
  thumbSmall: 16,
  sheet: 32,
  banner: 30,
  pill: 999,
} as const;

export const fonts = {
  light: 'Outfit_300Light',
  regular: 'Outfit_400Regular',
  medium: 'Outfit_500Medium',
  semibold: 'Outfit_600SemiBold',
  bold: 'Outfit_700Bold',
  extrabold: 'Outfit_800ExtraBold',
  /** Wordmark (splash, auth, profile footer). */
  brand: 'Fraunces_600SemiBold_Italic',
  /** Editorial serif accent (R3.A5 whitelist: greeting name, Menu watermark, "placed.", tier name). */
  serif: 'Fraunces_400Regular_Italic',
} as const;

/**
 * Type scale (R3.A5). Sentence case everywhere except `screenTitle` ("MENU" only) and `micro`
 * (stickers). Never set `fontWeight`: the weight is the font family.
 */
export const type = {
  /** Onboarding headlines, confirmation "Order". 44/48 on 667pt screens (caller's choice). */
  display: { fontFamily: fonts.light, fontSize: 52, lineHeight: 56, letterSpacing: -1.6 },
  /** Every screen title ("Cart", "Checkout", "Orders"…), sentence case. */
  title: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 36, letterSpacing: -0.4 },
  /** Only "MENU" (ref 2's "PICK UP"). */
  screenTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  /** Product hero split title: `titleBold` first word + `titleLight` rest (30/36). */
  titleBold: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 36 },
  titleLight: { fontFamily: fonts.light, fontSize: 30, lineHeight: 36 },
  /** Home greeting ("Morning, " — the name goes in `greetingName`). */
  greeting: { fontFamily: fonts.light, fontSize: 32, lineHeight: 38, letterSpacing: -0.6 },
  greetingName: { fontFamily: fonts.serif, fontSize: 35, lineHeight: 38 },
  h1: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28 },
  /** Section headers. */
  h2: { fontFamily: fonts.semibold, fontSize: 19, lineHeight: 24 },
  /** Row titles, sheet labels. */
  h3: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  /** Product card names. */
  cardName: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22 },
  /** Secondary lines (pair with `inkSoft`). */
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  /** Section labels above a white sheet (pair with `inkSoft`). */
  sectionLabel: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
  label: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  /** Stickers only (BEST SELLER, NEW). */
  micro: { fontFamily: fonts.bold, fontSize: 10, lineHeight: 12, letterSpacing: 0.8, textTransform: 'uppercase' },
  price: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22 },
  priceLarge: { fontFamily: fonts.bold, fontSize: 34, lineHeight: 40 },
  /** Cart and checkout total (payment amount uses 52/56). */
  priceHero: { fontFamily: fonts.bold, fontSize: 44, lineHeight: 48, letterSpacing: -0.5 },
  /** Pickup code (confirmation, tracking). */
  code: { fontFamily: fonts.extrabold, fontSize: 46, lineHeight: 50, letterSpacing: 3 },
  /** Menu header watermark (pair with ink at 4.5%). */
  watermark: { fontFamily: fonts.serif, fontSize: 96, lineHeight: 110 },
  brand: { fontFamily: fonts.brand, fontSize: 32, lineHeight: 38 },
} satisfies Record<string, TextStyle>;

/**
 * @deprecated Static LIGHT shadows; themed code reads `useTheme().shadows` (same keys, black pools
 * in dark). Shadows (R3.A3) as `boxShadow` (RN 0.86 New Architecture renders it on iOS and Android 9+; web
 * gets the same CSS). Deliberately not `shadow*` + `elevation`:
 *  - Android draws children sorted by elevation, so an elevated plate painted OVER the stickers
 *    and quick-add "+" that sit on top of it in JSX order;
 *  - elevation / iOS pixel shadows show through translucent fills;
 *  - Android elevation shadows are grey and much heavier than the approved web look.
 *
 * R3: planes separate by colour. `soft` / `card` are RETIRED on cards, rows, tiles and sheets (kept
 * only so older call sites compile; don't add new uses). Cut-outs get the `ContactShadow`
 * component (components/domain/productArt), not a boxShadow.
 */
export const shadows = {
  /** Tab bar, floating cart bar, toasts. */
  float: { boxShadow: '0px 10px 30px rgba(59, 38, 24, 0.12)' },
  /** Ink primary bar, white CTA on night. */
  cta: { boxShadow: '0px 12px 24px rgba(28, 23, 20, 0.22)' },
  /** @deprecated R3: alias of `cta`. */
  strong: { boxShadow: '0px 12px 24px rgba(28, 23, 20, 0.22)' },
  /** @deprecated R3: retired on cards, rows, tiles and sheets. */
  soft: { boxShadow: '0px 8px 24px rgba(59, 38, 24, 0.08)' },
  /** @deprecated R3: retired on cards, rows, tiles and sheets. */
  card: { boxShadow: '0px 6px 16px rgba(59, 38, 24, 0.06)' },
} satisfies Record<string, ViewStyle>;

/** Spring presets — DESIGN.md §7. Use with withSpring(value, springs.snappy). */
export const springs = {
  snappy: { damping: 18, stiffness: 260, mass: 1 },
  smooth: { damping: 22, stiffness: 180, mass: 1 },
  gentle: { damping: 26, stiffness: 120, mass: 1 },
  bouncy: { damping: 12, stiffness: 220, mass: 1 },
} as const;

export const durations = {
  fast: 120,
  base: 220,
  slow: 320,
  stagger: 40,
} as const;

export const layout = {
  tapTarget: 48,
  /** Header icon buttons (R3.A8: 44px white circles, 20px glyphs). */
  headerButton: 44,
  circleButton: 52,
  ctaHeight: 64,
  /** The primary bar's white circle (22px glyph). */
  ctaCircle: 52,
  tabBarHeight: 68,
  tabBarInset: 16,
} as const;

