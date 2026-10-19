/**
 * Order status state machine (PRD §15). Only statuses relevant to the
 * selected ordering mode are shown.
 */
import type { OrderMode, OrderStatus } from '@/types/models';

export const STATUS_FLOW: Record<OrderMode, OrderStatus[]> = {
  dine_in: ['placed', 'accepted', 'preparing', 'ready', 'completed'],
  pickup: ['placed', 'accepted', 'preparing', 'ready', 'completed'],
  in_car: ['placed', 'accepted', 'preparing', 'ready', 'completed'],
  delivery: ['placed', 'accepted', 'preparing', 'out_for_delivery', 'completed'],
};

/** `icon` is a LineIcon glyph (custom set: dine-in table, pickup bag, car, delivery scooter). */
export const MODE_META: Record<OrderMode, { label: string; short: string; subtitle: string; icon: string }> = {
  dine_in: { label: 'Dine-In', short: 'Dine-In', subtitle: 'Order from your table, we bring it over', icon: 'dine-in' },
  pickup: { label: 'Pickup', short: 'Pickup', subtitle: 'Order ahead, skip the queue', icon: 'pickup' },
  in_car: { label: 'In-Car', short: 'In-Car', subtitle: 'We bring it out to your car', icon: 'car' },
  delivery: { label: 'Delivery', short: 'Delivery', subtitle: 'Delivered to your door', icon: 'delivery' },
};

export const ORDER_MODES: OrderMode[] = ['dine_in', 'pickup', 'in_car', 'delivery'];

export function statusLabel(status: OrderStatus, mode: OrderMode): string {
  switch (status) {
    case 'placed':
      return 'Order placed';
    case 'accepted':
      return 'Accepted';
    case 'preparing':
      return 'Preparing';
    case 'ready':
      if (mode === 'pickup') return 'Ready for pickup';
      // Short enough for one line on the 26pt status cards (Home, Orders).
      if (mode === 'in_car') return 'Ready to bring out';
      if (mode === 'dine_in') return 'Coming to your table';
      return 'Ready';
    case 'out_for_delivery':
      return 'Out for delivery';
    case 'completed':
      return mode === 'delivery' ? 'Delivered' : 'Completed';
    case 'cancelled':
      return 'Cancelled';
  }
}

/** One-line description of a status. `arrived`: the in-car customer has tapped "I'm here". */
export function statusDescription(status: OrderStatus, mode: OrderMode, arrived = false): string {
  switch (status) {
    case 'placed':
      return 'We’ve received your order.';
    case 'accepted':
      return 'The café has accepted your order.';
    case 'preparing':
      return 'Being made now.';
    case 'ready':
      // One place name, one artefact everywhere (checkout note, confirmation, tracking): the pickup bar + your code.
      if (mode === 'pickup') return 'Head to the pickup bar and show your code.';
      if (mode === 'in_car') {
        return arrived ? 'Got it. We’re bringing it out to your car now.' : 'Tap “I’m here” when you’ve parked and we’ll bring it out.';
      }
      if (mode === 'dine_in') return 'Sit tight — it’s coming to your table.';
      return 'Your order is ready.';
    case 'out_for_delivery':
      return 'Your courier is on the way.';
    case 'completed':
      return 'Thanks for ordering with us.';
    case 'cancelled':
      return 'This order was cancelled.';
  }
}

export function nextStatus(mode: OrderMode, current: OrderStatus): OrderStatus | null {
  if (current === 'cancelled' || current === 'completed') return null;
  const flow = STATUS_FLOW[mode];
  const idx = flow.indexOf(current);
  if (idx < 0 || idx >= flow.length - 1) return null;
  return flow[idx + 1];
}

export function isActiveStatus(status: OrderStatus): boolean {
  return status !== 'completed' && status !== 'cancelled';
}

export function canCancel(status: OrderStatus): boolean {
  return status === 'placed' || status === 'accepted';
}

/**
 * The status changes worth a `success` haptic (docs/HAPTICS.md): the order is ready for the customer,
 * or, for delivery (which has no "ready"), it has been delivered. Every other step is silent.
 */
export function isOrderOutcome(status: OrderStatus, mode: OrderMode): boolean {
  return status === 'ready' || (mode === 'delivery' && status === 'completed');
}

/** 0..1 progress through the mode's flow. Cancelled → 0. */
export function statusProgress(mode: OrderMode, status: OrderStatus): number {
  if (status === 'cancelled') return 0;
  const flow = STATUS_FLOW[mode];
  const idx = flow.indexOf(status);
  if (idx < 0) return 0;
  return idx / (flow.length - 1);
}

export function stepIndex(mode: OrderMode, status: OrderStatus): number {
  return STATUS_FLOW[mode].indexOf(status);
}

/** Base ETA in minutes per mode, from placing the order. */
export function baseEtaMinutes(mode: OrderMode, prepMinutes: number): number {
  return mode === 'delivery' ? prepMinutes + 18 : prepMinutes;
}
