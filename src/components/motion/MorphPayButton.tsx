import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  interpolateColor,
  ReduceMotion,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';
import { Icon, Text } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { layout, makeStyles, spacing, springs, useColors } from '@/theme';
import { AnimatedCheck } from './AnimatedCheck';
import { withAlpha } from './color';
import { easeOutQuint, shakeValue } from './hooks';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type MorphPayButtonState = 'idle' | 'loading' | 'success' | 'error';

const H = layout.ctaHeight;
const KNOB = H - 12;
const SPIN = 30;
const SPIN_R = 12;
const SPIN_C = 2 * Math.PI * SPIN_R;
/** The check pops in (and the sage ripple starts) this long after `success`; the success haptic lands with it. */
const CHECK_DELAY = 120;
const swapIn = FadeIn.duration(220).easing(easeOutQuint);
const swapOut = FadeOut.duration(140);

export interface MorphPayButtonProps {
  state: MorphPayButtonState;
  /** e.g. "Pay ₹620" (idle) or "Try again" (error) — label changes cross-fade. */
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Ionicons name in the white knob while idle. Default "lock-closed". Error shows "refresh". */
  icon?: string;
  /**
   * Haptics (docs/HAPTICS.md), default true: `press` on press-in, `success` on the frame the check
   * pops in, `error` as it turns into the retry. The screen must not fire its own for these.
   */
  haptics?: boolean;
  /**
   * The error state's look. `danger` (default): the pill tints red. `ink`: the pill stays ink and only
   * the retry glyph turns danger, for screens that already say what went wrong in danger text.
   */
  errorTone?: 'danger' | 'ink';
  style?: StyleProp<ViewStyle>;
}

