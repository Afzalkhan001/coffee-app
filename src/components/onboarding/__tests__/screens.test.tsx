/**
 * Flow smoke test for the G1 screens (onboarding, phone, OTP, profile): each mounts, reacts to
 * input, talks to the mock API / session store and unmounts without throwing. Reanimated runs its
 * JS implementation (worklets mocked); fake timers drive animations, API latency and countdowns.
 * Not a visual test.
 */
import { Component, type ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

jest.useFakeTimers();
jest.setTimeout(30_000);

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-status-bar', () => ({ StatusBar: () => null, setStatusBarStyle: () => {} }));
jest.mock('expo-router', () => {
  const { Text: RNText } = require('react-native');
  const params: { current: Record<string, string> } = { current: {} };
  return {
    __params: params,
    useIsFocused: () => true,
    // useKeyboardAfterTransition (Android-only behaviour) subscribes to transitionEnd.
    useNavigation: () => ({ addListener: () => () => {} }),
    useLocalSearchParams: () => params.current,
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), navigate: jest.fn() },
    Redirect: ({ href }: { href: string }) => <RNText>{`redirect:${href}`}</RNText>,
  };
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
jest.mock('@/lib/location', () => ({
  requestLocationPermission: jest.fn(async () => 'granted'),
  getCurrentPosition: jest.fn(async () => null),
}));
jest.mock('@/lib/notify', () => ({
  canUseNotifications: true,
  requestNotificationPermission: jest.fn(async () => 'granted'),
  notifyNow: jest.fn(async () => {}),
}));
jest.mock('@expo/vector-icons/Ionicons', () => {
  const { Text: RNText } = require('react-native');
  return function MockIonicon({ name }: { name: string }) {
    return <RNText>{name}</RNText>;
  };
});

/* eslint-disable import/first */
import OnboardingScreen from '@/app/onboarding';
import OtpScreen from '@/app/auth/otp';
import PhoneScreen from '@/app/auth/phone';
import ProfileScreen from '@/app/auth/profile';
import { DEMO_OTP, OTP_RESEND_MS, OTP_TTL_MS } from '@/api';
import { useMockDb } from '@/api/mockDb';
import { OverlayHost } from '@/components/motion';
import { requestLocationPermission } from '@/lib/location';
import { useDemo } from '@/store/demo';
import { useSession } from '@/store/session';
import { attempt, displayPhone, formatCountdown, isValidEmail, phoneDigits, withTimeout } from '../authFormat';
/* eslint-enable import/first */

const routerMock = jest.requireMock('expo-router') as {
  __params: { current: Record<string, string> };
  router: { push: jest.Mock; replace: jest.Mock; back: jest.Mock };
};

const PHONE = '9876543210';

/** Render errors are otherwise swallowed by React 19 (the tree just unmounts), so surface them. */
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

/** Advance fake time in slices, letting promise callbacks (API calls, permission prompts) run between them. */
async function settle(ms = 1200, slices = 12) {
  for (let i = 0; i < slices; i++) {
    await act(async () => {
      jest.advanceTimersByTime(ms / slices);
      await Promise.resolve();
    });
  }
}

function textOf(r: ReactTestRenderer): string {
  return JSON.stringify(r.toJSON());
}

function byLabel(r: ReactTestRenderer, label: string): ReactTestInstance {
  const found = r.root.findAll(
    (n) =>
      n.props.accessibilityLabel === label &&
      (typeof n.props.onPress === 'function' ||
        typeof n.props.onChangeText === 'function' ||
        typeof n.props.onValueChange === 'function'),
  );
  const node = found[0];
  if (!node) throw new Error(`No element labelled "${label}"`);
  return node;
}

async function press(r: ReactTestRenderer, label: string) {
  const node = byLabel(r, label);
  await act(async () => {
    node.props.onPress?.();
    await Promise.resolve();
  });
}

async function type(r: ReactTestRenderer, label: string, text: string) {
  const node = byLabel(r, label);
  await act(async () => {
    node.props.onChangeText(text);
    await Promise.resolve();
  });
}

function textInputs(r: ReactTestRenderer): ReactTestInstance[] {
  // Host TextInputs only (composite wrappers such as TextField carry the same props).
  return r.root.findAll((n) => typeof n.type === 'string' && typeof n.props.onChangeText === 'function');
}

beforeEach(() => {
  act(() => {
    useSession.getState().resetAll();
    useDemo.setState({ offline: false, latencyMs: 0 });
    useMockDb.setState({ profiles: {}, orders: [], loyalty: {}, otp: null, sim: {} });
  });
  routerMock.__params.current = {};
  jest.clearAllMocks();
});

afterEach(() => {
  const errors = caught.splice(0);
  expect(errors).toEqual([]);
});

describe('authFormat', () => {
  it('normalises phone numbers and formats countdowns', () => {
    expect(phoneDigits('+91 98765 43210')).toBe(PHONE);
    expect(phoneDigits('098765 43210')).toBe(PHONE);
    expect(phoneDigits('98765 432101234')).toBe(PHONE);
    expect(displayPhone(PHONE)).toBe('+91 98765 43210');
    expect(formatCountdown(83_000)).toBe('1:23');
    expect(formatCountdown(-5)).toBe('0:00');
    expect(isValidEmail('maya@ember.co')).toBe(true);
    expect(isValidEmail('maya@ember')).toBe(false);
  });

  it('settles promises without throwing', async () => {
    await expect(attempt(Promise.resolve(3))).resolves.toEqual({ ok: true, value: 3 });
    const failed = await attempt(Promise.reject(new Error('x')));
    expect(failed.ok).toBe(false);
    const pending = withTimeout(new Promise<string>(() => {}), 1000, 'fallback');
    jest.advanceTimersByTime(1000);
    await expect(pending).resolves.toBe('fallback');
  });
});

describe('Onboarding', () => {
  it('waits for the splash gate, then handles both permissions and completes', async () => {
    const r = mount(<OnboardingScreen />);
    expect(textOf(r)).not.toContain('Skip');
    await settle(3000); // no splash mounted → the 2.6s safety fallback lifts the gate
    expect(textOf(r)).toContain('ready when');
    expect(textOf(r)).toContain('Find your');
    expect(textOf(r)).toContain('Know when');

    // One forward button: Next → asks for location and moves on → asks for notifications and finishes.
    await press(r, 'Next');
    await press(r, 'Allow location and continue');
    await settle(400);
    expect(requestLocationPermission).toHaveBeenCalledTimes(1);
    expect(useSession.getState().locationPermission).toBe('granted');
    expect(textOf(r)).toContain('Location on.');
    await settle(1000);

    // Separate marketing consent (PRD §7).
    await act(async () => {
      byLabel(r, 'Also send offers').props.onValueChange(true);
    });
    expect(useSession.getState().notificationPrefs).toEqual({ orderUpdates: true, marketing: true });

    await press(r, 'Enable notifications and finish');
    await settle(2000);
    const s = useSession.getState();
    expect(s.notificationPermission).toBe('granted');
    expect(s.onboardingDone).toBe(true);
    act(() => r.unmount());
  });

  it('Skip completes onboarding and marks unanswered permissions as skipped', async () => {
    const r = mount(<OnboardingScreen />);
    await settle(3000);
    await press(r, 'Skip onboarding');
    await settle(800);
    const s = useSession.getState();
    expect(s.onboardingDone).toBe(true);
    expect(s.locationPermission).toBe('skipped');
    expect(s.notificationPermission).toBe('skipped');
    act(() => r.unmount());
  });

  it('shows the denied note inline', async () => {
    (requestLocationPermission as jest.Mock).mockResolvedValueOnce('denied');
    const r = mount(<OnboardingScreen />);
    await settle(3000);
    await press(r, 'Next');
    await press(r, 'Allow location and continue');
    await settle(400);
    expect(useSession.getState().locationPermission).toBe('denied');
    expect(textOf(r)).toContain('Location is off.');
    // The page stays; the button is a plain "Next" now.
    byLabel(r, 'Next');
    act(() => r.unmount());
  });
});

describe('Phone', () => {
  it('formats as you type and pushes the OTP screen with the code window', async () => {
    const r = mount(<PhoneScreen />);
    await settle(3000);
    await type(r, 'Mobile number', '+91 98765 43210');
    expect(textInputs(r)[0]?.props.value).toBe('98765 43210');
    await press(r, 'Send verification code');
    await settle(600);
    expect(routerMock.router.push).toHaveBeenCalledTimes(1);
    const arg = routerMock.router.push.mock.calls[0]?.[0] as { pathname: string; params: Record<string, string> };
    expect(arg.pathname).toBe('/auth/otp');
    expect(arg.params.phone).toBe(PHONE);
    expect(Number(arg.params.expiresAt)).toBeGreaterThan(Number(arg.params.resendAt));
    act(() => r.unmount());
  });

  it('keeps a typed country code or trunk zero until the number is complete', async () => {
    const r = mount(<PhoneScreen />);
    await settle(3000);
    // Key by key, each keystroke appended to what the field shows (as a keyboard does).
    for (const typed of ['919876543210', '00919876543210', '+91 09876543210', '09876543210']) {
      await type(r, 'Mobile number', '');
      for (const ch of typed) {
        const shown = String(textInputs(r)[0]?.props.value ?? '');
        await type(r, 'Mobile number', shown + ch);
      }
      expect(textInputs(r)[0]?.props.value).toBe('98765 43210');
    }
    // A plain number still stops at ten digits.
    await type(r, 'Mobile number', '');
    for (const ch of '987654321012') {
      await type(r, 'Mobile number', String(textInputs(r)[0]?.props.value ?? '') + ch);
    }
    expect(textInputs(r)[0]?.props.value).toBe('98765 43210');
    await press(r, 'Send verification code');
    await settle(600);
    const arg = routerMock.router.push.mock.calls[0]?.[0] as { params: Record<string, string> };
    expect(arg.params.phone).toBe(PHONE);
    act(() => r.unmount());
  });

  it('shakes instead of sending an incomplete number, and shows offline errors with retry', async () => {
    const r = mount(<PhoneScreen />);
    await settle(3000);
    await type(r, 'Mobile number', '98765');
    await press(r, 'Send verification code');
    expect(textOf(r)).toContain('10-digit mobile number');
    expect(routerMock.router.push).not.toHaveBeenCalled();
    // Ten digits that aren't an Indian mobile (must start 6–9) are refused too.
    await type(r, 'Mobile number', '5550142290');
    await press(r, 'Send verification code');
    expect(textOf(r)).toContain('start with 6, 7, 8 or 9');
    expect(routerMock.router.push).not.toHaveBeenCalled();

    act(() => {
      useDemo.setState({ offline: true });
    });
    await type(r, 'Mobile number', PHONE);
    await press(r, 'Send verification code');
    await settle(600);
    expect(textOf(r)).toContain('offline');
    act(() => {
      useDemo.setState({ offline: false });
    });
    await press(r, 'Try again');
    await settle(600);
    expect(routerMock.router.push).toHaveBeenCalledTimes(1);
    act(() => r.unmount());
  });
});

describe('OTP', () => {
  it('sends a code on arrival, rejects a wrong one, then routes a new customer to profile', async () => {
    routerMock.__params.current = { phone: PHONE };
    const r = mount(<OtpScreen />);
    await settle(600);
    expect(textOf(r)).toContain('+91 98765 43210');
    expect(textOf(r)).toContain('Resend in');

    const code = byLabel(r, 'Verification code, 6 digits');
    await act(async () => {
      code.props.onChangeText('000000');
    });
    await settle(1200);
    expect(textOf(r)).toContain('isn’t right');
    expect(useSession.getState().phone).toBeNull();

    await press(r, `Use demo code ${DEMO_OTP.split('').join(' ')}`);
    await settle(1500);
    expect(useSession.getState().phone).toBe(PHONE);
    expect(useSession.getState().profile).toBeNull();
    expect(routerMock.router.replace).toHaveBeenCalledWith('/auth/profile');
    act(() => r.unmount());
  });

  it('signs a returning customer straight in and unlocks resend after 30s', async () => {
    const existing = { id: 'usr_1', phone: PHONE, name: 'Maya Torres', createdAt: new Date().toISOString() };
    act(() => {
      useMockDb.setState({ profiles: { [PHONE]: existing } });
    });
    const now = Date.now();
    const otp = { phone: PHONE, code: DEMO_OTP, sentAt: now, expiresAt: now + OTP_TTL_MS, resendAt: now + OTP_RESEND_MS };
    act(() => {
      useMockDb.setState({ otp });
    });
    routerMock.__params.current = { phone: PHONE, expiresAt: String(otp.expiresAt), resendAt: String(otp.resendAt) };
    const r = mount(<OtpScreen />);
    await settle(31_000, 31);
    expect(textOf(r)).toContain('Resend code');
    expect(textOf(r)).not.toContain('Resend in');

    const code = byLabel(r, 'Verification code, 6 digits');
    await act(async () => {
      code.props.onChangeText(DEMO_OTP);
    });
    await settle(1500);
    expect(useSession.getState().profile?.name).toBe('Maya Torres');
    expect(routerMock.router.replace).not.toHaveBeenCalled();
    act(() => r.unmount());
  });

  it('redirects to the phone screen without a valid number', () => {
    routerMock.__params.current = { phone: '12' };
    const r = mount(<OtpScreen />);
    expect(textOf(r)).toContain('redirect:/auth/phone');
    act(() => r.unmount());
  });
});

describe('Profile', () => {
  it('validates, saves, plays the flourish and then sets the profile', async () => {
    act(() => {
      useSession.getState().signIn(PHONE, null);
    });
    const r = mount(<ProfileScreen />);
    await settle(400);

    await press(r, 'Save profile and continue');
    expect(textOf(r)).toContain('Please tell us your name');

    const [nameInput, emailInput] = textInputs(r);
    await act(async () => {
      nameInput?.props.onChangeText('Maya Torres');
      emailInput?.props.onChangeText('maya@');
    });
    expect(textOf(r)).toContain('Hi, Maya');
    await press(r, 'Save profile and continue');
    expect(textOf(r)).toContain('doesn’t look quite right');

    await act(async () => {
      emailInput?.props.onChangeText('maya@ember.co');
    });
    await press(r, 'Save profile and continue');
    await settle(600);
    expect(textOf(r)).toContain('You’re all set, Maya');
    expect(useSession.getState().profile).toBeNull(); // waits for the check to finish drawing
    await settle(2500);
    expect(useSession.getState().profile?.email).toBe('maya@ember.co');
    act(() => r.unmount());
  });

  it('redirects to the phone screen when there is no verified number', () => {
    const r = mount(<ProfileScreen />);
    expect(textOf(r)).toContain('redirect:/auth/phone');
    act(() => r.unmount());
  });
});
