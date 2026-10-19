import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ArtStack, minutesLeft, orderImages, scheduledReadyLabel, useNow } from '@/components/domain';
import { AnimatedCheck, easeOutQuint, enterUp, popIn, PulseRing, RollingNumber, withAlpha } from '@/components/motion';
import { Icon, Text } from '@/components/ui';
import { MODE_META, statusDescription, statusLabel } from '@/lib/orderFlow';
import { fonts, makeStyles, radii, spacing, useColors } from '@/theme';
import type { Order } from '@/types/models';
import { countdown, needsPickupCode, pickupCode, refundCopy, ringProgress } from './format';
import { OrderRing } from './OrderRing';
import { SteamWisps } from './SteamWisps';

const swapIn = FadeIn.duration(260).easing(easeOutQuint);


/** Demo staff names (prototype copy). */
const BARISTA = 'Maya';
const COURIER = 'Sam';

export interface OrderHeroProps {
  order: Order;
  style?: StyleProp<ViewStyle>;
}

/**
 * Top of the tracking screen (DESIGN.md §R3.B "Tracking"): the live espresso card while active
 * (ring, countdown, steam, barista line, pickup-code ticket), a calm summary on the canvas once
 * finished.
 */
export function OrderHero({ order, style }: OrderHeroProps) {
  if (order.status === 'completed') return <CompletedHero order={order} style={style} />;
  if (order.status === 'cancelled') return <CancelledHero order={order} style={style} />;
  return <LiveHero order={order} style={style} />;
}

// ── Live ─────────────────────────────────────────────────────

function LiveHero({ order, style }: OrderHeroProps) {
  const c = useColors();
  const styles = useStyles();
  const mode = order.details.mode;
  const status = order.status;
  const arrived = mode === 'in_car' && status === 'ready' && !!order.arrived;

  return (
    <Animated.View entering={enterUp(0)} style={[styles.live, style]}>
      <View style={styles.eyebrowRow}>
        <View style={styles.liveDot}>
          <PulseRing size={10} color={c.sage} />
          <View style={styles.liveCore} />
        </View>
        <Text style={styles.meta} color={withAlpha(c.white, 0.6)} numberOfLines={1}>
          {`Live · ${MODE_META[mode].short}`}
        </Text>
      </View>

      <View style={styles.ringWrap}>
        <LiveRing order={order} />
      </View>

      <Animated.View key={arrived ? 'arrived' : status} entering={swapIn} style={styles.statusBlock}>
        <Text style={styles.statusLabel} color={c.white} align="center" accessibilityRole="header">
          {statusLabel(status, mode)}
        </Text>
        <Text style={styles.statusDesc} color={withAlpha(c.white, 0.65)} align="center">
          {statusDescription(status, mode, arrived)}
        </Text>
      </Animated.View>

      <StaffLine order={order} />

      {needsPickupCode(order) ? <CodeStub order={order} /> : null}
    </Animated.View>
  );
}

/** The countdown ring: ticks once a second (only this subtree re-renders). */
function LiveRing({ order }: { order: Order }) {
  const now = useNow(1000);
  return (
    <OrderRing progress={ringProgress(order, now)}>
      <RingCenter order={order} now={now} />
    </OrderRing>
  );
}

/**
 * Ring centre: steam + mm:ss while it's being made, a check once ready, a bike on the road, and
 * the promised time ("Ready at 4:35 PM") for a scheduled order that isn't being made yet.
 */
