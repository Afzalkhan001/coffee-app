/** Pure selectors for the Home rails (no React). */
import { FIRST_ORDER_COUPONS, REGULAR_PROMOTION } from '@/data/mock/marketing';
import type { Product, Promotion } from '@/types/models';

/** Available items first, sold-out ones last (stable within each group). */
export function availableFirst(products: Product[]): Product[] {
  return [...products].sort((a, b) => Number(b.isAvailable) - Number(a.isAvailable));
}

/** "Popular now": products flagged popular, sold-out last. */
export function popularPicks(products: Product[]): Product[] {
  return availableFirst(products.filter((p) => p.isPopular));
}

/**
 * "Your favourites": the saved products, most recently saved first and sold-out last. Ids the menu
 * no longer has are skipped.
 */
export function favoritePicks(products: Product[], ids: readonly string[]): Product[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  return availableFirst(ids.map((id) => byId.get(id)).filter((p): p is Product => p !== undefined));
}

const FRESH_CATEGORIES = ['bakery', 'desserts', 'breakfast'] as const;
const FRESH_MAX = 6;

/** "Fresh from the oven": pastries, then cakes (then breakfast); an even count so the grid has no hole. */
export function freshPicks(products: Product[]): Product[] {
  const picks = FRESH_CATEGORIES.flatMap((id) => products.filter((p) => p.categoryId === id && p.isAvailable));
  const count = Math.min(FRESH_MAX, picks.length - (picks.length % 2));
  return picks.slice(0, count);
}

/**
 * Promotions for this customer: a first-order-only promo (FIRST20) is swapped for the regulars'
 * code once they have an order, so Home never advertises a code checkout would refuse.
 */
export function promosFor(promos: Promotion[], firstOrder: boolean): Promotion[] {
  if (firstOrder) return promos;
  return promos.map((p) => (p.code && FIRST_ORDER_COUPONS.has(p.code) ? REGULAR_PROMOTION : p));
}
