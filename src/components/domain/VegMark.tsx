/**
 * Indian diet marks (FSSAI convention): a square outline with a filled symbol, the way every Indian
 * menu and food app marks a dish. `veg` = green square + circle, `egg` = amber square + circle
 * (contains egg), `nonveg` = brown square + triangle. Drawn as a 24-grid SVG so it stays crisp from
 * 10 to 16px; the square is filled with `surface` (white in light, lifted espresso in dark) and
 * the mark colours are re-tuned per scheme (`colors.veg / egg / nonVeg`, ≥ 3:1 on every plane).
 */
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useColors, type ColorTokens } from '@/theme';
import type { Diet, Product } from '@/types/models';

export interface DietMeta {
  /** Accessible name ("Vegetarian", "Contains egg", "Non-vegetarian"). */
  label: string;
  /** Colour token key: resolve with `dietColor(diet, colors)` (it differs per scheme). */
  tone: 'veg' | 'egg' | 'nonVeg';
  symbol: 'circle' | 'triangle';
}

export const DIET_META: Readonly<Record<Diet, DietMeta>> = {
  veg: { label: 'Vegetarian', tone: 'veg', symbol: 'circle' },
  egg: { label: 'Contains egg', tone: 'egg', symbol: 'circle' },
  nonveg: { label: 'Non-vegetarian', tone: 'nonVeg', symbol: 'triangle' },
};

/** The mark colour for a diet in the given palette (`useColors()`). */
export function dietColor(diet: Diet, colors: Pick<ColorTokens, 'veg' | 'egg' | 'nonVeg'>): string {
  return colors[DIET_META[diet].tone];
}

/** Spoken diet ("Vegetarian"), or undefined for a product without a mark. */
export function dietLabel(diet: Diet | undefined): string | undefined {
  return diet ? DIET_META[diet].label : undefined;
}

/** Only products explicitly marked veg count: a missing mark is unknown, never "veg". */
export function isVegProduct(product: Pick<Product, 'diet'>): boolean {
  return product.diet === 'veg';
}

/** What "Veg only" leaves in a list: everything when off, else the veg-marked items (order kept). */
export function vegFilter<T extends Pick<Product, 'diet'>>(products: readonly T[], vegOnly: boolean): T[] {
  return vegOnly ? products.filter(isVegProduct) : [...products];
}

export interface VegMarkProps {
  diet: Diet;
  /** Rendered square in px (default 14; 12–16 on lists, 10 inside the Veg only thumb). */
  size?: number;
  /** Hide from screen readers when the parent's label already says the diet. */
  decorative?: boolean;
  style?: StyleProp<ViewStyle>;
}

// 24-grid geometry: a 2.4 stroke ≈ 1.4px at 14px. Triangle bbox centred on the square.
const STROKE = 2.4;
const INSET = STROKE / 2;
const TRIANGLE = 'M12 6.4 L18.3 17.2 L5.7 17.2 Z';

export function VegMark({ diet, size = 14, decorative = false, style }: VegMarkProps) {
  const c = useColors();
  const meta = DIET_META[diet];
  const color = dietColor(diet, c);
  return (
    <View
      style={[{ width: size, height: size }, style]}
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={decorative ? undefined : meta.label}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
      accessibilityElementsHidden={decorative}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24" pointerEvents="none">
        <Rect
          x={INSET}
          y={INSET}
          width={24 - STROKE}
          height={24 - STROKE}
          rx={3.2}
          fill={c.surface}
          stroke={color}
          strokeWidth={STROKE}
        />
        {meta.symbol === 'circle' ? (
          <Circle cx={12} cy={12} r={5.4} fill={color} />
        ) : (
          <Path d={TRIANGLE} fill={color} stroke={color} strokeWidth={1.2} strokeLinejoin="round" />
        )}
      </Svg>
    </View>
  );
}
