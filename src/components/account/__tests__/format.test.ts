import { describe, expect, it } from '@jest/globals';
import type { LoyaltyTransaction, Order, Reward } from '@/types/models';
import {
  countdown,
  displayPhone,
  groupOrdersByDay,
  nextRewardProgress,
  paymentMethodIcon,
  paymentMethodLabel,
  paymentStatusMeta,
  pickupCode,
  pseudoQrPath,
  refundCopy,
  ringProgress,
  signedPoints,
  sortTransactions,
  stampState,
  ticketCode,
  ticketPath,
  tierFor,
} from '../format';

const order = (over: Partial<Order>): Order =>
  ({
    id: 'o1',
    number: 'ER-4827',
    createdAt: new Date(2026, 9, 7, 9, 0).toISOString(),
    details: { mode: 'pickup' },
    items: [],
    totals: { subtotal: 0, discount: 0, tax: 0, deliveryFee: 0, total: 0 },
    status: 'placed',
    history: [],
    paymentStatus: 'paid',
    paymentMethod: 'card',
    customer: { name: 'Ava', phone: '9876543210' },
    etaMinutes: 8,
    pointsEarned: 0,
    ...over,
  }) as Order;

const REWARDS: Reward[] = [
  { id: 'a', name: 'Shot', description: '', cost: 150, image: '', value: 1 },
  { id: 'b', name: 'Pastry', description: '', cost: 400, image: '', value: 3 },
  { id: 'c', name: 'Drink', description: '', cost: 600, image: '', value: 5 },
];

describe('pickupCode', () => {
  it('is a letter plus the last two digits, stable per order number', () => {
    expect(pickupCode({ number: 'ER-4827' })).toMatch(/^[A-Z]27$/);
    expect(pickupCode({ number: 'ER-4827' })).toBe(pickupCode({ number: 'ER-4827' }));
    expect(pickupCode({ number: 'ER-1005' })).toMatch(/^[A-Z]05$/);
  });
  it('never uses I, O or Q', () => {
    for (let n = 1000; n < 9999; n += 37) expect(pickupCode({ number: `ER-${n}` })).not.toMatch(/[IOQ]/);
  });
});

describe('countdown', () => {
  it('formats mm:ss and flags overdue', () => {
    const o = order({});
    const start = new Date(o.createdAt).getTime();
    expect(countdown(o, start)).toEqual({ text: '8:00', minutes: 8, overdue: false });
    expect(countdown(o, start + 60_000 * 6 + 18_000).text).toBe('1:42');
    expect(countdown(o, start + 60_000 * 9)).toEqual({ text: '0:00', minutes: 0, overdue: true });
  });
});

describe('payment copy', () => {
  it('labels methods and statuses', () => {
    // Older orders (no payment snapshot) fall back to their method type.
    expect(paymentMethodLabel(order({ paymentMethod: 'card' }))).toBe('Visa •••• 4242');
    expect(paymentMethodLabel(order({ paymentMethod: 'pay_at_store' }))).toBe('Pay at the counter');
    // Round 4: the frozen label wins, so a PhonePe or UPI ID order never reads "Google Pay".
    expect(paymentMethodLabel(order({ paymentMethod: 'upi', payment: { methodId: 'pm-phonepe', label: 'PhonePe', upiApp: 'phonepe' } }))).toBe('PhonePe');
    expect(paymentMethodLabel(order({ paymentMethod: 'upi', payment: { methodId: 'pm-upi-id', label: 'UPI · ava@okicici', vpa: 'ava@okicici' } }))).toBe('UPI · ava@okicici');
    expect(paymentStatusMeta(order({ paymentStatus: 'paid' })).label).toBe('Paid');
    expect(paymentStatusMeta(order({ paymentStatus: 'refunded' })).label).toBe('Refunded');
    expect(paymentStatusMeta(order({ paymentStatus: 'pending', paymentMethod: 'pay_at_store' })).label).toBe('Pay at counter');
    expect(paymentStatusMeta(order({ paymentStatus: 'pending', paymentMethod: 'cod' })).label).toBe('Pay on delivery');
    expect(paymentStatusMeta(order({ paymentStatus: 'pending', paymentMethod: 'upi' })).label).toBe('Pending');
  });
  it('gives UPI and cash their own glyphs', () => {
    expect(paymentMethodIcon('upi')).toBe('phone-portrait-outline');
    expect(paymentMethodIcon('cod')).toBe('cash-outline');
    expect(paymentMethodIcon('card')).toBe('card-outline');
  });
});

describe('groupOrdersByDay', () => {
  it('groups newest first under relative day titles', () => {
    const now = new Date(2026, 9, 7, 12, 0);
    const today = order({ id: 't', createdAt: new Date(2026, 9, 7, 8).toISOString() });
    const today2 = order({ id: 't2', createdAt: new Date(2026, 9, 7, 10).toISOString() });
    const yesterday = order({ id: 'y', createdAt: new Date(2026, 9, 6, 8).toISOString() });
    const sections = groupOrdersByDay([yesterday, today, today2], now);
    expect(sections.map((s) => s.title)).toEqual(['Today', 'Yesterday']);
    expect(sections[0]?.orders.map((o) => o.id)).toEqual(['t2', 't']);
  });
});

