import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SEED_ADDRESSES } from '@/data/mock/marketing';
import { replaceAddress, upgradeLegacySeeds } from '@/lib/address';
import { registerAuthRouteReader } from '@/lib/authRoute';
import { effectivePickupTime } from '@/lib/format';
import { configureHaptics } from '@/lib/haptics';
import { persistStorage, STORAGE_KEYS } from '@/lib/storage';
import { applyNativeAppearance, sanitizeAppearance, type AppearancePreference } from '@/theme/appearance';
import { useCart } from './cart';
import type {
  Address,
  CarDetails,
  NotificationPrefs,
  OrderMode,
  OrderModeDetails,
  PermissionState,
  Profile,
} from '@/types/models';

interface SessionState {
  hasHydrated: boolean;
  /** Onboarding */
  onboardingDone: boolean;
  locationPermission: PermissionState;
  notificationPermission: PermissionState;
  notificationPrefs: NotificationPrefs;
  /** Auth */
  phone: string | null;
  profile: Profile | null;
  /** The last account that signed in on this device (kept after sign-out). */
  lastPhone: string | null;
  /**
   * App route opened by a deep link while signed out (e.g. /product/latte). Not persisted; the
   * app pushes it once after sign-in (see `takePendingHref`).
   */
  pendingHref: string | null;
  /** Ordering context */
  mode: OrderMode;
  table?: string;
  pickupTime: 'asap' | string;
  car?: CarDetails;
  addresses: Address[];
  selectedAddressId?: string;
  recentSearches: string[];
  /**
   * Settings "Haptics" switch (default on). A device preference: kept across sign-out and the demo
   * reset. Persisted v2 sessions without it hydrate to `true` (zustand's shallow merge keeps the default).
   */
  hapticsEnabled: boolean;
  /**
   * Settings "Appearance" (System / Light / Dark, default System). A device preference like
   * `hapticsEnabled`: kept across sign-out and the demo reset; v2 sessions saved before it existed
   * hydrate to `system` (zustand's shallow merge keeps the default).
   */
  appearance: AppearancePreference;

  setHydrated: () => void;
  setLocationPermission: (p: PermissionState) => void;
  setNotificationPermission: (p: PermissionState) => void;
  setNotificationPrefs: (p: Partial<NotificationPrefs>) => void;
  completeOnboarding: () => void;
  signIn: (phone: string, profile: Profile | null) => void;
  setProfile: (profile: Profile) => void;
  signOut: () => void;
  setMode: (mode: OrderMode) => void;
  setTable: (table?: string) => void;
  setPickupTime: (t: 'asap' | string) => void;
  setCar: (car?: CarDetails) => void;
  addAddress: (a: Address) => void;
  /** Replaces a saved address in place (same id, same position); the selection is unchanged. */
  updateAddress: (a: Address) => void;
  removeAddress: (id: string) => void;
  selectAddress: (id?: string) => void;
  pushRecentSearch: (q: string) => void;
  clearRecentSearches: () => void;
  setPendingHref: (href: string | null) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setAppearance: (appearance: AppearancePreference) => void;
  resetAll: () => void;
}

