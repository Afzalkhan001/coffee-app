/**
 * Pure pricing (PRD §11–13). All money math goes through `roundMoney` (the currency's minor unit:
 * whole rupees for INR, half up), so totals never drift and never carry paise.
 */
import { brand, formatMoney, roundMoney, TAX_LINE_LABEL } from '@/theme/brand';
import type { CartItem, Coupon, OrderMode, OrderTotals, SelectedModifierSnapshot } from '@/types/models';
import { modifiersDelta } from './modifiers';

export { roundMoney };

export function unitPrice(basePrice: number, snapshots: SelectedModifierSnapshot[]): number {
  return roundMoney(basePrice + modifiersDelta(snapshots));
}

export function lineTotal(item: Pick<CartItem, 'basePrice' | 'modifiers' | 'quantity'>): number {
  return roundMoney(unitPrice(item.basePrice, item.modifiers) * item.quantity);
}

export function cartSubtotal(items: Pick<CartItem, 'basePrice' | 'modifiers' | 'quantity'>[]): number {
  return roundMoney(items.reduce((sum, i) => sum + lineTotal(i), 0));
}

export function cartCount(items: Pick<CartItem, 'quantity'>[]): number {
  return items.reduce((n, i) => n + i.quantity, 0);
}

export type CouponCheck =
  | { ok: true; discount: number }
  | { ok: false; reason: 'inactive' | 'min_subtotal'; message: string };

export function evaluateCoupon(coupon: Coupon, subtotal: number): CouponCheck {
  if (!coupon.isActive) return { ok: false, reason: 'inactive', message: 'This code has expired.' };
  if (coupon.minSubtotal != null && subtotal < coupon.minSubtotal) {
    return {
      ok: false,
      reason: 'min_subtotal',
      message: `Add ${formatMoney(coupon.minSubtotal - subtotal)} more to use this code.`,
    };
  }
  let discount = coupon.type === 'percent' ? (subtotal * coupon.value) / 100 : coupon.value;
  if (coupon.maxDiscount != null) discount = Math.min(discount, coupon.maxDiscount);
  return { ok: true, discount: roundMoney(Math.min(discount, subtotal)) };
}

export function deliveryFee(mode: OrderMode, subtotal: number): number {
  if (mode !== 'delivery') return 0;
  return subtotal >= brand.store.freeDeliveryOver ? 0 : brand.store.deliveryFee;
}

/** Packaging charge per order (₹) for takeaway modes; GST applies to it. */
export const PACKAGING_FEE = 15;

/** Pickup, in-car and delivery are packed to go; dine-in is served on the café's crockery. */
export function packagingFee(mode: OrderMode): number {
  return mode === 'dine_in' ? 0 : PACKAGING_FEE;
}

/** Delivery partner tip presets (₹); "No tip" (₹0) is the default. */
export const TIP_PRESETS = [10, 20, 30] as const;
/** A custom ("Other") tip is ₹1–₹500, whole rupees. */
export const TIP_MIN = 1;
export const TIP_MAX = 500;

/**
 * The tip an order can carry: delivery only, whole rupees, 0 or ₹1–₹500 (anything else, such as a
 * typo'd ₹5,000 or a negative, is clamped; NaN is no tip).
 */
export function normalizeTip(mode: OrderMode, tip: number | undefined): number {
  if (mode !== 'delivery' || tip == null || !Number.isFinite(tip) || tip <= 0) return 0;
  return Math.min(TIP_MAX, Math.max(TIP_MIN, roundMoney(tip)));
}

/** Parses a typed "Other" tip ("₹ 25", "25") → 25, or null when it isn't ₹1–₹500. */
export function parseTip(text: string): number | null {
  const digits = text.replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = Number(digits);
  return n >= TIP_MIN && n <= TIP_MAX ? n : null;
}

export interface TotalsInput {
  items: Pick<CartItem, 'basePrice' | 'modifiers' | 'quantity'>[];
  mode: OrderMode;
  coupon?: Coupon | null;
  /** Value of a redeemed loyalty reward. */
  rewardValue?: number;
  /** Delivery partner tip (₹); ignored outside delivery (see `normalizeTip`). */
  tip?: number;
  taxRate?: number;
}

