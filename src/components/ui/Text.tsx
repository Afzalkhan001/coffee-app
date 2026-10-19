import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { type as typeScale, useColors } from '@/theme';

/**
 * Largest system font scale the layout follows (iOS Dynamic Type / Android font size). The design
 * has fixed-height pills, 64px action bars, 40px chips and odometer cells; past ~1.2× their copy
 * clips or wraps (never seen on web, which has no font scaling). Text still grows a little for
 * readers who ask for it. Nested <Text> inherits the cap; pass `maxFontSizeMultiplier` to override.
 */
export const MAX_FONT_SCALE = 1.2;

export type TextVariant = keyof typeof typeScale;

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  color?: string;
  align?: TextStyle['textAlign'];
}

/** Themed text. Every piece of copy in the app goes through this. Default colour: the scheme's `ink`. */
export function Text({ variant = 'body', color, align, style, maxFontSizeMultiplier, ...rest }: AppTextProps) {
  const c = useColors();
  return (
    <RNText
      {...rest}
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? MAX_FONT_SCALE}
      style={[typeScale[variant], { color: color ?? c.ink }, align ? { textAlign: align } : null, style]}
    />
  );
}

/** "**Caramel** Macchiato" — first word bold, rest light (DESIGN.md §3 splitTitle). */
export function SplitTitle({
  children,
  color: colorProp,
  size = 28,
  style,
  numberOfLines,
}: {
  children: string;
  color?: string;
  size?: number;
  style?: TextStyle;
  numberOfLines?: number;
}) {
  const c = useColors();
  const color = colorProp ?? c.ink;
  const [first, ...rest] = children.split(' ');
  const lineHeight = Math.round(size * 1.2);
  return (
    <RNText numberOfLines={numberOfLines} maxFontSizeMultiplier={MAX_FONT_SCALE} style={[{ color, fontSize: size, lineHeight }, style]}>
      <RNText style={[typeScale.titleBold, { fontSize: size, lineHeight, color }]}>{first}</RNText>
      {rest.length > 0 ? (
        <RNText style={[typeScale.titleLight, { fontSize: size, lineHeight, color }]}>{` ${rest.join(' ')}`}</RNText>
      ) : null}
    </RNText>
  );
}
