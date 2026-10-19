/**
 * Colour palettes per scheme — DESIGN.md §R4 (dark mode) on top of §R3.A1 (light).
 *
 * Every key has the same ROLE in both schemes; only the value changes. Three kinds of key:
 *  - **Adaptive** (flip with the scheme): planes (`bg`, `surface`, `surfaceAlt`, `line`), text
 *    (`ink`, `inkSoft`, `inkMuted`), the ink-fill pair (`ink` as a fill + `onInk` content: the
 *    primary bar, selected chips, the View-cart bar invert to a cream pill in dark), controls on
 *    tinted planes (`control` / `onControl`), and the accent text tunings (`sageText`, `roastText`,
 *    `danger`), each kept at WCAG AA on its plane.
 *  - **Accent fills** (`peach`, `ember`, `sage`, `sageDeep`, `roast`, `espresso`…): identical in
 *    both schemes, because they carry white or `inkFixed` content that must keep its contrast.
 *  - **Fixed** (`night`, `white`, `black`, `glass`, `glassBorder`, `inkFixed`, `capsule` content):
 *    for the full-screen dark moments and light fills that never flip.
 * Light values are the R3 tokens unchanged (the light theme is pixel-identical to R3).
 */

/** The resolved scheme a screen renders in. */
export type ColorScheme = 'light' | 'dark';

/** Category tint keys (product tiles, category tiles, heroes). */
export type HeroTint = 'coffee' | 'tea' | 'cold' | 'breakfast' | 'desserts' | 'snacks';

export interface ColorTokens {
  // ── Planes (adaptive) ──
  /** Canvas. Also the fill for controls INSIDE `surface` sheets (price pills, qty circles, input fill). */
  bg: string;
  /** Lists, forms, notched sheets, header circles. Never product cards. White in light. */
  surface: string;
  /** Skeleton base, image placeholder, `cream` circle/badge tone. */
  surfaceAlt: string;
  /** Hairlines on `surface`, outlined chips, mode-card borders, idle input borders. */
  line: string;
  /** Scrim behind modal sheets and popovers. */
  overlay: string;

  // ── Text (adaptive) ──
  /** Primary text and glyphs. Also the PRIMARY FILL (bars, selected chips, ink "+"): pair with `onInk`. */
  ink: string;
  /** Captions, secondary lines (≥ 4.5:1 on `bg` and `surface`). */
  inkSoft: string;
  /** Placeholders, chevrons, struck-through prices, quiet metadata. */
  inkMuted: string;
  /** Text / glyph / inner circle on an `ink` fill (white in light, espresso-black in dark). */
  onInk: string;
  /** Secondary text on an `ink` fill ("· 3 items" on the View-cart bar). */
  onInkSoft: string;

  // ── Controls (adaptive) ──
  /** Small controls standing on tinted tiles and heroes: the quick-add "+", the tile heart. */
  control: string;
  /** Glyph on `control`. */
  onControl: string;
  /** Frosted header circle over a hero (pair with `theme.blurTint`). */
  frost: string;
  /**
   * Dark capsules that stay dark in BOTH schemes (toasts, the live order pill, Home's order strip):
   * ink in light, a lifted espresso in dark. Content on it is `white` (fixed) with white alphas.
   */
  capsule: string;

  // ── Accent text tuned per scheme (adaptive) ──
  /** Sage-coloured TEXT: "Open", savings, "Paid", discount rows. (Fill under white text: `sageDeep`.) */
  sageText: string;
  /** Roast-coloured TEXT and small glyphs: the rating star, counters, small links. (Fill: `roast`.) */
  roastText: string;
  /** Errors: text, the error ring, and fills under white glyphs (swipe delete, toast disc). */
  danger: string;
  /** Soft error fill behind `danger` text. */
  dangerSoft: string;
  /** Peach-tinted fill behind `ink` text (search-term highlight). */
  peachTint: string;

  // ── Store card gradient (adaptive), drawn at 100° ──
  storeFrom: string;
  storeTo: string;

  // ── Indian diet marks (adaptive: ≥ 3:1 on `bg`, `surface` and the mark's inner `surface` square) ──
  veg: string;
  egg: string;
  nonVeg: string;

