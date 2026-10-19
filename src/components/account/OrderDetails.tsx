/**
 * Tracking screen detail sections (DESIGN.md §R3.B "Tracking"): an `h2` over one white sheet each
 * (r28, no shadow), rows with hairlines inset to their text, 56px cut-out thumbnail tiles. No icon
 * discs; status words are plain text.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { findPaymentMethod, getRewardSync } from '@/api';
import { MethodMark } from '@/components/checkout/PaymentMethods';
import { ArtThumb, etaLabel, scheduledReadyLabel, useNow } from '@/components/domain';
import { enterUp } from '@/components/motion';
import { Icon, Text } from '@/components/ui';
import { formatDateTime, formatMoney, formatTime, pluralize } from '@/lib/format';
import { summarizeModifiers } from '@/lib/modifiers';
import { isActiveStatus, MODE_META } from '@/lib/orderFlow';
import { formatTotalsLine, totalsBreakdown } from '@/lib/pricing';
import { fonts, makeStyles, radii, useColors } from '@/theme';
import { brand } from '@/theme/brand';
import type { Order, OrderItem } from '@/types/models';
import { paymentMethodIcon, paymentMethodLabel, paymentStatusMeta } from './format';

const THUMB = 56;
const PAD = 16;
/** Item rows: hairlines start where the text does. */
const ITEM_TEXT_INSET = PAD + THUMB + 12;

interface CardProps {
  order: Order;
  index?: number;
  style?: StyleProp<ViewStyle>;
}

/** `h2` (with an optional quiet value on the right) over a white sheet, staggered in. */
function Section({ title, right, index = 0, style, children }: { title: string; right?: string; index?: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <Animated.View entering={enterUp(index)} style={style}>
      <View style={styles.sectionHead}>
        <Text variant="h2" accessibilityRole="header">
          {title}
        </Text>
        {right ? (
          <Text style={styles.sectionRight} color={c.inkSoft}>
            {right}
          </Text>
        ) : null}
      </View>
      <View style={styles.sheet}>{children}</View>
    </Animated.View>
  );
}

function Hairline({ inset = PAD }: { inset?: number }) {
  const styles = useStyles();
  return <View style={[styles.hairline, { marginLeft: inset }]} />;
}

/**
 * When it'll be ready, from the same live timeline as the tracking ring (never the raw, possibly
 * fractional `etaMinutes`): "ASAP · ready in ~5 min" while live, "Scheduled · ready at 4:35 PM"
 * for an honoured slot, and "ASAP · placed 3:22 AM" once finished.
 */
function pickupWhen(order: Order, now: number): string {
  const scheduled = scheduledReadyLabel(order);
  if (scheduled) return `Scheduled · ready at ${scheduled}`;
  if (!isActiveStatus(order.status)) return `ASAP · placed ${formatTime(order.createdAt)}`;
  const eta = etaLabel(order, now);
  return `ASAP · ${eta.charAt(0).toLowerCase()}${eta.slice(1)}`;
}

