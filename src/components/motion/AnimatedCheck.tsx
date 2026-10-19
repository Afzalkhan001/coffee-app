import { useEffect, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Circle, Path } from 'react-native-svg';
import { springs, useColors } from '@/theme';
import { withAlpha } from './color';
import { easeInOutCubic, easeOutQuint } from './hooks';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const VB = 52;
const RING_R = 23;
const RING_C = 2 * Math.PI * RING_R;
type Pt = readonly [number, number];
const CHECK_IN_RING: readonly Pt[] = [[15.6, 27.2], [22.8, 34.2], [37, 19.6]];
const CHECK_SOLO: readonly Pt[] = [[9.5, 27.5], [20.6, 38.4], [42.5, 15.2]];

const toPath = (pts: readonly Pt[]) => pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');
const polyLength = (pts: readonly Pt[]) =>
  pts.reduce((sum, p, i) => {
    const prev = pts[i - 1];
    return prev ? sum + Math.hypot(p[0] - prev[0], p[1] - prev[1]) : sum;
  }, 0);

const CHECK_PATHS = {
  ring: { d: toPath(CHECK_IN_RING), length: polyLength(CHECK_IN_RING) },
  solo: { d: toPath(CHECK_SOLO), length: polyLength(CHECK_SOLO) },
};

export interface AnimatedCheckProps {
  size: number;
  /** Default sage. */
  color?: string;
  /** Draws when true; resets (hidden) when false. */
  play: boolean;
  delay?: number;
  /** Check stroke in px. Default ≈ size/18 (min 2). */
  strokeWidth?: number;
  /** Draw a circle first, then the check inside it. Default true. */
  ring?: boolean;
  /** Soft tinted disc behind the ring. Default false. */
  filled?: boolean;
  /** Called (JS thread) when the check finishes drawing. */
  onDone?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Success check drawn with SVG strokes: ring sweeps clockwise, then the tick, with a spring settle. */
export function AnimatedCheck({
  size,
  color: colorProp,
  play,
  delay = 0,
  strokeWidth,
  ring = true,
  filled = false,
  onDone,
  style,
}: AnimatedCheckProps) {
  const c = useColors();
  const color = colorProp ?? c.sage;
  const ringP = useSharedValue(0);
  const checkP = useSharedValue(0);
  const scale = useSharedValue(1);
  const px = strokeWidth ?? Math.max(2, size / 18);
  const sw = (px * VB) / size;
  const check = ring ? CHECK_PATHS.ring : CHECK_PATHS.solo;
  const pad = sw;

  // Latest onDone without restarting the animation when a parent passes an inline callback.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!play) {
      cancelAnimation(ringP);
      cancelAnimation(checkP);
      ringP.set(0);
      checkP.set(0);
      scale.set(1);
      return;
    }
    const finish = () => onDoneRef.current?.();
    if (ring) {
      ringP.set(withDelay(delay, withTiming(1, { duration: 560, easing: easeInOutCubic })));
    }
    checkP.set(
      withDelay(
        delay + (ring ? 380 : 40),
        withTiming(1, { duration: 380, easing: easeOutQuint }, (finished) => {
          if (finished) scheduleOnRN(finish);
        }),
      ),
    );
    scale.set(0.86);
    scale.set(withDelay(delay, withSpring(1, springs.bouncy)));
    return () => {
      cancelAnimation(ringP);
      cancelAnimation(checkP);
      cancelAnimation(scale);
    };
  }, [play, delay, ring, ringP, checkP, scale]);

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: (RING_C + pad) * (1 - ringP.get()) }));
  const discProps = useAnimatedProps(() => ({ fillOpacity: ringP.get() }));
  const checkProps = useAnimatedProps(() => ({
    strokeDashoffset: (check.length + pad) * (1 - checkP.get()),
  }));
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <View
      style={[{ width: size, height: size }, style]}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[styles.fill, scaleStyle]}>
        <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
          {ring && filled ? (
            <AnimatedCircle
              cx={VB / 2}
              cy={VB / 2}
              r={RING_R}
              fill={withAlpha(color, 0.14)}
              fillOpacity={0}
              animatedProps={discProps}
            />
          ) : null}
          {ring ? (
            <AnimatedCircle
              cx={VB / 2}
              cy={VB / 2}
              r={RING_R}
              fill="none"
              stroke={color}
              strokeWidth={sw * 0.8}
              strokeLinecap="round"
              strokeDasharray={[RING_C, RING_C + 2 * pad]}
              transform={`rotate(-90 ${VB / 2} ${VB / 2})`}
              animatedProps={ringProps}
            />
          ) : null}
          <AnimatedPath
            d={check.d}
            fill="none"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={[check.length, check.length + 2 * pad]}
            animatedProps={checkProps}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill },
});
