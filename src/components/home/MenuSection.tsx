import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { enterFade, Skeleton } from '@/components/motion';
import { Text } from '@/components/ui';
import { fonts, makeStyles, radii, spacing, type as typeScale, useColors } from '@/theme';
import type { Category, Product } from '@/types/models';
import { ProductGrid, ProductGridSkeletons } from './ProductGrid';

/** Space above a section header (R3 Menu: 24 above, 14 below). */
export const MENU_SECTION_TOP = spacing.xl;
const HEADER_GAP = 14;

export interface MenuSectionProps {
  category: Category;
  products: Product[];
  /** Must be attached to a direct child of the scroll view (scroll-spy measures content offsets). */
  onLayout?: (e: LayoutChangeEvent) => void;
  /**
   * Header fade + card stagger on mount (default true). Menu turns it off for the sections it mounts
   * after the first screen: they start off-screen, so animating them is wasted work.
   */
  animateEntrance?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** A real-menu section: "Coffee 8" (19/600 + the count in 15/400 `inkMuted`), then the 2-column card grid. */
export function MenuSection({ category, products, onLayout, animateEntrance = true, style }: MenuSectionProps) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View onLayout={onLayout} style={[styles.section, style]}>
      <Animated.View entering={animateEntrance ? enterFade(0) : undefined} style={styles.header}>
        <Text
          style={styles.title}
          accessibilityRole="header"
          accessibilityLabel={`${category.name}, ${products.length} items`}
          numberOfLines={1}
        >
          {category.name}
          <Text style={styles.count} color={c.inkMuted}>{` ${products.length}`}</Text>
        </Text>
      </Animated.View>
      <ProductGrid products={products} animateEntrance={animateEntrance} />
    </View>
  );
}

/** Placeholder for the first menu section while it loads: the same header line above shimmering cards. */
export function MenuSectionSkeleton({ count = 4, style }: { count?: number; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return (
    <View style={[styles.section, style]} accessibilityLabel="Loading the menu" accessible>
      <View style={styles.header}>
        <Skeleton width={110} height={18} radius={9} style={styles.titleSkeleton} />
      </View>
      <ProductGridSkeletons count={count} />
    </View>
  );
}

/** Placeholder chip row while the menu loads (same height as CategoryChips). */
export function MenuChipsSkeleton() {
  const styles = useStyles();
  return (
    <View style={styles.chips} accessibilityLabel="Loading categories" accessible>
      {[92, 120, 104, 96].map((w, i) => (
        <Skeleton key={i} width={w} height={40} radius={radii.pill} />
      ))}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  chips: { flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.gutter, paddingVertical: spacing.xs, overflow: 'hidden' },
  section: { paddingTop: MENU_SECTION_TOP },
  header: { paddingHorizontal: spacing.gutter, marginBottom: HEADER_GAP, minHeight: typeScale.h2.lineHeight, justifyContent: 'center' },
  title: { ...typeScale.h2, color: c.ink },
  count: { fontFamily: fonts.regular, fontSize: 15, lineHeight: typeScale.h2.lineHeight },
  titleSkeleton: { marginVertical: 3 },
}));
