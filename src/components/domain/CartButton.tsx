import { router } from 'expo-router';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { CartTarget, usePop } from '@/components/motion';
import { CircleButton, Text, type CircleTone } from '@/components/ui';
import { useCartCount } from '@/store/cart';
import { fonts, makeStyles, springs, useColors } from '@/theme';
import { useValueChange } from './hooks';

// Spring on native; web ignores springify(), so it gets an overshooting bezier instead of linear.
const badgeIn = ZoomIn.springify()
  .damping(springs.bouncy.damping)
  .stiffness(springs.bouncy.stiffness)
  .mass(1)
  .easing(Easing.bezier(0.34, 1.56, 0.64, 1));
const badgeOut = ZoomOut.duration(160);

export interface CartButtonProps {
  tone?: CircleTone;
  size?: number;
  /** Override navigation (default: push /cart). */
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * R3 header cart: a 44px white circle (flat, 20px bag glyph) with a deep-sage count badge. Registered as the fly-to-cart target: the whole
 * button gives a soft bump when a thumbnail lands, and the badge pops (1 → 1.35 → 1) as the
 * count grows (the first item zooms the badge in instead).
 */
export function CartButton({ tone = 'white', size = 44, onPress, style }: CartButtonProps) {
  const count = useCartCount();
  const c = useColors();
  const styles = useStyles();
  const { style: popStyle, pop } = usePop(1.35);

  useValueChange(count, (next, prev) => {
    if (prev > 0 && next > prev) pop();
  });

  const label = count > 0 ? `Cart, ${count} ${count === 1 ? 'item' : 'items'}` : 'Cart, empty';

  return (
    <CartTarget style={style} popScale={1.12}>
      <View>
        <CircleButton
          icon="bag"
          tone={tone}
          size={size}
          iconSize={size <= 44 ? 20 : Math.round(size * 0.44)}
          onPress={onPress ?? (() => router.push('/cart'))}
          accessibilityLabel={label}
        />
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
  badgeWrap: { position: 'absolute', top: -2, right: -2, pointerEvents: 'none' },
  badge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    // sageDeep: white digits on plain sage are ~2.4:1; on sageDeep they clear 4:1 (the bg ring stays).
    backgroundColor: c.sageDeep,
    borderWidth: 2,
    borderColor: c.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 13 },
}));
