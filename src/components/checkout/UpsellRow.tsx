import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';
import { getProductSync } from '@/api';
import { measureInWindowAsync } from '@/components/motion';
import { ArtThumb, openProduct, useQuickAdd } from '@/components/domain';
import { CircleButton, PressableScale, Text } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { fonts, useColors } from '@/theme';
import type { CartItem } from '@/types/models';
import { LINE_GAP, LINE_PAD, LINE_THUMB } from './CartLine';
import { fieldsIn, fieldsOut } from './motion';

const UPSELL_ID = 'croissant';

/** The pairing shows while the croissant is available and not already in the cart. */
export function upsellAvailable(items: Pick<CartItem, 'productId'>[]): boolean {
  const product = getProductSync(UPSELL_ID);
  return !!product && product.isAvailable && !items.some((i) => i.productId === UPSELL_ID);
}

/**
 * Exactly one pairing suggestion, last in the cart sheet after a 1.5px dashed divider (R3): the
 * croissant's tile, its name, "Often added · ₹180" and a 36px ink "+" that flies the cut-out into
 * the count badge. The row leaves once the croissant is in the cart.
 */
export function UpsellRow({ visible }: { visible: boolean }) {
  const c = useColors();
  const product = getProductSync(UPSELL_ID);
  const quickAdd = useQuickAdd();
  const artRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const [dashWidth, setDashWidth] = useState(0);

  if (!product || !product.isAvailable || !visible) return null;

  const add = async () => {
    if (busy) return;
    setBusy(true);
    const from = await measureInWindowAsync(artRef);
    const result = await quickAdd(product, from, Math.round(LINE_THUMB * 0.906)).catch(() => 'failed' as const);
    if (result === 'needs_options') openProduct(product.id);
    setBusy(false);
  };

  return (
    <Animated.View entering={fieldsIn} exiting={fieldsOut}>
      <View style={styles.dashes} onLayout={(e) => setDashWidth(Math.round(e.nativeEvent.layout.width))}>
        {dashWidth > 0 ? (
          <Svg width={dashWidth} height={2}>
            <Line x1={0} y1={1} x2={dashWidth} y2={1} stroke={c.line} strokeWidth={1.5} strokeDasharray="5 5" />
          </Svg>
        ) : null}
      </View>
      <PressableScale
        onPress={() => openProduct(product.id)}
        activeScale={0.985}
        accessibilityLabel={`Often added: ${product.name}, ${formatMoney(product.price)}`}
        style={styles.row}
      >
        <ArtThumb image={product.image} size={LINE_THUMB} artRef={artRef} />
        <View style={styles.copy}>
          <Text style={styles.name} numberOfLines={1}>
            {product.name}
          </Text>
          <Text variant="caption" color={c.inkSoft} numberOfLines={1}>
            {`Often added · ${formatMoney(product.price)}`}
          </Text>
        </View>
        <CircleButton
          icon="add"
          tone="ink"
          size={36}
          iconSize={18}
          onPress={() => void add()}
          // Quick-add: `press` on press-in, `land` when the cut-out reaches the badge.
          hapticKind="press"
          accessibilityLabel={`Add ${product.name} to cart`}
        />
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dashes: { marginHorizontal: LINE_PAD, height: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: LINE_GAP, minHeight: 88, paddingVertical: 12, paddingHorizontal: LINE_PAD },
  copy: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
});
