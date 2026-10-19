import { Platform, ScrollView, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import { ProductCard, ProductCardSkeleton } from '@/components/domain';
import { spacing } from '@/theme';
import type { Product } from '@/types/models';

const GAP = spacing.sm;
const MAX_CARD = 196;

/** Web has no snapToInterval: CSS scroll-snap instead (RNW passes these styles through). */
const webSnapContainer = (
  Platform.OS === 'web' ? { scrollSnapType: 'x mandatory', scrollPaddingLeft: spacing.gutter } : {}
) as ViewStyle;
const webSnapItem = (Platform.OS === 'web' ? { scrollSnapAlign: 'start' } : {}) as ViewStyle;

/** R3 rail card: 156 wide at 390pt (tile 156×164), so two cards and a slice of the third show. */
function useRailCardWidth(): number {
  const { width } = useWindowDimensions();
  return Math.min(MAX_CARD, Math.round(width * 0.4));
}

export interface ProductRailProps {
  products: Product[];
  accessibilityLabel: string;
  /**
   * Cards stagger in on their own (default true). Pass false inside a section that already rises
   * in, so the cards don't travel twice.
   */
  animateEntrance?: boolean;
  /** Sale price tone for the cards (Home passes 'ink': the promo banner is its one ember element). */
  saleTone?: 'ember' | 'ink';
  /** Hearts on favourited cards (default true; the Home favourites rail turns them off). */
  showFavorite?: boolean;
}

/** Horizontal, snapping row of R3 product cards ("Popular now"). */
export function ProductRail({ products, accessibilityLabel, animateEntrance = true, saleTone, showFavorite }: ProductRailProps) {
  const cardWidth = useRailCardWidth();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={cardWidth + GAP}
      snapToAlignment="start"
      decelerationRate="fast"
      contentContainerStyle={styles.content}
      style={webSnapContainer}
      accessibilityLabel={accessibilityLabel}
    >
      {products.map((product, i) => (
        <View key={product.id} style={[styles.cell, webSnapItem]}>
          <ProductCard
            product={product}
            index={i}
            width={cardWidth}
            animateEntrance={animateEntrance}
            saleTone={saleTone}
            showFavorite={showFavorite}
            style={styles.fill}
          />
        </View>
      ))}
    </ScrollView>
  );
}

export function ProductRailSkeleton() {
  const cardWidth = useRailCardWidth();
  return (
    <View style={styles.skeletonRow} accessibilityLabel="Loading popular items" accessible>
      {[0, 1, 2].map((i) => (
        <ProductCardSkeleton key={i} width={cardWidth} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.gutter, gap: GAP },
  cell: { alignSelf: 'stretch' },
  fill: { flex: 1 },
  skeletonRow: { flexDirection: 'row', gap: GAP, paddingHorizontal: spacing.gutter, overflow: 'hidden' },
});
