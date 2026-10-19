jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-haptics', () => {
  const actual = jest.requireActual('expo-haptics');
  return {
    ...actual,
    selectionAsync: jest.fn(() => Promise.resolve()),
    impactAsync: jest.fn(() => Promise.resolve()),
    notificationAsync: jest.fn(() => Promise.resolve()),
    performAndroidHapticsAsync: jest.fn(() => Promise.resolve()),
  };
});

/* eslint-disable import/first */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import {
  configureHaptics,
  haptic,
  HAPTIC_ANY_KIND_GAP_MS,
  HAPTIC_SAME_KIND_GAP_MS,
  hapticsEnabled,
  playHaptic,
  resetHapticsForTests,
  type HapticKind,
} from '@/lib/haptics';
import { STORAGE_KEYS } from '@/lib/storage';
import { useSession } from '@/store/session';

const { AndroidHaptics, ImpactFeedbackStyle, NotificationFeedbackType } = Haptics;
const selection = Haptics.selectionAsync as jest.Mock;
const impact = Haptics.impactAsync as jest.Mock;
const notification = Haptics.notificationAsync as jest.Mock;
const android = Haptics.performAndroidHapticsAsync as jest.Mock;
const mocks = [selection, impact, notification, android];

const realOS = Platform.OS;
let clock = 0;
const setOS = (os: typeof Platform.OS) => {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true, writable: true });
};
/** Moves the clock well past every throttle window, so each call in a routing test fires. */
const later = () => {
  clock += 1000;
};
/** Lets rejected Android calls run their fallback. */
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
const totalCalls = () => mocks.reduce((n, m) => n + m.mock.calls.length, 0);

/** Every kind fired through the public API (toggle as "on"). */
const fire: Record<HapticKind, () => void> = {
  select: haptic.select,
  tick: haptic.tick,
  toggle: () => haptic.toggle(true),
  press: haptic.press,
  land: haptic.land,
  threshold: haptic.threshold,
  longPress: haptic.longPress,
  success: haptic.success,
  warning: haptic.warning,
  error: haptic.error,
};

beforeEach(() => {
  resetHapticsForTests();
  mocks.forEach((m) => {
    m.mockReset();
    m.mockImplementation(() => Promise.resolve());
  });
  clock = 10_000;
  jest.spyOn(Date, 'now').mockImplementation(() => clock);
  setOS('ios');
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  setOS(realOS);
});

describe('iOS routing', () => {
  it('maps every kind to selection, a crisp impact or a notification', () => {
    const expected: Record<HapticKind, [jest.Mock, unknown[]]> = {
      select: [selection, []],
      tick: [selection, []],
      toggle: [impact, [ImpactFeedbackStyle.Rigid]],
      press: [impact, [ImpactFeedbackStyle.Rigid]],
      land: [impact, [ImpactFeedbackStyle.Soft]],
      threshold: [impact, [ImpactFeedbackStyle.Rigid]],
      longPress: [impact, [ImpactFeedbackStyle.Medium]],
      success: [notification, [NotificationFeedbackType.Success]],
      warning: [notification, [NotificationFeedbackType.Warning]],
      error: [notification, [NotificationFeedbackType.Error]],
    };
    for (const kind of Object.keys(expected) as HapticKind[]) {
      mocks.forEach((m) => m.mockClear());
      later();
      fire[kind]();
      const [fn, args] = expected[kind];
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith(...args);
      expect(totalCalls()).toBe(1);
    }
    expect(android).not.toHaveBeenCalled();
  });

  it('never uses the soft Light impact', () => {
    for (const kind of Object.keys(fire) as HapticKind[]) {
      later();
      fire[kind]();
    }
    expect(impact).not.toHaveBeenCalledWith(ImpactFeedbackStyle.Light);
    expect(impact).not.toHaveBeenCalledWith(ImpactFeedbackStyle.Heavy);
  });

  it('swallows a rejected native call', async () => {
    selection.mockImplementation(() => Promise.reject(new Error('Taptic Engine off')));
    expect(() => haptic.select()).not.toThrow();
    await flush();
  });
});

