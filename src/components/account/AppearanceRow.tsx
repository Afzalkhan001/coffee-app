/**
 * Settings → Preferences → "Appearance" (DESIGN.md §R4): one sheet row with a compact three-way
 * pill — System · Light · Dark. The ink indicator springs (and stretches a touch) between the
 * segments on the UI thread while the labels cross-fade `inkSoft` → `onInk`; the whole app
 * re-themes in place the moment a segment is chosen (`select` haptic on a change only).
 */
import { useEffect } from 'react';
import { View } from 'react-native';
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
import { useAppearance, useSession } from '@/store/session';
import { APPEARANCE_LABEL, APPEARANCE_PREFERENCES, fonts, makeStyles, radii, springs, useColors, type AppearancePreference } from '@/theme';

const HEIGHT = 36;
const PAD = 3;
/** 3 × 62 + padding: "Appearance" still fits beside it at 375pt with 1.2× system text. */
const SEGMENT = 62;
/** Indicator stretch mid-travel (fraction of a segment), like the Orders segmented control. */
const STRETCH = 0.12;

export function AppearanceRow() {
  const value = useAppearance();
  const setAppearance = useSession((s) => s.setAppearance);
  const styles = useStyles();
  const index = Math.max(0, APPEARANCE_PREFERENCES.indexOf(value));
  const progress = useSharedValue(index);

  useEffect(() => {
    progress.set(withSpring(index, springs.smooth));
  }, [index, progress]);

  const indicatorStyle = useAnimatedStyle(() => {
    const p = progress.get();
    const frac = p - Math.floor(p);
    return { transform: [{ translateX: p * SEGMENT }, { scaleX: 1 + STRETCH * Math.sin(frac * Math.PI) }] };
  });

  return (
    <View style={styles.row}>
      <Text style={styles.title} numberOfLines={1}>
        Appearance
      </Text>
      <View style={styles.track} accessibilityRole="radiogroup" accessibilityLabel="Appearance">
        <Animated.View style={[styles.indicator, indicatorStyle]} />
        {APPEARANCE_PREFERENCES.map((pref, i) => (
          <Segment key={pref} pref={pref} index={i} selected={pref === value} progress={progress} onSelect={setAppearance} />
        ))}
      </View>
    </View>
  );
}

function Segment({
  pref,
  index,
  selected,
  progress,
  onSelect,
}: {
  pref: AppearancePreference;
  index: number;
  selected: boolean;
  progress: SharedValue<number>;
  onSelect: (pref: AppearancePreference) => void;
}) {
  const c = useColors();
  const styles = useStyles();
  // Captured by the worklet: a scheme change re-creates it with the new pair.
  const idle = c.inkSoft;
  const active = c.onInk;
  const labelStyle = useAnimatedStyle(() => {
    const t = interpolate(Math.abs(progress.get() - index), [0, 1], [1, 0], Extrapolation.CLAMP);
    return { color: interpolateColor(t, [0, 1], [idle, active]) };
  });
  const label = APPEARANCE_LABEL[pref];
  return (
    <PressableScale
      onPress={() => {
        if (!selected) onSelect(pref);
      }}
      hapticKind={selected ? null : 'select'}
      activeScale={0.94}
      hitSlop={{ top: 4, bottom: 4 }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label} appearance`}
      style={styles.segment}
    >
      <Animated.Text numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.label, labelStyle]}>
        {label}
      </Animated.Text>
    </PressableScale>
  );
}

const useStyles = makeStyles((c) => ({
  row: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 16,
    paddingRight: 8,
  },
  title: { flex: 1, minWidth: 0, fontFamily: fonts.medium, fontSize: 16, lineHeight: 22, color: c.ink },
  // The canvas fill: a control inside a `surface` sheet (R3.A1).
  track: {
    width: SEGMENT * APPEARANCE_PREFERENCES.length + PAD * 2,
    height: HEIGHT,
    padding: PAD,
    borderRadius: radii.pill,
    backgroundColor: c.bg,
    flexDirection: 'row',
  },
  indicator: {
    position: 'absolute',
    top: PAD,
    bottom: PAD,
    left: PAD,
    width: SEGMENT,
    borderRadius: radii.pill,
    backgroundColor: c.ink,
  },
  segment: { width: SEGMENT, alignItems: 'center', justifyContent: 'center', borderRadius: radii.pill },
  label: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 17 },
}));
