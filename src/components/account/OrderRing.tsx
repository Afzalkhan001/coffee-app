import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { withAlpha } from '@/components/motion';
import { springs, useColors } from '@/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface OrderRingProps {
  /** 0..1 — springs to new values (a status advance sweeps the arc forward). */
  progress: number;
  /** Outer diameter. Default 176. */
  size?: number;
  /** Ring thickness. Default 10. */
  stroke?: number;
  /** Arc colour. Default peach (reads on espresso). */
  color?: string;
  /** Track colour. Default translucent white. */
  trackColor?: string;
  /** Centre content (countdown, status glyph). */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Live order progress ring (design-refs addition 7): an SVG arc whose dash offset is driven by a
 * spring on the UI thread, with a glowing head dot riding the arc's leading edge.
 */
export function OrderRing({ progress, size = 176, stroke = 10, color, trackColor, children, style }: OrderRingProps) {
  const c = useColors();
  const arcColor = color ?? c.peach;
  const track = trackColor ?? withAlpha(c.white, 0.12);
  const r = (size - stroke) / 2 - 4; // 4px of room for the head dot's glow
  const mid = size / 2;
  const circumference = 2 * Math.PI * r;

  const p = useSharedValue(0);

  useEffect(() => {
    // First paint sweeps in from empty; later changes spring from wherever the arc is.
    p.set(withDelay(p.get() === 0 ? 220 : 0, withSpring(progress, springs.gentle)));
  }, [progress, p]);

  const arcProps = useAnimatedProps(() => {
    const v = Math.min(1, Math.max(0, p.get()));
    return { strokeDashoffset: circumference * (1 - v) };
  });

  const headProps = useAnimatedProps(() => {
    const v = Math.min(1, Math.max(0, p.get()));
    const angle = -Math.PI / 2 + v * Math.PI * 2;
    return { cx: mid + r * Math.cos(angle), cy: mid + r * Math.sin(angle), opacity: v > 0.005 ? 1 : 0 };
  });

  const glowProps = useAnimatedProps(() => {
    const v = Math.min(1, Math.max(0, p.get()));
    const angle = -Math.PI / 2 + v * Math.PI * 2;
    return { cx: mid + r * Math.cos(angle), cy: mid + r * Math.sin(angle), opacity: v > 0.005 ? 0.35 : 0 };
  });

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={mid} cy={mid} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={mid}
          cy={mid}
          r={r}
          stroke={arcColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={[circumference, circumference]}
          strokeDashoffset={circumference}
          transform={`rotate(-90 ${mid} ${mid})`}
          animatedProps={arcProps}
        />
        <AnimatedCircle r={stroke * 0.95} fill={arcColor} cx={mid} cy={mid - r} opacity={0} animatedProps={glowProps} />
        <AnimatedCircle
          r={stroke * 0.42}
          fill={c.white}
          cx={mid}
          cy={mid - r}
          opacity={0}
          animatedProps={headProps}
        />
      </Svg>
      <View style={styles.center}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
