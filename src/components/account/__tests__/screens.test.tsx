/**
 * Runtime smoke test for the G5 screens (orders, tracking, rewards, profile, settings, help,
 * legal): each mounts with seeded mock data, follows live store changes, runs its main flows
 * (reorder, I'm here, cancel, redeem, edit name, log out, demo tools) and unmounts cleanly.
 * Not a visual test — it catches runtime-only mistakes the type checker can't see.
 */
import { Component, type ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

jest.useFakeTimers();

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
const mockParams: { current: Record<string, string> } = { current: {} };
jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  // The live order pill's bottom-space hook reads the route (`/` = no pill).
  usePathname: () => '/',
  // Read lazily at render time, so tests can swap params between mounts.
  useLocalSearchParams: () => mockParams.current,
  router: {
    push: jest.fn(),
    navigate: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
    setParams: jest.fn(),
  },
}));
jest.mock('expo-router/js-tabs', () => ({ BottomTabBarHeightCallbackContext: require('react').createContext(undefined) }));
jest.mock('@/lib/haptics', () => {
  const noop = () => {};
  return {
    haptic: { select: noop, tick: noop, toggle: noop, press: noop, land: noop, threshold: noop, longPress: noop, success: noop, warning: noop, error: noop },
    playHaptic: noop,
    configureHaptics: noop,
    hapticsEnabled: () => true,
  };
});
// The modal backdrop drives the iOS blur's `intensity` through animated props; the real BlurView is
// a class component whose props the JS (jest) updater can't patch, so stand in a plain function view.
jest.mock('expo-blur', () => {
  const { View } = require('react-native');
  return { BlurView: ({ style }: { style?: unknown }) => <View style={style} /> };
});
jest.mock('@expo/vector-icons/Ionicons', () => {
  const { Text: RNText } = require('react-native');
  return function MockIonicon({ name }: { name: string }) {
    return <RNText>{`icon:${name}`}</RNText>;
  };
});

/* eslint-disable import/first */
import OrdersScreen from '@/app/(tabs)/orders';
import ProfileScreen from '@/app/(tabs)/profile';
import RewardsScreen from '@/app/(tabs)/rewards';
import HelpScreen from '@/app/help';
import LegalScreen from '@/app/legal';
import OrderScreen from '@/app/order/[id]';
import SettingsScreen from '@/app/settings';
import { useMockDb } from '@/api/mockDb';
import { OverlayHost } from '@/components/motion';
import { PRODUCTS } from '@/data/mock/menu';
import { useCart } from '@/store/cart';
import { useDemo } from '@/store/demo';
import { useSession } from '@/store/session';
import type { Order, OrderMode, OrderStatus } from '@/types/models';
/* eslint-enable import/first */

const mockRouter = jest.requireMock<{ router: Record<string, jest.Mock | (() => boolean)> }>('expo-router').router;

const PHONE = '9876543210';
const PROFILE = { id: 'usr_1', phone: PHONE, name: 'Ava Stone', createdAt: '2026-09-01T10:00:00.000Z' };

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

afterEach(() => {
  const errors = caught.splice(0);
  expect(errors).toEqual([]);
});

function flush(ms = 3000) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

async function settle(ms = 3000) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
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

/** Every string rendered by a host Text node, joined. */
function allText(r: ReactTestRenderer): string {
  const out: string[] = [];
  const walk = (children: unknown) => {
    if (typeof children === 'string' || typeof children === 'number') out.push(String(children));
    else if (Array.isArray(children)) children.forEach(walk);
  };
  r.root.findAll((n) => (n.type as unknown) === 'Text').forEach((n) => walk(n.props.children));
  return out.join(' | ');
}

/** Pressables (host or composite) with this accessibility label and an onPress handler. */
function pressables(r: ReactTestRenderer, label: string | RegExp): ReactTestInstance[] {
  return r.root.findAll((n) => {
    const l: unknown = n.props.accessibilityLabel;
    const matches = typeof l === 'string' && (typeof label === 'string' ? l === label : label.test(l));
    return matches && typeof n.props.onPress === 'function' && typeof n.type !== 'string';
  });
}

function press(r: ReactTestRenderer, label: string | RegExp, which: 'first' | 'last' = 'first') {
  const found = pressables(r, label);
  const node = which === 'first' ? found[0] : found[found.length - 1];
  if (!node) throw new Error(`No pressable labelled ${String(label)}.\nRendered: ${allText(r).slice(0, 600)}`);
  act(() => {
    void node.props.onPress();
  });
}

