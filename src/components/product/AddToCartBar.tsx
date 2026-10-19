/**
 * Sticky "Add to cart" bar (ref 1 primary action bar, R3): ink pill with the rolling total (22/700)
 * and a quiet "Add to cart" (15/500, white 65%) on the left and a white 52px bag circle on the right.
 *  - incomplete (a required group is unmet): the same full ink bar, reading as the next step —
 *    "Choose a size" over "2 choices left · ₹250", with a chevron-down in the white circle. A tap
 *    nudges the chevron while the screen scrolls to, shakes and flags the missing group. Once the
 *    configuration is valid it cross-fades to the live price and "Add to cart".
 *  - added: morphs to "Added to cart" with a sage check, then a "View cart" pill rises above
 *  - sold out: replaced by a muted "Sold out · back tomorrow" bar
 * All state changes animate on the UI thread; hides while the keyboard is up.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, type RefObject } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeInDown,
  FadeOutDown,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { easeOutQuint, RollingNumber, withAlpha } from '@/components/motion';
import { Icon, PressableScale, Text } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { fonts, layout, makeStyles, makeThemed, radii, spacing, springs, useColors } from '@/theme';
import { CONTENT_MAX_WIDTH } from './layout';

const IS_WEB = Platform.OS === 'web';
const CIRCLE = layout.ctaHeight - 12;
/** The bar's backdrop fades the sheet's own surface in (white in light, the dark sheet in dark). */
const useFadeTop = makeThemed((c) => [withAlpha(c.surface, 0), c.surface] as const);
const FADE_STOPS = [0, 0.42] as const;

const nudgeIn = IS_WEB
  ? FadeInDown.duration(340).easing(easeOutQuint)
  : FadeInDown.springify().damping(springs.smooth.damping).stiffness(springs.smooth.stiffness).mass(1);
const nudgeOut = FadeOutDown.duration(200);
/** The next-step label swaps with a quick fade ("Choose a size" → "Choose a temperature"). */
const stepIn = FadeIn.duration(220).easing(easeOutQuint);
/** The bar rises in once the sheet has landed. */
const barEnter = IS_WEB
  ? FadeInDown.delay(220).duration(420).easing(easeOutQuint)
  : FadeInDown.delay(220).springify().damping(springs.smooth.damping).stiffness(springs.smooth.stiffness).mass(1);

export interface AddToCartBarProps {
  mode: 'add' | 'edit';
  total: number;
  compareAtTotal?: number;
  valid: boolean;
  /** First unmet requirement as a next step ("Choose a size"); shown while invalid. */
  missing?: string;
  /** How many required groups are still unmet. */
  remaining: number;
  /** Full sentence for screen readers ("Choose a size to continue"). */
  hint?: string;
  soldOut: boolean;
  /** Briefly true after a successful add: the bar morphs to "Added to cart". */
  added: boolean;
  /** Shows the "View cart" pill above the bar. */
  nudge: boolean;
  /** Slide away (keyboard up). */
  hidden: boolean;
  bottomInset: number;
  /** The white circle; fallback fly-to-cart source when the hero is scrolled away. */
  circleRef: RefObject<View | null>;
  onPress: () => void;
  onViewCart: () => void;
  style?: StyleProp<ViewStyle>;
}

