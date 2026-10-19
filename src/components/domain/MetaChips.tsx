import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/ui';
import { fonts, useColors } from '@/theme';
import type { Product } from '@/types/models';

export interface MetaChipsProps {
  product: Pick<Product, 'prepMinutes' | 'kcal' | 'rating' | 'ratingCount'>;
  /** @deprecated R3 renders one text line in every case; ignored. */
  compact?: boolean;
  /** Add "· 245 kcal" (a live estimate when passed). Off by default: kcal lives in the detail badge. */
  kcal?: number;
  /** Lead with the rating ("★ 4.5 · 6 min"). Default true. */
  withRating?: boolean;
  /** @deprecated R3 has no chips; ignored. */
  chipColor?: string;
  /** Text colour (default `inkSoft`). */
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/** "★ 4.5 · 6 min" (plus " · 245 kcal" when asked) — the plain-text form of the ordering meta. */
export function metaLine(
  product: Pick<Product, 'prepMinutes' | 'rating'>,
  opts: { withRating?: boolean; kcal?: number } = {},
): string {
  const parts = [`${product.prepMinutes} min`];
  if (opts.kcal != null) parts.push(`${opts.kcal} kcal`);
  return (opts.withRating === false ? parts : [`★ ${product.rating.toFixed(1)}`, ...parts]).join(' · ');
}

/**
 * R3.B product meta (replaces the ref-3 chips): one 13/500 `inkSoft` line, "★ 4.5 · 6 min", with
 * the star as an inline roast text glyph (R3.A8; `roastText`, a lighter roast in dark). No pills, no clock or flame icons.
 */
export function MetaChips({ product, kcal, withRating = true, color: colorProp, style }: MetaChipsProps) {
  const c = useColors();
  const color = colorProp ?? c.inkSoft;
  const rating = product.rating.toFixed(1);
  const rest = [`${product.prepMinutes} min`, kcal != null ? `${kcal} kcal` : null].filter(Boolean).join(' · ');
  const label = `${withRating ? `Rated ${rating} from ${product.ratingCount} reviews, ` : ''}ready in about ${rest}`;
  return (
    <View style={[styles.row, style]} accessible accessibilityLabel={label}>
      <Text style={styles.text} color={color} numberOfLines={1}>
        {withRating ? (
          <>
            <Text style={styles.text} color={c.roastText}>
              {'★ '}
            </Text>
            {`${rating} · `}
          </>
        ) : null}
        {rest}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
});
