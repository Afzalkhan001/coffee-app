import { router } from 'expo-router';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { enterUp } from '@/components/motion';
import { PillButton, PressableScale, Text } from '@/components/ui';
import { formatMoney, relativeDay } from '@/lib/format';
import { isActiveStatus, MODE_META } from '@/lib/orderFlow';
import { fonts, makeStyles, spacing, useColors } from '@/theme';
import type { Order } from '@/types/models';
import { staggerIndex } from './hooks';
import { orderTitle, orderTitleParts } from './orderText';
import { ArtThumb } from './productArt';

const THUMB = 56;
const PAD_X = spacing.md;
/** Where the row text starts: hairlines between rows are inset to here (R3.A10). */
export const ORDER_ROW_TEXT_INSET = PAD_X + THUMB + spacing.sm;

export interface OrderHistoryRowProps {
  order: Order;
  /** Default: push /order/[id]. */
  onPress?: () => void;
  onReorder: () => void;
  index?: number;
  /** Draw the inset hairline above this row (every row but the first in a group's sheet). */
  divider?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * R3 past-order row for a white group sheet (76h): 56 thumbnail tile with the first item's cut-out,
 * "Caramel Macchiato + 1 more" (16/600, one line), "Pickup · ER-3310", and on the right the total
 * over a 32px "Reorder" outline pill. Only "Cancelled" is labelled (13/500 danger, in place of the
 * caption); completed orders need no label.
 */
export function OrderHistoryRow({ order, onPress, onReorder, index = 0, divider = false, style }: OrderHistoryRowProps) {
  const open = onPress ?? (() => router.push({ pathname: '/order/[id]', params: { id: order.id } }));
  const cancelled = order.status === 'cancelled';
  const canReorder = !isActiveStatus(order.status);
  const title = orderTitleParts(order);
  const when = relativeDay(order.createdAt);
  const c = useColors();
  const styles = useStyles();

  return (
    <Animated.View entering={enterUp(staggerIndex(index))} style={style}>
      {divider ? <View style={styles.divider} /> : null}
      <PressableScale
        onPress={open}
        activeScale={0.98}
        style={styles.row}
        accessibilityLabel={`${orderTitle(order)}, ${when}, ${cancelled ? 'cancelled' : MODE_META[order.details.mode].short}, ${formatMoney(order.totals.total)}`}
        accessibilityHint="Opens the order details"
      >
        <ArtThumb image={order.items[0]?.image} size={THUMB} />
        <View style={styles.body}>
          {/* The name truncates; "+ 1 more" never does. */}
          <View style={styles.titleRow}>
            <Text style={[styles.title, styles.titleHead]} numberOfLines={1}>
              {title.head}
            </Text>
            {title.more ? (
              <Text style={[styles.title, styles.titleMore]} numberOfLines={1}>
                {title.more}
              </Text>
            ) : null}
          </View>
          {cancelled ? (
            <Text style={styles.cancelled} color={c.danger} numberOfLines={1}>
              Cancelled
            </Text>
          ) : (
            <Text variant="caption" color={c.inkSoft} numberOfLines={1}>
              {`${MODE_META[order.details.mode].short} · ${order.number}`}
            </Text>
          )}
        </View>
        <View style={styles.side}>
          <Text style={styles.total}>{formatMoney(order.totals.total)}</Text>
          {canReorder ? (
            <PillButton
              label="Reorder"
              tone="outline"
              size="xs"
              hapticKind="press"
              onPress={onReorder}
              accessibilityLabel={`Reorder ${orderTitle(order)}`}
            />
          ) : null}
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 76,
    paddingHorizontal: PAD_X,
    paddingVertical: 10,
  },
  divider: { height: StyleSheet.hairlineWidth * 2, backgroundColor: c.line, marginLeft: ORDER_ROW_TEXT_INSET, marginRight: PAD_X },
  body: { flex: 1, minWidth: 0, gap: 2 },
  // gap, not a leading space: web collapses whitespace at the start of the second text.
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xxs, minWidth: 0 },
  title: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: c.ink },
  titleHead: { flexShrink: 1 },
  titleMore: { flexShrink: 0 },
  cancelled: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  side: { alignItems: 'flex-end', gap: 6 },
  total: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: c.ink },
}));