/** Two-line detail row: title 16/500 ink over a 13 `inkSoft` caption. */
function DetailRow({ title, caption }: { title: string; caption?: string }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailTitle} numberOfLines={2}>
        {title}
      </Text>
      {caption ? (
        <Text style={styles.caption} color={c.inkSoft}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

/** How and where the order is fulfilled (mode, time, table, car or delivery address). */
export function ModeDetailsCard({ order, index, style }: CardProps) {
  const now = useNow(30_000, `${order.id}:${order.status}`);
  const { details } = order;
  const meta = MODE_META[details.mode];
  const rows: { key: string; title: string; caption?: string }[] = [];

  switch (details.mode) {
    case 'pickup':
      rows.push({ key: 'when', title: `${meta.label} · ${pickupWhen(order, now)}`, caption: 'At the pickup bar' });
      break;
    case 'dine_in':
      rows.push({ key: 'when', title: details.table ? `Dine-in · ${details.table}` : 'Dine-in · table service', caption: 'We bring it to your table' });
      break;
    case 'in_car':
      rows.push({ key: 'when', title: `${meta.label} · ${pickupWhen(order, now)}` });
      rows.push({
        key: 'car',
        title: details.car ? `${details.car.color} ${details.car.make}`.trim() : 'Your car',
        caption: details.car?.plate ? `${details.car.plate.toUpperCase()} · park in a marked bay` : 'Park in a marked bay',
      });
      break;
    case 'delivery':
      rows.push({
        key: 'address',
        title: details.address ? `${details.address.label} · ${details.address.line1}` : 'Delivery address',
        caption: details.address
          ? [details.address.line2, details.address.city, details.address.notes].filter(Boolean).join(' · ')
          : undefined,
      });
      break;
  }

  if (details.mode !== 'delivery') {
    rows.push({ key: 'store', title: brand.store.name, caption: brand.store.address });
  }

  return (
    <Section title="Details" index={index} style={style}>
      {rows.map((row, i) => (
        <View key={row.key}>
          {i > 0 ? <Hairline /> : null}
          <DetailRow title={row.title} caption={row.caption} />
        </View>
      ))}
    </Section>
  );
}

function ItemLine({ item, muted }: { item: OrderItem; muted: boolean }) {
  const c = useColors();
  const styles = useStyles();
  const mods = summarizeModifiers(item.modifiers);
  return (
    <View style={[styles.item, muted ? styles.muted : null]}>
      <ArtThumb image={item.image} size={THUMB} />
      <View style={styles.flex}>
        <Text style={styles.itemName} numberOfLines={2}>
          {item.quantity > 1 ? (
            <Text style={styles.itemQty} color={c.inkSoft}>{`${item.quantity}× `}</Text>
          ) : null}
          {item.name}
        </Text>
        {mods ? (
          <Text style={styles.caption} color={c.inkSoft} numberOfLines={2}>
            {mods}
          </Text>
        ) : null}
        {item.instructions ? (
          <Text style={styles.caption} color={c.roastText} numberOfLines={2}>
            {`“${item.instructions}”`}
          </Text>
        ) : null}
      </View>
      <Text style={styles.linePrice}>{formatMoney(item.lineTotal)}</Text>
    </View>
  );
}

/** Every line with its cut-out, modifiers, note and line total. */
export function ItemsCard({ order, index, style }: CardProps) {
  const count = order.items.reduce((n, i) => n + i.quantity, 0);
  const muted = order.status === 'cancelled';
  return (
    <Section title="Your order" right={pluralize(count, 'item')} index={index} style={style}>
      {order.items.map((item, i) => (
        <View key={item.id}>
          {i > 0 ? <Hairline inset={ITEM_TEXT_INSET} /> : null}
          <ItemLine item={item} muted={muted} />
        </View>
      ))}
    </Section>
  );
}

function Row({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: string }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={styles.receiptRow}>
      <Text style={[styles.flex, strong ? styles.totalLabel : styles.rowLabel]} color={strong ? c.ink : c.inkSoft} numberOfLines={1}>
        {label}
      </Text>
      <Text style={strong ? styles.totalValue : styles.rowValue} color={accent ?? c.ink}>
        {value}
      </Text>
    </View>
  );
}

/** Totals, then the payment method with its status as plain text and the placed time. */
export function ReceiptCard({ order, index, style }: CardProps) {
  const c = useColors();
  const styles = useStyles();
  const { totals } = order;
  const reward = getRewardSync(order.rewardId);
  const discountLabel = [order.couponCode ? `Code ${order.couponCode}` : null, reward ? reward.name : null]
    .filter(Boolean)
    .join(' + ');
  const status = paymentStatusMeta(order);
  const method = findPaymentMethod(order.payment?.methodId);
  const statusColor = status.tone === 'danger' ? c.danger : c.inkSoft;

  return (
    <Section title="Receipt" right={order.number} index={index} style={style}>
      <View style={styles.totals}>
        {/* The shared breakdown (packaging and the delivery tip included), so the rows add up to the total. */}
        {totalsBreakdown(totals, order.details.mode).map((line) =>
          line.key === 'discount' ? (
            <Row
              key={line.key}
              label={discountLabel ? `Discount · ${discountLabel}` : line.label}
              value={formatTotalsLine(line)}
              accent={c.sageText}
            />
          ) : (
            <Row key={line.key} label={line.label} value={formatTotalsLine(line)} />
          ),
        )}
        <View style={styles.totalRule} />
        <Row label="Total" value={formatMoney(totals.total)} strong />
      </View>

      <Hairline />
      <View style={styles.payment}>
        {/* The same method mark checkout showed (UPI app monogram, card network, cash); older orders
            without a payment snapshot keep a plain glyph. */}
        {method ? <MethodMark method={method} /> : <Icon name={paymentMethodIcon(order.paymentMethod)} size={20} color={c.ink} />}
        <View style={styles.flex}>
          <Text style={styles.detailTitle} numberOfLines={1}>
            {paymentMethodLabel(order)}
          </Text>
          <Text style={styles.caption} color={c.inkSoft}>
            {`Placed ${formatDateTime(order.createdAt)}`}
          </Text>
        </View>
        <Text style={styles.payStatus} color={statusColor}>
          {status.label}
        </Text>
      </View>
    </Section>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1, minWidth: 0 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionRight: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 18 },
  sheet: { backgroundColor: c.surface, borderRadius: radii.lg, overflow: 'hidden' },
  hairline: { height: StyleSheet.hairlineWidth * 2, backgroundColor: c.line, marginRight: PAD },
  detailRow: { minHeight: 68, justifyContent: 'center', paddingHorizontal: PAD, paddingVertical: 12, gap: 2 },
  detailTitle: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 22, color: c.ink },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, marginTop: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: PAD, paddingVertical: 12 },
  muted: { opacity: 0.55 },
  itemName: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: c.ink },
  itemQty: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  linePrice: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: c.ink },
  totals: { paddingHorizontal: PAD, paddingVertical: 12 },
  receiptRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 5 },
  rowLabel: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  rowValue: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 },
  totalRule: { height: StyleSheet.hairlineWidth * 2, backgroundColor: c.line, marginVertical: 8 },
  totalLabel: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  totalValue: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28 },
  payment: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: PAD, minHeight: 68, paddingVertical: 12 },
  payStatus: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
}));
