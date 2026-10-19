import { useEffect, useRef, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { playHaptic, type PressHapticKind } from '@/lib/haptics';
import { springs, useTheme } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Touch-down → visual press delay on native. Inside a ScrollView, Pressable becomes the responder on
 * touch start and is only terminated once the scroll claims the gesture; without this delay every
 * drag that starts on a card made it dip and wobble. Short drags never show a press now, real taps
 * still dip within ~3 frames. Web (mouse) presses immediately.
 */
const PRESS_IN_DELAY = Platform.OS === 'web' ? 0 : 55;

export interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Scale when pressed. Default 0.97 (DESIGN.md §7). */
  activeScale?: number;
  /**
   * Haptic for this control (docs/HAPTICS.md). Default `null`: navigation taps are silent. `press`
   * fires on press-in (with the visual dip, or at release for a faster tap); every other kind fires
   * when the tap lands. A component that fires its own semantic haptic leaves this `null`.
   */
  hapticKind?: PressHapticKind | null;
  /**
   * Opt-in: fade in a deeper shadow while pressed (DESIGN §7 "slightly deepens its shadow";
   * `theme.boxShadows.pressCard` / `pressStrong`). Implemented as an absolute underlay whose
   * opacity follows the press (animated `shadow*` props are dropped on web and Android).
   * Don't use on a style with `overflow: 'hidden'` (the underlay's shadow would be clipped).
   */
  shadow?: 'card' | 'strong';
}

/**
 * The base touchable for every card, pill and circle button: spring scale-down on press-in (after a
 * short scroll-safe delay on native), a calm spring back when released or cancelled, and a small
 * overshoot only when the press actually lands — all on the UI thread.
 */
export function PressableScale({
  children,
  style,
  activeScale = 0.97,
  hapticKind = null,
  shadow,
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  ...rest
}: PressableScaleProps) {
  const reduced = useReducedMotion();
  const { boxShadows } = useTheme();
  const scale = useSharedValue(1);
  // `press` lands with the visual dip (PRESS_IN_DELAY after touch-down), so a scroll that starts on
  // the button and is claimed within the delay stays silent like the dip; a faster tap fires at release.
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressFired = useRef(false);
  const clearPressTimer = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };
  useEffect(
    () => () => {
      if (pressTimer.current) clearTimeout(pressTimer.current);
    },
    [],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  const underlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scale.get(), [1, activeScale], [0, 1], Extrapolation.CLAMP),
  }));

  const radius = shadow ? StyleSheet.flatten(style)?.borderRadius : undefined;
  // A control that looks disabled but stays pressable (PrimaryBar nudges toward the missing step).
  // RN-web drops `accessibilityState`, and any disabled prop on a role="button" View renders a native
  // `<button disabled>` that swallows the tap, so the nudge never ran on web. Set `aria-disabled` on
  // the DOM node directly instead: announced as disabled, still clickable. Native reads
  // `accessibilityState` below.
  const softDisabledWeb = Platform.OS === 'web' && !disabled && !!rest.accessibilityState?.disabled;
  const domRef = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || disabled) return;
    const node = domRef.current as unknown as { setAttribute?: (k: string, v: string) => void; removeAttribute?: (k: string) => void } | null;
    if (softDisabledWeb) node?.setAttribute?.('aria-disabled', 'true');
    else node?.removeAttribute?.('aria-disabled');
  }, [softDisabledWeb, disabled]);

  return (
    <AnimatedPressable
      {...rest}
      ref={Platform.OS === 'web' ? domRef : undefined}
      disabled={disabled}
      accessibilityRole={rest.accessibilityRole ?? 'button'}
      accessibilityState={{ disabled: !!disabled, ...rest.accessibilityState }}
      onPressIn={(e) => {
        if (!reduced) scale.set(withDelay(PRESS_IN_DELAY, withSpring(activeScale, springs.snappy)));
        if (hapticKind === 'press') {
          clearPressTimer();
          pressFired.current = false;
          pressTimer.current = setTimeout(() => {
            pressTimer.current = null;
            pressFired.current = true;
            playHaptic('press');
          }, PRESS_IN_DELAY);
        }
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        // Cancelled presses (a scroll took over) settle without the bouncy overshoot.
        scale.set(withSpring(1, springs.snappy));
        clearPressTimer();
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (!reduced) scale.set(withSequence(withSpring(1.015, springs.snappy), withSpring(1, springs.snappy)));
        if (hapticKind === 'press') {
          // Released before the dip: the tap still committed, so it clicks now (once).
          if (!pressFired.current) playHaptic('press');
          clearPressTimer();
          pressFired.current = false;
        } else if (hapticKind) {
          playHaptic(hapticKind);
        }
        onPress?.(e);
      }}
      style={[style, animatedStyle]}
    >
      {shadow ? (
        <Animated.View
          style={[styles.underlay, { borderRadius: radius, boxShadow: shadow === 'card' ? boxShadows.pressCard : boxShadows.pressStrong }, underlayStyle]}
        />
      ) : null}
      {children}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  underlay: { ...StyleSheet.absoluteFill, pointerEvents: 'none' },
});