function RingCenter({ order, now }: { order: Order; now: number }) {
  const c = useColors();
  const styles = useStyles();
  const status = order.status;
  const scheduled = scheduledReadyLabel(order);

  if (scheduled && (status === 'placed' || status === 'accepted')) {
    return (
      <Animated.View key="scheduled" entering={swapIn} style={styles.center} accessible accessibilityLabel={`Ready at ${scheduled}`}>
        <Text style={styles.centerCaption} color={c.peachSoft}>
          Ready at
        </Text>
        <Text style={styles.clockTime} color={c.white} numberOfLines={1}>
          {scheduled}
        </Text>
        <Text style={styles.centerCaption} color={c.peachSoft}>
          scheduled
        </Text>
      </Animated.View>
    );
  }

  if (status === 'ready') {
    return (
      <Animated.View key="ready" entering={swapIn} style={styles.center}>
        <AnimatedCheck size={58} color={c.peach} play ring={false} strokeWidth={4} />
        <Text style={styles.centerCaption} color={c.peachSoft}>
          {order.details.mode === 'pickup' ? 'At the bar' : 'Ready'}
        </Text>
      </Animated.View>
    );
  }

  if (status === 'out_for_delivery') {
    return (
      <Animated.View key="road" entering={swapIn} style={styles.center}>
        <Icon name="bicycle" size={34} color={c.peach} />
        <Text style={styles.clock} color={c.white}>{`~${minutesLeft(order, now)} min`}</Text>
        <Text style={styles.centerCaption} color={c.peachSoft}>
          away
        </Text>
      </Animated.View>
    );
  }

  const cd = countdown(order, now);
  return (
    <Animated.View key="clock" entering={swapIn} style={styles.center}>
      {status === 'preparing' ? <SteamWisps height={26} style={styles.steam} /> : null}
      <Text
        style={[styles.clock, cd.overdue ? styles.clockSoft : null]}
        color={c.white}
        accessibilityLabel={cd.overdue ? 'Any moment now' : `${cd.minutes} minutes left`}
      >
        {cd.overdue ? 'Any moment' : cd.text}
      </Text>
      <Text style={styles.centerCaption} color={c.peachSoft}>
        {cd.overdue ? 'almost there' : order.details.mode === 'delivery' ? 'until it arrives' : 'until it’s ready'}
      </Text>
    </Animated.View>
  );
}

/** "Maya is on your order" while preparing; the courier while out for delivery; car hand-off. One line, no container. */
function StaffLine({ order }: { order: Order }) {
  const c = useColors();
  const styles = useStyles();
  const now = useNow(30_000, order.status);
  let line: { initial?: string; icon?: string; title: string } | null = null;

  if (order.status === 'preparing') {
    line = { initial: BARISTA[0], title: `${BARISTA} is on your order` };
  } else if (order.status === 'out_for_delivery') {
    line = { icon: 'bicycle', title: `${COURIER} is on the way · ${minutesLeft(order, now)} min` };
  } else if (order.status === 'ready' && order.details.mode === 'in_car' && order.arrived) {
    line = { icon: 'profile', title: 'A barista is heading out' };
  }

  if (!line) return null;
  return (
    <Animated.View key={line.title} entering={swapIn} style={styles.staff}>
      <View style={styles.staffDisc}>
        {line.initial ? (
          <Text style={styles.staffInitial} color={c.espresso}>
            {line.initial}
          </Text>
        ) : (
          <Icon name={line.icon ?? 'profile'} size={16} color={c.espresso} />
        )}
      </View>
      <Text style={styles.staffTitle} color={c.white} numberOfLines={1}>
        {line.title}
      </Text>
    </Animated.View>
  );
}

/** Perforated stub with the big counter code (pickup / in-car / dine-in). */
function CodeStub({ order }: { order: Order }) {
  const c = useColors();
  const styles = useStyles();
  const code = pickupCode(order);
  const mode = order.details.mode;
  const hint =
    mode === 'dine_in'
      ? order.details.table
        ? `We’ll bring it to ${order.details.table}`
        : 'We’ll call this number'
      : mode === 'in_car'
        ? 'Show this when we reach your car'
        : 'Show this at the pickup bar';
  return (
    <View style={styles.stub}>
      <View style={styles.perforation}>
        <View style={[styles.notch, styles.notchLeft]} />
        <View style={styles.dashes} />
        <View style={[styles.notch, styles.notchRight]} />
      </View>
      <View style={styles.codeRow} accessible accessibilityLabel={`Pickup code ${code.split('').join(' ')}. ${hint}`}>
        <View style={styles.codeCopy}>
          <Text style={styles.codeLabel} color={withAlpha(c.white, 0.6)}>
            {mode === 'dine_in' ? 'Your number' : 'Pickup code'}
          </Text>
          <Text variant="caption" color={withAlpha(c.white, 0.72)} style={styles.codeHint}>
            {hint}
          </Text>
        </View>
        <Text style={styles.code} color={c.white}>
          {code}
        </Text>
      </View>
    </View>
  );
}

// ── Finished ─────────────────────────────────────────────────

