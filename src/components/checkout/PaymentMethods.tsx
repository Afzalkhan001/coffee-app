/**
 * Checkout's payment block (DESIGN.md §R3.B "Checkout", UPI first for India). ONE white sheet:
 * collapsed (the default) it's a single row — the chosen method's mark, its name, one caption
 * ("UPI · last used") and a chevron. Tapping it expands every method for the order type in place,
 * as 56px radio rows grouped UPI · Cards · cash; choosing one folds it again. With "Pay with UPI ID"
 * the UPI ID field sits right under the row (it has to be filled in either way).
 *
 * Marks are text on a tinted 36×24 plate (R3.A8 "payment brand marks"): monograms for the UPI apps,
 * never their logos.
 */
import { useEffect, useRef, type Ref } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { availablePaymentMethods, findPaymentMethod, isValidVpa, paymentMethodTitle, payFlow, UPI_ID_METHOD_ID } from '@/api';
import { easeOutQuint, withAlpha } from '@/components/motion';
import { Icon, MAX_FONT_SCALE, PressableScale, Text, WEB_NO_FOCUS_RING } from '@/components/ui';
import { fonts, makeStyles, makeThemed, radii, spacing, springs, useColors, useTheme } from '@/theme';
import type { OrderMode, PaymentMethod, UpiApp } from '@/types/models';
import { fieldsIn, fieldsOut } from './motion';
import { nestedLayout } from './LayoutBlock';

/**
 * Payment → "Change payment method" goes back to checkout, which opens its method list on focus.
 * (A flag, not a route param: `router.back()` can't carry one.)
 */
let pickerRequested = false;
export function requestPaymentPicker(): void {
  pickerRequested = true;
}
/** True once after `requestPaymentPicker()`. */
export function consumePaymentPickerRequest(): boolean {
  const requested = pickerRequested;
  pickerRequested = false;
  return requested;
}

/** Methods offered for an order type (UPI, cards, then cash on delivery or the counter). */
export function availableMethods(mode: OrderMode): PaymentMethod[] {
  return availablePaymentMethods(mode);
}

/** Row title: "Google Pay", "Visa •••• 4242", "ava@okicici" (UPI ID), "New card". */
export function methodTitle(m: PaymentMethod, vpa?: string): string {
  if (m.type === 'upi' && !m.upiApp) return m.label;
  if (m.type === 'card' && !m.last4) return m.label;
  return paymentMethodTitle(m, vpa);
}

/** One quiet caption per method. */
export function methodCaption(m: PaymentMethod): string {
  switch (payFlow(m)) {
    case 'upi_app':
      return 'UPI';
    case 'upi_id':
      return 'UPI · any app';
    case 'cod':
      return 'Cash or UPI at your door';
    case 'counter':
      return 'Pay when you collect';
    case 'card':
      if (!m.last4) return 'Demo · no card details needed';
      return m.brand === 'rupay' ? 'Debit card · expires 11/28' : 'Credit card · expires 08/29';
  }
}

// ── Marks ─────────────────────────────────────────────────────

/** Monogram + plate per UPI app, from the café's own tints (no brand colours, no logos). */
const useUpiMarks = makeThemed(
  (_c, t): Record<UpiApp, { text: string; bg: string }> => ({
    gpay: { text: 'G', bg: t.tileTints.cold },
    phonepe: { text: 'Pe', bg: t.tileTints.desserts },
    paytm: { text: 'Pt', bg: t.tileTints.tea },
    bhim: { text: 'B', bg: t.tileTints.breakfast },
  }),
);

export interface MethodMarkProps {
  method: PaymentMethod;
  /** `row` 36×24 r6 (lists); `hero` 64×44 r12 (the payment screen). */
  size?: 'row' | 'hero';
}

