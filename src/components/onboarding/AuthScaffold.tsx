/**
 * Shared layout for phone → OTP → profile (DESIGN.md §R3.B "Phone / OTP / profile").
 *
 * - Night top, 40% of the screen: the onboarding doodle composition at 0.9 (croissant and
 *   portafilter crop off the edges) drawing itself on, the same soft peach glow, an optional glass
 *   back button, and the hero slot bottom-left 56px above the sheet: the Fraunces wordmark by
 *   default. The top gives way first when the keyboard needs the room, and the hero fades out once
 *   it no longer fits.
 * - Canvas sheet (r32 on top, 24px padding): springs up from below on first arrival
 *   (`entrance="rise"`), or cross-fades under Reduce Motion. Its body scrolls when space runs out;
 *   `footer` (the primary bar) stays pinned at the bottom, above the keyboard.
 * - The first screen mounts under the launch splash, so the entrance waits for `useSplashLifted()`.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';
import { easeOutQuint, enterUp, fadeTiming } from '@/components/motion';
import { CircleButton, LightStatusBar, Text } from '@/components/ui';
import { fonts, makeStyles, radii, springs, useColors, type ColorTokens, type Theme } from '@/theme';
import { brand } from '@/theme/brand';
import { useSplashLifted } from './AnimatedSplash';
import { DoodleField } from './OnboardingArt';
import { MAX_FRAME } from './onboardingLayout';
import { useKeyboardVisible } from './useKeyboardVisible';

/** The sheet extends this far below the screen so the spring's overshoot never reveals a gap. */
const OVERDRAW = 56;

/**
 * Web: 'clip', not just 'hidden'. The phone/OTP field autofocuses while the sheet is still rising from
 * below the screen, and the browser scrolls even an overflow-hidden root to reveal it, by up to the
 * OVERDRAW, which cut the top off on short phones. 'clip' can't be scrolled.
 */
const ROOT_CLIP = (Platform.OS === 'web' ? { overflow: 'clip' } : { overflow: 'hidden' }) as ViewStyle;
/** Content column width on tablets / desktop web. */
export const AUTH_COLUMN_MAX = 480;
/** Sheet side padding (R3: 24). */
export const SHEET_PAD = 24;
/** R3: the night top takes 40% of the screen. */
const TOP_SHARE = 0.4;
/** The hero sits this far above the sheet. */
const HERO_ABOVE_SHEET = 56;
/** Room the hero needs above the sheet (its height + the gap) before it is shown. */
const HERO_MIN_SPACE = 132;
const BACK_ROW = 56;
/** On wide web windows the sheet becomes a centred card instead of a full-width panel. */
const SHEET_MAX = 640;
/** Drawn bottoms of the auth pieces in the R3.A9 frame: the croissant (92 + 168) and the latte's saucer (~90% down its 186 + 132 box). */
const CROISSANT_BOTTOM = 260;
const LATTE_BOTTOM = 305;
const ART_SCALE = 0.9;
/** Below this vertical squeeze the drawings would pile up: the top shows only the glow and the hero. */
const MIN_ART_SQUEEZE = 0.5;
const WORDMARK_LINE = 48;
const OMIT_LATTE = ['latte'] as const;

/**
 * The sheet and its fields. Light (R3): a canvas sheet holding white fields. Dark (R4): the canvas is
 * almost the night top, so the sheet lifts to `surface` and its fields sink to the canvas (the R3
 * rule for controls inside a surface sheet). Pure: use it inside `makeStyles` factories.
 */
export function authPlanes(c: ColorTokens, t: Theme): { sheet: string; field: string } {
  return t.isDark ? { sheet: c.surface, field: c.bg } : { sheet: c.bg, field: c.surface };
}

