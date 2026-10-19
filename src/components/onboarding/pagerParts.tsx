/**
 * Building blocks for the onboarding pager (DESIGN.md §7 "Onboarding paging").
 */
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';

export interface ParallaxProps {
  scrollX: SharedValue<number>;
  /** Page this layer belongs to. */
  index: number;
  /** Page width. */
  width: number;
  /**
   * Counter-translation as a fraction of the page offset. 0.4 → the layer travels at 0.6× the
   * page speed (text); −0.2 → 1.2× (foreground illustration).
   */
  factor: number;
  /** Fade with distance from centre. Default true. */
  fade?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * A layer that slides at its own speed relative to its page. Under Reduce Motion it only
 * cross-fades (no parallax), per DESIGN.md §7.
 */
export function Parallax({ scrollX, index, width, factor, fade = true, children, style }: ParallaxProps) {
  const reduced = useReducedMotion();
  const animatedStyle = useAnimatedStyle(() => {
    const offset = scrollX.get() - index * width;
    // Gone by mid-swipe, so two pages' headlines never overprint each other.
    const opacity = fade ? interpolate(Math.abs(offset), [0, width * 0.48], [1, 0], Extrapolation.CLAMP) : 1;
    if (reduced) return { opacity };
    return { opacity, transform: [{ translateX: offset * factor }] };
  });
  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
