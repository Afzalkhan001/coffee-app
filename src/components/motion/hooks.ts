/**
 * Shared motion helpers — DESIGN.md §7. Springs come from `theme.springs` (mass 1 is explicit,
 * Reanimated 4 defaults to mass 4). Builders are reduced-motion aware and web-safe
 * (web layout animations ignore `springify()`, so web gets duration + easing instead).
 */
import { Platform, type ViewStyle } from 'react-native';
import {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  // Aliased on purpose: Reanimated's `useReducedMotion` is a static read of a value cached at
  // launch (no React state), so reading it once at module scope is safe.
  useReducedMotion as readReducedMotionSetting,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
  type AnimatedStyle,
  type SharedValue,
  type WithTimingConfig,
} from 'react-native-reanimated';
import { durations, springs } from '@/theme';

const IS_WEB = Platform.OS === 'web';
const REDUCED_MOTION = readReducedMotionSetting();

/** System Reduce Motion setting, read once at launch (same value `useReducedMotion()` returns). */
export const reducedMotionAtLaunch: boolean = REDUCED_MOTION;
/**
 * DESIGN §7 checklist #6: at most 8 items stagger in; anything later in the list appears instantly
 * (no entering animation at all), so long sections never wait 400ms + a spring to show up.
 */
export const MAX_STAGGERED = 8;

/** easeOutQuint — the only timing curve for opacity (DESIGN §7). */
export const easeOutQuint = Easing.bezier(0.22, 1, 0.36, 1);
/** Symmetric curve for progress-driven paths (fly-to-cart arc, line-art draw-on). */
export const easeInOutCubic = Easing.bezier(0.65, 0, 0.35, 1);
/** Standard opacity fade. */
export const fadeTiming = { duration: durations.base, easing: easeOutQuint } satisfies WithTimingConfig;

/** Entering builder returned by `enterUp` / `enterFade` / `popIn`. */
export type EntryAnimation = FadeInDown | FadeIn | ZoomIn;
/** Layout transition builder (`layout={layoutSpring}`). */
export type LayoutTransition = LinearTransition;
/** Exiting builder. */
export type ExitAnimation = FadeOut;

const staggerDelay = (index: number) => Math.min(Math.max(index, 0), MAX_STAGGERED) * durations.stagger;

/** Quick cross-fade used in place of movement when Reduce Motion is on. */
const reducedFade = (index: number) =>
  FadeIn.duration(durations.fast)
    .delay(staggerDelay(index) / 2)
    .reduceMotion(ReduceMotion.Never);

/**
 * Fade + rise entrance that is safe on web.
 *
 * Web: Reanimated 4.5.1 turns any entering builder with `withInitialValues` (or a `Keyframe`) into a
 * custom CSS keyframe, and its cleanup timer (≈5× duration later) calls `setElementPosition`, which
 * pins the element with `position: absolute` (layoutReanimation/web/componentUtils.ts →
 * scheduleAnimationCleanup). The element drops out of flow and later siblings slide up under it.
 * Predefined presets have no such cleanup, so web always uses the plain `FadeInDown` preset (25px
 * rise) — or a plain fade when `small` (label swaps, where 25px would jump out of the row).
 * Native keeps the custom distance with a spring.
 */
export function riseEntrance({
  delay = 0,
  distance = 12,
  duration = 420,
  small = false,
  spring = springs.gentle,
}: {
  delay?: number;
  distance?: number;
  /** Web duration (ms). */
  duration?: number;
  /** Web: fade only (no 25px preset rise). */
  small?: boolean;
  spring?: { damping: number; stiffness: number };
} = {}): EntryAnimation {
  if (REDUCED_MOTION) {
    return FadeIn.duration(durations.fast)
      .delay(Math.round(delay / 2))
      .reduceMotion(ReduceMotion.Never);
  }
  if (IS_WEB) {
    return small
      ? FadeIn.delay(delay).duration(duration).easing(easeOutQuint)
      : FadeInDown.delay(delay).duration(duration).easing(easeOutQuint);
  }
  return FadeInDown.delay(delay)
    .springify()
    .damping(spring.damping)
    .stiffness(spring.stiffness)
    .mass(1)
    .withInitialValues({ opacity: 0, transform: [{ translateY: distance }] });
}

