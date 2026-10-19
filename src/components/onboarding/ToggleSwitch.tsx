/**
 * Spring toggle for dark surfaces: deep-sage track when on (DESIGN §2: `sageDeep` for toggles),
 * white knob that slides with the `snappy` spring and stretches slightly while pressed (the iOS
 * "squish").
 */
import { useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { withAlpha } from '@/components/motion';
import { haptic } from '@/lib/haptics';
import { makeStyles, springs, useColors } from '@/theme';

const TRACK_W = 52;
const TRACK_H = 32;
const INSET = 3;
const KNOB = TRACK_H - INSET * 2;
const STRETCH = 6;

export interface ToggleSwitchProps {
  value: boolean;
  onValueChange: (next: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
}

export function ToggleSwitch({ value, onValueChange, accessibilityLabel, disabled }: ToggleSwitchProps) {
  const c = useColors();
  const styles = useStyles();
  const on = useSharedValue(value ? 1 : 0);
  const pressed = useSharedValue(0);
  // On night in both schemes: white 16% off, deep sage on (captured by the worklet).
  const offTrack = withAlpha(c.white, 0.16);
  const onTrack = c.sageDeep;

  useEffect(() => {
    on.set(withSpring(value ? 1 : 0, springs.snappy));
  }, [value, on]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.get(), [0, 1], [offTrack, onTrack]),
  }));

  const knobStyle = useAnimatedStyle(() => {
    const p = on.get();
    const stretch = STRETCH * pressed.get();
    const travel = TRACK_W - INSET * 2 - KNOB;
    // Stretch grows away from the edge the knob rests on, so it reads as being pulled.
    return { width: KNOB + stretch, transform: [{ translateX: p * (travel - stretch) }] };
  });

  return (
    <Pressable
      onPress={() => {
        haptic.toggle(!value);
        onValueChange(!value);
      }}
      onPressIn={() => pressed.set(withSpring(1, springs.snappy))}
      onPressOut={() => pressed.set(withSpring(0, springs.snappy))}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      hitSlop={8}
      style={disabled ? styles.disabled : null}
    >
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.knob, knobStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const useStyles = makeStyles((c, t) => ({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    padding: INSET,
    justifyContent: 'center',
  },
  knob: {
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: c.white,
    boxShadow: t.boxShadows.soft,
  },
  disabled: { opacity: 0.5 },
}));
