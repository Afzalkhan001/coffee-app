/**
 * Smoke test for the live order pill: it shows the soonest active order on a browsing route, hides
 * itself where it doesn't belong, follows live status changes, opens tracking and can be hidden
 * until the next status change. Not a visual test (animations are no-ops under Jest).
 */
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

jest.useFakeTimers();

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
const mockPath: { current: string } = { current: '/menu' };
jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  usePathname: () => mockPath.current,
  router: { push: jest.fn(), navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
}));
jest.mock('expo-router/js-tabs', () => ({ BottomTabBarHeightCallbackContext: require('react').createContext(undefined) }));
jest.mock('expo-blur', () => {
  const { View } = require('react-native');
  return { BlurView: View };
});
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
    return <RNText>{`icon:${name}`}</RNText>;
  };
});

/* eslint-disable import/first */
import { useMockDb } from '@/api/mockDb';
import { LiveOrderPill } from '@/components/order/LiveOrderPill';
import { useSession } from '@/store/session';
import type { Order, OrderStatus } from '@/types/models';
/* eslint-enable import/first */

const mockRouter = jest.requireMock<{ router: { push: jest.Mock } }>('expo-router').router;
const PHONE = '9876543210';
const PROFILE = { id: 'usr_1', phone: PHONE, name: 'Ava Stone', createdAt: '2026-09-01T10:00:00.000Z' };

function order(id: string, number: string, status: OrderStatus, minsAgo: number): Order {
  const at = new Date(Date.now() - minsAgo * 60_000).toISOString();
  return {
    id,
    number,
    createdAt: at,
    details: { mode: 'pickup', pickupTime: 'asap' },
    items: [{ id: 'l1', productId: 'latte', name: 'Caffè Latte', image: 'local:latte', basePrice: 250, quantity: 1, modifiers: [], lineTotal: 250 }],
    totals: { subtotal: 250, discount: 0, tax: 13, deliveryFee: 0, total: 263 },
    status,
    history: [{ status: 'placed', at }],
    paymentStatus: 'paid',
    paymentMethod: 'card',
    customer: { name: 'Ava Stone', phone: PHONE },
    etaMinutes: 9,
    pointsEarned: 52,
  } as Order;
}

function seed(orders: Order[]) {
  act(() => {
    useSession.setState({ onboardingDone: true, phone: PHONE, profile: PROFILE });
  });
  act(() => {
    useMockDb.setState({ orders, profiles: { [PHONE]: PROFILE }, sim: {} });
  });
}

function mount(): ReactTestRenderer {
  let r: ReactTestRenderer | undefined;
  act(() => {
    r = create(<LiveOrderPill />);
  });
  if (!r) throw new Error('not mounted');
  return r;
}

function pill(r: ReactTestRenderer): ReactTestInstance | undefined {
  return r.root.findAll((n) => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Order ER-') && typeof n.props.onPress === 'function')[0];
}

/** The pill is hidden from touch and assistive tech while it's tucked away. */
function hidden(r: ReactTestRenderer): boolean {
  const holder = r.root.findAll((n) => n.props['aria-hidden'] !== undefined && n.props.importantForAccessibility !== undefined)[0];
  return holder?.props['aria-hidden'] === true;
}

function texts(r: ReactTestRenderer): string[] {
  return r.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string);
}

afterEach(() => {
  mockRouter.push.mockClear();
  mockPath.current = '/menu';
});

describe('LiveOrderPill', () => {
  it('renders nothing without an active order', () => {
    seed([order('o1', 'ER-1000', 'completed', 60)]);
    const r = mount();
    expect(pill(r)).toBeUndefined();
    act(() => r.unmount());
  });

  it('leads with the soonest order and counts the rest', () => {
    seed([order('o1', 'ER-1001', 'preparing', 2), order('o2', 'ER-1002', 'ready', 9)]);
    const r = mount();
    const node = pill(r);
    expect(node?.props.accessibilityLabel).toBe('Order ER-1002, Ready for pickup. 2 active orders.');
    expect(texts(r)).toEqual(expect.arrayContaining(['Ready for pickup', '2 orders']));
    expect(hidden(r)).toBe(false);
    act(() => {
      node?.props.onPress();
    });
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/order/[id]', params: { id: 'o2' } });
    act(() => r.unmount());
  });

  it('hides on Home, tracking and the ordering flow', () => {
    seed([order('o1', 'ER-1001', 'preparing', 2)]);
    const r = mount();
    expect(hidden(r)).toBe(false);
    for (const path of ['/', '/orders', '/order/o1', '/product/latte', '/cart', '/checkout']) {
      mockPath.current = path;
      act(() => r.update(<LiveOrderPill />));
      expect(hidden(r)).toBe(true);
    }
    act(() => r.unmount());
  });

  it('follows status changes and re-shows after a hide', () => {
    seed([order('o1', 'ER-1001', 'accepted', 1)]);
    const r = mount();
    expect(texts(r)).toContain('Accepted');

    // "Hide" (the swipe's accessibility twin) tucks it away until the next status change.
    act(() => {
      pill(r)?.props.onAccessibilityAction({ nativeEvent: { actionName: 'dismiss' } });
    });
    expect(hidden(r)).toBe(true);

    act(() => {
      useMockDb.setState((s) => ({ orders: s.orders.map((o) => ({ ...o, status: 'preparing' as const })) }));
    });
    expect(hidden(r)).toBe(false);
    expect(texts(r)).toContain('Preparing');
    expect(pill(r)?.props.accessibilityLabel).toMatch(/^Order ER-1001, Preparing, about \d+ minutes? left\.$/);
    act(() => r.unmount());
  });
});
