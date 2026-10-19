/**
 * Order ownership, loyalty and promo rules in the mock API (QA findings Q-03, Q-04, Q-08, Q-14, Q-16,
 * Q-24, Q-05). Runs against the real in-memory store with zero latency.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/* eslint-disable import/first */
import {
  availablePaymentMethods,
  cancelOrder,
  createOrder,
  findCoupon,
  getOrders,
  isValidVpa,
  lastPaymentChoice,
  orderPaymentLabel,
  OtpError,
  payOrder,
  PaymentError,
  vpaIssue,
  reorderableLines,
  resolveModifierGroups,
  rewardDiscountFor,
  saveProfile,
  sendOtp,
  validateCoupon,
  verifyOtp,
  type PlaceOrderInput,
} from '@/api';
import { db, orderOwner } from '@/api/mockDb';
import { stopOrderSimulator } from '@/api/simulator';
import { SEED_ADDRESSES } from '@/data/mock/marketing';
import { PRODUCTS } from '@/data/mock/menu';
import { effectivePickupTime, pickupSlots } from '@/lib/format';
import { computeTotals } from '@/lib/pricing';
import { useDemo } from '@/store/demo';
import type { CartItem, OrderItem } from '@/types/models';

const OWNER = '9876543210';

function line(productId: string, quantity = 1): CartItem {
  const p = PRODUCTS.find((x) => x.id === productId)!;
  return { id: `l-${productId}`, productId, name: p.name, image: p.image, basePrice: p.price, quantity, modifiers: [], configKey: productId };
}

function input(extra: Partial<PlaceOrderInput> = {}): PlaceOrderInput {
  return {
    phone: OWNER,
    customer: { name: 'Ava Stone', phone: OWNER },
    details: { mode: 'pickup', pickupTime: 'asap' },
    items: [line('croissant')],
    paymentMethod: 'card',
    ...extra,
  };
}

function seedPoints(points: number) {
  db.set({ loyalty: { [OWNER]: { balance: points, lifetime: points, transactions: [] } } });
}

beforeEach(() => {
  db.reset();
  useDemo.setState({ latencyMs: 0, offline: false, fastStatus: false, forceStoreOpen: true });
});
afterAll(() => stopOrderSimulator());

describe('ownership (Q-03)', () => {
  it('an edited contact phone still lists the order and moves points on the owner account', async () => {
    seedPoints(610);
    const order = await createOrder(input({ customer: { name: 'Ava Stone', phone: '+91 98765 43210' }, rewardId: 'rw-drink', items: [line('latte')] }));
    expect(order.customer.phone).toBe('9876543210'); // +91 stripped: the bare national number, for display/SMS
    expect(orderOwner(order)).toBe(OWNER);
    await payOrder(order.id);
    expect((await getOrders(OWNER)).map((o) => o.id)).toContain(order.id);
    expect(db.loyaltyFor(OWNER).balance).toBe(10); // 610 − 600, charged to the owner
    expect(Object.keys(db.get().loyalty)).toEqual([OWNER]); // no phantom account
  });

  it('a different contact number never becomes the owner', async () => {
    const order = await createOrder(input({ customer: { name: 'Ava', phone: '9845012345' } }));
    expect(orderOwner(order)).toBe(OWNER);
    expect(order.customer.phone).toBe('9845012345');
  });
});

