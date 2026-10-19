/**
 * Brand splash overlay (BUILD_CONTRACT routes table, DESIGN.md §7 "Splash → onboarding").
 * Rendered by src/app/_layout.tsx above the Stack once fonts + persisted stores are ready, so it
 * picks up exactly where the native splash leaves off (R3: on `night`):
 *   bean mark draws itself → Fraunces wordmark fades in while its letter-spacing tightens →
 *   tagline → (~1.4s) the mark and wordmark fade and swell away first, then the night layer
 *   fades with a slight scale-up so the first screen comes up from underneath (no double exposure
 *   of the wordmark over Home); then `onFinish` unmounts it.
 * Reduce Motion: everything is shown at rest and the layer cross-fades out right away.
 */
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
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
import { scheduleOnRN } from 'react-native-worklets';
import { easeOutQuint, LineArt, withAlpha } from '@/components/motion';
import { fonts, makeStyles, spacing, springs, useColors } from '@/theme';
import { brand } from '@/theme/brand';

// ── Splash gate ──────────────────────────────────────────────────────────────
// The first screen mounts underneath the splash, so its entrance would finish unseen. Screens can
// gate their entrance on `useSplashLifted()`, which flips as the splash starts to lift away.
let splashLifted = false;
const liftListeners = new Set<() => void>();
let safetyTimer: ReturnType<typeof setTimeout> | null = null;
/** Never hold a screen back if the splash is not mounted at all. */
const LIFT_SAFETY_MS = 2600;

function markSplashLifted() {
  if (splashLifted) return;
  splashLifted = true;
  if (safetyTimer) clearTimeout(safetyTimer);
  safetyTimer = null;
  liftListeners.forEach((listener) => listener());
}

function subscribeLift(listener: () => void) {
  liftListeners.add(listener);
  if (!splashLifted && !safetyTimer) safetyTimer = setTimeout(markSplashLifted, LIFT_SAFETY_MS);
  return () => {
    liftListeners.delete(listener);
  };
}

const readLifted = () => splashLifted;

/**
 * True once the launch splash has started lifting (and forever after, e.g. on later mounts).
 * Use it to start a first screen's entrance in view: `{lifted ? <Content /> : null}` or
 * `useEffect(() => { if (lifted) play(); }, [lifted])`.
 */
export function useSplashLifted(): boolean {
  return useSyncExternalStore(subscribeLift, readLifted, readLifted);
}

export interface AnimatedSplashProps {
  /** Called once (JS thread) after the splash has faded out. */
  onFinish: () => void;
}

/** When the exit starts (ms after mount). */
const HOLD_MS = 1400;
/** Content (mark, wordmark, tagline) fades out first… */
const CONTENT_EXIT_MS = 300;
/** …then the night layer, starting once the content is ~90% gone. */
const LAYER_EXIT_DELAY_MS = 120;
const EXIT_MS = 420;
/** `useSplashLifted()` flips this long before the exit fade starts. */
const LIFT_LEAD_MS = 120;
const MARK = 72;
const GLOW = 360;
const RING = 116;
/** Wordmark tracking: starts airy, settles tight. */
const TRACK_FROM = 9;
const TRACK_TO = 0.4;
/**
 * iOS and web add letter-spacing after the last glyph too, which nudges a centred word left by
 * half the spacing; shift it back so the wordmark stays optically centred while it tightens.
 */
const TRAILING_COMPENSATION = Platform.OS === 'android' ? 0 : 0.5;

