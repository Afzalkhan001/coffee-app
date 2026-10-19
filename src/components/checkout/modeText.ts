/**
 * Copy + rules for the ordering context (mode, slot, table, car, address). Pure: no React.
 * Shared by cart, mode, address, checkout and confirmation.
 */
import { getProductSync } from '@/api';
import { effectivePickupTime, formatCount, formatMoney, formatTime, isValidPhone } from '@/lib/format';
import { distanceFromStoreKm, formatKm, isDeliverable } from '@/lib/geo';
import { MODE_META } from '@/lib/orderFlow';
import { TIP_MAX, TIP_MIN } from '@/lib/pricing';
import { brand } from '@/theme/brand';
import type { CarDetails, CartItem, OrderModeDetails } from '@/types/models';

/**
 * The slot id that is effectively selected, exactly as `createOrder` will place it: a stale, past
 * or off-grid stored slot falls back to ASAP (or, while the store is closed, the first slot).
 */
export function effectiveSlot(pickupTime: string | undefined): string {
  return effectivePickupTime(pickupTime);
}

/** "ASAP", "10:30 AM" or (while the store is closed) "Tomorrow, 7:10 AM". */
export function pickupTimeLabel(pickupTime: string | undefined): string {
  const slot = effectiveSlot(pickupTime);
  if (slot === 'asap') return 'ASAP';
  const today = new Date().toDateString() === new Date(slot).toDateString();
  return today ? formatTime(slot) : `Tomorrow, ${formatTime(slot)}`;
}

/** Prep estimate for the cart, matching how `createOrder` computes the ETA. */
export function cartPrepMinutes(items: Pick<CartItem, 'productId'>[]): number {
  if (items.length === 0) return brand.store.minPrepMinutes;
  return Math.max(...items.map((i) => getProductSync(i.productId)?.prepMinutes ?? 6));
}

export function isCarComplete(car: CarDetails | undefined): car is CarDetails {
  return !!car && car.make.trim().length > 0 && car.color.trim().length > 0 && car.plate.trim().length > 0;
}

/** "White Hyundai Creta · KA 03 MN 4521". */
export function carLabel(car: CarDetails | undefined): string | undefined {
  if (!car) return undefined;
  const name = [car.color.trim(), car.make.trim()].filter(Boolean).join(' ');
  const plate = car.plate.trim().toUpperCase();
  const text = [name, plate].filter(Boolean).join(' · ');
  return text || undefined;
}

/** The short detail after the mode name: "ASAP", "Patio", "Home", "10:30 AM · White Hyundai Creta". */
export function modeDetailLabel(details: OrderModeDetails): string {
  switch (details.mode) {
    case 'pickup':
      return pickupTimeLabel(details.pickupTime);
    case 'in_car': {
      const car = carLabel(details.car);
      return car ? `${pickupTimeLabel(details.pickupTime)} · ${car}` : pickupTimeLabel(details.pickupTime);
    }
    case 'dine_in':
      return details.table ?? 'Choose a table';
    case 'delivery':
      return details.address ? `${details.address.label} · ${details.address.line1}` : 'Add an address';
  }
}

/** "Pickup · ASAP", "Delivery · Home · Flat 4B, Sunrise Residency, 6th Cross". */
export function modeSummary(details: OrderModeDetails): string {
  return `${MODE_META[details.mode].label} · ${modeDetailLabel(details)}`;
}

/** Where the order happens: the store for pickup-style modes, the address for delivery. */
export function modeLocationLine(details: OrderModeDetails): string {
  if (details.mode === 'delivery') {
    const a = details.address;
    if (!a) return `We deliver within ${brand.store.deliveryRadiusKm} km of ${brand.store.shortName}`;
    return `${a.line1} · ${formatKm(distanceFromStoreKm(a))}`;
  }
  return `${brand.store.shortName} · ${brand.store.distanceKm.toFixed(1)} km away`;
}

