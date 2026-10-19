/**
 * Six OTP boxes (R3: 48×60, r14, white, 1px `line`) driven by one hidden TextInput (so paste, SMS
 * autofill and the native keyboard all just work). The active box gets a 1.5px ink border, lifts a
 * touch and shows a blinking caret; digits pop in with a spring; `status` tints the boxes
 * (error = a danger border on white, success = a staggered sage wave).
 */
import { forwardRef, useEffect, useState, type Ref } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  css,
  cubicBezier,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { easeOutQuint, withAlpha } from '@/components/motion';
import { fonts, makeStyles, springs, useTheme } from '@/theme';
import { authPlanes } from './AuthScaffold';

export type OtpStatus = 'idle' | 'busy' | 'error' | 'success';

const blink = css.keyframes({
  from: { opacity: 1 },
  to: { opacity: 0 },
});
/** Gentle breathe while the code is being verified. */
const breathe = css.keyframes({
  from: { opacity: 1 },
  to: { opacity: 0.55 },
});
const easeInOut = cubicBezier(0.45, 0, 0.55, 1);
const easeOut = cubicBezier(0.22, 1, 0.36, 1);

const BOX_WIDTH = 48;
const BOX_HEIGHT = 60;

interface BoxProps {
  char: string;
  index: number;
  active: boolean;
  status: OtpStatus;
}

function OtpBox({ char, index, active, status }: BoxProps) {
  const theme = useTheme();
  const c = theme.colors;
  const styles = useStyles();
  const reduced = useReducedMotion();
  const filled = char !== '';
  const digit = useSharedValue(filled ? 1 : 0);
  const lift = useSharedValue(0);
  const wave = useSharedValue(1);

  // Digit pops in (and quickly drops out on delete).
  useEffect(() => {
    if (filled) {
      digit.set(0);
      digit.set(withSpring(1, springs.bouncy));
    } else {
      digit.set(withTiming(0, { duration: 90, easing: easeOutQuint }));
    }
  }, [filled, char, digit]);

  // Active box rises a touch.
  useEffect(() => {
    lift.set(withSpring(active ? 1 : 0, springs.snappy));
  }, [active, lift]);

  // Success: a left-to-right wave of pops.
  useEffect(() => {
    if (status !== 'success') return;
    wave.set(
      withDelay(
        index * 55,
        withSequence(withTiming(1.1, { duration: 120, easing: easeOutQuint }), withSpring(1, springs.bouncy)),
      ),
    );
  }, [status, index, wave]);

  const boxStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -2 * lift.get() }, { scale: wave.get() * (1 + 0.03 * lift.get()) }],
  }));

  const digitStyle = useAnimatedStyle(() => {
    const p = digit.get();
    return {
      opacity: interpolate(p, [0, 0.35], [0, 1], Extrapolation.CLAMP),
      transform: [{ translateY: 8 * (1 - p) }, { scale: 0.55 + 0.45 * p }],
    };
  });

  const borderColor =
    status === 'error'
      ? c.danger
      : status === 'success'
        ? c.sage
        : active
          ? c.ink
          : filled
            ? withAlpha(c.ink, 0.28)
            : c.line;
  // 1px at rest; 1.5px when the border carries meaning (active, error, success).
  const borderWidth = active || status === 'error' || status === 'success' ? 1.5 : 1;
  // R3 quiet error: the boxes stay white and only the 1.5px border turns danger (the caption says why).
  const backgroundColor = status === 'success' ? withAlpha(c.sage, 0.16) : authPlanes(c, theme).field;

  return (
    <Animated.View style={[styles.boxWrap, boxStyle]}>
      <Animated.View
        style={[
          styles.box,
          {
            borderWidth,
            borderColor,
            backgroundColor,
            transitionProperty: ['borderColor', 'backgroundColor'],
            transitionDuration: 200,
            transitionDelay: status === 'success' ? index * 55 : 0,
            transitionTimingFunction: easeOut,
          },
        ]}
      >
        <Animated.Text style={[styles.digit, digitStyle]} allowFontScaling={false}>
          {char}
        </Animated.Text>
        {active && !filled && status === 'idle' ? (
          <Animated.View
            style={[
              styles.caret,
              reduced
                ? null
                : {
                    animationName: blink,
                    animationDuration: 560,
                    animationDirection: 'alternate',
                    animationIterationCount: 'infinite',
                    animationTimingFunction: easeInOut,
                  },
            ]}
          />
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

export interface OtpCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  status?: OtpStatus;
  autoFocus?: boolean;
  /**
   * false locks the code while verifying / after success. Deliberately not `readOnly`: on iOS a
   * focused field that becomes read-only resigns, and the keyboard would drop and bounce back.
   */
  editable?: boolean;
  accessibilityLabel?: string;
}

export const OtpCodeInput = forwardRef(function OtpCodeInput(
  { value, onChange, length = 6, status = 'idle', autoFocus = false, editable = true, accessibilityLabel }: OtpCodeInputProps,
  ref: Ref<TextInput>,
) {
  const styles = useStyles();
  const { keyboardAppearance } = useTheme();
  const [focused, setFocused] = useState(false);
  const reduced = useReducedMotion();
  const activeIndex = focused && editable && value.length < length ? value.length : -1;

  const boxes = Array.from({ length }, (_, i) => (
    <OtpBox key={i} index={i} char={value[i] ?? ''} active={i === activeIndex} status={status} />
  ));

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[
          styles.row,
          status === 'busy' && !reduced
            ? {
                animationName: breathe,
                animationDuration: 700,
                animationDirection: 'alternate',
                animationIterationCount: 'infinite',
                animationTimingFunction: easeInOut,
              }
            : null,
        ]}
      >
        {boxes}
      </Animated.View>
      {/* Covers the boxes so a tap anywhere focuses it; selection is pinned to the end so a tap
          can never move the (hidden) caret into the middle of the code. */}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(text) => {
          if (editable) onChange(text.replace(/\D/g, '').slice(0, length));
        }}
        selection={{ start: value.length, end: value.length }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        maxLength={length}
        inputMode="numeric"
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        autoCorrect={false}
        spellCheck={false}
        caretHidden
        keyboardAppearance={keyboardAppearance}
        selectionColor="transparent"
        accessibilityLabel={accessibilityLabel ?? `Verification code, ${length} digits`}
        accessibilityHint={`${value.length} of ${length} digits entered`}
        style={styles.hiddenInput}
      />
    </View>
  );
});

const useStyles = makeStyles((c) => ({
  wrap: { position: 'relative' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, pointerEvents: 'none' },
  boxWrap: { flex: 1, maxWidth: BOX_WIDTH },
  box: {
    height: BOX_HEIGHT,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: { fontFamily: fonts.semibold, fontSize: 26, lineHeight: 32, color: c.ink },
  caret: {
    position: 'absolute',
    width: 2,
    height: 26,
    borderRadius: 1,
    backgroundColor: c.ink,
  },
  hiddenInput: {
    ...StyleSheet.absoluteFill,
    opacity: 0.015,
    color: 'transparent',
    fontSize: 16,
    // Hide the native field completely but keep it focusable / tappable.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', cursor: 'pointer' } as object) : null),
  },
}));
