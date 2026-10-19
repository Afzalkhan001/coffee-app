/**
 * The delivery address screen's structured Indian address form: add (inline validation, PIN
 * auto-fill, label chips), edit, remove (confirmed; the selection moves on), "Use current location"
 * pre-fill, the unsaved-changes guard and the receiver's +91 number. Mounts the real route with the
 * real stores and the mock API.
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
  useLocalSearchParams: () => ({}),
  useFocusEffect: (effect: () => void | (() => void)) => {
    const { useEffect } = require('react');
    useEffect(effect, [effect]);
  },
  router: {
    push: (...a: unknown[]) => mockNav.calls.push(['push', ...a]),
    replace: (...a: unknown[]) => mockNav.calls.push(['replace', ...a]),
    navigate: (...a: unknown[]) => mockNav.calls.push(['navigate', ...a]),
    back: () => mockNav.calls.push(['back']),
    canGoBack: () => true,
  },
}));
jest.mock('expo-router/react-navigation', () => ({ usePreventRemove: () => {} }));
jest.mock('expo-status-bar', () => ({ setStatusBarStyle: () => {} }));
jest.mock('@/lib/location', () => ({
  requestLocationPermission: () => Promise.resolve(mockLocation.permission),
  getCurrentPosition: () => Promise.resolve(mockLocation.position),
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
// The confirm dialog's backdrop drives the iOS blur's `intensity` through animated props, which the
// jest updater can't patch on the real class component: stand in a plain view.
jest.mock('expo-blur', () => {
  const { View } = require('react-native');
  return { BlurView: ({ style }: { style?: unknown }) => <View style={style} /> };
});
jest.mock('@expo/vector-icons/Ionicons', () => {
  const { Text: RNText } = require('react-native');
  return function MockIonicon({ name }: { name: string }) {
    return <RNText>{name}</RNText>;
  };
});
require('react-native-gesture-handler/jestSetup');

/* eslint-disable import/first */
import AddressScreen from '@/app/address';
import { OverlayHost } from '@/components/motion';
import { SEED_ADDRESSES } from '@/data/mock/marketing';
import { useDemo } from '@/store/demo';
import { useSession } from '@/store/session';
/* eslint-enable import/first */

const mockNav: { calls: unknown[][] } = { calls: [] };
const mockLocation: { permission: string; position: { lat: number; lng: number } | null } = { permission: 'denied', position: null };

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
          <AddressScreen />
        </OverlayHost>
      </Boundary>,
    );
  });
  if (!r) throw new Error('not mounted');
  flush();
  return r;
}

function flush(ms = 3000) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}


/** Pressables with this accessibility label (the hidden list stays mounted under the form, so `last` picks the form's). */
function pressable(r: ReactTestRenderer, label: string, which: 'first' | 'last' = 'first'): ReactTestInstance {
  const found = r.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function');
  const hit = which === 'last' ? found[found.length - 1] : found[0];
  if (!hit) throw new Error(`No pressable labelled "${label}"`);
  return hit;
}

function press(r: ReactTestRenderer, label: string, which: 'first' | 'last' = 'first') {
  act(() => {
    pressable(r, label, which).props.onPress();
  });
}

function input(r: ReactTestRenderer, label: string): ReactTestInstance {
  const hit = r.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onChangeText === 'function')[0];
  if (!hit) throw new Error(`No input labelled "${label}"`);
  return hit;
}

function type(r: ReactTestRenderer, label: string, text: string) {
  act(() => {
    input(r, label).props.onChangeText(text);
  });
}

function textContent(r: ReactTestRenderer): string {
  return r.root
    .findAll((n) => typeof n.props.children === 'string')
    .map((n) => n.props.children as string)
    .join(' | ');
}

const addresses = () => useSession.getState().addresses;
const byId = (id: string) => addresses().find((a) => a.id === id);

beforeAll(() => {
  act(() => {
    useDemo.setState({ latencyMs: 50, offline: false });
    useSession.setState({
      phone: '9876543210',
      profile: { id: 'usr_1', phone: '9876543210', name: 'Maya Rivers', createdAt: new Date().toISOString() },
    });
  });
});