export interface AuthScaffoldProps {
  /** Content bottom-left of the night top. Defaults to the wordmark. */
  hero?: ReactNode;
  /** Shows a glass back button in the top-left corner. */
  onBack?: () => void;
  /** `rise`: the sheet springs up from below (first arrival). `none`: pushed screens. */
  entrance?: 'rise' | 'none';
  /** Sheet body; scrolls when the keyboard leaves too little room. */
  children: ReactNode;
  /** Pinned to the bottom of the sheet (primary bar + caption). */
  footer?: ReactNode;
  /** Fires once the sheet has settled; use it to focus the first field. */
  onEntered?: () => void;
}

/** "Ember Roast" in Fraunces 600 Italic 40, white (R3: no bean disc, no tagline). */
export function AuthWordmark() {
  const c = useColors();
  const styles = useStyles();
  return (
    <Text style={styles.wordmark} color={c.white} accessibilityRole="header" accessibilityLabel={brand.fullName} allowFontScaling={false}>
      {brand.name}
    </Text>
  );
}

export function AuthScaffold({ hero, onBack, entrance = 'none', children, footer, onEntered }: AuthScaffoldProps) {
  const c = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const lifted = useSplashLifted();
  const keyboardVisible = useKeyboardVisible();

  const animateRise = entrance === 'rise';
  const rise = useSharedValue(animateRise && !reduced ? 0 : 1);
  const fade = useSharedValue(animateRise && reduced ? 0 : 1);
  const travel = useSharedValue(640);
  const heroShown = useSharedValue(1);
  const [topActual, setTopActual] = useState<number | null>(null);

  const onEnteredRef = useRef(onEntered);
  useEffect(() => {
    onEnteredRef.current = onEntered;
  }, [onEntered]);

  useEffect(() => {
    if (!lifted) return;
    const done = () => onEnteredRef.current?.();
    if (!animateRise) {
      done();
      return;
    }
    if (reduced) {
      fade.set(
        withTiming(1, { duration: 220, easing: easeOutQuint, reduceMotion: ReduceMotion.Never }, (finished) => {
          if (finished) scheduleOnRN(done);
        }),
      );
      return;
    }
    rise.set(
      withSpring(1, springs.smooth, (finished) => {
        if (finished) scheduleOnRN(done);
      }),
    );
  }, [lifted, animateRise, reduced, rise, fade]);

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: fade.get(),
    transform: [{ translateY: (1 - rise.get()) * travel.get() }],
  }));

  const heroStyle = useAnimatedStyle(() => {
    const v = heroShown.get();
    return { opacity: v, transform: [{ translateY: 10 * (1 - v) }] };
  });

  const onTopLayout = (e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    if (h !== topActual) setTopActual(h);
    const space = h - insets.top - (onBack ? BACK_ROW : 0);
    heroShown.set(withTiming(space >= HERO_MIN_SPACE ? 1 : 0, fadeTiming));
  };

  const onSheetLayout = (e: LayoutChangeEvent) => {
    travel.set(e.nativeEvent.layout.height + 32);
  };

  // Doodle composition: the onboarding frame (phone width, centred on wide screens), drawings at 0.9.
  // The rows squeeze vertically so the croissant clears the hero; the latte only joins when it
  // clears it too; and when the keyboard or a tall form leaves too little room, only the glow and
  // the hero remain (never a cluster of shrunken stickers).
  const topHeight = Math.round(height * TOP_SHARE);
  const top = topActual ?? topHeight;
  const frame = Math.min(width, MAX_FRAME);
  const safeTop = Math.max(insets.top, 24);
  const oy = safeTop - 47;
  const heroTop = top - HERO_ABOVE_SHEET - WORDMARK_LINE;
  const nominal = Math.min(1, topHeight / 362) * ART_SCALE;
  const artY = Math.min(nominal, (heroTop - 14 - oy) / CROISSANT_BOTTOM);
  const showArt = artY >= MIN_ART_SQUEEZE * ART_SCALE;
  const withLatte = LATTE_BOTTOM * artY + oy <= heroTop + 4;

  const column = Math.min(width, AUTH_COLUMN_MAX);
  const columnLeft = (width - column) / 2;

  const bottomPad = keyboardVisible ? 16 : Math.max(insets.bottom, 16) + 8;

  return (
    <View style={[styles.root, ROOT_CLIP]}>
      {/* Focus-aware: Legal pushed over sign-in is cream and needs dark icons again. */}
      <LightStatusBar />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
        <View
          style={[styles.top, { flexBasis: topHeight, minHeight: insets.top + (onBack ? BACK_ROW : 0) }]}
          onLayout={onTopLayout}
        >
          <Svg width={width} height={topHeight} style={StyleSheet.absoluteFill}>
            <Defs>
              <RadialGradient id="authGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={c.peach} stopOpacity={0.12} />
                <Stop offset="1" stopColor={c.peach} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Ellipse cx={width * 0.78} cy={topHeight * 0.3} rx={width * 1.1} ry={topHeight * 0.9} fill="url(#authGlow)" />
          </Svg>
          <View style={[styles.art, { width: frame, left: (width - frame) / 2, height: topHeight }]}>
            {lifted && showArt ? (
              <DoodleField
                set="auth"
                width={frame}
                band={topHeight}
                safeTop={safeTop}
                scale={ART_SCALE}
                yScale={artY}
                omit={withLatte ? undefined : OMIT_LATTE}
                delay={animateRise ? 180 : 60}
              />
            ) : null}
          </View>
          {onBack ? (
            <View style={[styles.column, styles.backRow, { marginTop: insets.top }]}>
              <CircleButton icon="chevron-back" tone="glass" size={44} onPress={onBack} accessibilityLabel="Go back" />
            </View>
          ) : null}
          <Animated.View style={[styles.hero, { left: columnLeft, width: column }, heroStyle]}>
            {/* Mounted (not toggled) once the splash lifts, so it rises in view. */}
            {lifted ? <Animated.View entering={enterUp(0)}>{hero ?? <AuthWordmark />}</Animated.View> : null}
          </Animated.View>
        </View>

        <Animated.View
          style={[styles.sheet, { paddingBottom: bottomPad + OVERDRAW, marginBottom: -OVERDRAW }, sheetStyle]}
          onLayout={onSheetLayout}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
            alwaysBounceVertical={false}
          >
            <View style={styles.column}>{children}</View>
          </ScrollView>
          {footer ? <View style={[styles.column, styles.footer]}>{footer}</View> : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((c, t) => ({
  // Clipped (ROOT_CLIP): the sheet's OVERDRAW hangs below the screen.
  root: { flex: 1, backgroundColor: c.night },
  flex: { flex: 1 },
  // The top gives way first when the keyboard needs room (shrink weight ≫ the sheet's).
  top: { flexGrow: 0, flexShrink: 12, overflow: 'hidden' },
  art: { position: 'absolute', top: 0 },
  column: { width: '100%', maxWidth: AUTH_COLUMN_MAX, alignSelf: 'center' },
  backRow: { height: BACK_ROW, justifyContent: 'center', paddingHorizontal: 20 },
  hero: { position: 'absolute', bottom: HERO_ABOVE_SHEET, paddingHorizontal: SHEET_PAD },
  wordmark: { fontFamily: fonts.brand, fontSize: 40, lineHeight: WORDMARK_LINE, letterSpacing: 0.2 },
  sheet: {
    flexGrow: 1,
    flexShrink: 1,
    width: '100%',
    maxWidth: SHEET_MAX,
    alignSelf: 'center',
    backgroundColor: authPlanes(c, t).sheet,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
  },
  scroll: { flexGrow: 0, flexShrink: 1 },
  scrollContent: { paddingTop: 28, paddingHorizontal: SHEET_PAD, paddingBottom: 16 },
  footer: { marginTop: 'auto', paddingHorizontal: SHEET_PAD, paddingTop: 8 },
}));
