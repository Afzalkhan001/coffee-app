/**
 * Simulated payment gateway (DESIGN.md §R3.B "Payment", §7; UPI first for India): "Payment", then
 * the amount (52/56) with one caption and the chosen method, centred as one group in the space
 * above the bar; "Demo checkout · no real charge" sits right above the ink pay pill.
 *
 *  - UPI app: "Opening Google Pay…" (≈0.8s) → "Approve ₹536 in Google Pay" with a 5:00 countdown
 *    ring, the café's UPI ID and "Cancel" → approved after ≈2s → the bank confirms → paid.
 *  - UPI ID: "Sending a request to ava@okicici…" → the same approval ("Request sent to …").
 *    Once approved the panel reads "Approved in Google Pay" (sage ring) while the bank confirms.
 *  - Card: the pay pill morphs into a spinner, then a sage check.
 *  - Cash on delivery / pay at the counter: "Confirm order" (the order is confirmed unpaid).
 *
 * The order isn't paid until the approval lands (PRD §14). "Simulate a failed payment" runs the same
 * flow and declines it (the pill shakes into a retry; "Change payment method" goes back to
 * checkout's method list). Leaving is blocked while a charge is in flight and while the success
 * plays out. On success a `night` circle grows out of the pay button until it fills the screen, so
 * the dark confirmation appears on an identical frame instead of a hard cut.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, { scrollTo, useAnimatedRef, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { findPaymentMethod, isNetworkError, payFlow, payOrder, PaymentError, type PayFlow } from '@/api';
import { useOrder } from '@/api/hooks';
import {
  easeInOutCubic,
  layoutSpring,
  measureInWindowAsync,
  MorphPayButton,
  reducedMotionAtLaunch,
  RollingNumber,
  type MorphPayButtonState,
} from '@/components/motion';
import { EmptyState } from '@/components/domain';
import { LightStatusBar, PressableScale, Screen, ScreenHeader, Text } from '@/components/ui';
import { HeaderScrollEdge, useHeaderScroll } from '@/components/account/HeaderScrollEdge';
import { BAR_PAD_TOP, BottomBar, useBottomBarSpace } from '@/components/checkout/BottomBar';
import { useMounted } from '@/components/checkout/hooks';
import { fieldsIn, fieldsOut, riseIn } from '@/components/checkout/motion';
import { PaymentCardVisual, type CardBrand } from '@/components/checkout/PaymentCardVisual';
import { methodTitle, requestPaymentPicker } from '@/components/checkout/PaymentMethods';
import { UpiApproval, UpiMethodCard } from '@/components/checkout/UpiApproval';
import { PAYMENT_METHODS } from '@/data/mock/marketing';
import { attempt } from '@/lib/async';
import { formatMoney, pluralize } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { pickupCode, usesPickupCode } from '@/lib/pickupCode';
import { cartCount } from '@/lib/pricing';
import { useCart } from '@/store/cart';
import { brand } from '@/theme/brand';
import { fonts, makeStyles, radii, spacing, useColors } from '@/theme';
import type { Order, PaymentMethod } from '@/types/models';

type Failure = { kind: 'declined' | 'offline' | 'other' | 'cancelled'; message: string };
/** Where a UPI payment is: the app opening, waiting for the customer's approval, the bank confirming. */
type UpiPhase = 'idle' | 'opening' | 'approve' | 'confirming';

/** How long the sage check draws before the espresso reveal starts. */
const REVEAL_AFTER_MS = 520;
/** The reveal itself; the confirmation is pushed the moment it covers the screen. */
const REVEAL_MS = 420;
/** Reduce Motion: no reveal, just hold the check this long, then cut to the confirmation. */
const SUCCESS_HOLD_MS = 900;
/** Let the decline card finish entering before measuring whether it sits under the bar. */
const DECLINE_SETTLE_MS = 380;
/** Under the pay pill: the "Simulate a failed payment" link (44 + 4). */
const SIM_SLOT = 48;
/** Over the pay pill: the 18px demo caption plus its 14px gap. */
const CAPTION_SLOT = 32;
/** "Opening Google Pay…" before the approval request shows. */
const UPI_OPEN_MS = 800;
/** The simulated customer approves this long after the request shows (then the bank confirms). */
const UPI_APPROVE_MS = 2000;

type RevealGeometry = { left: number; top: number; size: number };

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
/** When the UPI request went out (read in the pay handler, never during render). */
const requestStamp = () => Date.now();

