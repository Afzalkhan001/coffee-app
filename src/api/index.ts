/**
 * Data access seam. Every screen talks to the backend only through these
 * async functions. Today they are backed by mock data + an on-device store;
 * Phase 4 swaps the bodies for Supabase calls with the same signatures.
 */
import { CATEGORIES, CATEGORY_PHOTOS, PRODUCTS } from '@/data/mock/menu';
import { MODIFIER_GROUPS, PRODUCT_MODIFIER_GROUPS } from '@/data/mock/modifiers';
import { COUPONS, FIRST_ORDER_COUPONS, PROMOTIONS, REWARD_ELIGIBILITY, REWARDS } from '@/data/mock/marketing';
import { PHOTOS } from '@/data/mock/photos';
import { effectivePickupTime, formatCount, nationalPhone, orderNumber, uid } from '@/lib/format';
import { distanceFromStoreKm, isDeliverable } from '@/lib/geo';
import { cartSubtotal, computeTotals, evaluateCoupon, lineTotal, normalizeTip, pointsForTotals, roundMoney, unitPrice } from '@/lib/pricing';
import { storeStatus } from '@/lib/storeHours';
import { useDemo } from '@/store/demo';
import { brand } from '@/theme/brand';
import type {
  Address,
  CartItem,
  OrderItem,
  Category,
  Coupon,
  ModifierGroup,
  Order,
  OrderModeDetails,
  Payment,
  PaymentMethodType,
  Product,
  ProductWithModifiers,
  Profile,
  Promotion,
  Reward,
} from '@/types/models';
import { db, isRealOrder, orderOwner, type OrderRecord } from './mockDb';
import {
  availablePaymentMethods,
  DEFAULT_PAYMENT_METHOD_ID,
  findPaymentMethod,
  orderPaymentFor,
  paysLater,
  simulatedTxnId,
  simulatedUpiRef,
  vpaIssue,
  UPI_ID_METHOD_ID,
} from './payments';
import { demoEtaMinutes, prepMinutesFor, scheduleNextAdvance } from './simulator';

export * from './payments';

export { quotedEtaMinutes } from './simulator';

export { orderOwner, orderScheduledFor, type OrderRecord } from './mockDb';

// ── errors ────────────────────────────────────────────────────
export class NetworkError extends Error {
  constructor() {
    super('You appear to be offline. Check your connection and try again.');
    this.name = 'NetworkError';
  }
}
export class OtpError extends Error {
  constructor(public reason: 'invalid' | 'expired' | 'no_session') {
    super(
      reason === 'invalid'
        ? 'That code isn’t right. Please check and try again.'
        : reason === 'expired'
          ? 'This code has expired. Tap “Resend code” to get a new one.'
          : 'Please request a new code.',
    );
    this.name = 'OtpError';
  }
}
export class PaymentError extends Error {
  constructor(message = 'Your payment was declined by the bank. No money was taken.') {
    super(message);
    this.name = 'PaymentError';
  }
}

export const isNetworkError = (e: unknown): e is NetworkError => e instanceof Error && e.name === 'NetworkError';

// ── transport simulation ─────────────────────────────────────
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function network(scale = 1): Promise<void> {
  const { latencyMs, offline } = useDemo.getState();
  await sleep(latencyMs * scale + Math.random() * 120);
  if (offline) throw new NetworkError();
}

// ── auth (Supabase Auth phone OTP later) ─────────────────────
export const OTP_TTL_MS = 2 * 60_000;
export const OTP_RESEND_MS = 30_000;
/** Demo codes: 123456 (or any code except 000000) succeeds. */
export const DEMO_OTP = '123456';

export async function sendOtp(phone: string): Promise<{ expiresAt: number; resendAt: number }> {
  await network();
  const now = Date.now();
  const session = { phone, code: DEMO_OTP, sentAt: now, expiresAt: now + OTP_TTL_MS, resendAt: now + OTP_RESEND_MS };
  db.set({ otp: session });
  return { expiresAt: session.expiresAt, resendAt: session.resendAt };
}

