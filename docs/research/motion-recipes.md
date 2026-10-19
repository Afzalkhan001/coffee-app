# Ember Roast motion recipes

Working TypeScript for every signature moment in `DESIGN.md` §7, written against the **versions actually installed** in `node_modules`:

| Package | Installed | Package | Installed |
|---|---|---|---|
| expo | 57.0.27 (expo-router 57.0.25) | react-native | 0.86.3 / react 19.2.3 |
| react-native-reanimated | **4.5.1** | react-native-worklets | **0.10.1** |
| react-native-gesture-handler | **2.32.0** | react-native-svg | **15.15.4** |
| expo-blur / haptics / linear-gradient / image | 57.0.3 / 57.0.3 / 57.0.2 / 57.0.5 | react-native-web | 0.21.3 |

## How this was verified

Every **full-file block** below (the ones whose first line is a `// src/...` path comment) is copied byte for byte from a scratch Expo app that links to this project's `node_modules`. The short **Usage** snippets are excerpts or sketches built on that same code. Each full file passed these checks:

1. **`tsc --noEmit`** with the project's `tsconfig` (strict, `expo/tsconfig.base`), including the generated **typed routes** (`.expo/types/router.d.ts`). Result: 0 errors.
2. **`babel-preset-expo` 57 with React Compiler 1.0 and the worklets plugin**, run for `ios`, `android` and `web`, with a compiler logger attached. Every component and hook compiled (0 bail-outs), and all worklets were detected.
3. **Runtime test on web** (Expo web, Metro, React Compiler on), with values sampled every animation frame from the DOM:
   - tab pill stretch (leading edge 340-stiffness spring, trailing edge 150)
   - collapsing header clamps at −64px
   - card → hero FLIP: starts at the card rect `(30,246,140)` and springs to the hero
   - shake: −6 → +6 → −4.5 → +4.5 → −3 → +3 → 0
   - size indicator: overshoot ≤ 2px, stretch to 1.16
   - fly-to-cart: quadratic arc, scale 3.3 → 0.37, then the badge pops to 1.35
   - pay button: 335px → 64px → error shake and red tint → success check
   - 28 confetti particles
   - connector `scaleY` fill (origin top)
   - onboarding draw-on (`strokeDashoffset` 154 → 0) and the steam dot at each page
   - Gesture Handler tap scales to 0.976 and fires `onPress`
   - zero console warnings
4. iOS and Android: not run on a device here. The native paths only use APIs whose native implementations were read in `node_modules` (`measure`, `scheduleOnUI`/`runOnUIAsync`, SVG `animatedProps`, `boxShadow`, `transformOrigin`). Everything used is bundled in Expo Go SDK 57.

> Proposed file locations are given in each block's first-line comment (`src/theme/motion.ts`, `src/components/motion/*`, `src/lib/*`, `src/store/*`). The `@/` alias maps to `src/`, as in `tsconfig.json`.
>
> **Already in the project. Don't overwrite these:** `src/lib/haptics.ts` exists with the same `haptic.light/medium/selection/success/error` API and the same `HapticKind` type (it no-ops on web on purpose), so keep it and skip the haptics block below. `src/theme/index.ts` already exports `colors` and `springs` with `mass: 1`. `src/components/ui/PressableScale.tsx` exists with a different prop API (`activeScale`, `hapticKind`). Stores live in `src/store/` (not `stores/`).

---

## Things that changed under you (verified in `node_modules`, not from memory)

| # | Gotcha | Evidence | What the recipes do |
|---|---|---|---|
| 1 | **The default `withSpring` is now `{ mass: 4, damping: 120, stiffness: 900 }`.** The DESIGN presets (18/260, 22/180, 26/120) assume mass 1. Without `mass: 1` they become about 2× slower and much bouncier. `restDisplacementThreshold`/`restSpeedThreshold` were replaced by `energyThreshold`. `duration` is now *perceptual* (the real duration is 1.5×). | `reanimated/lib/typescript/animation/spring/springConfigs.d.ts` | `spring.*` tokens always set `mass: 1` |
| 2 | `runOnJS` / `runOnUI` / `executeOnUIRuntimeSync` are **deprecated**. Use `scheduleOnRN(fn, ...args)`, `scheduleOnUI(worklet, ...args)` and `runOnUISync` from `react-native-worklets`, which take arguments directly and are not curried. **`runOnUISync` throws on web.** `runOnUIAsync` works on both. | `worklets/src/threads.ts` (web), `reanimated/.../workletFunctions.d.ts` | `scheduleOnUI`, `scheduleOnRN`, and `runOnUIAsync` for measuring from JS |
| 3 | `measure(animatedRef)` runs **only on the UI thread** on native (on the RN runtime it returns `null`). On web, `pageX`/`pageY` come from `getBoundingClientRect()` (transforms included) but `width`/`height` come from `offsetWidth`/`offsetHeight` (transforms **not** included), so a scaled or rotated view measures slightly off on web. | `reanimated/src/platformFunctions/measure.ts`, `measure.web.ts` | Every `measure` call is inside a worklet |
| 4 | **Shared element transitions are off**: the static flag `ENABLE_SHARED_ELEMENT_TRANSITIONS: false`. Static flags need a native rebuild, so they can't be changed in Expo Go. | `reanimated/src/featureFlags/staticFlags.json` | Recipe 4 uses a manual FLIP |
| 5 | React Compiler: use `sv.get()` / `sv.set()` and never read shared values during render. **A computed default parameter (`radius = size / 2`) makes the compiler bail** (`BuildHIR … BinaryExpression cannot be safely reordered`). | Reanimated `useSharedValue` docs, plus a compiler logger run | Defaults are computed in the function body |
| 6 | RN 0.86 removed **`StyleSheet.absoluteFillObject`** (`absoluteFill` is now a plain object you can spread). `role="text"` is not part of `Role`. | `react-native/Libraries/StyleSheet/StyleSheet.d.ts` | `...StyleSheet.absoluteFill` |
| 7 | `Tabs` from `'expo-router'` is **`@deprecated`**. Import `{ Tabs, type BottomTabBarProps }` from **`'expo-router/js-tabs'`**. `tabBarIcon` receives `color: ColorValue`. | `expo-router/build/exports.d.ts` | Recipe 5 |
| 8 | expo-blur on **Android** defaults to `blurMethod: 'none'` (a semi-transparent view). Real blur needs three things: the content wrapped in `<BlurTargetView ref={targetRef}>`, a `BlurView` placed **outside** that target with `blurTarget={targetRef}`, and `blurMethod="dimezisBlurViewSdk31Plus"` (or `"dimezisBlurView"`). Without `blurTarget` it logs a warning and falls back to `'none'`. On web it uses `backdrop-filter` and **overrides your `backgroundColor`**. | `expo-blur/src/BlurView.tsx`, `BlurView.types.ts`, `BlurView.web.tsx`, Expo SDK 57 BlurView docs | Fills are opaque enough to read well without blur |
| 9 | Web layout animations are CSS keyframes. **`.springify()` is ignored on web and the easing falls back to linear.** Flat `withInitialValues({ translateY })` is not understood by the web keyframe generator in 4.5.1 (the deprecated `transform: [...]` form is). `Keyframe` per-step easing only supports *named* easings on web. | `reanimated/src/layoutReanimation/web/*` | Recipe 15 branches on web |
| 10 | `useReducedMotion()` is read **once, at app start**. Every animation defaults to `ReduceMotion.System`: under Reduce Motion it jumps to its end value, and `withRepeat(…, reverse=true)` with an infinite or even repeat count stays at its start value. | `reanimated/src/hook/useReducedMotion.ts`, `animation/util.ts`, `repeat.ts` | Each recipe states what happens under Reduce Motion |
| 11 | The `pointerEvents` *prop* is deprecated on RN-Web. Use **`style.pointerEvents`**. | RNW warning | `style={{ pointerEvents: 'none' }}` |
| 12 | `GestureDetector` on web defaults to **`touchAction: 'none'`**, which blocks page scroll on touch screens. | `GestureDetector/index.d.ts` | `touchAction="pan-y"` |
| 13 | `react-native-svg`: `getTotalLength()` is **native-only** and the `pathLength` attribute is **web-only**. | `react-native-svg/src/elements/Shape.tsx`, `src/web/utils` | A pure-JS `getPathLength(d)` (Appendix A) |
| 14 | `expo-haptics` 57 **has a web implementation** (`navigator.vibrate`, plus an iOS-Safari switch trick). | `expo-haptics/src/ExpoHaptics.web.ts` | No `Platform` guard needed |
| 15 | `useAnimatedScrollHandler`: **only `onScroll` fires on web.** `onBeginDrag`, `onEndDrag`, `onMomentumBegin` and `onMomentumEnd` are wired to RN-Web `ScrollView` props that never fire. | Reanimated docs ("Only `onScroll` event works on Web"), `react-native-web/dist/exports/ScrollView` | Recipe 16 snaps on native only |
| 16 | On **web**, the expo-router `Stack` (native-stack web view) has **no push transition**. It shows only the focused screen, and the previous one gets `display: none` at once. `animationDuration` works on **iOS only** (fade, fade_from_bottom, slide_from_bottom, simple_push). | `expo-router/build/react-navigation/native-stack/views/NativeStackView.js`, `native-stack/types.d.ts` | Recipe 4 still works on web: the hero flies over the detail screen's own background |

---

## 0. Foundation (used by every recipe)

**When to use:** always. These give one source for the springs, the easing curve and haptics.

```ts
// src/theme/motion.ts
import { Easing, type WithSpringConfig } from 'react-native-reanimated';

/**
 * DESIGN.md §7 spring presets.
 * Reanimated 4 changed the default spring to { mass: 4, damping: 120, stiffness: 900 }.
 * The DESIGN numbers assume mass 1, so `mass: 1` MUST be explicit or every spring
 * becomes ~2x slower and much bouncier.
 */
export const spring = {
  /** presses, toggles, size circles, chips */
  snappy: { mass: 1, damping: 18, stiffness: 260 },
  /** sheets, layout changes, tab pill, odometer digits */
  smooth: { mass: 1, damping: 22, stiffness: 180 },
  /** hero + entrance animations */
  gentle: { mass: 1, damping: 26, stiffness: 120 },
} as const satisfies Record<string, WithSpringConfig>;

/** easeOutQuint — the only timing curve allowed for opacity (DESIGN §7). */
export const easeOutQuint = Easing.bezier(0.22, 1, 0.36, 1);
/** Symmetric curve for progress-driven paths (fly-to-cart, line-art draw). */
export const easeInOutCubic = Easing.bezier(0.65, 0, 0.35, 1);

export const duration = {
  fade: 220,
  fadeFast: 140,
  draw: 1400,
  flight: 680,
} as const;

/** DESIGN §2 tokens used by the recipes (keep in sync with src/theme/index.ts). */
export const colors = {
  bg: '#F6F1EA',
  surface: '#FFFFFF',
  surfaceAlt: '#EFE7DC',
  ink: '#1C1714',
  inkSoft: '#6E625A',
  line: '#E4DACD',
  espresso: '#3B2618',
  roast: '#7A5236',
  peach: '#F4A672',
  ember: '#E8692C',
  sage: '#8DB37E',
  danger: '#D64545',
  white: '#FFFFFF',
} as const;
```

```ts
// src/lib/haptics.ts
import * as Haptics from 'expo-haptics';

// expo-haptics 57 has a web implementation (navigator.vibrate / iOS-Safari switch trick),
// so no Platform guard is needed. Never await these — fire and forget.
const noop = () => {};

export const haptic = {
  /** selection, size circles, chips, qty stepper */
  light: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(noop);
  },
  /** add to cart */
  medium: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(noop);
  },
  selection: () => {
    Haptics.selectionAsync().catch(noop);
  },
  /** order placed, payment success */
  success: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(noop);
  },
  /** payment failure, invalid OTP, required group missing */
  error: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(noop);
  },
} as const;

export type HapticKind = keyof typeof haptic;
```

Root layout: `GestureHandlerRootView` → `FlyToCartProvider` (its overlay renders *after* `<Stack/>`). The detail route uses `animation: 'fade'` for recipe 4.

```tsx
// src/app/_layout.tsx
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FlyToCartProvider } from '@/components/motion/FlyToCart';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* Provider renders its overlay AFTER <Stack/> -> flights draw above pushed screens */}
        <FlyToCartProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            {/* fade: on native the old screen stays visible under the FLIP'd hero (see recipe 4).
                animationDuration is iOS-only; web has no stack transition at all (gotcha 16). */}
            <Stack.Screen name="product/[id]" options={{ animation: 'fade', animationDuration: 280 }} />
          </Stack>
        </FlyToCartProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

---

## 1. PressableScale: spring to 0.97 with optional haptic

**When to use:** every card, pill and circle button. It is built on RN `Pressable`, so you keep accessibility, keyboard and focus on web, and correct scroll cancellation for free. For a press that must stay smooth while the JS thread is busy (inside a carousel, during a fetch), use the Gesture Handler variant below it.

```tsx
// src/components/motion/PressableScale.tsx
import type { GestureResponderEvent, PressableProps, StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { haptic, type HapticKind } from '@/lib/haptics';
import { easeOutQuint, spring } from '@/theme/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Target scale while pressed. DESIGN §7: 0.97 */
  scaleTo?: number;
  /** Fire a haptic on press-in. */
  haptic?: HapticKind | false;
  /** Fade in a deeper shadow while pressed. Pass the element's radius so the shadow matches. */
  pressShadowRadius?: number;
};

