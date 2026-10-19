import { router } from 'expo-router';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { ArtThumb, orderTitle, staggerIndex } from '@/components/domain';
import { enterUp } from '@/components/motion';
import { PillButton, PressableScale, Text } from '@/components/ui';
import { formatMoney, pluralize, relativeDay } from '@/lib/format';
import { isActiveStatus, MODE_META } from '@/lib/orderFlow';
import { fonts, makeStyles, useColors } from '@/theme';
import type { Order } from '@/types/models';

/** Thumbnail tile, side padding, and where the hairlines between rows start (R3.A10). */
export const PAST_ROW_THUMB = 56;
export const PAST_ROW_PAD = 16;
export const PAST_ROW_TEXT_INSET = PAST_ROW_PAD + PAST_ROW_THUMB + 12;

export interface PastOrderRowProps {
  order: Order;
  onReorder: () => void;
  /** Default: push /order/[id]. */
  onPress?: () => void;
  index?: number;
  /** Draw the inset hairline above this row (every row but the first in a day's sheet). */
  divider?: boolean;
  /**
   * The day, when rows share one sheet instead of sitting under day labels: the caption becomes
   * "Today · Pickup" (or "Sunday · Cancelled").
   */
  day?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Past order in a white sheet (DESIGN.md §R3.B "Orders"), 76h: the first item's cut-out on its tile,
 * the first item's name on one line (never cut to "Caramel M…" by a "+ 1 more" tail), a quiet
 * "2 items · Pickup" line ("Today · Pickup" when `day` is set), and on the right the total over a
 * 32px "Reorder" outline pill. Only a cancelled order is labelled (13/500 danger, in place of the
 * mode), and its reorder is a quiet text button rather than a full-weight pill.
 */
export function PastOrderRow({ order, onReorder, onPress, index = 0, divider = false, day, style }: PastOrderRowProps) {
  const c = useColors();
  const styles = useStyles();
  const open = onPress ?? (() => router.push({ pathname: '/order/[id]', params: { id: order.id } }));
  const cancelled = order.status === 'cancelled';
  const canReorder = !isActiveStatus(order.status);
  const first = order.items[0];
  const count = order.items.reduce((n, i) => n + i.quantity, 0);
  const head = first ? (first.quantity > 1 ? `${first.quantity}× ${first.name}` : first.name) : 'Your order';
  const mode = MODE_META[order.details.mode].short;

  return (
    <Animated.View entering={enterUp(staggerIndex(index))} style={style}>
      {divider ? <View style={styles.divider} /> : null}
      <PressableScale
        onPress={open}
        activeScale={0.98}
        style={styles.row}
        accessibilityLabel={`${orderTitle(order)}, ${relativeDay(order.createdAt)}, ${cancelled ? 'cancelled' : mode}, ${order.number}, ${formatMoney(order.totals.total)}`}
        accessibilityHint="Opens the order details"
      >
        <ArtThumb image={first?.image} size={PAST_ROW_THUMB} />
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {head}
          </Text>
          {cancelled ? (
            <Text style={styles.caption} color={c.inkSoft} numberOfLines={1}>
              {day ? `${day} · ` : ''}
              <Text style={styles.cancelled} color={c.danger}>
                Cancelled
              </Text>
            </Text>
          ) : (
            <Text style={styles.caption} color={c.inkSoft} numberOfLines={1}>
              {day ? `${day} · ${mode}` : `${pluralize(count, 'item')} · ${mode}`}
            </Text>
          )}
        </View>
        <View style={styles.side}>
          <Text style={styles.total}>{formatMoney(order.totals.total)}</Text>
          {canReorder && cancelled ? (
            <PressableScale
              onPress={onReorder}
              hapticKind="press"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.textAction}
              accessibilityLabel={`Reorder ${orderTitle(order)}`}
            >
              <Text style={styles.textActionLabel}>Reorder</Text>
            </PressableScale>
          ) : canReorder ? (
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
    gap: 12,
    minHeight: 76,
    paddingHorizontal: PAST_ROW_PAD,
    paddingVertical: 10,
  },
  divider: { height: StyleSheet.hairlineWidth * 2, backgroundColor: c.line, marginLeft: PAST_ROW_TEXT_INSET, marginRight: PAST_ROW_PAD },
  body: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: c.ink },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  cancelled: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  side: { alignItems: 'flex-end', gap: 6 },
  total: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: c.ink },
  // Same 32px slot as the pill, so totals line up down the sheet.
  textAction: { height: 32, justifyContent: 'center' },
  textActionLabel: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18, color: c.ink },
}));