/** Ink pay pill that morphs → circle spinner → sage check, or shakes into a danger-tinted retry. */
export function MorphPayButton({
  state,
  label,
  onPress,
  disabled = false,
  icon = 'lock-closed',
  haptics = true,
  errorTone = 'danger',
  style,
}: MorphPayButtonProps) {
  const reduced = useReducedMotion();
  const c = useColors();
  const styles = useStyles();
  // The ink pill inverts in dark (cream pill, espresso knob); error and success fills don't. The
  // worklet below closes over these, so a scheme change re-creates it with the new colours.
  const idleFill = c.ink;
  const errorFill = errorTone === 'ink' ? c.ink : c.danger;
  const successFill = c.sage;
  const [fullWidth, setFullWidth] = useState(0);
  const collapsed = state === 'loading' || state === 'success';
  const interactive = !disabled && (state === 'idle' || state === 'error');

  const width = useSharedValue(0);
  const content = useSharedValue(collapsed ? 0 : 1);
  const spinner = useSharedValue(state === 'loading' ? 1 : 0);
  const spin = useSharedValue(0);
  const success = useSharedValue(state === 'success' ? 1 : 0);
  const failure = useSharedValue(state === 'error' ? 1 : 0);
  const ripple = useSharedValue(0);
  const pressed = useSharedValue(0);
  const shakeX = useSharedValue(0);
  const dim = useSharedValue(disabled ? 1 : 0);
  const lastState = useRef<MorphPayButtonState | null>(null);

  // Width: full pill ↔ 64px circle (spring). First measurement snaps.
  useEffect(() => {
    if (fullWidth === 0) return;
    const target = collapsed ? H : fullWidth;
    if (width.get() === 0) width.set(target);
    else width.set(withSpring(target, springs.smooth));
  }, [collapsed, fullWidth, width]);

  useEffect(() => {
    dim.set(withTiming(disabled ? 1 : 0, { duration: 180, easing: easeOutQuint }));
  }, [disabled, dim]);

  useEffect(() => {
    const prev = lastState.current;
    lastState.current = state;
    if (prev === state) return;
    const spinForever = () => {
      // Status, not decoration: keep the spinner turning under Reduce Motion.
      spin.set(0);
      spin.set(withRepeat(withTiming(1, { duration: 850, easing: Easing.linear }), -1, false, undefined, ReduceMotion.Never));
    };
    if (prev === null) {
      // First mount: values were initialised for this state; only a spinner needs starting.
      if (state === 'loading') spinForever();
      return;
    }
    const fade = (to: number, duration: number) => withTiming(to, { duration, easing: easeOutQuint });

    if (state === 'loading') {
      content.set(fade(0, 120));
      success.set(fade(0, 160));
      failure.set(fade(0, 220));
      spinner.set(withDelay(150, fade(1, 200)));
      spinForever();
    } else if (state === 'success') {
      content.set(fade(0, 120));
      failure.set(fade(0, 160));
      spinner.set(fade(0, 140));
      success.set(withTiming(1, { duration: 260, easing: easeOutQuint }));
      ripple.set(0);
      ripple.set(withDelay(CHECK_DELAY, withTiming(1, { duration: 720, easing: easeOutQuint })));
    } else if (state === 'error') {
      cancelAnimation(spin);
      spinner.set(fade(0, 120));
      success.set(fade(0, 160));
      failure.set(withTiming(1, { duration: 240, easing: easeOutQuint }));
      content.set(withDelay(140, fade(1, 220)));
      shakeValue(shakeX, 6, 3, 180);
      if (haptics) haptic.error();
    } else {
      cancelAnimation(spin);
      spinner.set(fade(0, 120));
      success.set(fade(0, 200));
      failure.set(fade(0, 200));
      content.set(withDelay(120, fade(1, 220)));
    }
  }, [state, haptics, content, success, failure, spinner, spin, ripple, shakeX]);

  // `success` lands on the frame the check pops in: the ripple starts on that same frame.
  useAnimatedReaction(
    () => ripple.get() > 0,
    (started, before) => {
      if (started && before === false && haptics) scheduleOnRN(haptic.success);
    },
  );

  const pillStyle = useAnimatedStyle(() => {
    const w = width.get();
    const base = interpolateColor(failure.get(), [0, 1], [idleFill, errorFill]);
    return {
      width: w === 0 || fullWidth === 0 ? '100%' : Math.min(fullWidth, Math.max(H, w)),
      backgroundColor: interpolateColor(success.get(), [0, 1], [base, successFill]),
      opacity: 1 - 0.58 * dim.get(),
      transform: [{ translateX: shakeX.get() }, { scale: reduced ? 1 : 1 - 0.025 * pressed.get() }],
    };
  });
  const contentStyle = useAnimatedStyle(() => ({
    opacity: content.get(),
    transform: [{ scale: 0.96 + 0.04 * content.get() }],
  }));
  const spinnerStyle = useAnimatedStyle(() => ({
    opacity: spinner.get(),
    transform: [{ rotate: `${spin.get() * 360}deg` }, { scale: 0.6 + 0.4 * spinner.get() }],
  }));
  const rippleStyle = useAnimatedStyle(() => {
    const r = ripple.get();
    return {
      opacity: r <= 0 || r >= 1 ? 0 : 0.55 * (1 - r),
      transform: [{ scale: 1 + 0.75 * r }],
    };
  });

  const a11yLabel =
    state === 'loading' ? 'Processing payment' : state === 'success' ? 'Payment successful' : label;

  return (
    <View
      style={[styles.track, style]}
      onLayout={(e) => {
        const w = Math.round(e.nativeEvent.layout.width);
        if (w !== fullWidth) setFullWidth(w);
      }}
    >
      <Animated.View style={[styles.ripple, rippleStyle]} />
      <AnimatedPressable
        onPress={() => {
          if (interactive) onPress();
        }}
        onPressIn={() => {
          if (!interactive) return;
          pressed.set(withSpring(1, springs.snappy));
          // A committing CTA: the click lands with the press dip.
          if (haptics) haptic.press();
        }}
        onPressOut={() => pressed.set(withSpring(0, springs.snappy))}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityState={{ disabled: !interactive, busy: state === 'loading' }}
        style={[styles.pill, pillStyle]}
      >
        <View style={styles.clip}>
          <Animated.View style={[styles.content, { width: fullWidth || '100%' }, contentStyle]}>
            <View style={styles.labelBox}>
              <Animated.View key={label} entering={swapIn} exiting={swapOut} style={styles.labelLayer}>
                <Text variant="h2" color={c.onInk} numberOfLines={1} style={styles.label}>
                  {label}
                </Text>
              </Animated.View>
            </View>
            <View style={styles.knob}>
              <Animated.View
                key={state === 'error' ? 'retry' : 'icon'}
                entering={swapIn}
                exiting={swapOut}
                style={styles.knobLayer}
              >
                <Icon name={state === 'error' ? 'refresh' : icon} size={22} color={state === 'error' && errorTone === 'ink' ? c.danger : c.ink} />
              </Animated.View>
            </View>
          </Animated.View>

          <Animated.View style={[styles.center, spinnerStyle]}>
            <Svg width={SPIN} height={SPIN} viewBox={`0 0 ${SPIN} ${SPIN}`}>
              <Circle cx={SPIN / 2} cy={SPIN / 2} r={SPIN_R} stroke={withAlpha(c.onInk, 0.2)} strokeWidth={2.5} fill="none" />
              <Circle
                cx={SPIN / 2}
                cy={SPIN / 2}
                r={SPIN_R}
                stroke={c.onInk}
                strokeWidth={2.5}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={[SPIN_C * 0.28, SPIN_C]}
              />
            </Svg>
          </Animated.View>

          <View style={styles.center}>
            {/* On the sage fill in both schemes. */}
            <AnimatedCheck size={30} color={c.white} ring={false} play={state === 'success'} delay={CHECK_DELAY} strokeWidth={3} />
          </View>
        </View>
      </AnimatedPressable>
    </View>
  );
}

const useStyles = makeStyles((c, t) => ({
  track: { height: H, alignItems: 'center', justifyContent: 'center' },
  pill: { height: H, borderRadius: H / 2, boxShadow: t.boxShadows.strong },
  clip: {
    ...StyleSheet.absoluteFill,
    borderRadius: H / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    height: H,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.xl,
    paddingRight: 6,
  },
  labelBox: { flex: 1, height: H, marginRight: spacing.sm },
  labelLayer: { ...StyleSheet.absoluteFill, justifyContent: 'center' },
  label: { fontSize: 19 },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: c.onInk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knobLayer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
  ripple: {
    position: 'absolute',
    width: H,
    height: H,
    borderRadius: H / 2,
    borderWidth: 2,
    borderColor: c.sage,
  },
}));
