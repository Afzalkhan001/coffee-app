/**
 * Render smoke tests for the cart → checkout → payment → confirmation flow (G4 screens).
 * Mounts each route with real stores + the mock API, drives the main interactions through props,
 * and checks navigation calls. Catches runtime-only mistakes the type checker can't see.
 */
import { Component, type ReactNode } from 'react';
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
import { createOrder } from '@/api';
import { OverlayHost } from '@/components/motion';
import { quickAddLine } from '@/components/domain';
import { PRODUCTS } from '@/data/mock/menu';
import { useCart } from '@/store/cart';
import { useDemo } from '@/store/demo';
import { useSession } from '@/store/session';
import type { OrderMode } from '@/types/models';
import AddressScreen from '@/app/address';
import CartScreen from '@/app/cart';
import CheckoutScreen from '@/app/checkout';
import ModeScreen from '@/app/mode';
import ConfirmationScreen from '@/app/order/confirmation/[id]';
import PaymentScreen from '@/app/payment';
import { addressFromDraft } from '../addressFactory';
import { defaultAddressLabel, isValidPin } from '../AddressForm';
import { isDeliverable } from '@/lib/geo';
import { checkoutIssue } from '../modeText';
import { pickupCode } from '@/lib/pickupCode';
/* eslint-enable import/first */

const mockNav: { params: Record<string, string>; calls: unknown[][] } = { params: {}, calls: [] };

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

/** First pressable host/composite with this accessibility label. */
function pressable(r: ReactTestRenderer, label: string): ReactTestInstance {
  const found = r.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function');
  const first = found[0];
  if (!first) throw new Error(`No pressable labelled "${label}"`);
  return first;
}

function press(r: ReactTestRenderer, label: string) {
  act(() => {
    pressable(r, label).props.onPress();
  });
}

function textContent(r: ReactTestRenderer): string {
  return r.root
    .findAll((n) => typeof n.props.children === 'string')
    .map((n) => n.props.children as string)
    .join(' | ');
}

const drink = PRODUCTS.find((p) => p.categoryId === 'coffee');
const food = PRODUCTS.find((p) => quickAddLine(p) !== null && p.id !== 'croissant');

function fillCart() {
  act(() => {
    useCart.getState().clear();
  });
  act(() => {
    if (food) useCart.getState().add({ ...quickAddLine(food)!, quantity: 2 });
    if (drink) {
      useCart.getState().add({
        productId: drink.id,
        name: drink.name,
        image: drink.image,
        basePrice: drink.price,
        quantity: 1,
        modifiers: [{ groupId: 'size', groupName: 'Size', optionId: 'size-m', optionName: 'Medium', shortName: 'M', priceDelta: 0.5 }],
        instructions: 'Extra hot please',
      });
    }
  });
}

function setMode(mode: OrderMode, extra: Partial<ReturnType<typeof useSession.getState>> = {}) {
  act(() => {
    useSession.setState({ mode, table: undefined, car: undefined, pickupTime: 'asap', ...extra });
  });
}

beforeAll(() => {
  act(() => {
    useDemo.setState({ latencyMs: 50, offline: false });
    useSession.setState({
      phone: '9876543210',
      profile: { id: 'usr_1', phone: '9876543210', name: 'Maya Rivers', createdAt: new Date().toISOString() },
      selectedAddressId: 'addr-home',
    });
  });
});

beforeEach(() => {
  mockNav.calls = [];
  mockNav.params = {};
});

afterEach(() => {
  const errors = caught.splice(0);
  expect(errors).toEqual([]);
});

