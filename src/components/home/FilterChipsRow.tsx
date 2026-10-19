import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Skeleton } from '@/components/motion';
import { Chip } from '@/components/ui';
import { radii, spacing } from '@/theme';
import type { ProductFilter, ProductFilterId } from './categoryCopy';

export interface FilterChipsRowProps {
  filters: ProductFilter[];
  value: ProductFilterId;
  onChange: (id: ProductFilterId) => void;
  style?: StyleProp<ViewStyle>;
}

/** Outlined text chips (ref 2, R3.A7): All / Iced / Dairy-free / Low cal. No icons. */
export function FilterChipsRow({ filters, value, onChange, style }: FilterChipsRowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      style={style}
    >
      {filters.map((f) => (
        <Chip
          key={f.id}
          label={f.label}
          selected={f.id === value}
          onPress={() => {
            if (f.id !== value) onChange(f.id);
          }}
        />
      ))}
    </ScrollView>
  );
}

/** Placeholder with the row's exact height (40px chips + 2px above and below), so the grid never jumps. */
export function FilterChipsSkeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.skeleton, style]} accessibilityLabel="Loading filters" accessible>
      {[54, 72, 104, 86].map((w, i) => (
        <Skeleton key={i} width={w} height={40} radius={radii.pill} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.gutter, gap: spacing.xs, paddingVertical: 2 },
  skeleton: { flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.gutter, paddingVertical: 2, overflow: 'hidden' },
});