describe('loyalty', () => {
  it('picks tiers by lifetime points', () => {
    expect(tierFor(0).tier.name).toBe('Ember Newcomer');
    expect(tierFor(560).tier.name).toBe('Ember Regular');
    expect(tierFor(560).next?.name).toBe('Ember Insider');
    expect(tierFor(99_999).next).toBeUndefined();
  });
  it('finds the next reward out of reach', () => {
    expect(nextRewardProgress(250, REWARDS)).toEqual({ next: REWARDS[1], ratio: 250 / 400, remaining: 150 });
    expect(nextRewardProgress(700, REWARDS)).toEqual({ next: undefined, ratio: 1, remaining: 0 });
  });
  it('fills the stamp card modulo 10', () => {
    expect(stampState(0)).toMatchObject({ stamps: 0, toGo: 10 });
    expect(stampState(3)).toMatchObject({ stamps: 3, caption: '10th drink free · 7 to go' });
    expect(stampState(7)).toMatchObject({ stamps: 7, caption: '10th drink free · 3 to go' });
    expect(stampState(9).caption).toBe('Your next drink is free');
    expect(stampState(10)).toMatchObject({ stamps: 0 });
    expect(stampState(10).caption).toMatch(/Card complete/);
  });
  it('sorts and signs transactions', () => {
    const txns: LoyaltyTransaction[] = [
      { id: '1', type: 'bonus', points: 150, description: 'Welcome', createdAt: '2026-10-01T10:00:00.000Z' },
      { id: '2', type: 'redeem', points: -400, description: 'Pastry', createdAt: '2026-10-05T10:00:00.000Z' },
    ];
    expect(sortTransactions(txns).map((t) => t.id)).toEqual(['2', '1']);
    expect(signedPoints(164)).toBe('+164');
    expect(signedPoints(-400)).toBe('−400');
  });
});

describe('codes and shapes', () => {
  it('makes stable ticket codes', () => {
    const code = ticketCode('rw-pastry', '9876543210');
    expect(code).toMatch(/^ER-[2-9A-Z]{4}$/);
    expect(ticketCode('rw-pastry', '9876543210')).toBe(code);
    expect(ticketCode('rw-drink', '9876543210')).not.toBe(code);
  });
  it('draws a deterministic QR-like path with finder squares', () => {
    const d = pseudoQrPath('ER-7Q4K', 132);
    expect(d).toBe(pseudoQrPath('ER-7Q4K', 132));
    expect(d.startsWith('M0 0h')).toBe(true);
    expect(d).not.toContain('NaN');
  });
  it('outlines a ticket with two notches', () => {
    const d = ticketPath(300, 400, 200);
    expect(d.match(/A13 13/g)).toHaveLength(2);
    expect(d.endsWith('Z')).toBe(true);
  });
  it('formats Indian mobiles with the +91 dial code, stored with or without it', () => {
    expect(displayPhone('9876543210')).toBe('+91 98765 43210');
    expect(displayPhone('+91 98765 43210')).toBe('+91 98765 43210');
    expect(displayPhone(null)).toBe('');
  });
});

describe('live tracking', () => {
  const placedAt = new Date(2026, 9, 7, 9, 0).getTime();
  const at = (minutes: number) => placedAt + minutes * 60_000;

  it('moves the ring with the countdown and closes it only when ready', () => {
    const preparing = order({ status: 'preparing', etaMinutes: 8 });
    expect(ringProgress(preparing, at(4))).toBeCloseTo(0.5, 2);
    expect(ringProgress(preparing, at(6))).toBeCloseTo(0.75, 2);
    // Past the ETA but not ready yet: almost full, never the "done" 100%.
    expect(ringProgress(preparing, at(30))).toBe(0.97);
    expect(ringProgress(order({ status: 'ready' }), at(1))).toBe(1);
  });
  it('never shows an empty ring and never lags the current step', () => {
    expect(ringProgress(order({ status: 'placed' }), at(0))).toBe(0.06);
    // Out for delivery is step 3 of 4: at least 30% even right after it starts.
    const road = order({ status: 'out_for_delivery', details: { mode: 'delivery' }, etaMinutes: 26 });
    expect(ringProgress(road, at(1))).toBeCloseTo(0.3, 2);
  });
  it('says the same thing about refunds before and after cancelling', () => {
    const paid = order({ totals: { subtotal: 1240, discount: 0, tax: 62, deliveryFee: 0, total: 1302 } });
    expect(refundCopy(paid, 'ask')).toBe('We’ll refund ₹1,302 to Visa •••• 4242 now. It can take 3–5 days to show on your statement.');
    expect(refundCopy(paid, 'done')).toContain('It can take 3–5 days to show on your statement.');
    const upi = order({ paymentMethod: 'upi', payment: { methodId: 'pm-phonepe', label: 'PhonePe', upiApp: 'phonepe' }, totals: paid.totals });
    expect(refundCopy(upi, 'ask')).toBe('We’ll refund ₹1,302 to PhonePe now. It can take 3–5 days to show on your statement.');
  });
});