describe('rewards (Q-04, Q-24)', () => {
  it('refuses a reward the account cannot afford', async () => {
    seedPoints(449);
    await expect(createOrder(input({ rewardId: 'rw-500off' }))).rejects.toThrow(/1,000 points/);
  });

  it('rejects an overdraft redeem instead of clamping to zero', () => {
    seedPoints(100);
    const ok = db.addLoyalty(OWNER, { id: 't', type: 'redeem', points: -150, description: 'x', createdAt: '' });
    expect(ok).toBe(false);
    expect(db.loyaltyFor(OWNER).balance).toBe(100);
  });

  it('item rewards need an eligible item and are capped at the cheapest one', () => {
    const coffeeOnly = [line('latte')];
    expect(rewardDiscountFor('rw-pastry', coffeeOnly)).toEqual({ discount: 0, eligible: false });
    const withPastry = [line('latte'), line('croissant')];
    const croissant = PRODUCTS.find((p) => p.id === 'croissant')!.price;
    expect(rewardDiscountFor('rw-pastry', withPastry)).toEqual({ discount: Math.min(180, croissant), eligible: true });
    expect(rewardDiscountFor('rw-500off', coffeeOnly).discount).toBe(500);
    // A ₹300 drink reward on a ₹250 latte takes ₹250 off (capped at the item), in whole rupees.
    expect(rewardDiscountFor('rw-drink', coffeeOnly)).toEqual({ discount: 250, eligible: true });
    expect(rewardDiscountFor('rw-shot', coffeeOnly)).toEqual({ discount: 50, eligible: true });
  });

  it('cancelling refunds points without inflating lifetime (Q-14)', async () => {
    seedPoints(610);
    const order = await createOrder(input({ rewardId: 'rw-pastry' }));
    await payOrder(order.id);
    const lifetimeBefore = db.loyaltyFor(OWNER).lifetime;
    await cancelOrder(order.id);
    expect(db.loyaltyFor(OWNER).balance).toBe(610);
    expect(db.loyaltyFor(OWNER).lifetime).toBe(lifetimeBefore);
  });
});

describe('first-order coupon (Q-24)', () => {
  it('FIRST20 works on a first order and is refused afterwards', async () => {
    expect((await validateCoupon('FIRST20', 500, OWNER)).ok).toBe(true);
    const first = await createOrder(input({ couponCode: 'FIRST20' }));
    await payOrder(first.id);
    const again = await validateCoupon('FIRST20', 500, OWNER);
    expect(again.ok).toBe(false);
    await expect(createOrder(input({ couponCode: 'FIRST20' }))).rejects.toThrow(/first order/);
  });

  it('seeded demo history does not count as a first order', async () => {
    const phone = '9000011111';
    await saveProfile(phone, { name: 'New Customer' });
    expect(db.get().orders.filter((o) => orderOwner(o) === phone)).toHaveLength(2);
    expect((await validateCoupon('FIRST20', 500, phone)).ok).toBe(true);
  });
});

describe('INR seed data', () => {
  it('seeded demo history is priced in whole rupees with GST and points at 1 per ₹5', async () => {
    const phone = '9000022222';
    await saveProfile(phone, { name: 'Seed Check' });
    const orders = db.get().orders.filter((o) => orderOwner(o) === phone);
    const totals = orders.map((o) => o.totals).sort((a, b) => a.total - b.total);
    // Pickup: iced caramel macchiato M + oat + vanilla (₹410) + warm croissant (₹180) + ₹15 packaging,
    // GST 5% of ₹605 = ₹30.25 → ₹30. Dine-in (no packaging): 2 × latte L (₹620) + cheesecake (₹320).
    expect(totals).toEqual([
      { subtotal: 590, discount: 0, packaging: 15, tax: 30, deliveryFee: 0, tip: 0, total: 635 },
      { subtotal: 940, discount: 0, packaging: 0, tax: 47, deliveryFee: 0, tip: 0, total: 987 },
    ]);
    expect(orders.map((o) => o.pointsEarned).sort((a, b) => a - b)).toEqual([127, 197]);
    expect(db.loyaltyFor(phone).balance).toBe(150 + 127 + 197);
    // Paid by Google Pay (UPI, with a reference) and by the Visa; neither counts as "last used".
    expect(orders.map((o) => orderPaymentLabel(o)).sort()).toEqual(['Google Pay', 'Visa •••• 4242']);
    expect(orders.find((o) => o.paymentMethod === 'upi')?.payment?.upiRef).toMatch(/^\d{12}$/);
    expect(lastPaymentChoice(phone)).toEqual({ methodId: 'pm-gpay' });
  });

  it('EMBER100 needs a ₹500 basket and takes ₹100 off', async () => {
    const small = await validateCoupon('EMBER100', 360, OWNER);
    expect(small).toEqual({ ok: false, message: 'Add ₹140 more to use this code.' });
    const big = await validateCoupon('ember100', 640, OWNER);
    expect(big.ok && big.discount).toBe(100);
    expect((await validateCoupon('EMBER5', 640, OWNER)).ok).toBe(false);
  });
});

