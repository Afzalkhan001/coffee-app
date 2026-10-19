/**
 * Payment-method rules shared by checkout, payment and the mock "server" (re-exported from
 * `@/api`). Pure: no React, no stores. Everything is simulated; no real money moves.
 *
 * - UPI first: four apps (Google Pay, PhonePe, Paytm, BHIM) and "Pay with UPI ID" (a collect
 *   request to the customer's VPA, e.g. ava@okicici).
 * - Cards: saved Visa •••• 4242 and RuPay •••• 6011, plus a simulated "Add new card" (no entry).
 * - Cash on delivery (delivery only) or pay at the counter (pickup, dine-in, in-car).
 */
import { MERCHANT_VPA, PAYMENT_METHODS } from '@/data/mock/marketing';
import type { Order, OrderMode, OrderPayment, PaymentMethod, PaymentMethodType } from '@/types/models';

export { MERCHANT_VPA };

/** Google Pay: the default until the customer has paid some other way. */
export const DEFAULT_PAYMENT_METHOD_ID = 'pm-gpay';
export const UPI_ID_METHOD_ID = 'pm-upi-id';
export const NEW_CARD_METHOD_ID = 'pm-card-new';

/** What happens on "Pay": an app hand-off, a collect request, a card charge, or nothing yet (cash). */
export type PayFlow = 'upi_app' | 'upi_id' | 'card' | 'cod' | 'counter';

export function payFlow(method: Pick<PaymentMethod, 'type' | 'upiApp'>): PayFlow {
  switch (method.type) {
    case 'upi':
      return method.upiApp ? 'upi_app' : 'upi_id';
    case 'cod':
      return 'cod';
    case 'pay_at_store':
      return 'counter';
    default:
      return 'card';
  }
}

/** Paid later in person (cash on delivery, or at the counter): the order is confirmed unpaid. */
export function paysLater(type: PaymentMethodType): boolean {
  return type === 'cod' || type === 'pay_at_store';
}

/** Methods offered for a mode, in display order: UPI, cards, then cash on delivery or the counter. */
export function availablePaymentMethods(mode: OrderMode): PaymentMethod[] {
  return PAYMENT_METHODS.filter((m) => {
    if (m.type === 'cod') return mode === 'delivery';
    if (m.type === 'pay_at_store') return mode !== 'delivery';
    return m.type === 'upi' || m.type === 'card';
  });
}

export function findPaymentMethod(id: string | undefined): PaymentMethod | undefined {
  return id ? PAYMENT_METHODS.find((m) => m.id === id) : undefined;
}

/** The method a mode actually uses: `id` if it's offered there, else Google Pay. */
export function resolvePaymentMethod(mode: OrderMode, id: string | undefined): PaymentMethod {
  const offered = availablePaymentMethods(mode);
  return offered.find((m) => m.id === id) ?? offered.find((m) => m.id === DEFAULT_PAYMENT_METHOD_ID) ?? offered[0]!;
}

// ── UPI IDs (VPAs) ───────────────────────────────────────────

/** Trimmed, lower-case, no inner spaces: "  Ava@OkICICI " → "ava@okicici". */
export function normalizeVpa(raw: string): string {
  return raw.trim().replace(/\s+/g, '').toLowerCase();
}

/**
 * A UPI ID is name@handle: the name 2–256 letters, digits, dots, hyphens or underscores (starting
 * with a letter or digit), the handle 2–64 letters or digits starting with a letter ("okicici",
 * "ybl", "paytm", "axl").
 */
const VPA = /^[a-z0-9][a-z0-9._-]{1,255}@[a-z][a-z0-9]{1,63}$/;

export function isValidVpa(raw: string): boolean {
  return VPA.test(normalizeVpa(raw));
}

/** Why a typed UPI ID can't be used yet, or null when it's valid. */
export function vpaIssue(raw: string): string | null {
  const vpa = normalizeVpa(raw);
  if (!vpa) return 'Enter your UPI ID, like name@okicici.';
  if (!vpa.includes('@')) return 'Add your bank handle after @, like name@okicici.';
  const [name = '', handle = ''] = vpa.split('@');
  if (name.length < 2) return 'Add the name before @.';
  if (!handle) return 'Add your bank handle after @, like name@okicici.';
  return isValidVpa(vpa) ? null : 'That doesn’t look like a UPI ID. Check it and try again.';
}

// ── Labels ───────────────────────────────────────────────────

/** "Visa •••• 4242", "Google Pay", "ava@okicici" (UPI ID), "New card", "Cash on delivery". */
export function paymentMethodTitle(method: PaymentMethod, vpa?: string): string {
  if (method.type === 'card') return method.last4 ? `${method.label} •••• ${method.last4}` : 'New card';
  if (method.type === 'upi' && !method.upiApp) return vpa ? normalizeVpa(vpa) : 'UPI ID';
  return method.label;
}

/** The label frozen on the order: "Google Pay", "UPI · ava@okicici", "RuPay •••• 6011", "Pay at the counter". */
export function paymentLabel(method: PaymentMethod, vpa?: string): string {
  if (method.type === 'upi' && !method.upiApp) return vpa ? `UPI · ${normalizeVpa(vpa)}` : 'UPI';
  return paymentMethodTitle(method, vpa);
}

/** The order's payment snapshot when it's placed (references come with the approval). */
export function orderPaymentFor(method: PaymentMethod, vpa?: string): OrderPayment {
  const upiId = method.type === 'upi' && !method.upiApp;
  return {
    methodId: method.id,
    label: paymentLabel(method, vpa),
    upiApp: method.upiApp,
    vpa: upiId && vpa ? normalizeVpa(vpa) : undefined,
  };
}

const LEGACY_LABELS: Record<PaymentMethodType, string> = {
  card: 'Visa •••• 4242',
  apple_pay: 'Card',
  google_pay: 'Google Pay',
  upi: 'UPI',
  cod: 'Cash on delivery',
  pay_at_store: 'Pay at the counter',
};

/** How an order was paid, for receipts and refunds: its frozen label, or (older orders) its type. */
export function orderPaymentLabel(order: Pick<Order, 'payment' | 'paymentMethod'>): string {
  return order.payment?.label ?? LEGACY_LABELS[order.paymentMethod];
}

// ── Simulated references ─────────────────────────────────────

/** A 12-digit UPI reference number (RRN). `seed` keeps tests deterministic. */
export function simulatedUpiRef(seed: number = Math.random()): string {
  const digits = Math.floor(seed * 1e12)
    .toString()
    .padStart(12, '0')
    .slice(-12);
  // RRNs start with the last digit of the year and the day of the year in real life; a leading 6
  // keeps ours from ever starting with 0.
  return `6${digits.slice(1)}`;
}

/** "TXN" + 10 upper-case letters and digits. */
export function simulatedTxnId(seed: number = Math.random()): string {
  const alphabet = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let n = Math.floor(seed * 2 ** 50);
  let out = '';
  for (let i = 0; i < 10; i++) {
    out += alphabet[n % alphabet.length];
    n = Math.floor(n / alphabet.length) + (i + 1) * 7919;
  }
  return `TXN${out}`;
}
