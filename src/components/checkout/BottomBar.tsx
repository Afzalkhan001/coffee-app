import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, type ReactNode } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { easeOutQuint, withAlpha } from '@/components/motion';
import { layout, makeStyles, makeThemed, spacing, springs } from '@/theme';
import { useKeyboardVisible, useTextInputFocused } from './hooks';

/**
 * How far the bar slides down when it hides. Web only fades (and settles 0.98): a translated bar
 * pokes below the page, and the focused field's `scrollIntoView` then scrolls the whole app up.
 */
const HIDE_SLIDE = Platform.OS === 'web' ? 0 : 48;
/**
 * Breathing room above the primary bar: content dissolves through a 16px fade into 12px of solid
 * canvas, so a half-scrolled peach card or sheet edge can't glow through right above the bar.
 */
const FADE_H = 16;
const SOLID_H = 12;
export const BAR_PAD_TOP = FADE_H + SOLID_H;
const PAD_TOP = BAR_PAD_TOP;
/** Front-loaded: most of the canvas is back within the first half of the fade. */
const useFadeColors = makeThemed((c) => [withAlpha(c.bg, 0), withAlpha(c.bg, 0.88), c.bg] as const);
const FADE_STOPS = [0, 0.55, 1] as const;
/** Hint line above a disabled bar ("Choose a size to continue"): text + its margin. */
export const BAR_HINT_SPACE = 30;

/** Bottom padding for scroll content that sits under a `BottomBar` (bar + hint line + safe area). */
export function useBottomBarSpace(withHint = false): number {
  const insets = useSafeAreaInsets();
  return PAD_TOP + layout.ctaHeight + (withHint ? BAR_HINT_SPACE : 0) + Math.max(insets.bottom, spacing.md) + spacing.md;
}

export interface BottomBarProps {
  children: ReactNode;
  /** Slide the bar away (e.g. empty state). It also hides itself while the keyboard is up. */
  hidden?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Sticky footer for the screen's one ink primary action. Content dissolves into a short cream fade
 * and then a solid cream floor (so nothing ghosts behind the bar or its hint line), and the bar
 * slides down out of the way while typing: on native via keyboard events, on web while a text
 * field has focus (web never fires keyboard events).
 */
export function BottomBar({ children, hidden = false, style }: BottomBarProps) {
  const styles = useStyles();
  const fadeColors = useFadeColors();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardVisible();
  const typing = useTextInputFocused();
  const away = hidden || keyboard || typing;
  const shown = useSharedValue(away ? 0 : 1);

  useEffect(() => {
    shown.set(away ? withTiming(0, { duration: 200, easing: easeOutQuint }) : withSpring(1, springs.smooth));
  }, [away, shown]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateY: (1 - shown.get()) * HIDE_SLIDE }, { scale: HIDE_SLIDE === 0 ? 0.98 + 0.02 * shown.get() : 1 }],
  }));

  return (
    // The Animated.View only animates opacity/transform and is statically `box-none`. Taps are
    // toggled on the plain View inside ('none' ↔ 'auto'): on web an inline `pointer-events` written
    // into an animated style is never cleared when it flips back to 'box-none' (invalid inline CSS),
    // which left "Deliver here" dead after the bar had been hidden once (Q-02).
    <Animated.View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.xs }, animatedStyle, style]}>
      {/* The floor swallows taps so content hidden behind it can't be hit; the fade lets them through. */}
      <View style={[styles.floor, { pointerEvents: away ? 'none' : 'auto' }]} />
      <LinearGradient colors={fadeColors} locations={FADE_STOPS} style={styles.fade} />
      <View
        style={{ pointerEvents: away ? 'none' : 'auto' }}
        aria-hidden={away}
        accessibilityElementsHidden={away}
        importantForAccessibility={away ? 'no-hide-descendants' : 'auto'}
      >
        {children}
      </View>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: PAD_TOP,
    paddingHorizontal: spacing.gutter,
    pointerEvents: 'box-none',
  },
  fade: { position: 'absolute', left: 0, right: 0, top: 0, height: FADE_H, pointerEvents: 'none' },
  floor: { position: 'absolute', left: 0, right: 0, top: FADE_H, bottom: 0, backgroundColor: c.bg },
}));
