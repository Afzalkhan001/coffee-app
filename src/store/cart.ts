import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { reorderableLines } from '@/api';
import { uid } from '@/lib/format';
import { configKey } from '@/lib/modifiers';
import { cartCount } from '@/lib/pricing';
import { persistStorage, STORAGE_KEYS } from '@/lib/storage';
import type { CartItem, OrderItem, SelectedModifierSnapshot } from '@/types/models';

export interface NewCartLine {
  productId: string;
  name: string;
  image: string;
  basePrice: number;
  quantity: number;
  modifiers: SelectedModifierSnapshot[];
  instructions?: string;
}

interface CartState {
  items: CartItem[];
  couponCode?: string;
  rewardId?: string;
  /** Adds a line; identical configurations are merged into one line. Returns the line id. */
  add: (line: NewCartLine) => string;
  /**
   * Replaces an existing line (edit flow). Merges into an identical line if one exists and says so,
   * so the caller can explain why a row disappeared ("Merged with your other Caffè Latte (now 3)").
   */
  replace: (lineId: string, line: NewCartLine) => ReplaceResult;
  setQuantity: (lineId: string, quantity: number) => void;
  increment: (lineId: string) => void;
  decrement: (lineId: string) => void;
  remove: (lineId: string) => void;
  /** Re-add the still-available lines of a past order at today's prices. */
  reorder: (items: OrderItem[]) => void;
  setCoupon: (code?: string) => void;
  setReward: (id?: string) => void;
  clear: () => void;
}

const MAX_QTY = 20;

export type ReplaceResult = { merged: false } | { merged: true; intoLineId: string; quantity: number };

function toItem(line: NewCartLine): CartItem {
  const instructions = line.instructions?.trim() || undefined;
  return {
    ...line,
    instructions,
    id: uid('line'),
    quantity: Math.min(MAX_QTY, Math.max(1, line.quantity)),
    configKey: configKey(line.productId, line.modifiers, instructions),
  };
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      couponCode: undefined,
      rewardId: undefined,
      add: (line) => {
        const item = toItem(line);
        const existing = get().items.find((i) => i.configKey === item.configKey);
        if (existing) {
          set((s) => ({
            items: s.items.map((i) =>
              i.id === existing.id ? { ...i, quantity: Math.min(MAX_QTY, i.quantity + item.quantity) } : i,
            ),
          }));
          return existing.id;
        }
        set((s) => ({ items: [...s.items, item] }));
        return item.id;
      },
      replace: (lineId, line) => {
        const item = toItem(line);
        const dup = get().items.find((i) => i.configKey === item.configKey && i.id !== lineId);
        if (dup) {
          const quantity = Math.min(MAX_QTY, dup.quantity + item.quantity);
          set((s) => ({
            items: s.items.filter((i) => i.id !== lineId).map((i) => (i.id === dup.id ? { ...i, quantity } : i)),
          }));
          return { merged: true, intoLineId: dup.id, quantity };
        }
        set((s) => ({ items: s.items.map((i) => (i.id === lineId ? { ...item, id: lineId } : i)) }));
        return { merged: false };
      },
      setQuantity: (lineId, quantity) =>
        set((s) => ({
          items:
            quantity <= 0
              ? s.items.filter((i) => i.id !== lineId)
              : s.items.map((i) => (i.id === lineId ? { ...i, quantity: Math.min(MAX_QTY, quantity) } : i)),
        })),
      increment: (lineId) => {
        const i = get().items.find((x) => x.id === lineId);
        if (i) get().setQuantity(lineId, i.quantity + 1);
      },
      decrement: (lineId) => {
        const i = get().items.find((x) => x.id === lineId);
        if (i) get().setQuantity(lineId, i.quantity - 1);
      },
      remove: (lineId) => set((s) => ({ items: s.items.filter((i) => i.id !== lineId) })),
      reorder: (items) => {
        // Today's menu decides: sold-out lines are skipped, prices are re-read (see useReorder for
        // the toast that names what was skipped).
        for (const line of reorderableLines(items).lines) get().add(line);
      },
      setCoupon: (couponCode) => set({ couponCode }),
      setReward: (rewardId) => set({ rewardId }),
      clear: () => set({ items: [], couponCode: undefined, rewardId: undefined }),
    }),
    { name: STORAGE_KEYS.cart, storage: persistStorage },
  ),
);

export const useCartCount = () => useCart((s) => cartCount(s.items));
export const MAX_LINE_QTY = MAX_QTY;