describe('helpers', () => {
  it('derives the same counter code as order tracking', () => {
    expect(pickupCode('ER-4821')).toBe('C21');
    expect(pickupCode('ER-1007')).toBe('L07');
    // Confirmation (G4) and tracking (G5) must show the same code for every order number.
    const { pickupCode: trackingCode } = require('@/components/account/format') as {
      pickupCode: (o: { number: string }) => string;
    };
    for (let n = 1000; n < 10000; n += 97) expect(pickupCode(`ER-${n}`)).toBe(trackingCode({ number: `ER-${n}` }));
  });

  it('blocks sold-out lines and unaffordable rewards before the ordering context', () => {
    const contact = { name: 'Maya', phone: '9876543210' };
    expect(checkoutIssue({ mode: 'pickup' }, contact, { lineIssue: 'Latte is sold out today' })?.section).toBe('items');
    expect(checkoutIssue({ mode: 'pickup' }, contact, { rewardPoints: 600 })?.section).toBe('savings');
    expect(checkoutIssue({ mode: 'dine_in' }, contact, { rewardPoints: 600 })?.section).toBe('details');
  });

  it('defaults a new address label to one not used yet', () => {
    expect(defaultAddressLabel([])).toBe('Home');
    expect(defaultAddressLabel(['Home', 'Studio'])).toBe('Work');
    expect(defaultAddressLabel(['home', 'Work'])).toBe('Other');
  });

  it('validates the ordering context per mode', () => {
    const contact = { name: 'Maya', phone: '9876543210' };
    expect(checkoutIssue({ mode: 'pickup', pickupTime: 'asap' }, contact)).toBeNull();
    expect(checkoutIssue({ mode: 'dine_in' }, contact)?.section).toBe('details');
    expect(checkoutIssue({ mode: 'in_car', car: { make: 'Tesla', color: '', plate: 'X' } }, contact)?.section).toBe('details');
    expect(checkoutIssue({ mode: 'delivery' }, contact)?.hint).toMatch(/address/);
    expect(checkoutIssue({ mode: 'pickup' }, { name: '', phone: '9876543210' })?.section).toBe('contact');
    // Contact numbers must be Indian mobiles; a +91 prefix is fine.
    expect(checkoutIssue({ mode: 'pickup', pickupTime: 'asap' }, { name: 'Maya', phone: '+91 98765 43210' })).toBeNull();
    expect(checkoutIssue({ mode: 'pickup', pickupTime: 'asap' }, { name: 'Maya', phone: '5550142290' })?.section).toBe('contact');
  });

  it('builds Indian addresses: PIN on the city line, Nandi / Mysuru out of range', () => {
    const draft = { label: 'Home', street: '80 Feet Rd', apt: 'Flat 2A', city: 'Koramangala, Bengaluru', pin: '560034', notes: '' };
    const near = addressFromDraft(draft);
    expect(near.city).toBe('Koramangala, Bengaluru 560034');
    expect(near.line2).toBe('Flat 2A');
    expect(isDeliverable(near)).toBe(true);
    expect(isDeliverable(addressFromDraft({ ...draft, city: 'Nandi Hills' }))).toBe(false);
    expect(isDeliverable(addressFromDraft({ ...draft, city: 'Mysuru' }))).toBe(false);
    expect(isValidPin('560038')).toBe(true);
    expect(isValidPin('060038')).toBe(false);
    expect(isValidPin('56003')).toBe(false);
  });
});

