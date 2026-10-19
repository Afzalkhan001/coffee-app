import { router } from 'expo-router';
import { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CartTarget, RollingNumber } from '@/components/motion';
import { TAB_BAR_HEIGHT, tabBarBottom } from '@/components/navigation/TabBar';
import { Icon, PressableScale, Text } from '@/components/ui';
import { formatMoney, pluralize } from '@/lib/format';
import { cartCount, computeTotals } from '@/lib/pricing';
import { useCart } from '@/store/cart';
import { useSession } from '@/store/session';
import { fonts, makeStyles, radii, spacing, springs, useTheme } from '@/theme';
import { useValueChange } from './hooks';

const BAR_HEIGHT = 60;
const CIRCLE = BAR_HEIGHT - 12;
/** Extra bottom padding a scroll view needs (on top of the tab-bar space) while the bar is showing. */
export const FLOATING_CART_BAR_SPACE = BAR_HEIGHT + spacing.sm;

export interface FloatingCartBarProps {
  /** Distance from the screen bottom. Default: 12px above the floating tab bar (accounts for the safe area). */
  bottomOffset?: number;
  /**
   * Keep the bar tucked away even with items (it sinks out / springs back like an empty cart).
   * Home holds it until the first screen has scrolled by, so the header cart badge carries the
   * count and the bottom isn't two ink slabs.
   */
  suppressed?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Ink "View cart · 3 items  ₹720 →" pill floating above the tab bar (DESIGN.md §0); like the
 * primary bar it inverts in dark (cream pill, espresso circle).
 * Springs up when the cart gains its first item, sinks away when it empties,
 * and gives a small pulse each time the count grows. While visible, its arrow circle is a
 * low-priority fly-to-cart target: thumbnails land here when the header cart icon has
 * scrolled off screen (the header `CartButton` still wins whenever it is visible).
 */
export function FloatingCartBar({ bottomOffset, suppressed = false, style }: FloatingCartBarProps) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { colors: c, shadows } = useTheme();
  const styles = useStyles();
  const items = useCart((s) => s.items);
  const mode = useSession((s) => s.mode);
  const count = cartCount(items);
  const { subtotal } = computeTotals({ items, mode });
  const visible = count > 0 && !suppressed;

  const shown = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    shown.set(reduced ? withTiming(visible ? 1 : 0, { duration: 160 }) : withSpring(visible ? 1 : 0, springs.smooth));
  }, [visible, reduced, shown]);

  useValueChange(count, (next, prev) => {
    if (prev > 0 && next > prev) pulse.set(withSequence(withSpring(1.04, springs.snappy), withSpring(1, springs.snappy)));
  });

  const barStyle = useAnimatedStyle(() => {
    const s = shown.get();
    return {
      opacity: interpolate(s, [0, 0.4, 1], [0, 1, 1]),
      transform: [{ translateY: interpolate(s, [0, 1], [BAR_HEIGHT + 40, 0]) }, { scale: pulse.get() }],
    };
  });

  // Sit a constant 12px above the floating tab bar, which itself rests at max(safe area, 16).
  const bottom = bottomOffset ?? tabBarBottom(insets.bottom) + TAB_BAR_HEIGHT + spacing.sm;
  const itemsLabel = pluralize(count, 'item');

  return (
    // The Animated.View only animates opacity/transform; pointerEvents lives on the plain bar-sized View
    // inside and toggles between 'none' and 'auto'. On web, 'box-none' as an inline style is invalid
    // CSS: flipping none → box-none left the stale inline `pointer-events: none`, so the bar was
    // untappable after the first add (taps fell through to the content below).
    <Animated.View style={[styles.wrap, { bottom }, barStyle, style]}>
      <View
        style={{ pointerEvents: visible ? 'auto' : 'none' }}
        aria-hidden={!visible}
        accessibilityElementsHidden={!visible}
        importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      >
        <PressableScale
          onPress={() => router.push('/cart')}
          activeScale={0.98}
          shadow="strong"
          focusable={visible}
          tabIndex={visible ? 0 : -1}
          style={[styles.bar, shadows.float]}
          accessibilityLabel={`View cart, ${itemsLabel}, ${formatMoney(subtotal)}`}
        >
          <Icon name="bag" size={20} color={c.onInk} />
          <Text style={styles.label} color={c.onInk} numberOfLines={1}>
            {'View cart'}
            <Text style={styles.labelSoft} color={c.onInkSoft}>{`  ·  ${itemsLabel}`}</Text>
          </Text>
          <RollingNumber value={subtotal} money fontSize={17} fontFamily={fonts.bold} color={c.onInk} />
          {visible ? (
            <CartTarget priority={-1} popScale={1.2}>
              <View style={styles.circle}>
                <Icon name="arrow-forward" size={22} color={c.ink} />
              </View>
            </CartTarget>
          ) : (
            <View style={styles.circle}>
              <Icon name="arrow-forward" size={22} color={c.ink} />
            </View>
          )}
        </PressableScale>
      </View>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { position: 'absolute', left: spacing.gutter, right: spacing.gutter },
  bar: {
    height: BAR_HEIGHT,
    borderRadius: radii.pill,
    backgroundColor: c.ink,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.lg,
    paddingRight: 6,
  },
  label: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20 },
  labelSoft: { fontFamily: fonts.regular, fontSize: 14 },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    backgroundColor: c.onInk,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
}));
