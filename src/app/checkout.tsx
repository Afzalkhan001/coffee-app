/**
 * Checkout (DESIGN.md §R3.B "Checkout"): "Checkout", then ONE white sheet of rows — how you get it
 * ("Pickup · ASAP · ~6 min", slot chips inline), who it's for, the items (a 2-up cut-out stack that
 * expands to the lines) and an inline promo field — then, for delivery, "Tip your delivery
 * partner" chips, the "Payment" sheet (the chosen method in one row — last used, else Google Pay —
 * that expands in place to every method; a UPI ID field when paying by UPI ID) and the peach
 * summary card with the 44px total. Every row can be fixed in place (slot, table, car, address,
 * contact, tip, UPI ID); a failed "Place order" shakes and scrolls to the first problem. Creates
 * the order (awaiting payment) and hands off to /payment.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { scrollTo, useAnimatedRef } from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';
import {
  cartLineIssue,
  createOrder,
  isNetworkError,
  lastPaymentChoice,
  quotedEtaMinutes,
  resolvePaymentMethod,
  UPI_ID_METHOD_ID,
  vpaIssue,
  type PlaceOrderInput,
} from '@/api';
import { enterFade, enterUp, RollingNumber, useShake } from '@/components/motion';
import { EmptyState, SummaryCard, useValueChange } from '@/components/domain';
import { Icon, KeyboardAvoider, PressableScale, PrimaryBar, Screen, ScreenHeader, SectionLabel, Text, TextField } from '@/components/ui';
import { HeaderScrollEdge, useHeaderScroll } from '@/components/account/HeaderScrollEdge';
import { BottomBar, useBottomBarSpace } from '@/components/checkout/BottomBar';
import { CarFields, EMPTY_CAR, SlotChips, TableChips } from '@/components/checkout/ContextFields';
import { CouponRow, RewardChip } from '@/components/checkout/CouponRow';
import { useCartTotals, useModeDetails, useMounted } from '@/components/checkout/hooks';
import { LayoutBlock } from '@/components/checkout/LayoutBlock';
import {
  carLabel,
  cartPrepMinutes,
  checkoutIssue,
  isCarComplete,
  pickupTimeLabel,
  type CheckoutSection as SectionId,
  type ContactDraft,
} from '@/components/checkout/modeText';
import { fieldsIn, fieldsOut } from '@/components/checkout/motion';
import { ORDER_LINES_LEAD, OrderLines } from '@/components/checkout/OrderLines';
import { consumePaymentPickerRequest, PaymentPicker } from '@/components/checkout/PaymentMethods';
import { SheetBlock, ValueRow } from '@/components/checkout/SheetRows';
import { tipAmount, tipIssue, type TipChoice } from '@/components/checkout/tip';
import { TipChips } from '@/components/checkout/TipChips';
import { displayPhone, formatMoney, formatPhone } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { MODE_META } from '@/lib/orderFlow';
import { useCart } from '@/store/cart';
import { useSession } from '@/store/session';
import { fonts, makeStyles, radii, spacing, useTheme } from '@/theme';
import type { CarDetails, OrderModeDetails } from '@/types/models';

function cleanCar(car: CarDetails): CarDetails | undefined {
  const next = { make: car.make.trim(), color: car.color.trim(), plate: car.plate.trim().toUpperCase() };
  return next.make || next.color || next.plate ? next : undefined;
}

function placeErrorMessage(e: unknown): string {
  if (isNetworkError(e)) return 'You’re offline. Your cart is saved, so try again once you’re connected.';
  return e instanceof Error ? e.message : 'Something went wrong placing your order. Please try again.';
}

export default function CheckoutScreen() {
  const { colors: c, keyboardAppearance } = useTheme();
  const styles = useStyles();
  const mode = useSession((s) => s.mode);
  const [tipChoice, setTipChoice] = useState<TipChoice>('none');
  const [otherTip, setOtherTip] = useState('');
  // The tip only exists for delivery (computeTotals ignores it elsewhere too).
  const tip = mode === 'delivery' ? tipAmount(tipChoice, otherTip) : 0;
  const { items, coupon, couponCode, couponCheck, reward, rewardAffordable, rewardValue, rewardWarning, totals, count } = useCartTotals(tip);
  const setReward = useCart((s) => s.setReward);
  const sessionDetails = useModeDetails();
  const profile = useSession((s) => s.profile);
  const phone = useSession((s) => s.phone);
  const savedCar = useSession((s) => s.car);
  const setPickupTime = useSession((s) => s.setPickupTime);
  const setTable = useSession((s) => s.setTable);
  const setCar = useSession((s) => s.setCar);
  const barSpace = useBottomBarSpace(true);
  const mounted = useMounted();

  const [carDraft, setCarDraft] = useState<CarDetails>(savedCar ?? EMPTY_CAR);
  const [editingCar, setEditingCar] = useState(!isCarComplete(savedCar));
  // The field shows the stored national number grouped ("98765 43210"); createOrder normalises it.
  const [contact, setContact] = useState<ContactDraft>({ name: profile?.name ?? '', phone: phone ? formatPhone(phone) : '' });
  const [editingContact, setEditingContact] = useState(false);
  // Default: the method this account paid with last (and its UPI ID), else Google Pay.
  const [lastPay] = useState(() => lastPaymentChoice(phone));
  const [methodId, setMethodId] = useState(lastPay.methodId);
  const [vpa, setVpa] = useState(lastPay.vpa ?? '');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [linesOpen, setLinesOpen] = useState(false);

  // The mode sheet can edit the car while checkout stays mounted underneath: follow it.
  useValueChange(savedCar, (next) => {
    setCarDraft(next ?? EMPTY_CAR);
    if (isCarComplete(next)) setEditingCar(false);
  });

  // Back from payment via "Change payment method": open the method list.
  useFocusEffect(
    useCallback(() => {
      if (consumePaymentPickerRequest()) setPickerOpen(true);
    }, []),
  );

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const { scrollY, onScroll } = useHeaderScroll();
  const sectionY = useRef<Record<SectionId, number>>({ details: 0, contact: 0, items: 0, savings: 0, tip: 0, payment: 0 });
  const detailsShake = useShake();
  const contactShake = useShake();
  const itemsShake = useShake();
  const savingsShake = useShake();
  const tipShake = useShake();
  const paymentShake = useShake();

  const details: OrderModeDetails = mode === 'in_car' ? { ...sessionDetails, car: cleanCar(carDraft) } : sessionDetails;
  const lineIssue = items.map(cartLineIssue).find((m) => m !== null) ?? null;
  const unaffordable = reward && !rewardAffordable ? reward.cost : null;
  // Cash on delivery only exists for delivery (and the counter only off it): fall back to Google Pay.
  const payMethod = resolvePaymentMethod(mode, methodId);
  const byUpiId = payMethod.id === UPI_ID_METHOD_ID;
  const issue = checkoutIssue(details, contact, {
    lineIssue,
    rewardPoints: unaffordable,
    tipIssue: mode === 'delivery' ? tipIssue(tipChoice, otherTip) : null,
    paymentIssue: byUpiId ? vpaIssue(vpa) : null,
  });
  // The same quote the order will carry (one timeline with the status simulator).
  const eta = quotedEtaMinutes(mode, cartPrepMinutes(items));
  const slotMode = mode === 'pickup' || mode === 'in_car';
  const scheduled = slotMode && details.pickupTime && details.pickupTime !== 'asap' ? pickupTimeLabel(details.pickupTime) : null;
  // Everything that can change a block's height (see LayoutBlock): the blocks below re-measure and
  // glide on web instead of snapping.
  const layoutKey = [
    mode,
    editingCar,
    isCarComplete(cleanCar(carDraft)),
    editingContact,
    attempted ? issue?.section : '',
    linesOpen,
    couponCode,
    couponCheck?.ok,
    reward?.id,
    rewardWarning,
    payMethod.id,
    pickerOpen,
    tipChoice,
    sessionDetails.address?.id,
    sessionDetails.table,
  ].join('|');
  const showError = (section: SectionId) => (attempted && issue?.section === section ? issue.message : undefined);

  const scrollToSection = (section: SectionId) => {
    const y = Math.max(0, sectionY.current[section] - spacing.sm);
    scheduleOnUI(() => {
      scrollTo(scrollRef, 0, y, true);
    });
  };

  const place = async () => {
    if (placing) return;
    setAttempted(true);
    setPlaceError(null);
    if (issue) {
      // The disabled PrimaryBar fires `warning` on this tap, together with this shake.
      const shakes = { details: detailsShake, contact: contactShake, items: itemsShake, savings: savingsShake, tip: tipShake, payment: paymentShake };
      shakes[issue.section].shake();
      if (issue.section === 'contact') setEditingContact(true);
      if (issue.section === 'items') setLinesOpen(true);
      if (issue.section === 'details' && mode === 'in_car') setEditingCar(true);
      scrollToSection(issue.section);
      return;
    }
    if (mode === 'in_car') setCar(cleanCar(carDraft));
    // Built outside the try: React Compiler can't lower conditionals inside try/catch.
    const input: PlaceOrderInput = {
      phone: phone ?? contact.phone,
      customer: { name: contact.name.trim(), phone: contact.phone.trim() },
      details,
      items,
      couponCode: couponCheck?.ok ? coupon?.code : undefined,
      rewardId: reward && rewardValue > 0 ? reward.id : undefined,
      paymentMethod: payMethod.type,
      paymentMethodId: payMethod.id,
      vpa: byUpiId ? vpa : undefined,
      tip,
    };
    setPlacing(true);
    try {
      const order = await createOrder(input);
      router.push({ pathname: '/payment', params: { orderId: order.id } });
    } catch (e) {
      haptic.error();
      setPlaceError(placeErrorMessage(e));
    }
    // (No `finally`: React Compiler can't lower try/finally and would skip this component.)
    setPlacing(false);
  };

  if (count === 0 && !placing) {
    return (
      <Screen>
        <ScreenHeader title="Checkout" />
        <View style={styles.empty}>
          <EmptyState art="plate" title="Nothing to check out yet" action={{ label: 'Browse menu', onPress: () => router.navigate('/menu') }} />
        </View>
      </Screen>
    );
  }

  const meta = MODE_META[mode];
  const modeValue =
    mode === 'dine_in' ? (sessionDetails.table ?? 'Choose a table') : mode === 'delivery' ? `~${eta} min` : (scheduled ?? `ASAP · ~${eta} min`);
  const car = cleanCar(carDraft);
  const recordY = (section: SectionId, e: LayoutChangeEvent) => {
    sectionY.current[section] = e.nativeEvent.layout.y;
  };

  return (
    <Screen>
      <ScreenHeader title="Checkout" />
      {/* Android edge-to-edge: shrink above the keyboard (car, contact and promo fields sit low). */}
      <KeyboardAvoider>
        <Animated.ScrollView
          ref={scrollRef}
          onScroll={onScroll}
          contentContainerStyle={[styles.content, { paddingBottom: barSpace + (placeError ? 64 : 0) }]}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          {/* ── How you get it ── */}
          <SheetBlock
            first
            layoutKey={layoutKey}
            entering={enterUp(mounted ? 0 : 1)}
            onLayout={(e) => recordY('details', e)}
            shakeStyle={detailsShake.style}
            error={mode === 'delivery' ? undefined : showError('details')}
          >
            <ValueRow
              title={meta.label}
              value={modeValue}
              valueColor={mode === 'dine_in' && !sessionDetails.table ? c.inkMuted : undefined}
              onPress={() => router.push('/mode')}
              accessibilityLabel={`${meta.label}, ${modeValue}. Change how you get your order`}
            />
            <Animated.View key={mode} entering={fieldsIn} exiting={fieldsOut}>
              {mode === 'pickup' ? (
                <SlotChips value={sessionDetails.pickupTime} onChange={setPickupTime} etaMinutes={eta} bleed={spacing.md} style={styles.inline} />
              ) : null}

              {mode === 'dine_in' ? <TableChips value={sessionDetails.table} onChange={setTable} bleed={spacing.md} style={styles.inline} /> : null}

              {mode === 'in_car' ? (
                <View style={styles.inline}>
                  {editingCar || !isCarComplete(car) ? (
                    <Animated.View key="car-edit" entering={fieldsIn} exiting={fieldsOut} style={styles.carEdit}>
                      <CarFields value={carDraft} onChange={setCarDraft} showErrors={attempted} />
                      {isCarComplete(car) ? (
                        <PressableScale
                          onPress={() => {
                            setCar(car);
                            setEditingCar(false);
                          }}
                          activeScale={0.96}
                          hitSlop={10}
                          accessibilityLabel="Save car"
                          style={styles.textButton}
                        >
                          <Text style={styles.textButtonLabel}>Save car</Text>
                        </PressableScale>
                      ) : null}
                    </Animated.View>
                  ) : (
                    <Animated.View key="car-view" entering={fieldsIn} exiting={fieldsOut}>
                      <PressableScale
                        onPress={() => setEditingCar(true)}
                        activeScale={0.985}
                        accessibilityLabel={`${carLabel(car) ?? 'Your car'}. Edit car details`}
                        style={styles.carRow}
                      >
                        <Text style={styles.carText} numberOfLines={1}>
                          {carLabel(car)}
                        </Text>
                        <Text style={styles.link}>Edit</Text>
                      </PressableScale>
                    </Animated.View>
                  )}
                  <SlotChips value={sessionDetails.pickupTime} onChange={setPickupTime} etaMinutes={eta} bleed={spacing.md} style={styles.slotsAfterCar} />
                </View>
              ) : null}
            </Animated.View>
          </SheetBlock>

          {mode === 'delivery' ? (
            <SheetBlock layoutKey={layoutKey} entering={enterUp(mounted ? 0 : 1)} shakeStyle={detailsShake.style} error={showError('details')}>
              {sessionDetails.address ? (
                <ValueRow
                  title={sessionDetails.address.label}
                  value={sessionDetails.address.line1}
                  onPress={() => router.push('/address')}
                  accessibilityLabel={`Deliver to ${sessionDetails.address.label}, ${sessionDetails.address.line1}. Change address`}
                />
              ) : (
                <ValueRow title="Add a delivery address" onPress={() => router.push('/address')} />
              )}
            </SheetBlock>
          ) : null}

          {/* ── Who it's for ── */}
          <SheetBlock
            layoutKey={layoutKey}
            entering={enterUp(mounted ? 0 : 2)}
            onLayout={(e) => recordY('contact', e)}
            shakeStyle={contactShake.style}
            error={showError('contact')}
          >
            {editingContact ? (
              <Animated.View key="edit" entering={fieldsIn} exiting={fieldsOut} style={styles.contactEdit}>
                <TextField
                  label="Name for the order"
                  value={contact.name}
                  onChangeText={(name) => setContact((prev) => ({ ...prev, name }))}
                  autoCapitalize="words"
                  autoComplete="name"
                  textContentType="name"
                  enterKeyHint="next"
                  keyboardAppearance={keyboardAppearance}
                />
                <TextField
                  label="Phone"
                  value={contact.phone}
                  onChangeText={(p) => setContact((prev) => ({ ...prev, phone: p }))}
                  inputMode="tel"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  placeholder="98765 43210"
                  hint="Indian mobile (+91). We text you when it’s ready."
                  enterKeyHint="done"
                  keyboardAppearance={keyboardAppearance}
                />
                <PressableScale
                  onPress={() => setEditingContact(false)}
                  activeScale={0.96}
                  hitSlop={10}
                  accessibilityLabel="Done"
                  style={styles.textButton}
                >
                  <Text style={styles.textButtonLabel}>Done</Text>
                </PressableScale>
              </Animated.View>
            ) : (
              <Animated.View key="view" entering={fieldsIn} exiting={fieldsOut}>
                <ValueRow
                  title={contact.name.trim() || 'Add your name'}
                  value={contact.phone ? displayPhone(contact.phone) : 'Add a phone number'}
                  onPress={() => setEditingContact(true)}
                  accessibilityLabel={`${contact.name.trim() || 'No name'}, ${contact.phone ? displayPhone(contact.phone) : 'no phone'}. Edit contact`}
                />
              </Animated.View>
            )}
          </SheetBlock>

          {/* ── The items ── */}
          <SheetBlock
            dividerInset={spacing.md + ORDER_LINES_LEAD + spacing.sm}
            layoutKey={layoutKey}
            entering={enterUp(mounted ? 0 : 3)}
            onLayout={(e) => recordY('items', e)}
            shakeStyle={itemsShake.style}
            error={showError('items')}
          >
            <OrderLines items={items} subtotal={totals.subtotal} open={linesOpen} onOpenChange={setLinesOpen} />
          </SheetBlock>

          {/* ── Promo code (and a redeemed reward): applied right here ── */}
          <SheetBlock
            last
            layoutKey={layoutKey}
            entering={enterUp(mounted ? 0 : 4)}
            onLayout={(e) => recordY('savings', e)}
            shakeStyle={savingsShake.style}
            error={showError('savings')}
          >
            <CouponRow subtotal={totals.subtotal} couponCode={couponCode} couponCheck={couponCheck} />
            {reward ? (
              <View style={styles.rewardRow}>
                <RewardChip reward={reward} discount={rewardValue} warning={rewardWarning} onRemove={() => setReward(undefined)} />
              </View>
            ) : null}
          </SheetBlock>

          {/* ── Tip (delivery only) ── */}
          {mode === 'delivery' ? (
            <LayoutBlock layoutKey={layoutKey} entering={enterUp(mounted ? 0 : 5)} onLayout={(e) => recordY('tip', e)}>
              <SectionLabel>Tip your delivery partner</SectionLabel>
              <Animated.View style={[styles.tipSheet, tipShake.style]}>
                <TipChips
                  value={tipChoice}
                  onChange={setTipChoice}
                  otherText={otherTip}
                  onOtherTextChange={setOtherTip}
                  error={showError('tip')}
                />
              </Animated.View>
            </LayoutBlock>
          ) : null}

          {/* ── Payment ── */}
          <LayoutBlock layoutKey={layoutKey} entering={enterUp(mounted ? 0 : 5)} onLayout={(e) => recordY('payment', e)}>
            <SectionLabel>Payment</SectionLabel>
            <Animated.View style={paymentShake.style}>
              <PaymentPicker
                mode={mode}
                value={payMethod.id}
                onChange={setMethodId}
                lastUsedId={lastPay.used ? lastPay.methodId : undefined}
                vpa={vpa}
                onVpaChange={setVpa}
                vpaError={showError('payment')}
                open={pickerOpen}
                onOpenChange={setPickerOpen}
              />
            </Animated.View>
          </LayoutBlock>

          {/* ── Totals ── */}
          <LayoutBlock layoutKey={layoutKey} entering={enterUp(mounted ? 0 : 6)} style={styles.summary}>
            <SummaryCard totals={totals} mode={mode} itemImages={items.map((i) => i.image)} />
          </LayoutBlock>
        </Animated.ScrollView>
        <HeaderScrollEdge scrollY={scrollY} />
      </KeyboardAvoider>

      <BottomBar>
        {placeError ? (
          <Animated.View entering={enterFade()} exiting={fieldsOut} style={styles.banner} accessibilityLiveRegion="polite">
            <Icon name={placeError.startsWith('You’re offline') ? 'cloud-offline-outline' : 'alert-circle'} size={18} color={c.danger} />
            <Text variant="caption" color={c.danger} style={styles.flex}>
              {placeError}
            </Text>
          </Animated.View>
        ) : null}
        <PrimaryBar
          onPress={() => void place()}
          loading={placing}
          disabled={!!issue}
          hapticKind="press"
          hint={issue?.hint}
          icon="bag-check-outline"
          accessibilityLabel={`Place order, ${formatMoney(totals.total)}`}
          left={
            <View style={styles.barLeft}>
              <Text style={styles.barLabel} color={c.onInk}>
                {'Place order · '}
              </Text>
              <RollingNumber value={totals.total} money fontSize={18} fontFamily={fonts.bold} color={c.onInk} />
            </View>
          }
        />
      </BottomBar>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1, minWidth: 0 },
  empty: { flex: 1, justifyContent: 'center', paddingBottom: spacing.xxxl },
  content: { paddingHorizontal: spacing.gutter, paddingTop: spacing.xs },
  inline: { paddingBottom: spacing.md },
  carEdit: { gap: spacing.sm },
  slotsAfterCar: { marginTop: spacing.md },
  carRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm + 4,
    backgroundColor: c.bg,
  },
  carText: { flex: 1, fontFamily: fonts.medium, fontSize: 15, lineHeight: 20 },
  link: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18, textDecorationLine: 'underline' },
  textButton: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
  textButtonLabel: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
  contactEdit: { gap: spacing.sm, paddingTop: spacing.md, paddingBottom: spacing.sm },
  rewardRow: { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: c.line },
  tipSheet: { backgroundColor: c.surface, borderRadius: radii.lg, paddingHorizontal: spacing.md },
  // A clear break before the totals; at rest on a 390×844 phone the peach card then starts behind
  // the bar's solid band instead of glowing through its fade.
  summary: { marginTop: spacing.xxl },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: c.dangerSoft,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    marginBottom: spacing.sm,
  },
  barLeft: { flexDirection: 'row', alignItems: 'center' },
  barLabel: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24 },
}));
