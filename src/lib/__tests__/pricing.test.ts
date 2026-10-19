import { COUPONS } from '@/data/mock/marketing';
import { PRODUCTS } from '@/data/mock/menu';
import { MODIFIER_GROUPS } from '@/data/mock/modifiers';
import {
  computeTotals,
  deliveryFee,
  evaluateCoupon,
  formatTotalsLine,
  lineTotal,
  normalizeTip,
  packagingFee,
  parseTip,
  pointsForTotal,
  pointsForTotals,
  roundMoney,
  taxableValue,
  totalsBreakdown,
  unitPrice,
} from '@/lib/pricing';
import { brand, formatAmount, formatMoney, TAX_LINE_LABEL } from '@/theme/brand';
import type { SelectedModifierSnapshot } from '@/types/models';

const mod = (priceDelta: number): SelectedModifierSnapshot => ({
  groupId: 'g',
  groupName: 'G',
  optionId: `o${priceDelta}`,
  optionName: 'O',
  priceDelta,
});
const coupon = (code: string) => COUPONS.find((c) => c.code === code)!;

describe('currency (INR, whole rupees)', () => {
  it('is configured for India', () => {
    expect(brand.currency).toEqual({ code: 'INR', symbol: '₹', locale: 'en-IN', decimals: 0 });
    expect(brand.taxRate).toBe(0.05);
    expect(TAX_LINE_LABEL).toBe('GST (5%)');
  });

  it('rounds money to whole rupees, half up', () => {
    expect(roundMoney(14.5)).toBe(15);
    expect(roundMoney(14.49)).toBe(14);
    expect(roundMoney(2.5)).toBe(3);
    expect(roundMoney(0.1 + 0.2)).toBe(0);
    expect(roundMoney(249.99)).toBe(250);
  });

  it('formats with ₹ and Indian digit grouping, no paise', () => {
    expect(formatMoney(0)).toBe('₹0');
    expect(formatMoney(40)).toBe('₹40');
    expect(formatMoney(250)).toBe('₹250');
    expect(formatMoney(1250)).toBe('₹1,250');
    expect(formatMoney(99999)).toBe('₹99,999');
    expect(formatMoney(125000)).toBe('₹1,25,000');
    expect(formatMoney(12345678)).toBe('₹1,23,45,678');
    expect(formatMoney(249.6)).toBe('₹250');
    expect(formatAmount(1000)).toBe('1,000');
  });

  it('negatives use a typographic minus and never show "−₹0"', () => {
    expect(formatMoney(-40)).toBe('−₹40');
    expect(formatMoney(-0.4)).toBe('₹0');
    expect(formatMoney(-0.5)).toBe('−₹1');
    expect(formatMoney(-1.5)).toBe('−₹2');
  });

  it('rounds negatives symmetrically and never returns −0', () => {
    expect(roundMoney(-14.5)).toBe(-15);
    expect(roundMoney(-14.49)).toBe(-14);
    expect(Object.is(roundMoney(-0.4), 0)).toBe(true);
    expect(Object.is(roundMoney(-0), 0)).toBe(true);
  });
});

describe('whole-rupee invariants (every subtotal ₹0–₹20,000)', () => {
  // Exact half-up integer arithmetic to compare the float paths against.
  const halfUp = (num: number, den: number) => Math.floor((2 * num + den) / (2 * den));

  it('GST, coupon discounts and points never carry paise or float drift', () => {
    const misses: string[] = [];
    for (let s = 0; s <= 20_000; s++) {
      const items = [{ basePrice: s, modifiers: [], quantity: 1 }];
      const gst = computeTotals({ items, mode: 'dine_in' }).tax;
      if (gst !== halfUp(s * 5, 100)) misses.push(`GST ${s}: ${gst}`);
      // Takeaway: GST on the ₹15 packaging too.
      const packedGst = computeTotals({ items, mode: 'pickup' }).tax;
      if (packedGst !== halfUp((s + 15) * 5, 100)) misses.push(`packed GST ${s}: ${packedGst}`);
      const w10 = evaluateCoupon(coupon('WELCOME10'), s);
      if (!w10.ok || w10.discount !== halfUp(s * 10, 100)) misses.push(`WELCOME10 ${s}`);
      const f20 = evaluateCoupon(coupon('FIRST20'), s);
      if (!f20.ok || f20.discount !== Math.min(150, halfUp(s * 20, 100))) misses.push(`FIRST20 ${s}`);
      if (pointsForTotal(s) !== Math.floor(s / 5)) misses.push(`points ${s}: ${pointsForTotal(s)}`);
      const t = computeTotals({ items, mode: 'delivery', coupon: coupon('FIRST20'), rewardValue: 50, tip: s % 37 });
      if (!Object.values(t).every(Number.isInteger)) misses.push(`totals ${s}: ${JSON.stringify(t)}`);
      if (t.total !== t.subtotal - t.discount + (t.packaging ?? 0) + t.tax + t.deliveryFee + (t.tip ?? 0)) misses.push(`sum ${s}`);
    }
    expect(misses).toEqual([]);
  });

  it('every menu price and modifier delta is whole rupees', () => {
    const prices = PRODUCTS.flatMap((p) => [p.price, p.compareAtPrice ?? 0]);
    const deltas = MODIFIER_GROUPS.flatMap((g) => g.options.map((o) => o.priceDelta));
    expect([...prices, ...deltas].filter((v) => !Number.isInteger(v) || v < 0)).toEqual([]);
    // Every price is a multiple of ₹10, so a basket subtotal is too: the ₹499 free-delivery line is
    // effectively "from ₹500" (₹490 pays the fee, ₹500 doesn't).
    expect([...prices, ...deltas].filter((v) => v % 10 !== 0)).toEqual([]);
  });
});

