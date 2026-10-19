/**
 * The favourite heart (docs/HAPTICS.md: `toggle(on)` on favourite). Two looks:
 * - `frost`: the 44px frosted header circle on the product hero, outline ↔ filled, always shown.
 * - `tile`: a 30px white circle at a product tile's top-left (mirroring the white "+"), shown only
 *   while the product is a favourite (R3 restraint: no outline hearts across a whole grid). Tapping
 *   it un-favourites; it scales away. It takes the sticker's corner while shown (one marker a card).
 * The glyph pops (1 → 1.28 → 1) on every change, then the haptic clicks on that frame.
 * The heart is ink, like the "+" glyph (ember stays the screen's one accent): `ink` on the frost
 * circle, `onControl` on the tile's `control` circle (white + ink in light, cream + espresso in dark).
 */
import { AccessibilityInfo, Platform, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, LayoutAnimationConfig, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { usePop } from '@/components/motion';
import { CircleButton, Icon, PressableScale } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { useFavorites, useIsFavorite } from '@/store/favorites';
import { layout, makeStyles, springs, useColors } from '@/theme';

/** Tile heart circle (the "+" is 34; the heart is the quieter of the two corners). */
export const TILE_HEART = 30;

// Spring on native; web ignores springify(), so it gets an overshooting bezier instead.
const heartIn = ZoomIn.springify()
  .damping(springs.snappy.damping)
  .stiffness(springs.snappy.stiffness)
  .mass(1)
  .easing(Easing.bezier(0.34, 1.56, 0.64, 1));
const heartOut = ZoomOut.duration(160);

export interface FavoriteButtonProps {
  productId: string;
  productName: string;
  variant: 'frost' | 'tile';
  style?: StyleProp<ViewStyle>;
}

/** Toggles the favourite and plays its feedback; returns the new state. */
function useToggleFavorite(productId: string, productName: string) {
  const toggle = useFavorites((s) => s.toggle);
  const { style: popStyle, pop } = usePop(1.28);
  const onPress = () => {
    const next = toggle(productId);
    pop();
    haptic.toggle(next);
    if (Platform.OS !== 'web') {
      AccessibilityInfo.announceForAccessibility(next ? `${productName} saved to favourites` : `${productName} removed from favourites`);
    }
  };
  return { popStyle, onPress };
}

export function FavoriteButton({ productId, productName, variant, style }: FavoriteButtonProps) {
  const favorite = useIsFavorite(productId);
  const c = useColors();
  const styles = useStyles();
  const { popStyle, onPress } = useToggleFavorite(productId, productName);
  const label = favorite ? `Remove ${productName} from favourites` : `Save ${productName} to favourites`;

  if (variant === 'frost') {
    return (
      <CircleButton tone="frost" size={layout.headerButton} onPress={onPress} accessibilityLabel={label} style={style}>
        {/* Its own positioned box: on web the frost's BlurView would otherwise paint over the glyph. */}
        <Animated.View style={[styles.glyph, popStyle]}>
          <Icon name={favorite ? 'heart' : 'heart-outline'} size={20} color={c.ink} />
        </Animated.View>
      </CircleButton>
    );
  }

  return (
    // Grids mount many cards: skip the pop on first mount, animate only real changes.
    <LayoutAnimationConfig skipEntering>
      {favorite ? (
        <Animated.View entering={heartIn} exiting={heartOut} style={style}>
          <PressableScale
            onPress={onPress}
            activeScale={0.86}
            hitSlop={(44 - TILE_HEART) / 2}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={styles.tile}
          >
            <Animated.View style={popStyle}>
              <Icon name="heart" size={15} color={c.onControl} />
            </Animated.View>
          </PressableScale>
        </Animated.View>
      ) : null}
    </LayoutAnimationConfig>
  );
}

const useStyles = makeStyles((c) => ({
  glyph: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  tile: {
    width: TILE_HEART,
    height: TILE_HEART,
    borderRadius: TILE_HEART / 2,
    backgroundColor: c.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