/** Delivery fee copy for the mode sheet / address screen: "Delivery ₹40 · add ₹139 for free delivery". */
export function deliveryFeeNote(subtotal: number): string {
  const { deliveryFee, freeDeliveryOver } = brand.store;
  if (subtotal >= freeDeliveryOver) return 'Free delivery on this order';
  const more = freeDeliveryOver - subtotal;
  return `Delivery ${formatMoney(deliveryFee)} · add ${formatMoney(more)} for free delivery`;
}

// ── Checkout validation ─────────────────────────────────────────

export type CheckoutSection = 'details' | 'contact' | 'items' | 'savings' | 'tip' | 'payment';

export interface CheckoutIssue {
  section: CheckoutSection;
  /** Inline message on the section card. */
  message: string;
  /** Hint above the disabled primary bar. */
  hint: string;
}

export interface ContactDraft {
  name: string;
  phone: string;
}

/** What else can block an order besides the ordering context and contact. */
export interface CheckoutBlockers {
  /** First unavailable cart line ("Caffè Latte is sold out today"), from `cartLineIssue`. */
  lineIssue?: string | null;
  /** The redeemed reward costs more points than the account has. */
  rewardPoints?: number | null;
  /** "Other" tip that isn't ₹1–₹500 (delivery). */
  tipIssue?: string | null;
  /** The chosen payment can't be used yet (a missing or malformed UPI ID), from `vpaIssue`. */
  paymentIssue?: string | null;
}

/** The first thing stopping the order from being placed, or null when it's ready. */
export function checkoutIssue(details: OrderModeDetails, contact: ContactDraft, blockers: CheckoutBlockers = {}): CheckoutIssue | null {
  if (blockers.lineIssue) {
    return {
      section: 'items',
      message: `${blockers.lineIssue}. Remove it from your cart to continue.`,
      hint: 'Remove unavailable items to continue',
    };
  }
  switch (details.mode) {
    case 'delivery':
      if (!details.address) {
        return { section: 'details', message: 'Add a delivery address to continue.', hint: 'Add a delivery address to continue' };
      }
      if (!isDeliverable(details.address)) {
        return {
          section: 'details',
          message: `We don’t deliver to ${details.address.label} yet. Choose another address or switch to Pickup.`,
          hint: 'Choose an address we deliver to',
        };
      }
      break;
    case 'in_car':
      if (!isCarComplete(details.car)) {
        return {
          section: 'details',
          message: 'Add your car’s make, colour and plate so we can find you.',
          hint: 'Add your car details to continue',
        };
      }
      break;
    case 'dine_in':
      if (!details.table) {
        return { section: 'details', message: 'Choose where you’re sitting so we can bring it over.', hint: 'Choose a table to continue' };
      }
      break;
    case 'pickup':
      break;
  }
  if (!contact.name.trim()) {
    return { section: 'contact', message: 'Add a name for the order.', hint: 'Add your name to continue' };
  }
  if (!isValidPhone(contact.phone)) {
    return { section: 'contact', message: 'Add a 10-digit Indian mobile number we can text order updates to.', hint: 'Add a mobile number to continue' };
  }
  if (blockers.rewardPoints) {
    return {
      section: 'savings',
      message: `This reward needs ${formatCount(blockers.rewardPoints)} points. Remove it to continue.`,
      hint: 'Remove the reward to continue',
    };
  }
  if (blockers.tipIssue) {
    // Covers an empty and an over-the-limit amount alike (₹600 is "an amount", just not a valid one).
    return { section: 'tip', message: blockers.tipIssue, hint: `Tip ${formatMoney(TIP_MIN)}–${formatMoney(TIP_MAX)} or choose No tip` };
  }
  if (blockers.paymentIssue) {
    return { section: 'payment', message: blockers.paymentIssue, hint: 'Enter a valid UPI ID to continue' };
  }
  return null;
}
