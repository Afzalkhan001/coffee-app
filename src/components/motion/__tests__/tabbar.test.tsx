/** TabBar: measures labels + row, lays out the stretching pill, navigates with tabPress semantics. */
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { Text, View } from 'react-native';

jest.useFakeTimers();
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-router/js-tabs', () => ({ BottomTabBarHeightCallbackContext: require('react').createContext(undefined) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@expo/vector-icons/Ionicons', () => {
  const { Text: RNText } = require('react-native');
  return function MockIonicon({ name }: { name: string }) {
    return <RNText>{`icon:${name}`}</RNText>;
  };
});

/* eslint-disable import/first */
import { TAB_BAR_SPACE, TabBar } from '@/components/navigation/TabBar';

const TABS = [
  ['index', 'Home'],
  ['menu', 'Menu'],
  ['orders', 'Orders'],
  ['rewards', 'Rewards'],
  ['profile', 'Profile'],
] as const;

function makeProps(index: number, navigate: jest.Mock): BottomTabBarProps {
  const routes = TABS.map(([name]) => ({ key: `${name}-key`, name, params: undefined }));
  const descriptors = Object.fromEntries(TABS.map(([name, title]) => [`${name}-key`, { options: { title } }]));
  return {
    state: { index, routes, key: 'tabs', routeNames: routes.map((r) => r.name), type: 'tab', stale: false, history: [] },
    descriptors,
    navigation: { emit: () => ({ defaultPrevented: false }), navigate },
    insets: { top: 0, bottom: 34, left: 0, right: 0 },
  } as unknown as BottomTabBarProps;
}

/** Tab buttons (RN's Pressable is memo-wrapped, so match on the accessibility role). */
function findTabs(r: ReactTestRenderer): ReactTestInstance[] {
  const matches = r.root.findAll(
    (n: ReactTestInstance) =>
      typeof n.type !== 'string' && n.props.accessibilityRole === 'tab' && typeof n.props.onPress === 'function',
  );
  // Wrapper components forward the same props object down — keep one instance per tab.
  return matches.filter((n, i) => matches.findIndex((m) => m.props === n.props) === i);
}

const layout = (width: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width, height: 20 } } });

function measureAll(r: ReactTestRenderer) {
  const labelTexts = r.root.findAll((n: ReactTestInstance) => n.type === Text && typeof n.props.onLayout === 'function');
  const row = r.root.find((n: ReactTestInstance) => n.type === View && n.props.role === 'tablist');
  act(() => {
    for (const t of labelTexts) t.props.onLayout(layout(String(t.props.children).length * 7.5));
    row.props.onLayout(layout(342));
  });
}

describe('TabBar', () => {
  it('exports the bottom space screens must reserve', () => {
    expect(TAB_BAR_SPACE).toBe(84);
  });

  it('renders five tabs after measuring, active one labelled, and navigates on press', () => {
    const navigate = jest.fn();
    let r!: ReactTestRenderer;
    act(() => {
      r = create(<TabBar {...makeProps(0, navigate)} />);
    });
    // Before measurement: no tab items (only hidden label measurers).
    expect(findTabs(r)).toHaveLength(0);

    measureAll(r);
    act(() => {
      jest.advanceTimersByTime(50);
    });
    const tabs = findTabs(r);
    expect(tabs).toHaveLength(5);
    expect(tabs[0]?.props.accessibilityState).toEqual({ selected: true });
    expect(tabs.map((t) => t.props.accessibilityLabel)).toEqual(['Home', 'Menu', 'Orders', 'Rewards', 'Profile']);

    // Every tab draws its custom line glyph twice (inkSoft + white) for the cross-fade under the pill.
    const glyphs = r.root
      .findAll((n) => typeof n.type === 'function' && n.type.name === 'LineIconImpl')
      .map((i) => String(i.props.name));
    for (const name of ['home', 'menu', 'orders', 'rewards', 'profile']) {
      expect(glyphs.filter((g) => g === name)).toHaveLength(2);
    }

    act(() => tabs[3]?.props.onPress());
    expect(navigate).toHaveBeenCalledWith('rewards', undefined);

    // Re-tapping the focused tab does not navigate.
    navigate.mockClear();
    act(() => tabs[0]?.props.onPress());
    expect(navigate).not.toHaveBeenCalled();

    // Switching the active route re-targets the pill without throwing.
    act(() => r.update(<TabBar {...makeProps(3, navigate)} />));
    act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(findTabs(r)[3]?.props.accessibilityState).toEqual({ selected: true });
    act(() => r.unmount());
  });
});
