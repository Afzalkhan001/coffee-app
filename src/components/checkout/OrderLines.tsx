import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { ArtThumb, ArtTile, tintForImage } from '@/components/domain';
import { Text } from '@/components/ui';
import { formatMoney, pluralize } from '@/lib/format';
import { cartCount, lineTotal } from '@/lib/pricing';
import { fonts, spacing, useColors } from '@/theme';
import type { CartItem } from '@/types/models';
import { lineModifiers } from './CartLine';
import { fieldsIn, fieldsOut } from './motion';
import { ValueRow } from './SheetRows';

export interface OrderLinesProps {
  items: CartItem[];
  subtotal: number;
  /** Controlled expansion (lets the screen re-flow the blocks below it in the same commit). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The items row's lead: the first item's cut-out on its tint. The title already says how many items
 * there are, so there's no "+N" label, and the sheet's hairline lines up with the title.
 */
function ItemsLead({ items }: { items: CartItem[] }) {
  const first = items[0]?.image;
  return <ArtTile image={first} tint={tintForImage(first)} width={LEAD} radius={14} artSize={LEAD - 4} />;
}

/** The items row's lead tile (the checkout sheet insets its hairline past it). */
export const ORDER_LINES_LEAD = 44;
const LEAD = ORDER_LINES_LEAD;

/**
 * Checkout's items row (R3): one 44px tile with the first cut-out, "4 items"
 * and the subtotal; it expands into the lines (64px tiles, the modifiers and any note, the price).
 */
export function OrderLines({ items, subtotal, open, onOpenChange }: OrderLinesProps) {
  const c = useColors();
  const count = cartCount(items);
  return (
    <View>
      <ValueRow
        title={pluralize(count, 'item')}
        value={formatMoney(subtotal)}
        left={<ItemsLead items={items} />}
        chevron="down"
        expanded={open}
        onPress={() => onOpenChange(!open)}
        accessibilityLabel={`${pluralize(count, 'item')}, ${formatMoney(subtotal)}. ${open ? 'Hide' : 'Show'} items`}
      />
      {open ? (
        <Animated.View entering={fieldsIn} exiting={fieldsOut} style={styles.list}>
          {items.map((item) => {
            const mods = lineModifiers(item);
            const sub = [mods, item.instructions ? `“${item.instructions}”` : ''].filter(Boolean).join(' · ');
            return (
              <View key={item.id} style={styles.line}>
                <ArtThumb image={item.image} size={64} recyclingKey={item.id} />
                <View style={styles.lineCopy}>
                  <Text style={styles.lineName} numberOfLines={1}>
                    {item.quantity > 1 ? `${item.quantity} × ${item.name}` : item.name}
                  </Text>
                  {sub ? (
                    <Text variant="caption" color={c.inkSoft} numberOfLines={2}>
                      {sub}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.linePrice}>{formatMoney(lineTotal(item))}</Text>
              </View>
            );
          })}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, paddingBottom: spacing.md },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  lineCopy: { flex: 1, minWidth: 0 },
  lineName: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
  linePrice: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
});
