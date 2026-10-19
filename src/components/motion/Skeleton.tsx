import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  makeMutable,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { makeStyles, makeThemed, radii } from '@/theme';
import { withAlpha } from './color';

// One app-wide shimmer clock: every placeholder sweeps in phase, and N skeletons cost one animation.
let clock: SharedValue<number> | null = null;
let users = 0;

function getClock(): SharedValue<number> {
  if (!clock) clock = makeMutable(0);
  return clock;
}

function retainClock() {
  users += 1;
  if (users !== 1) return;
  const c = getClock();
  c.set(0);
  c.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.bezier(0.4, 0, 0.2, 1) }), -1, false));
}

function releaseClock() {
  users = Math.max(0, users - 1);
  if (users === 0 && clock) cancelAnimation(clock);
}

/** The moving highlight: a bright sheen on cream, a faint lift on espresso. */
const useSheen = makeThemed((c, t) => {
  const peak = t.isDark ? 0.07 : 0.62;
  return [withAlpha(c.white, 0), withAlpha(c.white, peak), withAlpha(c.white, 0)] as const;
});
const SHEEN_STOPS = [0.28, 0.5, 0.72] as const;

export interface SkeletonProps {
  width?: DimensionValue;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** Cream content placeholder with a soft moving sheen (expo-linear-gradient), synced app-wide. */
export function Skeleton({ width = '100%', height, radius = radii.sm, style }: SkeletonProps) {
  const reduced = useReducedMotion();
  const styles = useStyles();
  const sheen = useSheen();
  const sweep = getClock();
  const boxWidth = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    retainClock();
    return releaseClock;
  }, [reduced]);

  const sheenStyle = useAnimatedStyle(() => {
    const w = boxWidth.get();
    return { opacity: w > 0 ? 1 : 0, transform: [{ translateX: -w + sweep.get() * 2 * w }] };
  });

  return (
    <View
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(e) => boxWidth.set(e.nativeEvent.layout.width)}
      style={[styles.base, { width, height, borderRadius: radius }, style]}
    >
      {reduced ? null : (
        <Animated.View style={[StyleSheet.absoluteFill, sheenStyle]}>
          <LinearGradient
            colors={sheen}
            locations={SHEEN_STOPS}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  base: { backgroundColor: c.surfaceAlt, overflow: 'hidden' },
}));
