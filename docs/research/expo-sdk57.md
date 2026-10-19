# Expo SDK 57 + expo-router 57: implementation cheat sheet (Ember Roast)

**Installed versions (read from `node_modules`):** expo 57.0.27 · expo-router 57.0.25 (it vendors React Navigation internally) · react-native 0.86.3 · react-native-screens 4.26.2 · react-native-web 0.21.3 · react-native-safe-area-context 5.7.0 · react-native-gesture-handler 2.32.0 · expo-blur 57.0.3 · expo-haptics 57.0.3 · expo-image 57.0.5 · expo-linear-gradient 57.0.2 · expo-location 57.0.20 · expo-notifications 57.0.22 · expo-splash-screen 57.0.9 · expo-font 57.0.4 · expo-status-bar 57.0.1 · @react-native-async-storage/async-storage 2.2.0 · zustand 5.0.15 · jest 29.7.0 · jest-expo 57.0.5 (+ @react-native/jest-preset 0.86.3) · @expo-google-fonts/outfit 0.4.3 · @expo-google-fonts/fraunces 0.4.1 · babel-preset-expo 57.0.14.

**How these snippets were checked.** I copied every snippet into a scratch app linked to this project's `node_modules`. Then:
- `tsc --noEmit` (TS 6, `expo/tsconfig.base`, `strict`) passed with 0 errors. A deliberately bad prop, such as `animation: 'zoom_in'` or `tint: 'ultra'`, did fail, so the check works.
- The jest-expo 57 tests ran green: one pure-TS test and the persisted-store test.
- `expo export --platform web` with `web.output: "static"` (the same as this app) rendered all 16 routes in Node without errors.
- A browser smoke test of that export passed:
  - `/` redirected to `/onboarding` through `Stack.Protected`.
  - "Start" flipped the guard and opened the tabs.
  - The reload kept `hasOnboarded` in localStorage.
  - The custom blurred tab bar switched tabs.
  - `useBottomTabBarHeight()` returned the measured 76px.
  - `Link asChild` rendered `<a href="/product/latte">`.
  - `/cart` as a `transparentModal` kept the product screen visible underneath.
  - The console had no errors and no hydration warnings.

Things I could **not** run here: native iOS/Android and Expo Go. For those, the notes come from the docs plus the installed native-module JS.

---

## 0. TL;DR: what will bite you

1. **Tabs import path.** Use `import { Tabs } from 'expo-router/js-tabs'`. In 57, `Tabs` from `'expo-router'` is marked `@deprecated` (see `build/exports.d.ts`). It is the same module (`build/layouts/Tabs`), so it still works, and the docs' Tabs page still shows the old import, but the deprecated import gets a strikethrough in the editor. Since SDK 56, apps **can't import `@react-navigation/*`**. Those packages aren't even installed. `BottomTabBarProps`, `useBottomTabBarHeight` and `BottomTabBarHeightCallbackContext` all come from `expo-router/js-tabs`. Theme and other helpers come from `expo-router/react-navigation`.
2. **`web.output: "static"` means the dev server renders every route in Node** on each request. I checked this in `@expo/cli` `MetroBundlerDevServer.js`: `useServerRendering = ['static','server'].includes(web.output)`. So don't touch `window`, `localStorage` or `document` at module scope. The persisted store uses `skipHydration: typeof window === 'undefined'`. If you don't need static HTML, `"single"` removes this class of bug. That's a decision for the lead; I didn't change `app.json`.
3. **Web stack has no transition animations.** It just toggles `display` between screens (`react-navigation/native-stack/views/NativeStackView.js`). On web, `presentation: 'modal' | 'formSheet'` renders as a normal full-page route. Only `transparentModal` and `containedTransparentModal` keep the previous screen visible. `EXPO_UNSTABLE_WEB_MODAL` is still referenced in the 57 source (`build/layouts/Stack.web.js`), but it's experimental, and the current web-modals docs say to remove it. Don't use it.
4. **expo-notifications on Android Expo Go.** Importing the package runs a side effect (`DevicePushTokenAutoRegistration.fx` calls `addPushTokenListener`, which calls `warnOfExpoGoPushUsage`) that **throws** on Android Expo Go. **A try/catch around `import()` does not contain this.** Metro's `guardedLoadModule` (`metro-runtime/src/polyfills/require.js`) passes errors thrown while a module initializes to `ErrorUtils.reportFatalError`, which means a red screen in dev and a crash in release, and the `import()` promise still resolves. So **never evaluate the package on Android Expo Go**: check `Platform.OS === 'android' && isRunningInExpoGo()` *before* the dynamic import (see §8). On web, scheduling throws `UnavailabilityError`.
5. **Haptics on web are not a no-op.** expo-haptics 57 calls `navigator.vibrate`, or on iOS Safari a hidden `<input switch>` trick. Turn it off on web for a clean demo console.
6. **BlurView on Android** defaults to `blurMethod: 'none'`, which is only a translucent tint. A real blur needs `BlurTargetView` plus a `blurTarget` ref plus `blurMethod`. `experimentalBlurMethod` is deprecated. **On web, BlurView overwrites your `style.backgroundColor`** with a color derived from the tint (`style={[style, blurStyle]}` in `BlurView.web.tsx`). Put any dim or brand tint on a separate sibling or child `View`.
7. **Each font weight is its own family.** Use `fontFamily: 'Outfit_700Bold'` and never set `fontWeight` on these fonts.
8. **The root layout returns `null` while fonts and the store load.** So never call `router.*` from it; you'll get "Attempted to navigate before mounting the Root Layout". Gate with `Stack.Protected` or `<Redirect>` instead.
9. **Never put tests under `src/app/`.** The router's `require.context` regex matches `*.test.tsx`, so they'd be bundled as routes.
10. **AsyncStorage needs a jest mock.** Without it, the import throws `NativeModule: AsyncStorage is null`.
11. **iOS 26 (liquid glass) `formSheet`.** expo-router sets `contentStyle` to transparent and `headerTransparent` to true by default. Always pass `contentStyle: { backgroundColor }`.
12. **Typed routes are generated only by `npx expo start`.** It writes `.expo/types/router.d.ts` and `expo-env.d.ts`; `expo export` doesn't. Until then `Href` is `string | HrefObject`, so `tsc` passes but checks nothing.
13. **Expo Go for SDK 57 on iOS requires login on both sides:** run `npx expo login` and log in to the same account in the Expo Go app.

---

## 1. Root layout: fonts, splash, gesture root, safe area, status bar

Docs: https://docs.expo.dev/versions/v57.0.0/sdk/splash-screen/ · https://docs.expo.dev/versions/v57.0.0/sdk/font/ · https://docs.expo.dev/versions/v57.0.0/sdk/status-bar/ · https://docs.swmansion.com/react-native-gesture-handler/docs/fundamentals/installation

