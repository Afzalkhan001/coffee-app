import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { easeInOutCubic, withAlpha } from '@/components/motion';
import { Icon, Text } from '@/components/ui';
import { fonts, makeStyles, makeThemed, radii, spacing, springs, useColors } from '@/theme';

/**
 * Visa: espresso → roast. RuPay: night → espresso. A new (simulated) card: roast → peach-soft roast.
 * The faces are accent fills, identical in both schemes; only the drop shadow and (dark) an edge change.
 */
const useCardTones = makeThemed((c) => ({
  gradients: {
    visa: [c.espresso, c.roast],
    rupay: [c.night, c.espresso],
    new: [c.roast, withAlpha(c.roast, 0.78)],
  } as const,
  shine: [withAlpha(c.white, 0), withAlpha(c.white, 0.22), withAlpha(c.white, 0)] as const,
}));
const SHINE_STOPS = [0.2, 0.5, 0.8] as const;
const CHIP_W = 40;
const CHIP_H = 30;

export type CardBrand = 'visa' | 'rupay' | 'new';

export interface PaymentCardVisualProps {
  /** Saved Visa •••• 4242, saved RuPay •••• 6011, or a simulated new card (no details). */
  brand?: CardBrand;
  holder: string;
  last4?: string;
  /** Dim + desaturate after a decline. */
  declined?: boolean;
  style?: StyleProp<ViewStyle>;
}

const EXPIRY: Record<CardBrand, string> = { visa: '08/29', rupay: '11/28', new: 'MM/YY' };

/**
 * The selected card as a physical-feeling card (R3: no line art on the face): Visa or RuPay with
 * the network word, or a blank "new card" for the simulated add-a-card path.
 * It rises in with a slight tilt, then a soft highlight sweeps across once (skipped under Reduce Motion).
 */
