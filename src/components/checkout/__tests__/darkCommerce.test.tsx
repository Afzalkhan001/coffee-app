/**
 * Dark mode coverage for the COMMERCE screens (DESIGN.md §R4): product detail, cart, checkout, the
 * mode sheet, delivery address, payment, confirmation, tracking, the GST invoice and favourites mount
 * under `<ThemeProvider preference="dark">` with real stores, and no light-only colour reaches what
 * they render (a static `colors.*` left behind would show up as a cream plane, a light hairline or a
 * light tile). The same screens in light still paint the R3 values.
 */
import { Component, type ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

jest.useFakeTimers();

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  // The live order pill's bottom-space hook reads the route (`/` = no pill).
  usePathname: () => '/',
  useLocalSearchParams: () => mockParams.current,
  useFocusEffect: (effect: () => void | (() => void)) => {
    const { useEffect } = require('react');
    useEffect(effect, [effect]);
  },
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    navigate: jest.fn(),
    back: jest.fn(),
    dismissAll: jest.fn(),
    dismissTo: jest.fn(),
    canGoBack: () => true,
  },
}));
jest.mock('expo-router/react-navigation', () => ({ usePreventRemove: () => {} }));
jest.mock('expo-status-bar', () => ({ setStatusBarStyle: () => {} }));
jest.mock('expo-blur', () => {
  const { View } = require('react-native');
  return { BlurView: View };
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
import { useMockDb } from '@/api/mockDb';
import { OverlayHost } from '@/components/motion';
import { quickAddLine } from '@/components/domain';
import { PRODUCTS } from '@/data/mock/menu';
import { configKey } from '@/lib/modifiers';
import { useCart } from '@/store/cart';
import { useDemo } from '@/store/demo';
import { useFavorites } from '@/store/favorites';
import { useSession } from '@/store/session';
import {
  darkColors,
  darkTileTints,
  lightBoxShadows,
  lightColors,
  lightHeroTints,
  lightTileTints,
  ThemeProvider,
  themeFor,
  type AppearancePreference,
} from '@/theme';
import type { CartItem, Order, OrderStatus } from '@/types/models';
import AddressScreen from '@/app/address';
import CartScreen from '@/app/cart';
import CheckoutScreen from '@/app/checkout';
import FavoritesScreen from '@/app/favorites';
import ModeScreen from '@/app/mode';
import OrderScreen from '@/app/order/[id]';
import ConfirmationScreen from '@/app/order/confirmation/[id]';
import InvoiceScreen from '@/app/order/invoice/[id]';
import PaymentScreen from '@/app/payment';
import ProductRoute from '@/app/product/[id]';
import { PaymentCardVisual } from '../PaymentCardVisual';
import { UpiApproval, UpiMethodCard } from '../UpiApproval';
import { TipChips } from '../TipChips';
import { MethodMark, PaymentPicker } from '../PaymentMethods';
import { findPaymentMethod } from '@/api';
/* eslint-enable import/first */

const mockParams: { current: Record<string, string> } = { current: {} };
const PHONE = '9876543210';

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

function flush(ms = 3000) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

function mount(preference: AppearancePreference, node: ReactNode): ReactTestRenderer {
  let r: ReactTestRenderer | undefined;
  act(() => {
    r = create(
      <Boundary>
        <ThemeProvider preference={preference}>
          <OverlayHost>{node}</OverlayHost>
        </ThemeProvider>
      </Boundary>,
    );
  });
  if (!r) throw new Error('not mounted');
  flush();
  return r;
}

/** Values that only exist in the LIGHT palette: any of them in a dark render is a static leak. */
const LIGHT_ONLY = [
  lightColors.bg,
  lightColors.surfaceAlt,
  lightColors.line,
  lightColors.inkMuted,
  lightColors.danger,
  lightColors.dangerSoft,
  lightColors.storeFrom,
  lightColors.storeTo,
  lightColors.veg,
  lightColors.egg,
  lightColors.nonVeg,
  lightColors.frost,
  ...Object.values(lightTileTints),
  ...Object.values(lightHeroTints),
  // The R3 espresso shadows (dark shadows are black pools).
  'rgba(59, 38, 24',
  ...Object.values(lightBoxShadows),
  ...Object.values(themeFor('light').shadows).map((x) => x.boxShadow),
].map((v) => v.toLowerCase());

/** Every string a host element carries in its props (styles, fills, strokes, stops), plus its text. */
function render(r: ReactTestRenderer): string {
  const out: string[] = [];
  const seen = new WeakSet<object>();
  const collect = (value: unknown, depth: number) => {
    if (depth > 12 || value == null) return;
    if (typeof value === 'string' || typeof value === 'number') {
      out.push(String(value));
      return;
    }
    if (typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const v of value) collect(v, depth + 1);
      return;
    }
    for (const [k, v] of Object.entries(value)) {
      if (k === 'ref' || k === 'current' || typeof v === 'function') continue;
      collect(v, depth + 1);
    }
  };
  const walk = (node: ReturnType<ReactTestRenderer['toJSON']>) => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node === 'string') {
      out.push(node);
      return;
    }
    collect(node.props, 0);
    node.children?.forEach((child) => walk(child as ReturnType<ReactTestRenderer['toJSON']>));
  };
  walk(r.toJSON());
  return out.join(' ');
}

