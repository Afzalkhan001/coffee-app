/**
 * Smoke test for the G2 browse screens (Home, Menu, Category, Search): each mounts with the mock
 * API, walks its loading → content (and offline / empty) states, reacts to the main interactions
 * and unmounts without throwing. Catches runtime-only mistakes; it is not a visual test.
 */
import { Component, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

jest.useFakeTimers();

// Reanimated's scrollTo() is a no-op under Jest and warns on every call; the scroll itself isn't under test.
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
jest.mock('expo-router/js-tabs', () => ({ BottomTabBarHeightCallbackContext: require('react').createContext(undefined) }));
const mockParams: { current: Record<string, string | undefined> } = { current: {} };
jest.mock('expo-router', () => {
  const React = require('react');
  return {
    router: {
      push: jest.fn(),
      navigate: jest.fn(),
      back: jest.fn(),
      replace: jest.fn(),
      setParams: jest.fn(),
      canGoBack: () => true,
    },
    useIsFocused: () => true,
    // The live order pill's bottom-space hook reads the route (`/` = no pill).
    usePathname: () => '/',
    // useKeyboardAfterTransition (Android-only behaviour) subscribes to transitionEnd.
    useNavigation: () => ({ addListener: () => () => {} }),
    useLocalSearchParams: () => mockParams.current,
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
    useScrollToTop: () => {},
  };
});
jest.mock('@/components/onboarding/AnimatedSplash', () => ({ useSplashLifted: () => true }));
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
import { router } from 'expo-router';
import { OverlayHost } from '@/components/motion';
import { useDemo } from '@/store/demo';
import { useFavorites } from '@/store/favorites';
import { useSession } from '@/store/session';
import HomeScreen from '@/app/(tabs)/index';
import MenuScreen from '@/app/(tabs)/menu';
import CategoryScreen from '@/app/category/[id]';
import SearchScreen from '@/app/search';
import { applyFilter, freshPicks, popularPicks, promosFor, searchTerms, splitMatches, usefulFilters } from '../index';
import FavoritesScreen from '@/app/favorites';
import ProductRoute from '@/app/product/[id]';
import { PROMOTIONS } from '@/data/mock/marketing';
import { PRODUCTS } from '@/data/mock/menu';
/* eslint-enable import/first */

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

beforeEach(() => {
  jest.clearAllMocks();
  mockParams.current = {};
  act(() => {
    useFavorites.getState().reset();
    useDemo.setState({ offline: false, latencyMs: 10 });
    useSession.setState({
      phone: '9876543210',
      profile: { id: 'u1', phone: '9876543210', name: 'Ava Stone', createdAt: new Date().toISOString() },
      mode: 'pickup',
      table: undefined,
      car: undefined,
      selectedAddressId: undefined,
      recentSearches: ['oat latte', 'croissant'],
    });
  });
});

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

/** Let the simulated network + debounce timers run and their promises settle. */
async function settle(ms = 1500) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

/** Menu mounts its later sections one animation frame at a time: let those frames run. */
async function settleFrames(frames = 8) {
  for (let i = 0; i < frames; i++) await settle(20);
}

/** Every string rendered inside <Text> nodes, flattened. */
function texts(r: ReactTestRenderer): string {
  const out: string[] = [];
  const walk = (node: ReactTestInstance | string) => {
    if (typeof node === 'string') {
      out.push(node);
      return;
    }
    node.children.forEach(walk);
  };
  walk(r.root);
  return out.join(' ');
}

/** The outermost pressable with this label (wrappers forward the same props down the tree). */
function byLabel(r: ReactTestRenderer, label: string | RegExp): ReactTestInstance {
  const matches = r.root.findAll(
    (n) =>
      typeof n.props.onPress === 'function' &&
      typeof n.props.accessibilityLabel === 'string' &&
      (typeof label === 'string' ? n.props.accessibilityLabel === label : label.test(n.props.accessibilityLabel)),
  );
  const first = matches[0];
  if (!first) throw new Error(`no pressable labelled ${String(label)}`);
  return first;
}

describe('browse helpers', () => {
  it('select rails and filters from the mock menu', () => {
    expect(popularPicks(PRODUCTS).every((p) => p.isPopular)).toBe(true);
    const fresh = freshPicks(PRODUCTS);
    expect(fresh.length % 2).toBe(0);
    expect(fresh.every((p) => p.isAvailable)).toBe(true);
    const coffee = PRODUCTS.filter((p) => p.categoryId === 'coffee');
    const filters = usefulFilters(coffee).map((f) => f.id);
    expect(filters[0]).toBe('all');
    expect(filters).toContain('iced');
    expect(applyFilter(coffee, 'iced').length).toBeGreaterThan(0);
    expect(applyFilter(coffee, 'all')).toHaveLength(coffee.length);
  });

  it('only advertises FIRST20 to first-time customers', () => {
    expect(promosFor(PROMOTIONS, true).map((p) => p.code)).toContain('FIRST20');
    const regular = promosFor(PROMOTIONS, false);
    expect(regular.map((p) => p.code)).not.toContain('FIRST20');
    expect(regular[0].code).toBe('WELCOME10');
    expect(regular).toHaveLength(PROMOTIONS.length);
  });

  it('splits text around search matches', () => {
    expect(searchTerms('  Oat  latte oat ')).toEqual(['latte', 'oat']);
    expect(splitMatches('Iced Oat Latte', ['latte', 'oat'])).toEqual(['Iced ', 'Oat', ' ', 'Latte', '']);
    expect(splitMatches('Cookie', [])).toEqual(['Cookie']);
    expect(splitMatches('a+b (c)', ['+b', '(c'])).toEqual(['a', '+b', ' ', '(c', ')']);
  });
});

describe('browse screens', () => {
  it('Home: skeletons → content, mode switch, bell inbox, offline', async () => {
    const r = mount(<HomeScreen />);
    await settle();
    const t = texts(r);
    expect(t).toContain('Popular now');
    expect(t).toContain('Ava');
    // R3: no mode cards, stamp teaser, bakery grid or section subtitles on Home.
    expect(t).not.toContain('How are you ordering?');
    expect(t).not.toContain('Fresh from the oven');
    expect(t).not.toContain('Stamp card');
    expect(t).not.toContain('is ordering today');

    // The location row is the ordering-mode switch: it opens the mode sheet.
    act(() => {
      byLabel(r, /^Pickup from Indiranagar/).props.onPress();
    });
    expect(router.push).toHaveBeenCalledWith('/mode');

    // Bell opens the inbox; picking an item closes it and navigates.
    act(() => {
      byLabel(r, /^Notifications/).props.onPress();
    });
    await settle(500);
    act(() => {
      byLabel(r, /^20% off your first order/).props.onPress();
    });
    expect(router.navigate).toHaveBeenCalledWith('/menu');

    act(() => r.unmount());

    // Offline: the catalogue-backed sections give way to one retryable state.
    act(() => {
      useDemo.setState({ offline: true });
    });
    const offline = mount(<HomeScreen />);
    await settle();
    expect(texts(offline)).toContain('You’re offline');
    act(() => {
      useDemo.setState({ offline: false });
    });
    act(() => {
      byLabel(offline, 'Try again').props.onPress();
    });
    await settle();
    expect(texts(offline)).toContain('Popular now');
    act(() => offline.unmount());
  });

  it('Menu: sections, chips scroll-spy hooks, deep link', async () => {
    mockParams.current = { category: 'bakery' };
    const r = mount(<MenuScreen />);
    await settle();
    await settleFrames();
    const t = texts(r);
    expect(t).toContain('Coffee');
    // "Coffee 8": the count sits inline in the header (the label reads it out in full).
    expect(r.root.findAll((n) => n.props.accessibilityLabel === 'Coffee, 8 items').length).toBeGreaterThan(0);
    expect(t).toContain('Desserts'); // the later sections mounted too
    // Compact store row with the current mode's chip (opens the mode sheet).
    expect(t).toContain('Indiranagar');
    act(() => {
      byLabel(r, /^Indiranagar, .*\. Pickup, change$/).props.onPress();
    });
    expect(router.push).toHaveBeenCalledWith('/mode');

    // Lay out the sections (as the native layout pass would) and tap a chip.
    const sections = r.root.findAll((n) => {
      if (typeof n.type !== 'string' || typeof n.props.onLayout !== 'function') return false;
      const pad = StyleSheet.flatten(n.props.style)?.paddingTop;
      return pad === 24 || pad === 16;
    });
    expect(sections).toHaveLength(6);
    act(() => {
      sections.forEach((s, i) => s.props.onLayout({ nativeEvent: { layout: { x: 0, y: 400 + i * 600, width: 390, height: 560 } } }));
    });
    await settle(100);
    expect(router.setParams).toHaveBeenCalledWith({ category: undefined });
    act(() => {
      byLabel(r, /^Desserts, \d+ items$/).props.onPress();
    });
    await settle(1500);
    act(() => r.unmount());
  });

  it('Category: hero, filters, empty filter, unknown id, offline', async () => {
    mockParams.current = { id: 'coffee' };
    const r = mount(<CategoryScreen />);
    await settle();
    // Whole rupees, no paise: the cheapest coffee is the ₹160 espresso.
    expect(texts(r)).toContain('8 drinks · from ₹160');
    expect(texts(r)).not.toMatch(/\$|₹\d+\.\d/);
    act(() => {
      byLabel(r, 'Iced').props.onPress();
    });
    await settle(600);
    expect(texts(r)).toContain('Caramel Macchiato');
    act(() => {
      byLabel(r, 'Dairy-free').props.onPress();
    });
    await settle(600);
    expect(texts(r)).toContain('Americano');
    act(() => r.unmount());

    mockParams.current = { id: 'nope' };
    const missing = mount(<CategoryScreen />);
    await settle(200);
    expect(texts(missing)).toContain('We couldn’t find that category');
    act(() => missing.unmount());

    act(() => {
      useDemo.setState({ offline: true });
    });
    mockParams.current = { id: 'tea' };
    const offline = mount(<CategoryScreen />);
    await settle();
    expect(texts(offline)).toContain('You’re offline');
    act(() => offline.unmount());
  });

  it('Search: idle suggestions, debounced results with highlight, no matches, recent', async () => {
    const r = mount(<SearchScreen />);
    await settle();
    expect(texts(r)).toContain('Recent');
    expect(texts(r)).toContain('Popular');
    expect(texts(r)).toContain('Popular this week');

    const input = r.root.find((n) => n.props.accessibilityLabel === 'Search the menu' && typeof n.props.onChangeText === 'function');
    act(() => {
      input.props.onChangeText('latte');
    });
    await settle(1500);
    expect(texts(r)).toMatch(/\d+ results?/);
    expect(texts(r)).toContain('Latte');

    act(() => {
      input.props.onSubmitEditing();
    });
    expect(useSession.getState().recentSearches[0]).toBe('latte');

    // A multi-word near miss falls back to any-word matches instead of a dead end.
    act(() => {
      byLabel(r, 'Clear search').props.onPress();
    });
    await settle(300);
    act(() => {
      byLabel(r, 'oat latte').props.onPress();
    });
    await settle(1500);
    expect(texts(r)).toContain('No exact matches for “oat latte”');
    expect(texts(r)).toContain('Caffè'); // "Caffè " + highlighted "Latte"

    act(() => {
      input.props.onChangeText('zzzz');
    });
    await settle(1500);
    expect(texts(r)).toContain('Nothing for “zzzz”');
    expect(texts(r)).toContain('Popular right now'); // empty search keeps selling

    act(() => {
      byLabel(r, 'Latte').props.onPress();
    });
    await settle(1500);
    expect(texts(r)).toMatch(/\d+ results?/);

    act(() => {
      byLabel(r, 'Clear search').props.onPress();
    });
    await settle(300);
    act(() => {
      byLabel(r, 'Clear recent searches').props.onPress();
    });
    expect(useSession.getState().recentSearches).toEqual([]);

    act(() => {
      useDemo.setState({ offline: true });
    });
    act(() => {
      input.props.onChangeText('mocha');
    });
    await settle(1500);
    expect(texts(r)).toContain('You’re offline');
    act(() => r.unmount());
  });
});

describe('veg only + favourites', () => {
  it('Menu: Veg only drops the egg / non-veg items and names the emptied categories', async () => {
    act(() => {
      useFavorites.getState().setVegOnly(true);
    });
    const r = mount(<MenuScreen />);
    await settle();
    await settleFrames();
    let t = texts(r);
    expect(t).toContain('Avocado Toast');
    expect(t).not.toContain('Bacon & Egg Brioche');
    expect(t).not.toContain('Butter Croissant');
    expect(r.root.findAll((n) => n.props.accessibilityLabel === 'Breakfast, 1 items').length).toBeGreaterThan(0);
    expect(t).toContain('No veg items in Bakery & Snacks and Desserts');
    // The header switch reads as checked; "Show all items" turns the filter off.
    expect(byLabel(r, 'Veg only').props.accessibilityState).toEqual({ checked: true });
    act(() => {
      byLabel(r, 'Show all items').props.onPress();
    });
    await settle();
    await settleFrames();
    t = texts(r);
    expect(useFavorites.getState().vegOnly).toBe(false);
    expect(t).toContain('Butter Croissant');
    expect(t).not.toContain('No veg items in');
    // And back on from the header.
    act(() => {
      byLabel(r, 'Veg only').props.onPress();
    });
    expect(useFavorites.getState().vegOnly).toBe(true);
    act(() => r.unmount());
  });

  it('Category: an all-egg category explains itself; a narrowed one says "veg" in the hero', async () => {
    act(() => {
      useFavorites.getState().setVegOnly(true);
    });
    mockParams.current = { id: 'desserts' };
    const desserts = mount(<CategoryScreen />);
    await settle();
    expect(texts(desserts)).toContain('No veg items here');
    expect(texts(desserts)).toContain('Everything in Desserts contains egg.');
    act(() => desserts.unmount());

    mockParams.current = { id: 'breakfast' };
    const breakfast = mount(<CategoryScreen />);
    await settle();
    expect(texts(breakfast)).toContain('1 veg item · from ₹420');
    expect(texts(breakfast)).toContain('Avocado Toast');
    expect(texts(breakfast)).not.toContain('Bacon & Egg Brioche');
    act(() => {
      byLabel(breakfast, 'Veg only').props.onPress();
    });
    await settle(600);
    expect(texts(breakfast)).toContain('Bacon & Egg Brioche');
    expect(texts(breakfast)).toContain('2 items · from ₹360');
    act(() => breakfast.unmount());
  });

  it('Search: Veg only sets matches aside and offers them back', async () => {
    act(() => {
      useFavorites.getState().setVegOnly(true);
    });
    const r = mount(<SearchScreen />);
    await settle();
    const input = r.root.find((n) => n.props.accessibilityLabel === 'Search the menu' && typeof n.props.onChangeText === 'function');
    act(() => {
      input.props.onChangeText('brownie');
    });
    await settle(1500);
    expect(texts(r)).toContain('No veg results');
    expect(texts(r)).toContain('The one match contains egg.');
    act(() => {
      byLabel(r, 'Show all results').props.onPress();
    });
    await settle(300);
    expect(texts(r)).toContain('1 result');
    expect(texts(r)).toContain('Fudge');
    act(() => r.unmount());
  });

  it('Product detail: the diet mark leads the meta line and the header heart toggles the favourite', async () => {
    mockParams.current = { id: 'breakfast-sandwich' };
    const r = mount(<ProductRoute />);
    await settle(600);
    expect(r.root.findAll((n) => typeof n.type === 'string' && n.props?.accessibilityLabel === 'Non-vegetarian').length).toBe(1);
    act(() => {
      byLabel(r, 'Save Bacon & Egg Brioche to favourites').props.onPress();
    });
    expect(useFavorites.getState().ids).toEqual(['breakfast-sandwich']);
    act(() => {
      byLabel(r, 'Remove Bacon & Egg Brioche from favourites').props.onPress();
    });
    expect(useFavorites.getState().ids).toEqual([]);
    act(() => r.unmount());
  });

  it('Home swaps "Popular now" for "Your favourites"; the Favourites screen lists and removes them', async () => {
    act(() => {
      useFavorites.getState().toggle('croissant');
      useFavorites.getState().toggle('latte');
    });
    const home = mount(<HomeScreen />);
    await settle();
    expect(texts(home)).toContain('Your favourites');
    expect(texts(home)).not.toContain('Popular now');
    act(() => {
      byLabel(home, 'See all favourites').props.onPress();
    });
    expect(router.push).toHaveBeenCalledWith('/favorites');
    act(() => home.unmount());

    const list = mount(<FavoritesScreen />);
    await settle();
    expect(texts(list)).toContain('Caffè Latte');
    expect(texts(list)).toContain('Butter Croissant');
    act(() => {
      byLabel(list, 'Remove Caffè Latte from favourites').props.onPress();
    });
    await settle(600);
    expect(useFavorites.getState().ids).toEqual(['croissant']);
    expect(texts(list)).not.toContain('Caffè Latte');
    act(() => {
      byLabel(list, 'Remove Butter Croissant from favourites').props.onPress();
    });
    await settle(600);
    expect(texts(list)).toContain('No favourites yet');
    act(() => list.unmount());
  });
});