  // ── Accent fills (same in both schemes) ──
  peach: string;
  peachSoft: string;
  /** At most one ember element per screen (promo, sale price or kcal badge). */
  ember: string;
  sage: string;
  /** Sage fill under white text (NEW sticker, cart badge, success disc). */
  sageDeep: string;
  /** Roast fill under white text (points pill, avatar gradient, stamps). */
  roast: string;
  /** Tracking hero card. */
  espresso: string;
  espressoDeep: string;

  // ── Fixed ──
  /** Full-screen dark moments (splash, onboarding, auth top, confirmation, payment reveal). */
  night: string;
  /** Only the onboarding capsule dot (with its glow shadow). */
  glow: string;
  /**
   * R3 ink that never flips: text on fills that stay light in both schemes (the peach card, white
   * chips and CTAs on night, the peach sticker) and the ink pills on the colour promo banners.
   */
  inkFixed: string;
  white: string;
  black: string;
  glass: string;
  glassBorder: string;
}

const ACCENTS = {
  peach: '#F4A672',
  peachSoft: '#FBD9BF',
  ember: '#E8692C',
  sage: '#8DB37E',
  sageDeep: '#5E8A50',
  roast: '#7A5236',
  espresso: '#3B2618',
  espressoDeep: '#24170E',
} as const;

const FIXED = {
  night: '#15110E',
  glow: '#F08A3C',
  inkFixed: '#1C1714',
  white: '#FFFFFF',
  black: '#000000',
  glass: 'rgba(255,255,255,0.08)',
  glassBorder: 'rgba(255,255,255,0.22)',
} as const;

/** R3 light palette (DESIGN.md §R3.A1). The values every R3 screenshot was approved with. */
export const lightColors: ColorTokens = {
  bg: '#F3ECE3',
  surface: '#FFFFFF',
  surfaceAlt: '#EFE7DC',
  line: '#E6DCCF',
  overlay: 'rgba(28,23,20,0.45)',
  ink: '#1C1714',
  inkSoft: '#6E625A',
  inkMuted: '#A39689',
  onInk: '#FFFFFF',
  onInkSoft: '#A39689',
  control: '#FFFFFF',
  onControl: '#1C1714',
  frost: 'rgba(255,255,255,0.55)',
  capsule: '#1C1714',
  sageText: '#5E8A50',
  roastText: '#7A5236',
  danger: '#D64545',
  dangerSoft: '#FBE3E1',
  peachTint: '#FBD9BF',
  storeFrom: '#FBF4EA',
  storeTo: '#F1E2CE',
  veg: '#1B8A3B',
  egg: '#B5780A',
  nonVeg: '#8B3A1E',
  ...ACCENTS,
  ...FIXED,
};

/**
 * R4 dark palette: espresso-night planes, warm off-white text, cut-outs on lifted warm-dark tiles.
 * Contrast (WCAG): ink 15.9:1 on bg · inkSoft 8.2 / 7.4 on bg / surface · inkMuted 4.3 · sageText 9.0
 * · roastText 7.6 · danger 5.5 on bg, 3.4 under white glyphs · veg 6.3 / egg 6.9 / nonVeg 4.9 on
 * surface · onInk on ink 15.9 · onInkSoft on ink 5.0.
 */
export const darkColors: ColorTokens = {
  bg: '#17120F',
  surface: '#241C17',
  surfaceAlt: '#2C231D',
  line: '#3A2F27',
  overlay: 'rgba(0,0,0,0.6)',
  ink: '#F4ECE2',
  inkSoft: '#B8AA9C',
  inkMuted: '#84776B',
  onInk: '#17120F',
  onInkSoft: '#6E625A',
  control: '#F4ECE2',
  onControl: '#17120F',
  frost: 'rgba(36,28,23,0.62)',
  capsule: '#2C231D',
  sageText: '#93C083',
  roastText: '#CD9B72',
  danger: '#EA5D52',
  dangerSoft: '#3B1D1A',
  peachTint: '#4A3123',
  storeFrom: '#2A2019',
  storeTo: '#35271B',
  veg: '#3DAA5A',
  egg: '#D99A2B',
  nonVeg: '#DB6A45',
  ...ACCENTS,
  ...FIXED,
};

