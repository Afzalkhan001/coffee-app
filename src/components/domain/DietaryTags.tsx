import { type StyleProp, type TextStyle } from 'react-native';
import { Text } from '@/components/ui';
import { fonts, useColors } from '@/theme';
import type { DietaryTag } from '@/types/models';

/** Dietary labels (`icon` is kept for search filters and older call sites; R3 product detail shows words only). */
export const DIETARY_META: Record<DietaryTag, { label: string; icon: string }> = {
  vegan: { label: 'Vegan', icon: 'leaf' },
  vegetarian: { label: 'Vegetarian', icon: 'sprout' },
  gluten_free: { label: 'Gluten-free', icon: 'ban' },
  dairy_free: { label: 'Dairy-free', icon: 'drop' },
  nut_free: { label: 'Nut-free', icon: 'shield-checkmark-outline' },
  contains_nuts: { label: 'Contains nuts', icon: 'alert-circle-outline' },
  low_cal: { label: 'Low cal', icon: 'bolt' },
};

/**
 * Dietary words for the product ingredients line ("Vegetarian · Dairy-free"). Low cal is left out
 * by default (R3: it lives in the kcal badge and the search filter).
 */
export function dietaryLine(tags: readonly DietaryTag[], { max, includeLowCal = false }: { max?: number; includeLowCal?: boolean } = {}): string {
  const words = tags.filter((t) => includeLowCal || t !== 'low_cal').map((t) => DIETARY_META[t].label);
  return (max != null ? words.slice(0, max) : words).join(' · ');
}

export interface DietaryTagsProps {
  tags: DietaryTag[];
  /** Show at most this many words. */
  max?: number;
  style?: StyleProp<TextStyle>;
}

/**
 * R3: dietary info as quiet text ("Vegetarian · Dairy-free", 13/500 `inkSoft`), not outlined pills.
 * Renders nothing when there's nothing to say.
 */
export function DietaryTags({ tags, max, style }: DietaryTagsProps) {
  const c = useColors();
  const line = dietaryLine(tags, { max });
  if (!line) return null;
  return (
    <Text style={[{ fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 }, style]} color={c.inkSoft} accessibilityLabel={line}>
      {line}
    </Text>
  );
}