describe('Android routing', () => {
  beforeEach(() => setOS('android'));

  it('uses the system haptic constants for every kind', () => {
    const expected: Record<HapticKind, Haptics.AndroidHaptics> = {
      select: AndroidHaptics.Segment_Tick,
      tick: AndroidHaptics.Segment_Frequent_Tick,
      toggle: AndroidHaptics.Toggle_On,
      press: AndroidHaptics.Virtual_Key,
      land: AndroidHaptics.Gesture_End,
      threshold: AndroidHaptics.Context_Click,
      longPress: AndroidHaptics.Long_Press,
      success: AndroidHaptics.Confirm,
      warning: AndroidHaptics.Reject,
      error: AndroidHaptics.Reject,
    };
    for (const kind of Object.keys(expected) as HapticKind[]) {
      android.mockClear();
      later();
      fire[kind]();
      expect(android).toHaveBeenCalledTimes(1);
      expect(android).toHaveBeenCalledWith(expected[kind]);
    }
    expect(selection).not.toHaveBeenCalled();
    expect(impact).not.toHaveBeenCalled();
    expect(notification).not.toHaveBeenCalled();
  });

  it('toggle(on) picks Toggle_On / Toggle_Off', () => {
    haptic.toggle(true);
    later();
    haptic.toggle(false);
    expect(android.mock.calls).toEqual([[AndroidHaptics.Toggle_On], [AndroidHaptics.Toggle_Off]]);
  });

  it('falls back to impactAsync(Light) when a constant is missing, trying it only once per kind', async () => {
    android.mockImplementation((type: Haptics.AndroidHaptics) =>
      type === AndroidHaptics.Segment_Tick ? Promise.reject(new Error('not supported')) : Promise.resolve(),
    );

    haptic.select();
    await flush();
    expect(android).toHaveBeenCalledTimes(1);
    expect(impact).toHaveBeenCalledTimes(1);
    expect(impact).toHaveBeenCalledWith(ImpactFeedbackStyle.Light);

    // The same kind goes straight to the fallback from now on.
    later();
    haptic.select();
    await flush();
    expect(android).toHaveBeenCalledTimes(1);
    expect(impact).toHaveBeenCalledTimes(2);

    // Other kinds still use their own constant.
    later();
    haptic.tick();
    await flush();
    expect(android).toHaveBeenCalledTimes(2);
    expect(android).toHaveBeenLastCalledWith(AndroidHaptics.Segment_Frequent_Tick);
    expect(impact).toHaveBeenCalledTimes(2);
  });

  it('also falls back when the call throws synchronously', async () => {
    android.mockImplementation(() => {
      throw new Error('no native module');
    });
    expect(() => haptic.press()).not.toThrow();
    await flush();
    expect(impact).toHaveBeenCalledWith(ImpactFeedbackStyle.Light);
    later();
    haptic.press();
    expect(android).toHaveBeenCalledTimes(1);
    expect(impact).toHaveBeenCalledTimes(2);
  });
});

describe('web', () => {
  it('is a no-op (expo-haptics would call navigator.vibrate)', () => {
    setOS('web');
    for (const kind of Object.keys(fire) as HapticKind[]) {
      later();
      fire[kind]();
    }
    expect(totalCalls()).toBe(0);
  });
});

describe('throttle', () => {
  it('drops the same kind within 60 ms, measured from the last one that fired', () => {
    haptic.tick(); // t = 0
    clock += HAPTIC_SAME_KIND_GAP_MS - 20;
    haptic.tick(); // t = 40: dropped
    clock += 20;
    haptic.tick(); // t = 60: fires
    expect(selection).toHaveBeenCalledTimes(2);
  });

  it('drops any kind within 30 ms of another haptic', () => {
    haptic.press(); // t = 0
    clock += HAPTIC_ANY_KIND_GAP_MS - 1;
    haptic.land(); // t = 29: dropped
    clock += 1;
    haptic.success(); // t = 30: fires
    expect(impact).toHaveBeenCalledTimes(1);
    expect(notification).toHaveBeenCalledTimes(1);
  });

  it('applies the same-kind window on top of the any-kind one', () => {
    haptic.select(); // t = 0
    clock += 35;
    haptic.select(); // t = 35: past 30 ms, but the same kind needs 60 ms
    expect(selection).toHaveBeenCalledTimes(1);
    haptic.warning(); // t = 35: a different kind may fire
    expect(notification).toHaveBeenCalledTimes(1);
  });

  it('playHaptic shares the throttle and the routing', () => {
    playHaptic('select');
    playHaptic('select');
    expect(selection).toHaveBeenCalledTimes(1);
    later();
    playHaptic('threshold');
    expect(impact).toHaveBeenCalledWith(ImpactFeedbackStyle.Rigid);
  });
});

describe('enabled flag', () => {
  it('silences everything while off, without using up the throttle', () => {
    configureHaptics({ enabled: false });
    expect(hapticsEnabled()).toBe(false);
    for (const kind of Object.keys(fire) as HapticKind[]) fire[kind]();
    expect(totalCalls()).toBe(0);

    configureHaptics({ enabled: true });
    haptic.select(); // same instant: nothing was recorded while off
    expect(selection).toHaveBeenCalledTimes(1);
  });
});

describe('Settings "Haptics" switch (session store)', () => {
  it('defaults on and drives the wrapper', () => {
    expect(useSession.getState().hapticsEnabled).toBe(true);
    useSession.getState().setHapticsEnabled(false);
    expect(hapticsEnabled()).toBe(false);
    haptic.success();
    expect(notification).not.toHaveBeenCalled();
    useSession.getState().setHapticsEnabled(true);
    expect(hapticsEnabled()).toBe(true);
  });

  it('survives the demo reset', () => {
    useSession.getState().setHapticsEnabled(false);
    useSession.getState().resetAll();
    expect(useSession.getState().hapticsEnabled).toBe(false);
    useSession.getState().setHapticsEnabled(true);
  });

  it('hydrates a v2 session saved before the switch existed as on', async () => {
    // A fresh launch: the store starts from its defaults, then reads the saved session.
    useSession.setState({ hapticsEnabled: true, onboardingDone: false });
    await AsyncStorage.setItem(STORAGE_KEYS.session, JSON.stringify({ state: { onboardingDone: true, mode: 'pickup' }, version: 0 }));
    await useSession.persist.rehydrate();
    expect(useSession.getState().onboardingDone).toBe(true);
    expect(useSession.getState().hapticsEnabled).toBe(true);
    expect(hapticsEnabled()).toBe(true);
  });

  it('hydrates a saved "off"', async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.session, JSON.stringify({ state: { hapticsEnabled: false }, version: 0 }));
    await useSession.persist.rehydrate();
    expect(useSession.getState().hapticsEnabled).toBe(false);
    expect(hapticsEnabled()).toBe(false);
  });
});