/** Product tiles, category tiles and list thumbnails, per scheme (R3.A1 / R4). */
export const lightTileTints: Readonly<Record<HeroTint, string>> = {
  coffee: '#EBDBC6',
  tea: '#DCE5CF',
  cold: '#D8E2EC',
  breakfast: '#F2E0BE',
  desserts: '#EFD8DA',
  snacks: '#EEDDC8',
};

/** Dark tiles: a visible lift off the espresso canvas (≈ 1.25:1), each keeping its category hue. */
export const darkTileTints: Readonly<Record<HeroTint, string>> = {
  coffee: '#2F241B',
  tea: '#252B1F',
  cold: '#212833',
  breakfast: '#322819',
  desserts: '#33242A',
  snacks: '#30251C',
};

/** Product-detail and category hero planes. Light: one step deeper than the tile. */
export const lightHeroTints: Readonly<Record<HeroTint, string>> = {
  coffee: '#E7D4BD',
  tea: '#D5E0C7',
  cold: '#D1DDE9',
  breakfast: '#EFD9B0',
  desserts: '#EBCFD2',
  snacks: '#E9D6BF',
};

/** Dark heroes: one step richer than the tile, so the notched `surface` sheet still reads as a plane. */
export const darkHeroTints: Readonly<Record<HeroTint, string>> = {
  coffee: '#382A1D',
  tea: '#2A311F',
  cold: '#232D39',
  breakfast: '#3A2D19',
  desserts: '#3B272C',
  snacks: '#37291D',
};

/** `boxShadow` strings per scheme (RN 0.86 new arch + web). Style-object forms: `theme.shadows`. */
export interface BoxShadowTokens {
  /** @deprecated R3 retired card shadows. */
  soft: string;
  /** Tab bar, floating cart bar, toasts, live pill. */
  float: string;
  /** Primary bar, white CTA on night. */
  cta: string;
  /** Flying clones and pills that need lift. */
  strong: string;
  /** PressableScale's pressed underlays. */
  pressCard: string;
  pressStrong: string;
}

export const lightBoxShadows: BoxShadowTokens = {
  soft: '0px 8px 24px rgba(59, 38, 24, 0.1)',
  float: '0px 10px 30px rgba(59, 38, 24, 0.12)',
  cta: '0px 12px 24px rgba(28, 23, 20, 0.22)',
  strong: '0px 12px 28px rgba(28, 23, 20, 0.26)',
  pressCard: '0px 14px 30px rgba(59, 38, 24, 0.16)',
  pressStrong: '0px 18px 36px rgba(28, 23, 20, 0.34)',
};

/** Dark: shadows are black pools (a brown shadow on espresso reads as a glow). */
export const darkBoxShadows: BoxShadowTokens = {
  soft: '0px 8px 24px rgba(0, 0, 0, 0.35)',
  float: '0px 10px 30px rgba(0, 0, 0, 0.5)',
  cta: '0px 12px 24px rgba(0, 0, 0, 0.45)',
  strong: '0px 12px 28px rgba(0, 0, 0, 0.55)',
  pressCard: '0px 14px 30px rgba(0, 0, 0, 0.45)',
  pressStrong: '0px 18px 36px rgba(0, 0, 0, 0.6)',
};

/** `ContactShadow` pool under cut-outs (R3.A3): colour and centre alpha per tone. */
export interface ContactShadowTokens {
  color: string;
  /** Tiles. */
  light: number;
  /** Hero planes. */
  hero: number;
  /** On `night` (a black pool in both schemes). */
  dark: number;
  /** Multiplier for numeric (custom) alphas. */
  scale: number;
}

export const lightContact: ContactShadowTokens = { color: ACCENTS.espresso, light: 0.26, hero: 0.3, dark: 0.55, scale: 1 };
/** Dark tiles: a deeper black pool (an espresso pool on a warm-dark tile disappears). */
export const darkContact: ContactShadowTokens = { color: FIXED.black, light: 0.5, hero: 0.55, dark: 0.55, scale: 1.9 };
