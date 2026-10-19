import { useRef } from 'react';
import { StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { LayoutAnimationConfig } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { enterUp, measureInWindowAsync, popIn, setHeroOrigin } from '@/components/motion';
import { PressableScale, Text } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { useIsFavorite } from '@/store/favorites';
import { radii, spacing, type as typeScale } from '@/theme';
import type { Product } from '@/types/models';
import { FavoriteButton } from './FavoriteButton';
import { staggerIndex, useFlash } from './hooks';
import { prefetchHeroPhoto } from './photo';
import { PriceText } from './PriceText';
import { BadgeSticker, SoldOutOverlay, visibleSticker } from './ProductBadges';
import { ArtTile, tintForCategory } from './productArt';
import { canQuickAdd, openProduct, useQuickAdd } from './quickAdd';
import { QuickAddButton } from './QuickAddButton';
import { dietLabel, VegMark } from './VegMark';

/** Horizontal gap between the two grid columns (R3: 14; rows are 22 apart). Pair with `productCardWidth`. */
export const PRODUCT_GRID_GAP = 14;
/** Vertical gap between grid rows (R3 Menu grid). */
export const PRODUCT_GRID_ROW_GAP = 22;
const MAX_DEFAULT_WIDTH = 230;
/** Window heights below this get the compact (slightly landscape) tile. */
export const COMPACT_SCREEN_HEIGHT = 720;
/** Art box bottom inset inside the tile (R3: box bottom = tile bottom − 6). */
const ART_BOTTOM = 6;

/** Width of one card in a 2-column grid inside the 20px screen gutter: (W − 40 − 14) / 2. */
export function productCardWidth(screenWidth: number, columns = 2, gap = PRODUCT_GRID_GAP): number {
  return Math.floor((screenWidth - spacing.gutter * 2 - gap * (columns - 1)) / columns);
}

/** Tile height for a card width: w × 1.05 (w × 0.9 on short phones, so a row clears the cart bar). */
export function productTileHeight(cardWidth: number, screenHeight: number): number {
  return Math.round(cardWidth * (screenHeight < COMPACT_SCREEN_HEIGHT ? 0.9 : 1.05));
}

/** Art box for a card: 0.81w, capped so it always leaves room for the sticker row above it. */
export function productArtSize(cardWidth: number, tileHeight: number): number {
  return Math.round(Math.min(cardWidth * 0.81, tileHeight - ART_BOTTOM - 20));
}

export interface ProductCardProps {
  product: Product;
  /** Position in the list; drives the staggered entrance. */
  index?: number;
  /** Card width; defaults to half the screen inside the gutter. */
  width?: number;
  /** Replaces the built-in quick-add (fly-to-cart or open detail) when provided. */
  onQuickAdd?: (product: Product) => void;
  /** Replaces the built-in open (hero origin + push to product detail) when provided. */
  onPress?: (product: Product) => void;
  /**
   * Staggered entrance on mount (default true). Pass false when the card sits inside a section
   * that already animates in (Home rails/grids), so it doesn't travel twice.
   */
  animateEntrance?: boolean;
  /**
   * Sale price colour (default 'ember'). 'ink' keeps the live price ink with the struck-through old
   * price, for screens whose one ember element is elsewhere (Home: the promo banner).
   */
  saleTone?: 'ember' | 'ink';
  /**
   * Show the favourite heart while the product is a favourite (default true). The Home "Your
   * favourites" rail passes false: its title already says it, a heart on every card would be noise.
   */
  showFavorite?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * R3 product card (all grids and rails): no white card and no shadow. A category-tinted rounded
 * square (w × 1.05w, r28) with the cut-out standing on its contact shadow (art box 0.81w, bottom
 * 6 above the tile bottom), at most one top-left marker (the favourite heart while favourited,
 * else the sticker), a white "+" quick add; the diet mark + name (up to 2 lines, hanging indent)
 * and price sit below on the canvas. The art box is the hero origin and the fly-to-cart source.
 */
export function ProductCard({
  product,
  index = 0,
  width,
  onQuickAdd,
  onPress,
  animateEntrance = true,
  saleTone = 'ember',
  showFavorite = true,
  style,
}: ProductCardProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const artRef = useRef<View>(null);
  const quickAdd = useQuickAdd();
  const [added, flashAdded] = useFlash();

  const cardWidth = width ?? Math.min(MAX_DEFAULT_WIDTH, productCardWidth(screenWidth));
  const tileHeight = productTileHeight(cardWidth, screenHeight);
  const art = productArtSize(cardWidth, tileHeight);
  const sticker = visibleSticker(product);
  const soldOut = sticker === 'sold_out';
  const favorite = useIsFavorite(product.id);
  const heart = showFavorite && favorite;
  const diet = dietLabel(product.diet);
  const label = [product.name, diet, formatMoney(product.price), favorite ? 'favourite' : null, soldOut ? 'sold out' : null]
    .filter(Boolean)
    .join(', ');

  const open = async () => {
    if (onPress) {
      onPress(product);
      return;
    }
    const rect = await measureInWindowAsync(artRef);
    if (rect) setHeroOrigin(product.id, rect);
    openProduct(product.id);
  };

  const add = async () => {
    if (onQuickAdd) {
      onQuickAdd(product);
      return;
    }
    if (!canQuickAdd(product)) {
      void open();
      return;
    }
    flashAdded();
    const rect = await measureInWindowAsync(artRef);
    await quickAdd(product, rect);
  };

  return (
    <Animated.View entering={animateEntrance ? enterUp(staggerIndex(index)) : undefined} style={[{ width: cardWidth }, style]}>
      <PressableScale
        onPress={open}
        onPressIn={() => prefetchHeroPhoto(product.image, screenWidth, screenHeight, insets.top)}
        style={styles.card}
        accessibilityLabel={label}
        accessibilityHint="Opens product details"
      >
        <ArtTile
          image={product.image}
          tint={tintForCategory(product.categoryId)}
          width={cardWidth}
          height={tileHeight}
          radius={radii.tile}
          artSize={art}
          artBottom={ART_BOTTOM}
          artOpacity={soldOut ? 0.45 : 1}
          recyclingKey={product.id}
          artRef={artRef}
        >
          {/* One top-left marker: the heart while favourited (it scales away when tapped), else the sticker. */}
          <LayoutAnimationConfig skipEntering>
            {sticker && sticker !== 'sold_out' && !heart ? (
              <Animated.View entering={popIn()} style={styles.sticker}>
                <BadgeSticker badge={sticker} />
              </Animated.View>
            ) : null}
          </LayoutAnimationConfig>
          {showFavorite ? (
            <FavoriteButton productId={product.id} productName={product.name} variant="tile" style={styles.heart} />
          ) : null}
          {soldOut ? (
            <SoldOutOverlay />
          ) : (
            <QuickAddButton onPress={add} added={added} accessibilityLabel={`Add ${product.name} to cart`} style={styles.add} />
          )}
        </ArtTile>

        {/* The price hugs the name (up to 2 lines). No reserved second line: grid rows already size to
            the taller card, so single-line rows don't leave a dead band above the next row. */}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            {product.diet ? <VegMark diet={product.diet} size={13} decorative style={styles.mark} /> : null}
            <Text numberOfLines={2} style={styles.name}>
              {product.name}
            </Text>
          </View>
          <PriceText price={product.price} compareAt={product.compareAtPrice} size={16} saleTone={saleTone} style={styles.price} />
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1 },
  sticker: { position: 'absolute', top: 14, left: 12 },
  // Mirrors the "+" (inset 10); the 30px circle centres on the 34px one's row.
  heart: { position: 'absolute', top: 12, left: 12 },
  add: { position: 'absolute', top: 10, right: 10 },
  // 10 below the tile; name (1–2 lines) + 4 + the 21px price row.
  info: { marginTop: 10, paddingHorizontal: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  // Centred on the first 20px line; a second line hangs under the name, not under the mark.
  mark: { marginTop: 3.5 },
  // Colour: the themed Text default (`ink`).
  name: { ...typeScale.cardName, flex: 1, minWidth: 0 },
  price: { marginTop: 4 },
});