**Font export names.** These are the exact exports in `@expo-google-fonts/*`.
- `Outfit_100Thin`, `Outfit_200ExtraLight`, **`Outfit_300Light`, `Outfit_400Regular`, `Outfit_500Medium`, `Outfit_600SemiBold`, `Outfit_700Bold`, `Outfit_800ExtraBold`**, `Outfit_900Black`. Outfit has **no italics**.
- Fraunces has `Fraunces_{100Thin…900Black}` and `Fraunces_{…}_Italic`. The brand face is **`Fraunces_600SemiBold_Italic`**.

```ts
// src/theme/fonts.ts
import { Fraunces_600SemiBold_Italic } from '@expo-google-fonts/fraunces';
import {
  Outfit_300Light, Outfit_400Regular, Outfit_500Medium,
  Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold,
} from '@expo-google-fonts/outfit';

/** Pass to useFonts(). Keys become the `fontFamily` strings. */
export const fontMap = {
  Outfit_300Light, Outfit_400Regular, Outfit_500Medium,
  Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold,
  Fraunces_600SemiBold_Italic,
};

/** Use these instead of fontWeight (each weight is its own family). */
export const font = {
  light: 'Outfit_300Light', regular: 'Outfit_400Regular', medium: 'Outfit_500Medium',
  semibold: 'Outfit_600SemiBold', bold: 'Outfit_700Bold', extrabold: 'Outfit_800ExtraBold',
  brand: 'Fraunces_600SemiBold_Italic',
} as const satisfies Record<string, keyof typeof fontMap>;
```

```tsx
// src/app/_layout.tsx
import { useFonts } from 'expo-font'; // prefer over @expo-google-fonts' own useFonts (SSR/hydration aware)
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useAppStore, useHasHydrated } from '@/store/useAppStore';
import { fontMap } from '@/theme/fonts';

void SplashScreen.preventAutoHideAsync();            // module scope, not awaited; no-op on web
SplashScreen.setOptions({ duration: 400, fade: true }); // `fade` is iOS-only

export const unstable_settings = { anchor: '(tabs)' }; // deep link /product/x keeps (tabs) under it

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontMap);
  const hydrated = useHasHydrated();
  const hasOnboarded = useAppStore((s) => s.hasOnboarded);
  const ready = (fontsLoaded || fontError != null) && hydrated;

  useEffect(() => {
    if (ready) SplashScreen.hide(); // hide() is sync; hideAsync() kept for back-compat
  }, [ready]);

  if (!ready) return null; // native splash stays up; never call router.* here

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'ios_from_right', // iOS: native push; Android: iOS-like slide; web: none
          contentStyle: { backgroundColor: '#F6F1EA' },
        }}
      >
        <Stack.Protected guard={!hasOnboarded}>
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={hasOnboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="product/[id]" options={{ animation: 'fade_from_bottom' }} />
          <Stack.Screen
            name="mode-sheet"
            options={{ presentation: 'transparentModal', animation: 'none', contentStyle: { backgroundColor: 'transparent' } }}
          />
          <Stack.Screen
            name="cart"
            options={
              Platform.OS === 'web'
                ? { presentation: 'transparentModal', contentStyle: { backgroundColor: 'transparent' } }
                : {
                    presentation: 'formSheet',
                    sheetAllowedDetents: [0.6, 1],
                    sheetInitialDetentIndex: 0,
                    sheetCornerRadius: 36,
                    sheetGrabberVisible: true, // iOS only
                    contentStyle: { backgroundColor: '#FFFFFF' }, // required on iOS 26 (see TL;DR 11)
                  }
            }
          />
        </Stack.Protected>
      </Stack>
    </GestureHandlerRootView>
  );
}
```

Notes:
- **SafeAreaProvider is already mounted by expo-router.** `ExpoRoot` wraps the app in `<SafeAreaProvider initialMetrics>`. Just use `useSafeAreaInsets()` from `react-native-safe-area-context`; adding a second provider is redundant. On web during static render, the insets are 0.
- **`GestureHandlerRootView`** goes inside the root layout, wrapping the navigator, with `style={{ flex: 1 }}`. The RNGH docs say an RN `<Modal>` needs its own `GestureHandlerRootView` on Android. If a pan gesture inside the native Android `formSheet` (`cart`) doesn't respond, wrap that screen's content in another `<GestureHandlerRootView style={{ flex: 1 }}>`. Nesting one is harmless. (Unverified for native-stack sheets.)
- **Status bar.** `StatusBarProps` in 57 is only `style | animated | hidden | hideTransitionAnimation`. `backgroundColor` and `translucent` are gone because Android is edge-to-edge. For dark screens such as onboarding and confirmation, switch the style on focus and don't mount a second `<StatusBar>`. Unfocused stack screens stay mounted, so the last-mounted bar would win.

```tsx
import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback } from 'react';

export function useLightStatusBar() {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light', true);
      return () => setStatusBarStyle('dark', true);
    }, []),
  );
}
```
- **Splash and Expo Go.** The docs say Expo Go and dev builds "cannot fully replicate the splash screen experience" since SDK 52. On web, `preventAutoHideAsync` and `hide` are no-ops, so the page is blank until fonts and the store are ready.
- The `expo-font` config plugin (fonts embedded at build time) only helps dev or store builds. Runtime `useFonts` is the path that works in Expo Go and on web.

---

## 2. expo-router 57

Docs: https://docs.expo.dev/router/advanced/stack/ · https://docs.expo.dev/router/advanced/tabs/ · https://docs.expo.dev/router/advanced/custom-tabs/ · https://docs.expo.dev/router/advanced/modals/ · https://docs.expo.dev/router/advanced/web-modals/ · https://docs.expo.dev/router/advanced/protected/ · https://docs.expo.dev/router/reference/typed-routes/ · https://docs.expo.dev/router/advanced/native-tabs/ · https://docs.expo.dev/router/migrate/sdk-55-to-56/ · https://docs.expo.dev/versions/v57.0.0/sdk/router/

### 2.1 Route tree (tabs group + stack screens on top)
```
src/app/
  _layout.tsx          root <Stack> + Stack.Protected (above)
  onboarding.tsx
  (tabs)/
    _layout.tsx        <Tabs tabBar=…> from 'expo-router/js-tabs'
    index.tsx          "/"  ← do NOT also create src/app/index.tsx (both resolve to "/")
    menu.tsx orders.tsx rewards.tsx profile.tsx
  product/[id].tsx     pushed on the ROOT stack → covers the tab bar automatically
  cart.tsx             formSheet (native) / transparentModal (web)
  mode-sheet.tsx       transparentModal + custom Reanimated sheet (DESIGN §7 blurred backdrop)
```
To open a product from inside a tab, use `router.push({ pathname: '/product/[id]', params: { id } })`. Typed routes accept both `/menu` and `/(tabs)/menu`.

