import { BlurView } from 'expo-blur';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  ReduceMotion,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { AnimatedBlurView, easeOutQuint, withAlpha } from '@/components/motion';
import { useHideLivePill } from '@/components/order/livePillSpace';
import { makeStyles, radii, spacing, springs } from '@/theme';

const IS_IOS = Platform.OS === 'ios';
const IS_ANDROID = Platform.OS === 'android';
/** Backdrop blur strength: strong enough that the list behind recedes instead of competing. */
const BACKDROP_BLUR = 40;

export interface ModalSheetProps {
  visible: boolean;
  /** Backdrop tap, Android back and Escape (web) call this when `dismissable`. */
  onClose: () => void;
  /** 'bottom' = grabber sheet sliding up; 'center' = dialog card popping in. Default 'bottom'. */
  placement?: 'bottom' | 'center';
  /** Default true. False while a request is in flight. */
  dismissable?: boolean;
  /** No white card / padding: the child draws its own surface (e.g. the redeem ticket). */
  bare?: boolean;
  /** Fires after the close animation has finished and the modal is gone. */
  onClosed?: () => void;
  accessibilityLabel?: string;
  contentStyle?: StyleProp<ViewStyle>;
  /**
   * The sheet holds a text field. Android only: an RN Modal is its own window, which edge-to-edge
   * never resizes for the keyboard, and React Native only reports the keyboard of the activity
   * window, so nothing can lift a bottom sheet above it. A `bottom` sheet with a field docks under
   * the status bar as a card instead (same pop-in as `center`), clear of the keyboard.
   */
  withInput?: boolean;
  children: ReactNode;
}

/**
 * Gesture-free modal layer used by every dialog/sheet in the account screens. Renders above the
 * tab bar (RN `Modal`), with a blurred + dimmed backdrop (62% ink, blur 40) and spring-driven
 * content on the UI thread. It animates out before unmounting. Reduce Motion → a quick cross-fade
 * with no travel. On iOS the blur fades in by intensity, never by the opacity of the blur view.
 */
export function ModalSheet({
  visible,
  onClose,
  placement = 'bottom',
  dismissable = true,
  bare = false,
  onClosed,
  accessibilityLabel,
  contentStyle,
  withInput = false,
  children,
}: ModalSheetProps) {
  const styles = useStyles();
  // The root-level live order pill would float over the dim on web: keep it away while open.
  useHideLivePill(visible);
  const docked = withInput && IS_ANDROID && placement === 'bottom';
  const asCard = placement === 'center' || docked;
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  // Mount as soon as we're asked to show (derived state; unmount happens after the exit animation).
  if (visible && !mounted) setMounted(true);

  const progress = useSharedValue(0);
  const sheetHeight = useSharedValue(windowHeight * 0.6);
  const onClosedRef = useRef(onClosed);
  useEffect(() => {
    onClosedRef.current = onClosed;
  });

  useEffect(() => {
    if (!mounted) return;
    if (visible) {
      progress.set(
        reduced
          ? withTiming(1, { duration: 160, easing: easeOutQuint, reduceMotion: ReduceMotion.Never })
          : withSpring(1, springs.smooth),
      );
      return;
    }
    const done = () => {
      setMounted(false);
      onClosedRef.current?.();
    };
    progress.set(
      withTiming(0, { duration: reduced ? 140 : 220, easing: easeOutQuint, reduceMotion: ReduceMotion.Never }, (finished) => {
        if (finished) scheduleOnRN(done);
      }),
    );
  }, [visible, mounted, reduced, progress]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 1], [0, 1], Extrapolation.CLAMP),
  }));
  const blurProps = useAnimatedProps(() => ({
    intensity: BACKDROP_BLUR * interpolate(progress.get(), [0, 1], [0, 1], Extrapolation.CLAMP),
  }));

  const bottomStyle = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: reduced ? interpolate(p, [0, 1], [0, 1], Extrapolation.CLAMP) : 1,
      transform: [{ translateY: reduced ? 0 : interpolate(p, [0, 1], [sheetHeight.get() + 40, 0]) }],
    };
  });

  const centerStyle = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: interpolate(p, [0, 0.55], [0, 1], Extrapolation.CLAMP),
      transform: reduced
        ? []
        : [{ translateY: interpolate(p, [0, 1], [28, 0]) }, { scale: interpolate(p, [0, 1], [0.92, 1]) }],
    };
  });

  const close = () => {
    if (dismissable) onClose();
  };

  return (
    <>
      {/* Light status-bar content over the dark scrim while open (iOS; Android's dialog window keeps
          the appearance it had when it opened). Undefined = no say: the screen's style applies. */}
      <StatusBar barStyle={visible ? 'light-content' : undefined} animated />
      <Modal
        visible={mounted}
        transparent
        animationType="none"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={close}
      >
        <View style={styles.root}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close"
            accessible={dismissable}
          >
            {IS_IOS ? (
              <AnimatedBlurView tint="dark" intensity={0} animatedProps={blurProps} style={StyleSheet.absoluteFill} />
            ) : (
              <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
                <BlurView intensity={BACKDROP_BLUR} tint="dark" style={StyleSheet.absoluteFill} />
              </Animated.View>
            )}
            {/* Dim layer is a sibling: on web BlurView overwrites its own backgroundColor. */}
            <Animated.View style={[StyleSheet.absoluteFill, styles.dim, backdropStyle]} />
          </Pressable>

          <KeyboardAvoidingView
            behavior={IS_IOS ? 'padding' : undefined}
            style={[
              styles.layer,
              docked ? [styles.layerDocked, { paddingTop: insets.top + spacing.xl }] : null,
              !docked && placement === 'center' ? styles.layerCenter : null,
              !docked && placement === 'bottom' ? styles.layerBottom : null,
            ]}
          >
            {asCard ? (
              <Animated.View
                accessibilityViewIsModal
                accessibilityLabel={accessibilityLabel}
                style={[styles.center, bare ? null : styles.card, centerStyle, contentStyle]}
              >
                {children}
              </Animated.View>
            ) : (
              <Animated.View
                accessibilityViewIsModal
                accessibilityLabel={accessibilityLabel}
                onLayout={(e) => sheetHeight.set(e.nativeEvent.layout.height)}
                style={[
                  bare ? null : styles.sheet,
                  { paddingBottom: (bare ? 0 : spacing.lg) + insets.bottom },
                  bottomStyle,
                  contentStyle,
                ]}
              >
                {bare ? null : <View style={styles.grabber} />}
                {children}
              </Animated.View>
            )}
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const useStyles = makeStyles((c, t) => ({
  root: { flex: 1 },
  // 62% R3 ink over cream; a black dim over espresso (an ink dim there would barely darken it).
  dim: { backgroundColor: t.isDark ? withAlpha(c.black, 0.66) : withAlpha(c.inkFixed, 0.62) },
  layer: { flex: 1, pointerEvents: 'box-none' },
  layerBottom: { justifyContent: 'flex-end' },
  layerCenter: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl },
  layerDocked: { justifyContent: 'flex-start', alignItems: 'center', paddingHorizontal: spacing.md },
  center: { width: '100%', maxWidth: 400 },
  card: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
  },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.sm,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: c.line,
    marginBottom: spacing.md,
  },
}));
