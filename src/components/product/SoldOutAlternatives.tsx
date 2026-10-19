/**
 * Sold-out product (PRD §24 "product unavailable"): instead of a customizer nobody can use, a calm
 * centred "Back tomorrow at 7am" line (no box, no icon disc — R3) and a "Try instead" rail of
 * available items — same category first, then the best-rated of the rest — so the screen keeps
 * selling. Cards don't run their own entrance (the section already rises in); a skeleton row holds
 * the space while the menu loads.
 */
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { getMenu } from '@/api';
import { useAsync } from '@/api/hooks';
import { ProductCard, ProductCardSkeleton } from '@/components/domain';
import { Text } from '@/components/ui';
import { hourLabel } from '@/lib/storeHours';
import { brand } from '@/theme/brand';
import { spacing, useColors } from '@/theme';
import type { Category, Product } from '@/types/models';

const MAX_ITEMS = 6;
const MAX_CARD = 180;

function alternativesFor(product: Product, all: Product[]): Product[] {
  const pool = all.filter((p) => p.id !== product.id && p.isAvailable);
  const same = pool.filter((p) => p.categoryId === product.categoryId);
  const rest = pool.filter((p) => p.categoryId !== product.categoryId).sort((a, b) => b.rating - a.rating);
  return [...same, ...rest].slice(0, MAX_ITEMS);
}

export interface SoldOutAlternativesProps {
  product: Product;
  category?: Category;
}

export function SoldOutAlternatives({ product, category }: SoldOutAlternativesProps) {
  const c = useColors();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(MAX_CARD, Math.floor((Math.min(width, 640) - spacing.gutter) / 2.3));
  const menu = useAsync(getMenu, []);
  const picks = menu.data ? alternativesFor(product, menu.data.products) : [];
  const opens = hourLabel(brand.store.opensAtHour);

  return (
    <View style={styles.wrap}>
      <View style={styles.note} accessible accessibilityLabel={`Sold out today. Back tomorrow at ${opens}.`}>
        <Text variant="h3" align="center">{`Back tomorrow at ${opens}`}</Text>
        <Text variant="caption" color={c.inkSoft} align="center">
          Today’s batch sold out.
        </Text>
      </View>

      {menu.error ? null : (
        <View style={styles.rail}>
          <Text variant="h2" accessibilityRole="header" accessibilityHint={category ? `More from ${category.name}` : undefined}>
            Try instead
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={cardWidth + spacing.md}
            snapToAlignment="start"
            decelerationRate="fast"
            style={styles.scroller}
            contentContainerStyle={styles.cards}
            accessibilityLabel="Try instead"
          >
            {menu.data
              ? picks.map((p, i) => (
                  <View key={p.id} style={styles.cell}>
                    <ProductCard product={p} index={i} width={cardWidth} animateEntrance={false} style={styles.fill} />
                  </View>
                ))
              : [0, 1, 2].map((i) => <ProductCardSkeleton key={i} width={cardWidth} />)}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 28 },
  note: { alignItems: 'center', gap: 2 },
  rail: { gap: spacing.md },
  scroller: { marginHorizontal: -spacing.gutter },
  cards: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  cell: { alignSelf: 'stretch' },
  fill: { flex: 1 },
});
