/**
 * GST invoice maths and copy: invoice numbers, the CGST/SGST split, amounts in words (Indian
 * system), and that every invoice adds up to the order's stored total.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/* eslint-disable import/first */
import { computeTotals } from '@/lib/pricing';
import type { Order, OrderItem, OrderMode } from '@/types/models';
import {
  amountInWords,
  buildInvoice,
  financialYear,
  formatInvoiceAmount,
  hasInvoice,
  invoiceNumber,
  invoiceText,
  maskPhone,
  numberInWords,
  splitGst,
} from '../invoice';
/* eslint-enable import/first */

function item(id: string, name: string, basePrice: number, quantity: number, delta = 0): OrderItem {
  const modifiers = delta
    ? [{ groupId: 'size', groupName: 'Size', optionId: 'size-m', optionName: 'Medium', shortName: 'M', priceDelta: delta }]
    : [];
  return { id, productId: id, name, image: 'local:latte', basePrice, quantity, modifiers, lineTotal: (basePrice + delta) * quantity };
}

function order(mode: OrderMode, items: OrderItem[], extra: Partial<Order> = {}, tip = 0): Order {
  const totals = computeTotals({ items, mode, tip });
  return {
    id: 'ord_1',
    number: 'ER-4827',
    createdAt: '2026-10-08T05:12:00.000Z',
    details: mode === 'delivery' ? { mode, address: { id: 'a', label: 'Home', line1: 'Flat 4B, Sunrise Residency, 6th Cross', city: 'Domlur, Bengaluru 560071', lat: 12.96, lng: 77.64 } } : { mode },
    items,
    totals,
    status: 'completed',
    history: [{ status: 'placed', at: '2026-10-08T05:12:00.000Z' }],
    paymentStatus: 'paid',
    paymentMethod: 'upi',
    payment: { methodId: 'pm-gpay', label: 'Google Pay', upiApp: 'gpay', upiRef: '612345678901', txnId: 'TXN8F3K2M1Q9Z', paidAt: '2026-10-08T05:12:30.000Z' },
    customer: { name: 'Ava Stone', phone: '9876543210' },
    etaMinutes: 8,
    pointsEarned: 0,
    ...extra,
  };
}

describe('invoice numbers', () => {
  it('uses the Indian financial year (April–March)', () => {
    expect(financialYear('2026-10-08T05:12:00.000Z')).toBe('2026-27');
    expect(financialYear('2027-02-02T05:12:00.000Z')).toBe('2026-27');
    expect(financialYear('2026-04-01T05:12:00.000Z')).toBe('2026-27');
    expect(financialYear('2026-03-31T05:12:00.000Z')).toBe('2025-26');
    expect(financialYear('2099-06-01T05:12:00.000Z')).toBe('2099-00');
  });

  it('derives the serial from the order number', () => {
    expect(invoiceNumber({ number: 'ER-4827', createdAt: '2026-10-08T05:12:00.000Z' })).toBe('ER/2026-27/004827');
    expect(invoiceNumber({ number: 'ER-184', createdAt: '2026-10-08T05:12:00.000Z' })).toBe('ER/2026-27/000184');
  });
});

describe('formatting', () => {
  it('masks the phone, keeping the first two and last three digits', () => {
    expect(maskPhone('9876543210')).toBe('+91 98XXX XX210');
    expect(maskPhone('+91 98765 43210')).toBe('+91 98XXX XX210');
  });

  it('prints invoice amounts with paise and Indian grouping', () => {
    expect(formatInvoiceAmount(536)).toBe('536.00');
    expect(formatInvoiceAmount(13.5)).toBe('13.50');
    expect(formatInvoiceAmount(125000)).toBe('1,25,000.00');
    expect(formatInvoiceAmount(-100)).toBe('−100.00');
  });

  it('splits GST into exact CGST and SGST halves that add up to it', () => {
    expect(splitGst(26)).toEqual({ cgst: 13, sgst: 13 });
    expect(splitGst(27)).toEqual({ cgst: 13.5, sgst: 13.5 });
    expect(splitGst(1)).toEqual({ cgst: 0.5, sgst: 0.5 });
    for (let t = 0; t <= 5000; t++) {
      const { cgst, sgst } = splitGst(t);
      expect(cgst).toBe(sgst);
      expect(Math.round((cgst + sgst) * 100)).toBe(t * 100);
    }
  });
});

describe('amount in words (Indian system)', () => {
  it('reads rupees like an Indian bill', () => {
    expect(amountInWords(536)).toBe('Five hundred thirty-six rupees only');
    expect(amountInWords(1)).toBe('One rupee only');
    expect(amountInWords(0)).toBe('Zero rupees only');
    expect(amountInWords(40)).toBe('Forty rupees only');
    expect(amountInWords(1021)).toBe('One thousand twenty-one rupees only');
    expect(amountInWords(125000)).toBe('One lakh twenty-five thousand rupees only');
    expect(amountInWords(12.5)).toBe('Twelve rupees and fifty paise only');
  });

  it('handles lakhs and crores', () => {
    expect(numberInWords(99_999)).toBe('ninety-nine thousand nine hundred ninety-nine');
    expect(numberInWords(10_00_000)).toBe('ten lakh');
    expect(numberInWords(1_23_45_678)).toBe('one crore twenty-three lakh forty-five thousand six hundred seventy-eight');
    expect(numberInWords(100)).toBe('one hundred');
    expect(numberInWords(110)).toBe('one hundred ten');
  });
});