### 2.2 Stack `animation`: values from `react-native-screens` `StackAnimationTypes`
| value | iOS | Android | web |
|---|---|---|---|
| `'default'` | native push | platform default | none |
| `'ios_from_right'` / `'ios_from_left'` | same as default | iOS-style slide | none |
| `'slide_from_right'` / `'slide_from_left'` | same as default | slide | none |
| `'fade'` | ✓ | ✓ | none |
| `'fade_from_bottom'` / `'slide_from_bottom'` | ✓ | ✓ | none |
| `'simple_push'` | iOS only | – | none |
| `'flip'` | needs `presentation:'modal'` | – | none |
| `'none'` | ✓ | ✓ | – |

- `animationDuration` is iOS-only and works for `fade`, `fade_from_bottom`, `slide_from_bottom` and `simple_push`. The JSDoc default is 500. It's ignored for `default`, `flip` and any `modal`/`formSheet`/`pageSheet` presentation.
- Other useful options: `gestureEnabled`, `fullScreenGestureEnabled`, `animationMatchesGesture`, `gestureDirection: 'vertical'`, `freezeOnBlur`.
- **Web:** stack transitions don't exist on web. For polish there, use Reanimated `entering` animations inside the screen.

### 2.3 `formSheet` (native) and `transparentModal`

The formSheet options below are all typed in the vendored native-stack:

```ts
import type { NativeStackNavigationOptions } from 'expo-router';

export const fitSheet: NativeStackNavigationOptions = {
  presentation: 'formSheet',
  sheetAllowedDetents: 'fitToContents', // or ascending fractions e.g. [0.5, 1]; Android uses max 3
  sheetInitialDetentIndex: 0,           // or 'last'
  sheetCornerRadius: 36,
  sheetGrabberVisible: true,            // iOS only
  sheetExpandsWhenScrolledToEdge: false,// iOS only
  sheetLargestUndimmedDetentIndex: 'none', // number | 'none' | 'last'
  sheetElevation: 24,                   // Android only
  contentStyle: { backgroundColor: '#FFFFFF' },
};
```
- **Android** renders a native bottom sheet. The docs say native headers and nested stacks aren't supported inside it; the older `presentation` JSDoc still says "fallback to modal", but that text is out of date. Also on Android: `sheetShouldOverflowTopInset`, `sheetResizeAnimationEnabled`, and an unstable `unstable_sheetFooter`.
- **`fitToContents`:** don't give the sheet's root `flex: 1`, or it collapses.
- The `sheetDetentChange` event is available through `screenListeners`.
- **Web:** `formSheet` becomes a plain full-page route. Use `transparentModal` there (see the `cart` screen in §1).

**`transparentModal`** is the one presentation that looks the same on iOS, Android and web. I checked the web case: the previous screen keeps `display: flex` with a transparent background. Use it for DESIGN's "blurred, dimmed backdrop" sheets and animate the sheet yourself:

```tsx
// src/app/mode-sheet.tsx   (route options: presentation 'transparentModal', animation 'none')
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ModeSheet() {
  const insets = useSafeAreaInsets();
  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => router.back()} accessibilityLabel="Close">
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        {/* Dim layer is a SIBLING: on web BlurView overwrites style.backgroundColor with its tint color */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(28,23,20,0.25)' }]} />
      </Pressable>
      {/* animate with Reanimated: translateY spring in on mount; animate out, then router.back() */}
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <Text>Pick up or delivery?</Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#FFF',
           borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 20 },
});
```
To close a sheet, use `router.back()`, `router.dismiss(count?)`, `router.dismissTo(href)`, `router.dismissAll()`, `<Link href=".." />` or `<Link dismissTo href="/">`.

### 2.4 Tabs with a fully custom tab bar
```tsx
// src/app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router/js-tabs';
import { FloatingTabBar } from '@/components/FloatingTabBar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />} // replaces the default bar entirely
      screenOptions={{ headerShown: false, animation: 'fade', sceneStyle: { backgroundColor: '#F6F1EA' } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="menu" options={{ title: 'Menu' }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders' }} />
      <Tabs.Screen name="rewards" options={{ title: 'Rewards' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
```

Props type: `BottomTabBarProps = { state: TabNavigationState; descriptors: Record<key, { options, navigation, route }>; navigation: NavigationHelpers<…, BottomTabNavigationEventMap>; insets: EdgeInsets }`.

Tab `animation` in js-tabs accepts `'none' | 'fade' | 'shift'`. These are JS animations, so they also work on web. Other tab options: `lazy`, `freezeOnBlur`, `popToTopOnBlur`, `tabBarHideOnKeyboard`.

```tsx
// src/components/FloatingTabBar.tsx
import { BlurView } from 'expo-blur';
import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from 'expo-router/js-tabs';
import { use } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { haptics } from '@/lib/haptics';

export function FloatingTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  // Report height so useBottomTabBarHeight() works in screens (bar is absolutely positioned).
  const reportHeight = use(BottomTabBarHeightCallbackContext);

  // `href: null` on a Tabs.Screen becomes tabBarItemStyle { display: 'none' } → skip it.
  const routes = state.routes.filter(
    (r) => StyleSheet.flatten(descriptors[r.key].options.tabBarItemStyle)?.display !== 'none',
  );

  return (
    <View
      style={[styles.wrap, { bottom: insets.bottom + 12 }]}
      onLayout={(e) => reportHeight?.(e.nativeEvent.layout.height + insets.bottom + 12)}
    >
      {/* web maps 'systemThinMaterialLight' to grey rgba(199,199,199,…); 'light' gives near-white rgba(249,249,249,…) */}
      <BlurView intensity={40} tint={Platform.OS === 'ios' ? 'systemThinMaterialLight' : 'light'} style={styles.pill}>
        {routes.map((route) => {
          const { options } = descriptors[route.key];
          const focused = state.routes[state.index]?.key === route.key;
          const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : (options.title ?? route.name);
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              haptics.selection();
              navigation.navigate(route.name, route.params);
            }
            // focused tab re-tapped: a nested <Stack> inside that tab pops to top on its own (it listens to tabPress)
          };
          return (
            <Pressable
              key={route.key}
              role="tab"
              aria-selected={focused}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              style={[styles.item, focused && styles.itemActive]}
            >
              {focused ? <Text style={styles.label}>{label}</Text> : null}
            </Pressable>
          );
        })}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, pointerEvents: 'box-none' }, // style, not prop (RNW 0.21)
  pill: {
    flexDirection: 'row', justifyContent: 'space-between', padding: 8, borderRadius: 999,
    overflow: 'hidden', // needed for radius on a BlurView
    backgroundColor: Platform.OS === 'android' ? 'rgba(255,255,255,0.92)' : 'transparent', // ignored on web (tint wins)
    boxShadow: '0 8px 24px rgba(59, 38, 24, 0.08)', // works on RN 0.86 native + web
  },
  item: { height: 48, minWidth: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  itemActive: { backgroundColor: '#1C1714', paddingHorizontal: 16 },
  label: { color: '#FFFFFF', fontFamily: 'Outfit_600SemiBold', fontSize: 14 },
});
```