export function PressableScale({
  scaleTo = 0.97,
  haptic: hapticKind = false,
  pressShadowRadius,
  onPressIn,
  onPressOut,
  disabled,
  style,
  children,
  ...rest
}: PressableScaleProps) {
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    const p = pressed.get();
    // Reduce Motion: no scaling, a quick dim instead (DESIGN §7 "swap to quick cross-fades").
    if (reduceMotion) return { opacity: 1 - 0.18 * p };
    return { transform: [{ scale: 1 - (1 - scaleTo) * p }] };
  });

  const shadowStyle = useAnimatedStyle(() => ({ opacity: pressed.get() }));

  const handlePressIn = (e: GestureResponderEvent) => {
    pressed.set(
      reduceMotion
        ? withTiming(1, { duration: 90, easing: easeOutQuint, reduceMotion: ReduceMotion.Never })
        : withSpring(1, spring.snappy),
    );
    if (hapticKind) haptic[hapticKind]();
    onPressIn?.(e);
  };

  const handlePressOut = (e: GestureResponderEvent) => {
    // Release with the same snappy spring -> natural overshoot past 1.0
    pressed.set(
      reduceMotion
        ? withTiming(0, { duration: 140, easing: easeOutQuint, reduceMotion: ReduceMotion.Never })
        : withSpring(0, spring.snappy),
    );
    onPressOut?.(e);
  };

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
    >
      {(state) => (
        <>
          {pressShadowRadius !== undefined && (
            <Animated.View
              style={[styles.shadow, { borderRadius: pressShadowRadius }, shadowStyle]}
            />
          )}
          {typeof children === 'function' ? children(state) : children}
        </>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  // boxShadow is supported on iOS/Android (New Architecture) and web.
  // Opacity of a pre-rendered shadow layer is far cheaper than animating shadow props.
  shadow: {
    ...StyleSheet.absoluteFill,
    pointerEvents: 'none',
    boxShadow: '0px 12px 28px rgba(59, 38, 24, 0.18)',
  },
});
```

**Gesture Handler 2.32 variant (callbacks run on the UI thread):**

```tsx
// src/components/motion/TapScale.tsx — 100% UI-thread variant (gesture-handler 2.32 Gesture API)
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { haptic } from '@/lib/haptics';
import { spring } from '@/theme/motion';

type TapScaleProps = {
  onPress: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel: string;
};

export function TapScale({ onPress, children, style, accessibilityLabel }: TapScaleProps) {
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);
  const pressHaptic = () => haptic.light();

  // The worklets Babel plugin auto-workletizes callbacks chained on Gesture.* builders,
  // so they run on the UI thread and the press-in scale never waits for a busy JS thread.
  const tap = Gesture.Tap()
    .maxDuration(10_000) // allow long holds; the default (500ms) would cancel the press
    .onBegin(() => {
      pressed.set(withSpring(1, spring.snappy));
      scheduleOnRN(pressHaptic);
    })
    .onEnd((_e, success) => {
      if (success) scheduleOnRN(onPress);
    })
    .onFinalize(() => {
      pressed.set(withSpring(0, spring.snappy));
    });

  const animatedStyle = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: 1 - 0.18 * pressed.get() }
      : { transform: [{ scale: 1 - 0.03 * pressed.get() }] },
  );

  return (
    // web: touchAction defaults to 'none' (blocks page scroll on touch screens) -> allow vertical pan
    <GestureDetector gesture={tap} touchAction="pan-y">
      <Animated.View
        accessible
        role="button"
        aria-label={accessibilityLabel}
        // Screen readers activate via an accessibility action, not a touch the Tap gesture sees.
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'activate') onPress();
        }}
        style={[style, animatedStyle]}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
```

**Notes**
- The press-in animation runs on the UI thread in both versions. In `PressableScale`, only the *trigger* passes through JS, which is usually under a frame.
- Under Reduce Motion the button dims to 0.82 opacity instead of scaling, using a `ReduceMotion.Never` timing so the cue is still visible.
- The "deeper shadow" is a pre-rendered `boxShadow` layer whose opacity is animated. This is far cheaper than animating shadow props, and `boxShadow` works on iOS, Android (New Architecture) and web.

---

## 2. RollingNumber: odometer price text

**When to use:** prices on the action bar, cart totals, quantity steppers, and the order number counting up. Pass `stagger={60}` for the "counting up" feel on the confirmation screen.

```tsx
// src/components/motion/RollingNumber.tsx
import { useEffect } from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LayoutAnimationConfig,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { spring } from '@/theme/motion';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
/** `smooth` slide when the number gains or loses a column (springify is ignored on web -> linear 300ms). */
const columnLayout = LinearTransition.springify().mass(1).damping(22).stiffness(180);

export type RollingNumberProps = {
  value: number;
  /** e.g. "$" */
  prefix?: string;
  suffix?: string;
  /** fixed decimals, e.g. 2 -> "5.40" */
  decimals?: number;
  /** thousands separator; pass '' to disable */
  separator?: string;
  /** Text style. fontSize + lineHeight drive the digit cell height. */
  style?: StyleProp<TextStyle>;
  /** Override the digit cell height (defaults to lineHeight ?? fontSize * 1.2). */
  digitHeight?: number;
  /** ms between columns, right-most column first (0 = all together). */
  stagger?: number;
};

export function formatNumber(value: number, decimals: number, separator: string) {
  const [int, frac] = Math.abs(value).toFixed(decimals).split('.');
  const grouped = separator ? int.replace(/\B(?=(\d{3})+(?!\d))/g, separator) : int;
  return `${value < 0 ? '-' : ''}${grouped}${frac ? `.${frac}` : ''}`;
}

const isDigit = (ch: string) => ch >= '0' && ch <= '9';

export function RollingNumber({
  value,
  prefix = '',
  suffix = '',
  decimals = 2,
  separator = ',',
  style,
  digitHeight,
  stagger = 0,
}: RollingNumberProps) {
  const flat = StyleSheet.flatten(style) ?? {};
  const height = digitHeight ?? flat.lineHeight ?? Math.round((flat.fontSize ?? 16) * 1.2);
  const cellStyle = [style, styles.cell, { height, lineHeight: height }];

  const body = formatNumber(value, decimals, separator);
  const label = `${prefix}${body}${suffix}`;
  const chars = body.split('');

  return (
    // skipEntering: no fade-in when the number first mounts. Columns added later still fade in.
    <LayoutAnimationConfig skipEntering>
      {/* One accessible label for the whole number; the rolling columns are hidden from a11y. */}
      <View accessible aria-label={label} style={styles.row}>
        {/* prefix/suffix sit OUTSIDE the right-keyed run, so they never re-key and flicker */}
        {prefix ? (
          <Animated.View layout={columnLayout} aria-hidden>
            <Text style={cellStyle}>{prefix}</Text>
          </Animated.View>
        ) : null}
        {chars.map((ch, i) => {
          // Key from the RIGHT so "9.99" -> "10.99" keeps the cents columns mounted
          // and only the new leading column enters.
          const fromRight = chars.length - i;
          const digit = isDigit(ch);
          return (
            <Animated.View
              key={`${fromRight}-${digit ? 'd' : ch}`}
              entering={FadeIn.duration(160)}
              exiting={FadeOut.duration(120)}
              layout={columnLayout}
              aria-hidden
            >
              {digit ? (
                <DigitColumn
                  digit={Number(ch)}
                  height={height}
                  cellStyle={cellStyle}
                  delay={stagger * (fromRight - 1)}
                />
              ) : (
                <Text style={cellStyle}>{ch}</Text>
              )}
            </Animated.View>
          );
        })}
        {suffix ? (
          <Animated.View layout={columnLayout} aria-hidden>
            <Text style={cellStyle}>{suffix}</Text>
          </Animated.View>
        ) : null}
      </View>
    </LayoutAnimationConfig>
  );
}

type DigitColumnProps = {
  digit: number;
  height: number;
  cellStyle: StyleProp<TextStyle>;
  delay: number;
};

function DigitColumn({ digit, height, cellStyle, delay }: DigitColumnProps) {
  // Initialise at the current digit: no roll on first mount.
  const y = useSharedValue(-digit * height);

  useEffect(() => {
    // Reduce Motion: withSpring defaults to ReduceMotion.System -> jumps straight to the value.
    y.set(withDelay(delay, withSpring(-digit * height, spring.smooth)));
  }, [digit, height, delay, y]);

  const reelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));

  return (
    <View style={{ height, overflow: 'hidden' }}>
      <Animated.View style={reelStyle}>
        {DIGITS.map((d) => (
          <Text key={d} style={cellStyle}>
            {d}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  cell: {
    textAlign: 'center',
    includeFontPadding: false, // Android: keeps glyphs vertically centred in the cell
    fontVariant: ['tabular-nums'],
  },
});
```

**Usage**

```tsx
<RollingNumber value={total} prefix="$" style={{ fontSize: 34, lineHeight: 40, fontWeight: '700' }} />
<RollingNumber value={qty} decimals={0} style={styles.qty} />
<RollingNumber value={4821} prefix="#" decimals={0} separator="" stagger={60} style={styles.orderNo} />
```

**Notes**
- Each column is a 10-digit reel (0–9) inside an `overflow: hidden` cell of fixed height. Only `translateY` animates. Digit columns are keyed **from the right**, so `9.99 → 10.99` keeps the cents reels mounted and only the new leading column fades in, while `LinearTransition` slides the others over. The prefix and suffix are rendered outside the keyed run. Otherwise `$9.99 → $10.99` would re-key the `$` and make it flicker.
- `LayoutAnimationConfig skipEntering` skips the entering fade only when the row first mounts. Columns that appear later still fade in. This works on web too.
- Always give the style a `lineHeight`. It defines the cell height.
- Reduce Motion: `withSpring` resolves instantly, so the digits swap with no roll.
- Accessibility: a single `aria-label` (e.g. "$5.40") on the row, and every reel is `aria-hidden`.

---

## 3. Fly-to-cart: quadratic bezier arc, overlay host, badge pop

**When to use:** "Add to cart" on product detail, and the quick-add "+" on grid cards. The provider owns one overlay above the navigator. A `CartButton` registers itself as the target **while its screen is focused** (`useFocusEffect`), and the most recently focused one wins. So the detail screen's cart beats the Home header's, and a cart in a hidden but still-mounted tab is never targeted.

```tsx
// src/components/motion/FlyToCart.tsx
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { createContext, use, useCallback, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  measure,
  useAnimatedRef,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type AnimatedRef,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { haptic } from '@/lib/haptics';
import { colors, duration, easeInOutCubic, spring } from '@/theme/motion';

type Rect = { x: number; y: number; w: number; h: number };
type Flight = { id: number; uri: string };
type FlyOptions = { arcHeight?: number; onLand?: () => void };

type FlyToCartContextValue = {
  /** Call from an "Add to cart" handler. `sourceRef` = the product image to copy. */
  fly: (sourceRef: AnimatedRef<Animated.View>, uri: string, options?: FlyOptions) => void;
  /** CartButton registers its icon here (latest mounted = active target). */
  registerTarget: (ref: AnimatedRef<Animated.View>) => () => void;
  badgeScale: SharedValue<number>;
};

const FlyToCartContext = createContext<FlyToCartContextValue | null>(null);

export function useFlyToCart() {
  const ctx = use(FlyToCartContext);
  if (!ctx) throw new Error('useFlyToCart must be used inside <FlyToCartProvider>');
  return ctx;
}

const THUMB = 72; // the flying copy is always rendered at 72px and scaled -> constant layout cost
const EMPTY: Rect = { x: 0, y: 0, w: 0, h: 0 };

export function FlyToCartProvider({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const hostRef = useAnimatedRef<Animated.View>();
  const targets = useRef<AnimatedRef<Animated.View>[]>([]);
  const badgeScale = useSharedValue(1);
  const progress = useSharedValue(0);
  const from = useSharedValue<Rect>(EMPTY);
  const to = useSharedValue<Rect>(EMPTY);
  const arc = useSharedValue(90);
  const flightId = useRef(0);
  const [flight, setFlight] = useState<Flight | null>(null);

  const registerTarget = (ref: AnimatedRef<Animated.View>) => {
    targets.current = [...targets.current, ref];
    return () => {
      targets.current = targets.current.filter((r) => r !== ref);
    };
  };

  const fly = (sourceRef: AnimatedRef<Animated.View>, uri: string, options: FlyOptions = {}) => {
    const targetRef = targets.current[targets.current.length - 1];
    const id = ++flightId.current;
    // ALWAYS commits the cart change, even when a newer flight interrupted this one
    // (otherwise a fast double-tap silently drops an item). Only a real landing buzzes.
    const land = (landed: boolean) => {
      if (landed) haptic.medium();
      setFlight((f) => (f?.id === id ? null : f)); // never unmount a newer flight's thumb
      options.onLand?.();
    };

    if (!targetRef || reduceMotion) {
      // Reduce Motion: no flight, just the haptic + count update.
      land(true);
      return;
    }

    arc.set(options.arcHeight ?? 90);
    setFlight({ id, uri });

    scheduleOnUI(() => {
      'worklet';
      // measure() runs on the UI thread (native) / getBoundingClientRect (web).
      const host = measure(hostRef);
      const src = measure(sourceRef);
      const dst = measure(targetRef);
      if (!host || !src || !dst) {
        scheduleOnRN(land, true);
        return;
      }
      // Convert window coordinates into the overlay's own coordinate space.
      from.set({ x: src.pageX - host.pageX, y: src.pageY - host.pageY, w: src.width, h: src.height });
      to.set({ x: dst.pageX - host.pageX, y: dst.pageY - host.pageY, w: dst.width, h: dst.height });
      progress.set(0); // cancels a running flight -> its callback fires with finished === false
      progress.set(
        withTiming(1, { duration: duration.flight, easing: easeInOutCubic }, (finished) => {
          if (finished) {
            badgeScale.set(withSequence(withSpring(1.35, spring.snappy), withSpring(1, spring.snappy)));
          }
          scheduleOnRN(land, finished === true);
        }),
      );
    });
  };

  return (
    <FlyToCartContext value={{ fly, registerTarget, badgeScale }}>
      {children}
      {/* Overlay host: last child of the root => drawn above the (non-modal) stack */}
      <Animated.View ref={hostRef} collapsable={false} style={styles.overlay}>
        {flight && (
          <FlyingThumb key={flight.id} uri={flight.uri} progress={progress} from={from} to={to} arc={arc} />
        )}
      </Animated.View>
    </FlyToCartContext>
  );
}

type FlyingThumbProps = {
  uri: string;
  progress: SharedValue<number>;
  from: SharedValue<Rect>;
  to: SharedValue<Rect>;
  arc: SharedValue<number>;
};

function FlyingThumb({ uri, progress, from, to, arc }: FlyingThumbProps) {
  const style = useAnimatedStyle(() => {
    const t = progress.get();
    const a = from.get();
    const b = to.get();
    // P0 = source centre, P2 = cart centre, P1 = control point lifted above both.
    const x0 = a.x + a.w / 2;
    const y0 = a.y + a.h / 2;
    const x2 = b.x + b.w / 2;
    const y2 = b.y + b.h / 2;
    const x1 = (x0 + x2) / 2;
    const y1 = Math.max(Math.min(y0, y2) - arc.get(), 0); // keep the apex on screen for top-bar carts
    // Quadratic bezier: B(t) = (1-t)^2 P0 + 2(1-t)t P1 + t^2 P2
    const u = 1 - t;
    const x = u * u * x0 + 2 * u * t * x1 + t * t * x2;
    const y = u * u * y0 + 2 * u * t * y1 + t * t * y2;

    const startScale = Math.max(a.w, 1) / THUMB;
    const endScale = (Math.max(b.w, 24) * 0.55) / THUMB;
    return {
      opacity: a.w === 0 ? 0 : interpolate(t, [0, 0.04, 0.85, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: x - THUMB / 2 },
        { translateY: y - THUMB / 2 },
        { scale: interpolate(t, [0, 0.2, 1], [startScale, startScale * 1.06, endScale]) },
        { rotate: `${-18 * t}deg` },
      ],
    };
  });

  return (
    <Animated.View style={[styles.thumb, style]}>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
    </Animated.View>
  );
}

/** Cart icon + count badge. Registers itself as the flight target while its screen is focused. */
export function CartButton({ count, icon }: { count: number; icon: ReactNode }) {
  const { registerTarget, badgeScale } = useFlyToCart();
  const ref = useAnimatedRef<Animated.View>();

  // Focus, not mount: js-tabs keep visited tabs mounted and the stack keeps Home under the
  // detail screen, so "last mounted" alone could aim at a hidden cart. The cleanup runs on
  // blur and on unmount. Must be rendered inside a navigator screen.
  useFocusEffect(useCallback(() => registerTarget(ref), [registerTarget, ref]));

  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: badgeScale.get() }] }));

  return (
    <Animated.View ref={ref} collapsable={false} style={styles.cart}>
      {icon}
      {count > 0 && (
        <Animated.View style={[styles.badge, badgeStyle]}>
          <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, pointerEvents: 'none' },
  thumb: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  cart: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: '700' },
});
```

**Usage (product detail)**

```tsx
const { fly } = useFlyToCart();
const add = useCart((s) => s.add);
const imageRef = useAnimatedRef<Animated.View>();
// …
<Animated.View ref={imageRef} collapsable={false}>
  <Image source={{ uri: product.image }} style={StyleSheet.absoluteFill} />