/** The method's mark: a monogram plate (UPI apps), "@" (UPI ID), the card network word, or a glyph. */
export function MethodMark({ method, size = 'row' }: MethodMarkProps) {
  const c = useColors();
  const styles = useStyles();
  const upiMarks = useUpiMarks();
  const hero = size === 'hero';
  const k = hero ? 1.8 : 1;
  const box = { width: 36 * k, height: 24 * k, borderRadius: hero ? 12 : 6 };
  const flow = payFlow(method);
  if (flow === 'upi_app' && method.upiApp) {
    const mark = upiMarks[method.upiApp];
    return (
      <View style={[styles.mark, box, { backgroundColor: mark.bg }]} accessible={false}>
        <Text style={[styles.monogram, { fontSize: 12 * k, lineHeight: 15 * k }]} color={c.ink}>
          {mark.text}
        </Text>
      </View>
    );
  }
  if (flow === 'upi_id') {
    return (
      <View style={[styles.mark, box, { backgroundColor: c.bg }]} accessible={false}>
        <Text style={[styles.monogram, { fontSize: 13 * k, lineHeight: 16 * k }]} color={c.ink}>
          @
        </Text>
      </View>
    );
  }
  if (flow === 'card' && method.last4) {
    const rupay = method.brand === 'rupay';
    return (
      <View style={[styles.mark, box, { backgroundColor: rupay ? c.roast : c.espresso }]} accessible={false}>
        <Text style={[styles.network, { fontSize: (rupay ? 8.5 : 9) * k, lineHeight: 11 * k }]} color={c.white}>
          {rupay ? 'RuPay' : 'VISA'}
        </Text>
      </View>
    );
  }
  const glyph = flow === 'cod' ? 'cash-outline' : flow === 'counter' ? 'storefront-outline' : 'add';
  return (
    <View style={[styles.mark, box, { backgroundColor: c.bg }]} accessible={false}>
      <Icon name={glyph} size={14 * k} color={flow === 'card' ? c.ink : c.roastText} />
    </View>
  );
}

// ── Picker ────────────────────────────────────────────────────

export interface PaymentPickerProps {
  mode: OrderMode;
  /** Selected `PAYMENT_METHODS` id (already resolved for the mode). */
  value: string;
  onChange: (methodId: string) => void;
  /** The method the account used last (captions it "last used"). */
  lastUsedId?: string;
  vpa: string;
  onVpaChange: (vpa: string) => void;
  /** Shown under the UPI ID field after a failed "Place order". */
  vpaError?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Fold the list a beat after a choice, so the radio visibly fills first. */
const COLLAPSE_AFTER_MS = 200;

export function PaymentPicker({ mode, value, onChange, lastUsedId, vpa, onVpaChange, vpaError, open, onOpenChange }: PaymentPickerProps) {
  const c = useColors();
  const styles = useStyles();
  const methods = availableMethods(mode);
  const selected = methods.find((m) => m.id === value) ?? findPaymentMethod(value) ?? methods[0]!;
  const vpaRef = useRef<TextInput>(null);
  const collapse = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (collapse.current) clearTimeout(collapse.current);
    },
    [],
  );

  const choose = (m: PaymentMethod) => {
    onChange(m.id);
    if (collapse.current) clearTimeout(collapse.current);
    collapse.current = setTimeout(() => {
      onOpenChange(false);
      // A UPI ID has to be typed: take the customer straight to the field.
      if (m.id === UPI_ID_METHOD_ID && !isValidVpa(vpa)) vpaRef.current?.focus();
    }, COLLAPSE_AFTER_MS);
  };

  const caption = selected.id === lastUsedId ? `${methodCaption(selected)} · last used` : methodCaption(selected);
  const groups: { title: string; items: PaymentMethod[] }[] = [
    { title: 'UPI', items: methods.filter((m) => m.type === 'upi') },
    { title: 'Cards', items: methods.filter((m) => m.type === 'card') },
    { title: mode === 'delivery' ? 'Pay on delivery' : 'Pay at the café', items: methods.filter((m) => m.type === 'cod' || m.type === 'pay_at_store') },
  ];

  return (
    <View style={styles.sheet}>
      <PressableScale
        onPress={() => onOpenChange(!open)}
        activeScale={0.985}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Pay with ${methodTitle(selected)}, ${caption}. ${open ? 'Hide' : 'Change'} payment method`}
        style={styles.head}
      >
        <MethodMark method={selected} />
        <View style={styles.copy}>
          <Text style={styles.title} numberOfLines={1}>
            {methodTitle(selected)}
          </Text>
          <Text variant="caption" color={c.inkSoft} numberOfLines={1}>
            {caption}
          </Text>
        </View>
        <Text style={styles.change} color={c.inkSoft}>
          {open ? 'Done' : 'Change'}
        </Text>
        <Chevron open={open} />
      </PressableScale>

      {selected.id === UPI_ID_METHOD_ID ? (
        <Animated.View entering={fieldsIn} exiting={fieldsOut} layout={nestedLayout} style={styles.vpaBlock}>
          <VpaField ref={vpaRef} value={vpa} onChange={onVpaChange} error={vpaError} />
        </Animated.View>
      ) : null}

      {open ? (
        <Animated.View entering={fieldsIn} exiting={fieldsOut} layout={nestedLayout} accessibilityRole="radiogroup" accessibilityLabel="Payment method">
          {groups
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <View key={g.title}>
                <Text style={styles.group} color={c.inkMuted} accessibilityRole="header">
                  {g.title}
                </Text>
                {g.items.map((m, i) => (
                  <MethodRow key={m.id} method={m} selected={m.id === selected.id} divider={i > 0} onPress={() => choose(m)} />
                ))}
              </View>
            ))}
        </Animated.View>
      ) : null}
    </View>
  );
}

function Chevron({ open }: { open: boolean }) {
  const c = useColors();
  const turn = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    turn.set(withSpring(open ? 1 : 0, springs.smooth));
  }, [open, turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get() * 180}deg` }] }));
  return (
    <Animated.View style={style}>
      <Icon name="chevron-down" size={18} color={c.inkMuted} />
    </Animated.View>
  );
}