describe('unit and line prices', () => {
  it('adds modifier deltas in whole rupees', () => {
    // Latte ₹250 + M ₹30 + oat ₹50 + vanilla ₹40
    expect(unitPrice(250, [mod(30), mod(50), mod(40)])).toBe(370);
    expect(unitPrice(160, [])).toBe(160);
  });
  it('multiplies by quantity', () => {
    expect(lineTotal({ basePrice: 290, modifiers: [mod(30)], quantity: 3 })).toBe(960);
  });
});

describe('coupons', () => {
  it('FIRST20: 20% off, capped at ₹150', () => {
    expect(evaluateCoupon(coupon('FIRST20'), 500)).toEqual({ ok: true, discount: 100 });
    expect(evaluateCoupon(coupon('FIRST20'), 1000)).toEqual({ ok: true, discount: 150 });
    expect(evaluateCoupon(coupon('FIRST20'), 333)).toEqual({ ok: true, discount: 67 }); // 66.6 → 67
  });
  it('EMBER100: ₹100 off from ₹500', () => {
    const fail = evaluateCoupon(coupon('EMBER100'), 499);
    expect(fail).toEqual({ ok: false, reason: 'min_subtotal', message: 'Add ₹1 more to use this code.' });
    expect(evaluateCoupon(coupon('EMBER100'), 500)).toEqual({ ok: true, discount: 100 });
    expect(evaluateCoupon(coupon('EMBER100'), 860)).toEqual({ ok: true, discount: 100 });
  });
  it('WELCOME10: 10% off, rounded to the rupee', () => {
    expect(evaluateCoupon(coupon('WELCOME10'), 580)).toEqual({ ok: true, discount: 58 });
    expect(evaluateCoupon(coupon('WELCOME10'), 333)).toEqual({ ok: true, discount: 33 });
  });
  it('the old EMBER5 code is gone', () => {
    expect(COUPONS.find((c) => c.code === 'EMBER5')).toBeUndefined();
  });
  it('inactive codes fail', () => {
    expect(evaluateCoupon(coupon('SUMMER25'), 900).ok).toBe(false);
  });
  it('never discounts more than the subtotal', () => {
    expect(evaluateCoupon({ ...coupon('EMBER100'), minSubtotal: undefined }, 60)).toEqual({ ok: true, discount: 60 });
  });
});

describe('delivery fee', () => {
  it('only applies to delivery, ₹40 under ₹499, free from ₹499', () => {
    expect(deliveryFee('pickup', 100)).toBe(0);
    expect(deliveryFee('delivery', 420)).toBe(40);
    expect(deliveryFee('delivery', 498)).toBe(40);
    expect(deliveryFee('delivery', 499)).toBe(0);
  });
});