</Animated.View>
// …
{/* no haptic prop: the medium haptic fires on landing (FlyToCart), in sync with the badge pop */}
<PressableScale onPress={() => fly(imageRef, product.image, { onLand: add })}>…</PressableScale>
// header:
<CartButton count={count} icon={<Ionicons name="bag-outline" size={22} color={colors.ink} />} />
```

**Notes**
- All three rects (overlay host, source, target) are measured **in one UI-thread worklet** and converted into the host's coordinates. The progress spring starts in that same frame, so there is no JS round trip and no flash at (0,0).
- Path: `B(t) = (1−t)²P0 + 2(1−t)t·P1 + t²P2`. P1 sits above both points (`arcHeight`, default 90) and is clamped to stay on screen. Progress uses a *timing* curve on purpose: a spring would overshoot past the cart, beyond `t = 1`.
- The flying copy is always a 72px view that is *scaled*, so the layout cost stays constant. The badge pop (1 → 1.35 → 1) starts from the animation callback on the UI thread. The haptic and `onLand` (count++) go back to JS through `scheduleOnRN`.
- **Interruptions:** a second tap mid-flight restarts `progress`, and the first flight's callback then gets `finished === false`. Its `onLand` still runs, so no item is lost. It skips the pop and the haptic, and the id guard keeps it from unmounting the new thumbnail. Fire the medium haptic in **one** place only. Here that is the landing, so don't also pass `haptic="medium"` to the button.
- The overlay draws above **push** screens. Native **modals and form sheets** are separate native windows, so if the product detail is presented as a modal, put a second `FlyToCartProvider` inside that modal.
- Reduce Motion: no flight. The haptic and count update still happen.
- "Added ✓" bar morph: in `onLand`, set `added = true` (render the ✓ label with `entering={FadeIn}` / `exiting={FadeOut}`). Revert it from an animation callback, not a `setTimeout`. For example: `addedT.set(withDelay(1200, withTiming(0, { duration: 1 }, (f) => { if (f) scheduleOnRN(setAdded, false); })))`.

---

## 4. Card → detail "shared element" (manual FLIP)

**When to use:** product card → product detail hero. Reanimated's `sharedTransitionTag` can't be enabled in Expo Go (gotcha 4), so this recipe uses FLIP. The detail renders the hero at its **final** layout. On first layout it measures that rect, inverts it to the stored card rect (translate, scale, radius), and springs back to identity. On iOS and Android, `animation: 'fade'` on the route keeps the old screen visible underneath, which gives the "floating copy, then cross-fade to the real screen" effect. A fade also never translates the new screen, so the measured rect really is the final one. On web there is no stack transition (gotcha 16): the card screen is hidden at once, and the hero flies over the detail screen's own background.

```ts
// src/store/heroTransition.ts
import { create } from 'zustand';

export type WindowRect = { x: number; y: number; width: number; height: number; radius: number };

type HeroTransitionState = {
  pending: Record<string, WindowRect>;
  setSource: (id: string, rect: WindowRect) => void;
  /** Read once and clear, so a later deep-link / refresh doesn't replay the flight. */
  takeSource: (id: string) => WindowRect | undefined;
};

export const useHeroTransition = create<HeroTransitionState>()((set, get) => ({
  pending: {},
  setSource: (id, rect) => set((s) => ({ pending: { ...s.pending, [id]: rect } })),
  takeSource: (id) => {
    const rect = get().pending[id];
    if (rect) {
      set((s) => {
        const { [id]: _taken, ...rest } = s.pending;
        return { pending: rest };
      });
    }
    return rect;
  },
}));
```

```tsx
// src/components/motion/SharedHero.tsx
import { useRef, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  measure,
  ReduceMotion,
  useAnimatedRef,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { runOnUIAsync, scheduleOnUI } from 'react-native-worklets';

import { useHeroTransition } from '@/store/heroTransition';
import { easeOutQuint, spring } from '@/theme/motion';

/**
 * SOURCE side (product card). Attach `ref` to the card's image wrapper and
 * `await capture()` right before router.push().
 */
export function useHeroSource(id: string, radius = 16) {
  const ref = useAnimatedRef<Animated.View>();

  const capture = async () => {
    // runOnUIAsync works on native AND web (runOnUISync throws on web).
    const m = await runOnUIAsync(() => {
      'worklet';
      return measure(ref);
    });
    if (m) {
      useHeroTransition
        .getState()
        .setSource(id, { x: m.pageX, y: m.pageY, width: m.width, height: m.height, radius });
    }
  };

  return { ref, capture };
}

type HeroFromRectProps = {
  id: string;
  /** final (detail screen) size of the square hero image */
  size: number;
  /** final corner radius; default = circle */
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * TARGET side (detail screen). Renders the hero at its FINAL layout, then FLIPs:
 * measure final rect -> invert to the stored source rect -> spring back to identity.
 */
export function HeroFromRect({ id, size, radius: radiusProp, style, children }: HeroFromRectProps) {
  const radius = radiusProp ?? size / 2; // (a computed default param makes React Compiler bail out)
  const reduceMotion = useReducedMotion();
  const ref = useAnimatedRef<Animated.View>();
  const started = useRef(false);
  const progress = useSharedValue(1);
  const visible = useSharedValue(0);
  const delta = useSharedValue({ dx: 0, dy: 0, scale: 1, fromRadius: radius });

  const handleLayout = () => {
    if (started.current) return;
    started.current = true;

    const src = useHeroTransition.getState().takeSource(id);
    if (!src || reduceMotion) {
      // Deep link / refresh / Reduce Motion -> plain quick fade.
      visible.set(withTiming(1, { duration: 220, easing: easeOutQuint, reduceMotion: ReduceMotion.Never }));
      return;
    }

    scheduleOnUI(() => {
      'worklet';
      const dst = measure(ref); // transform is still identity here -> true final rect
      if (!dst) {
        visible.set(1);
        return;
      }
      const scale = src.width / dst.width;
      delta.set({
        dx: src.x + src.width / 2 - (dst.pageX + dst.width / 2),
        dy: src.y + src.height / 2 - (dst.pageY + dst.height / 2),
        scale,
        fromRadius: src.radius / scale, // visual radius = radius * scale
      });
      progress.set(0);
      visible.set(1);
      progress.set(withSpring(1, spring.gentle));
    });
  };

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.get();
    const d = delta.get();
    return {
      opacity: visible.get(),
      borderRadius: d.fromRadius + (radius - d.fromRadius) * p,
      transform: [
        { translateX: d.dx * (1 - p) },
        { translateY: d.dy * (1 - p) },
        { scale: d.scale + (1 - d.scale) * p },
      ],
    };
  });

  return (
    <Animated.View
      ref={ref}
      collapsable={false}
      onLayout={handleLayout}
      style={[{ width: size, height: size, overflow: 'hidden' }, style, animatedStyle]}
    >
      {children}
    </Animated.View>
  );
}
```

**Source: product card**

```tsx
// src/components/ProductCard.tsx  (recipe 4 — source side)
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { PressableScale } from '@/components/motion/PressableScale';
import { useHeroSource } from '@/components/motion/SharedHero';
import type { Product } from '@/types/models';
import { staggerIn } from '@/lib/stagger';
import { colors } from '@/theme/motion';

export function ProductCard({ product, index }: { product: Product; index: number }) {
  const { ref, capture } = useHeroSource(product.id, 16);

  const open = async () => {
    await capture(); // ~1 frame: measure on the UI thread, store the window rect
    router.push({ pathname: '/product/[id]', params: { id: product.id } });
  };

  return (
    <Animated.View entering={staggerIn(index)} style={styles.cell}>
      <PressableScale onPress={open} pressShadowRadius={20} style={styles.card} aria-label={product.name}>
        <Animated.View ref={ref} collapsable={false} style={styles.tile}>
          <Image source={{ uri: product.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        </Animated.View>
        <View style={styles.meta}>
          <Text numberOfLines={2} style={styles.name}>{product.name}</Text>
          <Text style={styles.price}>${product.price.toFixed(2)}</Text>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cell: { width: '50%', padding: 8 },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 10 },
  tile: { aspectRatio: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  meta: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, marginTop: 10 },
  name: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.ink },
  price: { fontSize: 14, fontWeight: '700', color: colors.ink },
});
```

**Target: detail screen**

```tsx
<HeroFromRect id={product.id} size={240}>
  <Image source={{ uri: product.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
</HeroFromRect>
```

**Notes**
- A `runOnUIAsync` + `measure` round trip takes about one frame before `router.push`. `takeSource()` consumes the rect, so deep links and refreshes fall back to a plain fade.
- Uniform scale keeps square image tiles undistorted. The visual radius is `radius × scale`, so the radius animates from `16/scale` to `size/2`.
- After the hero lands, let the sheet spring up and its contents stagger in: `entering={FadeInDown.delay(180).springify()…}` on the sheet, plus `riseIn(i)` (recipe 15) on its children.
- Reverse on back is optional. Run the same FLIP backwards from a `beforeRemove` listener if you want it.

---

## 5. Floating tab bar: stretching pill, icon cross-fade, blur

**When to use:** the 5-tab bottom navigation (Home · Menu · Orders · Rewards · Profile). The tab bar sits in `src/app/(tabs)/_layout.tsx`.

```tsx
// src/components/motion/FloatingTabBar.tsx
import { BlurView } from 'expo-blur';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useRef, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  clamp,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';
import { colors } from '@/theme/motion';

type TabLayout = { x: number; w: number };

export const TAB_BAR_HEIGHT = 64;
const ICON = 22;
// Leading edge uses the fast spring, trailing edge the slow one -> the pill stretches, then catches up.
const FAST = { mass: 1, damping: 26, stiffness: 340 } as const;
const SLOW = { mass: 1, damping: 22, stiffness: 150 } as const;
const tabLayoutTransition = LinearTransition.springify().mass(1).damping(22).stiffness(180);

export function FloatingTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const layoutsRef = useRef<TabLayout[]>([]);
  const layouts = useSharedValue<TabLayout[]>([]);
  const active = useSharedValue(state.index);
  const left = useSharedValue(0);
  const right = useSharedValue(0);

  useEffect(() => {
    active.set(state.index);
  }, [state.index, active]);

  // Re-targets on index change AND on every layout change (the active tab grows when its label mounts).
  useAnimatedReaction(
    () => layouts.get()[active.get()] ?? null,
    (cur, prev) => {
      if (!cur) return;
      if (!prev || right.get() === 0) {
        left.set(cur.x);
        right.set(cur.x + cur.w);
        return;
      }
      const movingRight = cur.x + cur.w / 2 >= prev.x + prev.w / 2;
      left.set(withSpring(cur.x, movingRight ? SLOW : FAST));
      right.set(withSpring(cur.x + cur.w, movingRight ? FAST : SLOW));
    },
  );

  const pillStyle = useAnimatedStyle(() => ({
    opacity: right.get() === 0 ? 0 : 1,
    width: Math.max(right.get() - left.get(), 0),
    transform: [{ translateX: left.get() }],
  }));

  const onTabLayout = (index: number, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    const next = layoutsRef.current.slice();
    next[index] = { x, w: width };
    layoutsRef.current = next;
    layouts.set(next);
  };

  return (
    <View style={[styles.wrapper, { bottom: Math.max(insets.bottom, 12) + 4 }]}>
      <View style={styles.bar}>
        {/* iOS + web: real blur. Android: blur needs a BlurTargetView around the scenes, so we
            fall back to the semi-opaque fill (blurMethod defaults to 'none'). */}
        <BlurView tint="light" intensity={50} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.fill]} />

        <View role="tablist" style={styles.row}>
          <Animated.View style={[styles.pill, pillStyle]} />
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const focused = state.index === index;
            const label =
              typeof options.tabBarLabel === 'string' ? options.tabBarLabel : (options.title ?? route.name);

            const onPress = () => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                haptic.light();
                navigation.navigate(route.name, route.params);
              }
            };

            return (
              <Animated.View
                key={route.key}
                layout={tabLayoutTransition}
                onLayout={(e) => onTabLayout(index, e)}
              >
                <Pressable
                  role="tab"
                  aria-selected={focused}
                  aria-label={options.tabBarAccessibilityLabel ?? label}
                  onPress={onPress}
                  onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
                  style={[styles.tab, focused && styles.tabFocused]}
                >
                  <TabIcon
                    index={index}
                    layouts={layouts}
                    left={left}
                    right={right}
                    renderIcon={(color) => options.tabBarIcon?.({ focused, color, size: ICON })}
                  />
                  {focused && (
                    <Animated.View entering={FadeIn.delay(80).duration(180)} exiting={FadeOut.duration(90)}>
                      <Text numberOfLines={1} style={styles.label}>
                        {label}
                      </Text>
                    </Animated.View>
                  )}
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

type TabIconProps = {
  index: number;
  layouts: SharedValue<TabLayout[]>;
  left: SharedValue<number>;
  right: SharedValue<number>;
  renderIcon: (color: string) => ReactNode;
};

/** Ink icon + white icon stacked; cross-fade by how much of this tab the pill covers. */
function TabIcon({ index, layouts, left, right, renderIcon }: TabIconProps) {
  const coverage = useDerivedValue(() => {
    const l = layouts.get()[index];
    if (!l || l.w === 0) return 0;
    const overlap = Math.min(right.get(), l.x + l.w) - Math.max(left.get(), l.x);
    return clamp(overlap / Math.min(l.w, 48), 0, 1);
  });
  const inkStyle = useAnimatedStyle(() => ({ opacity: 1 - coverage.get() }));
  const whiteStyle = useAnimatedStyle(() => ({ opacity: coverage.get() }));

  return (
    <View style={styles.iconBox}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, inkStyle]}>{renderIcon(colors.ink)}</Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, whiteStyle]}>
        {renderIcon(colors.white)}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 999,
    boxShadow: '0px 8px 24px rgba(59, 38, 24, 0.12)',
  },
  bar: { height: TAB_BAR_HEIGHT, borderRadius: 999, overflow: 'hidden' },
  fill: {
    backgroundColor: Platform.select({ android: 'rgba(255,255,255,0.96)', default: 'rgba(255,255,255,0.62)' }),
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  pill: {
    position: 'absolute',
    left: 0,
    top: 8,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.ink,
  },
  tab: { height: 48, minWidth: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  tabFocused: { paddingLeft: 14, paddingRight: 18, gap: 8 },
  iconBox: { width: ICON, height: ICON },
  center: { alignItems: 'center', justifyContent: 'center' },
  label: { color: colors.white, fontSize: 14, fontWeight: '600' },
});
```

```tsx
// src/app/(tabs)/_layout.tsx
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';

