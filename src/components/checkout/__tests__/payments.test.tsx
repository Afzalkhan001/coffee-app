/**
 * UPI-first payments, the delivery tip and the GST invoice, end to end on the real screens and the
 * mock API: checkout's method picker (last used, else Google Pay; UPI ID validation), tip chips,
 * the UPI hand-off on the payment screen (opening → approve with the countdown → paid; cancel;
 * decline), cash on delivery, and the invoice reached from order details.
 */
import { Component, type ReactNode } from 'react';
import { Share } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

jest.useFakeTimers();

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  useLocalSearchParams: () => mockNav.params,
  useFocusEffect: (effect: () => void | (() => void)) => {
    const { useEffect } = require('react');
    useEffect(effect, [effect]);
  },
  router: {
    push: (...a: unknown[]) => mockNav.calls.push(['push', ...a]),
    replace: (...a: unknown[]) => mockNav.calls.push(['replace', ...a]),
    navigate: (...a: unknown[]) => mockNav.calls.push(['navigate', ...a]),
    back: () => mockNav.calls.push(['back']),
    dismissAll: () => mockNav.calls.push(['dismissAll']),
    dismissTo: (...a: unknown[]) => mockNav.calls.push(['dismissTo', ...a]),
    canGoBack: () => true,
  },
}));
jest.mock('expo-router/react-navigation', () => ({ usePreventRemove: () => {} }));
jest.mock('expo-status-bar', () => ({ setStatusBarStyle: () => {} }));
jest.mock('expo-blur', () => {
  const { View } = require('react-native');
  return { BlurView: ({ style }: { style?: unknown }) => <View style={style} /> };
});
jest.mock('@/lib/location', () => ({
  requestLocationPermission: () => Promise.resolve('denied'),
  getCurrentPosition: () => Promise.resolve(null),
}));
jest.mock('@/lib/haptics', () => {
  const noop = () => {};
  return {
    haptic: { select: noop, tick: noop, toggle: noop, press: noop, land: noop, threshold: noop, longPress: noop, success: noop, warning: noop, error: noop },
    playHaptic: noop,
    configureHaptics: noop,
    hapticsEnabled: () => true,
  };
});
jest.mock('@expo/vector-icons/Ionicons', () => {
  const { Text: RNText } = require('react-native');
  return function MockIonicon({ name }: { name: string }) {
    return <RNText>{name}</RNText>;
  };
});
require('react-native-gesture-handler/jestSetup');

/* eslint-disable import/first */
import { createOrder, lastPaymentChoice, payOrder, type PlaceOrderInput } from '@/api';
import { db } from '@/api/mockDb';
import { OverlayHost } from '@/components/motion';
import { quickAddLine } from '@/components/domain';
import { PRODUCTS } from '@/data/mock/menu';
import { SEED_ADDRESSES } from '@/data/mock/marketing';
import { useCart } from '@/store/cart';
import { useDemo } from '@/store/demo';
import { useSession } from '@/store/session';
import type { Order, OrderMode } from '@/types/models';
import CheckoutScreen from '@/app/checkout';
import PaymentScreen from '@/app/payment';
import OrderScreen from '@/app/order/[id]';
import InvoiceScreen from '@/app/order/invoice/[id]';
import { checkoutIssue } from '../modeText';
import { tipAmount, tipIssue } from '../tip';
import { formatClock } from '../UpiApproval';
/* eslint-enable import/first */

const mockNav: { params: Record<string, string>; calls: unknown[][] } = { params: {}, calls: [] };
const PHONE = '9876543210';
const HOME = SEED_ADDRESSES.find((a) => a.id === 'addr-home')!;

