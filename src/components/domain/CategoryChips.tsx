import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cubicBezier } from 'react-native-reanimated';
import { PressableScale, Text } from '@/components/ui';
import { fonts, radii, spacing, useColors } from '@/theme';
import type { Category } from '@/types/models';

const easeOutQuint = cubicBezier(0.22, 1, 0.36, 1);

export interface CategoryChipsProps {
  categories: Pick<Category, 'id' | 'name' | 'icon'>[];
  selectedId?: string;
  onSelect: (id: string) => void;
  /** @deprecated R3 chips are text only; ignored. */
  showIcons?: boolean;
  /** Item counts: used for the accessibility label only (R3 chips show no counts). */
  counts?: Record<string, number>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
}

/**
 * R3 outlined text chips (ref 2) in a horizontal scroller: 40h, 1px `line`, 14/500 `inkSoft`;
 * selected = 1.5px ink border, 600 ink. No icons, no counts, no fill. The selection is
 * auto-scrolled to the centre of the row.
 */
export function CategoryChips({
  categories,
  selectedId,
  onSelect,
  counts,
  contentContainerStyle,
  style,
}: CategoryChipsProps) {
  const palette = useColors();
  const scrollRef = useRef<ScrollView>(null);
  const frames = useRef<Record<string, { x: number; width: number }>>({});
  const [viewport, setViewport] = useState(0);
  const [measured, setMeasured] = useState(0);

  useEffect(() => {
    if (!selectedId || viewport === 0) return;
    const frame = frames.current[selectedId];
    if (!frame) return;
    const x = Math.max(0, frame.x - (viewport - frame.width) / 2);
    scrollRef.current?.scrollTo({ x, animated: true });
  }, [selectedId, viewport, measured]);

  const onChipLayout = (id: string) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    frames.current[id] = { x, width };
    if (id === selectedId) setMeasured((n) => n + 1);
  };

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      onLayout={(e) => setViewport(e.nativeEvent.layout.width)}
      contentContainerStyle={[styles.content, contentContainerStyle]}
      style={style}
    >
      {categories.map((c) => {
        const selected = c.id === selectedId;
        const count = counts?.[c.id];
        return (
          <PressableScale
            key={c.id}
            onLayout={onChipLayout(c.id)}
            onPress={() => onSelect(c.id)}
            hitSlop={CHIP_HIT_SLOP}
            hapticKind={selected ? null : 'select'}
            activeScale={0.95}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={count != null ? `${c.name}, ${count} items` : c.name}
          >
            <Animated.View
              style={[
                styles.chip,
                {
                  // 1px → 1.5px border; padding absorbs the half pixel so the label never shifts.
                  borderWidth: selected ? 1.5 : 1,
                  paddingHorizontal: selected ? spacing.md - 0.5 : spacing.md,
                  borderColor: selected ? palette.ink : palette.line,
                  transitionProperty: 'borderColor',
                  transitionDuration: 220,
                  transitionTimingFunction: easeOutQuint,
                },
              ]}
            >
              <Text
                style={[styles.label, { fontFamily: selected ? fonts.semibold : fonts.medium }]}
                color={selected ? palette.ink : palette.inkSoft}
              >
                {c.name}
              </Text>
            </Animated.View>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

/** 40px chips + 2px slop above and below = the 44px minimum tap target. */
const CHIP_HIT_SLOP = { top: 2, bottom: 2, left: 0, right: 0 };

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.gutter, gap: spacing.xs, alignItems: 'center' },
  chip: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.pill,
  },
  label: { fontSize: 14, lineHeight: 18 },
});