import { FloatingTabBar } from '@/components/motion/FloatingTabBar';

type IconName = keyof typeof Ionicons.glyphMap;
const icon = (name: IconName) =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color} size={size} />;
  };

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <FloatingTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="menu" options={{ title: 'Menu', tabBarIcon: icon('cafe') }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders', tabBarIcon: icon('receipt') }} />
      <Tabs.Screen name="rewards" options={{ title: 'Rewards', tabBarIcon: icon('gift') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person') }} />
    </Tabs>
  );
}
```

**Notes**
- **Stretch:** the pill's two edges are separate springs. The leading edge is stiff (340) and the trailing edge is soft (150), so the pill stretches toward the new tab and then catches up. `useAnimatedReaction` re-targets the springs on index change *and* when a tab's layout changes (the active tab grows once its label mounts, and `LinearTransition` animates that).
- **Cross-fade:** each icon is drawn twice (ink and white). Its white opacity is the pill's *overlap* with that tab, so icons turn white exactly as the pill passes under them.
- The bar is absolutely positioned. Give scrollable screens `paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24`.
- Android blur: see gotcha 8. Real blur needs `BlurTargetView` to wrap the tab *scenes*, which `js-tabs` doesn't expose, so Android uses the 96% white fill.

---

## 6. Size selector: one sliding indicator for S / M / L

**When to use:** size circles, and any single-select row of equal-width options.

```tsx
// src/components/motion/SizeSelector.tsx
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  clamp,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { PressableScale } from '@/components/motion/PressableScale';
import { haptic } from '@/lib/haptics';
import { colors, spring } from '@/theme/motion';

const D = 56; // DESIGN: 56px circles
const GAP = 28;
export const SIZE_HERO_SCALE = [0.9, 1, 1.08] as const; // S / M / L hero scale (DESIGN §7)

type Option = { label: string; delta?: string };

type SizeSelectorProps = {
  options: readonly Option[];
  value: number | null;
  onChange: (index: number) => void;
};

export function SizeSelector({ options, value, onChange }: SizeSelectorProps) {
  const pos = useSharedValue(value ?? 0);
  const target = useSharedValue(value ?? 0);
  const shown = useSharedValue(value === null ? 0 : 1);

  useEffect(() => {
    if (value === null) return;
    target.set(value);
    if (shown.get() === 0) {
      pos.set(value); // first selection: pop in place, don't slide in from S
      shown.set(withSpring(1, spring.snappy));
    } else {
      // `smooth`, not `snappy`: snappy overshoots ~20px past the outer circles on an S<->L jump
      pos.set(withSpring(value, spring.smooth));
    }
  }, [value, pos, target, shown]);

  const indicatorStyle = useAnimatedStyle(() => {
    const p = pos.get();
    // Stretch while far from the target, relax as it lands (max +16%).
    const stretch = 1 + 0.16 * Math.min(Math.abs(target.get() - p), 1);
    const s = shown.get();
    return {
      opacity: Math.min(s, 1),
      transform: [{ translateX: p * (D + GAP) }, { scaleX: stretch }, { scale: 0.6 + 0.4 * s }],
    };
  });

  return (
    <View role="radiogroup" style={styles.row}>
      <Animated.View style={[styles.indicator, indicatorStyle]} />
      {options.map((opt, i) => (
        <View key={opt.label} style={styles.column}>
          <PressableScale
            role="radio"
            aria-checked={value === i}
            aria-label={`Size ${opt.label}`}
            onPress={() => {
              if (value !== i) haptic.light();
              onChange(i);
            }}
            style={styles.circle}
          >
            <SizeLabel label={opt.label} index={i} pos={pos} shown={shown} />
          </PressableScale>
          {opt.delta ? <Text style={styles.delta}>{opt.delta}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function SizeLabel({
  label,
  index,
  pos,
  shown,
}: {
  label: string;
  index: number;
  pos: SharedValue<number>;
  shown: SharedValue<number>;
}) {
  const textStyle = useAnimatedStyle(() => {
    // 1 when the ink fill sits on this circle -> text flips to white exactly as the fill passes.
    const cover = clamp(1 - Math.abs(pos.get() - index), 0, 1) * shown.get();
    return { color: interpolateColor(cover, [0, 1], [colors.ink, colors.white]) };
  });
  return <Animated.Text style={[styles.label, textStyle]}>{label}</Animated.Text>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: GAP },
  column: { width: D, alignItems: 'center', gap: 6 },
  circle: {
    width: D,
    height: D,
    borderRadius: D / 2,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: D,
    height: D,
    borderRadius: D / 2,
    backgroundColor: colors.ink,
  },
  label: { fontSize: 16, fontWeight: '600' },
  delta: { fontSize: 12, color: colors.inkSoft },
});
```

**Hero scale linked to the selected size (S 0.9 / M 1.0 / L 1.08, `smooth`):**

```tsx
const sizeScale = useSharedValue(1);
useEffect(() => {
  if (size !== null) sizeScale.set(withSpring(SIZE_HERO_SCALE[size], spring.smooth));
}, [size, sizeScale]);
const sizeScaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: sizeScale.get() }] }));
```

**Notes**
- One ink circle moves with `translateX = pos × (56 + gap)`. Each label's colour is `interpolateColor(1 − |pos − i|)`, so the text flips to white exactly where the fill is.
- Measured on web: `snappy` overshot about 20px past the outer circles on an S↔L jump, so travel uses `smooth` (overshoot ≤ 2px). The first selection pops in place instead of sliding in from S.

---

## 7. SVG line-art draw-on and floating drift

**When to use:** splash and onboarding illustrations, empty states (with `roast` strokes on cream), and the success check.

```tsx
// src/components/motion/LineArt.tsx
import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  clamp,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { getPathLength } from '@/lib/pathLength';
import { colors, duration, easeInOutCubic } from '@/theme/motion';

const AnimatedPath = Animated.createAnimatedComponent(Path);

type DrawPathProps = {
  d: string;
  /** shared 0..1 progress for the whole illustration */
  progress: SharedValue<number>;
  /** this stroke draws during [start, end] of the shared progress */
  start?: number;
  end?: number;
  stroke?: string;
  strokeWidth?: number;
};

/** One stroke that draws itself via strokeDashoffset. */
export function DrawPath({ d, progress, start = 0, end = 1, stroke = colors.peach, strokeWidth = 1.75 }: DrawPathProps) {
  const length = getPathLength(d) + 1; // +1 hides sampling error -> no gap at the end

  const animatedProps = useAnimatedProps(() => {
    const local = clamp((progress.get() - start) / (end - start), 0, 1);
    return { strokeDashoffset: length * (1 - local) };
  });

  return (
    <AnimatedPath
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={[length, length]}
      animatedProps={animatedProps}
    />
  );
}

/** Self-drawing + gently floating illustration wrapper (Splash / Onboarding / empty states). */
export function useDrawAndFloat({ delay = 0, floatPhase = 0 }: { delay?: number; floatPhase?: number } = {}) {
  const reduceMotion = useReducedMotion();
  const draw = useSharedValue(reduceMotion ? 1 : 0);
  const float = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return; // fully drawn, no drift (DESIGN §7)
    draw.set(
      withDelay(
        delay,
        withTiming(1, { duration: duration.draw, easing: easeInOutCubic }, (finished) => {
          if (!finished) return;
          // start the slow float only once drawing has finished
          float.set(
            withDelay(
              floatPhase,
              withRepeat(withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.sin) }), -1, true),
            ),
          );
        }),
      ),
    );
    return () => {
      cancelAnimation(draw);
      cancelAnimation(float);
    };
  }, [reduceMotion, delay, floatPhase, draw, float]);

  const floatStyle = useAnimatedStyle(() => {
    const f = float.get();
    return { transform: [{ translateY: -6 * f }, { rotate: `${-1.5 + 3 * f}deg` }] };
  });

  return { draw, floatStyle };
}

// Line-art cup with steam (viewBox 84x80). Keep strokes 1.5–2px, peach + a little white.
const CUP = {
  body: 'M14 30 H62 V46 C62 60 52 68 38 68 C24 68 14 60 14 46 Z',
  handle: 'M62 36 C72 36 76 40 76 46 C76 52 71 56 62 55',
  saucer: 'M6 74 H70',
  steam: ['M28 24 C24 18 32 14 28 6', 'M38 24 C34 18 42 14 38 6', 'M48 24 C44 18 52 14 48 6'],
};

