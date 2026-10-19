/**
 * Frosted 44px header circles over the product hero (R3.B: white 55% + blur; Android fill).
 *
 * Private wrappers around the shared `CircleButton tone="frost"`: on web its BlurView is absolutely
 * positioned, and CSS paints positioned boxes above a non-positioned sibling regardless of DOM
 * order, so the glyph rendered after it ended up UNDER the backdrop-filter (a blurred icon). The
 * glyph here sits in its own (relatively positioned) View, so it paints above the blur everywhere.
 * `FrostCartButton` mirrors the shared `CartButton` (fly-to-cart target, sage count badge that pops
 * as the count grows) on that frosted circle.
 */
import { router } from 'expo-router';
import { View } from 'react-native';
import Animated, { Easing, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { useValueChange } from '@/components/domain';
import { CartTarget, usePop } from '@/components/motion';
import { CircleButton, Icon, Text } from '@/components/ui';
import { useCartCount } from '@/store/cart';
import { fonts, layout, makeStyles, springs, useColors } from '@/theme';

const SIZE = layout.headerButton;

const badgeIn = ZoomIn.springify()
  .damping(springs.bouncy.damping)
  .stiffness(springs.bouncy.stiffness)
  .mass(1)
  .easing(Easing.bezier(0.34, 1.56, 0.64, 1));
const badgeOut = ZoomOut.duration(160);

export function FrostCircle({ icon, onPress, accessibilityLabel }: { icon: string; onPress: () => void; accessibilityLabel: string }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <CircleButton tone="frost" size={SIZE} onPress={onPress} accessibilityLabel={accessibilityLabel}>
      <View style={styles.glyph}>
        <Icon name={icon} size={20} color={c.ink} />
      </View>
    </CircleButton>
  );
}

export function FrostCartButton() {
  const c = useColors();
  const styles = useStyles();
  const count = useCartCount();
  const { style: popStyle, pop } = usePop(1.35);
  useValueChange(count, (next, prev) => {
    if (prev > 0 && next > prev) pop();
  });
  const label = count > 0 ? `Cart, ${count} ${count === 1 ? 'item' : 'items'}` : 'Cart, empty';

  return (
    <CartTarget popScale={1.12}>
      <View>
        <FrostCircle icon="bag" onPress={() => router.push('/cart')} accessibilityLabel={label} />
        {count > 0 ? (
          <Animated.View entering={badgeIn} exiting={badgeOut} style={styles.badgeWrap}>
            <Animated.View style={[styles.badge, popStyle]}>
              <Text style={styles.badgeText} color={c.white}>
                {count > 99 ? '99+' : String(count)}
              </Text>
            </Animated.View>
          </Animated.View>
        ) : null}
      </View>
    </CartTarget>
  );
}

const useStyles = makeStyles((c) => ({
  glyph: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  badgeWrap: { position: 'absolute', top: -2, right: -2, pointerEvents: 'none' },
  badge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: c.sageDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 13 },
}));
