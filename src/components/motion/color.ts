import { lightBoxShadows } from '@/theme/palette';

/** Theme hex token + alpha → `rgba()` string, so translucent fills still derive from tokens. */
export function withAlpha(hex: string, alpha: number): string {
  'worklet';
  const raw = hex.charAt(0) === '#' ? hex.slice(1) : hex;
  const full =
    raw.length === 3 ? `${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}` : raw.slice(0, 6);
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * @deprecated Static LIGHT `boxShadow` strings, kept for screens not yet on the theme. Themed code
 * reads `useTheme().boxShadows` (same keys plus `pressCard` / `pressStrong`; black pools in dark).
 * R3.A3: planes separate by colour — no shadows on cards, rows, tiles or sheets; cut-outs use
 * `ContactShadow`.
 */
export const boxShadows = {
  /** @deprecated R3 retired card shadows. */
  soft: lightBoxShadows.soft,
  /** Tab bar, floating cart bar, toasts. */
  float: lightBoxShadows.float,
  /** Ink primary bar, white CTA on night. */
  cta: lightBoxShadows.cta,
  /** Floating photo clones and dark pills that need lift. */
  strong: lightBoxShadows.strong,
} as const;
