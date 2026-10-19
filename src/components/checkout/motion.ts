/**
 * Checkout-flow entrance builders with explicit delays (for choreographed screens such as the
 * confirmation celebration). Same feel as `enterUp` from the motion kit: gentle spring on native,
 * easeOutQuint keyframes on web (web ignores springify), quick cross-fade under Reduce Motion.
 */
import { Platform } from 'react-native';
import { FadeIn, FadeOut, ReduceMotion, ZoomIn } from 'react-native-reanimated';
import { easeOutQuint, reducedMotionAtLaunch, riseEntrance } from '@/components/motion';
import { durations, springs } from '@/theme';

const IS_WEB = Platform.OS === 'web';

/** Fade + rise (16px) after `delayMs` (web: the motion kit's preset-based, layout-safe variant). */
export function riseIn(delayMs: number, distance = 16) {
  return riseEntrance({ delay: delayMs, distance, duration: 460 });
}

/** Springy zoom pop after `delayMs` (badges, the success disc). */
export function popAfter(delayMs: number) {
  if (reducedMotionAtLaunch) {
    return FadeIn.duration(durations.fast).delay(Math.round(delayMs / 3)).reduceMotion(ReduceMotion.Never);
  }
  if (IS_WEB) return ZoomIn.delay(delayMs).duration(420).easing(easeOutQuint);
  return ZoomIn.delay(delayMs).springify().damping(springs.bouncy.damping).stiffness(springs.bouncy.stiffness).mass(1);
}

/** Field groups swapping inside an expanding section. */
export const fieldsIn = FadeIn.duration(durations.slow).delay(90).easing(easeOutQuint);
export const fieldsOut = FadeOut.duration(durations.fast);