export function PaymentCardVisual({ brand = 'visa', holder, last4 = '4242', declined = false, style }: PaymentCardVisualProps) {
  const c = useColors();
  const styles = useStyles();
  const tones = useCardTones();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const enter = useSharedValue(reduced ? 1 : 0);
  const shine = useSharedValue(0);
  const dim = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    enter.set(withSpring(1, springs.gentle));
    shine.set(withDelay(520, withTiming(1, { duration: 1150, easing: easeInOutCubic })));
  }, [reduced, enter, shine]);

  useEffect(() => {
    dim.set(withTiming(declined ? 1 : 0, { duration: 260 }));
  }, [declined, dim]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: interpolate(enter.get(), [0, 0.5, 1], [0, 1, 1]) * (1 - 0.35 * dim.get()),
    transform: [
      { perspective: 900 },
      { translateY: (1 - enter.get()) * 28 },
      { rotateX: `${(1 - enter.get()) * 18}deg` },
      { rotateZ: `${(1 - enter.get()) * -3}deg` },
    ],
  }));
  const shineStyle = useAnimatedStyle(() => ({
    opacity: shine.get() > 0 && shine.get() < 1 ? 1 : 0,
    transform: [{ translateX: interpolate(shine.get(), [0, 1], [-width, width]) }, { rotate: '18deg' }],
  }));

  return (
    <Animated.View style={[styles.shell, cardStyle, style]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={styles.clip}>
      <View style={styles.card}>
        <LinearGradient colors={tones.gradients[brand]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={styles.row}>
          {/* EMV chip: six contact pads drawn by two horizontal lines and one vertical. */}
          <View style={styles.chip}>
            <View style={[styles.chipLineH, { top: CHIP_H / 3 }]} />
            <View style={[styles.chipLineH, { top: (CHIP_H * 2) / 3 }]} />
            <View style={styles.chipLineV} />
          </View>
          <View style={styles.contactless}>
            <Icon name="contactless" size={20} color={withAlpha(c.white, 0.75)} />
          </View>
        </View>
        {brand === 'new' ? (
          <Text style={styles.number} color={withAlpha(c.white, 0.7)} accessibilityLabel="New card, demo, no details needed">
            {'••••  ••••  ••••  ••••'}
          </Text>
        ) : (
          <Text style={styles.number} color={c.white} accessibilityLabel={`Card ending ${last4}`}>
            {`••••  ••••  ••••  ${last4}`}
          </Text>
        )}
        <View style={[styles.row, styles.bottom]}>
          <View style={styles.flex}>
            <Text style={styles.holder} color={c.white} numberOfLines={1} accessibilityLabel={`Card holder ${holder}`}>
              {holder.toUpperCase() || 'EMBER GUEST'}
            </Text>
          </View>
          <View style={styles.expiry}>
            <Text style={styles.holder} color={withAlpha(c.white, 0.75)} accessibilityLabel={brand === 'new' ? 'No expiry, demo card' : `Expires ${EXPIRY[brand]}`}>
              {EXPIRY[brand]}
            </Text>
          </View>
          {brand === 'new' ? (
            <Text style={styles.demo} color={withAlpha(c.white, 0.8)}>
              DEMO
            </Text>
          ) : (
            <Text style={brand === 'rupay' ? styles.rupay : styles.visa} color={c.white}>
              {brand === 'rupay' ? 'RuPay' : 'VISA'}
            </Text>
          )}
        </View>
      </View>
      {!reduced && width > 0 ? (
        <Animated.View style={[styles.shine, { width: width * 0.5 }, shineStyle]}>
          <LinearGradient colors={tones.shine} locations={SHINE_STOPS} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : null}
      {/* Dark: a faint rim, so a night / espresso face doesn't melt into the espresso canvas. */}
      <View style={styles.edge} />
      </View>
    </Animated.View>
  );
}

const useStyles = makeStyles((c, t) => ({
  shell: {
    borderRadius: radii.lg,
    // Dark: a black pool (an espresso shadow on the espresso canvas reads as a glow).
    boxShadow: `0px 18px 36px ${t.isDark ? withAlpha(c.black, 0.55) : withAlpha(c.espresso, 0.28)}`,
  },
  edge: t.isDark
    ? { ...StyleSheet.absoluteFill, borderRadius: radii.lg, borderWidth: 1, borderColor: withAlpha(c.white, 0.1), pointerEvents: 'none' }
    : { display: 'none' },
  clip: { borderRadius: radii.lg, overflow: 'hidden' },
  card: {
    aspectRatio: 1.586,
    borderRadius: radii.lg,
    padding: spacing.lg,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: { width: CHIP_W, height: CHIP_H, borderRadius: 6, backgroundColor: withAlpha(c.peach, 0.85), overflow: 'hidden' },
  // The chip's contact lines (espresso 30% in light; the deeper espresso in dark, the same look on the peach chip).
  chipLineH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: t.isDark ? withAlpha(c.espressoDeep, 0.34) : withAlpha(c.espresso, 0.3) },
  chipLineV: { position: 'absolute', top: 0, bottom: 0, left: CHIP_W / 2 - 0.5, width: 1, backgroundColor: t.isDark ? withAlpha(c.espressoDeep, 0.34) : withAlpha(c.espresso, 0.3) },
  contactless: {},
  number: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26, letterSpacing: 1.5 },
  bottom: { alignItems: 'flex-end', gap: spacing.md },
  flex: { flex: 1, minWidth: 0 },
  expiry: { alignItems: 'flex-start' },
  holder: { fontFamily: fonts.semibold, fontSize: 13.5, lineHeight: 18, letterSpacing: 0.6 },
  visa: { fontFamily: fonts.extrabold, fontSize: 24, lineHeight: 28, letterSpacing: 1, fontStyle: 'italic' },
  rupay: { fontFamily: fonts.extrabold, fontSize: 21, lineHeight: 28, letterSpacing: 0.2, fontStyle: 'italic' },
  demo: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 28, letterSpacing: 1.6 },
  shine: { position: 'absolute', top: '-30%', bottom: '-30%', left: '25%', pointerEvents: 'none' },
}));