function makeOrder(id: string, status: OrderStatus, mode: OrderMode, extra: Partial<Order> = {}): Order {
  const p0 = PRODUCTS[0]!;
  const p1 = PRODUCTS[5]!;
  const at = new Date(Date.now() - 2 * 60_000).toISOString();
  return {
    id,
    number: `ER-${1000 + id.length * 111}`,
    createdAt: at,
    details:
      mode === 'delivery'
        ? { mode, address: { id: 'a', label: 'Home', line1: 'Flat 4B, Sunrise Residency, 6th Cross', city: 'Domlur, Bengaluru 560071', lat: 12.961, lng: 77.6387 } }
        : mode === 'in_car'
          ? { mode, pickupTime: 'asap', car: { make: 'Toyota Corolla', color: 'Silver', plate: 'KA 03 MN 4521' } }
          : mode === 'dine_in'
            ? { mode, table: 'Window bar' }
            : { mode, pickupTime: 'asap' },
    items: [
      {
        id: `${id}-1`,
        productId: p0.id,
        name: p0.name,
        image: p0.image,
        basePrice: p0.price,
        quantity: 2,
        modifiers: [{ groupId: 'g', groupName: 'Milk', optionId: 'o', optionName: 'Oat milk', priceDelta: 50 }],
        instructions: 'Extra hot',
        lineTotal: (p0.price + 50) * 2,
      },
      { id: `${id}-2`, productId: p1.id, name: p1.name, image: p1.image, basePrice: p1.price, quantity: 1, modifiers: [], lineTotal: p1.price },
    ],
    totals: { subtotal: 720, discount: 100, tax: 31, deliveryFee: mode === 'delivery' ? 40 : 0, total: mode === 'delivery' ? 691 : 651 },
    couponCode: 'FIRST20',
    status,
    history: [{ status: 'placed', at }],
    paymentStatus: 'paid',
    paymentMethod: 'card',
    customer: { name: PROFILE.name, phone: PHONE },
    etaMinutes: 8,
    pointsEarned: 144,
    ...extra,
  };
}

function seed(orders: Order[]) {
  act(() => {
    useSession.setState({
      onboardingDone: true,
      phone: PHONE,
      profile: PROFILE,
      notificationPermission: 'skipped',
    });
  });
  act(() => {
    useMockDb.setState({
      orders,
      profiles: { [PHONE]: PROFILE },
      sim: {},
      loyalty: {
        [PHONE]: {
          balance: 560,
          lifetime: 710,
          transactions: [
            { id: 't1', type: 'bonus', points: 150, description: 'Welcome bonus', createdAt: '2026-09-01T10:00:00.000Z' },
            { id: 't2', type: 'earn', points: 190, description: 'Order ER-1222', createdAt: '2026-10-01T10:00:00.000Z' },
            { id: 't3', type: 'redeem', points: -150, description: 'Redeemed · Free extra shot', createdAt: '2026-10-02T10:00:00.000Z' },
            { id: 't4', type: 'earn', points: 370, description: 'Order ER-1333', createdAt: '2026-10-03T10:00:00.000Z' },
            { id: 't5', type: 'earn', points: 120, description: 'Order ER-1444', createdAt: '2026-10-04T10:00:00.000Z' },
            { id: 't6', type: 'earn', points: 80, description: 'Order ER-1555', createdAt: '2026-10-05T10:00:00.000Z' },
          ],
        },
      },
    });
  });
  act(() => {
    useCart.getState().clear();
  });
  act(() => {
    useDemo.getState().setOffline(false);
  });
}

const ACTIVE_PICKUP = makeOrder('a1', 'preparing', 'pickup');
const READY_CAR = makeOrder('car2', 'ready', 'in_car');
const ON_ROAD = makeOrder('road03', 'out_for_delivery', 'delivery');
const PLACED_DINE = makeOrder('dine004', 'placed', 'dine_in');
const DONE = makeOrder('done0005', 'completed', 'pickup', {
  createdAt: new Date(Date.now() - 26 * 3_600_000).toISOString(),
});
const CANCELLED = makeOrder('cxl00006', 'cancelled', 'delivery', { paymentStatus: 'refunded' });
const ALL = [ACTIVE_PICKUP, READY_CAR, ON_ROAD, PLACED_DINE, DONE, CANCELLED];

beforeEach(() => {
  mockParams.current = {};
  Object.values(mockRouter).forEach((fn) => {
    if (jest.isMockFunction(fn)) fn.mockClear();
  });
});

