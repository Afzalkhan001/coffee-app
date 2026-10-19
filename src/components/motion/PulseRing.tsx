import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { css, cubicBezier, useReducedMotion } from 'react-native-reanimated';

const pulse = css.keyframes({
  from: { transform: [{ scale: 1 }], opacity: 0.42 },
  to: { transform: [{ scale: 2.6 }], opacity: 0 },
});
/** Contained halo for a dot inside a list (the timeline's current step): never wider than 1.3×. */
const pulseSoft = css.keyframes({
  from: { transform: [{ scale: 1 }], opacity: 1 },
  '70%': { transform: [{ scale: 1.26 }], opacity: 0.75 },
  to: { transform: [{ scale: 1.32 }], opacity: 0 },
});
const easeOut = cubicBezier(0.22, 1, 0.36, 1);

export interface PulseRingProps {
  /** Diameter of the dot the rings radiate from. */
  size: number;
  color: string;
  /** Default true. Off (or Reduce Motion) → no rings. */
  active?: boolean;
  /** Full cycle in ms. Default 1800. */
  duration?: number;
  /**
   * `wide` (default): halos breathe out to 2.6× at 42% (live dots on cards). `soft`: a contained
   * 1.3× halo in the given colour (pass a faint one), for a dot sitting inside a list sheet.
   */
  variant?: 'wide' | 'soft';
  /** Optional centre content (e.g. the dot itself). */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Two phase-shifted halos breathing out of a dot — "live / current" indicator (CSS animation). */
export function PulseRing({ size, color, active = true, duration = 1800, variant = 'wide', children, style }: PulseRingProps) {
  const reduced = useReducedMotion();
  const animate = active && !reduced;
  const ring = { width: size, height: size, borderRadius: size / 2, backgroundColor: color };

  return (
    <View style={[styles.box, { width: size, height: size }, style]}>
      {animate
        ? [0, duration / 2].map((delay) => (
            <Animated.View
              key={delay}
              style={[
                styles.ring,
                ring,
                {
                  animationName: variant === 'soft' ? pulseSoft : pulse,
                  animationDuration: duration,
                  animationDelay: delay,
                  animationIterationCount: 'infinite',
                  animationTimingFunction: easeOut,
                  animationFillMode: 'backwards',
                },
              ]}
            />
          ))
        : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', pointerEvents: 'box-none' },
  ring: { position: 'absolute', opacity: 0, pointerEvents: 'none' },
});