function leaks(json: string): string[] {
  const lower = json.toLowerCase();
  return LIGHT_ONLY.filter((v) => lower.includes(v));
}

const drink = PRODUCTS.find((p) => p.categoryId === 'coffee' && p.isAvailable && p.coffee);
const soldOut = PRODUCTS.find((p) => !p.isAvailable);
const food = PRODUCTS.find((p) => quickAddLine(p) !== null);

function cartLines(): CartItem[] {
  const line = food ? quickAddLine(food) : null;
  if (!line || !food) throw new Error('no quick-add product');
  return [
    { ...line, id: 'cl-a', quantity: 2, configKey: configKey(line.productId, line.modifiers) },
    { id: 'cl-b', productId: drink!.id, name: drink!.name, image: drink!.image, basePrice: drink!.price, quantity: 1, modifiers: [], configKey: configKey(drink!.id, []) },
  ];
}

function makeOrder(id: string, status: OrderStatus, mode: Order['details']['mode'], paymentStatus: Order['paymentStatus'], payment?: Order['payment']): Order {
  const p = drink!;
  const at = new Date(2026, 9, 8, 9, 30).toISOString();
  const history: Order['history'] = paymentStatus === 'pending' ? [] : [
    { status: 'placed', at },
    { status: 'accepted', at },
    ...(status === 'preparing' || status === 'completed' ? [{ status: 'preparing' as const, at }] : []),
    ...(status === 'completed' ? [{ status: 'ready' as const, at }, { status: 'completed' as const, at }] : []),
  ];
  return {
    id,
    number: 'ER-4827',
    createdAt: at,
    details: mode === 'delivery'
      ? { mode, address: useSession.getState().addresses[0] }
      : { mode, pickupTime: 'asap' },
    items: [
      { id: 'l1', productId: p.id, name: p.name, image: p.image, basePrice: p.price, quantity: 2, modifiers: [], lineTotal: p.price * 2 },
      { id: 'l2', productId: food!.id, name: food!.name, image: food!.image, basePrice: food!.price, quantity: 1, modifiers: [], lineTotal: food!.price },
    ],
    totals: { subtotal: 760, discount: 0, packaging: 15, tax: 39, deliveryFee: 0, total: 814 },
    status,
    history,
    paymentStatus,
    paymentMethod: payment?.methodId === 'pm-card' ? 'card' : 'upi',
    payment,
    customer: { name: 'Ava Stone', phone: PHONE },
    etaMinutes: 8,
    pointsEarned: 160,
  };
}

const ORDERS = {
  unpaidCard: makeOrder('ord-card', 'placed', 'pickup', 'pending', { methodId: 'pm-card', label: 'Visa •••• 4242' }),
  unpaidUpi: makeOrder('ord-upi', 'placed', 'pickup', 'pending', { methodId: 'pm-gpay', label: 'Google Pay', upiApp: 'gpay' }),
  preparing: makeOrder('ord-prep', 'preparing', 'pickup', 'paid', { methodId: 'pm-gpay', label: 'Google Pay', upiApp: 'gpay', upiRef: '612345678901', txnId: 'TXN8F3K2M1Q9Z' }),
  done: makeOrder('ord-done', 'completed', 'pickup', 'paid', { methodId: 'pm-gpay', label: 'Google Pay', upiApp: 'gpay', upiRef: '612345678901', txnId: 'TXN8F3K2M1Q9Z' }),
  fresh: makeOrder('ord-fresh', 'accepted', 'pickup', 'paid'),
};

