/**
 * Onboarding (DESIGN.md §R3.B "Onboarding ×3", ref 1 dark onboarding; PRD §6–7, §24
 * "location / notifications denied").
 *
 * A 3-page swipe pager on the night canvas: Welcome → Location → Order alerts. One `progress` value
 * (0..1 across all pages, derived from the scroll offset on the UI thread) drives the sage
 * capsule's glowing dot, the big button's peach arc and the morphing page dots.
 *
 * One forward action per page, the standard pre-permission pattern: the big button goes to the next
 * page on Welcome, asks for location and moves on (page 2), and asks for notifications and finishes
 * (page 3). The top-right "Skip" (page 1) finishes; "Not now" (pages 2–3) moves on without asking.
 * A denied answer swaps the page's line for a short note and the button becomes plain "Next" /
 * "Finish".
 *
 * Finishing marks unanswered permissions as `skipped`, fades the screen out and calls
 * `completeOnboarding()`. The root `Stack.Protected` guard then lands on /auth/phone
 * (BUILD_CONTRACT routing rules: no router.replace here, it would race the guard).
 */
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Extrapolation,
  FadeInRight,
  interpolate,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { easeOutQuint, enterFade, enterUp, PageDots, popIn, withAlpha } from '@/components/motion';
import { useSplashLifted } from '@/components/onboarding/AnimatedSplash';
import { withTimeout } from '@/components/onboarding/authFormat';
import { GlossyArrowButton } from '@/components/onboarding/GlossyArrowButton';
import { DoodleField } from '@/components/onboarding/OnboardingArt';
import { ARC_BOX, BUTTON, GUTTER, LAST_PAGE, PAGE_COUNT, useOnboardingMetrics } from '@/components/onboarding/onboardingLayout';
import { AlertsPage, LocationPage, WelcomePage } from '@/components/onboarding/OnboardingPages';
import { SageCapsule } from '@/components/onboarding/SageCapsule';
import { LightStatusBar, Text } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { requestLocationPermission } from '@/lib/location';
import { canUseNotifications, requestNotificationPermission } from '@/lib/notify';
import { useSession } from '@/store/session';
import { fonts, makeStyles, useColors } from '@/theme';
import type { PermissionState } from '@/types/models';

/** Web permission prompts never settle if ignored; stop waiting after this long. */
const PROMPT_TIMEOUT = 20_000;
/** Let a granted permission's note land before moving on. */
const GRANTED_HOLD_MS = 900;
const capsuleIn = FadeInRight.delay(240).duration(720).easing(easeOutQuint);

