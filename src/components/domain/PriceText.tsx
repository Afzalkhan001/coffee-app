import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { fonts, useColors } from '@/theme';

export interface PriceTextProps {
  price: number;
  /** Original price; shown struck through when higher than `price` (sale → price in ember). */
  compareAt?: number;
  /** Font size of the main price. Default 16. */
  size?: number;
  /** Main price colour when not on sale. Default ink. */
  color?: string;
  /** Live price colour on sale: 'ember' (default) or 'ink' (when the screen's ember element is elsewhere). */
  saleTone?: 'ember' | 'ink';
  style?: StyleProp<ViewStyle>;
}

/** "₹310" or, on sale, "₹310 ~~₹340~~": the live price in ember, the old one in `inkMuted` (R3). */
export function PriceText({ price, compareAt, size = 16, color: colorProp, saleTone = 'ember', style }: PriceTextProps) {
  const c = useColors();
  const color = colorProp ?? c.ink;
  const onSale = compareAt != null && compareAt > price;
  const label = onSale ? `${formatMoney(price)}, was ${formatMoney(compareAt)}` : formatMoney(price);
  return (
    <View style={[styles.row, style]} accessible accessibilityLabel={label}>
      <Text
        style={{ fontFamily: fonts.bold, fontSize: size, lineHeight: Math.round(size * 1.3) }}
        color={onSale ? (saleTone === 'ink' ? c.ink : c.ember) : color}
      >
        {formatMoney(price)}
      </Text>
      {onSale ? (
        <Text
          style={[styles.strike, { fontSize: Math.round(size * 0.8), lineHeight: Math.round(size * 1.3) }]}
          color={c.inkMuted}
        >
          {formatMoney(compareAt)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  strike: { fontFamily: fonts.regular, textDecorationLine: 'line-through' },
});
