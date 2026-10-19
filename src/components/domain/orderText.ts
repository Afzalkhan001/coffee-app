/** Copy helpers for order cards (pure; no React). */
import { orderScheduledFor } from '@/api/mockDb';
import { formatTime } from '@/lib/format';
import { summarizeModifiers } from '@/lib/modifiers';
import { STATUS_FLOW } from '@/lib/orderFlow';
import type { Order, OrderItem } from '@/types/models';

/**
 * The title split so a row can truncate the product name but never the count:
 * head "2× Caramel Macchiato", more "+ 1 more" (empty for a single line).
 */
export function orderTitleParts(order: Pick<Order, 'items'>): { head: string; more: string } {
  const [first, ...rest] = order.items;
  if (!first) return { head: 'Your order', more: '' };
  const head = first.quantity > 1 ? `${first.quantity}× ${first.name}` : first.name;
  return { head, more: rest.length > 0 ? `+ ${rest.length} more` : '' };
}

/** "Caramel Macchiato" / "Caramel Macchiato + 2 more" (quantities folded in: "2× Latte"). */
export function orderTitle(order: Pick<Order, 'items'>): string {
  const { head, more } = orderTitleParts(order);
  return more ? `${head} ${more}` : head;
}

/** "Caramel Macchiato · M · Oat milk + Croissant" — modifier short names for the first line. */
export function orderItemsSummary(items: OrderItem[]): string {
  return items
    .map((i) => {
      const mods = summarizeModifiers(
        i.modifiers.map((m) => ({ ...m, optionName: m.shortName ?? m.optionName })),
        ' · ',
      );
      const name = i.quantity > 1 ? `${i.quantity}× ${i.name}` : i.name;
      return mods ? `${name} · ${mods}` : name;
    })
    .join(' + ');
}

/** "Caramel Macchiato + Butter Croissant" (quantities folded in: "2× Latte"); no modifiers. */
export function orderItemNames(items: Pick<OrderItem, 'name' | 'quantity'>[]): string {
  return items.map((i) => (i.quantity > 1 ? `${i.quantity}× ${i.name}` : i.name)).join(' + ');
}

/** Item photos, one per line, for thumbnail stacks. */
export function orderImages(order: Pick<Order, 'items'>): string[] {
  return order.items.map((i) => i.image);
}

/** Minutes left until the ETA (never below 1 while active). */
export function minutesLeft(order: Pick<Order, 'createdAt' | 'etaMinutes'>, now: number): number {
  const due = new Date(order.createdAt).getTime() + order.etaMinutes * 60_000;
  return Math.max(1, Math.ceil((due - now) / 60_000));
}

/**
 * Honoured scheduled pickup time as "4:35 PM", or null for ASAP orders. Scheduled orders show
 * "Ready at 4:35 PM" instead of a minutes countdown until they are being prepared.
 */
export function scheduledReadyLabel(order: Order): string | null {
  const at = orderScheduledFor(order);
  return at === null ? null : formatTime(new Date(at).toISOString());
}

/** "Ready in ~8 min", "Ready at 4:35 PM", "Arrives in ~22 min", "Ready now"… */
export function etaLabel(order: Order, now: number): string {
  const delivery = order.details.mode === 'delivery';
  const scheduled = scheduledReadyLabel(order);
  if (scheduled && (order.status === 'placed' || order.status === 'accepted' || order.status === 'preparing')) {
    return `Ready at ${scheduled}`;
  }
  switch (order.status) {
    case 'ready':
      return delivery ? 'Heading out' : order.details.mode === 'pickup' ? 'Ready at the bar' : 'Ready now';
    case 'out_for_delivery':
      return `Arriving in ~${minutesLeft(order, now)} min`;
    case 'completed':
      return delivery ? 'Delivered' : 'Picked up';
    case 'cancelled':
      return 'Cancelled';
    default:
      return `${delivery ? 'Arrives' : 'Ready'} in ~${minutesLeft(order, now)} min`;
  }
}

/** Index of the current status within its mode's flow (0-based; -1 when cancelled). */
export function flowPosition(order: Pick<Order, 'status' | 'details'>): { index: number; total: number } {
  const flow = STATUS_FLOW[order.details.mode];
  return { index: flow.indexOf(order.status), total: flow.length };
}
