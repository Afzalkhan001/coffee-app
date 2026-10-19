/**
 * Pure rules and copy for the live order pill (`LiveOrderPill`): where it may float, which order it
 * leads with, what it says and how full its cup is. No React; unit-tested.
 */
import { orderScheduledFor } from '@/api/mockDb';
import { minutesLeft, scheduledReadyLabel } from '@/components/domain/orderText';
import { pluralize } from '@/lib/format';
import { isActiveStatus, statusLabel, statusProgress } from '@/lib/orderFlow';
import type { Order, OrderStatus } from '@/types/models';

export interface PillRoute {
  /** The pill may float on this route at all. */
  show: boolean;
  /** The floating tab bar is at the bottom: rest above it. */
  tabBar: boolean;
  /** The screen shows the floating "View cart" bar while the cart has items: rest above that too. */
  cartBar: boolean;
}

const HIDDEN: PillRoute = { show: false, tabBar: false, cartBar: false };

/**
 * Routes where the pill stays away:
 *  - `/` (Home) and `/orders` already show these orders live (the Home strip, the Orders cards);
 *  - `/order/…`: tracking (and its receipt), the confirmation celebration and the invoice;
 *  - the ordering flow, whose bottom is its primary action: product, cart, checkout, the order-type
 *    sheet, the delivery address and payment;
 *  - onboarding and sign-in (never signed in there anyway).
 */
const HIDDEN_EXACT = new Set(['/', '/orders', '/cart', '/checkout', '/mode', '/address', '/payment', '/onboarding']);
const HIDDEN_PREFIX = ['/product/', '/order/', '/auth/'];
/** Tab screens (the floating tab bar sits at their bottom). */
const TAB_ROUTES = new Set(['/menu', '/rewards', '/profile']);
/** Screens that render `FloatingCartBar` while the cart has items. */
const CART_BAR_EXACT = new Set(['/menu', '/search', '/favorites']);
const CART_BAR_PREFIX = ['/category/'];

function normalize(pathname: string): string {
  const path = pathname.split(/[?#]/)[0] || '/';
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

/** The pill's rule for a route (`usePathname()`: groups like `(tabs)` are already stripped). */
export function pillRoute(pathname: string): PillRoute {
  const path = normalize(pathname);
  if (HIDDEN_EXACT.has(path) || HIDDEN_PREFIX.some((p) => path.startsWith(p))) return HIDDEN;
  return {
    show: true,
    tabBar: TAB_ROUTES.has(path),
    cartBar: CART_BAR_EXACT.has(path) || CART_BAR_PREFIX.some((p) => path.startsWith(p)),
  };
}

const BEFORE_READY: OrderStatus[] = ['placed', 'accepted', 'preparing'];

/**
 * When the order is (or will be) in the customer's hands, for "soonest first": a ready order is
 * waiting now, a scheduled one is due at its slot, the rest at placement + ETA.
 */
export function orderDueAt(order: Order): number {
  if (order.status === 'ready') return 0;
  const scheduled = orderScheduledFor(order);
  if (scheduled !== null && BEFORE_READY.includes(order.status)) return scheduled;
  return new Date(order.createdAt).getTime() + order.etaMinutes * 60_000;
}

/** Active orders, soonest first (ties: the older order first). */
export function soonestFirst(orders: Order[]): Order[] {
  return orders
    .filter((o) => isActiveStatus(o.status))
    .sort((a, b) => orderDueAt(a) - orderDueAt(b) || a.createdAt.localeCompare(b.createdAt));
}

/** Changes whenever an active order appears, leaves or changes status (re-shows a dismissed pill). */
export function pillSignature(orders: Pick<Order, 'id' | 'status'>[]): string {
  return orders
    .map((o) => `${o.id}:${o.status}`)
    .sort()
    .join('|');
}

/** Short status for the pill: "Preparing", "Ready for pickup", "On the way". */
export function pillTitle(order: Pick<Order, 'status' | 'details'>): string {
  if (order.status === 'out_for_delivery') return 'On the way';
  return statusLabel(order.status, order.details.mode);
}

export type PillEta = { kind: 'minutes'; minutes: number } | { kind: 'at'; label: string } | null;

/** The countdown after the status: whole minutes, a scheduled slot ("4:35 PM"), or none once ready. */
export function pillEta(order: Order, now: number): PillEta {
  if (!isActiveStatus(order.status) || order.status === 'ready') return null;
  const scheduled = BEFORE_READY.includes(order.status) ? scheduledReadyLabel(order) : null;
  if (scheduled) return { kind: 'at', label: scheduled };
  return { kind: 'minutes', minutes: minutesLeft(order, now) };
}

/** "2 orders" when there is more than one, else empty. */
export function pillCountLabel(count: number): string {
  return count > 1 ? pluralize(count, 'order') : '';
}

/**
 * How full the cup glyph is (0…1): a splash when the order is placed, stepping up with
 * `statusProgress`, and filled to just under the rim by "ready" (delivery: "on the way").
 */
export function cupLevel(order: Pick<Order, 'status' | 'details'>): number {
  const p = statusProgress(order.details.mode, order.status);
  return 0.16 + 0.68 * Math.min(1, p / 0.75);
}

/** Spoken label: "Order ER-4827, Preparing, about 4 minutes left. 2 active orders." */
export function pillA11yLabel(order: Order, count: number, now: number): string {
  const eta = pillEta(order, now);
  const when =
    eta === null
      ? ''
      : eta.kind === 'at'
        ? `, ready at ${eta.label}`
        : `, about ${pluralize(eta.minutes, 'minute')} left`;
  const more = count > 1 ? ` ${pluralize(count, 'active order')}.` : '';
  return `Order ${order.number}, ${pillTitle(order)}${when}.${more}`;
}
