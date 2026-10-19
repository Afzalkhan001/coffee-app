/**
 * In-device "server" for the prototype. Persisted so orders, profiles and
 * loyalty survive reloads. Everything here is replaced by Supabase tables
 * (profiles, orders, order_items, payments, loyalty_*) later.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage, STORAGE_KEYS } from '@/lib/storage';
import type { LoyaltyTransaction, Order, Profile } from '@/types/models';

export interface LoyaltyAccount {
  balance: number;
  lifetime: number;
  transactions: LoyaltyTransaction[];
}

/**
 * Server-side order record: the public `Order` plus fields the screens don't need. `ownerPhone` is
 * the signed-in account that placed the order (immutable) — ownership, history and loyalty are
 * keyed on it, never on `customer.phone`, which is only the editable contact number for SMS.
 * `scheduledFor` is the honoured pickup slot (ISO) when the order was scheduled for later.
 * (Older persisted orders have neither: they fall back to `customer.phone` / ASAP.)
 */
export type OrderRecord = Order & {
  ownerPhone?: string;
  scheduledFor?: string;
  /** Demo history seeded at sign-up — shown in history/reorder but never counts as a real first order. */
  demoSeed?: boolean;
};

/** True for orders the customer actually placed (not seeded demo history). */
export function isRealOrder(order: Order): boolean {
  return !(order as OrderRecord).demoSeed;
}

/** The account that owns an order. */
export function orderOwner(order: Order): string {
  return (order as OrderRecord).ownerPhone ?? order.customer.phone;
}

/** Epoch ms of an honoured scheduled pickup slot, or null for ASAP orders. */
export function orderScheduledFor(order: Order): number | null {
  const at = (order as OrderRecord).scheduledFor;
  if (!at) return null;
  const t = new Date(at).getTime();
  return Number.isFinite(t) ? t : null;
}

export interface OtpSession {
  phone: string;
  code: string;
  sentAt: number;
  expiresAt: number;
  resendAt: number;
}

interface MockDbState {
  profiles: Record<string, Profile>;
  orders: Order[];
  loyalty: Record<string, LoyaltyAccount>;
  otp: OtpSession | null;
  /** orderId → epoch ms when the simulator should advance the status next. */
  sim: Record<string, number>;
}

export const EMPTY_LOYALTY: LoyaltyAccount = { balance: 0, lifetime: 0, transactions: [] };

export const useMockDb = create<MockDbState>()(
  persist(
    (): MockDbState => ({
      profiles: {},
      orders: [],
      loyalty: {},
      otp: null,
      sim: {},
    }),
    {
      name: STORAGE_KEYS.db,
      storage: persistStorage,
      // The OTP session is persisted too: a web refresh on the OTP screen must still accept the code
      // its timers say is valid.
      partialize: (s) => ({ profiles: s.profiles, orders: s.orders, loyalty: s.loyalty, sim: s.sim, otp: s.otp }),
    },
  ),
);

export const db = {
  get: () => useMockDb.getState(),
  set: (partial: Partial<MockDbState> | ((s: MockDbState) => Partial<MockDbState>)) => useMockDb.setState(partial),

  updateOrder(id: string, patch: Partial<Order> | ((o: Order) => Partial<Order>)) {
    useMockDb.setState((s) => ({
      orders: s.orders.map((o) => (o.id === id ? { ...o, ...(typeof patch === 'function' ? patch(o) : patch) } : o)),
    }));
  },

  loyaltyFor(phone: string): LoyaltyAccount {
    return useMockDb.getState().loyalty[phone] ?? EMPTY_LOYALTY;
  },

  /**
   * Applies a loyalty transaction. A redeem that the balance can't cover is rejected (returns false)
   * instead of being clamped to 0 — that clamp made unaffordable rewards free. Only earned and bonus
   * points count toward `lifetime` (the tier); pass `{ lifetime: false }` for refunds, so a
   * redeem → cancel cycle doesn't inflate it.
   */
  addLoyalty(phone: string, txn: LoyaltyTransaction, opts: { lifetime?: boolean } = {}): boolean {
    const acc = useMockDb.getState().loyalty[phone] ?? EMPTY_LOYALTY;
    if (txn.points < 0 && acc.balance + txn.points < 0) return false;
    const countsLifetime = opts.lifetime ?? (txn.type === 'earn' || txn.type === 'bonus');
    useMockDb.setState((s) => {
      const cur = s.loyalty[phone] ?? EMPTY_LOYALTY;
      const balance = cur.balance + txn.points;
      const lifetime = countsLifetime && txn.points > 0 ? cur.lifetime + txn.points : cur.lifetime;
      return {
        loyalty: { ...s.loyalty, [phone]: { balance, lifetime, transactions: [txn, ...cur.transactions] } },
      };
    });
    return true;
  },

  reset() {
    useMockDb.setState({ profiles: {}, orders: [], loyalty: {}, otp: null, sim: {} });
  },
};
