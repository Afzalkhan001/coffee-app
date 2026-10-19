jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/* eslint-disable import/first */
import type { Order, OrderMode, OrderStatus } from '@/types/models';
import {
  cupLevel,
  orderDueAt,
  pillA11yLabel,
  pillCountLabel,
  pillEta,
  pillRoute,
  pillSignature,
  pillTitle,
  soonestFirst,
} from '../liveOrder';
/* eslint-enable import/first */

const NOW = Date.parse('2026-10-08T10:00:00.000Z');
const MIN = 60_000;

function order(id: string, status: OrderStatus, mode: OrderMode, minsAgo: number, eta = 9, extra: Partial<Order> = {}): Order {
  return {
    id,
    number: `ER-${id}`,
    createdAt: new Date(NOW - minsAgo * MIN).toISOString(),
    details: mode === 'delivery' ? { mode, address: { id: 'a', label: 'Home', line1: 'x', city: 'Bengaluru', lat: 0, lng: 0 } } : ({ mode } as Order['details']),
    items: [],
    totals: { subtotal: 0, discount: 0, tax: 0, deliveryFee: 0, total: 0 },
    status,
    history: [{ status: 'placed', at: new Date(NOW).toISOString() }],
    paymentStatus: 'paid',
    paymentMethod: 'card',
    customer: { name: 'Ava', phone: '9876543210' },
    etaMinutes: eta,
    pointsEarned: 0,
    ...extra,
  } as Order;
}

describe('pillRoute', () => {
  it('stays off the screens that already show live orders or end in a primary action', () => {
    for (const path of ['/', '/orders', '/cart', '/checkout', '/mode', '/address', '/payment', '/onboarding']) {
      expect(pillRoute(path).show).toBe(false);
    }
    for (const path of ['/product/latte', '/order/ord_1', '/order/confirmation/ord_1', '/order/invoice/ord_1', '/auth/phone']) {
      expect(pillRoute(path).show).toBe(false);
    }
  });

  it('floats above the tab bar on tab screens', () => {
    expect(pillRoute('/menu')).toEqual({ show: true, tabBar: true, cartBar: true });
    expect(pillRoute('/rewards')).toEqual({ show: true, tabBar: true, cartBar: false });
    expect(pillRoute('/profile')).toEqual({ show: true, tabBar: true, cartBar: false });
  });

  it('knows which stack screens carry the floating cart bar', () => {
    expect(pillRoute('/category/coffee')).toEqual({ show: true, tabBar: false, cartBar: true });
    expect(pillRoute('/search')).toEqual({ show: true, tabBar: false, cartBar: true });
    expect(pillRoute('/settings')).toEqual({ show: true, tabBar: false, cartBar: false });
    expect(pillRoute('/favorites')).toEqual({ show: true, tabBar: false, cartBar: true });
  });

  it('ignores a trailing slash, query and hash', () => {
    expect(pillRoute('/menu/').tabBar).toBe(true);
    expect(pillRoute('/cart?x=1').show).toBe(false);
    expect(pillRoute('/settings#a').show).toBe(true);
  });
});

describe('soonestFirst', () => {
  it('leads with a ready order, then the earliest due, and drops finished orders', () => {
    const preparing = order('1', 'preparing', 'pickup', 3); // due in 6 min
    const road = order('2', 'out_for_delivery', 'delivery', 14, 26); // due in 12 min
    const ready = order('3', 'ready', 'in_car', 8);
    const done = order('4', 'completed', 'pickup', 60);
    const sorted = soonestFirst([road, done, preparing, ready]);
    expect(sorted.map((o) => o.id)).toEqual(['3', '1', '2']);
  });

  it('uses the scheduled slot for a scheduled order', () => {
    const scheduled = order('5', 'accepted', 'pickup', 1, 9, { scheduledFor: new Date(NOW + 40 * MIN).toISOString() } as Partial<Order>);
    const asap = order('6', 'accepted', 'pickup', 1, 9);
    expect(orderDueAt(scheduled)).toBe(NOW + 40 * MIN);
    expect(soonestFirst([scheduled, asap])[0]!.id).toBe('6');
  });
});

describe('copy', () => {
  it('uses the short status names', () => {
    expect(pillTitle(order('1', 'preparing', 'pickup', 1))).toBe('Preparing');
    expect(pillTitle(order('1', 'ready', 'pickup', 1))).toBe('Ready for pickup');
    expect(pillTitle(order('1', 'out_for_delivery', 'delivery', 1))).toBe('On the way');
    expect(pillTitle(order('1', 'placed', 'pickup', 1))).toBe('Order placed');
  });

  it('counts down whole minutes until ready, then stops', () => {
    expect(pillEta(order('1', 'preparing', 'pickup', 5), NOW)).toEqual({ kind: 'minutes', minutes: 4 });
    expect(pillEta(order('1', 'out_for_delivery', 'delivery', 14, 26), NOW)).toEqual({ kind: 'minutes', minutes: 12 });
    expect(pillEta(order('1', 'ready', 'pickup', 9), NOW)).toBeNull();
    // Late orders never show "0 min".
    expect(pillEta(order('1', 'preparing', 'pickup', 30), NOW)).toEqual({ kind: 'minutes', minutes: 1 });
  });

  it('shows the slot for a scheduled order', () => {
    const eta = pillEta(order('1', 'accepted', 'pickup', 1, 9, { scheduledFor: new Date(NOW + 40 * MIN).toISOString() } as Partial<Order>), NOW);
    expect(eta?.kind).toBe('at');
  });

  it('labels more than one order', () => {
    expect(pillCountLabel(1)).toBe('');
    expect(pillCountLabel(2)).toBe('2 orders');
  });

  it('speaks the order, status, time and count', () => {
    expect(pillA11yLabel(order('7', 'preparing', 'pickup', 5), 1, NOW)).toBe('Order ER-7, Preparing, about 4 minutes left.');
    expect(pillA11yLabel(order('7', 'ready', 'pickup', 9), 2, NOW)).toBe('Order ER-7, Ready for pickup. 2 active orders.');
  });
});

describe('cupLevel', () => {
  it('fills step by step and is nearly full when ready', () => {
    const levels = (['placed', 'accepted', 'preparing', 'ready'] as const).map((s) => cupLevel(order('1', s, 'pickup', 1)));
    for (let i = 1; i < levels.length; i++) expect(levels[i]!).toBeGreaterThan(levels[i - 1]!);
    expect(levels[0]).toBeGreaterThan(0.1);
    expect(levels[3]).toBeCloseTo(0.84);
    expect(cupLevel(order('1', 'out_for_delivery', 'delivery', 1))).toBeCloseTo(0.84);
  });
});

describe('pillSignature', () => {
  it('changes when an order changes status, appears or leaves, but not with order', () => {
    const a = order('1', 'preparing', 'pickup', 1);
    const b = order('2', 'accepted', 'pickup', 1);
    expect(pillSignature([a, b])).toBe(pillSignature([b, a]));
    expect(pillSignature([a, b])).not.toBe(pillSignature([a, { ...b, status: 'preparing' }]));
    expect(pillSignature([a])).not.toBe(pillSignature([a, b]));
  });
});