/** Web entrance duration: shorter than native's spring settle so lists never feel floaty. */
const WEB_ENTER_MS = 320;

/**
 * Items past the stagger cap appear instantly: a zero-length fade (a fresh builder rather than
 * `undefined`, so call sites can keep chaining `.delay()` — builders mutate, so never share one).
 */
const instantEnter = (): EntryAnimation => FadeIn.duration(0).reduceMotion(ReduceMotion.Never);

/**
 * Staggered entrance: fade + rise 12px, gentle spring (native). Items past the 8th appear
 * instantly. Web: the 25px `FadeInDown` preset only for the first block of a group (index 0,
 * usually a section); later items/cards fade in place, because nested sections + cards would
 * otherwise travel up to ~50px and read as mushy.
 */
export function enterUp(index = 0): EntryAnimation {
  if (index > MAX_STAGGERED) return instantEnter();
  if (REDUCED_MOTION) return reducedFade(index);
  return riseEntrance({ delay: staggerDelay(index), small: IS_WEB && index > 0, duration: WEB_ENTER_MS });
}

/** Staggered opacity-only entrance (instant past the 8th item). */
export function enterFade(index = 0): EntryAnimation {
  if (index > MAX_STAGGERED) return instantEnter();
  if (REDUCED_MOTION) return reducedFade(index);
  return FadeIn.duration(IS_WEB ? WEB_ENTER_MS : durations.slow)
    .easing(easeOutQuint)
    .delay(staggerDelay(index));
}

/** Badge / sticker pop-in (snappy spring zoom). */
export function popIn(index = 0): EntryAnimation {
  if (REDUCED_MOTION) return reducedFade(index);
  const delay = staggerDelay(index);
  if (IS_WEB) return ZoomIn.delay(delay).duration(260).easing(easeOutQuint);
  return ZoomIn.delay(delay)
    .springify()
    .damping(springs.snappy.damping)
    .stiffness(springs.snappy.stiffness)
    .mass(1);
}

/** Fast fade for removed items (pair with `layoutSpring` on siblings). */
export const exitFade: ExitAnimation = FadeOut.duration(durations.fast);

/** Spring layout transition for reflowing lists/grids (`LinearTransition` on web uses easing). */
export const layoutSpring: LayoutTransition = IS_WEB
  ? LinearTransition.duration(durations.slow).easing(easeOutQuint)
  : LinearTransition.springify()
      .damping(springs.smooth.damping)
      .stiffness(springs.smooth.stiffness)
      .mass(1);

/** Worklet-safe shake: ±amplitude px, decaying over `cycles` (DESIGN §7: ±6px, 3 cycles). */
export function shakeValue(offset: SharedValue<number>, amplitude = 6, cycles = 3, delay = 0) {
  'worklet';
  const steps: number[] = [];
  for (let i = 0; i < cycles; i++) {
    const a = amplitude * (1 - i / (cycles + 1));
    steps.push(-a, a);
  }
  offset.set(
    withDelay(
      delay,
      withSequence(
        withTiming(steps[0] ?? 0, { duration: 45 }),
        ...steps.slice(1).map((v) => withTiming(v, { duration: 75 })),
        withSpring(0, springs.snappy),
      ),
    ),
  );
}

/** Horizontal shake for validation errors. Spread `style` on an Animated.View, call `shake()`. */
export function useShake(): { style: AnimatedStyle<ViewStyle>; shake: () => void } {
  const offset = useSharedValue(0);
  const style = useAnimatedStyle<ViewStyle>(() => ({ transform: [{ translateX: offset.get() }] }));
  const shake = () => shakeValue(offset);
  return { style, shake };
}

/** Scale pop (1 → peak → 1): quick punch, springy settle. Used by the cart badge. */
export function usePop(peak = 1.35): { style: AnimatedStyle<ViewStyle>; pop: () => void } {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle<ViewStyle>(() => ({ transform: [{ scale: scale.get() }] }));
  const pop = () => {
    scale.set(
      withSequence(withTiming(peak, { duration: 110, easing: easeOutQuint }), withSpring(1, springs.bouncy)),
    );
  };
  return { style, pop };
}