/** Returns the existing profile for returning users, or null for first-time users. */
export async function verifyOtp(phone: string, code: string): Promise<{ profile: Profile | null }> {
  await network();
  const otp = db.get().otp;
  if (!otp || otp.phone !== phone) throw new OtpError('no_session');
  if (Date.now() > otp.expiresAt) throw new OtpError('expired');
  if (code === '000000' || code.length !== 6) throw new OtpError('invalid');
  db.set({ otp: null });
  return { profile: db.get().profiles[phone] ?? null };
}

export async function saveProfile(phone: string, input: { name: string; email?: string }): Promise<Profile> {
  await network();
  const existing = db.get().profiles[phone];
  const profile: Profile = existing
    ? { ...existing, name: input.name, email: input.email }
    : { id: uid('usr'), phone, name: input.name, email: input.email, createdAt: new Date().toISOString() };
  db.set((s) => ({ profiles: { ...s.profiles, [phone]: profile } }));
  if (!existing) seedNewCustomer(profile);
  return profile;
}

// ── catalog ──────────────────────────────────────────────────
export interface Menu {
  categories: Category[];
  products: Product[];
}

export async function getMenu(): Promise<Menu> {
  await network(0.8);
  return { categories: [...CATEGORIES].sort((a, b) => a.sortOrder - b.sortOrder), products: PRODUCTS };
}