describe('INR orders: what is stored is what checkout showed', () => {
  const home = SEED_ADDRESSES.find((a) => a.id === 'addr-home')!;
  const cottage = SEED_ADDRESSES.find((a) => a.id === 'addr-cabin')!;

  /** A cart line with real menu options (so createOrder's availability check accepts it). */
  function lineWith(productId: string, optionIds: string[], quantity = 1): CartItem {
    const modifiers = resolveModifierGroups(productId).flatMap((g) =>
      g.options
        .filter((o) => optionIds.includes(o.id))
        .map((o) => ({ groupId: g.id, groupName: g.name, optionId: o.id, optionName: o.name, priceDelta: o.priceDelta })),
    );
    return { ...line(productId, quantity), id: `l-${productId}-${optionIds.join('-')}`, modifiers, configKey: `${productId}:${optionIds.join(',')}` };
  }

  it('delivery + WELCOME10 + Any pastry: totals, line totals, points and payment amount agree', async () => {
    seedPoints(610);
    // Iced caramel macchiato M + oat + vanilla (₹410) + banana bread (₹190) + cookie (₹140) = ₹740.
    const items = [lineWith('caramel-macchiato', ['size-m', 'temp-iced', 'milk-oat', 'syrup-vanilla']), line('banana-bread'), line('cookie')];
    const order = await createOrder(input({ items, couponCode: 'WELCOME10', rewardId: 'rw-pastry', details: { mode: 'delivery', address: home } }));
    const rewardValue = rewardDiscountFor('rw-pastry', items).discount;
    expect(rewardValue).toBe(140); // capped at the cheapest pastry in the basket (the cookie)
    expect(order.totals).toEqual(computeTotals({ items, mode: 'delivery', coupon: findCoupon('WELCOME10'), rewardValue }));
    // ₹74 (10%) + ₹140 reward off; + ₹15 packaging; GST 5% of ₹541 = ₹27.05 → ₹27; delivery free (≥ ₹499).
    expect(order.totals).toEqual({ subtotal: 740, discount: 214, packaging: 15, tax: 27, deliveryFee: 0, tip: 0, total: 568 });
    expect(order.items.map((i) => i.lineTotal)).toEqual([410, 190, 140]);
    expect(order.pointsEarned).toBe(113); // ⌊568 / 5⌋
    expect(order).toMatchObject({ couponCode: 'WELCOME10', rewardId: 'rw-pastry' });
    const payment = await payOrder(order.id);
    expect(payment.amount).toBe(568);
    expect(db.loyaltyFor(OWNER).balance).toBe(210); // 610 − 400
  });

  it('a ₹490 delivery pays the ₹40 fee; ₹500 delivers free', async () => {
    const small = await createOrder(input({ items: [line('cappuccino'), line('cold-brew')], details: { mode: 'delivery', address: home } }));
    expect(small.totals).toEqual({ subtotal: 490, discount: 0, packaging: 15, tax: 25, deliveryFee: 40, tip: 0, total: 570 });
    const big = await createOrder(input({ items: [line('latte', 2)], details: { mode: 'delivery', address: home } }));
    expect(big.totals).toEqual({ subtotal: 500, discount: 0, packaging: 15, tax: 26, deliveryFee: 0, tip: 0, total: 541 });
  });

  it('refuses delivery to the out-of-range Nandi Hills cottage', async () => {
    await expect(createOrder(input({ details: { mode: 'delivery', address: cottage } }))).rejects.toThrow(/deliver to this address/);
  });

  it('FIRST20 on a big first order stops at ₹150', async () => {
    const order = await createOrder(input({ items: [line('latte', 2), line('avocado-toast')], couponCode: 'FIRST20' }));
    // 20% of ₹920 = ₹184 → ₹150; + ₹15 packaging; GST 5% of ₹785 = ₹39.25 → ₹39.
    expect(order.totals).toEqual({ subtotal: 920, discount: 150, packaging: 15, tax: 39, deliveryFee: 0, tip: 0, total: 824 });
    expect(order.pointsEarned).toBe(164);
  });

  it('EMBER100 under ₹500 is left off the order instead of discounting it', async () => {
    const order = await createOrder(input({ items: [line('latte')], couponCode: 'EMBER100' }));
    expect(order.couponCode).toBeUndefined();
    expect(order.totals).toEqual({ subtotal: 250, discount: 0, packaging: 15, tax: 13, deliveryFee: 0, tip: 0, total: 278 });
  });
});