/** The order's exact method (older orders: the first method of their type; legacy wallets: the Visa). */
function orderMethod(order: Order): PaymentMethod {
  return findPaymentMethod(order.payment?.methodId) ?? PAYMENT_METHODS.find((m) => m.type === order.paymentMethod) ?? PAYMENT_METHODS.find((m) => m.type === 'card')!;
}

function cardBrand(method: PaymentMethod): CardBrand {
  if (!method.last4) return 'new';
  return method.brand === 'rupay' ? 'rupay' : 'visa';
}

/** The UPI app's name for "Approve in …" (null for a UPI ID request: "your UPI app"). */
function upiAppName(method: PaymentMethod): string | null {
  return method.upiApp ? method.label : null;
}

function declineCopy(flow: PayFlow, method: PaymentMethod): string {
  if (flow === 'upi_app') return `No money was taken. ${method.label} couldn’t complete the payment: try again, or pick another way to pay.`;
  if (flow === 'upi_id') return 'No money was taken. The UPI request was declined: try again, or pick another way to pay.';
  return 'No money was taken. Your bank declined the charge: try again, or pick another way to pay.';
}

function failureTitle(kind: Failure['kind']): string {
  switch (kind) {
    case 'declined':
      return 'Payment declined';
    case 'offline':
      return 'You’re offline';
    case 'cancelled':
      return 'Payment cancelled';
    default:
      return 'Payment didn’t go through';
  }
}

/** The UPI card's status while the app "opens" (the approval panel then carries the status). */
function openingLine(flow: PayFlow, method: PaymentMethod, vpa: string | undefined): string {
  return flow === 'upi_app' ? `Opening ${method.label}…` : `Sending a request to ${vpa ?? 'your UPI ID'}…`;
}

/** The status line under the spinning pay pill (cards and cash; UPI shows it in the stage). */
function progressLine(flow: PayFlow): string | null {
  if (flow === 'upi_app' || flow === 'upi_id') return null;
  return flow === 'card' ? 'Talking to your bank…' : 'Confirming your order…';
}

