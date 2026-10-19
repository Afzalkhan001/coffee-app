import { useRef } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useMyOrders } from '@/api/hooks';
import { enterUp, measureInWindowAsync } from '@/components/motion';
import { PillButton, Text } from '@/components/ui';
import { formatMoney, pluralize } from '@/lib/format';
import { fonts, makeStyles, radii, spacing, useColors } from '@/theme';
import type { Order } from '@/types/models';
import { useFlash } from './hooks';
import { orderImages, orderItemNames } from './orderText';
import { ArtCluster, clusterImages, type ArtClusterPiece } from './productArt';
import { useReorder } from './quickAdd';

const TILE = 80;
/** Two overlapping cut-outs in the 80px tile (one item stands alone, a little bigger). */
const TILE_LAYOUTS: Record<1 | 2, ArtClusterPiece[]> = {
  1: [{ size: 68, x: 6, y: 6 }],
  2: [
    { size: 56, x: 2, y: 20, z: 2 },
    { size: 52, x: 26, y: 4, z: 1 },
  ],
};

/** Most recent completed order, or undefined. */
export function useLastCompletedOrder(): Order | undefined {
  const orders = useMyOrders();
  let latest: Order | undefined;
  for (const o of orders) {
    if (o.status !== 'completed') continue;
    if (!latest || o.createdAt > latest.createdAt) latest = o;
  }
  return latest;
}

export interface OrderAgainCardProps {
  /** The order to repeat. Defaults to the customer's most recent completed order. */
  order?: Order;
  index?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * R3 Home "Order again" row (the `h2` header is the screen's): one white row (r28, 96h) with a
 * coffee-tinted 80px tile holding two overlapping cut-outs, the items (15/600, 2 lines), a
 * "₹590 · 2 items" caption and an ink "Reorder" pill that re-adds every line (fly-to-cart +
 * toast). Renders nothing without order history.
 */
export function OrderAgainCard({ order: orderProp, index = 0, style }: OrderAgainCardProps) {
  const fallback = useLastCompletedOrder();
  const order = orderProp ?? fallback;
  const tileRef = useRef<View>(null);
  const reorder = useReorder();
  const [added, flashAdded] = useFlash(1800);
  const c = useColors();
  const styles = useStyles();

  if (!order || order.items.length === 0) return null;

  const images = clusterImages(orderImages(order), 2);
  const count = order.items.reduce((n, i) => n + i.quantity, 0);
  const price = formatMoney(order.totals.subtotal);
  const onReorder = async () => {
    flashAdded();
    const rect = await measureInWindowAsync(tileRef);
    await reorder(order.items, rect, 56);
  };

  return (
    <Animated.View entering={enterUp(index)} style={[styles.card, style]}>
      <View ref={tileRef} collapsable={false} style={styles.tile}>
        <ArtCluster images={images} layout={TILE_LAYOUTS[images.length >= 2 ? 2 : 1]} />
      </View>
      <View style={styles.body}>
        {/* 3 lines so both names survive a 375pt phone (2 lines at 390pt); the row still fits 96pt. */}
        <Text style={styles.summary} numberOfLines={3}>
          {orderItemNames(order.items)}
        </Text>
        <Text variant="caption" color={c.inkSoft} numberOfLines={1} style={styles.caption}>
          {`${price} · ${pluralize(count, 'item')}`}
        </Text>
      </View>
      <PillButton
        label={added ? 'Added' : 'Reorder'}
        tone={added ? 'sage' : 'ink'}
        size="sm"
        hapticKind="press"
        onPress={added ? undefined : onReorder}
        accessibilityLabel={`Reorder, ${price}`}
        style={styles.pill}
      />
    </Animated.View>
  );
}

const useStyles = makeStyles((c, t) => ({
  card: {
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: 8,
    paddingRight: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.lg,
    backgroundColor: c.surface,
  },
  tile: { width: TILE, height: TILE, borderRadius: radii.category, backgroundColor: t.tileTints.coffee },
  body: { flex: 1, minWidth: 0 },
  summary: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: c.ink },
  caption: { marginTop: 2 },
  // PillButton defaults to flex-start; centre it on the row like the tile and the copy.
  pill: { alignSelf: 'center' },
}));
