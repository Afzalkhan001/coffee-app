/**
 * Category hero copy and the Category screen's filters, keyed by the mock catalogue's category ids
 * with safe fallbacks for any new category. R3: no taglines, no illustrations.
 */
import { resolveModifierGroups } from '@/api';
import { PRODUCTS } from '@/data/mock/menu';
import { formatMoney, pluralize } from '@/lib/format';
import type { Category, Product } from '@/types/models';

const DRINK_CATEGORIES = new Set(['coffee', 'tea', 'cold']);

/**
 * Hero caption: "8 drinks · from ₹160" ("3 items · from ₹140" for food). `veg` names a list "Veg only"
 * narrowed: "1 veg item · from ₹420".
 */
export function categorySummary(category: Pick<Category, 'id'>, products: Product[], opts: { veg?: boolean } = {}): string {
  const noun = `${opts.veg ? 'veg ' : ''}${DRINK_CATEGORIES.has(category.id) ? 'drink' : 'item'}`;
  const count = pluralize(products.length, noun);
  const available = products.filter((p) => p.isAvailable);
  const priced = available.length > 0 ? available : products;
  if (priced.length === 0) return count;
  return `${count} · from ${formatMoney(Math.min(...priced.map((p) => p.price)))}`;
}

// ── filters ──────────────────────────────────────────────────

/** R3.A7: the Category filters are All / Iced / Dairy-free / Low cal, text only. */
export type ProductFilterId = 'all' | 'iced' | 'dairy_free' | 'low_cal';

export interface ProductFilter {
  id: ProductFilterId;
  label: string;
  test: (product: Product) => boolean;
}

const LOW_CAL_KCAL = 150;

/** Options of the product's temperature group, if it has one (mock modifier ids). */
function temperatureOptions(product: Product): string[] | null {
  const group = resolveModifierGroups(product.id).find((g) => g.id === 'temperature');
  return group ? group.options.map((o) => o.id) : null;
}

function isIced(product: Product): boolean {
  if (product.categoryId === 'cold') return true;
  return temperatureOptions(product)?.includes('temp-iced') ?? false;
}

export const PRODUCT_FILTERS: ProductFilter[] = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'iced', label: 'Iced', test: isIced },
  {
    id: 'dairy_free',
    label: 'Dairy-free',
    test: (p) => p.dietary.includes('dairy_free') || p.dietary.includes('vegan'),
  },
  {
    id: 'low_cal',
    label: 'Low cal',
    test: (p) => p.dietary.includes('low_cal') || (p.kcal !== undefined && p.kcal <= LOW_CAL_KCAL),
  },
];

/** Filters worth showing for this list: "All" plus any filter that narrows it without emptying it. */
export function usefulFilters(products: Product[]): ProductFilter[] {
  return PRODUCT_FILTERS.filter((f) => {
    if (f.id === 'all') return true;
    const n = products.filter(f.test).length;
    return n > 0 && n < products.length;
  });
}

export function applyFilter(products: Product[], filterId: ProductFilterId): Product[] {
  const filter = PRODUCT_FILTERS.find((f) => f.id === filterId);
  return filter ? products.filter(filter.test) : products;
}

/**
 * Whether a category's filter row will show, known before its products load (from the bundled
 * catalogue), so the loading state reserves the row and the grid doesn't jump when it arrives.
 */
export function expectsFilters(categoryId: string): boolean {
  return usefulFilters(PRODUCTS.filter((p) => p.categoryId === categoryId)).length > 1;
}