export default function PaymentScreen() {
  const c = useColors();
  const styles = useStyles();
  const params = useLocalSearchParams<{ orderId?: string }>();
  const orderId = typeof params.orderId === 'string' ? params.orderId : undefined;
  const order = useOrder(orderId);
  const clearCart = useCart((s) => s.clear);
  // The bar carries the demo caption above it and the "Simulate a failed payment" slot below.
  const barSpace = useBottomBarSpace() + SIM_SLOT + CAPTION_SLOT;
  const mounted = useMounted();
  const { width: winW, height: winH } = useWindowDimensions();

  const [state, setState] = useState<MorphPayButtonState>('idle');
  const [phase, setPhase] = useState<UpiPhase>('idle');
  const [requestedAt, setRequestedAt] = useState(0);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [reveal, setReveal] = useState<RevealGeometry | null>(null);
  const [leaving, setLeaving] = useState(false);
  /** Bumped by every pay attempt and by Cancel: a stale attempt stops at its next step. */
  const run = useRef(0);
  const payRef = useRef<View>(null);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const declineRef = useRef<View>(null);
  /** Top of everything the bar draws above the pay pill (the caption slot); its fade sits above it. */
  const barTopRef = useRef<View>(null);
  const { scrollY, onScroll } = useHeaderScroll();
  const grow = useSharedValue(0);
  // An order that's already confirmed (e.g. a stale deep link) goes straight to its confirmation.
  const [alreadyConfirmed] = useState(() => !!order && order.history.length > 0);

  // Block back gestures / hardware back while the charge is in flight AND while the success plays
  // out (Q-15): leaving mid-hold used to skip the confirmation. Released just before we navigate.
  usePreventRemove((state === 'loading' || state === 'success') && !leaving, () => haptic.warning());

  useEffect(() => {
    if (alreadyConfirmed && orderId)
      router.replace({
        pathname: '/order/confirmation/[id]',
        params: { id: orderId },
      });
  }, [alreadyConfirmed, orderId]);

  // A decline lands below the card: scroll it into view only when it would really sit under the bar,
  // and only by the overlap.
  const failed = failure !== null;
  useEffect(() => {
    if (!failed) return;
    let cancelled = false;
    const t = setTimeout(() => {
      void Promise.all([measureInWindowAsync(declineRef), measureInWindowAsync(barTopRef)]).then(([card, bar]) => {
        if (cancelled || !card || !bar) return;
        // Clear the bar's whole top (fade + solid band above the caption slot), not just the pill.
        const overlap = card.y + card.height + spacing.xs - (bar.y - BAR_PAD_TOP);
        if (overlap <= 0) return;
        const y = scrollY.get() + overlap;
        scheduleOnUI(() => {
          scrollTo(scrollRef, 0, y, true);
        });
      });
    }, DECLINE_SETTLE_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [failed]);

  // Success: let the check draw, then grow the espresso circle out of the pay button.
  useEffect(() => {
    if (state !== 'success') return;
    if (reducedMotionAtLaunch) {
      const t = setTimeout(() => setLeaving(true), SUCCESS_HOLD_MS);
      return () => clearTimeout(t);
    }
    let cancelled = false;
    const t = setTimeout(() => {
      void measureInWindowAsync(payRef).then((rect) => {
        if (cancelled) return;
        // Centre on the button (or the bottom centre if it couldn't be measured); radius reaches the
        // farthest corner so the circle covers everything.
        const cx = rect ? rect.x + rect.width / 2 : winW / 2;
        const cy = rect ? rect.y + rect.height / 2 : winH - 80;
        const r = Math.ceil(Math.hypot(Math.max(cx, winW - cx), Math.max(cy, winH - cy))) + 4;
        setReveal({ left: cx - r, top: cy - r, size: r * 2 });
      });
    }, REVEAL_AFTER_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [state, winW, winH]);

  // The circle is mounted (scale 0): run it, then hand over on an identical espresso frame. The
  // timer is only a safety net (an interrupted animation reports finished=false): never strand
  // the customer on a plain espresso screen.
  useEffect(() => {
    if (!reveal) return;
    grow.set(
      withTiming(1, { duration: REVEAL_MS, easing: easeInOutCubic }, (finished) => {
        if (finished) scheduleOnRN(setLeaving, true);
      }),
    );
    const safety = setTimeout(() => setLeaving(true), REVEAL_MS + 250);
    return () => clearTimeout(safety);
  }, [reveal, grow]);

  // Navigate only after the re-render that released usePreventRemove.
  useEffect(() => {
    if (!leaving || !orderId) return;
    router.dismissAll();
    router.push({
      pathname: '/order/confirmation/[id]',
      params: { id: orderId },
    });
  }, [leaving, orderId]);

  const revealStyle = useAnimatedStyle(() => ({
    transform: [{ scale: Math.max(grow.get(), 0.001) }],
  }));

  if (!order) {
    return (
      <Screen>
        <ScreenHeader title="Payment" />
        <View style={styles.missing}>
          <EmptyState
            art="plate"
            title="We couldn’t find this order"
            message="It may have expired. Place it again from your cart."
            action={{ label: 'Back to cart', onPress: () => router.replace('/cart') }}
          />
        </View>
      </Screen>
    );
  }

  const total = order.totals.total;
  const method = orderMethod(order);
  const flow = payFlow(method);
  const upi = flow === 'upi_app' || flow === 'upi_id';
  const later = flow === 'cod' || flow === 'counter';
  const busy = state === 'loading' || state === 'success';
  const itemCount = cartCount(order.items);
  const vpa = order.payment?.vpa;

  const fail = (kind: Failure['kind'], message: string) => {
    setPhase('idle');
    setFailure({ kind, message });
    // A decline shakes into the retry (MorphPayButton fires `error`); a cancel just settles back.
    setState(kind === 'cancelled' ? 'idle' : 'error');
  };

  const pay = async (simulateFailure = false) => {
    if (busy) return;
    run.current += 1;
    const id = run.current;
    setFailure(null);
    setState('loading');
    if (upi) {
      setPhase('opening');
      await wait(UPI_OPEN_MS);
      if (run.current !== id) return;
      setRequestedAt(requestStamp());
      setPhase('approve');
      await wait(UPI_APPROVE_MS);
      if (run.current !== id) return;
      setPhase('confirming');
    }
    const res = await attempt(payOrder(order.id, { simulateFailure }));
    if (run.current !== id) return;
    if (res.ok) {
      // Paid: the cart must go now, not after the celebration, so nothing can re-order it (Q-15).
      clearCart();
      setState('success'); // MorphPayButton fires `success` as its check pops in
      return;
    }
    const e = res.error;
    if (e instanceof PaymentError) fail('declined', declineCopy(flow, method));
    else if (isNetworkError(e)) fail('offline', 'No money was taken. We couldn’t reach the payment gateway: check your connection and retry.');
    else fail('other', e instanceof Error ? e.message : 'Something went wrong. Please try again.');
  };

  /** UPI: the customer backs out of the request before approving it. */
  const cancelUpi = () => {
    run.current += 1;
    fail('cancelled', 'No money was taken. Pay again, or pick another way to pay.');
  };

  const changeMethod = () => {
    requestPaymentPicker();
    router.back();
  };

  const label = later
    ? state === 'error'
      ? 'Try again'
      : 'Confirm order'
    : state === 'error'
      ? `Retry · ${formatMoney(total)}`
      : `Pay ${formatMoney(total)}`;

  const approving = upi && (phase === 'approve' || phase === 'confirming');
  const progress = state === 'loading' ? progressLine(flow) : null;

  return (
    <Screen>
      <ScreenHeader title={later ? 'Confirm' : 'Payment'} showBack={!busy} />
      <View style={styles.flex}>
        <Animated.ScrollView
          ref={scrollRef}
          onScroll={onScroll}
          contentContainerStyle={[styles.content, { paddingBottom: barSpace }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.stage}>
            <Animated.View
              entering={riseIn(40)}
              layout={layoutSpring}
              style={styles.amount}
              accessible
              accessibilityLabel={`${later ? 'To pay later' : 'Amount due'} ${formatMoney(total)}`}
            >
              <RollingNumber
                value={total}
                money
                fontSize={52}
                lineHeight={56}
                fontFamily={fonts.bold}
                color={c.ink}
                animateOnMount
                stagger={28}
              />
              <Text variant="caption" color={c.inkSoft} align="center" style={styles.amountSub}>
                {[`Order ${order.number}`, pluralize(itemCount, 'item'), `incl. ${formatMoney(order.totals.tax)} ${brand.taxLabel}`].join(' · ')}
              </Text>
            </Animated.View>

            <Animated.View entering={riseIn(140)} layout={layoutSpring}>
              {approving ? (
                <Animated.View key="approve" entering={fieldsIn} exiting={fieldsOut}>
                  <UpiApproval
                    appName={upiAppName(method)}
                    vpa={flow === 'upi_id' ? vpa : undefined}
                    amount={total}
                    startedAt={requestedAt}
                    confirming={phase === 'confirming'}
                    paid={state === 'success'}
                    onCancel={cancelUpi}
                  />
                </Animated.View>
              ) : (
                <Animated.View key="method" entering={mounted ? fieldsIn : undefined} exiting={fieldsOut}>
                  {flow === 'cod' ? (
                    <PayLaterCard title="Pay on delivery" body="We start on it when you confirm. Pay the rider in cash or by UPI." />
                  ) : flow === 'counter' ? (
                    <PayLaterCard
                      title={order.details.mode === 'in_car' ? 'Pay at your car' : 'Pay when you collect'}
                      body={
                        order.details.mode === 'in_car'
                          ? 'We start on it when you confirm. Pay by UPI, card or cash when we bring it out.'
                          : `We start on it when you confirm. Pay by UPI, card or cash at ${brand.store.shortName}.`
                      }
                      code={usesPickupCode(order.details.mode) ? pickupCode(order.number) : undefined}
                    />
                  ) : upi ? (
                    <UpiMethodCard method={method} vpa={vpa} status={phase === 'opening' ? openingLine(flow, method, vpa) : undefined} />
                  ) : (
                    <PaymentCardVisual brand={cardBrand(method)} holder={order.customer.name} last4={method.last4} declined={state === 'error'} />
                  )}
                </Animated.View>
              )}
            </Animated.View>

            {failure ? (
              <Animated.View
                ref={declineRef}
                entering={fieldsIn}
                exiting={fieldsOut}
                style={styles.decline}
                accessibilityLiveRegion="assertive"
              >
                <Text style={styles.declineTitle} color={failure.kind === 'cancelled' ? c.ink : c.danger} align="center">
                  {failureTitle(failure.kind)}
                </Text>
                <Text variant="caption" color={c.inkSoft} align="center" style={styles.declineBody}>
                  {failure.message}
                </Text>
                {/* Retry is the morphing pay pill below ("Retry · ₹x"); this offers the other way out. */}
                <PressableScale
                  onPress={later ? () => router.back() : changeMethod}
                  activeScale={0.96}
                  hitSlop={10}
                  accessibilityLabel={later ? 'Back to checkout' : 'Change payment method'}
                  style={styles.declineAction}
                >
                  <Text style={styles.declineLink}>{later ? 'Back to checkout' : 'Change payment method'}</Text>
                </PressableScale>
              </Animated.View>
            ) : null}
          </View>
        </Animated.ScrollView>
        <HeaderScrollEdge scrollY={scrollY} />
      </View>

      <BottomBar>
        {/* Fixed slot: the caption fades out while paying or after a decline, and the bar never moves. */}
        <View ref={barTopRef} collapsable={false} style={styles.captionSlot}>
          {failure || busy ? null : (
            <Animated.View key="meta" entering={mounted ? fieldsIn : riseIn(220)} exiting={fieldsOut}>
              <Text
                variant="caption"
                color={c.inkMuted}
                align="center"
                accessibilityLabel={!later ? `Paying with ${methodTitle(method, vpa)}. Demo checkout, no real charge` : undefined}
              >
                {later ? 'Nothing is charged in the app' : 'Demo checkout · no real charge'}
              </Text>
            </Animated.View>
          )}
        </View>
        <View ref={payRef} collapsable={false}>
          <MorphPayButton
            state={state}
            label={label}
            onPress={() => void pay()}
            icon={later ? 'checkmark' : 'lock-closed'}
            errorTone="ink"
          />
        </View>
        <View style={styles.simSlot}>
          {!later && !busy ? (
            <Animated.View key="sim" entering={fieldsIn} exiting={fieldsOut}>
              <PressableScale
                onPress={() => void pay(true)}
                activeScale={0.96}
                accessibilityLabel="Simulate a failed payment"
                hitSlop={8}
                style={styles.simButton}
              >
                <Text style={styles.simText} color={c.inkMuted}>
                  Simulate a failed payment
                </Text>
              </PressableScale>
            </Animated.View>
          ) : progress ? (
            <Animated.View key={progress} entering={fieldsIn} exiting={fieldsOut}>
              <Text variant="caption" color={c.inkMuted} align="center">
                {progress}
              </Text>
            </Animated.View>
          ) : null}
        </View>
      </BottomBar>

      {/* White status-bar icons once the espresso circle starts covering the screen. */}
      <LightStatusBar active={reveal !== null} />
      {reveal ? (
        <Animated.View
          style={[
            styles.reveal,
            {
              left: reveal.left,
              top: reveal.top,
              width: reveal.size,
              height: reveal.size,
              borderRadius: reveal.size / 2,
            },
            revealStyle,
          ]}
        />
      ) : null}
    </Screen>
  );
}

/** Cash on delivery / pay at the counter: what happens next, and the pickup code when there is one. */
function PayLaterCard({ title, body, code }: { title: string; body: string; code?: string }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={styles.counter}>
      <Text style={styles.counterTitle} align="center">
        {title}
      </Text>
      <Text variant="body" color={c.inkSoft} align="center" style={styles.counterBody}>
        {body}
      </Text>
      {code ? (
        <View style={styles.codePill}>
          <Text variant="caption" color={c.inkSoft}>
            Your code
          </Text>
          <Text style={styles.code}>{code}</Text>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1, minWidth: 0 },
  missing: { flex: 1, justifyContent: 'center', paddingBottom: spacing.xxxl },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.lg,
  },
  // The amount, its caption and the method sit as one group in the middle of the free space (a
  // touch high: optical centre), instead of hanging under the title over a 250pt void.
  stage: { flex: 1, justifyContent: 'center', gap: spacing.xl, paddingBottom: 40 },
  amount: { alignItems: 'center' },
  amountSub: { marginTop: spacing.xs },
  decline: { alignItems: 'center', paddingHorizontal: spacing.md, marginTop: -spacing.xs },
  declineTitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  declineBody: { marginTop: 4, maxWidth: 300 },
  declineAction: { marginTop: spacing.sm, minHeight: 32, justifyContent: 'center' },
  declineLink: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18, textDecorationLine: 'underline' },
  reveal: {
    position: 'absolute',
    backgroundColor: c.night,
    pointerEvents: 'none',
  },
  captionSlot: { height: 18, marginBottom: 14, justifyContent: 'center' },
  simSlot: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  simButton: { paddingHorizontal: spacing.sm, height: 40, justifyContent: 'center' },
  simText: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 18, textDecorationLine: 'underline' },
  counter: { alignItems: 'center', paddingVertical: spacing.md },
  counterTitle: {
    fontFamily: fonts.bold,
    fontSize: 22,
    lineHeight: 28,
  },
  counterBody: { marginTop: spacing.xs, maxWidth: 290 },
  codePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: c.surface,
  },
  code: {
    fontFamily: fonts.extrabold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: 2,
  },
}));
