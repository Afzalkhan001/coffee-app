import { Fraunces_400Regular_Italic, Fraunces_600SemiBold_Italic } from '@expo-google-fonts/fraunces';
import {
  Outfit_300Light,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/outfit';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { onOrderStatusChange, startOrderSimulator } from '@/api/simulator';
import { OverlayHost } from '@/components/motion/OverlayHost';
import { AnimatedSplash } from '@/components/onboarding/AnimatedSplash';
import { LiveOrderPill } from '@/components/order/LiveOrderPill';
import { haptic } from '@/lib/haptics';
import { notifyNow } from '@/lib/notify';
import { isOrderOutcome, statusDescription, statusLabel } from '@/lib/orderFlow';
import { useStoresHydrated } from '@/store/hydration';
import { rememberPendingHref, useAppearance, useSession } from '@/store/session';
import { makeStyles, ThemeProvider, useTheme } from '@/theme';
import { installCurrencyGlyph } from '@/theme/currencyGlyph';

SplashScreen.preventAutoHideAsync().catch(() => {});
/** Web: "₹" at the weight of the Outfit text around it (Outfit has no ₹). No-op on native. */
installCurrencyGlyph();

/** Deep links (e.g. /product/latte) keep the tabs underneath so "back" works. */
export const unstable_settings = { anchor: '(tabs)' };

/**
 * The URL the app was opened with on web, read before the router's guard redirect rewrites it, so a
 * shared /product/latte link opened while signed out still lands on the latte after sign-in.
 */
const INITIAL_WEB_PATH =
  Platform.OS === 'web' && typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : null;

/**
 * Product detail. Native: a short fade (the measured hero flight is the real transition). Web: a
 * transparent card, so the screen underneath stays painted (the web stack hides every non-focused
 * screen unless the one above it is transparent) and shows through the product's fading tint.
 * Back navigation is unchanged: it is still a normal stack push.
 */
const PRODUCT_OPTIONS =
  Platform.OS === 'web'
    ? ({ animation: 'fade', animationDuration: 200, presentation: 'transparentModal', contentStyle: { backgroundColor: 'transparent' } } as const)
    : ({ animation: 'fade', animationDuration: 200 } as const);

/** The launch deep link is only considered once (a later sign-out must not resurrect it). */
let launchChecked = false;

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Outfit_300Light,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    Fraunces_600SemiBold_Italic,
    Fraunces_400Regular_Italic,
  });
  const hydrated = useStoresHydrated();
  const ready = (fontsLoaded || !!fontError) && hydrated;
  const [splashDone, setSplashDone] = useState(false);

  const appearance = useAppearance();
  const onboarded = useSession((s) => s.onboardingDone);
  const signedIn = useSession((s) => !!s.phone && !!s.profile);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Opened signed-out on a deep link → remember it (once, at launch); the tab bar pushes it after sign-in.
  useEffect(() => {
    if (!hydrated || launchChecked) return;
    launchChecked = true;
    if (!signedIn) rememberPendingHref(INITIAL_WEB_PATH);
  }, [hydrated, signedIn]);

  useEffect(() => {
    if (!hydrated) return;
    startOrderSimulator();
    return onOrderStatusChange((order, status) => {
      // docs/HAPTICS.md: `success` only when an order becomes ready (delivered, for delivery). Every
      // other status change is silent, on every screen.
      if (isOrderOutcome(status, order.details.mode)) haptic.success();
      const { notificationPermission, notificationPrefs } = useSession.getState();
      if (notificationPermission === 'granted' && notificationPrefs.orderUpdates) {
        notifyNow(`${order.number} · ${statusLabel(status, order.details.mode)}`, statusDescription(status, order.details.mode));
      }
    });
  }, [hydrated]);

  // Native splash stays up until fonts + persisted stores are ready. Never call router.* here.
  if (!ready) return null;

  return (
    <ThemeProvider preference={appearance}>
      <AppShell onboarded={onboarded} signedIn={signedIn} splashDone={splashDone} onSplashDone={() => setSplashDone(true)} />
    </ThemeProvider>
  );
}

/**
 * Everything under the theme: the status bar, the Stack's scene backgrounds and the root view
 * follow the scheme (DESIGN.md §R4), so a scheme change repaints the app without remounting it.
 */
function AppShell({
  onboarded,
  signedIn,
  splashDone,
  onSplashDone,
}: {
  onboarded: boolean;
  signedIn: boolean;
  splashDone: boolean;
  onSplashDone: () => void;
}) {
  const { colors: c, statusBarStyle } = useTheme();
  const s = useStyles();
  return (
    <GestureHandlerRootView style={s.root}>
      <OverlayHost>
        <StatusBar style={statusBarStyle} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: c.bg },
            animation: 'ios_from_right',
            gestureEnabled: true,
          }}
        >
          {/* 1 · Onboarding (first launch) */}
          <Stack.Protected guard={!onboarded}>
            <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
          </Stack.Protected>

          {/* 2 · Sign in (phone → OTP → profile) */}
          <Stack.Protected guard={onboarded && !signedIn}>
            <Stack.Screen name="auth/phone" options={{ animation: 'fade' }} />
            <Stack.Screen name="auth/otp" />
            <Stack.Screen name="auth/profile" options={{ gestureEnabled: false }} />
          </Stack.Protected>

          {/* 3 · The app */}
          <Stack.Protected guard={onboarded && signedIn}>
            <Stack.Screen name="(tabs)" options={{ animation: 'fade', gestureEnabled: false }} />
            {/* iOS: a shorter native fade so the measured hero flight reads as the transition.
                Web (no stack transitions): a transparent card, so the screen you tapped stays visible
                under the product's fading tint while the photo flies (D-08) instead of cutting to cream. */}
            <Stack.Screen name="product/[id]" options={PRODUCT_OPTIONS} />
            <Stack.Screen name="category/[id]" />
            <Stack.Screen name="search" options={{ animation: 'fade' }} />
            <Stack.Screen name="cart" />
            <Stack.Screen
              name="mode"
              options={{
                presentation: 'formSheet',
                sheetAllowedDetents: 'fitToContents',
                sheetCornerRadius: 36,
                sheetGrabberVisible: true,
                contentStyle: { backgroundColor: c.bg },
              }}
            />
            <Stack.Screen name="address" />
            <Stack.Screen name="checkout" />
            <Stack.Screen name="payment" options={{ gestureEnabled: false }} />
            {/* Payment hands over on an identical espresso frame (its circular reveal). Android's native
                'fade' also fades the outgoing screen, so mid-way the cream root showed through as a
                light flash between two dark screens: cut instead (iOS fades in over an opaque screen). */}
            <Stack.Screen
              name="order/confirmation/[id]"
              options={{ animation: Platform.OS === 'android' ? 'none' : 'fade', gestureEnabled: false }}
            />
            <Stack.Screen name="order/[id]" />
            <Stack.Screen name="order/invoice/[id]" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="help" />
            <Stack.Screen name="favorites" />
          </Stack.Protected>

          {/* Always reachable (the sign-in caption links here). Declared last so a guard flip never
              falls back to it: the router lands on the first *available* screen in this order. */}
          <Stack.Screen name="legal" />
        </Stack>
        {/* Live order pill: above every screen (it hides itself where it doesn't belong), under toasts and flights. */}
        {onboarded && signedIn && splashDone ? <LiveOrderPill /> : null}
        {!splashDone ? <AnimatedSplash onFinish={onSplashDone} /> : null}
      </OverlayHost>
    </GestureHandlerRootView>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.bg },
}));
