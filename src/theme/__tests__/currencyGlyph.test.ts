import { currencyGlyphCss, installCurrencyGlyph } from '@/theme/currencyGlyph.web';
import { currencyGlyphCss as nativeCss } from '@/theme/currencyGlyph';
import { fonts } from '@/theme';

describe('currency glyph (web)', () => {
  it('adds a ₹-only face at the matching weight for every Outfit family', () => {
    const css = currencyGlyphCss();
    for (const family of [fonts.light, fonts.regular, fonts.medium, fonts.semibold, fonts.bold, fonts.extrabold]) {
      expect(css).toContain(`font-family: "${family}"`);
    }
    expect(css.match(/unicode-range: U\+20B9;/g)).toHaveLength(6);
    // Bold text gets a bold system ₹, not the regular fallback.
    const bold = css.split('\n').find((rule) => rule.includes(`"${fonts.bold}"`))!;
    expect(bold).toContain('local("Segoe UI Bold")');
    expect(bold).toContain('local("Roboto Bold")');
    // Fraunces already has ₹: never overridden.
    expect(css).not.toContain('Fraunces');
  });

  it('installs once and is a no-op on native', () => {
    expect(() => installCurrencyGlyph()).not.toThrow();
    expect(nativeCss()).toBe('');
  });
});
