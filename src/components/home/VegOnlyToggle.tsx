/**
 * "Veg only" (the Indian pure-veg filter) as a compact white pill: "Veg" and a small switch whose
 * thumb carries the green veg mark. Off: `line` track, thumb left. On: veg-green track, thumb right
 * (snappy spring, UI thread). Clicks `toggle(on)` after applying the change (docs/HAPTICS.md).
 * Used in the Menu header, the Category top bar and Search; the value lives in the favourites store.
 */
import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { VegMark } from '@/components/domain/VegMark';
import { PressableScale, Text } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { fonts, makeStyles, radii, springs, ThemeScope, useColors } from '@/theme';

const SIZES = {
  /** Beside the 44px header circles. */
  md: { height: 44, padLeft: 14, padRight: 10, trackW: 38, trackH: 24, thumb: 20, mark: 11, font: 14 },
  /** In a row of text (Search results). */
  sm: { height: 36, padLeft: 12, padRight: 7, trackW: 34, trackH: 22, thumb: 18, mark: 10, font: 13 },
} as const;

export interface VegOnlyToggleProps {
  value: boolean;
  onValueChange: (next: boolean) => void;
  size?: keyof typeof SIZES;
  style?: StyleProp<ViewStyle>;
}

export function VegOnlyToggle({ value, onValueChange, size = 'md', style }: VegOnlyToggleProps) {
  const c = useColors();
  const styles = useStyles();
  const m = SIZES[size];
  const inset = (m.trackH - m.thumb) / 2;
  const travel = m.trackW - m.thumb - inset * 2;
  const on = useSharedValue(value ? 1 : 0);
  // Captured by the worklet: a scheme change re-creates it with the new track colours.
  const off = c.line;
  const onColor = c.veg;

  useEffect(() => {
    on.set(withSpring(value ? 1 : 0, springs.snappy));
  }, [value, on]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.get(), [0, 1], [off, onColor]),
  }));
  const thumbStyle = useAnimatedStyle(() => {
    const t = on.get();
    // The same liquid stretch as the settings switches, so the two families feel related.
    const stretch = 1 + 0.14 * Math.sin(Math.min(1, Math.max(0, t)) * Math.PI);
    return { transform: [{ translateX: t * travel }, { scaleX: stretch }] };
  });

  return (
    <PressableScale
      onPress={() => {
        onValueChange(!value);
        haptic.toggle(!value);
      }}
      activeScale={0.95}
      hitSlop={size === 'sm' ? 4 : undefined}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel="Veg only"
      style={[styles.pill, { height: m.height, paddingLeft: m.padLeft, paddingRight: m.padRight }, style]}
    >
      <Text style={[styles.label, { fontSize: m.font }]} color={c.ink}>
        Veg
      </Text>
      <Animated.View style={[styles.track, { width: m.trackW, height: m.trackH, padding: inset }, trackStyle]}>
        <Animated.View style={[styles.thumb, { width: m.thumb, height: m.thumb, borderRadius: m.thumb / 2 }, thumbStyle]}>
          {/* The thumb is white in both schemes: draw the light mark (white square) on it. */}
          <ThemeScope scheme="light">
            <VegMark diet="veg" size={m.mark} decorative />
          </ThemeScope>
        </Animated.View>
      </Animated.View>
    </PressableScale>
  );
}

const useStyles = makeStyles((c, t) => ({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radii.pill,
    backgroundColor: c.surface,
  },
  label: { fontFamily: fonts.semibold, lineHeight: 18 },
  track: { borderRadius: radii.pill, justifyContent: 'center' },
  thumb: { backgroundColor: c.white, alignItems: 'center', justifyContent: 'center', boxShadow: t.boxShadows.soft },
}));
