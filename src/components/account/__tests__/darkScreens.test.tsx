/**
 * Dark mode coverage for the browse, account and sign-in SCREENS (DESIGN.md §R4): Home, Menu,
 * Category, Search, Orders, Rewards, Profile, Settings, Help, Legal, onboarding and the phone / OTP /
 * profile-setup sheets, plus the account components the tracking screen borrows (OrderHero,
 * OrderDetails) and the modal sheets (redeem ticket, edit name). Each mounts under
 * `<ThemeProvider preference="dark">` and no light-only colour may reach what it renders (a static
 * `colors.*` left behind shows up as a cream plane, a light hairline or a light tile). The same
 * screens in light still carry the R3 values, so light stays pixel-identical.
 */
import { Component, type ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

jest.useFakeTimers();

// Reanimated's scrollTo() is a no-op under Jest and warns on every call; the scroll isn't under test.
const realWarn = console.warn;
jest.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('scrollTo() is not supported with Jest')) return;
  realWarn(...args);
});

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-status-bar', () => ({ StatusBar: () => null, setStatusBarStyle: () => {} }));
jest.mock('expo-router/js-tabs', () => ({ BottomTabBarHeightCallbackContext: require('react').createContext(undefined) }));
const mockParams: { current: Record<string, string | undefined> } = { current: {} };
jest.mock('expo-router', () => {
  const React = require('react');
  const { Text: RNText } = require('react-native');
  return {
    router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn(), replace: jest.fn(), setParams: jest.fn(), canGoBack: () => true },
    useIsFocused: () => true,
    // The live order pill's bottom-space hook reads the route (`/` = no pill).
    usePathname: () => '/',
    useNavigation: () => ({ addListener: () => () => {} }),
    useLocalSearchParams: () => mockParams.current,
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
    useScrollToTop: () => {},
    Redirect: ({ href }: { href: string }) => <RNText>{`redirect:${href}`}</RNText>,
  };
});
jest.mock('@/components/onboarding/AnimatedSplash', () => ({ useSplashLifted: () => true, AnimatedSplash: () => null }));
jest.mock('@/lib/haptics', () => {
  const noop = () => {};
  return {
    haptic: { select: noop, tick: noop, toggle: noop, press: noop, land: noop, threshold: noop, longPress: noop, success: noop, warning: noop, error: noop },
    playHaptic: noop,
    configureHaptics: noop,
    hapticsEnabled: () => true,
  };
});
jest.mock('@/lib/location', () => ({
  requestLocationPermission: jest.fn(async () => 'granted'),
  getCurrentPosition: jest.fn(async () => null),
}));
jest.mock('@/lib/notify', () => ({
  canUseNotifications: true,
  requestNotificationPermission: jest.fn(async () => 'granted'),
  notifyNow: jest.fn(async () => {}),
}));
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
import HomeScreen from '@/app/(tabs)/index';
import MenuScreen from '@/app/(tabs)/menu';
import OrdersScreen from '@/app/(tabs)/orders';
import ProfileTab from '@/app/(tabs)/profile';
import RewardsScreen from '@/app/(tabs)/rewards';
import OtpScreen from '@/app/auth/otp';
import PhoneScreen from '@/app/auth/phone';
import ProfileSetupScreen from '@/app/auth/profile';
import CategoryScreen from '@/app/category/[id]';
import HelpScreen from '@/app/help';
import LegalScreen from '@/app/legal';
import OnboardingScreen from '@/app/onboarding';
import SearchScreen from '@/app/search';
import SettingsScreen from '@/app/settings';
import { useMockDb } from '@/api/mockDb';
import { EditNameSheet } from '@/components/account/EditNameSheet';
import { ItemsCard, ModeDetailsCard, ReceiptCard } from '@/components/account/OrderDetails';
import { OrderHero } from '@/components/account/OrderHero';
import { RedeemTicket } from '@/components/account/RedeemTicket';
import { NotificationsPopover, VegOnlyToggle } from '@/components/home';
import { OverlayHost } from '@/components/motion';
import { PRODUCTS } from '@/data/mock/menu';
import { REWARDS } from '@/data/mock/marketing';
import { useCart } from '@/store/cart';
import { useDemo } from '@/store/demo';
import { useFavorites } from '@/store/favorites';
import { useSession } from '@/store/session';
import { darkColors, lightBoxShadows, lightColors, lightHeroTints, lightTileTints, ThemeProvider, themeFor, type AppearancePreference } from '@/theme';
import type { Order, OrderMode, OrderStatus } from '@/types/models';
/* eslint-enable import/first */

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
  expect(caught.splice(0)).toEqual([]);
});

