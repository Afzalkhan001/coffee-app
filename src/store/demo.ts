import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage, STORAGE_KEYS } from '@/lib/storage';
import { registerForceOpenReader } from '@/lib/storeHours';

/** Prototype-only demo controls (Settings → Demo tools). */
interface DemoState {
  /** Make every API call reject with a network error. */
  offline: boolean;
  /** Advance order statuses every ~3s instead of ~9s. */
  fastStatus: boolean;
  /** Artificial API latency in ms. */
  latencyMs: number;
  /**
   * Keep the store open outside its real hours so a demo works at any time of day. While forcing
   * outside hours the status reads "Open late (demo)" (never a false "until 9pm").
   */
  forceStoreOpen: boolean;
  setOffline: (v: boolean) => void;
  setFastStatus: (v: boolean) => void;
  setForceStoreOpen: (v: boolean) => void;
}

export const useDemo = create<DemoState>()(
  persist(
    (set) => ({
      offline: false,
      fastStatus: false,
      latencyMs: 450,
      forceStoreOpen: true,
      setOffline: (offline) => set({ offline }),
      setFastStatus: (fastStatus) => set({ fastStatus }),
      setForceStoreOpen: (forceStoreOpen) => set({ forceStoreOpen }),
    }),
    { name: STORAGE_KEYS.demo, storage: persistStorage },
  ),
);

registerForceOpenReader(() => useDemo.getState().forceStoreOpen);
