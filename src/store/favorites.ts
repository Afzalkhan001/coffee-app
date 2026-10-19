/**
 * Favourites + the "Veg only" browse filter (persisted, `ember.favorites.v2`).
 *
 * - `ids`: favourite product ids, most recent first. They belong to the account that saved them
 *   (`owner`, the bare 10-digit phone): a different number signing in on this device starts with
 *   none, like its cart and addresses (session `signIn`). Signing out keeps them for the same number.
 * - `vegOnly`: a device preference for Menu, Category and Search (Indian "pure veg" filter: only
 *   items marked `diet: 'veg'`). It survives sign-out; Reset demo clears both.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage, STORAGE_KEYS } from '@/lib/storage';
import { useSession } from './session';

/** Most favourites kept (the oldest drop off): plenty for one café's menu, bounded for storage. */
export const MAX_FAVORITES = 60;

export interface FavoritesData {
  ids: string[];
  vegOnly: boolean;
  owner: string | null;
}

interface FavoritesState extends FavoritesData {
  /** Adds or removes a favourite; returns whether the product is a favourite afterwards. */
  toggle: (productId: string) => boolean;
  remove: (productId: string) => void;
  setVegOnly: (vegOnly: boolean) => void;
  /** Binds the favourites to the signed-in number; a different number starts empty. */
  claim: (phone: string) => void;
  /** Reset demo: no favourites, Veg only off, no owner. */
  reset: () => void;
}

const EMPTY: FavoritesData = { ids: [], vegOnly: false, owner: null };

/** `ids` with `productId` added at the front (capped), or removed if it was there. */
export function toggleFavoriteId(ids: readonly string[], productId: string): string[] {
  if (ids.includes(productId)) return ids.filter((id) => id !== productId);
  return [productId, ...ids].slice(0, MAX_FAVORITES);
}

/**
 * Whatever storage held, as valid favourites data: unique string ids (capped), a boolean filter and
 * a string-or-null owner. Anything unreadable falls back to the empty defaults.
 */
export function sanitizeFavorites(raw: unknown): FavoritesData {
  if (!raw || typeof raw !== 'object') return { ...EMPTY };
  const r = raw as Partial<Record<keyof FavoritesData, unknown>>;
  const ids = Array.isArray(r.ids) ? [...new Set(r.ids.filter((id): id is string => typeof id === 'string' && id.length > 0))] : [];
  return {
    ids: ids.slice(0, MAX_FAVORITES),
    vegOnly: r.vegOnly === true,
    owner: typeof r.owner === 'string' && r.owner.length > 0 ? r.owner : null,
  };
}

export const useFavorites = create<FavoritesState>()(
  persist(
    (set, get) => ({
      ...EMPTY,
      toggle: (productId) => {
        const ids = toggleFavoriteId(get().ids, productId);
        set({ ids });
        return ids.includes(productId);
      },
      remove: (productId) => set((s) => ({ ids: s.ids.filter((id) => id !== productId) })),
      setVegOnly: (vegOnly) => set({ vegOnly }),
      claim: (phone) =>
        set((s) => {
          if (s.owner === phone) return s;
          // Another account's favourites never carry over; a first claim keeps what's there.
          return s.owner === null ? { owner: phone } : { owner: phone, ids: [] };
        }),
      reset: () => set({ ...EMPTY }),
    }),
    {
      name: STORAGE_KEYS.favorites,
      storage: persistStorage,
      version: 0,
      partialize: ({ ids, vegOnly, owner }) => ({ ids, vegOnly, owner }),
      merge: (persisted, current) => ({ ...current, ...sanitizeFavorites(persisted) }),
    },
  ),
);

/** Whether a product is a favourite (re-renders only when that answer changes). */
export const useIsFavorite = (productId: string) => useFavorites((s) => s.ids.includes(productId));
export const useFavoriteIds = () => useFavorites((s) => s.ids);
export const useVegOnly = () => useFavorites((s) => s.vegOnly);

// Follow the session: Reset demo (the onboarding flag drops) clears everything; a sign-in binds the
// favourites to that number (a different number starts empty).
useSession.subscribe((s, prev) => {
  if (prev.onboardingDone && !s.onboardingDone) {
    useFavorites.getState().reset();
    return;
  }
  if (s.phone && s.phone !== prev.phone) useFavorites.getState().claim(s.phone);
});
