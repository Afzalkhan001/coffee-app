import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { useColors } from '@/theme';

const DOT = 6;
const ACTIVE = 24;

export interface PageDotsProps {
  count: number;
  /** 0..1 across all pages (same value as WavyCapsule / ArcArrowButton). */
  progress: SharedValue<number>;
  /** Inactive dot colour. Default translucent white (for the dark onboarding). */
  color?: string;
  /** Active pill colour. Default white. */
  activeColor?: string;
  style?: StyleProp<ViewStyle>;
}

function Dot({
  index,
  count,
  progress,
  color,
  activeColor,
}: {
  index: number;
  count: number;
  progress: SharedValue<number>;
  color: string;
  activeColor: string;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const distance = Math.abs(progress.get() * Math.max(count - 1, 1) - index);
    return {
      width: interpolate(distance, [0, 1], [ACTIVE, DOT], Extrapolation.CLAMP),
      backgroundColor: interpolateColor(Math.min(distance, 1), [0, 1], [activeColor, color]),
    };
  });
  return <Animated.View style={[styles.dot, animatedStyle]} />;
}

/** Page dots: the active dot morphs into a 24×6 pill, continuously with the swipe. Defaults are for `night` (both schemes). */
export function PageDots({ count, progress, color: colorProp, activeColor: activeProp, style }: PageDotsProps) {
  const c = useColors();
  const color = colorProp ?? c.glassBorder;
  const activeColor = activeProp ?? c.white;
  return (
    <View style={[styles.row, style]} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }, (_, i) => (
        <Dot key={i} index={i} count={count} progress={progress} color={color} activeColor={activeColor} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { height: DOT, borderRadius: DOT / 2 },
});