describe('UPI-first payments, tip and packaging', () => {
  const home = SEED_ADDRESSES.find((a) => a.id === 'addr-home')!;

  it('offers UPI apps, UPI ID and cards everywhere; cash on delivery or the counter by mode; never Apple Pay', () => {
    const ids = (mode: Parameters<typeof availablePaymentMethods>[0]) => availablePaymentMethods(mode).map((m) => m.id);
    const common = ['pm-gpay', 'pm-phonepe', 'pm-paytm', 'pm-bhim', 'pm-upi-id', 'pm-card', 'pm-rupay', 'pm-card-new'];
    expect(ids('delivery')).toEqual([...common, 'pm-cod']);
    for (const mode of ['pickup', 'dine_in', 'in_car'] as const) expect(ids(mode)).toEqual([...common, 'pm-store']);
    expect(availablePaymentMethods('pickup').some((m) => m.type === 'apple_pay' || m.type === 'google_pay')).toBe(false);
  });

  it('validates UPI IDs (name@handle)', () => {
    expect(isValidVpa('ava@okicici')).toBe(true);
    expect(isValidVpa('  Ava.Stone-1@OkAxis ')).toBe(true);
    expect(isValidVpa('98765 43210@ybl')).toBe(true); // spaces are dropped
    expect(isValidVpa('ava')).toBe(false);
    expect(isValidVpa('ava@')).toBe(false);
    expect(isValidVpa('a@okicici')).toBe(false);
    expect(isValidVpa('ava@1bank')).toBe(false);
    expect(vpaIssue('')).toMatch(/Enter your UPI ID/);
    expect(vpaIssue('ava')).toMatch(/after @/);
    expect(vpaIssue('ava@okicici')).toBeNull();
  });

  it('a UPI ID order needs a valid UPI ID and remembers it as the last method', async () => {
    const byId = { paymentMethod: 'upi' as const, paymentMethodId: 'pm-upi-id' };
    await expect(createOrder(input({ ...byId, vpa: 'ava' }))).rejects.toThrow(/after @/);
    const order = await createOrder(input({ ...byId, vpa: ' Ava@OKICICI ' }));
    expect(order.payment).toEqual({ methodId: 'pm-upi-id', label: 'UPI · ava@okicici', upiApp: undefined, vpa: 'ava@okicici' });
    expect(order.paymentStatus).toBe('pending');
    await payOrder(order.id);
    const paid = db.get().orders.find((o) => o.id === order.id)!;
    expect(paid.paymentStatus).toBe('paid');
    expect(paid.payment?.upiRef).toMatch(/^\d{12}$/);
    expect(paid.payment?.txnId).toMatch(/^TXN[0-9A-Z]{10}$/);
    expect(lastPaymentChoice(OWNER)).toEqual({ methodId: 'pm-upi-id', vpa: 'ava@okicici', used: true });
  });

  it('defaults to Google Pay, then to whatever was paid with last', async () => {
    expect(lastPaymentChoice(OWNER)).toEqual({ methodId: 'pm-gpay' });
    const order = await createOrder(input({ paymentMethod: 'upi', paymentMethodId: 'pm-phonepe' }));
    expect(lastPaymentChoice(OWNER)).toEqual({ methodId: 'pm-gpay' }); // not until it's confirmed
    await payOrder(order.id);
    expect(lastPaymentChoice(OWNER)).toEqual({ methodId: 'pm-phonepe', used: true });
  });

  it('a declined UPI payment stays unpaid with no reference', async () => {
    const order = await createOrder(input({ paymentMethod: 'upi', paymentMethodId: 'pm-paytm' }));
    await expect(payOrder(order.id, { simulateFailure: true })).rejects.toBeInstanceOf(PaymentError);
    const after = db.get().orders.find((o) => o.id === order.id)!;
    expect(after.paymentStatus).toBe('failed');
    expect(after.payment?.upiRef).toBeUndefined();
  });

  it('cash on delivery is delivery-only and confirms the order unpaid', async () => {
    await expect(createOrder(input({ paymentMethod: 'cod', paymentMethodId: 'pm-cod' }))).rejects.toThrow(/only for delivery/);
    const order = await createOrder(input({ paymentMethod: 'cod', paymentMethodId: 'pm-cod', details: { mode: 'delivery', address: home } }));
    const payment = await payOrder(order.id);
    expect(payment.status).toBe('pending');
    const after = db.get().orders.find((o) => o.id === order.id)!;
    expect(after.paymentStatus).toBe('pending');
    expect(after.history).toHaveLength(1);
    expect(orderPaymentLabel(after)).toBe('Cash on delivery');
    await expect(
      createOrder(input({ paymentMethod: 'pay_at_store', paymentMethodId: 'pm-store', details: { mode: 'delivery', address: home } })),
    ).rejects.toThrow(/isn’t available/);
  });

  it('pay at the counter works for in-car orders too', async () => {
    const car = { make: 'Hyundai Creta', color: 'White', plate: 'KA 03 MN 4521' };
    const order = await createOrder(input({ paymentMethod: 'pay_at_store', details: { mode: 'in_car', pickupTime: 'asap', car } }));
    expect(order.payment?.methodId).toBe('pm-store');
    expect(order.totals.packaging).toBe(15);
  });

  it('stores the delivery tip with the order: not taxed, no points, delivery only', async () => {
    const items = [line('cappuccino'), line('cold-brew')]; // ₹490
    const tipped = await createOrder(input({ items, tip: 30, details: { mode: 'delivery', address: home } }));
    expect(tipped.totals).toEqual({ subtotal: 490, discount: 0, packaging: 15, tax: 25, deliveryFee: 40, tip: 30, total: 600 });
    expect(tipped.pointsEarned).toBe(114); // ⌊570 / 5⌋: the tip earns nothing
    const pickup = await createOrder(input({ items, tip: 30 }));
    expect(pickup.totals.tip).toBe(0);
    const capped = await createOrder(input({ items, tip: 9000, details: { mode: 'delivery', address: home } }));
    expect(capped.totals.tip).toBe(500);
  });

  it('older callers without a method id still get a method of their type', async () => {
    const order = await createOrder(input({ paymentMethod: 'card' }));
    expect(order.payment).toMatchObject({ methodId: 'pm-card', label: 'Visa •••• 4242' });
    expect(orderPaymentLabel({ paymentMethod: 'apple_pay' })).toBe('Card');
  });
});

