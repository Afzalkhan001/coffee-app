/**
 * Order type (DESIGN.md §R3.B "Order type"; formSheet on native, full page on web): "Order type",
 * the gradient store card, the 2×2 outlined mode cards with the shared sliding ink plate, and the
 * mode's fields (slot chips with an ink-filled selection, tables, car, delivery address) that
 * expand with height + fade. Edits are a draft until "Confirm"; swiping the sheet away discards them.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { quotedEtaMinutes } from '@/api';
import { enterUp, layoutSpring } from '@/components/motion';
import { ModeCards, StoreCard } from '@/components/domain';
import { Icon, PrimaryBar, PressableScale, Screen, ScreenHeader, Text } from '@/components/ui';
import { AddressCard } from '@/components/checkout/AddressCard';
import { BottomBar, useBottomBarSpace } from '@/components/checkout/BottomBar';
import { CarFields, EMPTY_CAR, FieldLabel, InfoNote, SlotChips, TableChips } from '@/components/checkout/ContextFields';
import { cartPrepMinutes, deliveryFeeNote, effectiveSlot, modeSummary } from '@/components/checkout/modeText';
import { fieldsIn, fieldsOut } from '@/components/checkout/motion';
import { isDeliverable } from '@/lib/geo';
import { cartSubtotal } from '@/lib/pricing';
import { useCart } from '@/store/cart';
import { useSession } from '@/store/session';
import { fonts, makeStyles, radii, spacing, useColors } from '@/theme';
import type { Address, CarDetails, OrderMode, OrderModeDetails } from '@/types/models';

const IS_WEB = Platform.OS === 'web';
const TITLE = 'Order type';

function cleanCar(car: CarDetails): CarDetails | undefined {
  const next = { make: car.make.trim(), color: car.color.trim(), plate: car.plate.trim().toUpperCase() };
  return next.make || next.color || next.plate ? next : undefined;
}

export default function ModeScreen() {
  const c = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const barSpace = useBottomBarSpace();
  const saved = useSession(useShallow((s) => ({ mode: s.mode, table: s.table, pickupTime: s.pickupTime, car: s.car })));
  const address = useSession((s) => s.addresses.find((a) => a.id === s.selectedAddressId));
  const items = useCart((s) => s.items);
  const commitMode = useSession((s) => s.setMode);
  const commitTable = useSession((s) => s.setTable);
  const commitPickupTime = useSession((s) => s.setPickupTime);
  const commitCar = useSession((s) => s.setCar);

  const [mode, setMode] = useState<OrderMode>(saved.mode);
  const [table, setTable] = useState(saved.table);
  const [slot, setSlot] = useState(effectiveSlot(saved.pickupTime));
  const [car, setCar] = useState<CarDetails>(saved.car ?? EMPTY_CAR);

  const prep = cartPrepMinutes(items);
  const eta = quotedEtaMinutes(mode, prep);
  const subtotal = cartSubtotal(items);
  const draft: OrderModeDetails = { mode, table, pickupTime: slot, car: cleanCar(car), address };

  const commit = (nextMode: OrderMode) => {
    commitMode(nextMode);
    commitTable(table);
    commitPickupTime(slot);
    commitCar(cleanCar(car));
  };
  const confirm = () => {
    commit(mode);
    router.back();
  };
  // Close the sheet first, then open the address screen on the underlying stack.
  const changeAddress = () => {
    commit('delivery');
    router.back();
    router.push('/address');
  };

  const body = (
    <View style={styles.body}>
      {IS_WEB ? null : (
        // Native sheet has no header: the same sentence-case screen title as Cart / Checkout.
        <Animated.View entering={enterUp(0)}>
          <Text variant="title" accessibilityRole="header">
            {TITLE}
          </Text>
        </Animated.View>
      )}

      {mode !== 'delivery' ? (
        <Animated.View key="store" entering={fieldsIn} exiting={fieldsOut} layout={layoutSpring}>
          <StoreCard />
        </Animated.View>
      ) : null}

      <Animated.View entering={enterUp(1)} layout={layoutSpring}>
        <ModeCards value={mode} onChange={setMode} compact />
      </Animated.View>

      <Animated.View layout={layoutSpring} style={styles.fieldsShell}>
        <Animated.View key={mode} entering={fieldsIn} exiting={fieldsOut} style={styles.fields}>
          {mode === 'pickup' ? (
            <>
              <FieldLabel>When should it be ready?</FieldLabel>
              <SlotChips value={slot} onChange={setSlot} etaMinutes={eta} bleed={spacing.gutter} fadeColor={c.bg} />
            </>
          ) : null}

          {mode === 'dine_in' ? (
            <>
              <FieldLabel required>
                Where are you sitting?
              </FieldLabel>
              <TableChips value={table} onChange={setTable} bleed={spacing.gutter} fadeColor={c.bg} />
            </>
          ) : null}

          {mode === 'in_car' ? (
            <>
              <FieldLabel required>
                Your car
              </FieldLabel>
              <CarFields value={car} onChange={setCar} />
              <View style={styles.gap} />
              <FieldLabel>Pickup time</FieldLabel>
              <SlotChips value={slot} onChange={setSlot} etaMinutes={eta} bleed={spacing.gutter} fadeColor={c.bg} />
            </>
          ) : null}

          {mode === 'delivery' ? (
            <DeliveryFields address={address} subtotal={subtotal} onChange={changeAddress} />
          ) : null}
        </Animated.View>
      </Animated.View>
    </View>
  );

  const bar = (
    <PrimaryBar label="Confirm" onPress={confirm} icon="checkmark" hapticKind="press" accessibilityLabel={`Confirm ${modeSummary(draft)}`} />
  );

  if (IS_WEB) {
    // formSheet renders as a normal full page on web.
    return (
      <Screen>
        <ScreenHeader title={TITLE} />
        <ScrollView contentContainerStyle={[styles.webContent, { paddingBottom: barSpace }]} keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
        <BottomBar>{bar}</BottomBar>
      </Screen>
    );
  }

  // Native formSheet sized to its content (`fitToContents`): no flex:1 at the root; the scroller
  // caps its height so tall modes (in-car + keyboard) still scroll inside the sheet.
  return (
    <View style={styles.sheet}>
      <ScrollView
        style={{ maxHeight: Math.max(320, height - insets.top - 170) }}
        contentContainerStyle={styles.sheetContent}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        // Android: the native sheet is a BottomSheetBehavior, which only lets an inner list scroll
        // (instead of dragging the whole sheet) when the list takes part in nested scrolling.
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        {body}
      </ScrollView>
      <View style={[styles.sheetBar, { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.xs }]}>{bar}</View>
    </View>
  );
}

function DeliveryFields({ address, subtotal, onChange }: { address: Address | undefined; subtotal: number; onChange: () => void }) {
  const styles = useStyles();
  return (
    <>
      <FieldLabel required>
        Deliver to
      </FieldLabel>
      {address ? (
        <AddressCard address={address} selected={isDeliverable(address)} actionLabel="Change" onPress={onChange} />
      ) : (
        <AddAddressRow onPress={onChange} />
      )}
      {address && !isDeliverable(address) ? (
        <InfoNote tone="warn" text="We don’t deliver there yet. Choose another address or pick Pickup above." style={styles.note} />
      ) : null}
      <InfoNote text={deliveryFeeNote(subtotal)} style={styles.note} />
    </>
  );
}

function AddAddressRow({ onPress }: { onPress: () => void }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <PressableScale onPress={onPress} activeScale={0.985} accessibilityLabel="Add a delivery address" style={styles.addRow}>
      <Icon name="add" size={20} color={c.ink} />
      <Text style={styles.addTitle}>Add a delivery address</Text>
      <Icon name="chevron-forward" size={18} color={c.inkMuted} />
    </PressableScale>
  );
}

const useStyles = makeStyles((c) => ({
  sheet: { backgroundColor: c.bg },
  sheetContent: { paddingHorizontal: spacing.gutter, paddingTop: spacing.xl + spacing.xs, paddingBottom: spacing.md },
  sheetBar: { paddingHorizontal: spacing.gutter, paddingTop: spacing.sm, backgroundColor: c.bg },
  webContent: { paddingHorizontal: spacing.gutter, paddingTop: spacing.xs },
  body: { gap: spacing.lg },
  fieldsShell: {},
  fields: { paddingBottom: spacing.xxs },
  note: { marginTop: spacing.md },
  gap: { height: spacing.lg },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: c.surface,
  },
  addTitle: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
}));