describe('cart', () => {
  it('shows the empty state', () => {
    act(() => {
      useCart.getState().clear();
    });
    const r = mount(<CartScreen />);
    flush();
    expect(textContent(r)).toContain('Your cart is empty');
    press(r, 'Browse menu');
    expect(mockNav.calls).toContainEqual(['navigate', '/menu']);
    act(() => r.unmount());
  });

  it('lists lines, steps quantity, upsells and removes', async () => {
    fillCart();
    setMode('pickup');
    const r = mount(<CartScreen />);
    flush();
    const text = textContent(r);
    expect(text).toContain('Often added · ₹180');
    // R3: the note lives on the edit screen and the checkout lines; promo and mode live on checkout.
    expect(text).not.toContain('“Extra hot please”');
    expect(r.root.findAll((n) => n.props.accessibilityLabel === 'Promo code')).toHaveLength(0);
    expect(text).toContain('Total');
    // Round 4: each line carries its FSSAI veg / egg / non-veg mark (from the menu) in its label.
    const lineLabels = r.root
      .findAll((n) => typeof n.props.accessibilityLabel === 'string' && typeof n.props.onLongPress === 'function')
      .map((n) => n.props.accessibilityLabel as string);
    expect(lineLabels.some((l) => /, (Vegetarian|Contains egg|Non-vegetarian),/.test(l))).toBe(true);

    // Quantity stepper on the first line.
    const before = useCart.getState().items[0]!.quantity;
    press(r, 'Increase quantity');
    expect(useCart.getState().items[0]!.quantity).toBe(before + 1);

    // Upsell "+" flies and adds the croissant (no cart target layout in tests → safety timeout).
    await act(async () => {
      void pressable(r, 'Add Butter Croissant to cart').props.onPress();
      await jest.advanceTimersByTimeAsync(2500);
    });
    expect(useCart.getState().items.some((i) => i.productId === 'croissant')).toBe(true);

    // Row tap edits the line; long-press reveals; trash removes after the slide.
    const first = useCart.getState().items[0]!;
    const row = r.root.findAll((n) => typeof n.props.onLongPress === 'function' && typeof n.props.onPress === 'function')[0]!;
    // The tap measures the thumbnail (hero flight origin) before pushing, so it settles async.
    await act(async () => {
      row.props.onPress();
      await jest.advanceTimersByTimeAsync(500);
    });
    expect(mockNav.calls).toContainEqual(['push', { pathname: '/product/[id]', params: { id: first.productId, lineId: first.id } }]);
    act(() => row.props.onLongPress());
    flush(500);
    press(r, `Remove ${first.name}`);
    flush(1000);
    expect(useCart.getState().items.find((i) => i.id === first.id)).toBeUndefined();

    // Checkout routes straight to /checkout for pickup.
    const bar = r.root.findAll(
      (n) => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Checkout,') && typeof n.props.onPress === 'function',
    )[0]!;
    act(() => bar.props.onPress());
    expect(mockNav.calls).toContainEqual(['push', '/checkout']);
    act(() => r.unmount());
  });

  it('sends delivery without a deliverable address to /address first', () => {
    fillCart();
    setMode('delivery', { selectedAddressId: 'addr-cabin' });
    const r = mount(<CartScreen />);
    flush();
    const bar = r.root.findAll((n) => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Checkout,') && typeof n.props.onPress === 'function')[0]!;
    act(() => bar.props.onPress());
    expect(mockNav.calls).toContainEqual(['push', { pathname: '/address', params: { next: 'checkout' } }]);
    act(() => {
      useSession.setState({ selectedAddressId: 'addr-home' });
    });
    act(() => r.unmount());
  });
});

describe('mode sheet', () => {
  it('renders every mode and commits on Confirm', () => {
    fillCart();
    setMode('pickup');
    const r = mount(<ModeScreen />);
    flush();
    expect(textContent(r)).toContain('Order type');
    for (const label of ['Dine-In', 'In-Car', 'Delivery', 'Pickup']) {
      const card = r.root.findAll(
        (n) => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith(`${label}.`) && typeof n.props.onPress === 'function',
      )[0]!;
      act(() => card.props.onPress());
      flush(600);
    }
    // Back on Dine-In, pick a table and confirm.
    const dine = r.root.findAll(
      (n) => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Dine-In.') && typeof n.props.onPress === 'function',
    )[0]!;
    act(() => dine.props.onPress());
    flush(600);
    press(r, 'Patio');
    const confirm = r.root.findAll(
      (n) => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Confirm') && typeof n.props.onPress === 'function',
    )[0]!;
    act(() => confirm.props.onPress());
    expect(useSession.getState().mode).toBe('dine_in');
    expect(useSession.getState().table).toBe('Patio');
    expect(mockNav.calls).toContainEqual(['back']);
    act(() => r.unmount());
  });
});

describe('address', () => {
  it('checks addresses, shows the out-of-range state, and opens the form when location is denied', async () => {
    setMode('delivery', { selectedAddressId: undefined });
    const r = mount(<AddressScreen />);
    flush();
    const card = (label: string) =>
      r.root.findAll((n) => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith(label) && typeof n.props.onPress === 'function')[0]!;

    await act(async () => {
      card('Home,').props.onPress();
      await jest.advanceTimersByTimeAsync(1500);
    });
    expect(useSession.getState().selectedAddressId).toBe('addr-home');

    await act(async () => {
      card('Nandi Hills cottage,').props.onPress();
      await jest.advanceTimersByTimeAsync(1500);
    });
    expect(textContent(r)).toContain('No delivery to this address yet');
    expect(useSession.getState().selectedAddressId).toBe('addr-home');

    await act(async () => {
      void pressable(r, 'Use current location').props.onPress();
      await jest.advanceTimersByTimeAsync(1000);
    });
    expect(textContent(r)).toContain('New address');

    const deliver = r.root.findAll(
      (n) => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Deliver here') && typeof n.props.onPress === 'function',
    )[0]!;
    act(() => deliver.props.onPress());
    expect(mockNav.calls).toContainEqual(['back']);
    act(() => r.unmount());
  });
});

describe('checkout → payment → confirmation', () => {
  it('blocks dine-in without a table, then places a pickup order', async () => {
    fillCart();
    setMode('dine_in');
    const r = mount(<CheckoutScreen />);
    flush();
    expect(textContent(r)).toContain('Choose a table to continue');
    const place = () =>
      r.root.findAll((n) => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Place order') && typeof n.props.onPress === 'function')[0]!;
    act(() => place().props.onPress());
    flush(600);
    expect(textContent(r)).toContain('Choose where you’re sitting so we can bring it over.');
    expect(mockNav.calls.find((c) => c[0] === 'push')).toBeUndefined();

    press(r, 'Window bar');

    // Promo code, inline in the sheet: empty → error; FIRST20 → applied.
    press(r, 'Apply promo code');
    expect(textContent(r)).toContain('Enter a promo code first.');
    const input = r.root.find((n) => n.props.accessibilityLabel === 'Promo code' && typeof n.props.onChangeText === 'function');
    act(() => input.props.onChangeText('first20'));
    await act(async () => {
      void pressable(r, 'Apply promo code').props.onPress();
      await jest.advanceTimersByTimeAsync(1500);
    });
    expect(useCart.getState().couponCode).toBe('FIRST20');
    expect(textContent(r)).toContain('FIRST20');
    expect(textContent(r)).toMatch(/−₹\d/);

    // The items row expands into the lines (with the note).
    const itemsRow = r.root.findAll(
      (n) => typeof n.props.accessibilityLabel === 'string' && /^\d+ items?, /.test(n.props.accessibilityLabel) && typeof n.props.onPress === 'function',
    )[0]!;
    act(() => itemsRow.props.onPress());
    flush(400);
    expect(textContent(r)).toContain('“Extra hot please”');

    await act(async () => {
      place().props.onPress();
      await jest.advanceTimersByTimeAsync(1500);
    });
    const push = mockNav.calls.find((c) => c[0] === 'push') as [string, { pathname: string; params: { orderId: string } }] | undefined;
    expect(push?.[1].pathname).toBe('/payment');
    act(() => r.unmount());
  });

  it('renders every mode with its editor', () => {
    fillCart();
    for (const mode of ['pickup', 'in_car', 'delivery'] as const) {
      setMode(mode);
      const r = mount(<CheckoutScreen />);
      flush();
      act(() => r.unmount());
    }
  });

  it('pays (after a simulated decline) and celebrates', async () => {
    fillCart();
    setMode('pickup');
    const state = useCart.getState();
    let orderId = '';
    await act(async () => {
      const p = createOrder({
        phone: '9876543210',
        customer: { name: 'Maya Rivers', phone: '9876543210' },
        details: { mode: 'pickup', pickupTime: 'asap' },
        items: state.items,
        paymentMethod: 'card',
      }).then((o) => {
        orderId = o.id;
      });
      await jest.advanceTimersByTimeAsync(1000);
      await p;
    });
    expect(orderId).not.toBe('');

    mockNav.params = { orderId };
    const r = mount(<PaymentScreen />);
    flush(1500);
    expect(textContent(r)).toContain('Demo checkout · no real charge');

    await act(async () => {
      void pressable(r, 'Simulate a failed payment').props.onPress();
      await jest.advanceTimersByTimeAsync(2000);
    });
    expect(textContent(r)).toContain('Payment declined');
    expect(textContent(r)).toContain('No money was taken.');

    const payButton = () =>
      r.root.findAll((n) => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Retry') && typeof n.props.onPress === 'function')[0]!;
    await act(async () => {
      payButton().props.onPress();
      await jest.advanceTimersByTimeAsync(2000);
    });
    // Paid: the cart is cleared at once (Q-15), before the reveal / navigation.
    expect(useCart.getState().items).toHaveLength(0);
    // Check draws → espresso reveal → hand-over. Separate act() chunks so each step's state commits
    // (and schedules the next timer) before time moves on.
    for (let i = 0; i < 12 && !mockNav.calls.some((c) => c[0] === 'dismissAll'); i++) await flushAsync(400);
    expect(mockNav.calls).toContainEqual(['dismissAll']);
    expect(mockNav.calls).toContainEqual(['push', { pathname: '/order/confirmation/[id]', params: { id: orderId } }]);
    act(() => r.unmount());

    mockNav.calls = [];
    mockNav.params = { id: orderId };
    const c = mount(<ConfirmationScreen />);
    flush(3000);
    const text = textContent(c);
    expect(text).toContain('Order');
    expect(text).toContain('placed.');
    expect(text).toContain('Pickup code');
    expect(text).not.toContain('pts on completion');
    press(c, 'Track order');
    expect(mockNav.calls).toContainEqual(['replace', { pathname: '/order/[id]', params: { id: orderId } }]);
    press(c, 'Done');
    expect(mockNav.calls).toContainEqual(['dismissTo', '/']);
    act(() => c.unmount());
  });

  it('does not celebrate an unknown order id on the confirmation route', () => {
    mockNav.params = { id: 'nope' };
    const c = mount(<ConfirmationScreen />);
    flush(3000);
    const text = textContent(c);
    expect(text).not.toContain('placed.');
    expect(text).toContain('We couldn’t find that order');
    press(c, 'View my orders');
    expect(mockNav.calls).toContainEqual(['replace', '/orders']);
    act(() => c.unmount());
  });

  it('handles a missing order on payment', () => {
    mockNav.params = { orderId: 'nope' };
    const r = mount(<PaymentScreen />);
    flush();
    expect(textContent(r)).toContain('We couldn’t find this order');
    act(() => r.unmount());
  });
});
