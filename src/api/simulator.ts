/**
 * Prototype-only: advances paid orders through their mode's status flow,
 * standing in for the café dashboard + Supabase Realtime.
 *
 * The pace and the ETA come from ONE timeline, so the countdown ring, "Ready in ~6 min" and the
 * real status change always agree:
 *   placed → accepted → preparing after one / two short steps, then ready (or arrived, for delivery)
 *   exactly when the ETA runs out; delivery hands over to the courier part-way; ready → completed
 *   lingers 1.8 steps.
 * Default: the real quote (`baseEtaMinutes`: the slowest item's prep, +18 min for delivery).
 * "Fast statuses" (Settings → Demo tools) compresses the whole timeline AND the ETA to seconds.
 * A scheduled pickup slot is honoured: preparing starts one prep-time before the slot and the order
 * is ready at the slot.
 */
import { PRODUCTS } from '@/data/mock/menu';
import { uid } from '@/lib/format';
import { baseEtaMinutes, nextStatus } from '@/lib/orderFlow';
import { useDemo } from '@/store/demo';
import type { Order, OrderMode, OrderStatus } from '@/types/models';
import { db, orderOwner, orderScheduledFor } from './mockDb';

type Listener = (order: Order, status: OrderStatus) => void;
const listeners = new Set<Listener>();

/** Subscribe to status changes (used for local notifications + haptics). */
export function onOrderStatusChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const MIN = 60_000;

function fast(): boolean {
  return useDemo.getState().fastStatus;
}

/** One early step (placed → accepted, accepted → preparing, ready → completed linger base). */
export function stepMs(): number {
  return fast() ? 3000 : 8000;
}

/**
 * Minutes from payment until the order is ready (pickup, in-car, dine-in) or arrives (delivery).
 * Fast mode returns a fraction of a minute (seconds); format with `minutesLeft` / `countdown`.
 */
export function demoEtaMinutes(mode: OrderMode, prepMinutes: number): number {
  if (fast()) return (mode === 'delivery' ? 4.8 * 3000 : 3 * 3000) / MIN;
  return baseEtaMinutes(mode, prepMinutes);
}

/** Whole minutes to quote before the order exists (checkout "ASAP · ~6 min"), matching the timeline. */
export function quotedEtaMinutes(mode: OrderMode, prepMinutes: number): number {
  return Math.max(1, Math.ceil(demoEtaMinutes(mode, prepMinutes)));
}

/** Prep minutes for a set of lines: the slowest item (what the café quotes). */
export function prepMinutesFor(items: { productId: string }[]): number {
  return Math.max(1, ...items.map((i) => PRODUCTS.find((p) => p.id === i.productId)?.prepMinutes ?? 6));
}

/** Real prep time for the order's items, used for scheduled pickups. */
function prepMs(order: Order): number {
  return prepMinutesFor(order.items) * MIN;
}

/** Epoch ms when the order is due ready / delivered (createdAt + etaMinutes). */
function etaDue(order: Order): number {
  return new Date(order.createdAt).getTime() + order.etaMinutes * MIN;
}

export function scheduleNextAdvance(orderId: string, delayMs = stepMs()) {
  db.set((s) => ({ sim: { ...s.sim, [orderId]: Date.now() + delayMs } }));
}

/** When to advance out of `status` (just reached), per the order's timeline. */
function nextDue(order: Order, status: OrderStatus, now: number): number {
  const step = stepMs();
  const delivery = order.details.mode === 'delivery';
  const due = etaDue(order);
  const slot = fast() ? null : orderScheduledFor(order);
  switch (status) {
    case 'accepted':
      // Scheduled: start preparing one prep-time before the slot (never before the next step).
      return slot !== null ? Math.max(now + step, slot - prepMs(order)) : now + step;
    case 'preparing':
      // Ready exactly at the ETA; delivery hands over to the courier a little after half way.
      if (delivery) return Math.max(now + step, now + (due - now) * 0.45);
      return Math.max(now + step, due);
    case 'out_for_delivery':
      return Math.max(now + step, due);
    case 'ready':
      return now + step * 1.8;
    default:
      return now + step;
  }
}

function advance(order: Order) {
  const { mode } = order.details;

  // In-car orders wait at "ready" until the customer taps "I'm here".
  if (order.status === 'ready' && mode === 'in_car' && !order.arrived) {
    db.set((s) => {
      const { [order.id]: _, ...sim } = s.sim;
      return { sim };
    });
    return;
  }

  const next = nextStatus(mode, order.status);
  if (!next) return;
  const now = Date.now();
  const at = new Date(now).toISOString();
  db.updateOrder(order.id, (o) => ({ status: next, history: [...o.history, { status: next, at }] }));

  if (next === 'completed') {
    db.set((s) => {
      const { [order.id]: _, ...sim } = s.sim;
      return { sim };
    });
    db.addLoyalty(orderOwner(order), {
      id: uid('lt'),
      type: 'earn',
      points: order.pointsEarned,
      description: `Order ${order.number}`,
      createdAt: at,
      orderId: order.id,
    });
  } else {
    const due = nextDue(order, next, now);
    db.set((s) => ({ sim: { ...s.sim, [order.id]: due } }));
  }

  const updated = db.get().orders.find((o) => o.id === order.id);
  if (updated) listeners.forEach((fn) => fn(updated, next));
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startOrderSimulator() {
  if (timer) return;
  timer = setInterval(() => {
    const { sim, orders } = db.get();
    const now = Date.now();
    for (const [id, due] of Object.entries(sim)) {
      if (due > now) continue;
      const order = orders.find((o) => o.id === id);
      if (!order || order.status === 'completed' || order.status === 'cancelled') {
        db.set((s) => {
          const { [id]: _, ...rest } = s.sim;
          return { sim: rest };
        });
        continue;
      }
      advance(order);
    }
  }, 500);
}

export function stopOrderSimulator() {
  if (timer) clearInterval(timer);
  timer = null;
}