async function settle(ms = 3000) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

async function mount(preference: AppearancePreference, node: ReactNode): Promise<ReactTestRenderer> {
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
  // Mock API latency, entrances and the deferred menu sections.
  await settle(3000);
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
function rendered(r: ReactTestRenderer): string {
  const out: string[] = [];
  const seen = new WeakSet<object>();
  const collect = (value: unknown, depth: number) => {
    if (depth > 12 || value == null) return;
    if (typeof value === 'string' || typeof value === 'number') {
      out.push(String(value));
      return;
    }
    if (typeof value !== 'object' || seen.has(value)) return;
    // A React element held in a prop (SectionList's ListEmptyComponent): its fiber reaches every
    // context's DEFAULT value (the light theme). The element renders as its own host nodes anyway.
    if ('$$typeof' in value) return;
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

/** `#RRGGBB` → the ARGB integer react-native-svg renders a fill as. */
const argb = (hex: string) => (0xff000000 + parseInt(hex.slice(1), 16)) >>> 0;
/** `#RRGGBB` → the `rgba(r, g, b` prefix Reanimated's interpolateColor emits. */
const rgbaPrefix = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
};

/**
 * Light-only values found in a render. SVG fills and strokes reach the tree as ARGB integers
 * (react-native-svg), so every `#rrggbb` is looked for in that form too (as a whole number).
 */
function leaks(json: string, allow: readonly string[] = []): string[] {
  const lower = json.toLowerCase();
  const allowed = allow.map((a) => a.toLowerCase());
  return LIGHT_ONLY.filter((v) => {
    if (allowed.includes(v)) return false;
    if (lower.includes(v)) return true;
    return /^#[0-9a-f]{6}$/.test(v) && new RegExp(`(^|\\D)${argb(v)}(\\D|$)`).test(lower);
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
    details: mode === 'delivery' ? { mode, address: { id: 'a', label: 'Home', line1: 'Flat 4B, Sunrise Residency', city: 'Domlur, Bengaluru 560071', lat: 12.961, lng: 77.6387 } } : { mode, pickupTime: 'asap' },
    items: [
      { id: `${id}-1`, productId: p0.id, name: p0.name, image: p0.image, basePrice: p0.price, quantity: 2, modifiers: [{ groupId: 'g', groupName: 'Milk', optionId: 'o', optionName: 'Oat milk', priceDelta: 50 }], instructions: 'Extra hot', lineTotal: (p0.price + 50) * 2 },
      { id: `${id}-2`, productId: p1.id, name: p1.name, image: p1.image, basePrice: p1.price, quantity: 1, modifiers: [], lineTotal: p1.price },
    ],
    totals: { subtotal: 720, discount: 100, packaging: 15, tax: 32, deliveryFee: 0, total: 667 },
    couponCode: 'FIRST20',
    status,
    history: [{ status: 'placed', at }],
    paymentStatus: 'paid',
    paymentMethod: 'card',
    customer: { name: PROFILE.name, phone: PHONE },
    etaMinutes: 8,
    pointsEarned: 133,
    ...extra,
  };
}

const LIVE = makeOrder('live1', 'preparing', 'pickup');
const DONE = makeOrder('done22', 'completed', 'pickup', { createdAt: new Date(Date.now() - 26 * 3_600_000).toISOString() });
const CANCELLED = makeOrder('cxl333', 'cancelled', 'delivery', { paymentStatus: 'refunded' });

function seedSignedIn(orders: Order[] = [LIVE, DONE, CANCELLED]) {
  act(() => {
    useSession.setState({
      onboardingDone: true,
      phone: PHONE,
      profile: PROFILE,
      mode: 'pickup',
      notificationPermission: 'skipped',
      recentSearches: ['oat latte', 'croissant'],
    });
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
            { id: 't2', type: 'earn', points: 560, description: 'Order ER-1222', createdAt: '2026-10-01T10:00:00.000Z' },
            { id: 't3', type: 'redeem', points: -150, description: 'Redeemed · Free extra shot', createdAt: '2026-10-02T10:00:00.000Z' },
          ],
        },
      },
    });
  });
  act(() => {
    useCart.getState().clear();
    useFavorites.getState().reset();
    useDemo.setState({ offline: false, latencyMs: 10 });
  });
}