export function LineArtCup({
  size = 140,
  delay = 0,
  floatPhase = 0,
  style,
}: {
  size?: number;
  delay?: number;
  floatPhase?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { draw, floatStyle } = useDrawAndFloat({ delay, floatPhase });
  return (
    <Animated.View style={[style, floatStyle]}>
      <Svg width={size} height={(size * 80) / 84} viewBox="0 0 84 80">
        <DrawPath d={CUP.saucer} progress={draw} start={0} end={0.35} stroke={colors.white} />
        <DrawPath d={CUP.body} progress={draw} start={0.05} end={0.6} />
        <DrawPath d={CUP.handle} progress={draw} start={0.4} end={0.75} />
        {CUP.steam.map((d, i) => (
          <DrawPath key={d} d={d} progress={draw} start={0.6 + i * 0.1} end={0.85 + i * 0.05} stroke={colors.white} strokeWidth={1.5} />
        ))}
      </Svg>
    </Animated.View>
  );
}
```

**Notes**
- One shared `draw` progress drives every stroke. Each stroke owns a `[start, end]` window, so strokes draw in sequence without extra animations.
- `strokeDasharray = [L, L]` and `strokeDashoffset = L·(1−p)`, where `L = getPathLength(d) + 1` (Appendix A). This gives the same length on iOS, Android and web. The `+1` hides sampling error.
- The drift (`translateY` ±6, rotate ±1.5°) starts **from the draw's completion callback** on the UI thread. Reduce Motion: the art appears fully drawn and does not move.
- Animate `transform` on a wrapping `Animated.View`, not on SVG elements.

---

## 8. Dot that follows a wavy path, driven by the pager

**When to use:** the onboarding steam capsule (DESIGN §6). The same worklet function `waveY(x)` builds the SVG path in JS *and* positions the dot on the UI thread, so there is no `getPointAtLength`. A small arc-length lookup drives a peach "travelled" trail.

```tsx
// src/components/motion/SteamProgress.tsx
import { StyleSheet, View } from 'react-native';
import Animated, {
  clamp,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { colors } from '@/theme/motion';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const DOT = 14;
const PAD = DOT; // keep the dot inside the capsule at p = 0 and p = 1
const SAMPLES = 64;

type Wave = { width: number; height: number; amplitude: number; waves: number };

/** y(x) of the steam line. A worklet, so the SAME formula drives the SVG path (JS) and the dot (UI). */
export function waveY(x: number, w: Wave) {
  'worklet';
  const t = (x - PAD) / (w.width - 2 * PAD);
  return w.height / 2 + w.amplitude * Math.sin(t * w.waves * 2 * Math.PI);
}

function buildWave(w: Wave) {
  const xs: number[] = [];
  const lens: number[] = [];
  let d = '';
  let len = 0;
  let px = 0;
  let py = 0;
  for (let i = 0; i <= SAMPLES; i++) {
    const x = PAD + ((w.width - 2 * PAD) * i) / SAMPLES;
    const y = waveY(x, w);
    if (i > 0) len += Math.hypot(x - px, y - py);
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)} `;
    xs.push(x);
    lens.push(len);
    px = x;
    py = y;
  }
  return { d, xs, lens, total: len };
}

type SteamProgressProps = {
  /** 0..1, e.g. pager scrollX / (pageWidth * (pages - 1)) */
  progress: SharedValue<number>;
  width: number;
  height?: number;
  amplitude?: number;
  waves?: number;
};

export function SteamProgress({ progress, width, height = 56, amplitude = 9, waves = 2.5 }: SteamProgressProps) {
  const wave: Wave = { width, height, amplitude, waves };
  const { d, xs, lens, total } = buildWave(wave);

  const dotStyle = useAnimatedStyle(() => {
    const p = clamp(progress.get(), 0, 1);
    const x = PAD + p * (wave.width - 2 * PAD);
    const y = waveY(x, wave);
    return { transform: [{ translateX: x - DOT / 2 }, { translateY: y - DOT / 2 }] };
  });

  // Peach "travelled" trail: arc-length lookup (sine arc length is not linear in x).
  const trailProps = useAnimatedProps(() => {
    const p = clamp(progress.get(), 0, 1);
    const x = PAD + p * (wave.width - 2 * PAD);
    const travelled = interpolate(x, xs, lens);
    return { strokeDashoffset: total + 1 - travelled };
  });

  return (
    <View style={[styles.capsule, { width, height }]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Path d={d} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth={2} strokeLinecap="round" />
        <AnimatedPath
          d={d}
          fill="none"
          stroke={colors.peach}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={[total + 1, total + 1]}
          animatedProps={trailProps}
        />
      </Svg>
      <Animated.View style={[styles.dot, dotStyle]}>
        <View style={styles.halo} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  capsule: { borderRadius: 999, backgroundColor: colors.sage, overflow: 'hidden' },
  dot: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: colors.peach,
    boxShadow: '0px 0px 10px rgba(244, 166, 114, 0.95)',
  },
  halo: {
    position: 'absolute',
    left: -6,
    top: -6,
    width: DOT + 12,
    height: DOT + 12,
    borderRadius: (DOT + 12) / 2,
    backgroundColor: 'rgba(244, 166, 114, 0.25)',
  },
});
```

**The pager that drives it** (also covers text parallax at 0.6× and page dots that morph width):

```tsx
// src/components/motion/OnboardingPager.tsx
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';

import { SteamProgress } from '@/components/motion/SteamProgress';
import { colors } from '@/theme/motion';

const PAGES = [
  { title: 'Your daily ritual,', light: 'brewed for you' },
  { title: 'Order ahead,', light: 'skip the queue' },
  { title: 'Earn beans,', light: 'sip rewards' },
];

export function OnboardingPager() {
  const { width } = useWindowDimensions();
  const scrollX = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.set(e.contentOffset.x);
    },
  });

  // 0..1 across all pages -> drives the dot on the steam line
  const progress = useDerivedValue(() => scrollX.get() / Math.max(width * (PAGES.length - 1), 1));

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {PAGES.map((page, i) => (
          <Page key={page.title} index={i} width={width} scrollX={scrollX} {...page} />
        ))}
      </Animated.ScrollView>

      <View style={styles.footer}>
        <SteamProgress progress={progress} width={Math.min(width - 40, 320)} />
        <PageDots count={PAGES.length} width={width} scrollX={scrollX} />
      </View>
    </View>
  );
}

function Page({
  index,
  width,
  scrollX,
  title,
  light,
}: {
  index: number;
  width: number;
  scrollX: SharedValue<number>;
  title: string;
  light: string;
}) {
  const reduceMotion = useReducedMotion();
  // Text moves at 0.6x page speed: counter-translate 40% of the page offset.
  const textStyle = useAnimatedStyle(() => {
    const offset = scrollX.get() - index * width; // 0 when this page is centred
    if (reduceMotion) {
      return { opacity: interpolate(Math.abs(offset), [0, width * 0.5], [1, 0], Extrapolation.CLAMP) };
    }
    return {
      opacity: interpolate(Math.abs(offset), [0, width * 0.7], [1, 0], Extrapolation.CLAMP),
      transform: [{ translateX: offset * 0.4 }],
    };
  });
  return (
    <View style={[styles.page, { width }]}>
      <Animated.View style={textStyle}>
        <Text style={styles.display}>{title}</Text>
        <Text style={[styles.display, styles.light]}>{light}</Text>
      </Animated.View>
    </View>
  );
}

function PageDots({ count, width, scrollX }: { count: number; width: number; scrollX: SharedValue<number> }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: count }, (_, i) => (
        <Dot key={i} index={i} width={width} scrollX={scrollX} />
      ))}
    </View>
  );
}

function Dot({ index, width, scrollX }: { index: number; width: number; scrollX: SharedValue<number> }) {
  // 6px circle -> 24x6 pill, continuously with the swipe (DESIGN §5 page dots)
  const style = useAnimatedStyle(() => {
    const d = Math.abs(scrollX.get() / width - index);
    return {
      width: interpolate(d, [0, 1], [24, 6], Extrapolation.CLAMP),
      opacity: interpolate(d, [0, 1], [1, 0.35], Extrapolation.CLAMP),
    };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.espresso },
  page: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  display: { color: colors.white, fontSize: 40, lineHeight: 46, fontWeight: '700' },
  light: { fontWeight: '300' },
  footer: { position: 'absolute', left: 20, right: 20, bottom: 56, gap: 20, alignItems: 'center' },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { height: 6, borderRadius: 3, backgroundColor: colors.white },
});
```

**Notes**
- `progress = scrollX / (width × (pages − 1))`, computed with `useDerivedValue` on the UI thread.
- `pagingEnabled` becomes CSS scroll-snap on web. The measured dot positions were 7 → 153 → 299px across the three pages.
- Illustrations at 1.2×: apply `translateX: offset * -0.2` to the art layer, using the same pattern as the text.
- Progress arc around the onboarding arrow button: reuse recipe 7's `DrawPath` with an arc path, e.g. `<DrawPath d="M32 4 A28 28 0 1 1 31.99 4" progress={progress} />` inside a 64×64 `Svg`. `getPathLength` handles `A` commands.

---

## 9. Pay button morph: pill → spinner → check or shake

**When to use:** "Place order" and "Pay". The parent owns the state (`idle | loading | success | error`). The button only animates.

```tsx
// src/components/motion/PayButton.tsx
import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { haptic } from '@/lib/haptics';
import { getPathLength } from '@/lib/pathLength';
import { shake } from '@/lib/shake';
import { colors, easeOutQuint, spring } from '@/theme/motion';

export type PayState = 'idle' | 'loading' | 'success' | 'error';

const H = 64;
const SPIN_R = 20;
const SPIN_C = 2 * Math.PI * SPIN_R;
const CHECK = 'M21 33 L29 41 L44 25';
const CHECK_LEN = getPathLength(CHECK) + 1;
const BG: Record<PayState, string> = {
  idle: colors.ink,
  loading: colors.ink,
  success: colors.sage,
  error: '#B83A3A', // danger-tinted retry pill
};

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PayButtonProps = {
  state: PayState;
  label: string; // e.g. "Pay $12.40"
  onPress: () => void;
};

export function PayButton({ state, label, onPress }: PayButtonProps) {
  const fullWidth = useSharedValue(0);
  const collapsed = useSharedValue(0); // 0 = pill, 1 = circle
  const labelOpacity = useSharedValue(1);
  const spinnerOpacity = useSharedValue(0);
  const rotation = useSharedValue(0);
  const check = useSharedValue(0);
  const shakeX = useSharedValue(0);
  const bg = useSharedValue<string>(BG.idle);

  useEffect(() => {
    const fade = (v: number) => withTiming(v, { duration: 160, easing: easeOutQuint });
    bg.set(withTiming(BG[state], { duration: 240 }));

    if (state === 'loading') {
      labelOpacity.set(fade(0));
      collapsed.set(withDelay(60, withSpring(1, spring.smooth))); // label gone first, then collapse
      spinnerOpacity.set(withDelay(180, fade(1)));
      rotation.set(0);
      // A spinner is essential status info -> keep it spinning even with Reduce Motion.
      rotation.set(
        withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), -1, false, undefined, ReduceMotion.Never),
      );
      check.set(0);
    } else if (state === 'success') {
      cancelAnimation(rotation);
      spinnerOpacity.set(fade(0));
      collapsed.set(withSpring(1, spring.smooth));
      check.set(withDelay(120, withTiming(1, { duration: 420, easing: easeOutQuint })));
      haptic.success();
    } else {
      cancelAnimation(rotation);
      spinnerOpacity.set(fade(0));
      check.set(0);
      collapsed.set(withSpring(0, spring.smooth));
      labelOpacity.set(withDelay(140, fade(1)));
      if (state === 'error') {
        haptic.error();
        shake(shakeX);
      }
    }
  }, [state, bg, labelOpacity, collapsed, spinnerOpacity, rotation, check, shakeX]);

  const buttonStyle = useAnimatedStyle(() => {
    const full = fullWidth.get();
    const c = collapsed.get();
    return {
      opacity: full === 0 ? 0 : 1,
      width: full === 0 ? '100%' : Math.max(H, full + (H - full) * c), // never narrower than the circle
      backgroundColor: bg.get(),
      transform: [{ translateX: shakeX.get() }],
    };
  });
  const labelStyle = useAnimatedStyle(() => ({ opacity: labelOpacity.get() }));
  const spinnerStyle = useAnimatedStyle(() => ({
    opacity: spinnerOpacity.get(),
    transform: [{ rotate: `${rotation.get() * 360}deg` }],
  }));
  const checkProps = useAnimatedProps(() => ({ strokeDashoffset: CHECK_LEN * (1 - check.get()) }));

  const interactive = state === 'idle' || state === 'error';
  const a11yLabel =
    state === 'loading' ? 'Processing payment' : state === 'success' ? 'Payment successful' : state === 'error' ? `Payment failed. Retry ${label}` : label;

  return (
    <View
      style={styles.track}
      onLayout={(e: LayoutChangeEvent) => {
        fullWidth.set(e.nativeEvent.layout.width);
      }}
    >
      <AnimatedPressable
        role="button"
        aria-label={a11yLabel}
        aria-busy={state === 'loading'}
        aria-disabled={!interactive}
        disabled={!interactive}
        onPress={onPress}
        style={[styles.button, buttonStyle]}
      >
        <Animated.View style={[styles.labelRow, labelStyle]}>
          <Text numberOfLines={1} style={styles.label}>
            {state === 'error' ? 'Retry' : label}
          </Text>
          <View style={styles.circle}>
            <Ionicons name={state === 'error' ? 'refresh' : 'arrow-forward'} size={22} color={colors.ink} />
          </View>
        </Animated.View>

        <Animated.View style={[styles.center, spinnerStyle]}>
          <Svg width={48} height={48} viewBox="0 0 48 48">
            <Circle cx={24} cy={24} r={SPIN_R} stroke="rgba(255,255,255,0.18)" strokeWidth={3} fill="none" />
            <Circle
              cx={24}
              cy={24}
              r={SPIN_R}
              stroke={colors.white}
              strokeWidth={3}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={[SPIN_C * 0.28, SPIN_C]}
            />
          </Svg>
        </Animated.View>

        <View style={[styles.center, styles.noTouch]}>
          <Svg width={H} height={H} viewBox="0 0 64 64">
            <AnimatedPath
              d={CHECK}
              stroke={colors.white}
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={[CHECK_LEN, CHECK_LEN]}
              animatedProps={checkProps}
            />
          </Svg>
        </View>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: H, alignItems: 'center', justifyContent: 'center' },
  button: {
    height: H,
    borderRadius: H / 2,
    overflow: 'hidden',
    justifyContent: 'center',
    boxShadow: '0px 10px 24px rgba(28, 23, 20, 0.22)',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 24,
    paddingRight: 6,
  },
  label: { color: colors.white, fontSize: 17, fontWeight: '700', flexShrink: 1 },
  circle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  noTouch: { pointerEvents: 'none' },
});
```

**Usage**

```tsx
const [state, setState] = useState<PayState>('idle');
<PayButton state={state} label="Pay $12.40" onPress={async () => {
  setState('loading');
  setState((await pay()) ? 'success' : 'error');
}} />
```

**Notes**
- The label fades out first, then the width springs from full to 64 (clamped so it is never narrower than the circle). The spinner fades in with a 28% arc, rotated on a wrapper.
- The spinner uses `ReduceMotion.Never`: it is status information, not decoration. Everything else follows the system setting.
- The background colour animates with `withTiming` on a colour-string shared value: ink → sage, or ink → danger tint.

---

## 10. Confetti burst of line-art beans (UI thread)

**When to use:** the order confirmation screen, and reward unlocks.

```tsx
// src/components/motion/ConfettiBurst.tsx
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { colors } from '@/theme/motion';

type Kind = 'bean' | 'steam' | 'dot';
type Particle = {
  vx: number; // px/s
  vy: number; // px/s (negative = up)
  spin: number; // deg/s
  size: number;
  kind: Kind;
  color: string;
  delay: number; // 0..0.15 of the timeline
};

const DURATION_S = 1.8;
const GRAVITY = 1500; // px/s²
const DRAG = 1.6; // 1/s — horizontal + initial vertical velocity decay

/** Deterministic PRNG -> same burst every time for a given seed (no Math.random in render). */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeParticles(count: number, seed = 7): Particle[] {
  const rand = mulberry32(seed);
  const palette = [colors.peach, colors.white, colors.sage, colors.peach];
  const kinds: Kind[] = ['bean', 'steam', 'dot', 'bean'];
  return Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + (rand() - 0.5) * Math.PI * 0.9; // upward cone (±81°)
    const speed = 520 + rand() * 520;
    return {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      spin: (rand() - 0.5) * 720,
      size: 10 + rand() * 10,
      kind: kinds[i % kinds.length],
      color: palette[Math.floor(rand() * palette.length)],
      delay: rand() * 0.12,
    };
  });
}

type ConfettiBurstProps = {
  /** change this number to fire again */
  fireKey: number;
  /** burst origin inside the parent (px) */
  origin: { x: number; y: number };
  count?: number;
  seed?: number;
};

export function ConfettiBurst({ fireKey, origin, count = 28, seed = 7 }: ConfettiBurstProps) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);
  const particles = makeParticles(count, seed);

  useEffect(() => {
    if (reduceMotion || fireKey === 0) return;
    t.set(0);
    // ONE linear clock for every particle; physics is evaluated per frame in each worklet.
    t.set(withTiming(1, { duration: DURATION_S * 1000, easing: Easing.linear }));
  }, [fireKey, reduceMotion, t]);

  if (reduceMotion) return null; // DESIGN §7: no particles with Reduce Motion

  return (
    <View style={[StyleSheet.absoluteFill, styles.noTouch]}>
      {particles.map((p, i) => (
        <ParticleView key={i} p={p} t={t} origin={origin} />
      ))}
    </View>
  );
}

function ParticleView({ p, t, origin }: { p: Particle; t: SharedValue<number>; origin: { x: number; y: number } }) {
  const style = useAnimatedStyle(() => {
    const local = Math.max(0, (t.get() - p.delay) / (1 - p.delay));
    const s = local * DURATION_S; // seconds since launch
    const k = (1 - Math.exp(-DRAG * s)) / DRAG; // integral of exp(-DRAG t): velocity with air drag
    const x = p.vx * k;
    const y = p.vy * k + 0.5 * GRAVITY * s * s;
    return {
      opacity: local === 0 ? 0 : interpolate(local, [0, 0.05, 0.7, 1], [0, 1, 1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: origin.x + x - p.size / 2 },
        { translateY: origin.y + y - p.size / 2 },
        { rotate: `${p.spin * s}deg` },
        { scale: interpolate(local, [0, 0.08], [0.3, 1], Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <Animated.View style={[styles.particle, { width: p.size, height: p.size }, style]}>
      {p.kind === 'dot' ? (
        <View style={{ width: p.size * 0.45, height: p.size * 0.45, borderRadius: p.size, backgroundColor: p.color }} />
      ) : (
        <Svg width={p.size} height={p.size} viewBox="0 0 20 20">
          <Path
            d={p.kind === 'bean' ? BEAN : STEAM}
            fill="none"
            stroke={p.color}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      )}
    </Animated.View>
  );
}

// line-art bean (outline + crease) and a steam squiggle, 20x20
const BEAN = 'M10 2 C15 2 18 6 18 10 C18 15 14 18 10 18 C5 18 2 14 2 10 C2 5 6 2 10 2 Z M11 3 C7 7 13 12 9 17';
const STEAM = 'M6 18 C2 14 10 11 7 7 C5 4 9 2 9 2 M13 18 C9 14 17 11 14 7';

const styles = StyleSheet.create({
  noTouch: { pointerEvents: 'none' },
  particle: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'center' },
});
```

**Notes**
- **One** linear `withTiming` clock drives every particle. Each particle evaluates closed-form physics in its worklet: `x = vx·(1−e^{−kt})/k` and `y = vy·(1−e^{−kt})/k + ½·g·t²`. `withDecay` has no gravity, and it would need two animations per particle.
- The seeded PRNG (`mulberry32`) gives deterministic vectors, so there's no `Math.random()` in render and no surprises from the React Compiler.
- 28 particles with roughly 2/3 SVG is fine on mid-range Android. Above about 60, switch the beans to plain `View` capsules.
- Reduce Motion: renders nothing.

---

## 11. Skeleton shimmer (expo-linear-gradient)

**When to use:** every content placeholder. DESIGN says spinners are never used for content.

```tsx
// src/components/motion/Skeleton.tsx
import { LinearGradient } from 'expo-linear-gradient';
import { createContext, use, useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { colors } from '@/theme/motion';

const ShimmerClock = createContext<SharedValue<number> | null>(null);

function useShimmerClock() {
  const clock = useSharedValue(0);
  useEffect(() => {
    // Reduce Motion (ReduceMotion.System): non-reversing repeat resolves to 1 -> highlight parks off-screen.
    clock.set(withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1, false));
    return () => cancelAnimation(clock);
  }, [clock]);
  return clock;
}

/** Wrap a screen's skeletons so they all shimmer in phase (one animation instead of N). */
export function SkeletonGroup({ children }: { children: ReactNode }) {
  const clock = useShimmerClock();
  return <ShimmerClock value={clock}>{children}</ShimmerClock>;
}

type SkeletonProps = {
  width?: DimensionValue;
  height: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

export function Skeleton({ width = '100%', height, radius = 12, style }: SkeletonProps) {
  const group = use(ShimmerClock);
  return group ? (
    <SkeletonBox clock={group} width={width} height={height} radius={radius} style={style} />
  ) : (
    <StandaloneSkeleton width={width} height={height} radius={radius} style={style} />
  );
}

function StandaloneSkeleton(props: Required<Omit<SkeletonProps, 'style'>> & Pick<SkeletonProps, 'style'>) {
  const clock = useShimmerClock();
  return <SkeletonBox clock={clock} {...props} />;
}

function SkeletonBox({
  clock,
  width,
  height,
  radius,
  style,
}: Required<Omit<SkeletonProps, 'style'>> & Pick<SkeletonProps, 'style'> & { clock: SharedValue<number> }) {
  const boxWidth = useSharedValue(0);

  const highlightStyle = useAnimatedStyle(() => {
    const w = boxWidth.get();
    // sweep from fully left (-w) to fully right (+w)
    return { transform: [{ translateX: -w + clock.get() * 2 * w }] };
  });

  return (
    <View
      aria-hidden
      onLayout={(e) => boxWidth.set(e.nativeEvent.layout.width)}
      style={[styles.base, { width, height, borderRadius: radius }, style]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, highlightStyle]}>
        <LinearGradient
          // use transparent WHITE, not 'transparent' (= transparent black -> grey band on iOS)
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.65)', 'rgba(255,255,255,0)']}
          locations={[0.2, 0.5, 0.8]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
});
```

**Usage**

```tsx
<SkeletonGroup>
  <Skeleton height={150} radius={16} />
  <Skeleton height={14} width="70%" radius={7} style={{ marginTop: 10 }} />
</SkeletonGroup>
```

**Notes:** a `SkeletonGroup` shares one clock, so every placeholder shimmers in phase (one animation instead of N). The gradient stops are transparent *white*. Under Reduce Motion the highlight parks off-screen, leaving a static cream block.

---

## 12. Shake helper (validation errors)

**When to use:** a required option group is missing, the OTP is invalid, or the coupon is rejected.

```ts
// src/lib/shake.ts
import {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';
import { spring } from '@/theme/motion';

/**
 * Worklet-safe: callable from JS *or* from a UI-thread callback.
 * DESIGN §7: ±6px, 3 cycles. Under Reduce Motion it resolves instantly to 0
 * (ReduceMotion.System) — pair it with a colour/text cue + error haptic.
 */
export function shake(offset: SharedValue<number>, amplitude = 6, cycles = 3) {
  'worklet';
  const steps: number[] = [];
  for (let i = 0; i < cycles; i++) {
    const a = amplitude * (1 - i / (cycles + 1)); // decay: 6 -> 4.5 -> 3
    steps.push(-a, a);
  }
  offset.set(
    withSequence(
      withTiming(steps[0], { duration: 40 }),
      ...steps.slice(1).map((v) => withTiming(v, { duration: 70 })),
      withSpring(0, spring.snappy),
    ),
  );
}

/** Hook form: spread `shakeStyle` onto an Animated.View and call `trigger()`. */
export function useShake({ amplitude = 6, cycles = 3, withHaptic = true } = {}) {
  const offset = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));
  const trigger = () => {
    if (withHaptic) haptic.error();
    shake(offset, amplitude, cycles);
  };
  return { offset, shakeStyle, trigger };
}
```

**Usage: tapping the disabled bar with no size selected**

```tsx
const { shakeStyle, trigger } = useShake();
const listRef = useAnimatedRef<Animated.ScrollView>();
// …
<Animated.View style={shakeStyle}>{/* Size group + "*Choose one" tag */}</Animated.View>
// …
onPress={() => {
  if (size === null) {
    trigger(); // haptic.error() + ±6px × 3
    // optional auto-scroll: scheduleOnUI(() => { 'worklet'; scrollTo(listRef, 0, groupY, true); });
    return;
  }
  addToCart();
}}
```

**Notes:** `shake()` is a worklet, so you can call it from JS or from a UI-thread callback (the pay button calls it on failure). Under Reduce Motion it resolves to 0 immediately, so always pair it with the ember "*Choose one" tag and the error haptic.

---

## 13. Pulsing ring and connector fill (order status)

**When to use:** the order tracking timeline.

```tsx
// src/components/motion/StatusTimeline.tsx
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { colors, easeOutQuint, spring } from '@/theme/motion';

const DOT = 16;
const ROW = 64;
const FILL_MS = 600;

/** Two phase-shifted rings -> continuous "breathing" pulse around the current step. */
export function PulsingRing({ color = colors.ink, size = DOT }: { color?: string; size?: number }) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    t.set(withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1, false));
    return () => cancelAnimation(t);
  }, [reduceMotion, t]);
  if (reduceMotion) return null; // the ink dot + label already communicate "current"
  return (
    <>
      <Ring t={t} phase={0} color={color} size={size} />
      <Ring t={t} phase={0.5} color={color} size={size} />
    </>
  );
}

function Ring({ t, phase, color, size }: { t: SharedValue<number>; phase: number; color: string; size: number }) {
  const style = useAnimatedStyle(() => {
    const p = (t.get() + phase) % 1;
    return {
      opacity: interpolate(p, [0, 1], [0.35, 0]),
      transform: [{ scale: interpolate(p, [0, 1], [1, 2.6]) }],
    };
  });
  return (
    <Animated.View
      style={[styles.ring, { width: size, height: size, borderRadius: size / 2, borderColor: color }, style]}
    />
  );
}

type StepState = 'done' | 'current' | 'upcoming';

function StepDot({ state }: { state: StepState }) {
  const scale = useSharedValue(1);
  const prev = useRef(state);

  useEffect(() => {
    if (prev.current === 'upcoming' && state === 'current') {
      // shrink at once, hold while the connector above fills, then pop in
      // (the old order kept the dot full-size during the fill and dipped it afterwards)
      scale.set(
        withSequence(withTiming(0.6, { duration: 80 }), withDelay(FILL_MS - 80, withSpring(1, spring.snappy))),
      );
    }
    prev.current = state;
  }, [state, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <View style={styles.dotBox}>
      {state === 'current' && <PulsingRing />}
      <Animated.View
        style={[
          styles.dot,
          state === 'done' && { backgroundColor: colors.sage, borderColor: colors.sage },
          state === 'current' && { backgroundColor: colors.ink, borderColor: colors.ink },
          style,
        ]}
      >
        {state === 'done' && <Ionicons name="checkmark" size={11} color={colors.white} />}
      </Animated.View>
    </View>
  );
}

/** Track + gradient fill that sweeps top -> bottom when `filled` flips to true. */
function Connector({ filled }: { filled: boolean }) {
  const p = useSharedValue(filled ? 1 : 0);
  useEffect(() => {
    p.set(withTiming(filled ? 1 : 0, { duration: FILL_MS, easing: easeOutQuint }));
  }, [filled, p]);
  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: p.get() }] }));
  return (
    <View style={styles.track}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.fillOrigin, fillStyle]}>
        <LinearGradient colors={[colors.sage, '#B7D3AA']} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

export function StatusTimeline({ steps, current }: { steps: readonly string[]; current: number }) {
  return (
    <View>
      {steps.map((label, i) => {
        const state: StepState = i < current ? 'done' : i === current ? 'current' : 'upcoming';
        return (
          <View key={label} style={styles.row}>
            <View style={styles.rail}>
              <StepDot state={state} />
              {i < steps.length - 1 && <Connector filled={i < current} />}
            </View>
            <Text style={[styles.label, state === 'upcoming' && { color: colors.inkSoft }]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 14, height: ROW },
  rail: { width: DOT, alignItems: 'center' },
  dotBox: { width: DOT, height: DOT, alignItems: 'center', justifyContent: 'center' },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: { position: 'absolute', borderWidth: 2 },
  track: { flex: 1, width: 2, marginVertical: 4, borderRadius: 1, backgroundColor: colors.line, overflow: 'hidden' },
  fillOrigin: { transformOrigin: 'top' },
  label: { fontSize: 15, fontWeight: '600', color: colors.ink, marginTop: -2 },
});
```

**Notes**
- Two rings offset by half a cycle give a continuous "breathing" pulse instead of a blink.
- When `current` increments, the connector above fills (`scaleY` with `transformOrigin: 'top'`, a sage gradient, 600ms easeOutQuint). The next dot shrinks to 0.6 at once, then pops back to 1 with `snappy` **after** the fill: `withSequence(withTiming(0.6), withDelay(FILL_MS − 80, withSpring(1)))`.
- Reduce Motion: no rings. The fill and the pop resolve instantly.

---

## 14. Parallax and stretchy hero (useAnimatedScrollHandler)

**When to use:** the product detail hero, plus the Rewards points hero card.

```tsx
// src/components/motion/ParallaxHero.tsx
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { colors } from '@/theme/motion';

type ParallaxHeroProps = {
  tint: string;
  /** the product image (already sized), e.g. <HeroFromRect …><Image …/></HeroFromRect> */
  hero: ReactNode;
  /** fixed overlay controls (back button, kcal badge) — not scrolled */
  overlay?: ReactNode;
  /** sheet content */
  children: ReactNode;
  /** optional: share scrollY with a sticky header / blur */
  scrollY?: SharedValue<number>;
};

const SHEET_OVERLAP = 36;

export function ParallaxHeroScreen({ tint, hero, overlay, children, scrollY: external }: ParallaxHeroProps) {
  const { height: screenH } = useWindowDimensions();
  const heroH = Math.round(screenH * 0.45); // DESIGN: top ~45% is the hero
  const reduceMotion = useReducedMotion();
  const internal = useSharedValue(0);
  const scrollY = external ?? internal;
  const drift = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.set(e.contentOffset.y);
    },
  });

  // slow ±1.5° idle drift (3° total), off with Reduce Motion
  useEffect(() => {
    if (reduceMotion) return;
    drift.set(withRepeat(withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(drift);
  }, [reduceMotion, drift]);

  const heroStyle = useAnimatedStyle(() => {
    const y = scrollY.get();
    if (reduceMotion) {
      return { opacity: interpolate(y, [0, heroH * 0.7], [1, 0], Extrapolation.CLAMP) };
    }
    if (y < 0) {
      // Pull-down (iOS bounce): stretch, keeping the top edge pinned.
      const scale = 1 + -y / heroH;
      return { opacity: 1, transform: [{ translateY: -y / 2 }, { scale }] };
    }
    // Scroll up: image moves at 0.5x the sheet speed and fades.
    return {
      opacity: interpolate(y, [0, heroH * 0.7], [1, 0], Extrapolation.CLAMP),
      transform: [{ translateY: -y * 0.5 }, { scale: 1 }],
    };
  });

  const driftStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-1.5 + 3 * drift.get()}deg` }],
  }));

  return (
    <View style={[styles.root, { backgroundColor: tint }]}>
      {/* Fixed hero layer BEHIND the scroll view */}
      <Animated.View style={[styles.hero, { height: heroH }, heroStyle]}>
        <Animated.View style={driftStyle}>{hero}</Animated.View>
      </Animated.View>

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: heroH - SHEET_OVERLAP }}
      >
        <View style={[styles.sheet, { minHeight: screenH - heroH + SHEET_OVERLAP }]}>{children}</View>
      </Animated.ScrollView>

      {overlay ? <View style={[StyleSheet.absoluteFill, styles.boxNone]}>{overlay}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { position: 'absolute', left: 0, right: 0, top: 0, alignItems: 'center', justifyContent: 'center' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 120,
  },
  boxNone: { pointerEvents: 'box-none' },
});
```

**Notes**
- The hero is a fixed layer *behind* the `Animated.ScrollView`. The scroll content starts with `paddingTop: heroH − 36`, so the notched sheet overlaps the hero.
- Scrolling up moves the image at 0.5× and fades it. Pulling down (iOS bounce) scales it by `1 + pull/heroH` with `translateY = pull/2`, which keeps the top edge pinned.
- Android and web don't report negative offsets. Android 12+ shows its native stretch overscroll instead, so the effect degrades gracefully.
- Idle drift: ±1.5° over 6s. Reduce Motion: no parallax, no drift, fade only.

---

## 15. Staggered entrance helper

**When to use:** grids, option lists, cart rows, and the contents of the detail sheet.

```ts
// src/lib/stagger.ts
import { Platform } from 'react-native';
import { FadeInDown, Keyframe } from 'react-native-reanimated';

