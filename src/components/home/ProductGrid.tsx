import { StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { PRODUCT_GRID_GAP, PRODUCT_GRID_ROW_GAP, ProductCard, ProductCardSkeleton, productCardWidth } from '@/components/domain';
import { exitFade, layoutSpring } from '@/components/motion';
import { spacing } from '@/theme';
import type { Product } from '@/types/models';

/** Columns for a product grid at this window width: 2 on phones, more on tablets / wide web. */
export function gridColumns(windowWidth: number): number {
  if (windowWidth >= 1100) return 5;
  if (windowWidth >= 860) return 4;
  if (windowWidth >= 620) return 3;
  return 2;
}

/** Card width for a responsive grid inside the 20px gutter. */
export function useGridCardWidth(): { columns: number; cardWidth: number } {
  const { width } = useWindowDimensions();
  const columns = gridColumns(width);
  return { columns, cardWidth: productCardWidth(width, columns) };
}

export interface ProductGridProps {
  products: Product[];
  /**
   * Animate re-flows (filters): cards keep their key, removed cards fade out and the rest
   * spring into place. Off for static grids.
   */
  animateLayout?: boolean;
  /**
   * Cards stagger in on mount (default true). False inside a section that already rises in (Home)
   * and for Menu sections mounted after the first screen (off-screen cards shouldn't animate).
   */
  animateEntrance?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** 2-column (responsive) grid of R3 product cards inside the screen gutter: 14 between columns, 22 between rows. */
export function ProductGrid({ products, animateLayout = false, animateEntrance = true, style }: ProductGridProps) {
  const { cardWidth } = useGridCardWidth();
  return (
    <View style={[styles.grid, style]}>
      {products.map((product, i) => (
        <Animated.View
          key={product.id}
          layout={animateLayout ? layoutSpring : undefined}
          exiting={animateLayout ? exitFade : undefined}
          style={styles.cell}
        >
          <ProductCard product={product} index={i} width={cardWidth} animateEntrance={animateEntrance} style={styles.fill} />
        </Animated.View>
      ))}
    </View>
  );
}

/** Shimmering placeholders with the exact card geometry, so content swaps in without a jump. */
export function ProductGridSkeletons({ count = 4, style }: { count?: number; style?: StyleProp<ViewStyle> }) {
  const { cardWidth } = useGridCardWidth();
  return (
    <View style={[styles.grid, style]}>
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} width={cardWidth} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: PRODUCT_GRID_GAP,
    rowGap: PRODUCT_GRID_ROW_GAP,
    paddingHorizontal: spacing.gutter,
  },
  cell: { alignSelf: 'stretch' },
  // Cards in a row share the tallest card's height (price pinned to the bottom).
  fill: { flex: 1 },
});
