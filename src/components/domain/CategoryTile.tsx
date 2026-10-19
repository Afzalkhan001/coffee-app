import { StyleSheet, View } from 'react-native';
import Animated, { cubicBezier } from 'react-native-reanimated';
import { categoryImage } from '@/api';
import { Icon, PressableScale, Text } from '@/components/ui';
import { fonts, makeStyles, radii, useTheme } from '@/theme';
import type { Category } from '@/types/models';
import { ProductArt } from './productArt';

/** R3 Home category tile: 64×64, r22, signature cut-out 56 standing 2px above the tile bottom. */
export const CATEGORY_TILE = 64;
/** Row pitch (tile + gap): 74, so the 6th tile peeks at 390pt. */
export const CATEGORY_TILE_PITCH = 74;
const ART = 56;
const ART_BOTTOM = 2;
const easeOutQuint = cubicBezier(0.22, 1, 0.36, 1);

/** One-word tile labels (R3 Home: "Coffee · Matcha · Iced · Breakfast · Bakery"); a11y keeps the full name. */
const SHORT_LABEL: Readonly<Record<string, string>> = {
  coffee: 'Coffee',
  tea: 'Matcha',
  cold: 'Iced',
  breakfast: 'Breakfast',
  bakery: 'Bakery',
  desserts: 'Desserts',
};

export interface CategoryTileProps {
  category: Category;
  selected?: boolean;
  onPress: (category: Category) => void;
  /** Selection ring colour (default ink). DESIGN §2: ember only when no promo is on screen. */
  accent?: 'ink' | 'ember';
}

/**
 * R3 category tile: a tinted rounded square holding the category's signature cut-out on a contact
 * shadow, label 12/500 ink centred 8px below. No glyph disc, no photo ring, no white card. A
 * selected tile gets a 2px ring; a category without a photo shows its line glyph.
 */
export function CategoryTile({ category, selected = false, onPress, accent = 'ink' }: CategoryTileProps) {
  const { colors: c, tileTints } = useTheme();
  const styles = useStyles();
  const ring = accent === 'ember' ? c.ember : c.ink;
  const image = categoryImage(category.id);
  return (
    <PressableScale
      onPress={() => onPress(category)}
      activeScale={0.94}
      style={styles.wrap}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={category.name}
    >
      <View style={[styles.tile, { backgroundColor: tileTints[category.tint] }]}>
        {image ? (
          <ProductArt
            image={image}
            size={ART}
            shadow={0.2}
            recyclingKey={`cat-${category.id}`}
            style={styles.art}
          />
        ) : (
          <Icon name={category.icon} size={30} color={c.roastText} />
        )}
        <Animated.View
          style={[
            styles.ring,
            {
              borderColor: selected ? ring : 'transparent',
              transitionProperty: 'borderColor',
              transitionDuration: 240,
              transitionTimingFunction: easeOutQuint,
            },
          ]}
        />
      </View>
      <Text numberOfLines={1} align="center" style={[styles.label, { fontFamily: selected ? fonts.semibold : fonts.medium }]}>
        {SHORT_LABEL[category.id] ?? category.name}
      </Text>
    </PressableScale>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { width: CATEGORY_TILE_PITCH, alignItems: 'center' },
  tile: {
    width: CATEGORY_TILE,
    height: CATEGORY_TILE,
    borderRadius: radii.category,
    alignItems: 'center',
    justifyContent: 'center',
  },
  art: { position: 'absolute', left: (CATEGORY_TILE - ART) / 2, top: CATEGORY_TILE - ART_BOTTOM - ART },
  ring: { ...StyleSheet.absoluteFill, borderRadius: radii.category, borderWidth: 2, pointerEvents: 'none' },
  label: { marginTop: 8, fontSize: 12, lineHeight: 15, color: c.ink, maxWidth: CATEGORY_TILE_PITCH + 2 },
}));