describe('Orders tab', () => {
  it('shows live and past orders, switches pages, follows status changes and reorders', async () => {
    seed(ALL);
    const r = mount(<OrdersScreen />);
    flush();
    expect(allText(r)).toContain('Preparing');
    // Past orders are grouped by day (the group label; R3 rows no longer repeat the date).
    expect(allText(r).toLowerCase()).toContain('today');

    press(r, 'Past');
    flush();

    // The simulator completes an order: it leaves Active and lands in Past.
    act(() => {
      useMockDb.setState((s) => ({
        orders: s.orders.map((o) =>
          o.id === ACTIVE_PICKUP.id ? { ...o, status: 'completed', history: [...o.history, { status: 'completed', at: new Date().toISOString() }] } : o,
        ),
      }));
    });
    flush();

    const reorder = pressables(r, /^Reorder /)[0];
    expect(reorder).toBeDefined();
    await act(async () => {
      void reorder?.props.onPress();
      await jest.advanceTimersByTimeAsync(2500);
    });
    expect(useCart.getState().items.length).toBeGreaterThan(0);
    act(() => r.unmount());
  });

  it('shows the empty states', () => {
    seed([]);
    const r = mount(<OrdersScreen />);
    flush();
    const text = allText(r);
    expect(text).toContain('No active orders');
    expect(text).toContain('No past orders yet');
    press(r, 'Order now');
    expect(mockRouter.navigate).toHaveBeenCalledWith('/menu');
    act(() => r.unmount());
  });
});

describe('Order tracking', () => {
  it('renders every state and follows the live status', () => {
    seed(ALL);
    for (const o of ALL) {
      mockParams.current = { id: o.id };
      const r = mount(<OrderScreen />);
      flush(1500);
      const text = allText(r);
      expect(text).toContain('Receipt');
      if (o.status === 'cancelled') expect(text).toContain('Order cancelled');
      if (o.status === 'completed') expect(text).toContain('Thanks for ordering with us'); // + the rolling "+N pts" caption
      if (o.status === 'preparing') expect(text).toContain('Maya is on your order');
      if (o.status === 'out_for_delivery') expect(text).toMatch(/Sam is on the way/);
      act(() => r.unmount());
    }

    // Live: preparing → ready → completed while the screen is open.
    mockParams.current = { id: ACTIVE_PICKUP.id };
    const r = mount(<OrderScreen />);
    for (const status of ['ready', 'completed'] as const) {
      act(() => {
        useMockDb.setState((s) => ({
          orders: s.orders.map((o) => (o.id === ACTIVE_PICKUP.id ? { ...o, status, history: [...o.history, { status, at: new Date().toISOString() }] } : o)),
        }));
      });
      flush(1500);
    }
    expect(allText(r)).toContain('Completed');
    act(() => r.unmount());
  });

  it('lets an in-car customer say they are here', async () => {
    seed(ALL);
    mockParams.current = { id: READY_CAR.id };
    const r = mount(<OrderScreen />);
    flush();
    expect(allText(r)).toContain('Silver Toyota Corolla · KA 03 MN 4521');
    press(r, /^I’m here/);
    await settle(2000);
    expect(useMockDb.getState().orders.find((o) => o.id === READY_CAR.id)?.arrived).toBe(true);
    flush();
    expect(allText(r)).toContain('A barista is heading out');
    act(() => r.unmount());
  });

  it('cancels a placed order through the confirm dialog', async () => {
    seed(ALL);
    mockParams.current = { id: PLACED_DINE.id };
    const r = mount(<OrderScreen />);
    flush();
    press(r, 'Cancel order');
    flush(600);
    expect(allText(r)).toContain('Cancel this order?');
    const confirm = pressables(r, 'Cancel order');
    await act(async () => {
      void confirm[confirm.length - 1]?.props.onPress();
      await jest.advanceTimersByTimeAsync(2500);
    });
    flush();
    const order = useMockDb.getState().orders.find((o) => o.id === PLACED_DINE.id);
    expect(order?.status).toBe('cancelled');
    expect(order?.paymentStatus).toBe('refunded');
    expect(allText(r)).toContain('Order cancelled');
    act(() => r.unmount());
  });

  it('shows a friendly not-found state', () => {
    seed(ALL);
    mockParams.current = { id: 'missing' };
    const r = mount(<OrderScreen />);
    flush();
    expect(allText(r)).toContain('We couldn’t find that order');
    act(() => r.unmount());
  });
});

