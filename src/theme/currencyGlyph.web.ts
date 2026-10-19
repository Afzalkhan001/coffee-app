/**
 * Web: draw the currency symbol (₹) at the weight of the Outfit text around it.
 *
 * Outfit has no "₹" (U+20B9). Without help the browser falls back per character to a system face at
 * the CSS weight, which is always 400 here (each Outfit weight is its own family and we never set
 * `fontWeight`), so a bold "₹290" showed a thin "₹" beside bold digits. Each Outfit family gets an
 * extra `@font-face` limited to the symbol's code point (`unicode-range`) that points at an installed
 * system font of the matching weight (Segoe UI on Windows, Roboto on Android/ChromeOS, Helvetica
 * Neue / Kohinoor on Apple). The browser composites it with the Outfit face, so only the symbol
 * changes and the React tree stays the same. If no listed font is installed the rule is ignored and
 * the old fallback applies. Native platforms: see `currencyGlyph.ts`.
 */
import { brand } from './brand';
import { fonts } from './index';

/**
 * Installed faces per Outfit weight, first match wins. Outfit is heavier than the system faces at the
 * same nominal weight, so 600 borrows the bold faces (Segoe UI Semibold looked thin beside it).
 */
const LOCAL_FACES: Record<number, string[]> = {
  300: ['Segoe UI Light', 'SegoeUI-Light', 'Roboto Light', 'Roboto-Light', 'Helvetica Neue Light', 'HelveticaNeue-Light', 'Kohinoor Devanagari Light', 'KohinoorDevanagari-Light'],
  400: ['Segoe UI', 'SegoeUI', 'Roboto', 'Roboto-Regular', 'Helvetica Neue', 'HelveticaNeue', 'Kohinoor Devanagari Regular', 'KohinoorDevanagari-Regular', 'Arial', 'ArialMT'],
  500: ['Segoe UI Semibold', 'SegoeUI-Semibold', 'Roboto Medium', 'Roboto-Medium', 'Helvetica Neue Medium', 'HelveticaNeue-Medium', 'Kohinoor Devanagari Medium', 'KohinoorDevanagari-Medium'],
  600: ['Segoe UI Bold', 'SegoeUI-Bold', 'Roboto Bold', 'Roboto-Bold', 'Helvetica Neue Bold', 'HelveticaNeue-Bold', 'Kohinoor Devanagari Semibold', 'KohinoorDevanagari-Semibold'],
  700: ['Segoe UI Bold', 'SegoeUI-Bold', 'Roboto Bold', 'Roboto-Bold', 'Helvetica Neue Bold', 'HelveticaNeue-Bold', 'Kohinoor Devanagari Bold', 'KohinoorDevanagari-Bold', 'Arial Bold', 'Arial-BoldMT'],
  800: ['Segoe UI Black', 'SegoeUI-Black', 'Roboto Black', 'Roboto-Black', 'Segoe UI Bold', 'SegoeUI-Bold', 'Helvetica Neue Bold', 'HelveticaNeue-Bold', 'Kohinoor Devanagari Bold', 'KohinoorDevanagari-Bold'],
};

const FAMILY_WEIGHT: [string, number][] = [
  [fonts.light, 300],
  [fonts.regular, 400],
  [fonts.medium, 500],
  [fonts.semibold, 600],
  [fonts.bold, 700],
  [fonts.extrabold, 800],
];

const STYLE_ID = 'ember-currency-glyph';

/** The `@font-face` rules (exported for tests). */
export function currencyGlyphCss(symbol: string = brand.currency.symbol): string {
  const cp = symbol.codePointAt(0);
  if (cp == null) return '';
  const range = `U+${cp.toString(16).toUpperCase()}`;
  return FAMILY_WEIGHT.map(([family, weight]) => {
    const src = (LOCAL_FACES[weight] ?? LOCAL_FACES[400]!).map((name) => `local("${name}")`).join(', ');
    return `@font-face { font-family: "${family}"; src: ${src}; unicode-range: ${range}; }`;
  }).join('\n');
}

/** Adds the rules once (idempotent; a no-op without a DOM). */
export function installCurrencyGlyph(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = currencyGlyphCss();
  document.head.appendChild(style);
}