export function resolveModifierGroups(productId: string): ModifierGroup[] {
  return PRODUCT_MODIFIER_GROUPS.filter((pm) => pm.productId === productId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((pm) => MODIFIER_GROUPS.find((g) => g.id === pm.groupId))
    .filter((g): g is ModifierGroup => !!g);
}

export async function getProduct(id: string): Promise<ProductWithModifiers | null> {
  await network(0.6);
  return getProductSync(id);
}

/** Synchronous lookup for instant first paint (mock only; cache-backed later). */
export function getProductSync(id: string): ProductWithModifiers | null {
  const product = PRODUCTS.find((p) => p.id === id);
  if (!product) return null;
  return { ...product, modifierGroups: resolveModifierGroups(id) };
}

export function getCategorySync(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

/** Signature product photo for a category tile (undefined → the tile falls back to its line glyph). */
export function categoryImage(id: string): string | undefined {
  return CATEGORY_PHOTOS[id];
}

export async function searchProducts(query: string): Promise<Product[]> {
  await network(0.5);
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/);
  return PRODUCTS.filter((p) => {
    // Dietary tags are ids ("dairy_free"); index them as "dairy-free" so "dairy-free" and "dairy free" both match.
    const dietary = p.dietary.map((d) => d.replace(/_/g, '-')).join(' ');
    const hay = `${p.name} ${p.description} ${CATEGORIES.find((c) => c.id === p.categoryId)?.name ?? ''} ${dietary}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

export async function getPromotions(): Promise<Promotion[]> {
  await network(0.6);
  return PROMOTIONS;
}

export async function getRewards(): Promise<Reward[]> {
  await network(0.6);
  return REWARDS;
}

export function getRewardSync(id?: string): Reward | undefined {
  return id ? REWARDS.find((r) => r.id === id) : undefined;
}

type PricedLine = Pick<CartItem, 'productId' | 'basePrice' | 'modifiers' | 'quantity'>;

/**
 * What a redeemed reward actually takes off this basket. Item rewards only apply when the basket
 * has an eligible item, and are capped at the cheapest eligible item ("Any pastry" can't discount a
 * coffee-only cart, "Free extra shot" needs a drink). Whole-order rewards (₹500 off) apply as is.
 * `eligible: false` → show "Add a pastry to use this reward" (see `rewardHint`).
 */
export function rewardDiscountFor(rewardId: string | undefined, items: PricedLine[]): { discount: number; eligible: boolean } {
  const reward = getRewardSync(rewardId);
  if (!reward) return { discount: 0, eligible: false };
  const rule = REWARD_ELIGIBILITY[reward.id];
  if (!rule) return { discount: reward.value, eligible: true };
  const prices = items
    .filter((i) => rule.categoryIds.includes(PRODUCTS.find((p) => p.id === i.productId)?.categoryId ?? ''))
    .map((i) => unitPrice(i.basePrice, i.modifiers));
  if (prices.length === 0) return { discount: 0, eligible: false };
  return { discount: roundMoney(Math.min(reward.value, Math.min(...prices))), eligible: true };
}

/** Why a reward doesn't apply to the basket yet ("Add a pastry to use this reward"), or null. */
export function rewardHint(rewardId: string | undefined, items: PricedLine[]): string | null {
  const reward = getRewardSync(rewardId);
  if (!reward) return null;
  const rule = REWARD_ELIGIBILITY[reward.id];
  if (!rule || rewardDiscountFor(rewardId, items).eligible) return null;
  return `Add ${rule.noun} to use this reward`;
}

/** Can the account pay for this reward with its points? */
export function canAffordReward(rewardId: string | undefined, phone: string | null | undefined): boolean {
  const reward = getRewardSync(rewardId);
  if (!reward) return true;
  return !!phone && db.loyaltyFor(phone).balance >= reward.cost;
}

/**
 * Why a cart/order line can't be ordered right now (PRD §24 "product unavailable"), or null.
 * Checks the product and every chosen option against today's menu.
 */
export function cartLineIssue(item: Pick<CartItem, 'productId' | 'name' | 'modifiers'>): string | null {
  const product = getProductSync(item.productId);
  if (!product) return `${item.name} is no longer on the menu`;
  if (!product.isAvailable) return `${item.name} is sold out today`;
  for (const m of item.modifiers) {
    const option = product.modifierGroups.find((g) => g.id === m.groupId)?.options.find((o) => o.id === m.optionId);
    if (!option || !option.isAvailable) return `${m.optionName} is unavailable today`;
  }
  return null;
}

/**
 * Past order lines re-priced at TODAY's prices, skipping anything sold out or with an unavailable
 * option. Returns the lines to add and the names that were skipped.
 */
export function reorderableLines(items: OrderItem[]): {
  lines: Omit<OrderItem, 'id' | 'lineTotal'>[];
  skipped: string[];
} {
  const lines: Omit<OrderItem, 'id' | 'lineTotal'>[] = [];
  const skipped: string[] = [];
  for (const it of items) {
    const product = getProductSync(it.productId);
    if (!product || cartLineIssue(it)) {
      skipped.push(it.name);
      continue;
    }
    const modifiers = it.modifiers.map((m) => {
      const option = product.modifierGroups.find((g) => g.id === m.groupId)?.options.find((o) => o.id === m.optionId);
      return option ? { ...m, priceDelta: option.priceDelta } : m;
    });
    lines.push({
      productId: it.productId,
      name: product.name,
      image: product.image,
      basePrice: product.price,
      quantity: it.quantity,
      modifiers,
      instructions: it.instructions,
    });
  }
  return { lines, skipped };
}

// ── coupons & delivery ───────────────────────────────────────
export type CouponResult = { ok: true; coupon: Coupon; discount: number } | { ok: false; message: string };

/**
 * Validates a code for a basket. Pass the signed-in `phone` so first-order-only codes (FIRST20) are
 * refused for customers who already have orders.
 */
export async function validateCoupon(code: string, subtotal: number, phone?: string | null): Promise<CouponResult> {
  await network(0.6);
  const coupon = findCoupon(code);
  if (!coupon) return { ok: false, message: 'We couldn’t find that code.' };
  if (phone && !couponAllowedFor(coupon, phone)) return { ok: false, message: FIRST_ORDER_MESSAGE };
  const check = evaluateCoupon(coupon, subtotal);
  return check.ok ? { ok: true, coupon, discount: check.discount } : { ok: false, message: check.message };
}

const FIRST_ORDER_MESSAGE = 'This code is for your first order only.';

/** Confirmed (non-cancelled) orders the account has placed. */
function placedOrderCount(phone: string): number {
  return db.get().orders.filter((o) => orderOwner(o) === phone && o.history.length > 0 && o.status !== 'cancelled' && isRealOrder(o)).length;
}

/** First-order-only codes are refused once the account has a confirmed order. */
export function couponAllowedFor(coupon: Coupon, phone: string): boolean {
  return !FIRST_ORDER_COUPONS.has(coupon.code) || placedOrderCount(phone) === 0;
}

export function findCoupon(code?: string | null): Coupon | undefined {
  if (!code) return undefined;
  return COUPONS.find((c) => c.code.toLowerCase() === code.trim().toLowerCase());
}

export async function checkDelivery(address: Pick<Address, 'lat' | 'lng'>): Promise<{ deliverable: boolean; distanceKm: number }> {
  await network(0.7);
  return { deliverable: isDeliverable(address), distanceKm: distanceFromStoreKm(address) };
}

// ── orders & payments ────────────────────────────────────────
export interface PlaceOrderInput {
  phone: string;
  customer: { name: string; phone: string };
  details: OrderModeDetails;
  items: CartItem[];
  couponCode?: string;
  rewardId?: string;
  paymentMethod: PaymentMethodType;
  /**
   * The exact method (`PAYMENT_METHODS` id: "pm-phonepe", "pm-upi-id", "pm-rupay"). Optional for
   * older callers: without it the first method of `paymentMethod`'s type is used.
   */
  paymentMethodId?: string;
  /** The customer's UPI ID, required with "Pay with UPI ID". */
  vpa?: string;
  /** Delivery partner tip (₹, delivery only; see `normalizeTip`). */
  tip?: number;
}

/** The method an order input pays with, validated against its mode (and its UPI ID). */
function paymentMethodFor(input: PlaceOrderInput, mode: OrderModeDetails['mode']) {
  const method = input.paymentMethodId
    ? findPaymentMethod(input.paymentMethodId)
    : availablePaymentMethods(mode).find((m) => m.type === input.paymentMethod);
  if (!method || method.type !== input.paymentMethod) throw new Error('Choose a way to pay.');
  if (!availablePaymentMethods(mode).some((m) => m.id === method.id)) {
    throw new Error(method.type === 'cod' ? 'Cash on delivery is only for delivery orders.' : `${method.label} isn’t available for this order.`);
  }
  if (method.id === UPI_ID_METHOD_ID) {
    const issue = vpaIssue(input.vpa ?? '');
    if (issue) throw new Error(issue);
  }
  return method;
}

/**
 * Creates the order in "awaiting payment" state. It's not paid until payOrder confirms.
 * `input.phone` is the signed-in account (the owner); `input.customer.phone` is only the contact
 * number shown to staff / used for SMS.
 */
export async function createOrder(input: PlaceOrderInput): Promise<Order> {
  await network();
  if (input.items.length === 0) throw new Error('Your cart is empty.');
  const method = paymentMethodFor(input, input.details.mode);
  if (input.details.mode === 'delivery' && (!input.details.address || !isDeliverable(input.details.address))) {
    throw new Error('We don’t deliver to this address yet.');
  }
  for (const item of input.items) {
    const issue = cartLineIssue(item);
    if (issue) throw new Error(`${issue}. Remove it from your cart to continue.`);
  }
  // Coerce a stale / off-grid pickup slot to what the chips show (ASAP), so the order matches the UI.
  const details: OrderModeDetails =
    input.details.mode === 'pickup' || input.details.mode === 'in_car'
      ? { ...input.details, pickupTime: effectivePickupTime(input.details.pickupTime) }
      : input.details;
  if (!storeStatus().open && (details.pickupTime ?? 'asap') === 'asap') {
    throw new Error('We’re closed right now. Pick a pickup time for when we open.');
  }
  const found = findCoupon(input.couponCode);
  if (found && !couponAllowedFor(found, input.phone)) {
    throw new Error(`${found.code}: ${FIRST_ORDER_MESSAGE} Remove the code to continue.`);
  }
  // Only keep a coupon that actually applies to this basket (minimum spend etc.).
  const coupon = found && evaluateCoupon(found, cartSubtotal(input.items)).ok ? found : undefined;
  const reward = getRewardSync(input.rewardId);
  if (reward && !canAffordReward(reward.id, input.phone)) {
    throw new Error(`You need ${formatCount(reward.cost)} points for “${reward.name}”. Remove the reward to continue.`);
  }
  const rewardValue = reward ? rewardDiscountFor(reward.id, input.items).discount : 0;
  const tip = normalizeTip(details.mode, input.tip);
  const totals = computeTotals({ items: input.items, mode: details.mode, coupon, rewardValue, tip });
  const now = new Date().toISOString();
  const order: OrderRecord = {
    id: uid('ord'),
    number: orderNumber(),
    createdAt: now,
    details,
    items: input.items.map((i) => ({
      id: uid('oi'),
      productId: i.productId,
      name: i.name,
      image: i.image,
      basePrice: i.basePrice,
      quantity: i.quantity,
      modifiers: i.modifiers,
      instructions: i.instructions,
      lineTotal: lineTotal(i),
    })),
    totals,
    couponCode: coupon?.code,
    rewardId: rewardValue > 0 ? reward?.id : undefined,
    status: 'placed',
    history: [],
    paymentStatus: 'pending',
    paymentMethod: method.type,
    payment: orderPaymentFor(method, input.vpa),
    customer: { name: input.customer.name.trim(), phone: nationalPhone(input.customer.phone) || input.phone },
    ownerPhone: input.phone,
    etaMinutes: demoEtaMinutes(details.mode, prepMinutesFor(input.items)),
    // The tip goes to the delivery partner, so it earns no points.
    pointsEarned: pointsForTotals(totals),
  };
  // One unpaid order per account: placing again (back from payment, or after a failed payment)
  // replaces the earlier never-confirmed one instead of piling up orphans.
  db.set((s) => ({
    orders: [
      order,
      ...s.orders.filter((o) => !(orderOwner(o) === input.phone && o.history.length === 0 && o.paymentStatus !== 'paid')),
    ],
  }));
  return order;
}

/**
 * Simulated gateway. Success marks the order paid (UPI / card: with a simulated UPI reference and
 * transaction id) and starts preparation; cash on delivery and pay-at-counter orders are confirmed
 * unpaid. Failure leaves the order unpaid so the customer can retry (PRD §14). The UPI approval
 * wait (the "Approve in Google Pay" countdown) is the payment screen's; this is the bank's answer.
 */
export async function payOrder(orderId: string, opts: { simulateFailure?: boolean } = {}): Promise<Payment> {
  const found = db.get().orders.find((o) => o.id === orderId);
  // A UPI approval already waited in the payment screen, so the bank answers faster than a card.
  await network(found?.paymentMethod === 'upi' ? 1.6 : 2.6);
  const order = db.get().orders.find((o) => o.id === orderId);
  if (!order) throw new Error('Order not found.');
  if (order.paymentStatus === 'paid') {
    return { id: uid('pay'), orderId, amount: order.totals.total, method: order.paymentMethod, status: 'paid', createdAt: new Date().toISOString() };
  }
  if (opts.simulateFailure) {
    db.updateOrder(orderId, { paymentStatus: 'failed' });
    throw new PaymentError(
      order.paymentMethod === 'upi'
        ? 'Your bank declined the UPI payment. No money was taken.'
        : 'Your payment was declined by the bank. No money was taken.',
    );
  }
  if (order.rewardId && !canAffordReward(order.rewardId, orderOwner(order))) {
    throw new Error('You no longer have enough points for this reward. Go back and remove it to continue.');
  }
  const later = paysLater(order.paymentMethod);
  confirmOrder(order, later ? 'pending' : 'paid');
  return {
    id: uid('pay'),
    orderId,
    amount: order.totals.total,
    method: order.paymentMethod,
    status: later ? 'pending' : 'paid',
    createdAt: new Date().toISOString(),
  };
}

/**
 * The method the account paid with last (and its UPI ID), for checkout's default; `used` marks one
 * that really comes from history. Seeded demo history doesn't count, so a new customer starts on
 * Google Pay.
 */
export function lastPaymentChoice(phone: string | null | undefined): { methodId: string; vpa?: string; used?: true } {
  const last = phone
    ? db
        .get()
        .orders.filter((o) => orderOwner(o) === phone && isRealOrder(o) && o.history.length > 0 && o.payment)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
    : undefined;
  return last?.payment ? { methodId: last.payment.methodId, vpa: last.payment.vpa, used: true } : { methodId: DEFAULT_PAYMENT_METHOD_ID };
}

/** The approval's references (paid orders only), stamped on `order.payment`. */
function paymentReceipt(order: Order, at: string): Order['payment'] {
  const base = order.payment ?? { methodId: '', label: '' };
  return { ...base, upiRef: order.paymentMethod === 'upi' ? simulatedUpiRef() : undefined, txnId: simulatedTxnId(), paidAt: at };
}

function confirmOrder(order: Order, paymentStatus: 'paid' | 'pending') {
  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  // ETA and simulator share one timeline (see simulator.ts). A future pickup slot is honoured:
  // the order is "ready at 4:35 PM" and the countdown runs to the slot.
  const asapEta = demoEtaMinutes(order.details.mode, prepMinutesFor(order.items));
  const slot = order.details.pickupTime && order.details.pickupTime !== 'asap' ? new Date(order.details.pickupTime).getTime() : NaN;
  const honourSlot = !useDemo.getState().fastStatus && Number.isFinite(slot) && slot > nowMs + asapEta * 60_000;
  const patch: Partial<OrderRecord> = {
    paymentStatus,
    payment: paymentStatus === 'paid' ? paymentReceipt(order, now) : order.payment,
    status: 'placed',
    createdAt: now,
    history: [{ status: 'placed', at: now }],
    etaMinutes: honourSlot ? (slot - nowMs) / 60_000 : asapEta,
    scheduledFor: honourSlot ? new Date(slot).toISOString() : undefined,
  };
  db.updateOrder(order.id, patch);
  const reward = getRewardSync(order.rewardId);
  if (reward) {
    db.addLoyalty(orderOwner(order), {
      id: uid('lt'),
      type: 'redeem',
      points: -reward.cost,
      description: `Redeemed · ${reward.name}`,
      createdAt: now,
      orderId: order.id,
    });
  }
  scheduleNextAdvance(order.id);
}

export async function cancelOrder(orderId: string): Promise<void> {
  await network();
  const order = db.get().orders.find((o) => o.id === orderId);
  if (!order) return;
  if (order.status !== 'placed' && order.status !== 'accepted') {
    throw new Error('This order is already being prepared and can’t be cancelled.');
  }
  const now = new Date().toISOString();
  db.updateOrder(orderId, (o) => ({
    status: 'cancelled',
    paymentStatus: o.paymentStatus === 'paid' ? 'refunded' : o.paymentStatus,
    history: [...o.history, { status: 'cancelled', at: now }],
  }));
  db.set((s) => {
    const { [orderId]: _, ...sim } = s.sim;
    return { sim };
  });
  // Refund redeemed reward points.
  const reward = getRewardSync(order.rewardId);
  // Only if the redeem actually went through (it happens at payment), and without counting the
  // refund toward lifetime points / tier.
  const owner = orderOwner(order);
  const redeemed = db.loyaltyFor(owner).transactions.some((t) => t.orderId === orderId && t.type === 'redeem');
  if (reward && redeemed) {
    db.addLoyalty(
      owner,
      {
        id: uid('lt'),
        type: 'bonus',
        points: reward.cost,
        description: `Refunded · ${reward.name}`,
        createdAt: now,
        orderId,
      },
      { lifetime: false },
    );
  }
}

/** In-car: customer has parked. */
export async function markArrived(orderId: string): Promise<void> {
  await network(0.5);
  db.updateOrder(orderId, { arrived: true });
  scheduleNextAdvance(orderId, 5000);
}

export async function getOrders(phone: string): Promise<Order[]> {
  await network(0.6);
  return db.get().orders.filter((o) => orderOwner(o) === phone);
}

// ── demo seeding ─────────────────────────────────────────────
function seedNewCustomer(profile: Profile) {
  const day = 86_400_000;
  const mk = (daysAgo: number, productIds: [string, number, string[]][], mode: Order['details']['mode'], methodId: string): OrderRecord => {
    const at = new Date(Date.now() - daysAgo * day - 3 * 3_600_000).toISOString();
    const items = productIds.map(([pid, qty, optionIds]) => {
      const product = PRODUCTS.find((p) => p.id === pid)!;
      const groups = resolveModifierGroups(pid);
      const modifiers = groups.flatMap((g) =>
        g.options
          .filter((o) => optionIds.includes(o.id))
          .map((o) => ({ groupId: g.id, groupName: g.name, optionId: o.id, optionName: o.name, shortName: o.shortName, priceDelta: o.priceDelta })),
      );
      const base = { productId: pid, name: product.name, image: product.image, basePrice: product.price, quantity: qty, modifiers };
      return { ...base, id: uid('oi'), lineTotal: lineTotal(base) };
    });
    const totals = computeTotals({ items, mode });
    const method = findPaymentMethod(methodId) ?? availablePaymentMethods(mode)[0]!;
    return {
      id: uid('ord'),
      number: orderNumber(),
      createdAt: at,
      details: mode === 'delivery' ? { mode } : { mode, pickupTime: 'asap' },
      items,
      totals,
      status: 'completed',
      history: [
        { status: 'placed', at },
        { status: 'completed', at },
      ],
      paymentStatus: 'paid',
      paymentMethod: method.type,
      payment: { ...orderPaymentFor(method), upiRef: method.type === 'upi' ? simulatedUpiRef() : undefined, txnId: simulatedTxnId(), paidAt: at },
      customer: { name: profile.name, phone: profile.phone },
      ownerPhone: profile.phone,
      demoSeed: true,
      etaMinutes: 8,
      pointsEarned: pointsForTotals(totals),
    };
  };
  const past: OrderRecord[] = [
    mk(2, [
      ['caramel-macchiato', 1, ['size-m', 'temp-iced', 'milk-oat', 'syrup-vanilla']],
      ['croissant', 1, ['serve-warm']],
    ], 'pickup', 'pm-gpay'),
    mk(6, [
      ['latte', 2, ['size-l', 'temp-hot', 'milk-whole']],
      ['cheesecake', 1, []],
    ], 'dine_in', 'pm-card'),
  ];
  db.set((s) => ({ orders: [...s.orders, ...past] }));
  const now = new Date().toISOString();
  db.addLoyalty(profile.phone, {
    id: uid('lt'),
    type: 'bonus',
    points: brand.loyalty.welcomeBonus,
    description: 'Welcome bonus',
    createdAt: now,
  });
  for (const o of past) {
    db.addLoyalty(profile.phone, {
      id: uid('lt'),
      type: 'earn',
      points: o.pointsEarned,
      description: `Order ${o.number}`,
      createdAt: o.createdAt,
      orderId: o.id,
    });
  }
}

export { PHOTOS };
