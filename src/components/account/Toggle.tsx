import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { PressableScale, Text } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { fonts, makeStyles, radii, spacing, springs, useColors } from '@/theme';

const TRACK_W = 52;
const TRACK_H = 32;
const THUMB = 26;
const INSET = (TRACK_H - THUMB) / 2;
const TRAVEL = TRACK_W - THUMB - INSET * 2;

/** The visual switch: deep-sage track when on (DESIGN §2 toggles "on") + white thumb that springs across (snappy, UI thread). */
export function ToggleKnob({ value, disabled }: { value: boolean; disabled?: boolean }) {
  const on = useSharedValue(value ? 1 : 0);
  const c = useColors();
  const styles = useStyles();
  // Captured by the worklet: a scheme change re-creates it with the new track colours.
  const off = c.line;
  const onColor = c.sageDeep;

  useEffect(() => {
    on.set(withSpring(value ? 1 : 0, springs.snappy));
  }, [value, on]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.get(), [0, 1], [off, onColor]),
  }));
  const thumbStyle = useAnimatedStyle(() => {
    const t = on.get();
    // A touch of stretch mid-travel makes the thumb feel liquid rather than sliding.
    const stretch = 1 + 0.18 * Math.sin(Math.min(1, Math.max(0, t)) * Math.PI);
    return { transform: [{ translateX: t * TRAVEL }, { scaleX: stretch }] };
  });

  return (
    <Animated.View style={[styles.track, disabled ? styles.disabled : null, trackStyle]}>
      <Animated.View style={[styles.thumb, thumbStyle]} />
    </Animated.View>
  );
}

export interface ToggleRowProps {
  /** @deprecated R3 deletes icon discs from settings rows; ignored. */
  icon?: string;
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
}

/**
 * A full-width settings row that toggles when tapped anywhere (accessibility role: switch). R3: label
 * 16/500 + a one-line 13 caption, no icon disc. Clicks `toggle(on)` right after the change is applied,
 * so the Haptics switch itself clicks when turned on (and stays quiet when turned off).
 */
export function ToggleRow({ title, subtitle, value, onValueChange, disabled }: ToggleRowProps) {
  const c = useColors();
  const styles = useStyles();
  return (
    <PressableScale
      onPress={() => {
        onValueChange(!value);
        haptic.toggle(!value);
      }}
      disabled={disabled}
      activeScale={0.985}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      style={styles.row}
    >
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? (
          <Text style={styles.subtitle} color={c.inkSoft} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <ToggleKnob value={value} disabled={disabled} />
    </PressableScale>
  );
}

const useStyles = makeStyles((c, t) => ({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: radii.pill,
    padding: INSET,
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    // White in both schemes (a switch thumb), lifted by the scheme's soft shadow.
    backgroundColor: c.white,
    boxShadow: t.boxShadows.soft,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    minHeight: 68,
  },
  copy: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 22, color: c.ink },
  subtitle: { marginTop: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
}));