function seedSignedOut(onboardingDone: boolean) {
  act(() => {
    useSession.setState({ onboardingDone, phone: null, profile: null, notificationPermission: 'undetermined', locationPermission: 'undetermined' });
    useDemo.setState({ offline: false, latencyMs: 10 });
  });
}

beforeEach(() => {
  mockParams.current = {};
});

/** Mounts in dark, checks for leaks (minus `allow`) and that the dark planes are really on screen. */
async function expectDark(node: ReactNode, { allow = [], canvas = true }: { allow?: string[]; canvas?: boolean } = {}) {
  const r = await mount('dark', node);
  const json = rendered(r);
  expect(leaks(json, allow)).toEqual([]);
  if (canvas) expect(json).toContain(darkColors.bg);
  act(() => r.unmount());
}

/** The same node in light renders the R3 canvas and none of the dark planes. */
async function expectLight(node: ReactNode) {
  const r = await mount('light', node);
  const json = rendered(r).toLowerCase();
  expect(json).toContain(lightColors.bg.toLowerCase());
  expect(json).not.toContain(darkColors.bg.toLowerCase());
  expect(json).not.toContain(darkColors.surface.toLowerCase());
  act(() => r.unmount());
}

// The Veg-only switch keeps a white thumb in both schemes and pins its veg mark to the light square
// (`ThemeScope scheme="light"`): the one light value a dark screen may carry, and only there.
const VEG_THUMB = [lightColors.veg];

describe('the leak check', () => {
  it('catches a static light value in a style and in an SVG fill', async () => {
    const r = await mount(
      'dark',
      <View style={{ backgroundColor: lightColors.bg }}>
        <Svg width={10} height={10}>
          <Rect width={10} height={10} fill={lightTileTints.tea} />
        </Svg>
      </View>,
    );
    expect(leaks(rendered(r))).toEqual([lightColors.bg.toLowerCase(), lightTileTints.tea.toLowerCase()]);
    act(() => r.unmount());
  });
});

describe('browse screens in dark', () => {
  beforeEach(() => seedSignedIn());

  it('Home', async () => {
    await expectDark(<HomeScreen />);
    await expectLight(<HomeScreen />);
  });

  it('Menu (with the Veg only switch on and off)', async () => {
    await expectDark(<MenuScreen />, { allow: VEG_THUMB });
    act(() => {
      useFavorites.getState().setVegOnly(true);
    });
    await expectDark(<MenuScreen />, { allow: VEG_THUMB });
    act(() => {
      useFavorites.getState().setVegOnly(false);
    });
    await expectLight(<MenuScreen />);
  });

  it('Category', async () => {
    mockParams.current = { id: 'coffee' };
    await expectDark(<CategoryScreen />, { allow: VEG_THUMB });
    await expectLight(<CategoryScreen />);
  });

  it('Search', async () => {
    await expectDark(<SearchScreen />);
    await expectLight(<SearchScreen />);
  });

  it('the Veg only switch: a dark pill and track, the light mark on its white thumb', async () => {
    const r = await mount('dark', <VegOnlyToggle value onValueChange={() => {}} />);
    const json = rendered(r);
    expect(leaks(json, VEG_THUMB)).toEqual([]);
    // The pill is the dark surface and the "on" track the dark-tuned veg green (interpolated → rgba).
    expect(json).toContain(darkColors.surface);
    expect(json).toContain(rgbaPrefix(darkColors.veg));
    // react-native-svg hands fills over as ARGB integers: the thumb's mark is the LIGHT veg green.
    expect(json).toContain(String(argb(lightColors.veg)));
    expect(json).not.toContain(String(argb(darkColors.veg)));
    act(() => r.unmount());
  });

  it('the Home notifications popover', async () => {
    const items = [{ id: 'n1', image: PRODUCTS[0]!.image, title: 'Preparing', body: 'Ready in ~6 min', onPress: () => {} }];
    await expectDark(<NotificationsPopover open items={items} onClose={() => {}} top={60} />, { canvas: false });
  });
});