beforeEach(() => {
  mockNav.calls = [];
  mockLocation.permission = 'denied';
  mockLocation.position = null;
  act(() => {
    useSession.setState({ mode: 'delivery', addresses: SEED_ADDRESSES, selectedAddressId: 'addr-home' });
  });
});

afterEach(() => {
  const errors = caught.splice(0);
  expect(errors).toEqual([]);
});

describe('address form', () => {
  it('adds an address: inline errors first, then PIN auto-fill, a label chip and a selected new row', async () => {
    const r = mount();
    expect(textContent(r)).toContain('Delivery address');
    expect(textContent(r)).toContain('Domlur, Bengaluru 560071 · 1.2 km');

    press(r, 'Add new address');
    flush(800);
    expect(textContent(r)).toContain('New address');
    // Home and Work are taken, so a new address starts as Other; Bengaluru, Karnataka are pre-filled.
    expect(input(r, 'City').props.value).toBe('Bengaluru');
    expect(input(r, 'State').props.value).toBe('Karnataka');
    expect(textContent(r)).toContain('Add the house or flat number'); // the disabled bar's hint

    press(r, 'Save address', 'last');
    flush(600);
    const errors = textContent(r);
    expect(errors).toContain('Add a building or street');
    expect(errors).toContain('Add the area');
    expect(errors).toContain('Add the PIN code');
    expect(addresses()).toHaveLength(3);

    type(r, 'House / flat / floor no.', 'Flat 9');
    type(r, 'Building / apartment name', 'Lake View');
    type(r, 'Nearby landmark', 'opp. Indiranagar Metro');
    type(r, 'Area / locality', 'Indiranagar');
    type(r, 'City', '');
    type(r, 'State', '');
    type(r, 'PIN code', '56003');
    expect(input(r, 'City').props.value).toBe('');
    type(r, 'PIN code', '560038');
    expect(input(r, 'City').props.value).toBe('Bengaluru');
    expect(input(r, 'State').props.value).toBe('Karnataka');
    press(r, 'Other');
    expect(textContent(r)).toContain('Name this place');
    type(r, 'Name this place', 'Gym');

    await act(async () => {
      pressable(r, 'Save address', 'last').props.onPress();
      await jest.advanceTimersByTimeAsync(1500);
    });
    flush(800);
    const added = addresses()[0]!;
    expect(added).toMatchObject({
      kind: 'other',
      label: 'Gym',
      line1: 'Flat 9, Lake View',
      line2: 'Opp. Indiranagar Metro',
      city: 'Indiranagar, Bengaluru 560038',
      parts: { area: 'Indiranagar', pin: '560038', state: 'Karnataka' },
    });
    expect(useSession.getState().selectedAddressId).toBe(added.id);
    expect(textContent(r)).not.toContain('New address');
    act(() => r.unmount());
  });

  it('edits an address in place and removes one after confirming, moving the selection on', async () => {
    const r = mount();
    const before = byId('addr-home')!;

    press(r, 'Edit Home');
    flush(800);
    expect(textContent(r)).toContain('Edit address');
    expect(input(r, 'Nearby landmark').props.value).toBe('Domlur Flyover');
    expect(input(r, 'Delivery instructions').props.value).toBe('Ring 4B, leave with security');
    type(r, 'House / flat / floor no.', 'Flat 5C');
    await act(async () => {
      pressable(r, 'Save address', 'last').props.onPress();
      await jest.advanceTimersByTimeAsync(800);
    });
    const edited = byId('addr-home')!;
    expect(edited).toMatchObject({ line1: 'Flat 5C, Sunrise Residency, 6th Cross', line2: 'Near Domlur Flyover', lat: before.lat, lng: before.lng });
    expect(addresses().map((a) => a.id)).toEqual(['addr-home', 'addr-work', 'addr-cabin']);

    press(r, 'Edit Home');
    flush(800);
    press(r, 'Remove address');
    flush(800);
    expect(textContent(r)).toContain('Remove Home?');
    expect(textContent(r)).toContain('It’s your delivery address. We’ll switch to Work.');
    press(r, 'Remove');
    flush(1500);
    expect(byId('addr-home')).toBeUndefined();
    expect(useSession.getState().selectedAddressId).toBe('addr-work');
    expect(textContent(r)).toContain('Home removed');
    expect(textContent(r)).not.toContain('Edit address');
    act(() => r.unmount());
  });

  it('moving the chosen address out of range falls back to one we deliver to', async () => {
    const r = mount();
    press(r, 'Edit Home');
    flush(800);
    type(r, 'Area / locality', 'Mysuru');
    type(r, 'PIN code', '570001');
    type(r, 'City', 'Mysuru');
    await act(async () => {
      pressable(r, 'Save address', 'last').props.onPress();
      await jest.advanceTimersByTimeAsync(1500);
    });
    flush(800);
    expect(textContent(r)).toContain('No delivery to this address yet');
    expect(useSession.getState().selectedAddressId).toBe('addr-work');
    act(() => r.unmount());
  });

  it('"Use current location" pre-fills the neighbourhood; leaving with changes asks first', async () => {
    mockLocation.permission = 'granted';
    mockLocation.position = { lat: 12.9612, lng: 77.6389 };
    const r = mount();
    await act(async () => {
      void pressable(r, 'Use current location').props.onPress();
      await jest.advanceTimersByTimeAsync(1000);
    });
    expect(textContent(r)).toContain('Location found near Domlur. Add your flat and building.');
    expect(input(r, 'Area / locality').props.value).toBe('Domlur');
    expect(input(r, 'PIN code').props.value).toBe('560071');

    type(r, 'House / flat / floor no.', '12');
    press(r, 'Go back', 'last');
    flush(800);
    expect(textContent(r)).toContain('Discard this address?');
    press(r, 'Keep editing');
    flush(800);
    expect(input(r, 'House / flat / floor no.').props.value).toBe('12');

    type(r, 'Street / road', '1st Cross');
    await act(async () => {
      pressable(r, 'Save address', 'last').props.onPress();
      await jest.advanceTimersByTimeAsync(1500);
    });
    const added = addresses()[0]!;
    // Untouched pre-fill: the address sits exactly on the fix.
    expect(added).toMatchObject({ line1: '12, 1st Cross', city: 'Domlur, Bengaluru 560071', lat: 12.9612, lng: 77.6389 });
    act(() => r.unmount());
  });

  it('discards an untouched form without asking, and a typed one after "Discard"', () => {
    const r = mount();
    press(r, 'Add new address');
    flush(800);
    press(r, 'Go back', 'last');
    flush(800);
    expect(textContent(r)).not.toContain('New address');
    expect(mockNav.calls).toEqual([]);

    press(r, 'Add new address');
    flush(800);
    type(r, 'Area / locality', 'Ulsoor');
    press(r, 'Go back', 'last');
    flush(800);
    press(r, 'Discard');
    flush(1500);
    expect(textContent(r)).not.toContain('New address');
    expect(addresses()).toHaveLength(3);
    act(() => r.unmount());
  });

  it('checks the receiver’s +91 mobile when someone else is receiving', async () => {
    const r = mount();
    press(r, 'Edit Work');
    flush(800);
    press(r, 'Ordering for someone else');
    flush(400);
    type(r, 'Receiver’s name', 'Priya');
    type(r, 'Receiver’s mobile', '55501');
    press(r, 'Save address', 'last');
    flush(600);
    expect(textContent(r)).toContain('Enter a 10-digit mobile number');
    type(r, 'Receiver’s mobile', '+91 98450 12345');
    expect(input(r, 'Receiver’s mobile').props.value).toBe('98450 12345');
    await act(async () => {
      pressable(r, 'Save address', 'last').props.onPress();
      await jest.advanceTimersByTimeAsync(800);
    });
    expect(byId('addr-work')).toMatchObject({ contactName: 'Priya', contactPhone: '9845012345' });
    expect(textContent(r)).toContain('For Priya');
    act(() => r.unmount());
  });
});
