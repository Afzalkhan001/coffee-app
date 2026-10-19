# Reanimated 4.5.1 + Worklets 0.10.1 + Gesture Handler 2.32: cheat sheet

Verified for Ember Roast on 2026-10-07 with these installed versions: `react-native-reanimated@4.5.1`, `react-native-worklets@0.10.1`, `react-native-gesture-handler@2.32.0`, `react-native-svg@15.15.4`, `react-native-web@0.21.3`, `react-native-screens@4.26.2`, `expo@57.0.27`, `expo-router@57.0.25`, `babel-preset-expo@57.0.14`, `babel-plugin-react-compiler@1.0.0`, `typescript@6.0.3`, React Compiler on.

> **The online Reanimated docs track the newest release (4.6/4.7 at the time of writing), not 4.5.1.** Some pages already describe APIs that 4.5.1 does not have. One example: CSS transition callbacks are documented as `onCSSTransitionEnd` component props, but in 4.5.1 they are web-only style keys (§5). When the docs and `node_modules` disagree, trust `node_modules/react-native-reanimated/src`.

**How this was checked.** Every claim was checked against the installed source under `node_modules` and against the official docs. On top of that:

- Each snippet in sections 2–10 was type-checked with the project's TypeScript and `expo/tsconfig.base`.
- Each snippet was also transformed with `babel-preset-expo` and React Compiler turned on, for both `ios` and `web`.
  - Result: React Compiler optimized every component, and the worklets were generated.
- Not done: the app was not run on a device, Expo Go or a browser. The behaviour notes come from source and docs, not from watching it run.

Tags: **[src]** = read in `node_modules`, **[doc]** = official docs, **[test]** = checked by the tsc or babel runs above.

Project tokens already exist. Use them; don't redefine them.
- `springs` in `src/theme/index.ts` already sets `mass: 1`. Keep it that way (see §2).
- `durations.stagger = 40`.
- `haptic.*` lives in `src/lib/haptics.ts` and is a no-op on web.
- `PressableScale` lives in `src/components/ui/PressableScale.tsx`. It already follows these rules.
- `src/app/_layout.tsx` already wraps the app in `GestureHandlerRootView`. expo-router does **not** add one for you [src].

---

## 0. The 12 rules (read this if nothing else)

1. **Don't add a `babel.config.js` for Reanimated.** `babel-preset-expo` adds `react-native-worklets/plugin` automatically (§1).
2. **Use `sv.get()` / `sv.set(v)` everywhere and never `.value`.** Writing `.value` in an event handler makes React Compiler silently skip the whole component [test] (§11).
3. **Go from UI to JS with `scheduleOnRN(fn, ...args)` from `react-native-worklets`.** `runOnJS(fn)(args)` and `runOnUI` are deprecated (§3).
4. **`withSpring`'s default `mass` is 4 in v4, and the default config is `{ mass: 4, damping: 120, stiffness: 900 }`.** Always pass `mass: 1` with the DESIGN.md presets. `springs.*` already does (§2).
5. **Don't mix `stiffness`/`damping` with `duration`/`dampingRatio`.** It's a TypeScript error [test], and at runtime the duration-based keys win.
6. **On native, `measure()` and `scrollTo()` only work on the UI runtime.** Called from JS, `measure` returns `null` and `scrollTo` silently does nothing [src]. Wrap them in `scheduleOnUI` (§3, §7).
7. **Don't use shared element transitions (`sharedTransitionTag`).** They need a static flag and a native rebuild, they don't work in Expo Go, and there's no web support. Use the manual measure-and-fly recipe (§6).
8. **`springify()` is ignored on web for layout animations.** Add `.easing(Easing.bezier(...))`: native ignores it when springified, and web uses it (§4).
9. **For `withInitialValues`, use the array form `{ transform: [{ translateY: 12 }] }`.** The types mark it `@deprecated` (the flat form is the typed one), but it still compiles and works on both native and web. The flat `{ translateY: 12 }` form works on native but is silently dropped on web, because it's emitted as the invalid CSS `translateY: 12;` [src].
10. **`useReducedMotion()` is a static boolean read once at launch.** Reanimated animations and layout animations skip automatically. CSS animations and gestures don't (§9).
11. **On web, `GestureDetector` defaults to `touchAction="none"`, which blocks page scroll.** Set `touchAction="pan-y"` on horizontal-swipe rows (§10).
12. **Create animated components, layout-animation builders and CSS keyframes at module scope, or in `useMemo`.**

---

## 1. Babel / Metro config

