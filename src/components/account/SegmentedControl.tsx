import { useEffect, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { MAX_FONT_SCALE, PressableScale, Text } from '@/components/ui';
import { fonts, makeStyles, radii, springs, useColors } from '@/theme';

const HEIGHT = 48;
const PAD = 4;
/** How much the ink pill stretches mid-travel (fraction of a segment). */
const STRETCH = 0.14;

export interface Segment {
  key: string;
  label: string;
  /** Optional count bubble ("Active · 2"). Hidden when 0 or undefined. */
  count?: number;
}

export interface SegmentedControlProps {
  segments: readonly Segment[];
  /**
   * Continuous index 0…n-1 that drives the ink pill — a pager's scroll progress (follows the
   * finger) or `useSegmentProgress(selectedIndex)` for a plain spring.
   */
  progress: SharedValue<number>;
  selectedIndex: number;
  onSelect: (index: number) => void;
  /** `select` on tap. Default true; pass false when the caller fires it (e.g. on page settle). */
  haptics?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Springs a progress value to `index` (for controls that are not driven by a pager). */
export function useSegmentProgress(index: number): SharedValue<number> {
  const progress = useSharedValue(index);
  useEffect(() => {
    progress.set(withSpring(index, springs.smooth));
  }, [index, progress]);
  return progress;
}

/**
 * Pill segmented control (Active / Past, Terms / Privacy): one ink indicator slides and
 * stretches between segments on the UI thread; labels cross-fade ink-soft → `onInk` as it passes
 * (the indicator inverts to cream in dark, its label to espresso).
 */
export function SegmentedControl({ segments, progress, selectedIndex, onSelect, haptics = true, style }: SegmentedControlProps) {
  const c = useColors();
  const styles = useStyles();
  const count = segments.length;
  // Width is layout (set once per size change); the per-frame motion is transform-only.
  const [segWidth, setSegWidth] = useState(0);
  const segW = useSharedValue(0);

  const indicatorStyle = useAnimatedStyle(() => {
    const w = segW.get();
    const p = progress.get();
    const frac = p - Math.floor(p);
    const stretch = 1 + STRETCH * Math.sin(frac * Math.PI);
    return { transform: [{ translateX: p * w }, { scaleX: stretch }] };
  });

  return (
    <View
      accessibilityRole="tablist"
      style={[styles.track, style]}
      onLayout={(e) => {
        const w = Math.max(0, (e.nativeEvent.layout.width - PAD * 2) / count);
        segW.set(w);
        setSegWidth(w);
      }}
    >
      {segWidth > 0 ? <Animated.View style={[styles.indicator, { width: segWidth }, indicatorStyle]} /> : null}
      {segments.map((segment, i) => (
        <PressableScale
          key={segment.key}
          onPress={() => {
            if (i !== selectedIndex) onSelect(i);
          }}
          hapticKind={haptics && i !== selectedIndex ? 'select' : null}
          activeScale={0.96}
          accessibilityRole="tab"
          accessibilityState={{ selected: i === selectedIndex }}
          accessibilityLabel={segment.count ? `${segment.label}, ${segment.count}` : segment.label}
          style={styles.segment}
        >
          <SegmentLabel label={segment.label} index={i} progress={progress} />
          {segment.count ? (
            <View style={styles.count}>
              <Text style={styles.countText} color={c.white}>
                {String(segment.count)}
              </Text>
            </View>
          ) : null}
        </PressableScale>
      ))}
    </View>
  );
}

function SegmentLabel({ label, index, progress }: { label: string; index: number; progress: SharedValue<number> }) {
  const c = useColors();
  const styles = useStyles();
  // Captured by the worklet: idle ink-soft, white (`onInk`) over the ink indicator.
  const idle = c.inkSoft;
  const selected = c.onInk;
  const style = useAnimatedStyle(() => {
    const t = interpolate(Math.abs(progress.get() - index), [0, 1], [1, 0], Extrapolation.CLAMP);
    return { color: interpolateColor(t, [0, 1], [idle, selected]) };
  });
  return (
    <Animated.Text numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.label, style]}>
      {label}
    </Animated.Text>
  );
}

const useStyles = makeStyles((c) => ({
  track: {
    height: HEIGHT,
    padding: PAD,
    borderRadius: radii.pill,
    backgroundColor: c.surface,
    flexDirection: 'row',
  },
  indicator: {
    position: 'absolute',
    top: PAD,
    bottom: PAD,
    left: PAD,
    borderRadius: radii.pill,
    backgroundColor: c.ink,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radii.pill,
  },
  label: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
  count: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: c.sageDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 15 },
}));
