import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

/** Shared persistence for zustand stores (AsyncStorage; localStorage on web). */
export const persistStorage = createJSONStorage(() => AsyncStorage);

/**
 * Persisted store keys. v2 = the India (INR / +91 / Bengaluru) data model: bumping every key makes
 * the app start fresh instead of reading v1 USD carts, orders and US phone numbers as rupees.
 * Bump again whenever persisted money, phone or address shapes change meaning.
 */
export const STORAGE_KEYS = {
  session: 'ember.session.v2',
  cart: 'ember.cart.v2',
  demo: 'ember.demo.v2',
  db: 'ember.mockdb.v2',
  /** Favourite product ids + the "Veg only" filter (new in v2; no v1 predecessor). */
  favorites: 'ember.favorites.v2',
} as const;

/** Keys of earlier persisted data models (v1: USD prices, US phone numbers, the US café). */
export const LEGACY_STORAGE_KEYS: readonly string[] = ['ember.session.v1', 'ember.cart.v1', 'ember.demo.v1', 'ember.mockdb.v1'];

let legacyPurge: Promise<void> | null = null;

/**
 * Deletes the stores of earlier data models, so the v1 carts, orders and phone numbers the key bump
 * stopped reading don't linger on the device. Once per launch (called after hydration), best
 * effort: never throws or rejects.
 */
export function purgeLegacyStorage(): Promise<void> {
  legacyPurge ??= Promise.resolve()
    .then(() => AsyncStorage.multiRemove([...LEGACY_STORAGE_KEYS]))
    .catch(() => undefined);
  return legacyPurge;
}
