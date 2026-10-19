/**
 * GST tax invoice for an order (prototype). Pure: builds every line the invoice screen and its
 * shared text version show, from the stored order alone.
 *
 * - Invoice number from the order number and the Indian financial year: ER-4827 placed on
 *   8 Oct 2026 → "ER/2026-27/004827".
 * - Intra-state supply (Karnataka, 29): GST 5% splits into CGST 2.5% + SGST 2.5%. The halves are
 *   exact (₹27 → ₹13.50 + ₹13.50), so they always add up to the order's whole-rupee GST.
 * - Taxable value = item total − discount + packaging. The delivery fee and the delivery partner
 *   tip sit outside GST in this prototype (the tip is never taxed).
 * - The seller's GSTIN and FSSAI numbers are placeholders: "Prototype — not a valid tax invoice".
 */
import { orderPaymentLabel } from '@/api';
import { displayPhone, formatDate, formatTime, nationalPhone } from '@/lib/format';
import { summarizeModifiers } from '@/lib/modifiers';
import { taxableValue, unitPrice } from '@/lib/pricing';
import { brand, groupIndian } from '@/theme/brand';
import type { Order } from '@/types/models';

export const SELLER = {
  legalName: 'Ember Roast Cafés Pvt. Ltd.',
  /** Placeholder GSTIN (Karnataka, state code 29). */
  gstin: '29AAHCE1234F1Z5',
  /** Placeholder FSSAI licence number. */
  fssai: '11224333000123',
  state: 'Karnataka',
  stateCode: '29',
} as const;

/** Services Accounting Code for restaurant services (GST 5%, no input tax credit). */
export const RESTAURANT_SAC = '996331';
export const INVOICE_FOOTNOTE = 'Prototype — not a valid tax invoice.';

/** Indian financial year (April–March) of a date: 8 Oct 2026 → "2026-27", 2 Feb 2027 → "2026-27". */
export function financialYear(iso: string): string {
  const d = new Date(iso);
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** "ER/2026-27/004827" from order ER-4827 placed in FY 2026-27. */
export function invoiceNumber(order: Pick<Order, 'number' | 'createdAt'>): string {
  const serial = (order.number.replace(/\D/g, '') || '0').slice(-6).padStart(6, '0');
  return `ER/${financialYear(order.createdAt)}/${serial}`;
}

/** "+91 98XXX XX210": the first two and last three digits of the mobile. */
export function maskPhone(phone: string): string {
  const d = nationalPhone(phone);
  if (d.length !== 10) return displayPhone(phone);
  return `+91 ${d.slice(0, 2)}XXX XX${d.slice(7)}`;
}

/** Exact CGST / SGST halves of the order's GST (in rupees, possibly ending in .50). */
export function splitGst(tax: number): { cgst: number; sgst: number } {
  const half = Math.round(tax * 50) / 100;
  return { cgst: half, sgst: Math.round((tax - half) * 100) / 100 };
}

/** "1,250.00" (Indian grouping, always two decimals: invoice amounts show paise). */
export function formatInvoiceAmount(value: number): string {
  const sign = value < 0 ? '−' : '';
  const fixed = (Math.round(Math.abs(value) * 100) / 100).toFixed(2);
  const [int = '0', frac = '00'] = fixed.split('.');
  return `${sign}${groupIndian(int)}.${frac}`;
}

// ── Amount in words (Indian system) ───────────────────────────

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
] as const;
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'] as const;

function belowHundred(n: number): string {
  if (n < 20) return ONES[n]!;
  const t = TENS[Math.floor(n / 10)]!;
  return n % 10 ? `${t}-${ONES[n % 10]}` : t;
}

function belowThousand(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (!h) return belowHundred(rest);
  return rest ? `${ONES[h]} hundred ${belowHundred(rest)}` : `${ONES[h]} hundred`;
}

/** 536 → "five hundred thirty-six"; 1,25,000 → "one lakh twenty-five thousand"; 0 → "zero". */
export function numberInWords(n: number): string {
  const whole = Math.floor(Math.abs(n));
  if (whole === 0) return 'zero';
  const parts: string[] = [];
  const crore = Math.floor(whole / 1_00_00_000);
  const lakh = Math.floor((whole % 1_00_00_000) / 1_00_000);
  const thousand = Math.floor((whole % 1_00_000) / 1000);
  const rest = whole % 1000;
  if (crore) parts.push(`${numberInWords(crore)} crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} thousand`);
  if (rest) parts.push(belowThousand(rest));
  return parts.join(' ');
}