describe('computeTotals', () => {
  const items = [
    { basePrice: 290, modifiers: [mod(30)], quantity: 2 }, // ₹640
    { basePrice: 180, modifiers: [], quantity: 1 }, // ₹180
  ];

  it('dine-in: subtotal + GST 5%, no packaging', () => {
    expect(computeTotals({ items, mode: 'dine_in' })).toEqual({
      subtotal: 820,
      discount: 0,
      packaging: 0,
      tax: 41,
      deliveryFee: 0,
      tip: 0,
      total: 861,
    });
  });

  it('pickup adds ₹15 packaging, and GST applies to it', () => {
    // GST 5% of ₹835 = ₹41.75 → ₹42
    expect(computeTotals({ items, mode: 'pickup' })).toEqual({
      subtotal: 820,
      discount: 0,
      packaging: 15,
      tax: 42,
      deliveryFee: 0,
      tip: 0,
      total: 877,
    });
    expect(packagingFee('pickup')).toBe(15);
    expect(packagingFee('in_car')).toBe(15);
    expect(packagingFee('delivery')).toBe(15);
    expect(packagingFee('dine_in')).toBe(0);
  });

  it('rounds GST half up to the rupee', () => {
    // 5% of ₹290 = ₹14.50 → ₹15
    expect(computeTotals({ items: [{ basePrice: 290, modifiers: [], quantity: 1 }], mode: 'dine_in' })).toMatchObject({
      subtotal: 290,
      discount: 0,
      tax: 15,
      deliveryFee: 0,
      total: 305,
    });
  });

  it('delivery with coupon and reward: GST on the discounted amount, fee on the gross subtotal', () => {
    const small = [
      { basePrice: 250, modifiers: [mod(30)], quantity: 1 }, // ₹280
      { basePrice: 140, modifiers: [], quantity: 1 }, // ₹140
    ];
    const t = computeTotals({ items: small, mode: 'delivery', coupon: coupon('FIRST20'), rewardValue: 50 });
    expect(t).toEqual({
      subtotal: 420,
      discount: 134, // 20% of 420 = 84, + ₹50 reward
      packaging: 15, // never discounted
      tax: 15, // 5% of (286 + 15) = 15.05
      deliveryFee: 40,
      tip: 0,
      total: 356,
    });
    for (const v of Object.values(t)) expect(Number.isInteger(v)).toBe(true);
  });

  it('free delivery once the subtotal reaches ₹499', () => {
    expect(computeTotals({ items, mode: 'delivery' }).deliveryFee).toBe(0);
  });

  it('ignores coupons that do not qualify', () => {
    expect(computeTotals({ items: [{ basePrice: 250, modifiers: [], quantity: 1 }], mode: 'pickup', coupon: coupon('EMBER100') }).discount).toBe(0);
  });

  it('delivery fee edge: ₹40 below ₹499, free at ₹499 and ₹500, judged on the subtotal before discounts', () => {
    const at = (s: number, c?: string) =>
      computeTotals({ items: [{ basePrice: s, modifiers: [], quantity: 1 }], mode: 'delivery', coupon: c ? coupon(c) : null });
    expect(at(490).deliveryFee).toBe(40);
    expect(at(498).deliveryFee).toBe(40);
    expect(at(499).deliveryFee).toBe(0);
    expect(at(500).deliveryFee).toBe(0);
    // ₹500 with EMBER100: ₹100 off, GST on ₹400 + ₹15 packaging, delivery stays free.
    expect(at(500, 'EMBER100')).toEqual({ subtotal: 500, discount: 100, packaging: 15, tax: 21, deliveryFee: 0, tip: 0, total: 436 });
    // ₹490 can't use EMBER100 and pays the fee.
    expect(at(490, 'EMBER100')).toEqual({ subtotal: 490, discount: 0, packaging: 15, tax: 25, deliveryFee: 40, tip: 0, total: 570 });
  });

  it('FIRST20 caps at ₹150 from a ₹750 subtotal', () => {
    expect(evaluateCoupon(coupon('FIRST20'), 740)).toEqual({ ok: true, discount: 148 });
    expect(evaluateCoupon(coupon('FIRST20'), 750)).toEqual({ ok: true, discount: 150 });
    expect(evaluateCoupon(coupon('FIRST20'), 2000)).toEqual({ ok: true, discount: 150 });
  });

  it('SUMMER25 is expired and takes nothing off', () => {
    expect(evaluateCoupon(coupon('SUMMER25'), 900)).toEqual({ ok: false, reason: 'inactive', message: 'This code has expired.' });
    const items = [{ basePrice: 900, modifiers: [], quantity: 1 }];
    expect(computeTotals({ items, mode: 'pickup', coupon: coupon('SUMMER25') }).discount).toBe(0);
  });

  it('a whole-order reward bigger than the basket stops at the subtotal (packaging and the fee are still due)', () => {
    const items = [{ basePrice: 420, modifiers: [], quantity: 1 }];
    expect(computeTotals({ items, mode: 'delivery', coupon: coupon('WELCOME10'), rewardValue: 500 })).toEqual({
      subtotal: 420,
      discount: 420,
      packaging: 15,
      tax: 1, // 5% of ₹15 = 0.75
      deliveryFee: 40,
      tip: 0,
      total: 56,
    });
  });

  it('empty delivery cart only carries the fee (nothing to pack)', () => {
    expect(computeTotals({ items: [], mode: 'delivery' })).toMatchObject({ packaging: 0, total: 40 });
  });
});

