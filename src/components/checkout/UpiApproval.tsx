/**
 * The simulated UPI hand-off on the payment screen (DESIGN.md §R3.B "Payment", UPI round):
 *  - `UpiMethodCard`: the chosen UPI app (or UPI ID) as one white row — mark, name, "UPI · to
 *    emberroast@icici" — whose caption turns into "Opening Google Pay…" with a spinner while the
 *    app "opens".
 *  - `UpiApproval`: "Approve ₹536 in Google Pay" with a 5:00 countdown ring (a thin ink arc that
 *    runs down on the UI thread), the café's UPI ID and a "Cancel" text button. The screen approves
 *    it after a few seconds (or declines it on the "Simulate a failed payment" path).
 */
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { MERCHANT_VPA } from '@/api';
import { useNow } from '@/components/domain';
import { easeOutQuint } from '@/components/motion';
import { Icon, PressableScale, Text } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { fonts, makeStyles, radii, spacing, useColors } from '@/theme';
import type { PaymentMethod } from '@/types/models';
import { fieldsIn, fieldsOut } from './motion';
import { MethodMark, methodTitle } from './PaymentMethods';

/** A UPI collect request stays open for 5 minutes. */
export const UPI_REQUEST_SECONDS = 300;

/** "5:00", "4:07", "0:09". */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ── The chosen app / UPI ID ───────────────────────────────────

export interface UpiMethodCardProps {
  method: PaymentMethod;
  /** UPI ID payments show the customer's VPA as the title. */
  vpa?: string;
  /** "Opening Google Pay…" while the hand-off runs (replaces the caption, with a spinner). */
  status?: string;
  style?: StyleProp<ViewStyle>;
}

export function UpiMethodCard({ method, vpa, status, style }: UpiMethodCardProps) {
  const c = useColors();
  const styles = useStyles();
  const title = !method.upiApp && vpa ? vpa : methodTitle(method);
  return (
    <View style={[styles.card, style]} accessible accessibilityLabel={`Paying with ${title}. ${status ?? `UPI, to ${MERCHANT_VPA}`}`}>
      <MethodMark method={method} size="hero" />
      <View style={styles.cardCopy}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.captionSlot}>
          {status ? (
            <Animated.View key="status" entering={fieldsIn} exiting={fieldsOut} style={styles.statusRow}>
              <Text variant="caption" color={c.ink} numberOfLines={1} style={styles.flex}>
                {status}
              </Text>
            </Animated.View>
          ) : (
            <Animated.View key="to" entering={fieldsIn} exiting={fieldsOut}>
              <Text variant="caption" color={c.inkSoft} numberOfLines={1}>
                {`UPI · to ${MERCHANT_VPA}`}
              </Text>
            </Animated.View>
          )}
        </View>
      </View>
      {status ? <ActivityIndicator size="small" color={c.ink} /> : null}
    </View>
  );
}

// ── Approval ─────────────────────────────────────────────────

export interface UpiApprovalProps {
  /** "Google Pay", or null for a UPI ID collect request ("your UPI app"). */
  appName: string | null;
  /** UPI ID payments: where the request went ("Request sent to ava@okicici"). */
  vpa?: string;
  amount: number;
  /** When the request was raised (epoch ms): the countdown runs from here. */
  startedAt: number;
  /** The approval is in and the bank is confirming: no more cancelling. */
  confirming: boolean;
  /** The bank confirmed it (the pay pill is turning into the check). */
  paid?: boolean;
  onCancel: () => void;
  style?: StyleProp<ViewStyle>;
}

const RING = 132;
const STROKE = 5;