describe('Rewards tab', () => {
  it('loads rewards, redeems one onto the cart and shows the ticket', async () => {
    seed(ALL);
    const r = mount(<RewardsScreen />);
    expect(allText(r)).toContain('Stamps');
    await settle(2500);
    expect(allText(r)).toContain('Any pastry');
    expect(allText(r)).toMatch(/[\d,]+ pts to go/);

    press(r, 'Redeem Any pastry for 400 points');
    flush(1200);
    expect(useCart.getState().rewardId).toBe('rw-pastry');
    expect(allText(r)).toContain('Reward unlocked');
    expect(allText(r)).toMatch(/ER-[2-9A-Z]{4}/);

    press(r, 'Done');
    flush(1200);
    expect(allText(r)).not.toContain('Reward unlocked');
    expect(allText(r)).toContain('is applied');

    // Re-open the applied reward and take it back off the order.
    press(r, /is applied\. Show the code$/);
    flush(1200);
    press(r, 'Remove reward from my next order');
    flush(1200);
    expect(useCart.getState().rewardId).toBeUndefined();

    press(r, /^Show all 6 transactions$/);
    flush();
    expect(allText(r)).toContain('Welcome bonus');
    act(() => r.unmount());
  });

  it('shows the offline state and recovers on retry', async () => {
    seed(ALL);
    act(() => {
      useDemo.getState().setOffline(true);
    });
    const r = mount(<RewardsScreen />);
    await settle(2500);
    expect(allText(r)).toContain('You’re offline');
    act(() => {
      useDemo.getState().setOffline(false);
    });
    press(r, 'Try again');
    await settle(2500);
    expect(allText(r)).toContain('Any pastry');
    act(() => r.unmount());
  });
});

describe('Profile tab', () => {
  it('edits the name and logs out after the dialog closes', async () => {
    seed(ALL);
    const r = mount(<ProfileScreen />);
    flush();
    expect(allText(r)).toContain('Ava Stone');
    // Notification switches live in Settings; Profile shows a one-line summary that links there.
    expect(allText(r)).toContain('Orders on');
    press(r, 'Notifications, Orders on');
    expect(mockRouter.push).toHaveBeenCalledWith('/settings');

    press(r, 'Edit your name');
    flush(800);
    const input = r.root.find((n) => n.props.accessibilityLabel === 'Your name' && typeof n.props.onChangeText === 'function');
    act(() => {
      input.props.onChangeText('Ava Marie Stone');
    });
    press(r, 'Save name');
    await settle(2000);
    expect(useSession.getState().profile?.name).toBe('Ava Marie Stone');

    press(r, 'Log out');
    flush(800);
    press(r, 'Log out', 'last');
    flush(1500);
    expect(useSession.getState().phone).toBeNull();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    act(() => r.unmount());
  });

  it('validates an empty name', () => {
    seed(ALL);
    const r = mount(<ProfileScreen />);
    press(r, 'Edit your name');
    flush(800);
    const input = r.root.find((n) => n.props.accessibilityLabel === 'Your name' && typeof n.props.onChangeText === 'function');
    act(() => {
      input.props.onChangeText(' ');
    });
    press(r, 'Save name');
    flush();
    expect(allText(r)).toContain('Please enter your name');
    act(() => r.unmount());
  });
});

describe('Settings, help and legal', () => {
  it('toggles demo tools and resets the demo', () => {
    seed(ALL);
    const r = mount(<SettingsScreen />);
    flush();
    press(r, 'Simulate offline');
    expect(useDemo.getState().offline).toBe(true);
    press(r, 'Fast order statuses');
    expect(useDemo.getState().fastStatus).toBe(true);
    press(r, 'Keep store open');
    expect(useDemo.getState().forceStoreOpen).toBe(false);
    press(r, 'Keep store open');
    expect(useDemo.getState().forceStoreOpen).toBe(true);
    press(r, 'Order updates');
    expect(useSession.getState().notificationPrefs.orderUpdates).toBe(false);

    press(r, 'Reset demo');
    flush(800);
    press(r, 'Reset everything');
    flush(1500);
    expect(useSession.getState().onboardingDone).toBe(false);
    expect(useMockDb.getState().orders).toHaveLength(0);
    expect(useDemo.getState().offline).toBe(false);
    act(() => {
      useDemo.getState().setFastStatus(false);
    });
    act(() => r.unmount());
  });

  it('opens FAQ answers', () => {
    seed(ALL);
    const r = mount(<HelpScreen />);
    flush();
    press(r, 'Can I change my order after placing it?');
    flush();
    expect(allText(r)).toContain('You can cancel while your order');
    act(() => r.unmount());
  });

  it('switches legal documents through the route param', () => {
    mockParams.current = { doc: 'privacy' };
    const r = mount(<LegalScreen />);
    flush();
    expect(allText(r)).toContain('Privacy policy');
    press(r, 'Terms');
    expect(mockRouter.setParams).toHaveBeenCalledWith({ doc: 'terms' });
    act(() => r.unmount());
  });
});