describe('delivery partner tip', () => {
  const items = [{ basePrice: 420, modifiers: [], quantity: 1 }];

  it('is added after GST: never taxed, never discounted', () => {
    const t = computeTotals({ items, mode: 'delivery', tip: 20, coupon: coupon('WELCOME10') });
    // ₹420 − ₹42 + ₹15 = ₹393 taxable → GST ₹19.65 → ₹20; + ₹40 fee + ₹20 tip.
    expect(t).toEqual({ subtotal: 420, discount: 42, packaging: 15, tax: 20, deliveryFee: 40, tip: 20, total: 473 });
    // The tip changes nothing but the total.
    const untipped = computeTotals({ items, mode: 'delivery', coupon: coupon('WELCOME10') });
    expect({ ...t, tip: 0, total: t.total - 20 }).toEqual(untipped);
  });

  it('only exists for delivery', () => {
    expect(computeTotals({ items, mode: 'pickup', tip: 30 }).tip).toBe(0);
    expect(computeTotals({ items, mode: 'dine_in', tip: 30 }).total).toBe(441);
  });

  it('normalises to whole rupees between ₹1 and ₹500', () => {
    expect(normalizeTip('delivery', 10)).toBe(10);
    expect(normalizeTip('delivery', 0)).toBe(0);
    expect(normalizeTip('delivery', -5)).toBe(0);
    expect(normalizeTip('delivery', Number.NaN)).toBe(0);
    expect(normalizeTip('delivery', 12.6)).toBe(13);
    expect(normalizeTip('delivery', 5000)).toBe(500);
    expect(normalizeTip('in_car', 20)).toBe(0);
  });

  it('parses an "Other" amount of ₹1–₹500', () => {
    expect(parseTip('25')).toBe(25);
    expect(parseTip('₹ 40')).toBe(40);
    expect(parseTip('500')).toBe(500);
    expect(parseTip('501')).toBeNull();
    expect(parseTip('0')).toBeNull();
    expect(parseTip('')).toBeNull();
  });

  it('earns no loyalty points', () => {
    const t = computeTotals({ items, mode: 'delivery', tip: 30 });
    expect(pointsForTotals(t)).toBe(pointsForTotal(t.total - 30));
  });
});

describe('totalsBreakdown (summary card, receipts, invoice)', () => {
  it('lists subtotal, discount, packaging, GST, delivery and tip in order', () => {
    const t = computeTotals({ items: [{ basePrice: 420, modifiers: [], quantity: 1 }], mode: 'delivery', tip: 20, coupon: coupon('WELCOME10') });
    const lines = totalsBreakdown(t, 'delivery');
    expect(lines.map((l) => [l.label, formatTotalsLine(l)])).toEqual([
      ['Subtotal', '₹420'],
      ['Discount', '−₹42'],
      ['Packaging', '₹15'],
      ['GST (5%)', '₹20'],
      ['Delivery fee', '₹40'],
      ['Delivery partner tip', '₹20'],
    ]);
    expect(taxableValue(t)).toBe(393);
  });

  it('shows free delivery and skips empty rows', () => {
    const t = computeTotals({ items: [{ basePrice: 600, modifiers: [], quantity: 1 }], mode: 'delivery' });
    expect(totalsBreakdown(t, 'delivery').map((l) => [l.key, formatTotalsLine(l)])).toEqual([
      ['subtotal', '₹600'],
      ['packaging', '₹15'],
      ['tax', '₹31'],
      ['delivery', 'Free'],
    ]);
    const dineIn = computeTotals({ items: [{ basePrice: 600, modifiers: [], quantity: 1 }], mode: 'dine_in' });
    expect(totalsBreakdown(dineIn, 'dine_in').map((l) => l.key)).toEqual(['subtotal', 'tax']);
  });

  it('reads totals saved before packaging and tips existed', () => {
    const legacy = { subtotal: 590, discount: 0, tax: 30, deliveryFee: 0, total: 620 };
    expect(totalsBreakdown(legacy, 'pickup').map((l) => l.key)).toEqual(['subtotal', 'tax']);
    expect(taxableValue(legacy)).toBe(590);
    expect(pointsForTotals(legacy)).toBe(124);
  });
});

describe('loyalty', () => {
  it('1 point per ₹5, floored', () => {
    expect(pointsForTotal(861)).toBe(172);
    expect(pointsForTotal(4)).toBe(0);
    expect(pointsForTotal(5)).toBe(1);
    expect(pointsForTotal(35)).toBe(7);
  });
});