export function UpiApproval({ appName, vpa, amount, startedAt, confirming, paid = false, onCancel, style }: UpiApprovalProps) {
  const c = useColors();
  const styles = useStyles();
  const now = useNow(1000, String(startedAt));
  const left = UPI_REQUEST_SECONDS - (now - startedAt) / 1000;
  const where = appName ?? 'your UPI app';
  return (
    <View style={[styles.approval, style]}>
      <CountdownRing startedAt={startedAt} label={formatClock(Math.min(UPI_REQUEST_SECONDS, left))} approved={confirming} />
      {vpa ? (
        <Text variant="caption" color={c.inkSoft} align="center" style={styles.sent}>
          {`Request sent to ${vpa}`}
        </Text>
      ) : null}
      <Text style={[styles.approveTitle, vpa ? styles.approveTitleAfterSent : null]} align="center" accessibilityRole="header" accessibilityLiveRegion="polite">
        {confirming ? `Approved in ${where}` : `Approve ${formatMoney(amount)} in ${where}`}
      </Text>
      <Text variant="caption" color={c.inkSoft} align="center" style={styles.approveBody}>
        {paid
          ? `Paid ${formatMoney(amount)} to ${MERCHANT_VPA}`
          : confirming
            ? 'Confirming with your bank…'
            : `Open ${where} and approve the request from ${MERCHANT_VPA}.`}
      </Text>
      <View style={styles.cancelSlot}>
        {confirming ? null : (
          <Animated.View key="cancel" entering={fieldsIn} exiting={fieldsOut}>
            <PressableScale onPress={onCancel} activeScale={0.96} hitSlop={10} accessibilityLabel="Cancel UPI payment" style={styles.cancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </PressableScale>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

/**
 * The request's 5:00 window as a thin ink arc running down (linear, UI thread). Once approved, the
 * arc closes to a full sage ring and the clock gives way to a check.
 */
function CountdownRing({ startedAt, label, approved }: { startedAt: number; label: string; approved: boolean }) {
  const col = useColors();
  const styles = useStyles();
  const r = (RING - STROKE) / 2;
  const c = RING / 2;
  const circumference = 2 * Math.PI * r;
  const left = useSharedValue(1);
  useEffect(() => {
    if (approved) {
      left.set(withTiming(1, { duration: 360, easing: easeOutQuint }));
      return;
    }
    const elapsed = Math.max(0, Date.now() - startedAt);
    const total = UPI_REQUEST_SECONDS * 1000;
    left.set(1 - elapsed / total);
    // A clock, not decoration: it runs under Reduce Motion too.
    left.set(withTiming(0, { duration: Math.max(0, total - elapsed), easing: Easing.linear, reduceMotion: ReduceMotion.Never }));
  }, [startedAt, approved, left]);
  const arcProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - left.get()) }));
  return (
    <View style={styles.ring} accessible accessibilityLabel={approved ? 'Approved' : `${label} left to approve`}>
      <Svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`}>
        <Circle cx={c} cy={c} r={r} stroke={col.line} strokeWidth={STROKE} fill="none" />
        <AnimatedCircle
          cx={c}
          cy={c}
          r={r}
          // A graphic on the canvas, not a fill under white: the sage TEXT tone keeps it ≥ 3:1 in dark.
          stroke={approved ? col.sageText : col.ink}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={[circumference, circumference]}
          strokeDashoffset={0}
          transform={`rotate(-90 ${c} ${c})`}
          animatedProps={arcProps}
        />
      </Svg>
      <View style={styles.ringCenter}>
        {approved ? (
          <Animated.View key="ok" entering={fieldsIn}>
            <Icon name="checkmark" size={40} color={col.sageText} />
          </Animated.View>
        ) : (
          <View key="clock" style={styles.clockBlock}>
            <Text style={styles.clock}>{label}</Text>
            <Text style={styles.clockCaption} color={col.inkSoft}>
              left
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1, minWidth: 0 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 88,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: c.surface,
  },
  cardCopy: { flex: 1, minWidth: 0 },
  cardTitle: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 24 },
  captionSlot: { height: 20, justifyContent: 'center', marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  approval: { alignItems: 'center', paddingHorizontal: spacing.md },
  ring: { width: RING, height: RING },
  ringCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  clockBlock: { alignItems: 'center' },
  clock: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 34, letterSpacing: -0.4 },
  clockCaption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 15 },
  sent: { marginTop: spacing.lg },
  approveTitle: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, marginTop: spacing.lg, maxWidth: 320 },
  approveTitleAfterSent: { marginTop: 4 },
  approveBody: { marginTop: 6, maxWidth: 290 },
  cancelSlot: { height: 44, marginTop: spacing.md, justifyContent: 'center' },
  cancel: { minHeight: 40, paddingHorizontal: spacing.md, justifyContent: 'center' },
  cancelText: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, textDecorationLine: 'underline' },
}));
