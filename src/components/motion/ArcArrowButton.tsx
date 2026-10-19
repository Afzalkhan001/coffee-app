import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
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
import { Icon } from '@/components/ui';
import { makeStyles, springs, useColors } from '@/theme';
import { withAlpha } from './color';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Ring gap between the glass circle and the peach arc. */
const GAP = 5;
const ARC_WIDTH = 2.5;

export interface ArcArrowButtonProps {
  /** 0..1 across all onboarding pages — the peach arc grows with it. */
  progress: SharedValue<number>;
  onPress: () => void;
  accessibilityLabel: string;
  /** Ionicons name; default is a thin drawn arrow. */
  icon?: string;
  /** Glass circle diameter. Default 64. */
  size?: number;
  /** Arc fraction shown at progress 0. Default 0.34 (one of three pages). */
  minArc?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Dark glass circle with a thin arrow, wrapped by a peach progress arc with a glowing head. */
export function ArcArrowButton({
  progress,
  onPress,
  accessibilityLabel,
  icon,
  size = 64,
  minArc = 0.34,
  disabled,
  style,
}: ArcArrowButtonProps) {
  const reduced = useReducedMotion();
  const c = useColors();
  const styles = useStyles();
  const pressed = useSharedValue(0);
  const box = size + (GAP + ARC_WIDTH) * 2 + 4;
  const center = box / 2;
  const radius = size / 2 + GAP;
  const circumference = 2 * Math.PI * radius;

  const arcProps = useAnimatedProps(() => {
    const frac = minArc + (1 - minArc) * clamp(progress.get(), 0, 1);
    return { strokeDashoffset: circumference * (1 - frac) };
  });

  const headProps = useAnimatedProps(() => {
    const frac = minArc + (1 - minArc) * clamp(progress.get(), 0, 1);
    const angle = -Math.PI / 2 + frac * Math.PI * 2;
    return { cx: center + radius * Math.cos(angle), cy: center + radius * Math.sin(angle) };
  });

  const buttonStyle = useAnimatedStyle(() => {
    const p = pressed.get();
    return reduced ? { opacity: 1 - 0.2 * p } : { transform: [{ scale: 1 - 0.08 * p }] };
  });
  const arrowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: reduced ? 0 : 3 * pressed.get() }] }));

  return (
    <View style={[{ width: box, height: box }, styles.center, style]}>
      <Svg width={box} height={box} style={StyleSheet.absoluteFill}>
        <Circle cx={center} cy={center} r={radius} stroke={withAlpha(c.white, 0.1)} strokeWidth={2} fill="none" />
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={c.peach}
          strokeWidth={ARC_WIDTH}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={[circumference, circumference]}
          transform={`rotate(-90 ${center} ${center})`}
          animatedProps={arcProps}
        />
        <AnimatedCircle r={3.4} fill={c.peach} cx={center} cy={center - radius} animatedProps={headProps} />
      </Svg>
      <AnimatedPressable
        // Silent: a pager arrow only moves on; the pager's page change is what ticks (docs/HAPTICS.md).
        onPress={onPress}
        onPressIn={() => pressed.set(withSpring(1, springs.snappy))}
        onPressOut={() => pressed.set(withSpring(0, springs.snappy))}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: !!disabled }}
        hitSlop={GAP + ARC_WIDTH}
        style={[styles.glass, styles.center, { width: size, height: size, borderRadius: size / 2 }, buttonStyle]}
      >
        <Animated.View style={arrowStyle}>
          {icon ? (
            <Icon name={icon} size={Math.round(size * 0.36)} color={c.white} />
          ) : (
            <Svg width={size * 0.4} height={size * 0.4} viewBox="0 0 24 24">
              <Path
                d="M4.5 12 H19 M13 6 L19 12 L13 18"
                stroke={c.white}
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
          )}
        </Animated.View>
      </AnimatedPressable>
    </View>
  );
}

// Onboarding (night) only: the fixed tokens, identical in both schemes.
const useStyles = makeStyles((c) => ({
  center: { alignItems: 'center', justifyContent: 'center' },
  glass: {
    backgroundColor: c.glass,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: c.glassBorder,
  },
}));