import { easeOutQuint } from '@/theme/motion';

const STEP = 40; // DESIGN §7: 40ms stagger
const MAX_STAGGERED = 10; // cap so item #40 doesn't wait 1.6s

/**
 * `entering={staggerIn(index)}` — fade + rise 12px, gentle spring on native.
 * Web layout animations are CSS keyframes: springify() is ignored there (it would fall back to
 * linear), so web gets the same motion with an easeOutQuint curve instead.
 * Note: `transform: [...]` in withInitialValues is marked deprecated in 4.5 in favour of flat
 * `translateY`, but the web keyframe generator in 4.5.1 only understands the `transform` form.
 */
export function staggerIn(index: number) {
  const delay = Math.min(index, MAX_STAGGERED) * STEP;
  const initial = { opacity: 0, transform: [{ translateY: 12 }] as [{ translateY: number }] };
  if (Platform.OS === 'web') {
    return FadeInDown.delay(delay).duration(380).easing(easeOutQuint).withInitialValues(initial);
  }
  return FadeInDown.delay(delay).springify().mass(1).damping(26).stiffness(120).withInitialValues(initial);
}

/**
 * Exact DESIGN spec (fade, rise 12px, scale from 0.98) as a Keyframe — identical on iOS, Android, web.
 * The 15%/40% steps approximate easeOutQuint (web Keyframes only accept named easings).
 */