/** Finished: the order's own cut-outs (2 × 88) on the canvas, "Completed" and one quiet caption. */
function CompletedHero({ order, style }: OrderHeroProps) {
  const c = useColors();
  const styles = useStyles();
  const mode = order.details.mode;
  const images = orderImages(order);
  return (
    <Animated.View entering={enterUp(0)} style={[styles.done, style]}>
      {images.length > 0 ? (
        <Animated.View entering={popIn(1)}>
          <ArtStack images={images} size={88} max={2} overlap={30} shadow="light" />
        </Animated.View>
      ) : (
        <AnimatedCheck size={64} play filled delay={160} />
      )}
      <Text style={styles.doneTitle} align="center" accessibilityRole="header">
        {statusLabel('completed', mode)}
      </Text>
      <View style={styles.doneCaption} accessible accessibilityLabel={`${statusDescription('completed', mode)} ${order.pointsEarned} points earned`}>
        <Text style={styles.doneCaptionText} color={c.inkSoft}>
          {order.pointsEarned > 0 ? `${statusDescription('completed', mode).replace(/\.$/, '')} · ` : statusDescription('completed', mode)}
        </Text>
        {order.pointsEarned > 0 ? (
          <>
            <RollingNumber
              value={order.pointsEarned}
              prefix="+"
              decimals={0}
              fontSize={13}
              lineHeight={18}
              fontFamily={fonts.semibold}
              color={c.inkSoft}
              animateOnMount
            />
            <Text style={styles.doneCaptionText} color={c.inkSoft}>
              {' pts'}
            </Text>
          </>
        ) : null}
      </View>
    </Animated.View>
  );
}

function CancelledHero({ order, style }: OrderHeroProps) {
  const c = useColors();
  const styles = useStyles();
  const refunded = order.paymentStatus === 'refunded';
  return (
    <Animated.View entering={enterUp(0)} style={[styles.done, style]}>
      <Icon name="close-circle-outline" size={30} color={c.danger} />
      <Text style={styles.cancelTitle} align="center" accessibilityRole="header">
        Order cancelled
      </Text>
      <Text style={styles.doneDesc} color={c.inkSoft} align="center">
        {refunded ? refundCopy(order, 'done') : 'No payment was taken for this order.'}
      </Text>
    </Animated.View>
  );
}

const STAFF_DISC = 32;

const useStyles = makeStyles((c) => ({
  live: {
    backgroundColor: c.espresso,
    borderRadius: radii.sheet,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    overflow: 'hidden',
  },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  liveDot: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  liveCore: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: c.sage },
  meta: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  ringWrap: { alignItems: 'center', marginTop: spacing.lg },
  center: { alignItems: 'center', justifyContent: 'center' },
  steam: { marginBottom: 2 },
  clock: { fontFamily: fonts.bold, fontSize: 34, lineHeight: 40, fontVariant: ['tabular-nums'] },
  clockSoft: { fontSize: 22, lineHeight: 28 },
  clockTime: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34, fontVariant: ['tabular-nums'] },
  centerCaption: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 16, marginTop: 2 },
  statusBlock: { marginTop: spacing.lg, alignItems: 'center' },
  statusLabel: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 32 },
  statusDesc: { marginTop: 4, maxWidth: 300, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  staff: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: spacing.lg },
  staffDisc: {
    width: STAFF_DISC,
    height: STAFF_DISC,
    borderRadius: STAFF_DISC / 2,
    backgroundColor: c.peach,
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffInitial: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 19 },
  staffTitle: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
  stub: { marginTop: spacing.lg },
  perforation: { height: 20, justifyContent: 'center', marginHorizontal: -spacing.xl },
  dashes: {
    marginHorizontal: spacing.xl,
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: withAlpha(c.white, 0.22),
  },
  notch: { position: 'absolute', width: 20, height: 20, borderRadius: 10, backgroundColor: c.bg },
  notchLeft: { left: -10 },
  notchRight: { right: -10 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingTop: spacing.sm },
  codeCopy: { flex: 1, minWidth: 0 },
  codeLabel: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  codeHint: { marginTop: 2 },
  code: { fontFamily: fonts.extrabold, fontSize: 46, lineHeight: 50, letterSpacing: 3 },
  done: { alignItems: 'center', paddingTop: spacing.md, paddingBottom: spacing.xs, paddingHorizontal: spacing.lg },
  doneTitle: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 32, color: c.ink, marginTop: spacing.sm },
  doneCaption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  doneCaptionText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  doneDesc: { marginTop: 4, maxWidth: 300, fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  cancelTitle: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, color: c.ink, marginTop: spacing.sm },
}));
