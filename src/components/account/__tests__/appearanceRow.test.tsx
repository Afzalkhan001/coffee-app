/**
 * Settings → Preferences → Appearance (DESIGN.md §R4): the three-way pill persists the choice and
 * the app re-themes in place (the root layout feeds the stored preference to `ThemeProvider`).
 */
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.useFakeTimers();

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
const mockHaptics: string[] = [];
jest.mock('@/lib/haptics', () => {
  const kind = (k: string) => () => mockHaptics.push(k);
  return {
    haptic: {
      select: kind('select'),
      tick: kind('tick'),
      toggle: kind('toggle'),
      press: kind('press'),
      land: kind('land'),
      threshold: kind('threshold'),
      longPress: kind('longPress'),
      success: kind('success'),
      warning: kind('warning'),
      error: kind('error'),
    },
    playHaptic: (k: string) => mockHaptics.push(k),
    configureHaptics: () => {},
    hapticsEnabled: () => true,
  };
});

/* eslint-disable import/first */
import { useAppearance, useSession } from '@/store/session';
import { ThemeProvider, useTheme } from '@/theme';
import { AppearanceRow } from '../AppearanceRow';
/* eslint-enable import/first */

function SchemeProbe() {
  return <Text testID="scheme">{useTheme().scheme}</Text>;
}

/** The root layout's wiring: the stored preference drives the provider. */
function App() {
  const appearance = useAppearance();
  return (
    <ThemeProvider preference={appearance}>
      <AppearanceRow />
      <SchemeProbe />
    </ThemeProvider>
  );
}

function press(r: ReactTestRenderer, label: string) {
  // The innermost match is PressableScale's own Pressable (its onPress plays the haptic, then ours).
  const target = r.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function').pop();
  if (!target) throw new Error(`no ${label}`);
  act(() => {
    target.props.onPress();
  });
  act(() => {
    jest.advanceTimersByTime(1000);
  });
}

const scheme = (r: ReactTestRenderer) => r.root.findByProps({ testID: 'scheme' }).props.children;
/** Labels of the selected radios (each pressable appears at several nesting levels: de-duplicated). */
const selected = (r: ReactTestRenderer) => [
  ...new Set(
    r.root
      .findAll((n) => n.props.accessibilityRole === 'radio' && typeof n.props.onPress === 'function')
      .filter((n) => n.props.accessibilityState?.selected)
      .map((n) => n.props.accessibilityLabel as string),
  ),
];

describe('AppearanceRow', () => {
  beforeEach(() => {
    act(() => {
      useSession.getState().setAppearance('system');
    });
    mockHaptics.length = 0;
  });

  it('offers System, Light and Dark, System selected by default', () => {
    let r: ReactTestRenderer | undefined;
    act(() => {
      r = create(<App />);
    });
    expect(selected(r!)).toEqual(['System appearance']);
    expect(scheme(r!)).toBe('light');
  });

  it('switches the whole tree in place and persists the choice', () => {
    let r: ReactTestRenderer | undefined;
    act(() => {
      r = create(<App />);
    });
    press(r!, 'Dark appearance');
    expect(useSession.getState().appearance).toBe('dark');
    expect(scheme(r!)).toBe('dark');
    expect(selected(r!)).toEqual(['Dark appearance']);
    expect(mockHaptics).toEqual(['select']);

    press(r!, 'Light appearance');
    expect(scheme(r!)).toBe('light');
    // Re-tapping the current choice is silent and changes nothing.
    press(r!, 'Light appearance');
    expect(mockHaptics).toEqual(['select', 'select']);
    expect(useSession.getState().appearance).toBe('light');
  });
});