Inside a screen, `const pad = useBottomTabBarHeight()` (from `expo-router/js-tabs`) gives you the bottom padding for `ScrollView` content.

**NativeTabs.** In 57 it lives at **`expo-router/unstable-native-tabs`**; it becomes stable as `expo-router/native-tabs` in 58. It draws the system tab bar, so the floating ink pill isn't possible. Its limits: 5 tabs on Android, no way to measure the bar height, a basic radix fallback on web. **A custom JS tab bar is fully supported**, so use `expo-router/js-tabs` as above. The other option is the headless `expo-router/ui` (`Tabs`/`TabList`/`TabTrigger`/`TabSlot`), which the docs mark experimental.

### 2.5 Auth/onboarding gating, params, typed routes, Link
- **Preferred: `Stack.Protected`** (§1). When `guard` flips, the router redirects to the anchor or the first available screen and drops that screen's history. I verified this on web. No `router.replace` is needed after `completeOnboarding()`. `Tabs.Protected` works the same way. Guards are evaluated only on the client, so they aren't a security boundary.
- **Alternative: a gate screen** that redirects declaratively. Don't navigate from the root layout.
```tsx
// e.g. src/app/start.tsx. NOT src/app/index.tsx: (tabs)/index.tsx already owns "/"
import { Redirect } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';

export default function Gate() {
  const hasOnboarded = useAppStore((s) => s.hasOnboarded);
  return <Redirect href={hasOnboarded ? '/' : '/onboarding'} />;
}
```
- `router` API: `push`, `navigate`, `replace`, `back`, `canGoBack`, `dismiss(count?)`, `dismissTo(href)`, `dismissAll`, `canDismiss`, `setParams`, `prefetch`, `reload`. Example: `router.canGoBack() ? router.back() : router.replace('/')`.
- **Params:**
```tsx
import { Image } from 'expo-image';
import { Link, router, useLocalSearchParams, type Href } from 'expo-router';
import { Pressable, Text } from 'react-native';

const { id } = useLocalSearchParams<{ id: string }>();        // works with or without generated types
// const { id } = useLocalSearchParams<'/product/[id]'>();    // typed-routes form (after `expo start`)
const related: Href = { pathname: '/product/[id]', params: { id: 'flat-white' } };

<Link href={related} asChild>
  <Pressable><Text>Flat white</Text></Pressable>
</Link>
<Link href="/cart" push asChild>
  <Pressable><Text>Open cart</Text></Pressable>
</Link>
```
- **Typed routes.** The generator types dynamic output params as `string` (`string[]` for `[...rest]`) and input params as `string | number`. At runtime, treat values as `string | string[]` (`UnknownOutputParams`). Template strings such as ``router.push(`/product/${id}`)`` also typecheck.
- **`Link asChild`:** the child must accept `onPress` and forward its ref. `Pressable` works, and on web the `<a href>` lands on it. Other Link props: `replace`, `push`, `dismissTo`, `withAnchor`, `prefetch`.

---

## 3. expo-haptics

Docs: https://docs.expo.dev/versions/v57.0.0/sdk/haptics/

Signatures:
- `impactAsync(style = ImpactFeedbackStyle.Medium)`
- `notificationAsync(type = NotificationFeedbackType.Success)`
- `selectionAsync()`
- `performAndroidHapticsAsync(type: AndroidHaptics)`, which does nothing on non-Android platforms.

All of them return `Promise<void>`. The enums:
- `ImpactFeedbackStyle`: `Light`, `Medium`, `Heavy`, `Soft`, `Rigid`.
- `NotificationFeedbackType`: `Success`, `Warning`, `Error`.

On iOS, haptics don't fire in Low Power Mode, when the Taptic Engine is off, or while the camera or dictation is active.

**Web (from `src/ExpoHaptics.web.ts`):** it uses `navigator.vibrate(pattern)`. If that's missing and the pointer is coarse, it uses an iOS Safari hidden `<input type=checkbox switch>` click. Chrome logs an intervention warning when it's called before a user tap.

```ts
// src/lib/haptics.ts
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const ENABLED = Platform.OS !== 'web';
const run = (fn: () => Promise<void>) => {
  if (!ENABLED) return;
  fn().catch(() => {});
};

export const haptics = {
  light: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),       // sizes, chips, stepper
  medium: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),     // add to cart
  selection: () => run(() => Haptics.selectionAsync()),                                 // tab switch
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
```
To call this from a Reanimated worklet (for example a gesture `onEnd`), use `scheduleOnRN(haptics.light)` with `import { scheduleOnRN } from 'react-native-worklets'`. The signature is `scheduleOnRN(fn, ...args): void`. **`runOnJS` is `@deprecated`** in both react-native-reanimated 4.5 (`lib/typescript/workletFunctions.d.ts`) and react-native-worklets 0.10 (`src/threads.native.ts`), so don't use it in new code.

---

## 4. expo-blur

Docs: https://docs.expo.dev/versions/v57.0.0/sdk/blur-view/ (supported on Android, iOS, tvOS, web and in Expo Go)

`BlurViewProps` (from `src/BlurView.types.ts`, plus `ViewProps`):
- `intensity?: number`: 1–100, default 50, and Reanimated can animate it.
- `tint?: BlurTint`: default `'default'`. The values are `'light' | 'dark' | 'default' | 'extraLight' | 'regular' | 'prominent'` and `'system{UltraThin|Thin|''|Thick|Chrome}Material'`, each with optional `Light`/`Dark` suffixes.
- `blurMethod?: 'none' | 'dimezisBlurView' | 'dimezisBlurViewSdk31Plus'`: Android only, default `'none'`.
- `blurTarget?: RefObject<View | null>`: Android only.
- `blurReductionFactor?: number`: Android only, default 4.
- `experimentalBlurMethod`: deprecated, logs a warning.

Behavior:
- **`borderRadius` isn't applied to the blur on native.** Use `overflow: 'hidden'` on the BlurView.
- **Android:** a dimezis method without `blurTarget` warns and falls back to `'none'`. Use `dimezisBlurViewSdk31Plus` to avoid the slow pre-31 RenderScript path.
- **Web:** a `View` with `backdropFilter: saturate(180%) blur(intensity*0.2 px)` plus a tint background color (`getBackgroundColor.ts`). The tint color is applied **after** your style, so `style.backgroundColor` on a BlurView is ignored on web. Some web tint colors: `light`/`extraLight` give `rgba(249,249,249,0.78·i)`, `dark` gives `rgba(25,25,25,0.78·i)`, `systemThinMaterialLight` gives `rgba(199,199,199,0.78·i)`, where `i = intensity/100`.
- **BlurTargetView** is a plain `View` on iOS and web. Only Android uses a native target. The docs say the BlurView must be rendered *after* the target's content, not inside the target, and one target can serve several BlurViews if they all fit within its bounds.