/** "Five hundred thirty-six rupees only", "One rupee only", "Twelve rupees and fifty paise only". */
export function amountInWords(amount: number): string {
  const rupees = Math.floor(Math.abs(amount) + 1e-9);
  const paise = Math.round((Math.abs(amount) - rupees) * 100);
  let text = `${numberInWords(rupees)} ${rupees === 1 ? 'rupee' : 'rupees'}`;
  if (paise) text += ` and ${numberInWords(paise)} paise`;
  text += ' only';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ── The invoice ───────────────────────────────────────────────

export interface InvoiceLine {
  id: string;
  name: string;
  /** "Medium · Oat milk · Vanilla" (modifiers), or undefined. */
  detail?: string;
  qty: number;
  /** Unit price incl. modifiers. */
  rate: number;
  amount: number;
}

export interface InvoiceRow {
  key: 'itemTotal' | 'discount' | 'packaging' | 'taxable' | 'cgst' | 'sgst' | 'delivery' | 'tip';
  label: string;
  amount: number;
  /** Visually set apart (the taxable value): a rule above and semibold. */
  emphasis?: boolean;
}

export interface InvoicePaymentLine {
  label: string;
  value: string;
}

export interface Invoice {
  number: string;
  /** "8 Oct 2026 · 10:42 AM" */
  issuedAt: string;
  status: 'Paid' | 'Due' | 'Refunded';
  customer: { name: string; phone: string; address?: string };
  placeOfSupply: string;
  lines: InvoiceLine[];
  rows: InvoiceRow[];
  grandTotal: number;
  grandTotalWords: string;
  payment: InvoicePaymentLine[];
}

/** Orders that have a tax invoice: confirmed, not cancelled, and paid (or completed, cash collected). */
export function hasInvoice(order: Pick<Order, 'history' | 'status' | 'paymentStatus'>): boolean {
  if (order.history.length === 0 || order.status === 'cancelled') return false;
  return order.paymentStatus === 'paid' || order.paymentStatus === 'refunded' || order.status === 'completed';
}

function invoiceStatus(order: Order): Invoice['status'] {
  if (order.paymentStatus === 'refunded') return 'Refunded';
  if (order.paymentStatus === 'paid' || order.status === 'completed') return 'Paid';
  return 'Due';
}

function paymentLines(order: Order): InvoicePaymentLine[] {
  const p = order.payment;
  const label = orderPaymentLabel(order);
  const method =
    order.paymentMethod === 'upi' && p?.upiApp ? `${label} (UPI)` : order.paymentMethod === 'upi' && p?.vpa ? `UPI · ${p.vpa}` : label;
  const lines: InvoicePaymentLine[] = [{ label: 'Paid via', value: method }];
  if (order.paymentMethod === 'cod' || order.paymentMethod === 'pay_at_store') {
    lines[0] = {
      label: 'Payment',
      value: order.status === 'completed' ? `${label} · collected` : `${label} · due`,
    };
    return lines;
  }
  if (p?.upiRef) lines.push({ label: 'UPI Ref No.', value: p.upiRef });
  if (p?.txnId) lines.push({ label: 'Transaction ID', value: p.txnId });
  return lines;
}

export function buildInvoice(order: Order): Invoice {
  const { totals } = order;
  const { cgst, sgst } = splitGst(totals.tax);
  const rows: InvoiceRow[] = [{ key: 'itemTotal', label: 'Item total', amount: totals.subtotal }];
  if (totals.discount > 0) {
    rows.push({ key: 'discount', label: order.couponCode ? `Discount (${order.couponCode})` : 'Discount', amount: -totals.discount });
  }
  if ((totals.packaging ?? 0) > 0) rows.push({ key: 'packaging', label: 'Packaging', amount: totals.packaging ?? 0 });
  rows.push({ key: 'taxable', label: 'Taxable value', amount: taxableValue(totals), emphasis: true });
  rows.push({ key: 'cgst', label: `CGST @ ${(brand.taxRate * 50).toFixed(1)}%`, amount: cgst });
  rows.push({ key: 'sgst', label: `SGST @ ${(brand.taxRate * 50).toFixed(1)}%`, amount: sgst });
  if (order.details.mode === 'delivery' || totals.deliveryFee > 0) {
    rows.push({ key: 'delivery', label: 'Delivery fee', amount: totals.deliveryFee });
  }
  if ((totals.tip ?? 0) > 0) rows.push({ key: 'tip', label: 'Delivery partner tip (not taxed)', amount: totals.tip ?? 0 });

  const address = order.details.mode === 'delivery' && order.details.address ? [order.details.address.line1, order.details.address.city].filter(Boolean).join(', ') : undefined;
  return {
    number: invoiceNumber(order),
    issuedAt: `${formatDate(order.createdAt)} · ${formatTime(order.createdAt)}`,
    status: invoiceStatus(order),
    customer: { name: order.customer.name || 'Guest', phone: maskPhone(order.customer.phone), address },
    placeOfSupply: `${SELLER.state} (${SELLER.stateCode})`,
    lines: order.items.map((i) => ({
      id: i.id,
      name: i.name,
      detail: summarizeModifiers(i.modifiers) || undefined,
      qty: i.quantity,
      rate: unitPrice(i.basePrice, i.modifiers),
      amount: i.lineTotal,
    })),
    rows,
    grandTotal: totals.total,
    grandTotalWords: amountInWords(totals.total),
    payment: paymentLines(order),
  };
}

/** Plain-text version for the share sheet (monospace-friendly, no tabs). */
export function invoiceText(inv: Invoice): string {
  const money = (n: number) => `${brand.currency.symbol}${formatInvoiceAmount(n)}`;
  const out = [
    'TAX INVOICE',
    SELLER.legalName,
    brand.store.address,
    `GSTIN ${SELLER.gstin} · FSSAI Lic. No. ${SELLER.fssai}`,
    '',
    `Invoice no. ${inv.number}`,
    `Date ${inv.issuedAt}`,
    `Place of supply ${inv.placeOfSupply}`,
    `Billed to ${inv.customer.name}, ${inv.customer.phone}`,
    ...(inv.customer.address ? [`Deliver to ${inv.customer.address}`] : []),
    '',
    ...inv.lines.map((l) => `${l.qty} × ${l.name}${l.detail ? ` (${l.detail})` : ''} @ ${money(l.rate)} = ${money(l.amount)}`),
    `SAC ${RESTAURANT_SAC} · Restaurant services`,
    '',
    ...inv.rows.map((r) => `${r.label}: ${money(r.amount)}`),
    `Grand total: ${money(inv.grandTotal)}`,
    inv.grandTotalWords,
    '',
    ...inv.payment.map((p) => `${p.label}: ${p.value}`),
    '',
    INVOICE_FOOTNOTE,
  ];
  return out.join('\n');
}