export function riseIn(index: number) {
  return new Keyframe({
    0: { opacity: 0, transform: [{ translateY: 12 }, { scale: 0.98 }] },
    15: { opacity: 0.56, transform: [{ translateY: 5.3 }, { scale: 0.991 }] },
    40: { opacity: 0.92, transform: [{ translateY: 0.9 }, { scale: 0.998 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
  })
    .delay(Math.min(index, MAX_STAGGERED) * STEP)
    .duration(420);
}
```

**Usage**

```tsx
{products.map((p, i) => (
  <Animated.View key={p.id} entering={staggerIn(i)} layout={LinearTransition.springify().mass(1).damping(22).stiffness(180)}>
    <ProductCard product={p} />
  </Animated.View>
))}

// Don't replay entrances when a tab re-renders or a list refetches:
<LayoutAnimationConfig skipEntering>{/* … */}</LayoutAnimationConfig>
```

**Notes:** the stagger is capped at 10 items (400ms) so item #40 doesn't wait. Entering animations follow `ReduceMotion.System`, so they are skipped under Reduce Motion. Use `riseIn` when you need the exact DESIGN spec (fade, rise 12, scale 0.98) to look identical on all three platforms.

---

## 16. Collapsing Home header with a sticky blurred search bar

**When to use:** Home (location row, greeting + points, search).

```tsx
// src/components/motion/CollapsingHomeHeader.tsx
import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme/motion';

// Fixed row heights (design tokens) -> no measuring, header math is pure.
export const ROW1 = 52; // location ⌄ · bell · cart
export const ROW2 = 64; // avatar · greeting · points pill   (collapses)
export const ROW3 = 60; // search bar                        (sticks)

type Props = {
  row1: ReactNode;
  row2: ReactNode;
  row3: ReactNode;
  children: ReactNode; // the scrolling body (promo, modes, grid…)
};

export function CollapsingHomeHeader({ row1, row2, row3, children }: Props) {
  const insets = useSafeAreaInsets();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const y = useSharedValue(0);

  // Snap a half-collapsed header open/closed when the finger lifts and momentum ends.
  // iOS/Android only: onEndDrag/onMomentumEnd never fire on web (only onScroll does), so on web
  // the header just tracks the scroll position.
  const snap = (offset: number) => {
    'worklet';
    if (offset > 0 && offset < ROW2) scrollTo(scrollRef, 0, offset < ROW2 / 2 ? 0 : ROW2, true);
  };

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      y.set(e.contentOffset.y);
    },
    onEndDrag: (e) => {
      if (Math.abs(e.velocity?.y ?? 0) < 0.2) snap(e.contentOffset.y);
    },
    onMomentumEnd: (e) => {
      snap(e.contentOffset.y);
    },
  });

  // Rows 2+3 slide up by ROW2, then the search bar is pinned under row 1.
  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -Math.min(Math.max(y.get(), 0), ROW2) }],
  }));
  const greetingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.get(), [0, ROW2 * 0.6], [1, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(y.get(), [0, ROW2], [1, 0.96], Extrapolation.CLAMP) }],
  }));
  // Blur + hairline fade in only once the search bar is stuck.
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.get(), [ROW2 * 0.5, ROW2], [0, 1], Extrapolation.CLAMP),
  }));

  const pinnedHeight = insets.top + ROW1 + ROW3;

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: insets.top + ROW1 + ROW2 + ROW3 + 8, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </Animated.ScrollView>

      {/* 1. backdrop (fixed): blur behind row1 + pinned search */}
      <Animated.View style={[styles.backdrop, { height: pinnedHeight }, backdropStyle]}>
        <BlurView tint="light" intensity={60} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.backdropFill]} />
      </Animated.View>

      {/* 2. sliding block, clipped below row1 so the greeting slides "under" it */}
      <View style={[styles.clip, { top: insets.top + ROW1, height: ROW2 + ROW3 }]}>
        <Animated.View style={slideStyle}>
          <Animated.View style={[{ height: ROW2 }, greetingStyle]}>{row2}</Animated.View>
          <View style={{ height: ROW3 }}>{row3}</View>
        </Animated.View>
      </View>

      {/* 3. row1 (fixed, always visible) */}
      <View style={[styles.row1, { paddingTop: insets.top, height: insets.top + ROW1 }]}>{row1}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  backdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    pointerEvents: 'none',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  backdropFill: {
    backgroundColor: Platform.select({ android: 'rgba(246,241,234,0.97)', default: 'rgba(246,241,234,0.7)' }),
  },
  clip: { position: 'absolute', left: 0, right: 0, overflow: 'hidden', pointerEvents: 'box-none' },
  row1: { position: 'absolute', left: 0, right: 0, top: 0, pointerEvents: 'box-none' },
});
```

**Usage**

```tsx
<CollapsingHomeHeader
  row1={<LocationRow right={<CartButton count={count} icon={<Ionicons name="bag-outline" size={24} />} />} />}
  row2={<GreetingRow name="Ava" points={2300} />}
  row3={<SearchPill onPress={() => router.push('/search')} />}
>
  <PromoCarousel />
  <ModeCards />
  <ProductGrid />
</CollapsingHomeHeader>
```

**Notes**
- Fixed row heights (52 / 64 / 60) keep the header math simple, with no measuring.
- Rows 2 and 3 slide up together by `ROW2`. They are clipped below row 1, so the greeting slides *under* it while fading.
- The blur backdrop and hairline fade in only once the search bar is stuck. On iOS and Android, a half-collapsed header snaps open or closed with the UI-thread `scrollTo` when the finger lifts or momentum ends. On web, `scrollTo` itself works, but the drag and momentum events that trigger the snap never fire (gotcha 15). So on web the header follows the scroll and doesn't snap.
- Only `transform` and `opacity` animate.

---

## Appendix A: SVG path length (used by recipes 7 and 9)

```ts
// src/lib/pathLength.ts
// Pure-JS SVG path length (M L H V C S Q T A Z, absolute + relative).
// Why: react-native-svg's getTotalLength() is native-only and `pathLength` is web-only,
// so stroke draw-on needs a length that is identical on iOS, Android and web.

const SEGMENT = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;

const dist = (x1: number, y1: number, x2: number, y2: number) => Math.hypot(x2 - x1, y2 - y1);

function cubicLength(
  x0: number, y0: number, x1: number, y1: number,
  x2: number, y2: number, x3: number, y3: number, steps: number,
) {
  let len = 0;
  let px = x0;
  let py = y0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const x = u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3;
    const y = u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3;
    len += dist(px, py, x, y);
    px = x;
    py = y;
  }
  return len;
}

function arcLength(
  x1: number, y1: number, rxIn: number, ryIn: number, phiDeg: number,
  largeArc: number, sweep: number, x2: number, y2: number, steps: number,
) {
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if (rx === 0 || ry === 0) return dist(x1, y1, x2, y2);
  // SVG spec F.6.5 endpoint -> centre parameterisation
  const phi = (phiDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const coef = (largeArc === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;
  const angle = (ux: number, uy: number, vx: number, vy: number) =>
    Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let delta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  else if (sweep && delta < 0) delta += 2 * Math.PI;
  // Length is rotation/translation invariant -> sample the axis-aligned ellipse.
  let len = 0;
  let px = rx * Math.cos(theta1);
  let py = ry * Math.sin(theta1);
  for (let i = 1; i <= steps; i++) {
    const t = theta1 + (delta * i) / steps;
    const x = rx * Math.cos(t);
    const y = ry * Math.sin(t);
    len += dist(px, py, x, y);
    px = x;
    py = y;
  }
  return len;
}

/** Note: arc flags must be separated by spaces/commas ("a5 5 0 0 1 10 0"), not packed ("0110"). */
export function getPathLength(d: string, steps = 32): number {
  let total = 0;
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let ctrlX = 0; // last control point, for S/T reflection
  let ctrlY = 0;
  let prev = '';

  for (const match of d.matchAll(SEGMENT)) {
    const cmd = match[1];
    const nums = (match[2].match(NUMBER) ?? []).map(Number);
    const rel = cmd !== cmd.toUpperCase();
    const C = cmd.toUpperCase();
    const ox = () => (rel ? x : 0);
    const oy = () => (rel ? y : 0);

    if (C === 'Z') {
      total += dist(x, y, startX, startY);
      x = startX;
      y = startY;
      prev = C;
      continue;
    }

    const arity = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 }[C] ?? 2;
    for (let i = 0; i + arity <= nums.length; i += arity) {
      const n = nums.slice(i, i + arity);
      // After the first pair, extra M pairs are implicit L commands.
      const op = C === 'M' && i > 0 ? 'L' : C;
      switch (op) {
        case 'M':
          x = n[0] + ox();
          y = n[1] + oy();
          startX = x;
          startY = y;
          break;
        case 'L': {
          const nx = n[0] + ox();
          const ny = n[1] + oy();
          total += dist(x, y, nx, ny);
          x = nx;
          y = ny;
          break;
        }
        case 'H': {
          const nx = n[0] + ox();
          total += Math.abs(nx - x);
          x = nx;
          break;
        }
        case 'V': {
          const ny = n[0] + oy();
          total += Math.abs(ny - y);
          y = ny;
          break;
        }
        case 'C':
        case 'S': {
          const smooth = op === 'S';
          const reflect = smooth && (prev === 'C' || prev === 'S');
          const x1 = smooth ? (reflect ? 2 * x - ctrlX : x) : n[0] + ox();
          const y1 = smooth ? (reflect ? 2 * y - ctrlY : y) : n[1] + oy();
          const o = smooth ? 0 : 2;
          const x2 = n[o] + ox();
          const y2 = n[o + 1] + oy();
          const x3 = n[o + 2] + ox();
          const y3 = n[o + 3] + oy();
          total += cubicLength(x, y, x1, y1, x2, y2, x3, y3, steps);
          ctrlX = x2;
          ctrlY = y2;
          x = x3;
          y = y3;
          break;
        }
        case 'Q':
        case 'T': {
          const smooth = op === 'T';
          const reflect = smooth && (prev === 'Q' || prev === 'T');
          const qx = smooth ? (reflect ? 2 * x - ctrlX : x) : n[0] + ox();
          const qy = smooth ? (reflect ? 2 * y - ctrlY : y) : n[1] + oy();
          const ex = n[smooth ? 0 : 2] + ox();
          const ey = n[smooth ? 1 : 3] + oy();
          // quadratic -> cubic control points
          total += cubicLength(
            x, y,
            x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y),
            ex + (2 / 3) * (qx - ex), ey + (2 / 3) * (qy - ey),
            ex, ey, steps,
          );
          ctrlX = qx;
          ctrlY = qy;
          x = ex;
          y = ey;
          break;
        }
        case 'A': {
          const ex = n[5] + ox();
          const ey = n[6] + oy();
          total += arcLength(x, y, n[0], n[1], n[2], n[3], n[4], ex, ey, steps);
          x = ex;
          y = ey;
          break;
        }
      }
      prev = op;
    }
  }
  return total;
}
```

Unit-checked with Node: a line of 3-4-5 gives 5.000, a circle from two arcs gives 62.81 (2πr = 62.83), `Q5 5 10 0` gives 11.477 (analytic 11.478), and S/T reflection, relative commands and implicit `L` after `M` all match.

## Appendix B: everything wired together (product detail)

Recipes 1, 2, 3, 4, 6, 12, 14 and 15 on one screen.

> **Stand-ins:** `@/data/products` (`getProduct`, `product.tint`) and `@/stores/cart` (`count`, `add()`) are scratch-app stubs. In this project use `getProductSync(id)` from `@/api` (it returns `null` when not found), `useCartCount()` and `useCart((s) => s.add)` from `@/store/cart` (`add` takes a `NewCartLine`), and `heroTints[getCategorySync(product.categoryId)?.tint ?? 'coffee']` from `@/theme` for the tint.

```tsx
// src/app/product/[id].tsx  (recipes 1, 2, 3, 4, 6, 12, 14 wired together)
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedRef, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CartButton, useFlyToCart } from '@/components/motion/FlyToCart';
import { ParallaxHeroScreen } from '@/components/motion/ParallaxHero';
import { PressableScale } from '@/components/motion/PressableScale';
import { RollingNumber } from '@/components/motion/RollingNumber';
import { HeroFromRect } from '@/components/motion/SharedHero';
import { SIZE_HERO_SCALE, SizeSelector } from '@/components/motion/SizeSelector';
import { getProduct } from '@/data/products';
import { useShake } from '@/lib/shake';
import { riseIn } from '@/lib/stagger';
import { useCart } from '@/stores/cart';
import { colors, spring } from '@/theme/motion';