```tsx
import { BlurTargetView, BlurView } from 'expo-blur';
import { useRef, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

export function BlurredHeaderScreen({ content, header }: { content: ReactNode; header: ReactNode }) {
  const targetRef = useRef<View | null>(null);
  return (
    <View style={{ flex: 1 }}>
      <BlurTargetView ref={targetRef} style={StyleSheet.absoluteFill}>{content}</BlurTargetView>
      {/* BlurView must be a sibling OUTSIDE its target */}
      <BlurView
        blurTarget={targetRef}
        blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined}
        intensity={60}
        tint="light"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 48 }}
      >
        {header}
      </BlurView>
    </View>
  );
}
```
The floating tab bar lives *inside* the Tabs navigator, so it can't target the scenes behind it. On Android, give it a ~92% white surface (§2.4). For enter and exit effects, animate the wrapper's `opacity` rather than `intensity`; that's cheaper and consistent on web.

---

## 5. expo-linear-gradient

Docs: https://docs.expo.dev/versions/v57.0.0/sdk/linear-gradient/

Props (plus `ViewProps`):
- `colors: readonly [ColorValue, ColorValue, ...ColorValue[]]`: at least 2. If the array is declared outside JSX, add `as const`.
- `locations?: readonly [number, number, ...number[]] | null`: ascending, same length as `colors`. A mismatch warns and gets truncated.
- `start?` / `end?`: `{x,y}` or `[x,y]`, defaulting to `{0.5,0}` and `{0.5,1}`.
- `dither?: boolean`: Android only, default true.

**Web:** `start` and `end` only change the CSS angle.

```tsx
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

const SHIMMER = ['rgba(255,255,255,0)', 'rgba(255,255,255,0.65)', 'rgba(255,255,255,0)'] as const;
const STOPS = [0.3, 0.5, 0.7] as const;

export const ShimmerHighlight = () => (
  <LinearGradient colors={SHIMMER} locations={STOPS} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
    style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]} />
);
```
For the shimmer, wrap it in an `Animated.View` with an overflow-hidden parent and animate `translateX`. Don't animate the gradient props.

---

## 6. expo-image

Docs: https://docs.expo.dev/versions/v57.0.0/sdk/image/

Props:
- `contentFit`: `'cover' | 'contain' | 'fill' | 'none' | 'scale-down'`, default `cover`. `placeholderContentFit` defaults to **`'scale-down'`**, so set it to match.
- `transition`: `number` (ms of cross-dissolve) or `{ duration, timing: 'ease-in-out'|'ease-in'|'ease-out'|'linear', effect: 'cross-dissolve'|'flip-from-*'|'curl-up'|'curl-down'|null }`. Android only supports cross-dissolve; web has no curl effects.
- `placeholder`: `string | number | { blurhash } | { thumbhash } | ImageSource[]`.
- `cachePolicy`: `'none' | 'disk' (default) | 'memory' | 'memory-disk'`.
- `recyclingKey`: documented `@platform android, ios`.
- `cachePolicy` on web: only used for `source.headers` fetches (`'none'` → `fetch(..., { cache: 'no-cache' })`). Otherwise the browser HTTP cache decides.
- `priority`: `'low' | 'normal' | 'high'`.
- `loading`: web only, `'lazy'` by default.

Static methods: `Image.prefetch(urls, cachePolicy | { cachePolicy, headers })`, `clearMemoryCache`, `clearDiskCache`, and new in 57, `writeToCacheAsync` and `readFromCacheAsync`.

```tsx
import { Image, type ImageProps } from 'expo-image';

type Props = { uri: string; productId: string; blurhash?: string; size: number; priority?: ImageProps['priority'] };

export function ProductImage({ uri, productId, blurhash, size, priority = 'normal' }: Props) {
  return (
    <Image
      source={{ uri }}
      placeholder={blurhash ? { blurhash } : undefined}
      placeholderContentFit="cover"
      contentFit="cover"
      transition={{ duration: 250, effect: 'cross-dissolve', timing: 'ease-out' }}
      cachePolicy="memory-disk"
      recyclingKey={productId}
      priority={priority}
      style={{ width: size, height: size, borderRadius: size / 2 }} // no intrinsic size: always set w/h
    />
  );
}
export const prefetchProducts = (uris: string[]) => Image.prefetch(uris, 'memory-disk');
```
**Web:** by default `responsivePolicy` is `'static'` and `loading` is `'lazy'`. Pass `loading="eager"` for above-the-fold heroes and promo-carousel images, or they pop in late.

---

## 7. expo-location

Docs: https://docs.expo.dev/versions/v57.0.0/sdk/location/ (supported on Android, iOS and web; foreground location works in Expo Go, background doesn't)

API:
- `getForegroundPermissionsAsync()` and `requestForegroundPermissionsAsync()` return `LocationPermissionResponse` (`{ status, granted, canAskAgain, expires, ios?, android? }`).
- `getLastKnownPositionAsync({ maxAge?, requiredAccuracy? })` returns `LocationObject | null`.
- `getCurrentPositionAsync({ accuracy?, mayShowUserSettingsDialog?, timeInterval?, distanceInterval? })`.
- `Location.Accuracy` (alias of `LocationAccuracy`): `Lowest = 1`, `Low = 2`, `Balanced = 3`, `High = 4`, `Highest = 5`, `BestForNavigation = 6`.

**Web, from `ExpoLocation.web.ts`:**
- Permissions come from `navigator.permissions.query({name:'geolocation'})`. That **throws `UnavailabilityError`** if the API is missing.
- `request…` triggers the prompt by calling `getCurrentPosition` with no timeout. **If the user ignores the browser prompt, the promise never settles.**
- On web, `canAskAgain` is **always `true`**, even when the permission is `denied`.
- `getCurrentPositionAsync` sets **no timeout**, so it can hang. It also spreads your options straight into `PositionOptions` and uses `maximumAge: Infinity`.
- `getLastKnownPositionAsync` only returns a fix cached in memory during this page session; otherwise it returns `null`.
- `reverseGeocodeAsync` and `geocodeAsync` return `[]` with a dev warning.
- A **secure context** is required. `localhost` is fine; `http://192.168.x.x:8081` on a phone is blocked.

**iOS dev and store builds** need the `expo-location` plugin with `locationWhenInUsePermission`. Expo Go ships its own permission strings.

