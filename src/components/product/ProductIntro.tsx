/**
 * Product words (R3.B product detail): the split title and its one meta line live INSIDE the hero
 * ("**Caramel** Macchiato" over "★ 4.5 · 6 min"); the sheet opens with one centred ingredients
 * line ("Vanilla, steamed milk, espresso and a caramel lattice · Vegetarian"). No category eyebrow,
 * no chips, no dietary pills.
 */
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { dietaryLine, MetaChips } from '@/components/domain';
import { enterUp } from '@/components/motion';
import { SplitTitle, Text } from '@/components/ui';
import { fonts, useColors } from '@/theme';
import type { Product } from '@/types/models';
import { TITLE_SIZE } from './layout';

/** Outfit 400 advances (em) for the ingredients line's width estimate; anything else ≈ 0.55em. */
const ADVANCE: Readonly<Record<string, number>> = {
  ' ': 0.208, ',': 0.275, '.': 0.29, '-': 0.461, '·': 0.13, '%': 0.66, "'": 0.237, '’': 0.249, '&': 0.659,
  a: 0.582, b: 0.582, c: 0.489, d: 0.582, e: 0.536, f: 0.399, g: 0.579, h: 0.548, i: 0.224, j: 0.23, k: 0.498,
  l: 0.222, m: 0.855, n: 0.548, o: 0.566, p: 0.582, q: 0.583, r: 0.419, s: 0.427, t: 0.368, u: 0.516, v: 0.511,
  w: 0.75, x: 0.504, y: 0.514, z: 0.447, I: 0.27, M: 0.82, W: 0.9,
};
const INGREDIENTS_SIZE = 14;
/** Side padding of the line inside the sheet, and its widest measure. */
const INGREDIENTS_PAD = 36;
const INGREDIENTS_MAX = 320;
/** Keeps a word (or a hyphenated word) together: U+2060 WORD JOINER is invisible in every font. */
const JOIN = '\u2060';
const NBSP = '\u00A0';

function textWidth(text: string): number {
  let em = 0;
  for (const ch of text) em += ADVANCE[ch] ?? (ch >= 'A' && ch <= 'Z' ? 0.66 : 0.55);
  // 4% safety margin: an estimate that runs short would wrap where we didn't plan to.
  return em * INGREDIENTS_SIZE * 1.04;
}

/** Greedy word wrap (what the text engine does): the lines `text` breaks into at `width`. */
function wrapLines(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && textWidth(next) > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** "Gluten-free" → one unbreakable unit; words joined by " · " with no-break spaces. */
function unbreakableDiet(diet: string): string {
  return diet
    .split(' · ')
    .map((w) => w.replace(/-/g, `${JOIN}-${JOIN}`).replace(/ /g, NBSP))
    .join(`${NBSP}·${NBSP}`);
}

/**
 * The short description plus dietary words, laid out so the dietary words never split or widow:
 * one line when everything fits ("Espresso over ice with cold milk · Vegetarian"); otherwise the
 * description's last line takes them when they fit beside it, else they get line 2 to themselves
 * ("Ceremonial-grade Uji matcha whisked with milk" / "Vegetarian").
 */
export function ingredientsLine(product: Pick<Product, 'description' | 'dietary'>, width = 390): string {
  const text = product.description.trim().replace(/[.。]+$/, '');
  const diet = dietaryLine(product.dietary, { max: 2 });
  if (!diet) return text;
  const measure = Math.min(width - INGREDIENTS_PAD * 2, INGREDIENTS_MAX);
  const sep = ' · ';
  const lines = wrapLines(text, measure);
  const last = lines[lines.length - 1] ?? '';
  const glued = unbreakableDiet(diet);
  // The separator is glued too: if the estimate is ever off, "lattice · Vegetarian" moves as a unit.
  if (lines.length <= 2 && textWidth(`${last}${sep}${diet}`) <= measure) return `${text}${NBSP}·${NBSP}${glued}`;
  if (lines.length === 1) return `${text}\n${glued}`;
  // A two-line description has no room left: keep the description (the detail rows carry the rest).
  return text;
}

export interface HeroTitleProps {
  product: Product;
  /** First stagger index (later when the hero is still landing). */
  stagger: number;
  width: number;
  style?: StyleProp<ViewStyle>;
}

export function HeroTitle({ product, stagger, width, style }: HeroTitleProps) {
  return (
    <View style={[{ width }, style]}>
      <Animated.View entering={enterUp(stagger)}>
        <SplitTitle size={TITLE_SIZE} numberOfLines={2} style={styles.title}>
          {product.name}
        </SplitTitle>
      </Animated.View>
      <Animated.View entering={enterUp(stagger + 1)} style={styles.meta}>
        <MetaChips product={{ prepMinutes: product.prepMinutes, rating: product.rating, ratingCount: product.ratingCount, kcal: product.kcal }} />
      </Animated.View>
    </View>
  );
}

export function IngredientsLine({
  product,
  width,
  style,
}: {
  product: Pick<Product, 'description' | 'dietary'>;
  /** Window width (the line wraps against its share of it). */
  width: number;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const line = ingredientsLine(product, width);
  return (
    <View style={[styles.ingredients, style]}>
      <Text
        style={styles.ingredientsText}
        color={c.inkSoft}
        align="center"
        numberOfLines={2}
        accessibilityLabel={line.replace(/\u2060/g, '').replace(/\u00A0/g, ' ').replace(/\n/g, '. ')}
      >
        {line}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { lineHeight: 36 },
  meta: { marginTop: 4 },
  ingredients: { alignItems: 'center', paddingHorizontal: INGREDIENTS_PAD },
  ingredientsText: { fontFamily: fonts.regular, fontSize: INGREDIENTS_SIZE, lineHeight: 20, maxWidth: INGREDIENTS_MAX },
});
