import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '@/api/mockDb';
import { APP_VERSION } from '@/components/account/appInfo';
import { AppearanceRow } from '@/components/account/AppearanceRow';
import { ConfirmSheet } from '@/components/account/ConfirmSheet';
import { HeaderScrollEdge, useHeaderScroll } from '@/components/account/HeaderScrollEdge';
import { ListGroup } from '@/components/account/ListGroup';
import { NotificationPrefsCard } from '@/components/account/NotificationPrefsCard';
import { ToggleRow } from '@/components/account/Toggle';
import { enterFade, useToast } from '@/components/motion';
import { useLivePillSpace } from '@/components/order/livePillSpace';
import { ListRow, Screen, ScreenHeader, Text } from '@/components/ui';
import { hourLabel, storeStatus } from '@/lib/storeHours';
import { useCart } from '@/store/cart';
import { useDemo } from '@/store/demo';
import { useSession } from '@/store/session';
import { fonts, useColors } from '@/theme';
import { brand } from '@/theme/brand';

/**
 * Settings (DESIGN.md §R3.B "Settings"): notification switches, Preferences (Appearance — System /
 * Light / Dark, DESIGN.md §R4 — and the Haptics switch, docs/HAPTICS.md), then the prototype's
 * demo tools (offline, fast statuses, keep the store open, reset) in one plain sheet, and the version.
 */
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  // Room for the live order pill floating over the end of the list (0 when it isn't here).
  const pillSpace = useLivePillSpace();
  const c = useColors();
  const { scrollY, onScroll } = useHeaderScroll();
  const toast = useToast();
  const offline = useDemo((s) => s.offline);
  const fastStatus = useDemo((s) => s.fastStatus);
  const setOffline = useDemo((s) => s.setOffline);
  const setFastStatus = useDemo((s) => s.setFastStatus);
  const forceStoreOpen = useDemo((s) => s.forceStoreOpen);
  const setForceStoreOpen = useDemo((s) => s.setForceStoreOpen);
  const hapticsOn = useSession((s) => s.hapticsEnabled);
  const setHapticsEnabled = useSession((s) => s.setHapticsEnabled);
  const [resetOpen, setResetOpen] = useState(false);
  const resetting = useRef(false);

  const toggleOffline = (next: boolean) => {
    setOffline(next);
    toast(next ? 'Offline: requests fail like a dropped connection' : 'Back online', {
      icon: next ? 'cloud-offline' : 'check-circle',
    });
  };

  const toggleFast = (next: boolean) => {
    setFastStatus(next);
    toast(next ? 'Fast statuses: new orders play out in seconds' : 'Orders follow real prep times');
  };

  const toggleStoreOpen = (next: boolean) => {
    setForceStoreOpen(next);
    const s = storeStatus(new Date(), next);
    toast(next ? `Store kept open · ${s.label}` : `Real opening hours · ${s.label}`);
  };

  const resetDemo = () => {
    // Clear data first; resetAll() flips the onboarding guard, and the root Stack.Protected
    // then redirects to onboarding by itself (no router call needed or wanted).
    useCart.getState().clear();
    db.reset();
    useDemo.getState().setOffline(false);
    // Silent: the dialog's Confirm already clicked. Haptics and Appearance survive the reset.
    useSession.getState().resetAll();
  };

  const hours = `${hourLabel(brand.store.opensAtHour)}–${hourLabel(brand.store.closesAtHour)}`;

  return (
    <Screen>
      <ScreenHeader title="Settings" />
      <View style={styles.fill}>
        <Animated.ScrollView
          onScroll={onScroll}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 + pillSpace }]}
          showsVerticalScrollIndicator={false}
        >
          <NotificationPrefsCard index={0} />

          {/* ToggleRow clicks after applying the change: turning Haptics on answers with a toggle; off stays quiet. */}
          <ListGroup title="Preferences" index={1} style={styles.group}>
            <AppearanceRow />
            <ToggleRow title="Haptics" subtitle="Gentle taps for key moments" value={hapticsOn} onValueChange={setHapticsEnabled} />
          </ListGroup>

          <ListGroup title="Demo tools" index={2} style={styles.group}>
            <ToggleRow title="Simulate offline" subtitle="Requests fail with a network error" value={offline} onValueChange={toggleOffline} />
            <ToggleRow title="Fast order statuses" subtitle="Steps advance every few seconds" value={fastStatus} onValueChange={toggleFast} />
            <ToggleRow title="Keep store open" subtitle={`Order outside ${hours}`} value={forceStoreOpen} onValueChange={toggleStoreOpen} />
            <ListRow title="Reset demo" danger showChevron={false} onPress={() => setResetOpen(true)} />
          </ListGroup>

          <Animated.View entering={enterFade(3)}>
            <Text style={styles.version} color={c.inkMuted} align="center">
              {`${brand.name} · Version ${APP_VERSION}`}
            </Text>
          </Animated.View>
        </Animated.ScrollView>
        <HeaderScrollEdge scrollY={scrollY} />
      </View>

      <ConfirmSheet
        visible={resetOpen}
        title="Reset the demo?"
        message="Clears the cart, orders, points and sign-in, then starts again at onboarding."
        confirmLabel="Reset everything"
        cancelLabel="Keep my data"
        destructive
        onConfirm={() => {
          resetting.current = true;
          setResetOpen(false);
        }}
        onCancel={() => setResetOpen(false)}
        onClosed={() => {
          if (!resetting.current) return;
          resetting.current = false;
          resetDemo();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8 },
  group: { marginTop: 28 },
  version: { marginTop: 28, fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
});