describe('coupon rules across order history', () => {
  it('FIRST20 comes back if the first order is cancelled', async () => {
    const first = await createOrder(input({ couponCode: 'FIRST20' }));
    await payOrder(first.id);
    expect((await validateCoupon('FIRST20', 500, OWNER)).ok).toBe(false);
    await cancelOrder(first.id);
    expect(await validateCoupon('FIRST20', 500, OWNER)).toMatchObject({ ok: true, discount: 100 });
  });

  it('WELCOME10 keeps working after the first order', async () => {
    const first = await createOrder(input());
    await payOrder(first.id);
    expect(await validateCoupon('WELCOME10', 580, OWNER)).toMatchObject({ ok: true, discount: 58 });
  });

  it('SUMMER25 is expired and unknown codes are refused', async () => {
    expect(await validateCoupon('SUMMER25', 900, OWNER)).toEqual({ ok: false, message: 'This code has expired.' });
    expect(await validateCoupon('EMBER5', 900, OWNER)).toEqual({ ok: false, message: 'We couldn’t find that code.' });
  });
});

describe('one phone format end to end (+91, stored as 10 digits)', () => {
  it('OTP → profile → seeded orders → points all key on the bare national number', async () => {
    const phone = '9845014229';
    await sendOtp(phone);
    await expect(verifyOtp(phone, '000000')).rejects.toBeInstanceOf(OtpError);
    expect(await verifyOtp(phone, '123456')).toEqual({ profile: null });
    const profile = await saveProfile(phone, { name: 'Priya Rao' });
    expect(profile.phone).toBe(phone);
    expect(Object.keys(db.get().profiles)).toEqual([phone]);
    const seeded = db.get().orders.filter((o) => orderOwner(o) === phone);
    expect(seeded).toHaveLength(2);
    for (const o of seeded) expect(o.customer.phone).toBe(phone);
    expect(Object.keys(db.get().loyalty)).toEqual([phone]);
    // Returning customer: the same number finds the profile.
    await sendOtp(phone);
    expect((await verifyOtp(phone, '123456')).profile?.id).toBe(profile.id);
  });

  it('a code sent to one number does not verify another', async () => {
    await sendOtp('9845014229');
    await expect(verifyOtp('9876543210', '123456')).rejects.toMatchObject({ reason: 'no_session' });
  });

  it('a contact number typed in any +91 form is stored as the national number', async () => {
    for (const typed of ['098765 43210', '+91 98765 43210', '0091 98765 43210', '98765-43210']) {
      const order = await createOrder(input({ customer: { name: 'Ava', phone: typed } }));
      expect(order.customer.phone).toBe('9876543210');
    }
    const blank = await createOrder(input({ customer: { name: 'Ava', phone: '' } }));
    expect(blank.customer.phone).toBe(OWNER);
  });
});