- **Auto-configured [src]:** `node_modules/babel-preset-expo/build/configs/expo.js` contains:
  ```js
  // Automatically add worklets or reanimated plugin when package is installed.
  if (options.worklets !== false && options.reanimated !== false) {
      const workletsPluginPath = resolveModule(api, 'react-native-worklets/plugin');
      if (workletsPluginPath) plugins.push([require(workletsPluginPath)]);
  }
  ```
  (That's the exact logic; the real file splits `plugins.push` over a few lines and has an `else if` fallback to `react-native-reanimated/plugin` for when `worklets: false` is passed.) React Compiler is pushed **first** ("Add compiler as soon as possible"), right after the codegen plugin. The worklets plugin runs later on the compiled output. Autoworkletization still works [test].
- The Expo docs say the same: "No additional configuration is required. Reanimated Babel plugin is automatically configured in babel-preset-expo" ([Expo v57 reanimated](https://docs.expo.dev/versions/v57.0.0/sdk/reanimated/)).
- **No babel.config.js and no metro.config.js are needed.**
  - If you ever create a babel config, keep it to `presets: ['babel-preset-expo']`. Don't also list `react-native-worklets/plugin`, or it runs twice.
  - `react-native-reanimated/plugin` is now only a re-export of the worklets plugin [src].
- Optional: `wrapWithReanimatedMetroConfig` from `react-native-reanimated/metro-config` only collapses Reanimated frames in stack traces. You can skip it.
- **Expo Go compatibility [src]:** `expo/bundledNativeModules.json` pins `react-native-reanimated: 4.5.1`, `react-native-worklets: 0.10.1`, `react-native-gesture-handler: ~2.32.0` and `react-native-svg: 15.15.4`. Those are exactly what's installed, so Expo Go works.
  - Reanimated's `compatibility.json` lists 4.5.x with RN 0.83–0.86 and worklets 0.10.x ([compatibility](https://docs.swmansion.com/react-native-reanimated/docs/guides/compatibility)).
- Reanimated 4 runs only on the New Architecture ([migration](https://docs.swmansion.com/react-native-reanimated/docs/guides/migration-from-3.x)).

---

## 2. Core API

### Spring config (v4) [src `animation/spring/springConfigs.ts`] [doc](https://docs.swmansion.com/react-native-reanimated/docs/animations/withSpring)

| key | default | note |
|---|---|---|
| `mass` | **4** | It was 1 in v3. Set `mass: 1` for the DESIGN.md presets. |
| `damping` / `stiffness` | **120 / 900** | Physics mode |
| `duration` / `dampingRatio` | 550 / 1 | Duration mode. `duration` is **perceptual**: the real time is about 1.5× |
| `clamp` | – | Only in duration mode: `{ min?, max? }` |
| `energyThreshold` | 6e-9 | Replaces `restDisplacementThreshold`/`restSpeedThreshold`, which were removed [test: TS error] |
| `overshootClamping` / `velocity` / `reduceMotion` | false / 0 / System | |

Exported presets: `GentleSpringConfig` (the default), `SnappySpringConfig` (note: it sets `overshootClamping: true`), `WigglySpringConfig` and `Reanimated3DefaultSpringConfig` (`damping 10, stiffness 100, mass 1`), each with a `…WithDuration` variant. All of them except `Reanimated3DefaultSpringConfig` use `mass: 4`. Don't use these with the DESIGN.md numbers; use `springs.*` from `@/theme`.

**Why `mass: 1` matters.** Damping ratio is ζ = damping / (2√(stiffness·mass)).
- `snappy` (18/260) with mass 1 gives ζ≈0.56. With the v4 default mass 4 it would be ζ≈0.28: twice as slow and very wobbly.
- With mass 1, `smooth` gives ζ≈0.82, `gentle` ζ≈1.19 (no overshoot) and `bouncy` ζ≈0.40.

```ts
// src/components/motion/hooks.ts (or wherever you keep motion helpers)
import { Easing, type WithTimingConfig } from 'react-native-reanimated';
import { durations } from '@/theme';

export const easeOutQuint = Easing.bezier(0.22, 1, 0.36, 1); // returns an EasingFunctionFactory, valid for `easing`
export const fadeTiming = { duration: durations.slow, easing: easeOutQuint } satisfies WithTimingConfig;
```

### Everything core in one component [test]
```tsx
import { useEffect } from 'react';
import { Text } from 'react-native';
import Animated, {
  cancelAnimation, Easing, Extrapolation, interpolate, interpolateColor,
  useAnimatedStyle, useDerivedValue, useSharedValue,
  withDelay, withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { colors, springs } from '@/theme';
import { fadeTiming } from '@/components/motion/hooks';

export function CoreDemo({ selected, label }: { selected: boolean; label: string }) {
  const progress = useSharedValue(0);  // useSharedValue also accepts a lazy initializer: useSharedValue(() => 0)
  const shakeX = useSharedValue(0);
  const badge = useSharedValue(1);
  const pulse = useSharedValue(0);

  // useDerivedValue returns a read-only DerivedValue. Use .get() only: .set() still exists in the
  // types (marked @deprecated, so it compiles) but writing to a derived value is a bug.
  const scale = useDerivedValue(() =>
    interpolate(progress.get(), [0, 1], [0.9, 1.08], Extrapolation.CLAMP), // CLAMP | EXTEND | IDENTITY
  );

  useEffect(() => {
    progress.set(withSpring(selected ? 1 : 0, springs.smooth));
  }, [selected, progress]);

  useEffect(() => {
    // withRepeat(anim, numberOfReps = 2, reverse = false, callback?, reduceMotion?) - reps <= 0 means infinite
    pulse.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false));
    return () => cancelAnimation(pulse);
  }, [pulse]);

  const shake = () => {
    // ±6px, 3 cycles (DESIGN.md "required group missing")
    shakeX.set(withSequence(
      withTiming(-6, { duration: 50 }),
      withRepeat(withTiming(6, { duration: 100 }), 5, true),
      withTiming(0, { duration: 50 }),
    ));
  };
  const popBadge = () => badge.set(withSequence(withSpring(1.35, springs.snappy), withSpring(1, springs.snappy)));
  const fadeInLater = () => progress.set(withDelay(120, withTiming(1, fadeTiming))); // withDelay(ms, anim, reduceMotion?)

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.get() }, { scale: scale.get() }],
    backgroundColor: interpolateColor(progress.get(), [0, 1], [colors.surface, colors.ink]), // 'RGB' default | 'HSV' | 'LAB'
  }));
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: badge.get() }] }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.get(), [0, 1], [0.6, 0]),
    transform: [{ scale: interpolate(pulse.get(), [0, 1], [1, 1.8]) }],
  }));

  return (
    <Animated.View style={cardStyle} onTouchEnd={() => { shake(); popBadge(); fadeInLater(); }}>
      <Animated.View style={badgeStyle} />
      <Animated.View style={ringStyle} />
      <Text>{label}</Text>
    </Animated.View>
  );
}
```
Signatures [src]:
- `withTiming(to, { duration = 300, easing = Easing.inOut(Easing.quad), reduceMotion }, cb?)`
- `withSpring(to, config?, cb?)`
- The completion callback is `(finished?: boolean, current?: AnimatableValue) => void`. The worklets plugin workletizes it automatically when it's written inline as the 3rd argument of `withTiming`/`withSpring` or the 4th of `withRepeat`.
- `withRepeat(anim, numberOfReps = 2, reverse = false, callback?, reduceMotion?)`
- `withDelay(delayMs, anim, reduceMotion?)`
- `withSequence(...anims)` or `withSequence(reduceMotion, ...anims)`
- `withClamp({ min?, max?, reduceMotion? }, anim)`
- `cancelAnimation(sv)` is asynchronous when called from JS on native (it's dispatched to the UI runtime). `useSharedValue` already cancels its animation on unmount.

---

## 3. Calling across threads (worklets 0.10)

| Deprecated (still exported) | Current, from `react-native-worklets` |
|---|---|
| `runOnJS(fn)(a, b)` | **`scheduleOnRN(fn, a, b)`** (not curried) |
| `runOnUI(worklet)(a)` | **`scheduleOnUI(worklet, a)`** |
| `executeOnUIRuntimeSync(w)(a)` | `runOnUISync(w, a)` **throws on web** [src `threads.ts`] |
| `runOnRuntime` | `scheduleOnRuntime` |

Sources [src]: `react-native-worklets/src/threads.native.ts` marks `runOnJS` and `runOnUI` with `@deprecated Use scheduleOnRN/scheduleOnUI`, and `runtimes.native.ts` marks `runOnRuntime` with `@deprecated Use scheduleOnRuntime`. Reanimated's own re-exports (`runOnJS`, `runOnUI`, `runOnRuntime`, `executeOnUIRuntimeSync`, `createWorkletRuntime`, `makeShareableCloneRecursive`) are all `@deprecated` in `react-native-reanimated/src/workletFunctions.ts`. Always import threading helpers from `react-native-worklets`. Docs: [scheduleOnRN](https://docs.swmansion.com/react-native-worklets/docs/threading/scheduleOnRN), [migration](https://docs.swmansion.com/react-native-reanimated/docs/guides/migration-from-3.x).

- Any function passed to `scheduleOnRN` **must be defined in RN-runtime scope**: the component body or module scope. It can't be created inside the worklet [doc].
- `setState` setters, store actions, `haptic.medium` and `router.push` (a plain function) are all fine.
- Both APIs work on web: they run on the same thread using `queueMicrotask` or `requestAnimationFrame`.

```tsx
import { useMemo, useState } from 'react';
import { Text } from 'react-native';
import Animated, { measure, useAnimatedReaction, useAnimatedRef, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { haptic } from '@/lib/haptics';
import { springs } from '@/theme';

export function ThreadsDemo({ onOpen }: { onOpen: (r: { x: number; y: number; w: number; h: number }) => void }) {
  const ref = useAnimatedRef<Animated.View>();
  const x = useSharedValue(0);
  const [step, setStep] = useState(0);

  // useMemo: React Compiler does NOT memoize an inline Gesture chain (verified, §11)
  const pan = useMemo(() => Gesture.Pan()
    .onChange((e) => { x.set(x.get() + e.changeX); })
    .onEnd(() => {
      if (Math.abs(x.get()) > 80) {
        scheduleOnRN(haptic.medium);   // UI -> JS
        scheduleOnRN(setStep, 1);      // args after the fn
      }
      x.set(withSpring(0, springs.snappy));
    }), [x]);

  const open = () => {
    scheduleOnUI(() => {               // JS -> UI (needed for measure on native)
      const m = measure(ref);
      if (m === null) return;
      scheduleOnRN(onOpen, { x: m.pageX, y: m.pageY, w: m.width, h: m.height });
    });
  };

  // Mirror UI state to React only when it crosses a threshold, never every frame.
  useAnimatedReaction(
    () => x.get() > 40,
    (isPast, wasPast) => {
      if (wasPast !== null && isPast !== wasPast) scheduleOnRN(setStep, isPast ? 2 : 0);
    },
  );

  return (
    <GestureDetector gesture={pan}>
      <Animated.View ref={ref} collapsable={false} onTouchEnd={open}><Text>{step}</Text></Animated.View>
    </GestureDetector>
  );
}
```

---

## 4. Layout animations: entering, exiting, layout

[entering/exiting doc](https://docs.swmansion.com/react-native-reanimated/docs/layout-animations/entering-exiting-animations) · [layout transitions doc](https://docs.swmansion.com/react-native-reanimated/docs/layout-animations/layout-transitions)

**Modifiers [src `ComplexAnimationBuilder.ts` / `BaseAnimationBuilder.ts`]:**
- Common: `.duration(ms)`, `.delay(ms)`, `.easing(fn)`, `.withCallback(finished => …)`, `.reduceMotion(ReduceMotion.X)`, `.withInitialValues({...})` and `.withTargetValues({...})`. The last two are typed per preset: `FadeInDown` only accepts `opacity`/`translateY`.
- `.randomDelay()` still exists but is **`@deprecated`** ("Use `.delay()` with `Math.random()` instead").
- Spring: `.springify(duration?)`, `.damping()`, `.stiffness()`, `.mass()`, `.dampingRatio()`, `.overshootClamping()` and `.energyThreshold()`.
- **`.restDisplacementThreshold()` and `.restSpeedThreshold()` are deprecated no-ops.**

**Gotchas [src]:**
- `springify()` uses the same defaults as `withSpring`, so the default mass is 4. **Always add `.mass(1)`** when you copy DESIGN.md damping and stiffness values.
- If you add `.duration()` to a springified builder, the spring switches to duration mode. `damping` and `stiffness` are then ignored.
- **Order matters:** `springify(duration?)` assigns `durationV = duration`, so `.duration(400).springify()` *erases* the 400. Call `springify()` first.
- `.easing()` only applies on native when the animation is **not** springified. Web always uses it (see the web notes below).
- **On web the default layout-animation easing is `linear`** (`getEasingFromConfig` in `web/componentUtils.ts`); on native it's `Easing.inOut(Easing.quad)`. Pass `.easing(...)` explicitly when you want native and web to look alike.

```ts
// src/components/motion/enter.ts  [test]
import { FadeIn, FadeInDown, LinearTransition, SlideInDown, ZoomIn } from 'react-native-reanimated';
import { durations, springs } from '@/theme';
import { easeOutQuint } from './hooks';

/** Stagger: fade + rise 12px. Spring on native; bezier CSS keyframe (0.3s) on web. */
export function enterUp(index = 0) {
  return FadeInDown.springify()
    .damping(springs.smooth.damping).stiffness(springs.smooth.stiffness).mass(1)
    .easing(easeOutQuint)                                  // ignored on native (springified), used on web
    .delay(Math.min(index, 10) * durations.stagger)        // cap so item 30 doesn't wait 1.2s
    .withInitialValues({ transform: [{ translateY: 12 }] }); // array form (flat `translateY` is dropped on web)
}
// Identical timing on native AND web (no spring):
export const enterUpTiming = (i: number) =>
  FadeInDown.duration(420).delay(i * durations.stagger).easing(easeOutQuint)
    .withInitialValues({ transform: [{ translateY: 12 }] });

export const enterFade = (i = 0) => FadeIn.duration(durations.slow).easing(easeOutQuint).delay(i * durations.stagger);
export const layoutSpring = LinearTransition.springify().damping(springs.smooth.damping).stiffness(springs.smooth.stiffness).mass(1);
export const sheetEnter = SlideInDown.springify().damping(springs.smooth.damping).stiffness(springs.smooth.stiffness).mass(1);
export const badgeEnter = ZoomIn.springify().damping(springs.snappy.damping).stiffness(springs.snappy.stiffness).mass(1);
```
`FadeInDown` starts 25px **below** and rises, on both native and web [src]. The scale 0.98 → 1 part of the DESIGN.md stagger isn't available on `FadeInDown`: it only supports opacity and translateY. Drop it, or use a `Keyframe` on native only.

```tsx
import Animated, { FadeIn, FadeOut, LayoutAnimationConfig } from 'react-native-reanimated';

// Grid / list stagger + spring collapse when a row is removed (Cart)  [test]
<LayoutAnimationConfig skipEntering={!animateOnMount}>   {/* skip entrance on re-mount / back nav */}
  {items.map((item, i) => (
    <Animated.View key={item.id} entering={enterUp(i)} exiting={FadeOut.duration(160)} layout={layoutSpring}>
      …
    </Animated.View>
  ))}
</LayoutAnimationConfig>

// FlatList: layout transitions for cells via itemLayoutAnimation (CellRendererComponent is reserved)
<Animated.FlatList
  data={items}
  keyExtractor={(it) => it.id}
  itemLayoutAnimation={layoutSpring}
  renderItem={({ item, index }) => (
    <Animated.View entering={FadeIn.delay(Math.min(index, 8) * durations.stagger)} exiting={FadeOut}>…</Animated.View>
  )}
/>
```
- `skipEnteringExitingAnimations` on `Animated.FlatList`: **any value, even `false`, turns skipping on.** The source checks `=== undefined`, then wraps the list in `<LayoutAnimationConfig skipEntering skipExiting>`. Only pass the prop when you want to skip.
- `LayoutAnimationConfig skipEntering` only skips children that are present when the wrapper mounts. Items added later still animate in.
- **Put `exiting` on the root of the subtree that gets removed**, which is the same element that carries `layout`. On web an `exiting` on a nested child of a removed parent is animated inside a detached node, so you never see it. In the FlatList above, the cell wrapper is the removed root, so the child's `exiting` is not reliable on web.

Other transitions: `SequencedTransition`, `FadingTransition`, `JumpingTransition`, `CurvedTransition` and `EntryExitTransition.entering(a).exiting(b)`. All six have web implementations (`layoutReanimation/web/transition/*`). `combineTransition` no longer exists (it isn't exported from 4.5.1).

**Web status [src `layoutReanimation/web/*`]:** all predefined entering, exiting and layout animations work on web, implemented as CSS keyframes.
- Supported on web: `duration`, `delay`, `easing`, `randomDelay`, `withCallback`, `reduceMotion` and `withInitialValues` (array transform form).
  - `easing` must be a named easing or `Easing.bezier(...)`. Anything else falls back to linear with a warning, and no `.easing()` at all means linear.
  - `Easing.bezier` is detected through the worklet's `__closure` (`maybeGetBezierEasing`). I confirmed that babel-preset-expo emits that closure for web dev bundles.
- `springify()` and the other spring modifiers are **ignored on web**, and the animation runs as a CSS keyframe with the given or default duration (0.3s). The docs say: "Spring-based animations are yet to be introduced to the web."
- Custom entering functions (worklets) aren't supported on web. `Keyframe` is, but per-keyframe `easing` on web only maps the named easings (linear, ease, quad, cubic, sin, circle, exp).
- If the element has its own `transform` or `opacity` style, the layout animation may overwrite it, and the console warns about this. Put the layout animation on a wrapper `Animated.View`.

---

## 5. CSS animations and transitions (Reanimated 4)

[transitions overview](https://docs.swmansion.com/react-native-reanimated/docs/css-transitions/overview) · [transitionProperty](https://docs.swmansion.com/react-native-reanimated/docs/css-transitions/transition-property) · [animationName](https://docs.swmansion.com/react-native-reanimated/docs/css-animations/animation-name)

**When to use which.** From the docs: "Reach for CSS transitions whenever an animation is driven by state". Use shared values for "frame-by-frame control (gesture-driven or scroll-driven interactions, screen transitions, or several animations orchestrated together)".
- Passing a shared value inline won't trigger a transition, because updating a shared value doesn't re-render.
- Timing functions are bezier, `linear()` or `steps()`. **There are no springs.**
- It works on Android, iOS and web. On web it's real CSS, so it's the cheapest option there.
- In Ember Roast terms:
  - **CSS** for chip and size-circle colours, mode-card border colour, the pulse ring, steam drift, the idle 3° hero rotation and the skeleton shimmer.
  - **Shared values** for press scale, the size-indicator slide (spring), the tab pill, the odometer, fly-to-cart, the pager, scroll effects and swipe rows.

```tsx
import type { ReactNode } from 'react';
import { Pressable, Text } from 'react-native';
import Animated, { css, cubicBezier, useReducedMotion, type CSSAnimationKeyframes } from 'react-native-reanimated';
import { colors } from '@/theme';

const easeOutQuintCSS = cubicBezier(0.22, 1, 0.36, 1);   // also: linear(...points), steps(n, 'jump-end'), 'ease-in-out'

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <Animated.View style={{
        backgroundColor: selected ? colors.ink : colors.surface,
        borderColor: selected ? colors.ink : colors.line,
        borderWidth: 1,
        transitionProperty: ['backgroundColor', 'borderColor'], // avoid 'all' (perf). Discrete props can't transition.
        transitionDuration: 220,                                  // number = ms, or '220ms' / '0.22s'
        transitionTimingFunction: easeOutQuintCSS,
        // onTransitionEnd: (e) => {}  // style key, fires on WEB ONLY in 4.5.1 (see below)
      }}>
        <Text>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const drift: CSSAnimationKeyframes = {                      // module scope
  from: { transform: [{ rotate: '-3deg' }, { translateY: 0 }] },
  to: { transform: [{ rotate: '3deg' }, { translateY: -6 }] },
};
const shimmer = css.keyframes({ from: { transform: [{ translateX: -200 }] }, to: { transform: [{ translateX: 200 }] } });
const styles = css.create({
  shimmer: { animationName: shimmer, animationDuration: '1.2s', animationIterationCount: 'infinite', animationTimingFunction: 'linear' },
});

export function IdleDrift({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();                  // CSS animations do NOT auto-respect reduce motion
  return (
    <Animated.View style={{
      animationName: reduceMotion ? 'none' : drift,
      animationDuration: '6s',
      animationIterationCount: 'infinite',
      animationDirection: 'alternate',
      animationTimingFunction: 'ease-in-out',
    }}>{children}</Animated.View>
  );
}
export const Shimmer = () => <Animated.View style={styles.shimmer} />;
```
- Other props: `animationDelay`, `animationFillMode`, `animationPlayState: 'paused'`, and arrays of names with matching arrays of durations.
- **Transition events are web-only in 4.5.1 [src].**
  - `onTransitionRun`, `onTransitionStart`, `onTransitionEnd` and `onTransitionCancel` go **inside the `style` object**, as in the `Chip` example above. They aren't component props.
  - `css/utils/props.ts` pulls them out of the style. Only `css/web/managers/CSSManager.ts` uses them; the native `CSSManager` drops them.
  - The online docs' `onCSSTransitionEnd` *prop* doesn't exist in 4.5.1 (TS error).
  - Don't drive app logic from them. Use a shared-value animation with a `withTiming(..., cb)` callback if you need a completion hook on native.
- `transitionDuration`/`animationDuration` accept `number` (ms), `'220ms'` or `'0.22s'` (`TimeUnit`).
- CSS on react-native-svg components is turned on by default through the static flag `EXPERIMENTAL_CSS_ANIMATIONS_FOR_SVG_COMPONENTS: true` [src `staticFlags.json`]. The docs give the default as `true` from 4.4.0 on.
  - On native, CSS configs exist for Circle, Ellipse, Image, Line, LinearGradient, Path, Pattern, Polygon, Polyline, RadialGradient, Rect and Text.
  - On web, only Circle, Ellipse, Image, Path and Rect get geometry props. `line`/`polygon`/`polyline`/`g`/`text` only get the common props (fill, stroke, opacity…) [src `css/svg/init.web.ts`].
- The types also allow pseudo-selector values (`{ default: x, ':active': y }`) in CSS styles. That's newer API, not needed here, and not verified at runtime.

---

## 6. Shared element transitions: don't use them; use measure + fly

[status doc](https://docs.swmansion.com/react-native-reanimated/docs/shared-element-transitions/overview) · [feature flags](https://docs.swmansion.com/react-native-reanimated/docs/guides/feature-flags)

- The docs call it "experimental … not recommended for production use yet". It supports native stack only, and **web isn't supported**.
- It needs `package.json → "reanimated": { "staticFeatureFlags": { "ENABLE_SHARED_ELEMENT_TRANSITIONS": true } }` plus a native rebuild. Static flags are **not available in Expo Go** [doc].
- In the installed code, `ENABLE_SHARED_ELEMENT_TRANSITIONS` defaults to `false`. `AnimatedComponent._configureSharedTransition()` returns early when it's off, so a `sharedTransitionTag` prop silently does nothing [src].
- **Verdict:** use the manual approach. The project contract already plans for it: `setHeroOrigin`/`takeHeroOrigin` exist, and `product/[id]` has a transparent `contentStyle`.

### Recipe A (recommended, matches the contract): the detail screen flies its own hero [test]
```ts
// src/components/motion/heroTransition.ts
import type { RefObject } from 'react';
import type { View } from 'react-native';
export type WindowRect = { x: number; y: number; width: number; height: number };
const origins = new Map<string, WindowRect>();
export function setHeroOrigin(id: string, rect: WindowRect) { origins.set(id, rect); }
/** Read-once. Call from a useState initializer, not the render body. */
export function takeHeroOrigin(id: string) { const r = origins.get(id); origins.delete(id); return r; }
/** JS-side; works on native + web (RNW implements measureInWindow). */
export function measureInWindowAsync(ref: RefObject<View | null>): Promise<WindowRect | null> {
  return new Promise((resolve) => {
    const node = ref.current;
    if (!node) { resolve(null); return; }
    node.measureInWindow((x, y, width, height) => resolve(width > 0 ? { x, y, width, height } : null));
  });
}
```
```tsx
// Card
const imageRef = useRef<View>(null);
const open = async () => {
  const rect = await measureInWindowAsync(imageRef);
  if (rect) setHeroOrigin(id, rect);
  router.push({ pathname: '/product/[id]', params: { id } });
};
<PressableScale onPress={open}>
  <View ref={imageRef} collapsable={false} style={styles.cardImage}>
    <Image source={uri} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
  </View>
</PressableScale>

// Detail screen (headerShown:false + transparent contentStyle => screen (0,0) == window (0,0))
const { id } = useLocalSearchParams<{ id: string }>();
const { width } = useWindowDimensions();
const reduced = useReducedMotion();
const [origin] = useState(() => takeHeroOrigin(id));
const t = useSharedValue(origin && !reduced ? 0 : 1);
useEffect(() => { t.set(withSpring(1, springs.gentle)); }, [t]);   // gentle is overdamped: no overshoot

const heroStyle = useAnimatedStyle(() => {
  const p = t.get();
  if (!origin) return { left: 0, top: 0, width, height: HERO_HEIGHT, borderRadius: 0 };
  return {
    left: interpolate(p, [0, 1], [origin.x, 0]),
    top: interpolate(p, [0, 1], [origin.y, 0]),
    width: interpolate(p, [0, 1], [origin.width, width]),
    height: interpolate(p, [0, 1], [origin.height, HERO_HEIGHT]),
    borderRadius: interpolate(p, [0, 1], [origin.width / 2, 0]),   // circular crop -> full bleed
  };
});
const backdropStyle = useAnimatedStyle(() => ({ opacity: interpolate(t.get(), [0, 0.6], [0, 1], Extrapolation.CLAMP) }));

<View style={StyleSheet.absoluteFill}>
  <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }, backdropStyle]} />
  <Animated.View style={[{ position: 'absolute', overflow: 'hidden' }, heroStyle]}>
    <Image source={uri} style={StyleSheet.absoluteFill} contentFit="cover" />
  </Animated.View>
  <Animated.View entering={SlideInDown.delay(160).springify().damping(springs.smooth.damping).stiffness(springs.smooth.stiffness).mass(1)} style={styles.sheet} />
</View>
```
Notes:
- The root layout currently uses `animation: 'fade'` for `product/[id]`. The native fade also fades the flying image, so it won't look solid at its origin.
  - Better: `animation: 'none'`, and let the in-screen `backdropStyle` do the fade.
  - The valid values are react-native-screens' `StackAnimationTypes`: `'default' | 'fade' | 'fade_from_bottom' | 'none' | 'ios_from_right' | …` [src].
- On web the stack doesn't animate, so recipe A behaves the same there.
- Animating `left`, `top`, `width` and `height` breaks the "transform/opacity only" rule. It's a deliberate exception: one short-lived absolute view.
- If you prefer UI-thread measuring, `scheduleOnUI(() => { const m = measure(animatedRef); scheduleOnRN(go, m && {...}) })` works too (§3). `pageX`/`pageY` are window coordinates (`getBoundingClientRect` on web).

### Recipe B: global overlay above the Stack
Render a "flyer" inside `OverlayHost`, after its `children`, so it sits above the native stack.

- **Mount it with a fresh `key` for each flight**, so its shared values start at the origin rect: `useSharedValue(from.x)` and so on.
- Then spring to the known hero rect `{ x: 0, y: insets.top, w: windowWidth, h: HERO_HEIGHT }` and fade out on completion: `withSpring(…, cb)` then `withTiming(0, fadeTiming, done => scheduleOnRN(clear))`.
- Set `pointerEvents: 'none'` in the style. Use the style property, not the deprecated view prop, so react-native-web doesn't warn.

This approach also suits fly-to-cart, which follows an arc: `x` uses linear timing while `y` uses `withTiming(…, { easing: Easing.in(Easing.quad) })`.

---

## 7. Refs, measuring, scroll

- `useAnimatedRef<T>()`: attach it with `ref=`.
  - `measure(ref)` returns `{ x, y, width, height, pageX, pageY } | null`.
  - "measure is implemented only on the UI thread … wrap with scheduleOnUI" ([measure](https://docs.swmansion.com/react-native-reanimated/docs/advanced/measure)).
  - On Android, view flattening makes it return `null` with a warning, so put `collapsable={false}` on the measured view [src].
  - On web it reads the DOM and works from any thread [src].
- `scrollTo(ref, x, y, animated)`: on native this is a no-op unless it runs on the UI runtime [src `dispatchCommand.ts`].
- **`useScrollViewOffset` is a deprecated alias. Use `useScrollOffset(ref, optionalSV?)`** [src `index.ts`]. It works on native and web.
- Prefer `useAnimatedRef` + `useScrollOffset(ref)` over `<Animated.ScrollView scrollViewOffset={sv}>`. The prop only works when you also pass an **animated** ref [src `component/ScrollView.tsx`].
  - That code creates its own ref only when `ref === null`.
  - In React 19 a missing `ref` prop is `undefined`, so in practice you must pass `ref={useAnimatedRef()}` yourself.
- `Animated.ScrollView` defaults `scrollEventThrottle` to 1 [src].

```tsx
import Animated, { Extrapolation, interpolate, scrollTo, useAnimatedRef, useAnimatedScrollHandler,
  useAnimatedStyle, useScrollOffset, useSharedValue } from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';

// Home: header compress + greeting fade  [test]
const scrollRef = useAnimatedRef<Animated.ScrollView>();
const scrollY = useScrollOffset(scrollRef);
const headerStyle = useAnimatedStyle(() => ({
  height: interpolate(scrollY.get(), [0, 56], [120, 64], Extrapolation.CLAMP),
}));
const greetingStyle = useAnimatedStyle(() => ({
  opacity: interpolate(scrollY.get(), [0, 40], [1, 0], Extrapolation.CLAMP),
  transform: [{ translateY: interpolate(scrollY.get(), [0, 40], [0, -8], Extrapolation.CLAMP) }],
}));
const scrollToGroup = (y: number) => scheduleOnUI(() => { scrollTo(scrollRef, 0, y, true); });
<Animated.ScrollView ref={scrollRef}>…</Animated.ScrollView>

// Product detail: parallax 0.5x + pull-down stretch (handler form: also onBeginDrag/onEndDrag/onMomentumBegin/onMomentumEnd)
// Layout assumed: hero is position:absolute at top:0 BEHIND the ScrollView (height HERO_HEIGHT);
// the ScrollView content starts with paddingTop: HERO_HEIGHT so the sheet scrolls over the hero.
const y = useSharedValue(0);
const onScroll = useAnimatedScrollHandler({ onScroll: (e) => { y.set(e.contentOffset.y); } });
const heroStyle = useAnimatedStyle(() => {
  const v = y.get();
  return {
    transform: [
      // v > 0: hero slides up at 0.5x the content speed.
      // v < 0 (pull-down): with a centre scale origin, moving down by |v|/2 keeps the top edge at 0,
      // and scale 1 + |v|/H makes the bottom edge follow the content.
      { translateY: -v * 0.5 },
      { scale: v < 0 ? 1 + -v / HERO_HEIGHT : 1 },
    ],
    opacity: interpolate(v, [0, 260], [1, 0.2], Extrapolation.CLAMP),
  };
});
<Animated.ScrollView onScroll={onScroll}>…</Animated.ScrollView>
```
- **Pull-down stretch only happens on iOS.** Negative `contentOffset.y` needs bounce overscroll. Android (stretch/glow overscroll) and web (apart from Safari's rubber-band) don't report `y < 0`, so the parallax half still works there but the stretch doesn't.
- If you put the hero *inside* the ScrollView instead, the signs change. Use `translateY: v < 0 ? v / 2 : v * 0.5` with the same scale.
- `Animated.FlatList` takes the same `onScroll` handler, plus `itemLayoutAnimation` and `skipEnteringExitingAnimations`.
- To get a ref for `Animated.FlatList`, use `useAnimatedRef<Animated.FlatList<Item>>()`.

---

## 8. SVG with useAnimatedProps (path drawing, moving dot)

[animating SVG](https://docs.swmansion.com/react-native-reanimated/docs/guides/animating-svg) · [useAnimatedProps](https://docs.swmansion.com/react-native-reanimated/docs/core/useAnimatedProps)

- `useAnimatedProps(updater, deps?, adapters?)`.
- `fill` and `stroke` are in Reanimated's colour list and get processed automatically [src `Colors.ts`].
- **Web works [src].**
  - Reanimated's web updater calls `setNativeProps` on the component.
  - react-native-svg's `WebShape.setNativeProps` writes each prop as a DOM attribute, so `strokeDashoffset` becomes `stroke-dashoffset`, and `cx`/`cy` become attributes.
- `getTotalLength()` and `getPointAtLength()` only exist on native `Shape` refs; there's no web equivalent on the component. So:
  - **Hardcode path lengths**, measured once in browser devtools with `path.getTotalLength()`. A small overestimate is fine.
  - **Define the steam wave mathematically.** The same function then builds the path and places the dot.

```tsx
import { useEffect } from 'react';
import Animated, { useAnimatedProps, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '@/theme';
import { easeOutQuint } from '@/components/motion/hooks';

const AnimatedPath = Animated.createAnimatedComponent(Path);     // module scope
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function DrawnStroke({ d, length, delay = 0 }: { d: string; length: number; delay?: number }) {
  const drawn = useSharedValue(0);
  useEffect(() => {
    drawn.set(withDelay(delay, withTiming(1, { duration: 1200, easing: easeOutQuint }))); // no setTimeout
  }, [drawn, delay]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - drawn.get()) }));
  return (
    <AnimatedPath d={d} fill="none" stroke={colors.peach} strokeWidth={1.75} strokeLinecap="round"
      strokeDasharray={[length, length]} animatedProps={animatedProps} />
  );
}

const W = 240, H = 40, AMP = 8, WAVES = 2;
function waveY(x: number) {
  'worklet';                                       // callable from JS (path build) and UI (dot)
  return H / 2 + AMP * Math.sin((x / W) * Math.PI * 2 * WAVES);
}
const WAVE_D = Array.from({ length: 61 }, (_, i) => {
  const x = (i / 60) * W;
  return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${waveY(x).toFixed(1)}`;
}).join(' ');

export function SteamProgress({ progress }: { progress: SharedValue<number> }) {  // progress = pager offset / pageWidth / (pages-1)
  const dotProps = useAnimatedProps(() => {
    const x = progress.get() * W;
    return { cx: x, cy: waveY(x) };
  });
  return (
    <Svg width={W} height={H}>
      <Path d={WAVE_D} stroke={colors.white} strokeWidth={2} fill="none" />
      <AnimatedCircle r={5} fill={colors.peach} animatedProps={dotProps} />
    </Svg>
  );
}
```
- Progress arc around the arrow button: use a `Circle` with `strokeDasharray={[C, C]}`, where `C = 2πr`, and set `strokeDashoffset = C * (1 - p)`. Add `rotation={-90}` with `origin` at the centre so the arc starts at 12 o'clock.
- CSS keyframes also work on SVG (§5). On web, only attributes that map to real CSS properties animate there. `strokeDashoffset`, `cx`, `cy` and `r` are fine [doc].

---

## 9. Reduce motion

- `useReducedMotion(): boolean` reads the system setting **at app start** (`matchMedia('(prefers-reduced-motion: reduce)')` on web). Changing the setting doesn't re-render anything [src] [doc](https://docs.swmansion.com/react-native-reanimated/docs/device/useReducedMotion).
- `ReduceMotion` is an enum: `System` (the default), `Always` or `Never`. Every animation function takes it:
  - `{ reduceMotion }` in the `withTiming`/`withSpring` config
  - the last argument of `withDelay` and `withRepeat`
  - the first argument of `withSequence`
  - `.reduceMotion()` on layout builders
- What happens under `System` when the setting is on [src `animation/util.ts`, `repeat.ts`]:
  - Animations jump straight to their end value.
  - A reversed infinite `withRepeat` doesn't start at all, so idle pulses stay still.
  - Layout animations are skipped.
  - A non-reversed (or odd-count reversed) `withRepeat` runs the inner animation once, which jumps to its end value, and then stops. The `CoreDemo` pulse ends at `1`, so its ring sits at opacity 0, which is fine.
- **Not automatic:** CSS animations and transitions (gate them, as in §5; there's no reduce-motion handling anywhere under `src/css`), gesture-driven values, and parallax or drift you compute yourself in `useAnimatedStyle`. Per DESIGN.md, turn parallax and drift off when `reduced` is true.
- `<ReducedMotionConfig mode={ReduceMotion.Never} />` overrides the setting globally. It's for debugging and prints a dev warning.
  - It changes what animations do, but **`useReducedMotion()` keeps returning the launch-time system value**, because it reads a module-level constant.
  - So components that gate on the hook won't follow the override.

---

## 10. Gesture Handler 2.32

- Use the **2.x docs**: [gesture](https://docs.swmansion.com/react-native-gesture-handler/docs/2.x/gestures/gesture), [GestureDetector](https://docs.swmansion.com/react-native-gesture-handler/docs/2.x/gestures/gesture-detector) and [pan](https://docs.swmansion.com/react-native-gesture-handler/docs/2.x/gestures/pan-gesture).
- The unversioned docs now describe **v3**: `usePanGesture({...})`, `useTapGesture`, `disableReanimated`. **None of these exist in 2.32** [src: no `use*Gesture` exports in `src/index.ts`]. Don't copy v3 examples.
- API: `Gesture.Pan()`, `.Tap()`, `.LongPress()`, `.Fling()`, `.Pinch()`, `.Rotation()`, `.Native()`, `.Manual()`, `.Hover()`. Compose with `Gesture.Simultaneous(...)`, `Gesture.Exclusive(...)` (the first argument wins priority) or `Gesture.Race(...)`.
  - Callbacks: `onBegin`, `onStart`, `onUpdate`, `onChange` (provides `changeX`/`changeY`), `onEnd(e, success)` and `onFinalize(e, success)`.
  - Pan config: `activeOffsetX/Y([min,max])`, `failOffsetX/Y`, `minDistance`, `activateAfterLongPress(ms)`.
  - Tap: `maxDuration` defaults to **500ms** [src]. `LongPress`: `minDuration(ms)`.
  - Cross-detector relations: `.simultaneousWithExternalGesture()`, `.requireExternalGestureToFail()`, `.blocksExternalGesture()`.
  - `.runOnJS(true)` forces callbacks onto the JS thread.
- **Autoworkletization [src `worklets/plugin`]:** callbacks written inline in a chain that starts with `Gesture.X()` become worklets automatically.
  - Wrapping the whole chain in `useMemo` still works [test].
  - A callback defined separately needs `'worklet'` as its first line. Callbacks wrapped in `useCallback` are **not** auto-workletized.
- `GestureDetector` takes one child, and you can't reuse one gesture instance across detectors.
  - Web-only props: `touchAction` (default `'none'`), `userSelect` (default `'none'`) and `enableContextMenu`.
- `GestureHandlerRootView` must wrap the app. It's already in `_layout.tsx`.

### Press with scale: use RN `Pressable` + a shared value (already done in `PressableScale.tsx`)
Why `Pressable` and not a GH tap:
- It cancels correctly when a ScrollView starts scrolling.
- It handles accessibility, and focus and hover on web.
- The animation still runs on the UI thread.

```tsx
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);   // module scope
const pressed = useSharedValue(0);
const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: interpolate(pressed.get(), [0, 1], [1, 0.97]) }],
  shadowOpacity: interpolate(pressed.get(), [0, 1], [0.08, 0.16]),      // "deepens its shadow": iOS ONLY (see below)
}));
<AnimatedPressable
  onPressIn={() => pressed.set(withSpring(1, springs.snappy))}
  onPressOut={() => pressed.set(withSpring(0, springs.bouncy))}           // ζ≈0.40 → visible release overshoot (what PressableScale uses)
  style={[style, animatedStyle]}
/>
```
- **The animated `shadowOpacity` only works on iOS.**
  - On web, Reanimated writes animated styles through RNW's `createReactDOMStyle`, which doesn't convert `shadow*` to `box-shadow` (that happens in RNW's StyleSheet `preprocess`). The value is dropped.
  - Android ignores `shadowOpacity` and uses `elevation`.
  - For a cross-platform "deepen", keep a static `shadows.strong` layer behind the card (same radius and background) and animate that layer's `opacity` from 0 to 1. Alternatively, animate `boxShadow`, which Reanimated 4 supports in `useAnimatedStyle` but which I haven't verified here.
- The real `PressableScale.tsx` animates `scale` directly: `snappy` on press-in, `bouncy` on release, skipping press-in when `useReducedMotion()` is on. It has no shadow animation yet.
If you need a press that stays entirely on the UI thread, for example inside a composed gesture [test]:
```tsx
const tap = useMemo(() => Gesture.Tap()
  .maxDuration(10_000)                                   // otherwise a slow press fails after 500ms
  .onBegin(() => { s.set(withSpring(0.97, springs.snappy)); })
  .onEnd((_e, success) => { if (success) scheduleOnRN(onPress); })
  .onFinalize(() => { s.set(withSpring(1, springs.snappy)); }), [s, onPress]);
```

### Swipe-to-delete row (Cart) [test]
```tsx
const REVEAL = 88, DELETE_AT = 160;
export function SwipeToDeleteRow({ onDelete, children }: { onDelete: () => void; children: ReactNode }) {
  const x = useSharedValue(0);
  const width = useSharedValue(0);
  const pan = useMemo(() => Gesture.Pan()
    .activeOffsetX([-12, 12])          // claim only clearly horizontal drags
    .failOffsetY([-8, 8])              // vertical drag -> list scrolls
    .onChange((e) => { x.set(Math.min(0, x.get() + e.changeX)); })
    .onEnd((e) => {
      if (x.get() < -DELETE_AT || e.velocityX < -1200) {
        x.set(withTiming(-width.get(), { duration: 180 }, (finished) => {
          if (finished) scheduleOnRN(onDelete);     // store removes item -> row `exiting`, siblings `layout`
        }));
        scheduleOnRN(haptic.medium);
      } else {
        x.set(withSpring(x.get() < -REVEAL / 2 ? -REVEAL : 0, springs.snappy));
      }
    }), [x, width, onDelete]);

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const actionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.get(), [-REVEAL, -16], [1, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(x.get(), [-REVEAL, 0], [1, 0.6], Extrapolation.CLAMP) }],
  }));
  return (
    // `layout` + `exiting` on the SAME root (the element the parent removes) -> works on web too (§4)
    <Animated.View layout={layoutSpring} exiting={FadeOut.duration(150)} onLayout={(e) => width.set(e.nativeEvent.layout.width)}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.danger, actionStyle]}><Text style={styles.dangerText}>Delete</Text></Animated.View>
      <GestureDetector gesture={pan} touchAction="pan-y">
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}
// Parent list: render <SwipeToDeleteRow key={item.id} …/> directly (no extra wrapper) -> siblings spring-collapse the gap.
```
- Alternative: `import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable'`. Its props include `renderRightActions`, `friction`, `rightThreshold`, `overshootRight` and `onSwipeableOpen(direction)`, and its ref has `close()`, `openRight()` and `reset()`.
- The legacy `Swipeable` export is the old Animated-based version and is marked `@deprecated use Reanimated version of Swipeable instead` [src]. Don't use it.
- `ReanimatedSwipeable` already renders its internal `GestureDetector`s with `touchAction="pan-y"` [src], so vertical page scroll still works on web.

Composition example [test]:
```tsx
const gesture = useMemo(() => {
  const doubleTap = Gesture.Tap().numberOfTaps(2).onEnd(() => { scheduleOnRN(onLike); });
  const singleTap = Gesture.Tap().onEnd(() => {});
  const longPress = Gesture.LongPress().minDuration(400).onStart(() => { scheduleOnRN(haptic.selection); });
  return Gesture.Exclusive(doubleTap, Gesture.Simultaneous(singleTap, longPress));
}, [onLike]);
```

---

## 11. React Compiler: rules (verified by compiling)

Source: the [useSharedValue doc](https://docs.swmansion.com/react-native-reanimated/docs/core/useSharedValue): "When working with the React Compiler, you should refrain from accessing and modifying the value property directly. Instead, use the get and set methods."

Results of running `babel-plugin-react-compiler@1.0.0` through `babel-preset-expo` [test]:

| Code | Result |
|---|---|
| `onPressIn={() => { s.value = withSpring(0.97) }}` | Compiler error "This value cannot be modified". babel-preset-expo passes `panicThreshold: 'NONE'` in production and leaves it unset in dev, where the compiler default is `'none'`. Either way the component is **silently left unoptimized** rather than failing the build. |
| `progress.value = …` where `progress` came in as a **prop** | Same bail-out, same "This value cannot be modified" event (re-verified) |
| `s.set(withSpring(0.97))` / `s.get()` | Compiles and memoizes normally |
| `useAnimatedStyle(() => ({ opacity: p.value }))` | Compiles, but use `.get()` anyway for consistency |
| `<Text>{sv.get()}</Text>` (reading during render) | The compiler **doesn't** flag it, but it's wrong: the value is read once and never updates. Use `useAnimatedReaction` + `scheduleOnRN(setState)`, or animated props |
| Inline `Gesture.Pan().onChange(...)` with no `useMemo` | Callbacks are workletized, but the compiler didn't memoize the gesture object: it's rebuilt every render (re-verified). Wrap gestures in `useMemo`, as the `GestureDetector` source comment asks ("Gesture config should be wrapped with useMemo") |
| `useMemo(() => Gesture.Tap().onBegin(...), [s])` | The compiler keeps the memo and the callbacks are still workletized |
| `withTiming(…, (finished) => {...})`, `scheduleOnUI(() => …)` | Workletized after compilation |

More rules:
- Make `.set(updater)` calls pure: `sv.set((v) => v + 1)` is allowed.
- Only write shared values in handlers, effects and worklets, never in the render body.
- Module-scope `createAnimatedComponent`, builders and keyframes keep render output stable.
- Escape hatch: put `'use no memo'` at the top of a component to opt it out of the compiler. The Expo preset keeps this directive [src].

---

## 12. Known web limitations (react-native-web 0.21)

[web support](https://docs.swmansion.com/react-native-reanimated/docs/guides/web-support)

1. **There's no UI thread.** Worklets run in JS on the main thread, so they're slower than native. For decorative loops (shimmer, pulse, steam, drift), prefer CSS animations, which compile to real CSS on web.
2. **Layout animations:**
   - `springify()` and the spring modifiers are ignored. You get a 0.3s CSS keyframe.
   - The default easing is linear unless you call `.easing()`.
   - Custom worklet entering functions aren't supported.
   - `Keyframe` per-frame `easing` only handles named easings; `Easing.bezier` silently becomes linear there.
   - Flat `withInitialValues` transform keys are dropped (use the `transform: [...]` array).
   - Animated `transform` or `opacity` on the same element can be overwritten, so use a wrapper.
   - An `exiting` nested inside a removed parent isn't visible (§4) [src].
3. **There are no shared element transitions** [doc].
4. **`runOnUISync` and `executeOnUIRuntimeSync` throw** on web [src].
5. **`measure()`** returns `offsetLeft`/`offsetTop` for `x`/`y` and `getBoundingClientRect` for `pageX`/`pageY`. Unlike native, it works on the JS thread [src].
6. **`useReducedMotion`** uses `matchMedia` once at startup [src].
7. **Static feature flags** come from the defaults in `staticFlags.json` on web, so you can't turn them on per app [src].
8. **GestureDetector** defaults to `touchAction="none"` and `userSelect="none"`. Set `touchAction="pan-y"` for horizontal swipes inside scrolling lists [doc].
9. **Haptics:** the project's `haptic.*` is already a no-op on web.
10. **CSS animations:** on web an SVG attribute only animates if it maps to a real CSS property. Polygon and Line geometry don't, so use `useAnimatedProps` for those [doc].
11. **Without the Babel plugin**, you'd have to pass dependency arrays to hooks on web. Not relevant here, because Expo always adds the plugin.
12. **Animated `shadow*` styles are dropped on web.** They go through `createReactDOMStyle`, which has no shadow conversion. Animate the opacity of a static shadow layer instead (§10) [src].
13. **CSS transition callbacks (`onTransitionEnd` etc., as style keys) fire on web only.** Native ignores them in 4.5.1 (§5) [src].
14. **Pull-down (negative offset) scroll effects are iOS-only** (§7).

---

### Source index (local)
- `node_modules/babel-preset-expo/build/configs/expo.js`: plugin order and auto-add of the worklets plugin
- `node_modules/react-native-reanimated/src/index.ts`: exports, including the deprecated `useScrollViewOffset`, `runOnJS` and `runOnUI`
- `node_modules/react-native-reanimated/src/animation/spring/springConfigs.ts`: spring defaults
- `node_modules/react-native-worklets/src/threads.native.ts` and `threads.ts` (web): `scheduleOnRN`/`scheduleOnUI` and the deprecations
- `node_modules/react-native-reanimated/src/featureFlags/staticFlags.json`: `ENABLE_SHARED_ELEMENT_TRANSITIONS: false`
- `node_modules/react-native-reanimated/src/layoutReanimation/web/*`: web layout-animation behaviour
- `node_modules/react-native-reanimated/src/platformFunctions/{measure,scrollTo,dispatchCommand}.ts`: UI-runtime-only on native
- `node_modules/react-native-svg/src/web/WebShape.ts`: web `setNativeProps` becomes `setAttribute`
- `node_modules/react-native-gesture-handler/src/index.ts`: 2.32 exports (no v3 hooks)
- `node_modules/expo/bundledNativeModules.json`: Expo Go version pins
- `node_modules/react-native-reanimated/src/layoutReanimation/animationBuilder/ComplexAnimationBuilder.ts`: `springify()` resets duration; easing only applies to `withTiming`
- `node_modules/react-native-reanimated/src/layoutReanimation/defaultAnimations/{Fade,types,utils}.ts`: typed `withInitialValues`, deprecated `transform` array form
- `node_modules/react-native-reanimated/src/css/utils/props.ts` + `css/{web,native}/managers/CSSManager.ts`: transition callbacks are style keys, wired on web only
- `node_modules/react-native-reanimated/src/css/svg/init.web.ts`: which SVG tags get CSS geometry on web
- `node_modules/react-native-reanimated/src/component/{ScrollView,FlatList}.tsx`: `scrollViewOffset` needs an animated ref; `skipEnteringExitingAnimations` checks `=== undefined`
- `node_modules/react-native-reanimated/src/ReanimatedModule/js-reanimated/index.ts`: web animated styles go through `createReactDOMStyle` (no `shadow*` conversion)
- `node_modules/react-native-gesture-handler/src/components/ReanimatedSwipeable/*`: props, `SwipeableMethods`, built-in `touchAction="pan-y"`
- `node_modules/react-native-screens/lib/typescript/types.d.ts`: `StackAnimationTypes`

---

## Verification notes

Second-pass review on 2026-10-07 by a skeptical reviewer. Every import, prop, option key and signature above was checked against `node_modules` (4.5.1 / 0.10.1 / 2.32.0 / RNW 0.21.3 / screens 4.26.2) and the official docs.

**Re-run checks.**
- **TypeScript.** All snippets in §2–§10, including the corrected ones, were rebuilt as complete components and type-checked with the installed TypeScript 6.0.3 and `expo/tsconfig.base`. Result: 0 errors.
  - Negative controls behave as described. Mixing `damping` with `duration`, using `restDisplacementThreshold`, `onCSSTransitionEnd`, or `FadeInDown.withInitialValues({ scale })` are all TS errors. `DerivedValue.set()` compiles because it's only deprecated.
- **React Compiler.** The claims in §11 were re-run through `babel-preset-expo` with `supportsReactCompiler: true`, on both ios and web.
  - `.value =` in a handler gives "This value cannot be modified" and the component is not memoized. The same happens when writing to a prop.
  - `.get()`/`.set()`, `useMemo(Gesture…)` and `scheduleOnUI(() => measure(...))` all compile, and their worklets are emitted.
  - An inline `Gesture.Pan()` is not memoized.
- **`Easing.bezier` on web.** I confirmed that the transformed `Easing.ts` carries a `factory.__closure` with `Bezier`, which is what web layout animations need to detect the curve.

**Corrections made.**
1. §7 parallax had mixed sign conventions: `v/2` for pull-down but `-v*0.5` for scroll-up. For a hero absolutely positioned behind the ScrollView, the correct value is `translateY: -v * 0.5` in both directions, with `scale = 1 + |v|/HERO_HEIGHT`. The old formula pulled the image *up* while the content moved down, leaving a gap. Added the inside-ScrollView variant and the note that pull-down only happens on iOS.
2. §5 CSS transition events: in 4.5.1 they are **style keys**, and only the web CSS manager reads them. Native drops them. The online docs' `onCSSTransition*` props are from a newer version and are a TS error here.
3. §4 `.randomDelay()` is `@deprecated`. Removed the unverifiable "`withTargetValues` was added in 4.4"; it exists in 4.5.1 and is typed per preset.
4. §4 added these gotchas:
   - `.duration(x).springify()` erases `x`.
   - Web layout animations default to **linear** easing.
   - `skipEnteringExitingAnimations={false}` still skips.
   - `exiting` must sit on the removed root, or you won't see it on web.
5. §10 swipe row: moved `layout` onto the row's root, next to `exiting`, instead of a parent wrapper, so the exit fade shows on web.
6. §10 press: animated `shadowOpacity` only works on iOS. Web drops it and Android ignores it. Release spring corrected to `springs.bouncy`, which is what `PressableScale.tsx` actually uses.
7. §3 `ThreadsDemo` now wraps its gesture in `useMemo`, matching the doc's own §11 rule.
8. §2 smaller fixes:
   - `DerivedValue` *does* have a deprecated `.set()`.
   - The callback signature also passes `current`.
   - `SnappySpringConfig` has `overshootClamping: true`, and the presets use mass 4.
   - `cancelAnimation` is only async when called from JS on native.
9. §9: a non-reversed `withRepeat` under reduce motion jumps to its end value once. `useReducedMotion()` ignores `<ReducedMotionConfig>`.
10. §11: the error text for writing to a prop is the same "This value cannot be modified". The compiler's default `panicThreshold` is `'none'`, so dev bail-outs are silent too.

**Confirmed as written.** These claims checked out:
- **Config and versions:** babel auto-config and plugin order, the Expo Go pins, and `compatibility.json`.
- **Springs:** the defaults (mass 4, damping 120, stiffness 900, `energyThreshold` 6e-9, 550ms perceptual duration).
- **Threads:** `scheduleOnRN`/`scheduleOnUI` signatures and web behaviour, and that `runOnUISync` throws on web.
- **Measure and scroll:** `measure`/`scrollTo` return early on the RN runtime, the web `measure` fields, `useScrollOffset` (with `useScrollViewOffset` as a deprecated alias), and `scrollEventThrottle = 1`.
- **Layout animations:** `FadeInDown` 25px, web flat-transform drop, and that shared element transitions stay off (flag `false`, early return, not in Expo Go, no web).
- **SVG:** web `setNativeProps` becomes `setAttribute`, and the CSS SVG static flag is `true`.
- **Gesture Handler:** no `use*Gesture` hooks in 2.32, Tap `maxDuration` 500ms, web `touchAction`/`userSelect` default to `'none'`, and the `ReanimatedSwipeable` path, props and methods.
- **Screens:** the `StackAnimationTypes` union.

**Still uncertain (not run on a device, in Expo Go or in a browser).**
- Whether nested `exiting` animations play on *native* Fabric when a parent unmounts. Avoid relying on it either way.
- Whether `boxShadow` animation works on all three platforms, as an alternative to the shadow-layer approach.
- The exact web behaviour of `Animated.FlatList` cell `exiting`.
- Whether Recipe A's `measureInWindow` coordinates line up exactly with the detail screen's (0,0) under Android edge-to-edge. Check on a device and adjust by `insets.top` if needed.
- That the native stack doesn't animate on web. This comes from react-native-screens' web implementation and wasn't observed directly.