describe('account screens in dark', () => {
  beforeEach(() => seedSignedIn());

  it('Orders', async () => {
    await expectDark(<OrdersScreen />);
    await expectLight(<OrdersScreen />);
  });

  it('Rewards and the redeem ticket', async () => {
    await expectDark(<RewardsScreen />);
    await expectLight(<RewardsScreen />);
    await expectDark(<RedeemTicket visible reward={REWARDS[0]} code="ER-7Q2K" fresh onClose={() => {}} onRemove={() => {}} />, { canvas: false });
  });

  it('Profile and the edit-name sheet', async () => {
    await expectDark(<ProfileTab />);
    await expectLight(<ProfileTab />);
    await expectDark(<EditNameSheet visible onClose={() => {}} />, { canvas: false });
  });

  it('Settings, Help and Legal', async () => {
    await expectDark(<SettingsScreen />);
    await expectDark(<HelpScreen />);
    mockParams.current = { doc: 'privacy' };
    await expectDark(<LegalScreen />);
    await expectLight(<LegalScreen />);
  });

  it('the tracking components (live, finished, cancelled, details)', async () => {
    for (const order of [LIVE, DONE, CANCELLED]) {
      await expectDark(
        <>
          <OrderHero order={order} />
          <ModeDetailsCard order={order} />
          <ItemsCard order={order} />
          <ReceiptCard order={order} />
        </>,
        // The live card's pickup-code notches punch the canvas colour; the finished ones sit on it.
        { canvas: order === LIVE },
      );
    }
  });
});

describe('onboarding and sign-in in dark', () => {
  it('onboarding stays on night in both schemes', async () => {
    seedSignedOut(false);
    const dark = await mount('dark', <OnboardingScreen />);
    const darkJson = rendered(dark);
    expect(leaks(darkJson)).toEqual([]);
    expect(darkJson).toContain(darkColors.night);
    act(() => dark.unmount());
    const light = await mount('light', <OnboardingScreen />);
    // Night tokens are fixed: the same canvas either way.
    expect(rendered(light)).toContain(lightColors.night);
    act(() => light.unmount());
  });

  it('phone, OTP and profile setup: a lifted surface sheet with sunken fields in dark', async () => {
    seedSignedOut(true);
    for (const screen of ['phone', 'otp', 'profile'] as const) {
      if (screen === 'otp') mockParams.current = { phone: PHONE, expiresAt: String(Date.now() + 120_000), resendAt: String(Date.now() + 30_000) };
      if (screen === 'profile') act(() => {
        useSession.setState({ phone: PHONE });
      });
      const node = screen === 'phone' ? <PhoneScreen /> : screen === 'otp' ? <OtpScreen /> : <ProfileSetupScreen />;
      const r = await mount('dark', node);
      const json = rendered(r);
      expect(leaks(json)).toEqual([]);
      // Sheet = surface, fields = the canvas (R3 controls-inside-a-sheet rule), top = night.
      expect(json).toContain(darkColors.surface);
      expect(json).toContain(darkColors.bg);
      expect(json).toContain(darkColors.night);
      act(() => r.unmount());

      const light = await mount('light', node);
      const lightJson = rendered(light).toLowerCase();
      // R3 light: a canvas sheet with white fields.
      expect(lightJson).toContain(lightColors.bg.toLowerCase());
      expect(lightJson).not.toContain(darkColors.surface.toLowerCase());
      act(() => light.unmount());
    }
  });
});