```ts
// src/lib/location.ts
import * as Location from 'expo-location';
import { Platform } from 'react-native';

export type Coords = { latitude: number; longitude: number };
export type LocationResult =
  | { status: 'granted'; coords: Coords | null }
  | { status: 'denied'; canAskAgain: boolean }
  | { status: 'unavailable' };

const withTimeout = <T>(p: Promise<T>, ms: number) =>
  Promise.race<T | null>([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);

/** Never throws, never hangs. Safe on iOS, Android, Expo Go and web. */
export async function requestLocation(timeoutMs = 8000): Promise<LocationResult> {
  try {
    const current = await Location.getForegroundPermissionsAsync();
    let perm: Location.LocationPermissionResponse | null = current;
    if (!current.granted && current.canAskAgain) {
      const ask = Location.requestForegroundPermissionsAsync();
      // Native dialogs are modal; an ignored browser prompt never settles, so cap it on web only.
      perm = Platform.OS === 'web' ? await withTimeout(ask, 20_000) : await ask;
    }
    if (!perm) return { status: 'unavailable' };
    if (!perm.granted) return { status: 'denied', canAskAgain: perm.canAskAgain };

    const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 });
    if (last) return { status: 'granted', coords: last.coords };

    const fix = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), timeoutMs);
    return { status: 'granted', coords: fix ? fix.coords : null };
  } catch {
    return { status: 'unavailable' };
  }
}
```

---

## 8. expo-notifications: Expo Go, web, and a wrapper that can't crash

Docs: https://docs.expo.dev/versions/v57.0.0/sdk/notifications/ · https://docs.expo.dev/push-notifications/faq/

