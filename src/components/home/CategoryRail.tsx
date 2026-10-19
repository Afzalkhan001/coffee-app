import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { CATEGORY_TILE, CATEGORY_TILE_PITCH, CategoryTile } from '@/components/domain';
import { popIn, Skeleton } from '@/components/motion';
import { radii, spacing } from '@/theme';
import type { Category } from '@/types/models';

export interface CategoryRailProps {
  categories: Category[];
  onPress: (category: Category) => void;
}

/** The first tile's edge sits on the 20px gutter (each 64px tile is centred in its 74px slot). */
const RAIL_PAD = spacing.gutter - (CATEGORY_TILE_PITCH - CATEGORY_TILE) / 2;
/** How much of the 6th tile shows at the right edge, so the row reads as scrollable. */
const PEEK = 18;
const MIN_PITCH = 68;

/**
 * Tile pitch: 74 (R3) where five tiles plus a peek fit, tightened down to 68 on narrower phones —
 * at 390pt a 74 pitch lands the 6th tile exactly on the screen edge, so nothing would peek.
 */
function usePitch(): number {
  const { width } = useWindowDimensions();
  return Math.max(MIN_PITCH, Math.min(CATEGORY_TILE_PITCH, (width - spacing.gutter - PEEK) / 5));
}

/** R3 Home categories: one row of 64px tinted tiles with signature cut-outs (the 6th peeks); tiles pop in one after another. No header. */
export function CategoryRail({ categories, onPress }: CategoryRailProps) {
  // Slots stay 74 wide (labels keep their room); a negative margin pulls them onto the pitch.
  const overlap = usePitch() - CATEGORY_TILE_PITCH;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      accessibilityLabel="Categories"
    >
      {categories.map((category, i) => (
        <Animated.View key={category.id} entering={popIn(i + 1)} style={i < categories.length - 1 ? { marginRight: overlap } : null}>
          <CategoryTile category={category} onPress={onPress} />
        </Animated.View>
      ))}
    </ScrollView>
  );
}

export function CategoryRailSkeleton() {
  const overlap = usePitch() - CATEGORY_TILE_PITCH;
  return (
    <View style={[styles.content, styles.skeletonRow]} accessibilityLabel="Loading categories" accessible>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={[styles.skeletonTile, { marginRight: overlap }]}>
          <Skeleton width={CATEGORY_TILE} height={CATEGORY_TILE} radius={radii.category} />
          <Skeleton width={44} height={10} radius={5} style={styles.skeletonLabel} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: RAIL_PAD },
  skeletonRow: { flexDirection: 'row', overflow: 'hidden' },
  skeletonTile: { width: CATEGORY_TILE_PITCH, alignItems: 'center' },
  skeletonLabel: { marginTop: 10 },
});
