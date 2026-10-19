/**
 * Loading placeholders shaped exactly like the real R3 surfaces, so content swaps in without layout
 * jumps (DESIGN.md §7: shimmer, never spinners). Product placeholders are tint-coloured tiles.
 */
import { StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { Skeleton } from '@/components/motion';
import { makeStyles, radii, spacing } from '@/theme';
import { PRODUCT_GRID_GAP, PRODUCT_GRID_ROW_GAP, productCardWidth, productTileHeight } from './ProductCard';
import { PROMO_BLEED, PROMO_CARD_HEIGHT } from './PromoCarousel';

/** Product placeholders sit on the coffee tile tint of the current scheme. */
const useTileFill = makeStyles((_, t) => ({ tile: { backgroundColor: t.tileTints.coffee } }));

export function ProductCardSkeleton({ width, style }: { width?: number; style?: StyleProp<ViewStyle> }) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const cardWidth = width ?? Math.min(230, productCardWidth(screenWidth));
  // Same tile as ProductCard (slightly landscape on short phones), so nothing jumps on swap-in.
  const tile = productTileHeight(cardWidth, screenHeight);
  const fill = useTileFill();
  return (
    <View style={[{ width: cardWidth }, style]} accessibilityLabel="Loading" accessible>
      <Skeleton height={tile} radius={radii.tile} style={fill.tile} />
      <View style={styles.cardInfo}>
        <Skeleton width="78%" height={14} radius={7} />
        <Skeleton width="34%" height={16} radius={8} style={styles.priceBar} />
      </View>
    </View>
  );
}

/** Two-column grid of card skeletons (R3 gaps: 14 across, 22 down). */
export function ProductGridSkeleton({ count = 4, style }: { count?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.grid, style]}>
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </View>
  );
}

/** A `ProductRow` placeholder (for a white sheet): 64 thumbnail tile + name / blurb / price bars. */
export function ProductRowSkeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const fill = useTileFill();
  return (
    <View style={[styles.row, style]} accessibilityLabel="Loading" accessible>
      <Skeleton width={64} height={64} radius={radii.thumb} style={fill.tile} />
      <View style={styles.rowBody}>
        <Skeleton width="62%" height={15} radius={7} />
        <Skeleton width="86%" height={11} radius={6} />
        <Skeleton width="28%" height={14} radius={7} style={styles.gapTop} />
      </View>
      <Skeleton width={36} height={36} radius={18} />
    </View>
  );
}

/** Banner placeholder with the same top bleed room and dots as `PromoCarousel`. */
export function PromoCarouselSkeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.promo, style]} accessibilityLabel="Loading offers" accessible>
      <Skeleton height={PROMO_CARD_HEIGHT} radius={radii.banner} />
      <View style={styles.dots}>
        <Skeleton width={22} height={6} radius={3} />
        <Skeleton width={6} height={6} radius={3} />
        <Skeleton width={6} height={6} radius={3} />
      </View>
    </View>
  );
}

/** An `OrderHistoryRow` placeholder (for a white sheet). */
export function OrderRowSkeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const fill = useTileFill();
  return (
    <View style={[styles.row, styles.orderRow, style]} accessibilityLabel="Loading" accessible>
      <Skeleton width={56} height={56} radius={radii.thumbSmall} style={fill.tile} />
      <View style={styles.rowBody}>
        <Skeleton width="65%" height={15} radius={7} />
        <Skeleton width="40%" height={11} radius={6} />
      </View>
      <Skeleton width={56} height={18} radius={9} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Matches ProductCard's info block (10 + a 20px name line + 4 + the 21px price row = 55), bars centred in their lines.
  cardInfo: { paddingHorizontal: 4, paddingTop: 13, minHeight: 55 },
  priceBar: { marginTop: 10 },
  gapTop: { marginTop: 4 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: PRODUCT_GRID_GAP,
    rowGap: PRODUCT_GRID_ROW_GAP,
    paddingHorizontal: spacing.gutter,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 88,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  orderRow: { minHeight: 76 },
  rowBody: { flex: 1, gap: 8 },
  promo: { paddingHorizontal: spacing.gutter, paddingTop: PROMO_BLEED },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 12 },
});