const caught: unknown[] = [];
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    caught.push(error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function mount(node: ReactNode): ReactTestRenderer {
  let r: ReactTestRenderer | undefined;
  act(() => {
    r = create(
      <Boundary>
        <OverlayHost>{node}</OverlayHost>
      </Boundary>,
    );
  });
  if (!r) throw new Error('not mounted');
  return r;
}

function flush(ms = 3000) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

async function flushAsync(ms = 3000) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

function pressables(r: ReactTestRenderer, match: (label: string) => boolean): ReactTestInstance[] {
  return r.root.findAll((n) => typeof n.props.accessibilityLabel === 'string' && match(n.props.accessibilityLabel) && typeof n.props.onPress === 'function');
}

function pressable(r: ReactTestRenderer, label: string | RegExp): ReactTestInstance {
  const first = pressables(r, (l) => (typeof label === 'string' ? l === label : label.test(l)))[0];
  if (!first) throw new Error(`No pressable labelled "${String(label)}"`);
  return first;
}

function press(r: ReactTestRenderer, label: string | RegExp) {
  act(() => {
    pressable(r, label).props.onPress();
  });
}

function input(r: ReactTestRenderer, label: string): ReactTestInstance {
  return r.root.find((n) => n.props.accessibilityLabel === label && typeof n.props.onChangeText === 'function');
}

function textContent(r: ReactTestRenderer): string {
  return r.root
    .findAll((n) => typeof n.props.children === 'string')
    .map((n) => n.props.children as string)
    .join(' | ');
}

const food = PRODUCTS.find((p) => quickAddLine(p) !== null && p.id !== 'croissant')!;

function fillCart() {
  act(() => {
    useCart.getState().clear();
  });
  act(() => {
    useCart.getState().add({ ...quickAddLine(food)!, quantity: 1 });
  });
}

function setMode(mode: OrderMode, extra: Partial<ReturnType<typeof useSession.getState>> = {}) {
  act(() => {
    useSession.setState({ mode, table: undefined, car: undefined, pickupTime: 'asap', selectedAddressId: 'addr-home', ...extra });
  });
}

async function placeDirect(extra: Partial<PlaceOrderInput>): Promise<Order> {
  let order: Order | undefined;
  await act(async () => {
    const p = createOrder({
      phone: PHONE,
      customer: { name: 'Ava Stone', phone: PHONE },
      details: { mode: 'pickup', pickupTime: 'asap' },
      items: useCart.getState().items,
      paymentMethod: 'upi',
      paymentMethodId: 'pm-gpay',
      ...extra,
    }).then((o) => {
      order = o;
    });
    await jest.advanceTimersByTimeAsync(1000);
    await p;
  });
  if (!order) throw new Error('order not created');
  return order;
}

const placeBar = (r: ReactTestRenderer) => pressable(r, /^Place order, /);

beforeAll(() => {
  act(() => {
    useDemo.setState({ latencyMs: 50, offline: false, forceStoreOpen: true });
    useSession.setState({
      phone: PHONE,
      profile: { id: 'usr_1', phone: PHONE, name: 'Ava Stone', createdAt: new Date().toISOString() },
      selectedAddressId: 'addr-home',
    });
  });
});

beforeEach(() => {
  mockNav.calls = [];
  mockNav.params = {};
  act(() => {
    db.reset();
  });
});

afterEach(() => {
  const errors = caught.splice(0);
  expect(errors).toEqual([]);
});

describe('helpers', () => {
  it('turns the tip choice into an amount and an issue', () => {
    expect(tipAmount('none', '')).toBe(0);
    expect(tipAmount(20, '')).toBe(20);
    expect(tipAmount('other', '45')).toBe(45);
    expect(tipAmount('other', '900')).toBe(0);
    expect(tipIssue('other', '900')).toMatch(/₹1 to ₹500/);
    expect(tipIssue('other', '45')).toBeNull();
    expect(tipIssue(10, '')).toBeNull();
  });

  it('checks the tip and the UPI ID after everything else', () => {
    const contact = { name: 'Ava', phone: PHONE };
    const details = { mode: 'delivery' as const, address: HOME };
    expect(checkoutIssue(details, contact, { tipIssue: 'bad tip' })?.section).toBe('tip');
    // One hint for an empty and an over-the-limit amount.
    expect(checkoutIssue(details, contact, { tipIssue: 'bad tip' })?.hint).toBe('Tip ₹1–₹500 or choose No tip');
    expect(checkoutIssue(details, contact, { paymentIssue: 'bad vpa' })).toMatchObject({ section: 'payment', hint: 'Enter a valid UPI ID to continue' });
    expect(checkoutIssue({ mode: 'delivery' }, contact, { paymentIssue: 'bad vpa' })?.section).toBe('details');
  });

  it('prints the UPI countdown', () => {
    expect(formatClock(300)).toBe('5:00');
    expect(formatClock(297.2)).toBe('4:58');
    expect(formatClock(9)).toBe('0:09');
    expect(formatClock(-3)).toBe('0:00');
  });
});

describe('checkout: tip and payment method', () => {
  it('defaults to Google Pay, adds a delivery tip and pays by UPI ID', async () => {
    fillCart();
    setMode('delivery');
    const r = mount(<CheckoutScreen />);
    flush();
    let text = textContent(r);
    expect(text).toContain('Tip your delivery partner');
    expect(text).toContain('Your delivery partner gets 100% of the tip.');
    expect(text).toContain('Google Pay');
    expect(text).toContain('Packaging');
    expect(text).not.toContain('Delivery partner tip');

    // ₹20 tip: a summary row, and the total moves by exactly ₹20.
    const before = Number(placeBar(r).props.accessibilityLabel.replace(/\D/g, ''));
    press(r, 'Tip ₹20');
    flush(600);
    text = textContent(r);
    expect(text).toContain('Delivery partner tip');
    expect(Number(placeBar(r).props.accessibilityLabel.replace(/\D/g, ''))).toBe(before + 20);

    // "Other" with a bad amount blocks the order at the tip.
    press(r, 'Other');
    flush(400);
    act(() => input(r, 'Tip amount in rupees').props.onChangeText('900'));
    await act(async () => {
      placeBar(r).props.onPress();
      await jest.advanceTimersByTimeAsync(600);
    });
    expect(textContent(r)).toMatch(/Enter a tip from ₹1 to ₹500/);
    act(() => input(r, 'Tip amount in rupees').props.onChangeText('25'));

    // Switch to "Pay with UPI ID": the order needs a valid UPI ID.
    press(r, /^Pay with Google Pay/);
    flush(400);
    expect(textContent(r)).toContain('Cash on delivery');
    expect(textContent(r)).not.toContain('Pay at the counter');
    press(r, /^Pay with UPI ID\./);
    flush(600);
    await act(async () => {
      placeBar(r).props.onPress();
      await jest.advanceTimersByTimeAsync(600);
    });
    expect(textContent(r)).toContain('Enter your UPI ID, like name@okicici.');
    expect(mockNav.calls.find((c) => c[0] === 'push')).toBeUndefined();

    act(() => input(r, 'UPI ID').props.onChangeText('ava@okicici'));
    await act(async () => {
      placeBar(r).props.onPress();
      await jest.advanceTimersByTimeAsync(1500);
    });
    const push = mockNav.calls.find((c) => c[0] === 'push') as [string, { pathname: string; params: { orderId: string } }] | undefined;
    expect(push?.[1].pathname).toBe('/payment');
    const order = db.get().orders.find((o) => o.id === push?.[1].params.orderId)!;
    expect(order.totals.tip).toBe(25);
    expect(order.totals.packaging).toBe(15);
    expect(order.payment).toMatchObject({ methodId: 'pm-upi-id', vpa: 'ava@okicici', label: 'UPI · ava@okicici' });
    act(() => r.unmount());
  });

  it('pickup offers the counter, not cash on delivery, and has no tip', () => {
    fillCart();
    setMode('pickup');
    const r = mount(<CheckoutScreen />);
    flush();
    expect(textContent(r)).not.toContain('Tip your delivery partner');
    press(r, /^Pay with Google Pay/);
    flush(400);
    const text = textContent(r);
    expect(text).toContain('Pay at the counter');
    expect(text).not.toContain('Cash on delivery');
    expect(text).toContain('RuPay •••• 6011');
    expect(text).not.toContain('Apple Pay');
    act(() => r.unmount());
  });
});

describe('payment: the UPI hand-off', () => {
  it('opens the app, waits for approval with a countdown, can be cancelled, then pays', async () => {
    fillCart();
    setMode('pickup');
    const order = await placeDirect({ paymentMethodId: 'pm-phonepe' });
    mockNav.params = { orderId: order.id };
    const r = mount(<PaymentScreen />);
    flush(1500);
    expect(textContent(r)).toContain('PhonePe');
    expect(textContent(r)).toContain('UPI · to emberroast@icici');

    // Pay → "Opening PhonePe…" → "Approve ₹x in PhonePe" with the 5:00 window.
    act(() => {
      pressable(r, /^Pay ₹/).props.onPress();
    });
    await flushAsync(300);
    expect(textContent(r)).toContain('Opening PhonePe…');
    await flushAsync(700);
    let text = textContent(r);
    expect(text).toMatch(/Approve ₹[\d,]+ in PhonePe/);
    expect(text).toContain('Open PhonePe and approve the request from emberroast@icici.');
    expect(text).toMatch(/[45]:\d\d/);

    // Cancel: nothing is paid, and Pay comes back.
    press(r, 'Cancel UPI payment');
    await flushAsync(3000);
    text = textContent(r);
    expect(text).toContain('Payment cancelled');
    expect(db.get().orders.find((o) => o.id === order.id)?.paymentStatus).toBe('pending');
    expect(useCart.getState().items.length).toBeGreaterThan(0);

    // Pay again and let it approve.
    act(() => {
      pressable(r, /^Pay ₹/).props.onPress();
    });
    for (let i = 0; i < 12 && !mockNav.calls.some((c) => c[0] === 'dismissAll'); i++) await flushAsync(500);
    const paid = db.get().orders.find((o) => o.id === order.id)!;
    expect(paid.paymentStatus).toBe('paid');
    expect(paid.payment?.upiRef).toMatch(/^\d{12}$/);
    expect(useCart.getState().items).toHaveLength(0);
    expect(mockNav.calls).toContainEqual(['push', { pathname: '/order/confirmation/[id]', params: { id: order.id } }]);
    expect(lastPaymentChoice(PHONE).methodId).toBe('pm-phonepe');
    act(() => r.unmount());
  });

  it('a declined UPI request offers a retry and a way back to the method list', async () => {
    fillCart();
    setMode('pickup');
    const order = await placeDirect({ paymentMethodId: 'pm-upi-id', vpa: 'ava@okicici' });
    mockNav.params = { orderId: order.id };
    const r = mount(<PaymentScreen />);
    flush(1500);
    expect(textContent(r)).toContain('ava@okicici');
    act(() => {
      pressable(r, 'Simulate a failed payment').props.onPress();
    });
    await flushAsync(1000);
    expect(textContent(r)).toContain('Request sent to ava@okicici');
    expect(textContent(r)).toMatch(/Approve ₹[\d,]+ in your UPI app/);
    for (let i = 0; i < 10 && !textContent(r).includes('Payment declined'); i++) await flushAsync(500);
    expect(textContent(r)).toContain('Payment declined');
    expect(textContent(r)).toContain('No money was taken.');
    expect(pressables(r, (l) => l.startsWith('Retry · ₹'))).not.toHaveLength(0);
    press(r, 'Change payment method');
    expect(mockNav.calls).toContainEqual(['back']);
    act(() => r.unmount());
  });

  it('cash on delivery just confirms the order', async () => {
    fillCart();
    setMode('delivery');
    const order = await placeDirect({ paymentMethod: 'cod', paymentMethodId: 'pm-cod', details: { mode: 'delivery', address: HOME } });
    mockNav.params = { orderId: order.id };
    const r = mount(<PaymentScreen />);
    flush(1500);
    expect(textContent(r)).toContain('Pay on delivery');
    expect(textContent(r)).toContain('Nothing is charged in the app');
    act(() => {
      pressable(r, 'Confirm order').props.onPress();
    });
    for (let i = 0; i < 12 && !mockNav.calls.some((c) => c[0] === 'dismissAll'); i++) await flushAsync(500);
    const after = db.get().orders.find((o) => o.id === order.id)!;
    expect(after.paymentStatus).toBe('pending');
    expect(after.history.length).toBeGreaterThan(0);
    act(() => r.unmount());
  });
});

describe('GST invoice', () => {
  it('order details links a paid order to its invoice, which shares as text', async () => {
    fillCart();
    setMode('delivery');
    const order = await placeDirect({ details: { mode: 'delivery', address: HOME }, tip: 20 });
    await act(async () => {
      const p = payOrder(order.id);
      await jest.advanceTimersByTimeAsync(2000);
      await p;
    });

    mockNav.params = { id: order.id };
    const details = mount(<OrderScreen />);
    flush(1500);
    press(details, 'View GST invoice');
    expect(mockNav.calls).toContainEqual(['push', { pathname: '/order/invoice/[id]', params: { id: order.id } }]);
    act(() => details.unmount());

    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
    const r = mount(<InvoiceScreen />);
    flush(1500);
    const text = textContent(r);
    expect(text).toContain('Tax invoice');
    expect(text).toContain('Ember Roast Cafés Pvt. Ltd.');
    expect(text).toContain('29AAHCE1234F1Z5');
    expect(text).toContain('Karnataka (29)');
    expect(text).toContain('CGST @ 2.5%');
    expect(text).toContain('SGST @ 2.5%');
    expect(text).toContain('Delivery partner tip (not taxed)');
    expect(text).toContain('Google Pay (UPI)');
    expect(text).toContain('Prototype — not a valid tax invoice.');
    expect(text).toMatch(/rupees only/);
    await act(async () => {
      pressable(r, 'Share invoice').props.onPress();
      await jest.advanceTimersByTimeAsync(100);
    });
    expect(share).toHaveBeenCalledTimes(1);
    expect(share.mock.calls[0]?.[0]).toMatchObject({ message: expect.stringContaining('TAX INVOICE') });
    share.mockRestore();
    act(() => r.unmount());
  });

  it('an unpaid order has no invoice yet', async () => {
    fillCart();
    setMode('pickup');
    const order = await placeDirect({});
    mockNav.params = { id: order.id };
    const r = mount(<InvoiceScreen />);
    flush(800);
    expect(textContent(r)).toContain('No invoice yet');
    act(() => r.unmount());
  });
});
