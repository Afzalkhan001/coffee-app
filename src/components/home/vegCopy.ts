/**
 * Copy for the "Veg only" filter's quiet states (Menu note, Category empty state, Search). Pure,
 * so it's unit-tested; the words follow DESIGN.md A6 (short, plain, no exclamation marks).
 */
import type { Product } from '@/types/models';

type DietOnly = Pick<Product, 'diet'>;

/** "Bakery & Snacks", "Bakery & Snacks and Desserts", "Tea, Bakery & Snacks and Desserts". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Menu's closing note: "No veg items in Bakery & Snacks and Desserts". */
export function vegHiddenCategoriesNote(hiddenNames: readonly string[], shownSections: number): string {
  return shownSections > 0 ? `No veg items in ${joinNames(hiddenNames)}` : 'No veg items on the menu right now';
}

/** Category empty state: why "Veg only" left it empty ("Everything in Desserts contains egg."). */
export function noVegMessage(categoryName: string, products: readonly DietOnly[]): string {
  if (products.every((p) => p.diet === 'egg')) return `Everything in ${categoryName} contains egg.`;
  if (products.every((p) => p.diet === 'nonveg')) return `Everything in ${categoryName} is non-veg.`;
  if (products.every((p) => p.diet === 'egg' || p.diet === 'nonveg')) return `Everything in ${categoryName} has egg or meat.`;
  return `Nothing in ${categoryName} is marked veg yet.`;
}

/** Search: why "Veg only" set the matches aside ("The one match contains egg."). */
export function vegHiddenReason(hidden: readonly DietOnly[]): string {
  const [one, many] = hidden.every((p) => p.diet === 'egg')
    ? ['contains egg', 'contain egg']
    : hidden.every((p) => p.diet === 'nonveg')
      ? ['is non-veg', 'are non-veg']
      : hidden.every((p) => p.diet === 'egg' || p.diet === 'nonveg')
        ? ['has egg or meat', 'have egg or meat']
        : ['isn’t marked veg', 'aren’t marked veg'];
  return hidden.length === 1 ? `The one match ${one}.` : `All ${hidden.length} matches ${many}.`;
}