export default function OnboardingScreen() {
  const c = useColors();
  const styles = useStyles();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const m = useOnboardingMetrics(size);
  const frame = m.frame;
  const reduced = useReducedMotion();
  const lifted = useSplashLifted();

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const leaving = useSharedValue(0);
  const [page, setPage] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [asking, setAsking] = useState<'location' | 'notifications' | null>(null);
  const finishing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFrame = useRef(frame);

  const locationPermission = useSession((s) => s.locationPermission);
  const notificationPermission = useSession((s) => s.notificationPermission);
  const prefs = useSession((s) => s.notificationPrefs);
  const setLocationPermission = useSession((s) => s.setLocationPermission);
  const setNotificationPermission = useSession((s) => s.setNotificationPermission);
  const setNotificationPrefs = useSession((s) => s.setNotificationPrefs);
  const completeOnboarding = useSession((s) => s.completeOnboarding);

  const progress = useDerivedValue(() => scrollX.get() / Math.max(frame * LAST_PAGE, 1));

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.set(e.contentOffset.x);
    },
  });

  const onPageChange = (next: number) => {
    setPage(next);
    haptic.tick();
  };
  const reveal = (next: number) => setRevealed((r) => Math.max(r, next));

  // Settled page: labels, back handling, a tick per page (swiped or sent by the arrow, which is silent itself).
  useAnimatedReaction(
    () => Math.min(LAST_PAGE, Math.max(0, Math.round(scrollX.get() / frame))),
    (current, previous) => {
      if (previous !== null && current !== previous) scheduleOnRN(onPageChange, current);
    },
  );
  // Mount a page's doodles as soon as it starts sliding in, so their draw-on plays as it arrives.
  useAnimatedReaction(
    () => Math.min(LAST_PAGE, Math.max(0, Math.ceil(scrollX.get() / frame - 0.04))),
    (current, previous) => {
      if (current > 0 && current !== previous) scheduleOnRN(reveal, current);
    },
  );

  const schedule = (fn: () => void, ms: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(fn, ms);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const goTo = (target: number, animated = !reduced) => {
    const index = Math.min(LAST_PAGE, Math.max(0, target));
    const x = index * frame;
    // The button acts on the page it was pressed for: settle the page now (the scroll reaction
    // confirms it with the tick as the pill crosses the midpoint).
    setPage(index);
    reveal(index);
    scheduleOnUI(() => {
      'worklet';
      scrollTo(scrollRef, x, 0, animated);
    });
  };

  // Keep the current page in place when the window resizes (web, rotation, split screen).
  useEffect(() => {
    if (lastFrame.current === frame) return;
    lastFrame.current = frame;
    goTo(page, false);
  }, [frame]);

  // Android back steps back through the pages before leaving the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (page === 0) return false;
      goTo(page - 1);
      return true;
    });
    return () => sub.remove();
  }, [page, frame]);

  const finish = () => {
    if (finishing.current) return;
    finishing.current = true;
    if (timer.current) clearTimeout(timer.current);
    const s = useSession.getState();
    if (s.locationPermission === 'undetermined') setLocationPermission('skipped');
    if (s.notificationPermission === 'undetermined') setNotificationPermission('skipped');
    if (reduced) {
      completeOnboarding();
      return;
    }
    // Fade the pager away, then flip the guard (Stack.Protected lands on /auth/phone).
    leaving.set(
      withTiming(1, { duration: 260, easing: easeOutQuint }, (done) => {
        if (done) scheduleOnRN(completeOnboarding);
      }),
    );
  };

  // ── Permissions ──
  const allowLocation = async () => {
    if (asking) return;
    setAsking('location');
    const result = await withTimeout<PermissionState>(requestLocationPermission(), PROMPT_TIMEOUT, 'undetermined');
    setAsking(null);
    if (result === 'undetermined') return;
    setLocationPermission(result);
    // The system prompt was the feedback: no outcome haptic (the page change ticks).
    if (result === 'granted') schedule(() => goTo(2), GRANTED_HOLD_MS);
  };

  const enableNotifications = async () => {
    if (asking) return;
    if (!prefs.orderUpdates && !prefs.marketing) {
      // Nothing to send: don't ask.
      setNotificationPermission('skipped');
      finish();
      return;
    }
    setAsking('notifications');
    const result: PermissionState = canUseNotifications
      ? await withTimeout<PermissionState>(requestNotificationPermission(), PROMPT_TIMEOUT, 'undetermined')
      : 'denied';
    setAsking(null);
    if (result === 'undetermined') return;
    setNotificationPermission(result);
    if (result === 'granted') schedule(finish, GRANTED_HOLD_MS + 200);
  };

  // ── Actions ──
  const locationOpen = locationPermission === 'undetermined';
  const alertsOpen = notificationPermission === 'undetermined';

  const primary = () => {
    if (page === 0) {
      goTo(1);
      return;
    }
    if (page === 1) {
      if (locationOpen) void allowLocation();
      else goTo(2);
      return;
    }
    if (alertsOpen) void enableNotifications();
    else finish();
  };

  const secondary = () => {
    if (page === 0) {
      finish();
      return;
    }
    if (page === 1) {
      if (locationOpen) setLocationPermission('skipped');
      goTo(2);
      return;
    }
    if (alertsOpen) setNotificationPermission('skipped');
    finish();
  };

  const primaryLabel =
    page === 0
      ? 'Next'
      : page === 1
        ? locationOpen
          ? 'Allow location and continue'
          : 'Next'
        : alertsOpen && (prefs.orderUpdates || prefs.marketing)
          ? 'Enable notifications and finish'
          : 'Finish and sign in';

  // ── Animated chrome ──
  const leaveStyle = useAnimatedStyle(() => {
    const v = leaving.get();
    return { opacity: 1 - v, transform: [{ translateY: -14 * v }] };
  });
  // "Skip" (page 1) hands over to "Not now" (pages 2–3) mid-swipe.
  const skipStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get() * LAST_PAGE, [0, 0.45], [1, 0], Extrapolation.CLAMP),
  }));
  const notNowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get() * LAST_PAGE, [0.55, 1], [0, 1], Extrapolation.CLAMP),
  }));

  const onRootLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || size.width !== width || size.height !== height) setSize({ width, height });
  };

  const { capsule, button } = m;
  const buttonCenterX = m.frameLeft + button.left + BUTTON / 2;

  return (
    <View style={styles.root} onLayout={onRootLayout}>
      <LightStatusBar />
      {/* One soft peach glow (R3: ellipse 120% × 60% at 80% 18%, 10%). */}
      <Svg width={m.width} height={m.height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="onboardingGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={c.peach} stopOpacity={0.1} />
            <Stop offset="1" stopColor={c.peach} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={m.width * 0.8} cy={m.height * 0.18} rx={m.width * 1.2} ry={m.height * 0.6} fill="url(#onboardingGlow)" />
      </Svg>

      <Animated.View style={[StyleSheet.absoluteFill, leaveStyle]}>
        {/* Croissant + portafilter: the same on every page, so they stay put while the pages slide. */}
        <View style={[styles.sharedArt, { left: m.frameLeft, width: frame, height: m.band + 40 }]}>
          {lifted ? <DoodleField set="shared" width={frame} band={m.band} safeTop={m.fieldSafeTop} delay={80} /> : null}
        </View>

        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          bounces={false}
          overScrollMode="never"
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          style={[styles.pager, { left: m.frameLeft, width: frame }]}
          // Clip the strip as a whole (not per page, so neighbouring pages' parallax art can still
          // overlap mid-swipe): on web, art shifted past the last page would otherwise widen the
          // scrollable area.
          contentContainerStyle={styles.pagerContent}
        >
          {/* An array, not a Fragment: react-native-web wraps each direct child of a pagingEnabled
              ScrollView in its own snap View, so a Fragment would stack all three pages in one. */}
          {lifted ? (
            [
              <WelcomePage key="welcome" scrollX={scrollX} m={m} />,
              <LocationPage key="location" scrollX={scrollX} m={m} revealed={revealed >= 1} permission={locationPermission} />,
              <AlertsPage
                key="alerts"
                scrollX={scrollX}
                m={m}
                revealed={revealed >= 2}
                permission={notificationPermission}
                prefs={prefs}
                onPrefsChange={setNotificationPrefs}
              />,
            ]
          ) : (
            <View style={{ width: frame * PAGE_COUNT }} />
          )}
        </Animated.ScrollView>

        {lifted ? (
          <>
            {/* The sage capsule, bleeding off the right edge; its dot travels with the pages. */}
            <Animated.View
              entering={reduced ? undefined : capsuleIn}
              style={[styles.abs, { left: m.frameLeft + capsule.left, top: capsule.top }]}
            >
              <SageCapsule
                progress={progress}
                width={capsule.width}
                height={capsule.height}
                visibleWidth={frame - capsule.left}
              />
            </Animated.View>

            {/* Top right: "Skip" on page 1, "Not now" on the permission pages. */}
            <Animated.View entering={enterFade(1)} style={[styles.topRight, { top: m.insetTop + 12, right: m.frameLeft + 22 - 11 }]}>
              <Pressable
                onPress={secondary}
                accessibilityRole="button"
                accessibilityLabel={page === 0 ? 'Skip onboarding' : 'Not now'}
                hitSlop={6}
                style={({ pressed }) => [styles.secondary, { opacity: pressed ? 0.55 : 1 }]}
              >
                <Animated.View style={[styles.secondaryLabel, skipStyle]}>
                  <Text style={styles.secondaryText} color={withAlpha(c.white, 0.6)}>
                    Skip
                  </Text>
                </Animated.View>
                <Animated.View style={[styles.secondaryLabel, notNowStyle]}>
                  <Text style={styles.secondaryText} color={withAlpha(c.white, 0.6)}>
                    Not now
                  </Text>
                </Animated.View>
              </Pressable>
            </Animated.View>

            {/* Bottom: dots on the button's centre line + the big glossy button. */}
            <Animated.View entering={enterUp(6)} style={[styles.abs, { left: m.frameLeft + GUTTER, top: button.centerY - 3 }]}>
              <PageDots count={PAGE_COUNT} progress={progress} color={withAlpha(c.white, 0.3)} />
            </Animated.View>
            <Animated.View
              entering={popIn(7)}
              style={[styles.abs, { left: buttonCenterX - ARC_BOX / 2, top: button.centerY - ARC_BOX / 2 }]}
            >
              <GlossyArrowButton progress={progress} onPress={primary} accessibilityLabel={primaryLabel} busy={asking !== null} />
            </Animated.View>
          </>
        ) : null}
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.night, overflow: 'hidden' },
  abs: { position: 'absolute' },
  sharedArt: { position: 'absolute', top: 0 },
  pager: { position: 'absolute', top: 0, bottom: 0 },
  pagerContent: { overflow: 'hidden' },
  topRight: { position: 'absolute' },
  secondary: { minHeight: 44, minWidth: 84, paddingHorizontal: 11, alignItems: 'flex-end', justifyContent: 'center' },
  secondaryLabel: { position: 'absolute', right: 11 },
  secondaryText: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20 },
}));
