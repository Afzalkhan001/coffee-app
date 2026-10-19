import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { Icon, Text } from '@/components/ui';
import { makeStyles, makeThemed, radii, spacing, springs, useColors } from '@/theme';
import { withAlpha } from './color';
import { easeOutQuint } from './hooks';

export type ToastTone = 'default' | 'success' | 'error';

export interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
  icon?: string;
}

/** How long a toast stays before sliding away. */
export const TOAST_LIFETIME_MS = 2200;
/** Extra travel above the safe area when hidden. */
const OFFSCREEN = 96;
const EXIT = { duration: 260, easing: Easing.in(Easing.cubic), reduceMotion: ReduceMotion.Never } as const;

/** On the toast `capsule` (dark in both schemes). */
const useTones = makeThemed((c): Record<ToastTone, { disc: string; icon: string; fg: string }> => ({
  default: { disc: withAlpha(c.white, 0.12), icon: 'cafe', fg: c.peach },
  success: { disc: c.sageDeep, icon: 'checkmark', fg: c.white },
  error: { disc: c.danger, icon: 'alert', fg: c.white },
}));

interface ToastViewProps {
  item: ToastItem;
  /** A newer toast arrived: shrink back and fade out under it. */
  superseded: boolean;
  /** Stable callback: remove this toast from the stack. */
  onGone: (id: number) => void;
}

/**
 * One toast pill (ink in light, a lifted espresso `capsule` in dark): springs down under the safe
 * area, auto-dismisses, tap to dismiss early.
 */
export function ToastView({ item, superseded, onGone }: ToastViewProps) {
  const insets = useSafeAreaInsets();
  const c = useColors();
  const styles = useStyles();
  const TONES = useTones();
  const reduced = useReducedMotion();
  const enter = useSharedValue(0);
  const leave = useSharedValue(0);
  const back = useSharedValue(0);
  const id = item.id;
  const travel = insets.top + OFFSCREEN;

  useEffect(() => {
    enter.set(
      reduced
        ? withTiming(1, { duration: 160, easing: easeOutQuint, reduceMotion: ReduceMotion.Never })
        : withSpring(1, springs.smooth),
    );
    // Lifetime runs on the UI thread. ReduceMotion.Never: under Reduce Motion `withDelay`
    // would otherwise skip its delay and the toast would vanish immediately.
    leave.set(
      withDelay(
        TOAST_LIFETIME_MS,
        withTiming(1, EXIT, (finished) => {
          if (finished) scheduleOnRN(onGone, id);
        }),
        ReduceMotion.Never,
      ),
    );
    return () => {
      cancelAnimation(enter);
      cancelAnimation(leave);
      cancelAnimation(back);
    };
  }, [enter, leave, back, reduced, onGone, id]);

  useEffect(() => {
    if (!superseded) return;
    cancelAnimation(leave);
    back.set(
      withTiming(1, { duration: 240, easing: easeOutQuint, reduceMotion: ReduceMotion.Never }, (finished) => {
        if (finished) scheduleOnRN(onGone, id);
      }),
    );
  }, [superseded, back, leave, onGone, id]);

  const dismiss = () => {
    cancelAnimation(leave);
    leave.set(
      withTiming(1, EXIT, (finished) => {
        if (finished) scheduleOnRN(onGone, id);
      }),
    );
  };

  const animatedStyle = useAnimatedStyle(() => {
    const e = enter.get();
    const l = leave.get();
    const b = back.get();
    const visible = interpolate(e, [0, 0.35], [0, 1], Extrapolation.CLAMP) * (1 - l) * (1 - b);
    if (reduced) return { opacity: visible };
    return {
      opacity: visible,
      transform: [
        { translateY: -(1 - e) * travel - l * travel * 0.7 - b * 10 },
        { scale: 0.94 + 0.06 * e - 0.08 * b },
      ],
    };
  });

  const tone = TONES[item.tone];

  return (
    <Animated.View style={[styles.wrap, { top: insets.top + spacing.xs }, animatedStyle]}>
      <Pressable
        onPress={dismiss}
        accessibilityRole="alert"
        // Native announces via AccessibilityInfo (OverlayHost); web uses aria-live.
        accessibilityLiveRegion={Platform.OS === 'web' ? 'polite' : 'none'}
        accessibilityLabel={item.message}
        accessibilityHint="Dismisses the message"
        style={styles.pill}
      >
        <View style={[styles.disc, { backgroundColor: tone.disc }]}>
          <Icon name={item.icon ?? tone.icon} size={17} color={tone.fg} />
        </View>
        <Text variant="bodyMedium" color={c.white} numberOfLines={2} style={styles.message}>
          {item.message}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const DISC = 34;

const useStyles = makeStyles((c, t) => ({
  wrap: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: 440,
    minHeight: 52,
    paddingLeft: 9,
    paddingRight: spacing.lg,
    paddingVertical: 9,
    borderRadius: radii.pill,
    backgroundColor: c.capsule,
    borderWidth: StyleSheet.hairlineWidth * 2,
    // A touch brighter in dark, where the edge (not a shadow) separates the capsule from the canvas.
    borderColor: withAlpha(c.white, t.isDark ? 0.12 : 0.08),
    boxShadow: t.boxShadows.float,
  },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: { flexShrink: 1 },
}));
