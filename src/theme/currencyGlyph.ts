/**
 * Native: nothing to install. Outfit has no "₹" (U+20B9); iOS (Core Text cascade) and Android
 * (Minikin fallback) draw it from the system font, picking the face closest to the Outfit file's
 * weight. The odometer totals (RollingNumber) set the system face and weight explicitly. The web
 * build needs help: see `currencyGlyph.web.ts`.
 */
export function currencyGlyphCss(): string {
  return '';
}

export function installCurrencyGlyph(): void {}
