import { useEffect, useState } from 'react';
import { useMockDb } from '@/api/mockDb';
import { purgeLegacyStorage } from '@/lib/storage';
import { useCart } from './cart';
import { useDemo } from './demo';
import { useFavorites } from './favorites';
import { useSession } from './session';

const stores = [useSession, useCart, useDemo, useMockDb, useFavorites] as const;

/** If storage ever rejects, persist.hasHydrated() stays false forever — don't hang the splash. */
const HYDRATION_TIMEOUT_MS = 2500;

/** True once every persisted store has rehydrated from AsyncStorage. */
export function useStoresHydrated(): boolean {
  const [ready, setReady] = useState(() => stores.every((s) => s.persist.hasHydrated()));
  useEffect(() => {
    if (ready) return;
    const check = () => {
      if (stores.every((s) => s.persist.hasHydrated())) setReady(true);
    };
    const unsubs = stores.map((s) => s.persist.onFinishHydration(check));
    const timeout = setTimeout(() => setReady(true), HYDRATION_TIMEOUT_MS);
    check();
    return () => {
      unsubs.forEach((u) => u());
      clearTimeout(timeout);
    };
  }, [ready]);
  // Once the v2 stores are loaded, drop the v1 (USD / US phone) data the key bump left behind.
  useEffect(() => {
    if (ready) void purgeLegacyStorage();
  }, [ready]);
  return ready;
}
