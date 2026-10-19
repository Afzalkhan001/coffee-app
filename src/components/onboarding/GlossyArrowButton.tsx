/**
 * The onboarding forward button (DESIGN.md §R3.B, ref 1): a large glossy near-black circle with a
 * thin white arrow, bleeding off the bottom-right, hugged by a thin peach arc whose sweep follows
 * the pager (34% → 100%, starting at 150°). Presses to 0.94 on the `snappy` spring.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  clamp,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { springs, useColors } from '@/theme';
import { ARC_BOX, ARC_RADIUS, BUTTON } from './onboardingLayout';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** R3 onboarding button gloss (150°); on night in both schemes. */
const GLOSS = ['#4B4440', '#2A2522', '#1C1815'] as const;
const ARC_START = 150;
const MIN_ARC = 0.34;
const CIRCUMFERENCE = 2 * Math.PI * ARC_RADIUS;
const ARROW = 30;

export interface GlossyArrowButtonProps {
  /** 0..1 across all onboarding pages. */
  progress: SharedValue<number>;
  onPress: () => void;
  accessibilityLabel: string;
  /** A permission prompt is open: the arrow gives way to a spinner and taps are ignored. */
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function GlossyArrowButton({ progress, onPress, accessibilityLabel, busy = false, style }: GlossyArrowButtonProps) {
  const reduced = useReducedMotion();
  const pressed = useSharedValue(0);
  const c = useColors();
  const mid = ARC_BOX / 2;

  const arcProps = useAnimatedProps(() => {
    const frac = MIN_ARC + (1 - MIN_ARC) * clamp(progress.get(), 0, 1);
    return { strokeDashoffset: CIRCUMFERENCE * (1 - frac) };
  });

  const buttonStyle = useAnimatedStyle(() => {
    const p = pressed.get();
    return reduced ? { opacity: 1 - 0.15 * p } : { transform: [{ scale: 1 - 0.06 * p }] };
  });
  const arrowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: reduced ? 0 : 3 * pressed.get() }] }));

  return (
    <View style={[styles.box, style]}>
      <Svg width={ARC_BOX} height={ARC_BOX} style={StyleSheet.absoluteFill}>
        <AnimatedCircle
          cx={mid}
          cy={mid}
          r={ARC_RADIUS}
          stroke={c.peach}
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={[CIRCUMFERENCE, CIRCUMFERENCE]}
          transform={`rotate(${ARC_START} ${mid} ${mid})`}
          animatedProps={arcProps}
        />
      </Svg>
      <AnimatedPressable
        onPress={() => {
          // Silent: the pager's page change ticks as it crosses the midpoint (docs/HAPTICS.md).
          if (!busy) onPress();
        }}
        onPressIn={() => pressed.set(withSpring(1, springs.snappy))}
        onPressOut={() => pressed.set(withSpring(0, springs.snappy))}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ busy }}
        style={[styles.button, buttonStyle]}
      >
        <LinearGradient colors={GLOSS} start={{ x: 0.25, y: 0.07 }} end={{ x: 0.75, y: 0.93 }} style={styles.gloss} />
        <View style={styles.highlight} />
        {busy ? (
          <ActivityIndicator color={c.white} />
        ) : (
          <Animated.View style={arrowStyle}>
            <Svg width={ARROW} height={ARROW} viewBox="0 0 30 30">
              <Path
                d="M6 15 H24 M17.5 8.5 L24 15 L17.5 21.5"
                stroke={c.white}
                strokeWidth={1.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
          </Animated.View>
        )}
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: ARC_BOX, height: ARC_BOX, alignItems: 'center', justifyContent: 'center' },
  button: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 18px 40px rgba(0, 0, 0, 0.45)',
  },
  gloss: { ...StyleSheet.absoluteFill, borderRadius: BUTTON / 2 },
  // Inner top highlight: a 1px white 18% rim along the upper edge.
  highlight: {
    ...StyleSheet.absoluteFill,
    borderRadius: BUTTON / 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.18)',
  },
});
