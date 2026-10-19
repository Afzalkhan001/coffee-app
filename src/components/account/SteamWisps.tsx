import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useColors } from '@/theme';

const WISP_D = 'M6 46 C 0 36, 12 30, 6 20 S 2 6, 6 0';

function Wisp({ delay, color, height }: { delay: number; color: string; height: number }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    t.set(withDelay(delay, withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, false)));
    return () => cancelAnimation(t);
  }, [delay, reduced, t]);

  const style = useAnimatedStyle(() => {
    const p = t.get();
    return {
      opacity: reduced ? 0.4 : interpolate(p, [0, 0.25, 1], [0, 0.85, 0]),
      transform: [{ translateY: -18 * p }, { scaleY: 0.9 + 0.25 * p }],
    };
  });

  return (
    <Animated.View style={style}>
      <Svg width={(height * 12) / 46} height={height} viewBox="0 0 12 46">
        <Path d={WISP_D} stroke={color} strokeWidth={2} strokeLinecap="round" fill="none" />
      </Svg>
    </Animated.View>
  );
}

/** Three staggered steam strokes rising and fading — "Preparing your order…" (design-refs addition 2). */
export function SteamWisps({
  color,
  height = 34,
  style,
}: {
  color?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const main = color ?? c.white;
  return (
    <View style={[styles.row, style]} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Wisp delay={0} color={main} height={height} />
      <Wisp delay={600} color={c.peach} height={height} />
      <Wisp delay={1200} color={main} height={height} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, pointerEvents: 'none' },
});