const SIZES = [
  { label: 'S', delta: '-$0.50' },
  { label: 'M', delta: '+$0.00' },
  { label: 'L', delta: '+$0.70' },
] as const;
const DELTA = [-0.5, 0, 0.7];
const HERO = 240;

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const product = getProduct(id);
  const insets = useSafeAreaInsets();
  const { fly } = useFlyToCart();
  const count = useCart((s) => s.count);
  const add = useCart((s) => s.add);
  const [size, setSize] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const { shakeStyle, trigger } = useShake();

  // hero image ref = flight source; size scale S 0.9 / M 1 / L 1.08
  const imageRef = useAnimatedRef<Animated.View>();
  const sizeScale = useSharedValue(1);
  useEffect(() => {
    if (size !== null) sizeScale.set(withSpring(SIZE_HERO_SCALE[size], spring.smooth));
  }, [size, sizeScale]);
  const sizeScaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: sizeScale.get() }] }));

  const total = (product.price + (size === null ? 0 : DELTA[size])) * qty;

  const onAdd = () => {
    if (size === null) {
      trigger(); // recipe 12: shake the missing group + error haptic
      return;
    }
    fly(imageRef, product.image, { onLand: add });
  };

  return (
    <ParallaxHeroScreen
      tint={product.tint}
      hero={
        <HeroFromRect id={product.id} size={HERO}>
          <Animated.View ref={imageRef} collapsable={false} style={[StyleSheet.absoluteFill, sizeScaleStyle]}>
            <Image source={{ uri: product.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
          </Animated.View>
        </HeroFromRect>
      }
      overlay={
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <PressableScale haptic="light" style={styles.circleBtn} onPress={() => router.back()} aria-label="Back">
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </PressableScale>
          <View style={styles.circleBtn}>
            <CartButton count={count} icon={<Ionicons name="bag-outline" size={22} color={colors.ink} />} />
          </View>
        </View>
      }
    >
      <Animated.View entering={FadeInDown.delay(180).springify().mass(1).damping(22).stiffness(180)}>
        <Animated.Text entering={riseIn(0)} style={styles.title}>
          <Text style={{ fontWeight: '700' }}>{product.name.split(' ')[0]} </Text>
          <Text style={{ fontWeight: '300' }}>{product.name.split(' ').slice(1).join(' ')}</Text>
        </Animated.Text>

        <Animated.View entering={riseIn(1)}>
          <Animated.View style={[styles.group, shakeStyle]}>
            <View style={styles.groupHead}>
              <Text style={styles.h2}>Size</Text>
              <Text style={{ color: size === null ? colors.ember : colors.inkSoft }}>
                {size === null ? '*Choose one' : 'Selected'}
              </Text>
            </View>
            <SizeSelector options={SIZES} value={size} onChange={setSize} />
          </Animated.View>
        </Animated.View>

        <Animated.View entering={riseIn(2)} style={styles.qtyRow}>
          <PressableScale haptic="light" style={styles.qtyBtn} onPress={() => setQty((q) => Math.max(1, q - 1))}>
            <Ionicons name="remove" size={20} color={colors.ink} />
          </PressableScale>
          <RollingNumber value={qty} decimals={0} style={styles.qty} />
          <PressableScale haptic="light" style={styles.qtyBtn} onPress={() => setQty((q) => q + 1)}>
            <Ionicons name="add" size={20} color={colors.ink} />
          </PressableScale>
        </Animated.View>

        <Animated.View entering={riseIn(3)}>
          {/* no haptic prop: error haptic comes from trigger(), medium haptic from the landing */}
          <PressableScale onPress={onAdd} style={[styles.bar, size === null && { opacity: 0.35 }]}>
            <RollingNumber value={total} prefix="$" style={styles.barPrice} />
            <View style={styles.barCircle}>
              <Ionicons name="bag-handle-outline" size={22} color={colors.ink} />
            </View>
          </PressableScale>
        </Animated.View>
      </Animated.View>
    </ParallaxHeroScreen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20 },
  circleBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 28, color: colors.ink, marginBottom: 20 },
  group: { gap: 14, marginBottom: 24 },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  h2: { fontSize: 18, fontWeight: '600', color: colors.ink },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  qtyBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qty: { fontSize: 22, lineHeight: 28, fontWeight: '700', color: colors.ink },
  bar: {
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 24,
    paddingRight: 6,
  },
  barPrice: { fontSize: 20, lineHeight: 26, fontWeight: '700', color: colors.white },
  barCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

## Sources

- Reanimated docs: [useSharedValue (React Compiler: `get`/`set`)](https://docs.swmansion.com/react-native-reanimated/docs/core/useSharedValue), [measure](https://docs.swmansion.com/react-native-reanimated/docs/advanced/measure), [useReducedMotion](https://docs.swmansion.com/react-native-reanimated/docs/device/useReducedMotion), [Migration from 3.x](https://docs.swmansion.com/react-native-reanimated/docs/guides/migration-from-3.x/)
- Gesture Handler: [GestureDetector (2.x)](https://docs.swmansion.com/react-native-gesture-handler/docs/2.x/gestures/gesture-detector)
- Expo SDK 57: [Reanimated](https://docs.expo.dev/versions/v57.0.0/sdk/reanimated.md), [BlurView](https://docs.expo.dev/versions/v57.0.0/sdk/blur-view.md), [JS tabs](https://docs.expo.dev/router/advanced/tabs.md), [React Compiler](https://docs.expo.dev/guides/react-compiler.md), [llms.txt](https://docs.expo.dev/llms.txt)
- Techniques adapted: FLIP (First-Last-Invert-Play) for shared elements; dual-spring "stretchy" indicators; odometer reels keyed from the right; closed-form projectile physics for particles. The installed source code took priority wherever it disagreed with the docs (for example, the `Tabs` deprecation, which the docs page doesn't mention yet).
- Added in review: [withSpring defaults](https://docs.swmansion.com/react-native-reanimated/docs/animations/withSpring/), [useAnimatedScrollHandler ("Only `onScroll` event works on Web")](https://docs.swmansion.com/react-native-reanimated/docs/scroll/useAnimatedScrollHandler/), [Expo SDK 57 BlurView: `BlurTargetView` and `blurTarget`](https://docs.expo.dev/versions/v57.0.0/sdk/blur-view.md)

## Verification notes

A second reviewer checked this document on 2026-10-07 against the installed `node_modules` (the versions match the table at the top) and the official docs. After the edits, every full-file block was extracted again into a scratch project linked to this `node_modules`:

- `tsc --noEmit` (TypeScript 6.0.3, strict, `expo/tsconfig.base`): 0 errors.
- `babel-preset-expo` 57.0.14 with React Compiler 1.0 and the worklets 0.10.1 plugin, for ios, android and web: 123 functions compiled, 0 bail-outs.

The web runtime numbers in "How this was verified", item 3, are the original author's. They were not re-run after these edits.

**Corrected**

1. **Recipe 3, cart lost items.** When a second tap interrupted a flight, the first flight's callback returned early on `!finished`, so its `onLand` (the cart add) never ran. Its `setFlight(null)` could also unmount the newer thumbnail. Now `onLand` always runs. The pop and haptic run only on a real landing, and an id guard protects the newer flight. Verified that `valueSetter.ts` calls a cancelled animation's callback with `false`.
2. **Recipe 3, wrong target.** `CartButton` now registers on focus with `useFocusEffect` from `expo-router` instead of on mount with `useEffect`. js-tabs keep visited tabs mounted, so "last mounted" could aim at a hidden tab's cart.
3. **Recipe 3 usage and Appendix B, double haptic.** Removed `haptic="medium"` from the add buttons. It fired a second time on top of the landing haptic.
4. **Recipe 16 and new gotcha 15, snapping on web.** The doc said snap-on-release works on web. It doesn't: `onEndDrag` and `onMomentumEnd` never fire there. Snapping is now documented as iOS and Android only.
5. **Gotcha 8, Android blur.** Real blur also needs `blurTarget={ref}` on a `BlurView` placed outside the `BlurTargetView`. Without it, expo-blur warns and falls back to `'none'`.
6. **New gotcha 16, recipe 4 and the root layout, stack on web.** On web the stack has no push transition, and the previous screen gets `display: none` at once. `animationDuration` works on iOS only.
7. **Recipe 2, odometer.** The prefix and suffix now sit outside the right-keyed columns, because the `$` re-keyed and flickered on `$9.99 → $10.99`. `LayoutAnimationConfig skipEntering` stops the fade-in when the number first mounts.
8. **Recipe 13, step dot.** The dot stayed full size while the connector filled, then dipped. Now it shrinks first and pops after the fill.
9. **TapScale.** Added `accessible`, `accessibilityActions` and `onAccessibilityAction`, because a screen reader activates the view through an accessibility action, not through the Tap gesture. Also fixed a comment: the worklets Babel plugin auto-workletizes the callbacks, not `GestureDetector`.
10. **Gotchas 3 and 10.** Gotcha 3 now says web `measure` mixes `pageX`/`pageY` that include transforms with `width`/`height` that don't. Gotcha 10 now limits the "stays at start" behavior to infinite or even reverse repeats.
11. **Paths.** `src/stores/heroTransition.ts` is now `src/store/heroTransition.ts`, and `ProductCard` imports `Product` from `@/types/models`. Added notes on the files the project already has and on the Appendix B stand-ins.

**Confirmed as written**

- **Springs:** the default `withSpring` is `{ mass: 4, damping: 120, stiffness: 900 }`, `duration` is perceptual (×1.5), and `energyThreshold` replaces the rest thresholds.
- **Worklets:** Reanimated's `runOnJS`, `runOnUI` and `executeOnUIRuntimeSync` re-exports are `@deprecated`. `scheduleOnRN` and `scheduleOnUI` take their arguments directly. `runOnUISync` throws on web.
- **Shared element transitions:** the static flag is `ENABLE_SHARED_ELEMENT_TRANSITIONS: false`.
- **React Compiler:** reproduced the bail-out on a computed default parameter (`BuildHIR::node.lowerReorderableExpression`).
- **RN 0.86:** the types have no `absoluteFillObject` (RN-Web still has it), and `'text'` is not a `Role`.
- **expo-router:** `expo-router/js-tabs` exports `Tabs` and `BottomTabBarProps`, and `tabBarIcon` gets `color: ColorValue`.
- **Web layout animations:** they ignore `springify()`. Flat `withInitialValues` keys produce invalid CSS on web. `Easing.bezier` **does** survive on web, because the worklets plugin adds `__closure` and the bezier is turned into `cubic-bezier()`. `Keyframe` per-step easing accepts only named easings on web.
- **Other packages:** `useReducedMotion` is fixed at app start. `GestureDetector`'s `touchAction` defaults to `'none'`. svg `getTotalLength` is native-only. expo-haptics 57 has a web implementation.

**Still uncertain**

- **No device run:** nothing was exercised on iOS or Android here. Untested natively: the FLIP timing against the native fade, `boxShadow` on a transparent overlay layer, and `measure` called from `onLayout`.
- **Native vs web `measure`:** Fabric's `measure` is believed to include transforms in its size, but web's `width`/`height` don't. So a scaled source, such as Appendix B's size scale, can start the flying thumbnail a few px off on one of the two platforms.
- **Tab pill:** if the index change and the label's layout change arrive in separate frames, the reaction can swap the FAST and SLOW springs mid-flight. This is cosmetic.
- **TapScale on web:** `onAccessibilityAction` was not verified on RN-Web. Where keyboard or screen-reader activation matters on web, use `PressableScale`.