const initial = {
  onboardingDone: false,
  locationPermission: 'undetermined' as PermissionState,
  notificationPermission: 'undetermined' as PermissionState,
  notificationPrefs: { orderUpdates: true, marketing: false },
  phone: null,
  profile: null,
  lastPhone: null,
  pendingHref: null,
  mode: 'pickup' as OrderMode,
  table: undefined,
  pickupTime: 'asap' as const,
  car: undefined,
  addresses: SEED_ADDRESSES,
  selectedAddressId: undefined,
  recentSearches: ['latte', 'croissant'],
};

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      hasHydrated: false,
      ...initial,
      hapticsEnabled: true,
      appearance: 'system' as AppearancePreference,
      setHydrated: () => set({ hasHydrated: true }),
      setLocationPermission: (locationPermission) => set({ locationPermission }),
      setNotificationPermission: (notificationPermission) => set({ notificationPermission }),
      setNotificationPrefs: (p) => set((s) => ({ notificationPrefs: { ...s.notificationPrefs, ...p } })),
      completeOnboarding: () => set({ onboardingDone: true }),
      signIn: (phone, profile) =>
        set((s) => {
          if (s.lastPhone === null || s.lastPhone === phone) return { phone, profile, lastPhone: phone };
          // A different account on this device: don't carry the previous customer's car, addresses,
          // table, searches or cart (with its reward / coupon) into it.
          useCart.getState().clear();
          return {
            phone,
            profile,
            lastPhone: phone,
            table: undefined,
            car: undefined,
            pickupTime: 'asap',
            addresses: SEED_ADDRESSES,
            selectedAddressId: undefined,
            recentSearches: initial.recentSearches,
          };
        }),
      setProfile: (profile) => set({ profile }),
      signOut: () => {
        // A redeemed reward or coupon belongs to this account's session: never leave it in the cart
        // for whoever signs in next (it would be redeemed against their points / first order).
        const cart = useCart.getState();
        cart.setReward(undefined);
        cart.setCoupon(undefined);
        set((s) => ({ phone: null, profile: null, lastPhone: s.phone ?? s.lastPhone }));
      },
      setMode: (mode) => set({ mode }),
      setTable: (table) => set({ table }),
      setPickupTime: (pickupTime) => set({ pickupTime }),
      setCar: (car) => set({ car }),
      addAddress: (a) => set((s) => ({ addresses: [a, ...s.addresses.filter((x) => x.id !== a.id)], selectedAddressId: a.id })),
      updateAddress: (a) => set((s) => ({ addresses: replaceAddress(s.addresses, a) })),
      removeAddress: (id) =>
        set((s) => ({
          addresses: s.addresses.filter((a) => a.id !== id),
          selectedAddressId: s.selectedAddressId === id ? undefined : s.selectedAddressId,
        })),
      selectAddress: (selectedAddressId) => set({ selectedAddressId }),
      pushRecentSearch: (q) =>
        set((s) => {
          const t = q.trim();
          if (!t) return s;
          return { recentSearches: [t, ...s.recentSearches.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 6) };
        }),
      clearRecentSearches: () => set({ recentSearches: [] }),
      setPendingHref: (pendingHref) => set({ pendingHref }),
      setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
      setAppearance: (appearance) => set({ appearance: sanitizeAppearance(appearance) }),
      // `initial` leaves out hapticsEnabled and appearance: device preferences survive the reset.
      resetAll: () => set({ ...initial }),
    }),
    {
      name: STORAGE_KEYS.session,
      storage: persistStorage,
      partialize: ({ hasHydrated: _h, pendingHref: _p, ...rest }) =>
        Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== 'function')) as Partial<SessionState>,
      onRehydrateStorage: () => (state) => {
        // A device that ran an earlier v2 build still has the unstructured demo seeds: swap in
        // today's structured ones (landmark, Work label) before any screen reads them.
        if (state) {
          const upgraded = upgradeLegacySeeds(state.addresses ?? SEED_ADDRESSES, SEED_ADDRESSES);
          if (upgraded !== state.addresses) useSession.setState({ addresses: upgraded });
        }
        state?.setHydrated();
      },
    },
  ),
);

/** Current ordering context, assembled for checkout/createOrder. */
export function selectModeDetails(s: SessionState): OrderModeDetails {
  const address = s.addresses.find((a) => a.id === s.selectedAddressId);
  switch (s.mode) {
    case 'dine_in':
      return { mode: 'dine_in', table: s.table };
    case 'pickup':
      return { mode: 'pickup', pickupTime: effectivePickupTime(s.pickupTime) };
    case 'in_car':
      return { mode: 'in_car', car: s.car, pickupTime: effectivePickupTime(s.pickupTime) };
    case 'delivery':
      return { mode: 'delivery', address };
  }
}

export const useIsSignedIn = () => useSession((s) => !!s.phone && !!s.profile);

// The haptics module reads the switch synchronously on every call: mirror it now, on hydration and on change.
configureHaptics({ enabled: useSession.getState().hapticsEnabled !== false });
useSession.subscribe((s) => configureHaptics({ enabled: s.hapticsEnabled !== false }));

// iOS native chrome (keyboard, alerts) follows the Appearance choice: now, on hydration and on change.
applyNativeAppearance(sanitizeAppearance(useSession.getState().appearance));
useSession.subscribe((s) => applyNativeAppearance(sanitizeAppearance(s.appearance)));

/** The persisted Appearance preference, sanitised (the root layout feeds it to `<ThemeProvider>`). */
export const useAppearance = () => useSession((s) => sanitizeAppearance(s.appearance));

registerAuthRouteReader(() => {
  const s = useSession.getState();
  return { onboardingDone: s.onboardingDone, signedIn: !!s.phone && !!s.profile };
});

/** Deep-link targets worth restoring after sign-in. */
const RESTORABLE = /^\/(product|category|order)\//;

/** Remember an app route opened while signed out (no-op for anything else). */
export function rememberPendingHref(path: string | null | undefined) {
  if (path && RESTORABLE.test(path)) useSession.getState().setPendingHref(path);
}

/** Read-once: the pending deep-link route, cleared as it is taken. */
export function takePendingHref(): string | null {
  const href = useSession.getState().pendingHref;
  if (href) useSession.getState().setPendingHref(null);
  return href;
}