**Expo Go support:**
- **Android Expo Go:** "Push notifications (remote notifications)… unavailable in Expo Go on Android from SDK 53". The docs also say "Local notifications (in-app notifications) remain available in Expo Go".
- **iOS Expo Go:** local notifications work. Importing the package logs a "not fully supported in Expo Go" warning.
- **Import-time hazard (installed source):** `index` re-exports from `DevicePushTokenAutoRegistration.fx`. If the native `getRegistrationInfoAsync` exists, that module calls `addPushTokenListener()` at module scope, which calls `warnOfExpoGoPushUsage()`. That function **throws on Android Expo Go** (CHANGELOG: "throw instead of logging a warning", #39459). Metro reports a throw during module initialization as **fatal** through `ErrorUtils.reportFatalError` in `guardedLoadModule`. That applies to both static imports and `import()`, so try/catch can't recover from it. **Don't load the package at all on Android Expo Go.** This contradicts the docs, which say local notifications "remain available in Expo Go". The demo shouldn't bet on that, so it uses the in-app toast there.
- **Web:** `requestPermissionsAsync` uses the browser `Notification.requestPermission`, which pops a real browser prompt. `scheduleNotificationAsync` throws `UnavailabilityError`. `setNotificationHandler` and the listeners warn once and do nothing.

**API details:**
- **Handler, new fields:** `shouldShowBanner` and `shouldShowList` are **required**. `shouldShowAlert` is deprecated and warns. The other fields are `shouldPlaySound`, `shouldSetBadge` (iOS) and `priority?`, and all except `priority` are required booleans. **Android: `shouldPlaySound: false` suppresses the heads-up (drop-down) banner whatever the priority** (that's in the docs and in the `NotificationBehavior` JSDoc). For a visible "order ready" banner while the app is in the foreground, set it to `true`.
- **Immediate local notification:** pass `trigger: null`. Passing `undefined` throws.
- **Delayed:** `{ type: SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, repeats?, channelId? }`.
- **Android 13+:** the OS prompt doesn't appear until **a channel exists**, so call `setNotificationChannelAsync` first.

```ts
// src/lib/notify.ts
import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';

type NotificationsModule = typeof import('expo-notifications');
let modPromise: Promise<NotificationsModule | null> | null = null;

/** false on web and on Android Expo Go: evaluating expo-notifications there is a fatal error. */
export const canUseNotifications = Platform.OS !== 'web' && !(Platform.OS === 'android' && isRunningInExpoGo());

function load(): Promise<NotificationsModule | null> {
  // Must short-circuit BEFORE import(): a module-init throw is reported as fatal by Metro, not caught below.
  if (!canUseNotifications) return Promise.resolve(null);
  modPromise ??= import('expo-notifications')
    .then((N) => {
      N.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true, // Android: false would suppress the heads-up banner
          shouldSetBadge: false,
        }),
      });
      return N;
    })
    .catch((e: unknown) => {
      if (__DEV__) console.warn('[notify] expo-notifications unavailable', e);
      return null;
    });
  return modPromise;
}

export type NotifyPermission = 'granted' | 'denied' | 'unsupported';

export async function requestNotificationPermission(): Promise<NotifyPermission> {
  const N = await load();
  if (!N) return 'unsupported';
  try {
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync('orders', { name: 'Order updates', importance: N.AndroidImportance.HIGH });
    }
    const existing = await N.getPermissionsAsync();
    const final = existing.granted ? existing : await N.requestPermissionsAsync();
    return final.granted ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}

/** seconds = 0 → immediate. Returns false when unsupported → caller shows an in-app toast. */
export async function notifyLocal(title: string, body: string, seconds = 0): Promise<boolean> {
  const N = await load();
  if (!N) return false;
  try {
    await N.scheduleNotificationAsync({
      content: { title, body, data: { kind: 'order' } },
      trigger: seconds > 0
        ? { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, channelId: 'orders' }
        : null,
    });
    return true;
  } catch {
    return false;
  }
}

export const isExpoGo = isRunningInExpoGo();
```

Notes on the wrapper:
- The `.catch` only covers ordinary promise failures, such as a failed lazy-bundle fetch. It can't catch the Android Expo Go import-time throw; only the `canUseNotifications` guard prevents that.
- The `import('expo-notifications')` type-only reference (`typeof import(...)`) is erased at build time and is safe on every platform.
- Enum values come from the loaded module, as in `N.SchedulableTriggerInputTypes.TIME_INTERVAL`. A string literal won't typecheck against the enum.
- On web, Metro still emits a ~62KB chunk for the `import()`, but it's never fetched.
- Never call `getExpoPushTokenAsync` or `addPushTokenListener` in this app. Push needs a dev build.

---

## 9. AsyncStorage 2.2 + zustand 5 `persist` with a hydration gate

Docs: https://docs.expo.dev/versions/v57.0.0/sdk/async-storage/ · https://zustand.docs.pmnd.rs/integrations/persisting-store-data

Behavior that matters here (from installed `zustand/esm/middleware.mjs`):
- **`onRehydrateStorage(state)`** runs before hydration. The callback it returns gets `(state, undefined)` on success or `(undefined, error)` on failure.
- **`persist.hasHydrated()` stays `false` forever if storage rejects,** and `onFinishHydration` never fires. So set your own flag in **both** paths.
- **Hydration timing.** AsyncStorage is always Promise-based, so hydration is async: the first render shows defaults.

```ts
// src/store/useAppStore.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type CartLine = { lineId: string; productId: string; size: 'S' | 'M' | 'L'; qty: number };

type AppState = {
  hasOnboarded: boolean;
  cart: CartLine[];
  hasHydrated: boolean; // not persisted
  completeOnboarding: () => void;
  addToCart: (line: CartLine) => void;
  setHasHydrated: (value: boolean) => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      hasOnboarded: false,
      cart: [],
      hasHydrated: false,
      completeOnboarding: () => set({ hasOnboarded: true }),
      addToCart: (line) => set((s) => ({ cart: [...s.cart, line] })),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'ember-roast/app',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ hasOnboarded: s.hasOnboarded, cart: s.cart }),
      skipHydration: typeof window === 'undefined', // static web render runs in Node (no localStorage)
      onRehydrateStorage: (state) => (_hydrated, error) => {
        if (error) console.warn('[persist] rehydrate failed, using defaults', error);
        state.setHasHydrated(true); // use `state`, not `useAppStore` (avoids TDZ with sync storages)
      },
    },
  ),
);

export const useHasHydrated = () => useAppStore((s) => s.hasHydrated);
```

- `typeof window` is `'object'` on native, because RN's `setUpGlobals.js` sets `global.window = global`, and on the web client. It's `'undefined'` only in the Node render. babel-preset-expo replaces it with the literal `'undefined'` only for server bundles (`minifyTypeofWindow ?? isServerEnv` in `configs/expo.js`). On native and the web client it stays a runtime check. In jest, `@react-native/jest-preset` also defines `window`, so the store hydrates in tests.
- As a result, the server HTML is an empty `<div id="root">` (the root returns `null` until hydrated) and the client hydrates with no mismatch. I verified this.
- **Selectors in zustand 5.** Returning a new object or array from a selector causes an infinite render loop. Use `useShallow` from `'zustand/react/shallow'`: `useAppStore(useShallow((s) => ({ cart: s.cart, add: s.addToCart })))`.
- Changing the shape of persisted data means bumping `version` and adding `migrate(persisted, fromVersion)`. Otherwise the stored state is ignored with a console error.

---

## 10. jest-expo 57 for pure TS modules

Docs: https://docs.expo.dev/develop/unit-testing/

The current `package.json` config works as is. I ran a pure-TS test in about 2.4s and a store test with jest-expo 57.0.5 and Jest 29.7.0.

```ts
// src/lib/__tests__/pricing.test.ts     ← NOT under src/app/
import { describe, expect, it } from '@jest/globals';
import { lineTotal } from '@/lib/pricing';

describe('lineTotal', () => {
  it('adds size delta and modifiers, times qty', () => {
    expect(lineTotal({ base: 4.5, sizeDelta: 0.6, modifiers: [0.6, 0.8], qty: 2 })).toBeCloseTo(13);
  });
});
```
```ts
// src/store/__tests__/useAppStore.test.ts
import { describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '@/store/useAppStore';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
); // hoisted above imports by babel-jest

it('hydrates, then persists only partialized keys', async () => {
  await new Promise((r) => setTimeout(r, 0));
  expect(useAppStore.getState().hasHydrated).toBe(true);
  useAppStore.getState().completeOnboarding();
  expect(JSON.parse((await AsyncStorage.getItem('ember-roast/app')) ?? 'null'))
    .toEqual({ state: { hasOnboarded: true, cart: [] }, version: 1 });
});
```
Gotchas:
- **Peer dependency.** jest-expo 57 requires **`@react-native/jest-preset` ^0.86.3**. It's installed transitively; if it ever goes missing, the preset throws a clear error. Stay on **Jest 29**: jest-expo 57 depends on `babel-jest`, `jest-environment-jsdom` and `@jest/globals` ^29.
- **Path aliases.** The preset **auto-maps tsconfig `paths`** (`withTypescriptMapping`), which makes the `^@/(.*)$` entry in `package.json` redundant. That entry also wins over `@/assets/*`. If a test imports `@/assets/...`, add `"^@/assets/(.*)$": "<rootDir>/assets/$1"` *before* it.
- **`transformIgnorePatterns`.** Don't override the preset's list. It already transforms `expo`, `@expo`, `@expo-google-fonts`, `react-native`, `@react-native` and `standard-navigation`. zustand resolves to CJS, so it needs no transform.
- **Native modules.** expo-* native modules are auto-mocked: methods become `jest.fn()` that resolve. **AsyncStorage isn't**; use the official mock above.
- **Platform.** The default test platform is `ios` (`Platform.OS === 'ios'`). Use the `jest-expo/web`, `/android`, `/node` or `/universal` presets for others.
- **Babel.** There's no `babel.config.js`, so jest-expo uses `expo/internal/babel-preset`. That preset also auto-adds `react-native-worklets/plugin`; never add the Reanimated plugin by hand.
- **Globals and file names.** Use `@jest/globals` imports (as above) or the `@types/jest` 29.5.14 globals. Test files must match `**/__tests__/**/*.test.ts?(x)`.

---

## 11. Web (react-native-web 0.21) gotchas for this stack

Docs: https://docs.expo.dev/router/web/static-rendering/ · https://docs.expo.dev/router/advanced/web-modals/ · https://necolas.github.io/react-native-web/

- **Static output means SSR in dev too.** Nothing browser-only at module scope. Guard with `typeof window` or put it in effects. `expo-haptics`, `expo-notifications` (web module) and the persisted store above are already SSR-safe; the export proved it. Dynamic `product/[id]` exports as `[id].html` unless you add `generateStaticParams`.
- **Navigation.** No stack animations. `modal` and `formSheet` become plain routes. `transparentModal` is your web sheet. Tab `animation: 'fade' | 'shift'` *does* run on web, because it's JS.
- **Deprecated in RNW 0.21.3, with an active `warnOnce`:**
  - `shadow*` styles: use `boxShadow` (a string or array, also native on RN 0.86).
  - `textShadow*`: use `textShadow`.
  - the **`pointerEvents` prop**: use `style.pointerEvents`.
  - `TouchableOpacity`, `TouchableHighlight` and `TouchableWithoutFeedback`: use `Pressable`.
  - TextInput `editable` and `returnKeyType`: use `readOnly` and `enterKeyHint`.
  - Image `style.resizeMode` and `style.tintColor`: use the props instead.
- **Deprecated, but the warning is commented out in 0.21.3 (no console noise):** Text `selectable` (→ `style.userSelect`), TextInput `numberOfLines` (→ `rows`), `keyboardType` (→ `inputMode`), and `accessibilityLabel`/`accessibilityRole` (→ `aria-label`/`role`).
- **Per-platform branching.** babel-preset-expo always inlines `process.env.EXPO_OS`. It inlines `Platform.OS` **only in production** builds (`configs/expo.js`). Prefer `process.env.EXPO_OS` for platform branches that should be tree-shaken.
- **expo-blur** uses `backdrop-filter`, which is fine in current Chrome, Safari and Firefox. Keep blurred areas small on low-end Android Chrome.
- **expo-image** lazy-loads by default (`loading`). `recyclingKey` is documented as native-only. `cachePolicy` only affects web when the source has `headers`.
- **expo-blur:** on web, `style.backgroundColor` on a BlurView is overwritten by the tint color (§4). Put dim layers in a sibling `View`.
- **expo-linear-gradient:** `start` and `end` only set the angle.
- **expo-location:** needs a secure origin, has no geocoding, and needs a timeout wrapper.
- **expo-notifications:** no scheduling, and requesting permission opens a real browser prompt. Use an in-app toast on web, and on Android Expo Go (§8).
- **expo-haptics:** real `navigator.vibrate` calls (see §3).
- **Fonts:** with `expo-font` and static output, the CLI inlines `@font-face` into the HTML (the export contained `Outfit_800ExtraBold`), and `useFonts` reports loaded during hydration.

---

## Verification notes

A second agent reviewed this file on 2026-10-07. It checked every API, prop, option key, import path and version against the installed `node_modules` (type definitions and JS source) and against docs.expo.dev. After the edits, every `ts`/`tsx` snippet except the tests was pulled into a scratch project linked to this project's `node_modules` and typechecked with TS 6.0.3 (`expo/tsconfig.base`, `strict`): **0 errors**. Deliberately bad values were rejected, which shows the check works: tint `'ultra'`, stack animation `'zoom_in'`, tab animation `'slide'`, and a handler missing `shouldShowList`.

**Corrected:**
1. **expo-notifications, Android Expo Go (§0.4, §8). This was a real crash bug.** The old advice was "lazy `import()` inside try/catch". That doesn't work. Metro's `guardedLoadModule` (`metro-runtime/src/polyfills/require.js`) sends any error thrown while a module initializes to `ErrorUtils.reportFatalError`, and `asyncRequire` → `require.importAll` runs outside a guard. So the import-time throw in `warnOfExpoGoPushUsage` becomes a fatal error before `.catch` runs. The wrapper now checks `canUseNotifications` (not web, and not Android + `isRunningInExpoGo()`) **before** calling `import()`.
2. **Notification handler (§8):** `shouldPlaySound: false` → `true`. Per the docs and the `NotificationBehavior` JSDoc, `false` on Android hides the heads-up banner whatever the priority.
3. **expo-blur on web (§0.6, §2.3, §2.4, §4, §11):** `BlurView.web.tsx` renders `style={[style, blurStyle]}`, so the tint's `backgroundColor` overwrites yours. The mode-sheet dim layer is now a sibling `View`. The tab bar uses `tint="light"` off iOS, because web maps `systemThinMaterialLight` to grey `rgba(199,199,199,…)`.
4. **`runOnJS` (§3):** it was described as "the older" option. It's actually `@deprecated` in Reanimated 4.5 and in Worklets 0.10. Use `scheduleOnRN(fn, ...args)`.
5. **expo-location on web (§7):** `requestForegroundPermissionsAsync` never settles if the browser prompt is ignored, and `canAskAgain` is always `true` on web. The snippet now caps the request at 20s on web only and returns `'unavailable'` on timeout.
6. **RNW 0.21.3 deprecations (§11):** Text `selectable` and TextInput `numberOfLines` warnings are **commented out** in the installed source, so they don't warn. Added the ones that do warn: `TouchableWithoutFeedback`, and Image `style.resizeMode`/`style.tintColor`.
7. **Inlining (§9, §11):** `Platform.OS` is inlined only in **production** builds, while `process.env.EXPO_OS` is always inlined. `typeof window` is replaced with a literal only in server bundles; on native and the web client it stays a runtime check.
8. **expo-image (§6, §11):** `cachePolicy` isn't purely native. On web it controls the `fetch` cache mode for sources that have `headers`.
9. Smaller clarifications: the docs' Tabs page still shows `import { Tabs } from 'expo-router'`, which is the same module as `js-tabs` but deprecated. A `<Redirect>` gate must not live at `src/app/index.tsx`. `containedTransparentModal` also stays see-through on web. Added web tint values and BlurTargetView placement rules.

**Confirmed as written** (spot list): all version numbers. `expo-router/js-tabs` exports `BottomTabBarProps`, `useBottomTabBarHeight` and `BottomTabBarHeightCallbackContext`, which is `Context<((h:number)=>void)|undefined>`. `@react-navigation/*` is not installed, and the docs' SDK 56 migration table maps `bottom-tabs` → `js-tabs` and `native` → `react-navigation`. Confirmed type lists:
- `StackAnimationTypes`
- `TabAnimationName = 'none'|'fade'|'shift'`
- every `sheet*` option and its type
- `animationDuration` (iOS, default 500)
- `Stack.Protected`/`Tabs.Protected` `{ guard: boolean }`
- `unstable_settings.anchor`
- the router methods, including `prefetch`
- `Link` `push`/`replace`/`dismissTo`/`withAnchor`/`prefetch`, and `'..'` as a valid `RelativePathString`
- the iOS 26 formSheet defaults (`??=` on `headerTransparent`/`contentStyle`, in `fork/native-stack/createNativeStackNavigator.js`)
- `ExpoRoot` wrapping `SafeAreaProvider`
- `StatusBarProps` (4 keys) and `setStatusBarStyle(style, animated?)`
- splash `hide()`/`setOptions({duration, fade})`
- `useFonts` → `[boolean, Error|null]`
- the expo-haptics signatures and web fallback
- `BlurViewProps`/`BlurTint`/`BlurMethod`
- the `LinearGradientProps` tuple types
- the expo-image props, defaults and static methods (`writeToCacheAsync`/`readFromCacheAsync` arrived in 57.0.0)
- `Location.Accuracy` values
- `trigger: null` vs `undefined`
- the zustand persist hydrate and error paths
- jest-expo's peer `@react-native/jest-preset ^0.86.3`, `withTypescriptMapping` and `transformIgnorePatterns`
- the router `require.context` regex matching `*.test.tsx`

NativeTabs: `expo-router/unstable-native-tabs` in SDK 54–57 and `expo-router/native-tabs` from SDK 58, with a 5-tab Android limit and no way to measure the bar height (native-tabs docs). The iOS Expo Go login requirement for SDK 57 is confirmed by the expo.dev changelog ("Login now required for running projects in Expo Go").

**Still uncertain:**
- Whether `NotificationsServerRegistrationModule.getRegistrationInfoAsync` actually exists inside the Android Expo Go binary. If it doesn't, the import wouldn't throw, and local notifications would work as the docs say. The guard is the safe choice either way. It can't be tested without a device.
- Whether gestures inside a native Android `formSheet` need their own `GestureHandlerRootView`. The RNGH docs only say so for RN `<Modal>`. Test on a device.
- `EXPO_UNSTABLE_WEB_MODAL`: the 57 source still references it, and the current docs say to remove it. Treat it as unsupported.
- The original author's runtime claims (the web export smoke test, jest runs, `useBottomTabBarHeight()` = 76px) were not re-run in this review. Only the types and the source were re-checked.
- Native iOS/Android behavior (sheet detents, `ios_from_right`, haptics, blur) is backed by JSDoc and docs only, not by running on a device.
