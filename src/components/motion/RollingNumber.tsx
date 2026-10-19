import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LayoutAnimationConfig,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';
import { fonts, springs, useColors } from '@/theme';
import { brand } from '@/theme/brand';
import { easeOutQuint, layoutSpring } from './hooks';
import { formatRollingNumber, planRoll, type DigitGrouping } from './math';

export interface RollingNumberProps {
  value: number;
  /**
   * A money amount: the prefix and decimals come from `brand.currency` ("₹1,250", whole rupees).
   * Use this for every price/total instead of passing the symbol by hand.
   */
  money?: boolean;
  /** e.g. "+" — slides with the number when the digit count changes. `money` sets it to "₹". */
  prefix?: string;
  suffix?: string;
  /** Fixed decimals (2 → "5.40"). Default: `brand.currency.decimals` (0 for INR) for money, else 0. */
  decimals?: number;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  /** Digit cell height. Default round(fontSize × 1.2). */
  lineHeight?: number;
  /** Digit grouping in the market's style (en-IN: "2,300", "1,25,000"). Default true. */
  grouping?: boolean;
  /** Roll every digit up from 0 on mount (confirmation count-up). Default false. */
  animateOnMount?: boolean;
  /** Extra ms per column, right-most first (odometer cascade). Default 18. */
  stagger?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Strip cells: [9, 0…9, 0…9, 0]. Positions live in "digit space" s ∈ [-1, 21); cell = s + 1.
 * Two copies + one pad cell at each end let every roll go the odometer way (forward when the
 * number grows, backward when it shrinks) with spring overshoot never showing an empty cell.
 */
const STRIP = ['9', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
/** The whole strip as ONE text node (one line per cell; lineHeight = cell height). */
const STRIP_TEXT = STRIP.join(String.fromCharCode(10));
/** A column mounting this long after its number first rendered is a new digit (9.99 → 10.00): roll it in. */
const LATE_MOUNT_MS = 60;

const charLayout = layoutSpring;
const charEnter = FadeIn.duration(180).easing(easeOutQuint);
const charExit = FadeOut.duration(140);

const isDigit = (ch: string) => ch >= '0' && ch <= '9';

/** en-IN groups lakhs/crores ("1,25,000"); every other locale groups thousands. */
const GROUPING: DigitGrouping = brand.currency.locale === 'en-IN' ? 'indian' : 'western';

/**
 * Outfit has no "₹" (U+20B9), so the platform would substitute a regular-weight system glyph beside
 * bold digits. Draw the currency symbol in the system face at the digits' weight instead (system
 * fonts carry ₹ on iOS, Android and web). Plain `fontWeight` is fine here: it is never combined
 * with an Outfit family.
 */
const SYSTEM_FAMILY = Platform.select({ android: 'sans-serif', default: 'System' });
const WEIGHT_BY_FAMILY: Record<string, TextStyle['fontWeight']> = {
  [fonts.light]: '300',
  [fonts.regular]: '400',
  [fonts.medium]: '500',
  [fonts.semibold]: '600',
  [fonts.bold]: '700',
  [fonts.extrabold]: '800',
};
function symbolStyle(fontFamily: string): TextStyle | null {
  const weight = WEIGHT_BY_FAMILY[fontFamily];
  return weight ? { fontFamily: SYSTEM_FAMILY, fontWeight: weight } : null;
}

/** Spring the column to `digit`, rolling forward (dir ≥ 0) or backward (dir < 0). UI thread. */
function rollColumn(pos: SharedValue<number>, digit: number, dir: number, delay: number) {
  'worklet';
  const { from, to } = planRoll(pos.get(), digit, dir);
  if (Math.abs(to - from) < 0.001) {
    pos.set(digit);
    return;
  }
  pos.set(from); // same pixels (the copies are identical), now in a range with room to roll
  pos.set(
    withDelay(
      delay,
      withSpring(to, springs.smooth, (finished) => {
        if (finished) pos.set(digit);
      }),
    ),
  );
}

interface DigitColumnProps {
  digit: number;
  value: number;
  /** Roll up from 0 on mount regardless of timing (count-up). */
  animateOnMount: boolean;
  /** When the parent RollingNumber first rendered (epoch ms). */
  bornAt: number;
  delay: number;
  cellStyle: StyleProp<TextStyle>;
  height: number;
}

function DigitColumn({ digit, value, animateOnMount, bornAt, delay, cellStyle, height }: DigitColumnProps) {
  // Decided once at mount, without a parent re-render: columns created with the number stay put,
  // columns added later (a new leading digit) roll in from 0.
  const [rollIn] = useState(() => animateOnMount || Date.now() - bornAt > LATE_MOUNT_MS);
  const pos = useSharedValue(rollIn ? 0 : digit);
  const lastValue = useRef(value);
  const lastDigit = useRef<number | null>(null);

  useEffect(() => {
    const dir = Math.sign(value - lastValue.current);
    lastValue.current = value;
    // Same digit (another column changed): leave any in-flight roll alone.
    if (lastDigit.current === digit) return;
    lastDigit.current = digit;
    scheduleOnUI(rollColumn, pos, digit, dir, delay);
  }, [digit, value, delay, pos]);

  const stripStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -(pos.get() + 1) * height }] }));

  return (
    <View style={{ height, overflow: 'hidden' }}>
      <Animated.View style={stripStyle}>
        <Text style={[cellStyle, { height: height * STRIP.length }]} allowFontScaling={false}>
          {STRIP_TEXT}
        </Text>
      </Animated.View>
    </View>
  );
}