beforeAll(() => {
  // Inside café hours, so "ASAP" is offered everywhere.
  jest.setSystemTime(new Date(2026, 9, 8, 10, 0));
  act(() => {
    useDemo.setState({ latencyMs: 50, offline: false });
    useSession.setState({
      phone: PHONE,
      profile: { id: 'usr_1', phone: PHONE, name: 'Ava Stone', createdAt: new Date().toISOString() },
      selectedAddressId: 'addr-home',
    });
    useMockDb.setState({ orders: Object.values(ORDERS) });
    useFavorites.setState({ ids: PRODUCTS.slice(0, 3).map((p) => p.id), owner: PHONE });
  });
});

beforeEach(() => {
  mockParams.current = {};
  act(() => {
    useCart.setState({ items: cartLines(), couponCode: 'WELCOME10', rewardId: undefined });
    useSession.setState({ mode: 'pickup', table: undefined, car: undefined, pickupTime: 'asap' });
  });
});

afterEach(() => {
  expect(caught.splice(0)).toEqual([]);
});

type Case = { name: string; params?: Record<string, string>; before?: () => void; node: () => ReactNode };

const CASES: Case[] = [
  { name: 'product detail (coffee)', params: { id: drink!.id }, node: () => <ProductRoute /> },
  { name: 'product detail (sold out)', params: { id: soldOut!.id }, node: () => <ProductRoute /> },
  { name: 'product detail (edit a line)', params: { id: drink!.id, lineId: 'cl-b' }, node: () => <ProductRoute /> },
  { name: 'cart', node: () => <CartScreen /> },
  { name: 'cart (empty)', before: () => useCart.setState({ items: [] }), node: () => <CartScreen /> },
  { name: 'checkout (pickup)', node: () => <CheckoutScreen /> },
  { name: 'checkout (delivery, tip)', before: () => useSession.setState({ mode: 'delivery' }), node: () => <CheckoutScreen /> },
  { name: 'checkout (in-car)', before: () => useSession.setState({ mode: 'in_car' }), node: () => <CheckoutScreen /> },
  { name: 'mode sheet (in-car)', before: () => useSession.setState({ mode: 'in_car' }), node: () => <ModeScreen /> },
  { name: 'mode sheet (delivery)', before: () => useSession.setState({ mode: 'delivery' }), node: () => <ModeScreen /> },
  { name: 'delivery address', node: () => <AddressScreen /> },
  { name: 'payment (card)', params: { orderId: ORDERS.unpaidCard.id }, node: () => <PaymentScreen /> },
  { name: 'payment (UPI)', params: { orderId: ORDERS.unpaidUpi.id }, node: () => <PaymentScreen /> },
  { name: 'confirmation', params: { id: ORDERS.fresh.id }, node: () => <ConfirmationScreen /> },
  { name: 'tracking', params: { id: ORDERS.preparing.id }, node: () => <OrderScreen /> },
  { name: 'order details (completed)', params: { id: ORDERS.done.id }, node: () => <OrderScreen /> },
  { name: 'invoice', params: { id: ORDERS.done.id }, node: () => <InvoiceScreen /> },
  { name: 'favourites', node: () => <FavoritesScreen /> },
];