function MethodRow({ method, selected, divider, onPress }: { method: PaymentMethod; selected: boolean; divider: boolean; onPress: () => void }) {
  const c = useColors();
  const styles = useStyles();
  const idle = c.line;
  const face = c.surface;
  const active = c.ink;
  const on = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    on.set(selected ? withSpring(1, springs.snappy) : withTiming(0, { duration: 160, easing: easeOutQuint }));
  }, [selected, on]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: on.get(), transform: [{ scale: 0.4 + 0.6 * on.get() }] }));
  const ringStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(on.get(), [0, 1], [idle, active]),
    backgroundColor: interpolateColor(on.get(), [0, 1], [face, active]),
  }));

  return (
    <PressableScale
      onPress={onPress}
      activeScale={0.985}
      hapticKind={selected ? null : 'select'}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${methodTitle(method)}. ${methodCaption(method)}`}
      style={styles.row}
    >
      {divider ? <View style={styles.divider} /> : null}
      <MethodMark method={method} />
      <Text style={[styles.title, styles.rowTitle]} numberOfLines={1}>
        {methodTitle(method)}
      </Text>
      <Animated.View style={[styles.radio, ringStyle]}>
        <Animated.View style={[styles.dot, dotStyle]} />
      </Animated.View>
    </PressableScale>
  );
}

// ── UPI ID field ──────────────────────────────────────────────

interface VpaFieldProps {
  value: string;
  onChange: (vpa: string) => void;
  error?: string;
  ref?: Ref<TextInput>;
}

/** "name@bank" on a canvas-filled 48px field (inputs inside white sheets use `bg`), one caption under it. */
function VpaField({ value, onChange, error, ref }: VpaFieldProps) {
  const { colors: c, keyboardAppearance } = useTheme();
  const styles = useStyles();
  const valid = isValidVpa(value);
  return (
    <View>
      <View style={[styles.vpaField, error ? styles.vpaFieldError : null]}>
        <TextInput
          ref={ref}
          value={value}
          onChangeText={(t) => onChange(t.replace(/\s+/g, ''))}
          placeholder="name@bank"
          placeholderTextColor={c.inkMuted}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          inputMode="email"
          keyboardType="email-address"
          enterKeyHint="done"
          selectionColor={c.ember}
          keyboardAppearance={keyboardAppearance}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          accessibilityLabel="UPI ID"
          style={[styles.vpaInput, WEB_NO_FOCUS_RING]}
        />
        {valid ? <Icon name="checkmark-circle" size={18} color={c.sageText} /> : null}
      </View>
      <Text variant="caption" color={error ? c.danger : c.inkMuted} style={styles.vpaCaption}>
        {error ?? 'We’ll send a payment request to this UPI ID.'}
      </Text>
    </View>
  );
}

const PAD = spacing.md;
const MARK_W = 36;

const useStyles = makeStyles((c) => ({
  sheet: { backgroundColor: c.surface, borderRadius: radii.lg, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: PAD, minHeight: 68 },
  copy: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  rowTitle: { flex: 1, minWidth: 0 },
  change: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 18 },
  group: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: PAD,
    paddingTop: spacing.md,
    paddingBottom: 2,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: c.line,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: PAD, minHeight: 56 },
  divider: {
    position: 'absolute',
    top: 0,
    left: PAD + MARK_W + spacing.sm,
    right: PAD,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: c.line,
  },
  mark: { alignItems: 'center', justifyContent: 'center' },
  monogram: { fontFamily: fonts.bold, letterSpacing: -0.2 },
  network: { fontFamily: fonts.extrabold, letterSpacing: 0.4, fontStyle: 'italic' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.onInk },
  vpaBlock: { paddingHorizontal: PAD, paddingBottom: spacing.md, marginTop: -4 },
  vpaField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 48,
    paddingHorizontal: spacing.md,
    borderRadius: 14,
    backgroundColor: c.bg,
    borderWidth: 1.5,
    borderColor: c.bg,
  },
  vpaFieldError: { borderColor: withAlpha(c.danger, 0.6) },
  vpaInput: { flex: 1, minWidth: 0, height: 48, fontFamily: fonts.medium, fontSize: 16, color: c.ink },
  vpaCaption: { marginTop: 6 },
}));
