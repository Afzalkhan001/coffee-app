/**
 * Smoke + flow test for product detail (src/app/product/[id].tsx): mounts the real screen with
 * mock data and drives the customization flows through the same handlers a tap would call.
 * Catches runtime-only mistakes (hook order, data access, state flow) the type checker can't.
 * Not a visual test: animations, measuring and the flight are no-ops / fallbacks under Jest.
 */
import { Component, type ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

jest.useFakeTimers();

const mockParams: { id: string; lineId?: string } = { id: 'latte' };

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  useLocalSearchParams: () => mockParams,
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) },
}));
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
    return <RNText>{name}</RNText>;
  };
});

/* eslint-disable import/first */
import ProductRoute from '@/app/product/[id]';
import { OverlayHost, setHeroOrigin } from '@/components/motion';
import { useCart } from '@/store/cart';
/* eslint-enable import/first */

const mockRouter = jest.requireMock<{ router: { back: jest.Mock; push: jest.Mock } }>('expo-router').router;

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

function mount(): ReactTestRenderer {
  let r: ReactTestRenderer | undefined;
  act(() => {
    r = create(
      <Boundary>
        <OverlayHost>
          <ProductRoute />
        </OverlayHost>
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

/** First pressable whose accessibility label matches. */
function pressable(r: ReactTestRenderer, label: string | RegExp): ReactTestInstance {
  const match = (value: unknown) =>
    typeof value === 'string' && (typeof label === 'string' ? value === label : label.test(value));
  const found = r.root.findAll((n) => match(n.props.accessibilityLabel) && typeof n.props.onPress === 'function');
  const node = found[0];
  if (!node) throw new Error(`no pressable labelled ${String(label)}`);
  return node;
}

function tap(r: ReactTestRenderer, label: string | RegExp) {
  const node = pressable(r, label);
  act(() => {
    node.props.onPress();
  });
}

async function tapAsync(r: ReactTestRenderer, label: string | RegExp) {
  const node = pressable(r, label);
  await act(async () => {
    node.props.onPress();
    await jest.advanceTimersByTimeAsync(2000); // measure guard + flight safety net
  });
}

function texts(r: ReactTestRenderer): string[] {
  return r.root
    .findAll((n) => typeof n.props.children === 'string')
    .map((n) => n.props.children as string);
}

const resetCart = () =>
  act(() => {
    useCart.getState().clear();
  });

const realWarn = console.warn;
beforeAll(() => {
  // measure()/scrollTo() are UI-runtime only; under Jest they warn and return null (expected).
  jest.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    if (String(args[0]).includes('measure() cannot be used with Jest')) return;
    realWarn(...args);
  });
});

beforeEach(() => {
  resetCart();
  mockParams.id = 'latte';
  delete mockParams.lineId;
  jest.clearAllMocks();
});

afterEach(() => {
  expect(caught.splice(0)).toEqual([]);
});

describe('product detail', () => {
  it('requires size + temperature, then adds the configured line (milk defaults to whole)', async () => {
    setHeroOrigin('latte', { x: 30, y: 240, width: 120, height: 120 }); // exercise the FLIP path
    const r = mount();
    flush();
    expect(texts(r)).toContain('Choose a size'); // the bar reads as the next step

    // Invalid tap points at the missing group but never adds.
    await tapAsync(r, /^Add to cart\. Choose a size/);
    expect(useCart.getState().items).toHaveLength(0);

    tap(r, /^Medium, 12 oz/);
    flush(400);
    expect(texts(r)).toContain('Choose a temperature');

    tap(r, 'Hot');
    flush(400);
    expect(texts(r).some((t) => t.startsWith('Choose a'))).toBe(false);

    await tapAsync(r, 'Add to cart, ₹280');
    flush();
    const items = useCart.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0]?.modifiers.map((m) => m.optionId)).toEqual(['size-m', 'temp-hot', 'milk-whole']);
    expect(items[0]?.quantity).toBe(1);

    // Adding the same configuration again merges into the same line.
    await tapAsync(r, 'Add to cart, ₹280');
    flush();
    expect(useCart.getState().items).toHaveLength(1);
    expect(useCart.getState().items[0]?.quantity).toBe(2);

    act(() => r.unmount());
  });

  it('caps multi-select groups at their max', () => {
    const r = mount();
    flush();
    // Optional groups start collapsed ("Syrup · Optional ⌄"); opening one shows its rows.
    expect(() => pressable(r, 'Vanilla, +₹40')).toThrow();
    tap(r, /^Syrup, /);
    flush(400);
    tap(r, 'Vanilla, +₹40');
    tap(r, 'Caramel, +₹40');
    tap(r, 'Hazelnut, +₹40'); // third syrup: refused (max 2)
    flush(400);
    tap(r, /^Large, 16 oz/);
    tap(r, 'Iced');
    flush(400);
    // ₹250 + L ₹60 + 2 × ₹40 = ₹390
    expect(pressable(r, 'Add to cart, ₹390')).toBeTruthy();
    // The collapsed row now names the picks.
    expect(texts(r)).toContain('Vanilla, Caramel');
    act(() => r.unmount());
  });

  it('opens one group at a time, the bean profile and the note', () => {
    const r = mount();
    flush();
    tap(r, /^Milk, /);
    flush(400);
    expect(pressable(r, 'Oat milk, +₹50')).toBeTruthy();
    tap(r, /^Syrup, /);
    flush(400);
    expect(() => pressable(r, 'Oat milk, +₹50')).toThrow(); // Milk closed when Syrup opened
    expect(pressable(r, 'Vanilla, +₹40')).toBeTruthy();

    tap(r, /^About the beans/);
    flush(600);
    expect(texts(r)).toContain('Roasted in-house weekly'); // the unchanged CoffeeProfile, in a sheet

    tap(r, 'Add a note');
    flush(400);
    expect(r.root.findAll((n) => n.props.accessibilityLabel === 'Special instructions').length).toBeGreaterThan(0);

    tap(r, 'Increase quantity');
    flush(400);
    expect(texts(r).some((t) => t.startsWith('Choose a'))).toBe(true);
    act(() => r.unmount());
  });

  it('edits an existing cart line in place', () => {
    let lineId = '';
    act(() => {
      lineId = useCart.getState().add({
        productId: 'latte',
        name: 'Caffè Latte',
        image: 'x',
        basePrice: 250,
        quantity: 2,
        modifiers: [
          { groupId: 'size', groupName: 'Size', optionId: 'size-s', optionName: 'Small', shortName: 'S', priceDelta: 0 },
          { groupId: 'temperature', groupName: 'Temperature', optionId: 'temp-iced', optionName: 'Iced', priceDelta: 0 },
          { groupId: 'milk', groupName: 'Milk', optionId: 'milk-oat', optionName: 'Oat milk', priceDelta: 50 },
        ],
      });
    });
    mockParams.lineId = lineId;
    const r = mount();
    flush();
    expect(texts(r)).toContain('Update item'); // the bar says what this screen does

    // Prefilled: S + iced + oat, qty 2 → (₹250 + ₹50) × 2
    tap(r, /^Large, 16 oz/);
    flush(400);
    tap(r, 'Update item, ₹720'); // (₹250 + ₹60 + ₹50) × 2
    flush();
    const items = useCart.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe(lineId);
    expect(items[0]?.modifiers.map((m) => m.optionId)).toEqual(['size-l', 'temp-iced', 'milk-oat']);
    expect(mockRouter.back).toHaveBeenCalled();
    act(() => r.unmount());
  });

  it('explains when an edit merges the line into an identical one', () => {
    const snap = (groupId: string, optionId: string, optionName: string, priceDelta = 0) => ({
      groupId,
      groupName: groupId,
      optionId,
      optionName,
      priceDelta,
    });
    const base = { productId: 'latte', name: 'Caffè Latte', image: 'x', basePrice: 250 };
    let medium = '';
    act(() => {
      medium = useCart.getState().add({
        ...base,
        quantity: 1,
        modifiers: [snap('size', 'size-m', 'Medium', 30), snap('temperature', 'temp-hot', 'Hot'), snap('milk', 'milk-whole', 'Whole milk')],
      });
      useCart.getState().add({
        ...base,
        quantity: 2,
        modifiers: [snap('size', 'size-l', 'Large', 60), snap('temperature', 'temp-hot', 'Hot'), snap('milk', 'milk-whole', 'Whole milk')],
      });
    });
    mockParams.lineId = medium;
    const r = mount();
    flush();
    tap(r, /^Large, 16 oz/);
    flush(400);
    tap(r, /^Update item, ₹/);
    flush(200);
    const items = useCart.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0]?.quantity).toBe(3);
    expect(texts(r)).toContain('Merged with your other Caffè Latte (now 3)');
    act(() => r.unmount());
  });

  it('adds a food item straight away and shows the sold-out and not-found states', async () => {
    mockParams.id = 'croissant';
    let r = mount();
    flush();
    await tapAsync(r, /^Add to cart, ₹/);
    flush();
    expect(useCart.getState().items.map((i) => i.productId)).toEqual(['croissant']);
    act(() => r.unmount());

    mockParams.id = 'iced-peach-tea';
    r = mount();
    flush();
    expect(texts(r)).toContain('Sold out · back tomorrow');
    // No customizer for an item nobody can buy: a note and alternatives instead.
    expect(texts(r)).toContain('Back tomorrow at 7am');
    expect(texts(r)).toContain('Try instead');
    expect(texts(r)).not.toContain('Make it yours');
    expect(texts(r).some((t) => t.startsWith('*'))).toBe(false); // no ember "*Choose one"
    act(() => r.unmount());

    mockParams.id = 'no-such-thing';
    r = mount();
    flush();
    expect(texts(r)).toContain('This one’s off the menu');
    act(() => r.unmount());
  });
});