describe('commerce screens in dark', () => {
  it.each(CASES.map((c) => [c.name, c] as const))('%s renders with no light-only colour', (_name, c) => {
    mockParams.current = c.params ?? {};
    // Braces: a persisted zustand setter returns a Promise, which would turn act() async.
    if (c.before) {
      act(() => {
        c.before!();
      });
    }
    const r = mount('dark', c.node());
    const json = render(r);
    // It really rendered (an empty tree would trivially pass) and it really is dark.
    expect(json.length).toBeGreaterThan(500);
    expect(json).toContain(c.name === 'confirmation' ? darkColors.night : darkColors.bg);
    expect(leaks(json)).toEqual([]);
    act(() => r.unmount());
  });

  it('paints the dark planes and keeps the night screen night', () => {
    mockParams.current = { id: drink!.id };
    const p = mount('dark', <ProductRoute />);
    const product = render(p);
    expect(product).toContain(darkColors.surface); // the notched sheet
    expect(product).toContain(darkColors.ink); // the cream primary bar
    act(() => p.unmount());
    mockParams.current = {};
    const c = mount('dark', <CartScreen />);
    const cart = render(c);
    expect(cart).toContain(darkColors.bg);
    expect(cart).toContain(darkColors.surface); // the list sheet
    act(() => c.unmount());
    mockParams.current = { id: ORDERS.fresh.id };
    const f = mount('dark', <ConfirmationScreen />);
    expect(render(f)).toContain(darkColors.night);
    act(() => f.unmount());
  });

  it('pieces with their own states: the UPI hand-off, tip, method marks and every card face', () => {
    const gpay = findPaymentMethod('pm-gpay')!;
    const r = mount(
      'dark',
      <>
        <UpiMethodCard method={gpay} status="Opening Google Pay…" />
        <UpiApproval appName="Google Pay" amount={536} startedAt={Date.now()} confirming={false} onCancel={() => {}} />
        <UpiApproval appName="Google Pay" amount={536} startedAt={Date.now()} confirming paid onCancel={() => {}} />
        <TipChips value="other" onChange={() => {}} otherText="45" onOtherTextChange={() => {}} error="Up to ₹500" />
        <PaymentPicker mode="delivery" value="pm-upi-id" onChange={() => {}} vpa="ava@" onVpaChange={() => {}} vpaError="Check the UPI ID" open onOpenChange={() => {}} />
        {['pm-gpay', 'pm-phonepe', 'pm-upi-id', 'pm-card', 'pm-rupay', 'pm-cod'].map((id) => (
          <MethodMark key={id} method={findPaymentMethod(id)!} size="hero" />
        ))}
        <PaymentCardVisual brand="visa" holder="Ava Stone" />
        <PaymentCardVisual brand="rupay" holder="Ava Stone" last4="6011" declined />
        <PaymentCardVisual brand="new" holder="Ava Stone" />
      </>,
    );
    const json = render(r);
    expect(leaks(json)).toEqual([]);
    // UPI plates sit on the dark tile tints; the "@" and cash plates on the dark canvas.
    expect(json).toContain(darkTileTints.cold);
    expect(json).toContain(darkColors.bg);
    act(() => r.unmount());
  });

  it('dark inputs ask iOS for the dark keyboard', () => {
    const r = mount('dark', <TipChips value="other" onChange={() => {}} otherText="" onOtherTextChange={() => {}} />);
    const inputs = r.root.findAll((n) => n.props.accessibilityLabel === 'Tip amount in rupees' && 'keyboardAppearance' in n.props);
    expect(inputs.length).toBeGreaterThan(0);
    expect(inputs.every((n) => n.props.keyboardAppearance === 'dark')).toBe(true);
    act(() => r.unmount());
    const light = mount('light', <TipChips value="other" onChange={() => {}} otherText="" onOtherTextChange={() => {}} />);
    const lightInputs = light.root.findAll((n) => n.props.accessibilityLabel === 'Tip amount in rupees' && 'keyboardAppearance' in n.props);
    expect(lightInputs.every((n) => n.props.keyboardAppearance === 'light')).toBe(true);
    act(() => light.unmount());
  });
});

describe('commerce screens in light (R3 unchanged)', () => {
  it('cart and checkout still paint the R3 canvas, sheets and tiles', () => {
    const c = mount('light', <CartScreen />);
    const cart = render(c).toLowerCase();
    expect(cart).toContain(lightColors.bg.toLowerCase());
    expect(cart).not.toContain(darkColors.bg.toLowerCase());
    expect(cart).not.toContain(darkColors.surface.toLowerCase());
    act(() => c.unmount());
    const k = mount('light', <CheckoutScreen />);
    const checkout = render(k).toLowerCase();
    expect(checkout).toContain(lightColors.line.toLowerCase());
    expect(checkout).not.toContain(darkColors.surface.toLowerCase());
    act(() => k.unmount());
  });

  it('product detail keeps the light hero and the white sheet', () => {
    mockParams.current = { id: drink!.id };
    const p = mount('light', <ProductRoute />);
    const product = render(p).toLowerCase();
    expect(product).toContain(lightHeroTints.coffee.toLowerCase());
    expect(product).toContain(lightColors.surface.toLowerCase());
    expect(product).not.toContain(darkColors.bg.toLowerCase());
    act(() => p.unmount());
  });
});