describe('availability (Q-08)', () => {
  it('reorder skips sold-out products and re-prices the rest', () => {
    const soldOut = PRODUCTS.find((p) => !p.isAvailable)!;
    const old: OrderItem[] = [
      { id: 'a', productId: soldOut.id, name: soldOut.name, image: soldOut.image, basePrice: 1, quantity: 1, modifiers: [], lineTotal: 1 },
      { id: 'b', productId: 'croissant', name: 'Butter Croissant', image: '', basePrice: 25, quantity: 2, modifiers: [], lineTotal: 50 },
    ];
    const { lines, skipped } = reorderableLines(old);
    expect(skipped).toEqual([soldOut.name]);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.basePrice).toBe(PRODUCTS.find((p) => p.id === 'croissant')!.price);
  });

  it('createOrder refuses sold-out items', async () => {
    const soldOut = PRODUCTS.find((p) => !p.isAvailable)!;
    await expect(createOrder(input({ items: [line(soldOut.id)] }))).rejects.toThrow(/sold out/);
  });
});

describe('unpaid orders (Q-16)', () => {
  it('placing again replaces the earlier never-paid order', async () => {
    const a = await createOrder(input());
    const b = await createOrder(input());
    const ids = db.get().orders.map((o) => o.id);
    expect(ids).toContain(b.id);
    expect(ids).not.toContain(a.id);
  });
});

describe('ETA follows the simulated timeline (Q-06, Q-07)', () => {
  it('quotes the real prep time by default and compresses it in fast mode', async () => {
    const normal = await createOrder(input());
    await payOrder(normal.id);
    const prep = PRODUCTS.find((p) => p.id === 'croissant')!.prepMinutes;
    expect(db.get().orders.find((o) => o.id === normal.id)?.etaMinutes).toBe(prep);

    useDemo.setState({ fastStatus: true });
    const quick = await createOrder(input());
    await payOrder(quick.id);
    expect(db.get().orders.find((o) => o.id === quick.id)?.etaMinutes).toBeCloseTo(9 / 60);
  });

  it('honours a future pickup slot: the ETA runs to the slot', async () => {
    // Pin the clock (Date only; real timers keep the mock network running) to midday: after about
    // 8:20 PM fewer than five slots are left before the 9 PM close and slot [4] doesn't exist.
    jest.useFakeTimers({
      now: new Date('2026-10-07T12:01:00'),
      doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'nextTick', 'queueMicrotask'],
    });
    try {
      const slot = pickupSlots(6, 10, 10, new Date())[4]!.id; // ~50 min ahead
      const order = await createOrder(input({ details: { mode: 'pickup', pickupTime: slot } }));
      await payOrder(order.id);
      const saved = db.get().orders.find((o) => o.id === order.id)!;
      const readyAt = new Date(saved.createdAt).getTime() + saved.etaMinutes * 60_000;
      expect(Math.abs(readyAt - new Date(slot).getTime())).toBeLessThan(1000);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('pickup slots (Q-05)', () => {
  it('slot ids stay on a fixed grid', () => {
    const t0 = new Date('2026-10-07T12:01:00');
    const t1 = new Date('2026-10-07T12:04:00');
    const a = pickupSlots(6, 10, 10, t0).map((s) => s.id);
    const b = pickupSlots(6, 10, 10, t1).map((s) => s.id);
    expect(a).toEqual(b);
  });

  it('a stale or off-grid stored slot falls back to ASAP', () => {
    const now = new Date('2026-10-07T12:01:00');
    expect(effectivePickupTime(new Date('2026-10-07T10:00:00').toISOString(), now)).toBe('asap');
    expect(effectivePickupTime(new Date('2026-10-07T12:37:30').toISOString(), now)).toBe('asap');
    const valid = pickupSlots(6, 10, 10, now)[2]!.id;
    expect(effectivePickupTime(valid, now)).toBe(valid);
  });
});
