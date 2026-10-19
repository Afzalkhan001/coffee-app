import { useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, useWindowDimensions, View, type ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { PressableScale, Text } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { fonts, makeStyles, makeThemed, radii, spacing, useColors } from '@/theme';
import type { Promotion } from '@/types/models';
import { ProductArt } from './productArt';

const GAP = spacing.sm;
/** R3 banner: 178h, r30. */
export const PROMO_CARD_HEIGHT = 178;
/** Room above the banners for the cut-out that bleeds 40px above them (the ScrollView would clip it). */
export const PROMO_BLEED = 40;
/** Dots sit 12px below the banner. */
const DOTS_GAP = 12;
const ART = 200;
const MAX_CARD_WIDTH = 520;
/** Auto-advance cadence, and how long a manual swipe/touch holds it off. */
const AUTO_ADVANCE_MS = 5000;

/** Banner fills: accents, the same in both schemes (white copy, a white code chip, an ink pill). */
const useThemeBg = makeThemed(
  (c): Record<Promotion['theme'], string> => ({
    ember: c.ember,
    espresso: c.espresso,
    // Deep sage keeps white copy legible (plain sage is too light for white text).
    sage: c.sageDeep,
  }),
);

/** Web has no snapToInterval: use CSS scroll-snap instead (RNW passes these styles through). */
const webSnapContainer = (Platform.OS === 'web' ? { scrollSnapType: 'x mandatory' } : {}) as ViewStyle;
const webSnapItem = (Platform.OS === 'web' ? { scrollSnapAlign: 'center' } : {}) as ViewStyle;

export interface PromoCarouselProps {
  promotions: Promotion[];
  onPress: (promotion: Promotion) => void;
}

/** Native scroll-to on the UI runtime (scrollTo is a no-op from JS on native). */
function scrollToCard(ref: ReturnType<typeof useAnimatedRef<Animated.ScrollView>>, x: number) {
  'worklet';
  scrollTo(ref, x, 0, true);
}

/**
 * R3 promo banners (ref 2 poster + ref 3 banner): 178h r30 cards (ember first, then espresso and
 * deep sage) with a white code chip, a 26/30 two-line headline, an ink "Order now" pill and a 200px
 * product cut-out that bleeds 40px above the banner and 6px past its right edge (the ScrollView
 * carries 40px of top padding so it isn't clipped). The centred slide's cut-out floats. Neighbours
 * scale to 0.94 and fade to 0.7; the dots follow scroll progress. Auto-advances every 5s (paused
 * while touched, unfocused, or under Reduce Motion).
 */
export function PromoCarousel({ promotions, onPress }: PromoCarouselProps) {
  const { width: screenWidth } = useWindowDimensions();
  const reduced = useReducedMotion();
  const focused = useIsFocused();
  const styles = useStyles();
  const cardWidth = Math.min(MAX_CARD_WIDTH, screenWidth - spacing.gutter * 2);
  const interval = cardWidth + GAP;
  const scrollX = useSharedValue(0);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const lastTouch = useRef(0);
  /** A finger swipe (and its snap) is under way: only then does a page change tick. */
  const swiping = useRef(false);
  const [active, setActive] = useState(0);
  const count = promotions.length;

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.set(e.contentOffset.x);
    },
  });

  /** The centred slide changed: a swiped page snaps in with a tick (auto-advance stays silent). */
  const centre = (next: number) => {
    setActive(next);
    if (swiping.current) haptic.tick();
  };

  // Which slide is centred (drives the cut-out float) — only crosses to JS when it changes.
  useAnimatedReaction(
    () => Math.round(scrollX.get() / interval),
    (next, prev) => {
      if (next === prev) return;
      // The first read (prev null) only records the slide.
      if (prev === null) scheduleOnRN(setActive, next);
      else scheduleOnRN(centre, next);
    },
  );

  const holdAutoAdvance = () => {
    lastTouch.current = Date.now();
  };
  const beginSwipe = () => {
    holdAutoAdvance();
    swiping.current = true;
  };
  const endSwipe = () => {
    holdAutoAdvance();
    swiping.current = false;
  };

  useEffect(() => {
    if (reduced || !focused || count < 2) return;
    const timer = setInterval(() => {
      if (Date.now() - lastTouch.current < AUTO_ADVANCE_MS) return;
      const current = Math.round(scrollX.get() / interval);
      const next = current + 1 >= count ? 0 : current + 1;
      swiping.current = false;
      scheduleOnUI(scrollToCard, scrollRef, next * interval);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [reduced, focused, count, interval, scrollX, scrollRef]);

  if (count === 0) return null;

  return (
    <View>
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        onScroll={onScroll}
        onTouchStart={holdAutoAdvance}
        onScrollBeginDrag={beginSwipe}
        onMomentumScrollEnd={endSwipe}
        showsHorizontalScrollIndicator={false}
        snapToInterval={interval}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={styles.content}
        style={webSnapContainer}
      >
        {promotions.map((promo, i) => (
          <PromoCard
            key={promo.id}
            promo={promo}
            index={i}
            width={cardWidth}
            interval={interval}
            scrollX={scrollX}
            active={focused && i === active}
            onPress={onPress}
          />
        ))}
      </Animated.ScrollView>
      {promotions.length > 1 ? (
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {promotions.map((p, i) => (
            <Dot key={p.id} index={i} interval={interval} scrollX={scrollX} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function PromoCard({
  promo,
  index,
  width,
  interval,
  scrollX,
  active,
  onPress,
}: {
  promo: Promotion;
  index: number;
  width: number;
  interval: number;
  scrollX: SharedValue<number>;
  active: boolean;
  onPress: (promotion: Promotion) => void;
}) {
  const reduced = useReducedMotion();
  const c = useColors();
  const styles = useStyles();
  const title = promo.title.replace(/\n/g, ' ');
  const bg = useThemeBg()[promo.theme];

  const falloff = useAnimatedStyle(() => {
    const range = [(index - 1) * interval, index * interval, (index + 1) * interval];
    const x = scrollX.get();
    return {
      opacity: interpolate(x, range, [0.7, 1, 0.7], Extrapolation.CLAMP),
      transform: [{ scale: reduced ? 1 : interpolate(x, range, [0.94, 1, 0.94], Extrapolation.CLAMP) }],
    };
  });

  /** The cut-out drifts a little against the scroll for depth (off under Reduce Motion). */
  const parallax = useAnimatedStyle(() => {
    if (reduced) return {};
    const range = [(index - 1) * interval, index * interval, (index + 1) * interval];
    return { transform: [{ translateX: interpolate(scrollX.get(), range, [-28, 0, 28], Extrapolation.CLAMP) }] };
  });

  return (
    <Animated.View style={[styles.shell, { width }, webSnapItem, falloff]}>
      <PressableScale
        onPress={() => onPress(promo)}
        activeScale={0.98}
        style={[styles.card, { backgroundColor: bg }]}
        accessibilityLabel={`${title}. ${promo.subtitle}${promo.code ? `. Use code ${promo.code}` : ''}`}
        accessibilityHint={promo.cta}
      >
        {promo.code ? (
          <View style={styles.code}>
            <Text style={styles.codeText} color={c.ember}>
              {promo.code}
            </Text>
          </View>
        ) : null}
        <Text
          style={[styles.title, { width: Math.round(width * 0.52), top: promo.code ? 60 : 40 }]}
          color={c.white}
          numberOfLines={2}
        >
          {promo.title}
        </Text>
        {/* Visual-only CTA: the whole card is the button (a nested pressable would be a <button> in a <button> on web). */}
        <View style={styles.cta}>
          <Text style={styles.ctaText} color={c.white}>
            {promo.cta}
          </Text>
        </View>
      </PressableScale>
      {/* After the card so it paints over it; touch-transparent so the banner stays the button. */}
      <Animated.View style={[styles.art, parallax]}>
        <ProductArt image={promo.image} size={ART} shadow={false} float floatActive={active} priority="high" eager />
      </Animated.View>
    </Animated.View>
  );
}

function Dot({ index, interval, scrollX }: { index: number; interval: number; scrollX: SharedValue<number> }) {
  const c = useColors();
  const styles = useStyles();
  // Captured by the worklet: a scheme change re-creates it with the new pair.
  const idle = c.line;
  const current = c.ink;
  const style = useAnimatedStyle(() => {
    const p = scrollX.get() / interval;
    const range = [index - 1, index, index + 1];
    return {
      width: interpolate(p, range, [6, 22, 6], Extrapolation.CLAMP),
      backgroundColor: interpolateColor(p, range, [idle, current, idle]),
    };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

const useStyles = makeStyles((c) => ({
  content: { paddingHorizontal: spacing.gutter, paddingTop: PROMO_BLEED },
  shell: { marginRight: GAP, height: PROMO_CARD_HEIGHT },
  card: {
    height: PROMO_CARD_HEIGHT,
    borderRadius: radii.banner,
    overflow: 'hidden',
  },
  code: {
    position: 'absolute',
    left: 22,
    top: 22,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: c.white,
    justifyContent: 'center',
  },
  codeText: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 15, letterSpacing: 0.6 },
  title: { position: 'absolute', left: 22, fontFamily: fonts.bold, fontSize: 26, lineHeight: 30 },
  cta: {
    pointerEvents: 'none',
    position: 'absolute',
    left: 22,
    bottom: 14,
    height: 38,
    paddingHorizontal: 18,
    borderRadius: radii.pill,
    // The banner's ink pill stays ink in dark (it sits on an accent fill, not the canvas).
    backgroundColor: c.inkFixed,
    justifyContent: 'center',
  },
  ctaText: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18 },
  art: { pointerEvents: 'none', position: 'absolute', right: -6, top: -PROMO_BLEED, width: ART, height: ART },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: DOTS_GAP },
  dot: { height: 6, borderRadius: 3 },
}));
