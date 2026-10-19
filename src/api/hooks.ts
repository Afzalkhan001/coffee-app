/**
 * React hooks over the data layer. Live order data is read reactively from
 * the mock store (Supabase Realtime subscriptions later).
 */
import { useCallback, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { isActiveStatus } from '@/lib/orderFlow';
import { useCart } from '@/store/cart';
import { useSession } from '@/store/session';
import type { Order, Reward } from '@/types/models';
import { getRewardSync, rewardDiscountFor, rewardHint } from './index';
import { EMPTY_LOYALTY, orderOwner, useMockDb } from './mockDb';
import { formatCount } from '@/lib/format';

export interface AsyncState<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
  reload: () => void;
}

/**
 * Minimal async loader with retry, used for catalog reads. `loading` starts true; `reload()` flips it
 * back on (and clears the error) in the same update that re-runs the load, so a retry shows the
 * skeleton instead of the stale error. Changing `deps` re-runs the load quietly: the previous data
 * (or error) stays on screen until the new result lands, and a success clears an old error.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<Error>();
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    fn()
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError(undefined);
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => {
    setLoading(true);
    setError(undefined);
    setNonce((n) => n + 1);
  }, []);
  return { data, error, loading, reload };
}

/** All of the signed-in customer's orders that have been confirmed (paid or pay-at-store). */
export function useMyOrders(): Order[] {
  const phone = useSession((s) => s.phone);
  return useMockDb(
    useShallow((s) =>
      s.orders.filter((o) => orderOwner(o) === phone && o.history.length > 0),
    ),
  );
}

export function useActiveOrders(): Order[] {
  return useMyOrders().filter((o) => isActiveStatus(o.status));
}

/**
 * Number of active orders as a primitive — use this for badges (tab bar) so a status tick doesn't
 * re-render the consumer with a new array.
 */
export function useActiveOrderCount(): number {
  const phone = useSession((s) => s.phone);
  return useMockDb(
    (s) => s.orders.filter((o) => orderOwner(o) === phone && o.history.length > 0 && isActiveStatus(o.status)).length,
  );
}

export interface CartRewardState {
  reward: Reward | undefined;
  /** The signed-in account has the points for it. */
  affordable: boolean;
  /** What it takes off this cart (0 when not affordable or nothing eligible). */
  discount: number;
  /** "Add a pastry to use this reward" / "You need 600 points for this reward", or null. */
  warning: string | null;
}

/** The cart's reward, checked against the user's points and the basket (Q-04, Q-24). */
export function useCartReward(): CartRewardState {
  const rewardId = useCart((s) => s.rewardId);
  const items = useCart((s) => s.items);
  const balance = useLoyalty().balance;
  const reward = getRewardSync(rewardId);
  if (!reward) return { reward: undefined, affordable: true, discount: 0, warning: null };
  const affordable = balance >= reward.cost;
  if (!affordable) {
    return { reward, affordable, discount: 0, warning: `You need ${formatCount(reward.cost)} points for this reward` };
  }
  return { reward, affordable, discount: rewardDiscountFor(rewardId, items).discount, warning: rewardHint(rewardId, items) };
}

export function useOrder(id: string | undefined): Order | undefined {
  return useMockDb((s) => s.orders.find((o) => o.id === id));
}

export function useLoyalty() {
  const phone = useSession((s) => s.phone);
  return useMockDb((s) => (phone ? s.loyalty[phone] : undefined) ?? EMPTY_LOYALTY);
}