/** Odometer number: each digit is a vertical column that springs to its new value. */
export function RollingNumber({
  value,
  money = false,
  prefix: prefixProp,
  suffix,
  decimals,
  fontSize = 16,
  fontFamily = fonts.bold,
  color: colorProp,
  lineHeight,
  grouping = true,
  animateOnMount = false,
  stagger = 18,
  style,
}: RollingNumberProps) {
  const c = useColors();
  const color = colorProp ?? c.ink;
  const safe = Number.isFinite(value) ? value : 0;
  const prefix = prefixProp ?? (money ? brand.currency.symbol : undefined);
  const isCurrency = money || prefix === brand.currency.symbol;
  const places = decimals ?? (isCurrency ? brand.currency.decimals : 0);
  const text = formatRollingNumber(safe, places, grouping ? GROUPING : false);
  const height = lineHeight ?? Math.round(fontSize * 1.2);
  const cellStyle: StyleProp<TextStyle> = [styles.cell, { fontFamily, fontSize, color, height, lineHeight: height }];
  const prefixStyle: StyleProp<TextStyle> = prefix === brand.currency.symbol ? [cellStyle, symbolStyle(fontFamily), styles.symbol] : cellStyle;
  const chars = text.split('');
  const label = `${prefix ?? ''}${text}${suffix ?? ''}`;

  // Columns mounted after the first render (e.g. ₹999 → ₹1,000) roll in from 0 (see DigitColumn).
  const [bornAt] = useState(() => Date.now());

  // Keyed from the RIGHT so "999" → "1,000" keeps the existing columns mounted (they roll) and only
  // the new leading column and separator enter (the same holds for Indian lakh grouping, "99,999" →
  // "1,00,000"). `place` = digits to the right, used for the cascade delay.
  const placed = chars.map((ch, i) => ({
    ch,
    fromRight: chars.length - i,
    place: isDigit(ch) ? chars.slice(i + 1).filter(isDigit).length : -1,
  }));

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[styles.row, { height }, style]}
    >
      <LayoutAnimationConfig skipEntering>
        {prefix ? (
          <Animated.View layout={charLayout} aria-hidden>
            <Text style={prefixStyle} allowFontScaling={false}>
              {prefix}
            </Text>
          </Animated.View>
        ) : null}
        {placed.map(({ ch, fromRight, place }) => (
          <Animated.View
            key={`${fromRight}-${place === -1 ? ch : 'd'}`}
            layout={charLayout}
            entering={charEnter}
            exiting={charExit}
            aria-hidden
          >
            {place === -1 ? (
              <Text style={cellStyle} allowFontScaling={false}>
                {ch}
              </Text>
            ) : (
              <DigitColumn
                digit={Number(ch)}
                value={safe}
                animateOnMount={animateOnMount}
                bornAt={bornAt}
                delay={place * stagger}
                cellStyle={cellStyle}
                height={height}
              />
            )}
          </Animated.View>
        ))}
        {suffix ? (
          <Animated.View layout={charLayout} aria-hidden>
            <Text style={cellStyle} allowFontScaling={false}>
              {suffix}
            </Text>
          </Animated.View>
        ) : null}
      </LayoutAnimationConfig>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  cell: {
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
    fontVariant: ['tabular-nums'],
  },
  /** A hair of air between "₹" and the first digit (the system glyph sits tight). */
  symbol: { marginRight: 1 },
});