export function AddToCartBar({
  mode,
  total,
  compareAtTotal,
  valid,
  missing,
  remaining,
  hint,
  soldOut,
  added,
  nudge,
  hidden,
  bottomInset,
  circleRef,
  onPress,
  onViewCart,
  style,
}: AddToCartBarProps) {
  const c = useColors();
  const styles = useStyles();
  const fadeTop = useFadeTop();
  const ready = useSharedValue(valid ? 1 : 0);
  const morph = useSharedValue(0);
  const away = useSharedValue(0);
  const poke = useSharedValue(0);

  useEffect(() => {
    ready.set(withTiming(valid ? 1 : 0, { duration: 260, easing: easeOutQuint }));
  }, [valid, ready]);
  useEffect(() => {
    morph.set(withSpring(added ? 1 : 0, springs.snappy));
  }, [added, morph]);
  useEffect(() => {
    away.set(withTiming(hidden ? 1 : 0, { duration: hidden ? 160 : 260, easing: easeOutQuint }));
  }, [hidden, away]);

  const handlePress = () => {
    if (!valid) {
      // The chevron points down at the group the screen is about to reveal.
      poke.set(withSequence(withTiming(5, { duration: 90, easing: easeOutQuint }), withSpring(0, springs.bouncy)));
    }
    onPress();
  };

  const wrapStyle = useAnimatedStyle(() => ({
    opacity: 1 - away.get(),
    transform: [{ translateY: away.get() * 120 }],
  }));
  const stepLayer = useAnimatedStyle(() => {
    const r = ready.get();
    return { opacity: 1 - r, transform: [{ translateY: -8 * r }] };
  });
  const priceLayer = useAnimatedStyle(() => {
    const r = ready.get();
    const m = morph.get();
    return {
      opacity: r * interpolate(m, [0, 0.6], [1, 0], Extrapolation.CLAMP),
      transform: [{ translateY: 8 * (1 - r) - 10 * m }],
    };
  });
  const addedLayer = useAnimatedStyle(() => ({
    opacity: interpolate(morph.get(), [0.3, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: 10 * (1 - morph.get()) }],
  }));
  // The circle is the bar's inner contrast disc (white in light, espresso in dark) and turns sage on add.
  const circleIdle = c.onInk;
  const circleDone = c.sage;
  const circleStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(Math.min(1, Math.max(0, morph.get())), [0, 1], [circleIdle, circleDone]),
  }));
  const chevronIcon = useAnimatedStyle(() => {
    const r = ready.get();
    return {
      opacity: 1 - r,
      transform: [{ translateY: poke.get() + 6 * r }, { scale: 1 - 0.3 * r }],
    };
  });
  const bagIcon = useAnimatedStyle(() => {
    const m = morph.get();
    const r = ready.get();
    return {
      opacity: r * (1 - Math.min(1, m * 1.5)),
      transform: [{ translateY: -6 * (1 - r) }, { scale: (0.7 + 0.3 * r) * (1 - 0.4 * m) }, { rotate: `${-30 * m}deg` }],
    };
  });
  const checkIcon = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, morph.get())),
    transform: [{ scale: 0.4 + 0.6 * morph.get() }],
  }));

  const label = mode === 'edit' ? 'Update item' : 'Add to cart';
  const step = missing ?? 'Choose your options';
  const progress = remaining > 1 ? `${remaining} choices left` : 'Last choice';

  return (
    <Animated.View style={[styles.wrap, { paddingBottom: bottomInset }, wrapStyle, style]}>
      <LinearGradient colors={fadeTop} locations={FADE_STOPS} style={styles.fade} />
      <Animated.View entering={barEnter} style={styles.inner}>
        {nudge ? (
          <Animated.View entering={nudgeIn} exiting={nudgeOut} style={styles.nudgeSlot}>
            <PressableScale
              onPress={onViewCart}
              accessibilityRole="button"
              accessibilityLabel="Added to your cart. View cart"
              style={styles.nudge}
            >
              <View style={styles.nudgeDisc}>
                <Icon name="checkmark" size={14} color={c.white} />
              </View>
              <Text style={styles.nudgeText}>Added to your cart</Text>
              <Text style={styles.nudgeAction} color={c.ink}>
                View cart
              </Text>
            </PressableScale>
          </Animated.View>
        ) : null}

        {soldOut ? (
          <View
            style={[styles.bar, styles.barSoldOut]}
            accessible
            accessibilityLabel="Sold out, back tomorrow"
            accessibilityState={{ disabled: true }}
          >
            {/* Same disabled language as PrimaryBar: the ink fill stays, no CTA shadow, dimmed copy. */}
            <Text style={styles.soldOutText} color={withAlpha(c.onInk, 0.55)}>
              Sold out · back tomorrow
            </Text>
            <View style={[styles.circle, styles.circleMuted]}>
              <Icon name="time-outline" size={22} color={withAlpha(c.onInk, 0.6)} />
            </View>
          </View>
        ) : (
          <PressableScale
            onPress={handlePress}
            // Valid: a committing CTA, `press` on press-in (`land` follows when the cut-out reaches the
            // cart). Incomplete: the screen fires `warning` with the missing group's shake.
            hapticKind={valid ? 'press' : null}
            activeScale={0.98}
            shadow="strong"
            accessibilityRole="button"
            accessibilityLabel={valid ? `${label}, ${formatMoney(total)}` : `${label}. ${hint ?? step}`}
            accessibilityHint={valid ? undefined : 'Shows the option that still needs a choice'}
            style={[styles.bar, styles.barLive]}
          >
            <View style={styles.left}>
              <Animated.View style={[styles.layer, styles.stepLayer, stepLayer]}>
                <Animated.View key={step} entering={stepIn}>
                  <Text style={styles.stepText} color={c.onInk} numberOfLines={1}>
                    {step}
                  </Text>
                </Animated.View>
                <Text style={styles.stepCaption} color={withAlpha(c.onInk, 0.62)} numberOfLines={1}>
                  {`${progress} · ${formatMoney(total)}`}
                </Text>
              </Animated.View>
              <Animated.View style={[styles.layer, styles.priceRow, priceLayer]}>
                <RollingNumber value={total} money fontSize={22} color={c.onInk} />
                {compareAtTotal != null ? (
                  <Text style={styles.compare} color={withAlpha(c.onInk, 0.5)}>
                    {formatMoney(compareAtTotal)}
                  </Text>
                ) : null}
                <Text style={styles.label} color={withAlpha(c.onInk, 0.65)} numberOfLines={1}>
                  {label}
                </Text>
              </Animated.View>
              <Animated.View style={[styles.layer, styles.addedRow, addedLayer]}>
                <Text style={styles.addedText} color={c.onInk}>
                  {mode === 'edit' ? 'Updated' : 'Added to cart'}
                </Text>
              </Animated.View>
            </View>
            <Animated.View ref={circleRef} collapsable={false} style={[styles.circle, circleStyle]}>
              <Animated.View style={[styles.circleIcon, chevronIcon]}>
                <Icon name="chevron-down" size={24} color={c.ink} />
              </Animated.View>
              <Animated.View style={[styles.circleIcon, bagIcon]}>
                <Icon name={mode === 'edit' ? 'checkmark' : 'bag'} size={22} color={c.ink} />
              </Animated.View>
              <Animated.View style={[styles.circleIcon, checkIcon]}>
                <Icon name="checkmark" size={25} color={c.white} />
              </Animated.View>
            </Animated.View>
          </PressableScale>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const useStyles = makeStyles((c, t) => ({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.gutter,
    pointerEvents: 'box-none',
  },
  fade: { ...StyleSheet.absoluteFill, pointerEvents: 'none' },
  inner: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center', pointerEvents: 'box-none' },
  nudgeSlot: { alignItems: 'center', marginBottom: spacing.sm },
  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 46,
    paddingLeft: 7,
    paddingRight: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: c.surface,
    ...t.shadows.float,
    // Dark: a surface pill over the dark sheet needs an edge (a black shadow alone doesn't lift it).
    ...(t.isDark ? { borderWidth: StyleSheet.hairlineWidth * 2, borderColor: c.line } : null),
  },
  nudgeDisc: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: c.sageDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nudgeText: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 18, color: c.ink, marginRight: spacing.xs },
  nudgeAction: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18, textDecorationLine: 'underline' },
  bar: {
    height: layout.ctaHeight,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 26,
    paddingRight: 6,
  },
  barLive: { backgroundColor: c.ink, ...t.shadows.cta },
  barSoldOut: { backgroundColor: c.ink },
  left: { flex: 1, height: '100%', marginRight: spacing.sm },
  layer: { ...StyleSheet.absoluteFill, pointerEvents: 'none' },
  stepLayer: { justifyContent: 'center', gap: 1 },
  stepText: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 22 },
  stepCaption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  compare: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
    textDecorationLine: 'line-through',
    alignSelf: 'center',
  },
  label: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 15, lineHeight: 20 },
  addedRow: { flexDirection: 'row', alignItems: 'center' },
  addedText: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 22 },
  soldOutText: { flex: 1, fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22 },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleMuted: { backgroundColor: withAlpha(c.onInk, 0.14) },
  circleIcon: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
}));