export function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  const c = useColors();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const intro = useSharedValue(reduced ? 1 : 0);
  const ring = useSharedValue(reduced ? 1 : 0);
  const tagline = useSharedValue(reduced ? 1 : 0);
  const exit = useSharedValue(0);
  const contentExit = useSharedValue(0);
  const gate = useSharedValue(0);

  // Latest callback without restarting the timeline if the parent re-renders.
  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    const finish = () => onFinishRef.current();
    if (reduced) {
      markSplashLifted();
      // ReduceMotion.Never: a quick cross-fade instead of a hard cut.
      exit.set(
        withDelay(
          200,
          withTiming(1, { duration: 220, easing: easeOutQuint, reduceMotion: ReduceMotion.Never }, (finished) => {
            if (finished) scheduleOnRN(finish);
          }),
          ReduceMotion.Never,
        ),
      );
      return;
    }
    ring.set(withSpring(1, springs.gentle));
    intro.set(withDelay(140, withTiming(1, { duration: 1100, easing: easeOutQuint })));
    tagline.set(withDelay(640, withTiming(1, { duration: 480, easing: easeOutQuint })));
    // Release the first screen a beat before the fade so its entrance plays as the splash lifts.
    gate.set(
      withDelay(
        HOLD_MS - LIFT_LEAD_MS,
        withTiming(1, { duration: 16 }, (finished) => {
          if (finished) scheduleOnRN(markSplashLifted);
        }),
      ),
    );
    contentExit.set(withDelay(HOLD_MS, withTiming(1, { duration: CONTENT_EXIT_MS, easing: easeOutQuint })));
    exit.set(
      withDelay(
        HOLD_MS + LAYER_EXIT_DELAY_MS,
        withTiming(1, { duration: EXIT_MS, easing: easeOutQuint }, (finished) => {
          if (finished) scheduleOnRN(finish);
        }),
      ),
    );
  }, [reduced, intro, ring, tagline, exit, contentExit, gate]);

  // The night layer: fades with a slight scale-up, so the screen below seems to rise through it.
  const layerStyle = useAnimatedStyle(() => {
    const e = exit.get();
    return { opacity: 1 - e, transform: reduced ? [] : [{ scale: 1 + 0.06 * e }] };
  });

  // The content leaves first (gone before the layer is half transparent): no wordmark ghosting
  // over the first screen's content.
  const contentStyle = useAnimatedStyle(() => {
    if (reduced) return {};
    const ce = contentExit.get();
    return {
      opacity: interpolate(ce, [0, 0.8], [1, 0], Extrapolation.CLAMP),
      transform: [{ translateY: -10 * ce }, { scale: 1 + 0.08 * ce }],
    };
  });

  // Soft peach glow behind the mark (the same motif as onboarding / sign-in), blooming with the ring.
  const glowStyle = useAnimatedStyle(() => {
    const r = ring.get();
    return { opacity: interpolate(r, [0, 1], [0, 1], Extrapolation.CLAMP), transform: [{ scale: 0.7 + 0.3 * r }] };
  });

  const ringStyle = useAnimatedStyle(() => {
    const r = ring.get();
    return {
      opacity: interpolate(r, [0, 0.5], [0, 1], Extrapolation.CLAMP),
      transform: [{ scale: 0.82 + 0.18 * r }],
    };
  });

  const wordStyle = useAnimatedStyle(() => {
    const t = intro.get();
    const spacingNow = TRACK_FROM + (TRACK_TO - TRACK_FROM) * t;
    return {
      opacity: interpolate(t, [0, 0.45], [0, 1], Extrapolation.CLAMP),
      letterSpacing: spacingNow,
      transform: [{ translateX: spacingNow * TRAILING_COMPENSATION }, { translateY: 10 * (1 - t) }],
    };
  });

  const taglineStyle = useAnimatedStyle(() => {
    const t = tagline.get();
    return { opacity: t, transform: [{ translateY: 6 * (1 - t) }] };
  });

  return (
    <Animated.View
      style={[styles.layer, layerStyle]}
      accessible
      accessibilityRole="header"
      accessibilityLabel={`${brand.fullName}. ${brand.tagline}`}
    >
      <StatusBar style="light" />
      <Animated.View style={[styles.content, contentStyle]}>
        <View style={styles.markBox}>
          <Animated.View style={[styles.glow, glowStyle]} />
          <Animated.View style={[styles.ring, ringStyle]} />
          <LineArt name="bean" size={MARK} color={c.peach} strokeWidth={2} draw delay={60} duration={1000} />
        </View>
        <Animated.Text style={[styles.wordmark, wordStyle]} allowFontScaling={false} numberOfLines={1}>
          {brand.name}
        </Animated.Text>
        <Animated.Text style={[styles.tagline, taglineStyle]} allowFontScaling={false}>
          {brand.tagline}
        </Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  layer: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
    // R3: night (not espresso), so splash → onboarding / sign-in is one continuous dark.
    backgroundColor: c.night,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    left: (RING - GLOW) / 2,
    top: (RING - GLOW) / 2,
    width: GLOW,
    height: GLOW,
    borderRadius: GLOW / 2,
    backgroundColor: withAlpha(c.peach, 0.07),
  },
  content: { alignItems: 'center', paddingHorizontal: spacing.xxl },
  markBox: {
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  ring: {
    ...StyleSheet.absoluteFill,
    borderRadius: RING / 2,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: c.glassBorder,
    backgroundColor: withAlpha(c.peach, 0.06),
  },
  wordmark: {
    fontFamily: fonts.brand,
    fontSize: 42,
    lineHeight: 52,
    color: c.white,
    textAlign: 'center',
  },
  tagline: {
    marginTop: spacing.xs,
    fontFamily: fonts.light,
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: 0.3,
    color: c.peachSoft,
    textAlign: 'center',
  },
}));