/**
 * Order totals (whole rupees):
 *   discount = coupon + reward, never more than the item subtotal (packaging and tip can't be discounted)
 *   taxable  = subtotal − discount + packaging        → GST 5% on it
 *   total    = taxable + GST + delivery fee + tip     (the fee and the tip sit outside GST)
 */
export function computeTotals({ items, mode, coupon, rewardValue = 0, tip, taxRate = brand.taxRate }: TotalsInput): OrderTotals {
  const subtotal = cartSubtotal(items);
  let discount = 0;
  if (coupon) {
    const check = evaluateCoupon(coupon, subtotal);
    if (check.ok) discount += check.discount;
  }
  discount = roundMoney(Math.min(subtotal, discount + rewardValue));
  // An empty basket has nothing to pack.
  const packaging = items.length > 0 ? packagingFee(mode) : 0;
  const taxable = Math.max(0, subtotal - discount) + packaging;
  const tax = roundMoney(taxable * taxRate);
  const fee = deliveryFee(mode, subtotal);
  const tipped = normalizeTip(mode, tip);
  const total = roundMoney(taxable + tax + fee + tipped);
  return { subtotal, discount, packaging, tax, deliveryFee: fee, tip: tipped, total };
}

/** GST's taxable value for stored totals: subtotal − discount + packaging (older totals: no packaging). */
export function taxableValue(totals: OrderTotals): number {
  return Math.max(0, totals.subtotal - totals.discount) + (totals.packaging ?? 0);
}

/** One row of a totals breakdown, in display order. */
export interface TotalsLine {
  key: 'subtotal' | 'discount' | 'packaging' | 'tax' | 'delivery' | 'tip';
  label: string;
  /** Signed amount in ₹ (the discount is negative); `null` shows "Free" (delivery). */
  amount: number | null;
}

/**
 * The shared breakdown every summary and receipt renders (SummaryCard, receipts, the invoice):
 * Subtotal, Discount (when any), Packaging (when any), GST (5%), Delivery fee (delivery mode, or
 * any fee), Delivery partner tip (when any). Older stored totals without packaging/tip still work.
 */
export function totalsBreakdown(totals: OrderTotals, mode?: OrderMode): TotalsLine[] {
  const lines: TotalsLine[] = [{ key: 'subtotal', label: 'Subtotal', amount: totals.subtotal }];
  if (totals.discount > 0) lines.push({ key: 'discount', label: 'Discount', amount: -totals.discount });
  if ((totals.packaging ?? 0) > 0) lines.push({ key: 'packaging', label: 'Packaging', amount: totals.packaging ?? 0 });
  lines.push({ key: 'tax', label: TAX_LINE_LABEL, amount: totals.tax });
  if (mode === 'delivery' || totals.deliveryFee > 0) {
    lines.push({ key: 'delivery', label: 'Delivery fee', amount: totals.deliveryFee > 0 ? totals.deliveryFee : null });
  }
  if ((totals.tip ?? 0) > 0) lines.push({ key: 'tip', label: 'Delivery partner tip', amount: totals.tip ?? 0 });
  return lines;
}

/** "₹40", "−₹100", or "Free" for a waived delivery fee. */
export function formatTotalsLine(line: TotalsLine): string {
  return line.amount === null ? 'Free' : formatMoney(line.amount);
}

/** Loyalty points earned for an order total (1 pt per ₹5, floored). */
export function pointsForTotal(total: number): number {
  // The epsilon keeps a float product like 0.2 × 35 = 6.9999… from flooring a point away.
  return Math.max(0, Math.floor(total * brand.loyalty.pointsPerUnit + 1e-9));
}

/** Points for an order: the tip goes to the delivery partner, so it earns nothing. */
export function pointsForTotals(totals: Pick<OrderTotals, 'total' | 'tip'>): number {
  return pointsForTotal(totals.total - (totals.tip ?? 0));
}