describe('buildInvoice', () => {
  const lines = [item('l1', 'Caramel Macchiato', 290, 2, 120), item('l2', 'Butter Croissant', 180, 1)];

  it('adds up: taxable value + CGST + SGST + delivery fee + tip = the order total', () => {
    const cases = [
      order('pickup', lines),
      order('dine_in', lines),
      order('delivery', [item('l3', 'Cold Brew', 260, 1)], {}, 20),
      order('delivery', lines, {}, 0),
      order('in_car', [item('l4', 'Caffè Latte', 250, 1)]),
    ];
    for (const o of cases) {
      const inv = buildInvoice(o);
      const get = (key: string) => inv.rows.find((r) => r.key === key)?.amount ?? 0;
      const sum = get('taxable') + get('cgst') + get('sgst') + get('delivery') + get('tip');
      expect(Math.round(sum * 100) / 100).toBe(o.totals.total);
      expect(inv.grandTotal).toBe(o.totals.total);
      expect(get('cgst') + get('sgst')).toBe(o.totals.tax);
    }
  });

  it('lays out a delivery order with packaging, the fee and a non-taxable tip', () => {
    const o = order('delivery', [item('l3', 'Cold Brew', 260, 1)], { couponCode: undefined }, 20);
    const inv = buildInvoice(o);
    // ₹260 + ₹15 packaging = ₹275 taxable → GST ₹13.75 → ₹14 → ₹7 + ₹7; + ₹40 fee + ₹20 tip.
    expect(inv.rows.map((r) => [r.label, r.amount])).toEqual([
      ['Item total', 260],
      ['Packaging', 15],
      ['Taxable value', 275],
      ['CGST @ 2.5%', 7],
      ['SGST @ 2.5%', 7],
      ['Delivery fee', 40],
      ['Delivery partner tip (not taxed)', 20],
    ]);
    expect(inv.grandTotal).toBe(349);
    expect(inv.grandTotalWords).toBe('Three hundred forty-nine rupees only');
    expect(inv.number).toBe('ER/2026-27/004827');
    expect(inv.placeOfSupply).toBe('Karnataka (29)');
    expect(inv.customer).toEqual({ name: 'Ava Stone', phone: '+91 98XXX XX210', address: 'Flat 4B, Sunrise Residency, 6th Cross, Domlur, Bengaluru 560071' });
    expect(inv.payment).toEqual([
      { label: 'Paid via', value: 'Google Pay (UPI)' },
      { label: 'UPI Ref No.', value: '612345678901' },
      { label: 'Transaction ID', value: 'TXN8F3K2M1Q9Z' },
    ]);
  });

  it('lists items with quantity, rate (with modifiers) and amount', () => {
    const inv = buildInvoice(order('pickup', lines));
    expect(inv.lines.map((l) => [l.name, l.detail, l.qty, l.rate, l.amount])).toEqual([
      ['Caramel Macchiato', 'Medium', 2, 410, 820],
      ['Butter Croissant', undefined, 1, 180, 180],
    ]);
  });

  it('shows the discount by its code and reads totals saved before packaging', () => {
    const legacy = order('pickup', lines, {
      couponCode: 'WELCOME10',
      totals: { subtotal: 1000, discount: 100, tax: 45, deliveryFee: 0, total: 945 },
      payment: undefined,
      paymentMethod: 'card',
    });
    const inv = buildInvoice(legacy);
    expect(inv.rows.map((r) => r.key)).toEqual(['itemTotal', 'discount', 'taxable', 'cgst', 'sgst']);
    expect(inv.rows[1]).toMatchObject({ label: 'Discount (WELCOME10)', amount: -100 });
    expect(inv.rows.find((r) => r.key === 'cgst')?.amount).toBe(22.5);
    expect(inv.payment).toEqual([{ label: 'Paid via', value: 'Visa •••• 4242' }]);
  });

  it('cash on delivery reads as collected once delivered', () => {
    const cod = order('delivery', lines, { paymentMethod: 'cod', paymentStatus: 'pending', payment: { methodId: 'pm-cod', label: 'Cash on delivery' } });
    expect(buildInvoice(cod).payment).toEqual([{ label: 'Payment', value: 'Cash on delivery · collected' }]);
    expect(buildInvoice(cod).status).toBe('Paid');
  });

  it('exists for paid or completed orders only', () => {
    expect(hasInvoice(order('pickup', lines))).toBe(true);
    expect(hasInvoice(order('pickup', lines, { status: 'preparing' }))).toBe(true);
    expect(hasInvoice(order('pickup', lines, { status: 'cancelled', paymentStatus: 'refunded' }))).toBe(false);
    expect(hasInvoice(order('pickup', lines, { history: [], paymentStatus: 'pending', status: 'placed' }))).toBe(false);
    expect(hasInvoice(order('pickup', lines, { paymentStatus: 'pending', status: 'preparing', paymentMethod: 'pay_at_store' }))).toBe(false);
  });

  it('has a plain-text version for sharing', () => {
    const text = invoiceText(buildInvoice(order('delivery', [item('l3', 'Cold Brew', 260, 1)], {}, 20)));
    expect(text).toContain('TAX INVOICE');
    expect(text).toContain('GSTIN 29AAHCE1234F1Z5 · FSSAI Lic. No. 11224333000123');
    expect(text).toContain('Invoice no. ER/2026-27/004827');
    expect(text).toContain('1 × Cold Brew @ ₹260.00 = ₹260.00');
    expect(text).toContain('SAC 996331');
    expect(text).toContain('Grand total: ₹349.00');
    expect(text).toContain('Three hundred forty-nine rupees only');
    expect(text).toContain('Prototype — not a valid tax invoice.');
  });
});
