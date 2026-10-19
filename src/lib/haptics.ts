/**
 * Haptics: the semantic vocabulary from docs/HAPTICS.md. Screens use only these kinds, never
 * expo-haptics directly.
 *
 * - iOS: `selectionAsync` for choices and steps, `Rigid` impacts for crisp clicks, `Soft` for a
 *   landing, notifications for outcomes.
 * - Android: the system haptic constants (`performAndroidHapticsAsync`), the same tuned effects as
 *   the keyboard and switches. A constant the device doesn't have (older Android) throws once,
 *   and from then on that kind plays `impactAsync(Light)` instead.
 * - Web: a no-op (expo-haptics would call `navigator.vibrate`).
 * - Throttled: the same kind can't repeat within 60 ms, and nothing fires within 30 ms of another
 *   haptic. Off entirely while the Settings "Haptics" switch is off (`configureHaptics`).
 */
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export type HapticKind =
  /** A discrete choice changes: chips, sizes, radio rows, segmented control, tab change. */
  | 'select'
  /** Rapid or small steps: quantity stepper, OTP digit, carousel snap, scroll-spy chip. */
  | 'tick'
  /** A switch flips (`haptic.toggle(on)`). */
  | 'toggle'
  /** Press-in on a committing CTA: Add to cart, Place order, Pay, Confirm. */
  | 'press'
  /** The fly-to-cart thumbnail lands and the badge pops; a sheet snaps open. */
  | 'land'
  /** A drag crosses its commit point (swipe-to-delete armed). */
  | 'threshold'
  /** A long press opens something. */
  | 'longPress'
  /** Order placed, payment approved, reward redeemed, order ready. */
  | 'success'
  /** Nudge for a missing required step (tapping a disabled Add / Place order bar). */
  | 'warning'
  /** Payment declined, invalid or expired OTP, coupon rejected. */
  | 'error';

/** The kinds a pressable can fire by itself. `toggle` needs the new state: call `haptic.toggle(on)`. */
export type PressHapticKind = Exclude<HapticKind, 'toggle'>;

/** The same kind can't repeat within this window. */
export const HAPTIC_SAME_KIND_GAP_MS = 60;
/** Nothing fires within this window of another haptic. */
export const HAPTIC_ANY_KIND_GAP_MS = 30;

const { ImpactFeedbackStyle: Impact, NotificationFeedbackType: Notice, AndroidHaptics } = Haptics;

const IOS: Record<HapticKind, () => Promise<void>> = {
  select: () => Haptics.selectionAsync(),
  tick: () => Haptics.selectionAsync(),
  toggle: () => Haptics.impactAsync(Impact.Rigid),
  press: () => Haptics.impactAsync(Impact.Rigid),
  land: () => Haptics.impactAsync(Impact.Soft),
  threshold: () => Haptics.impactAsync(Impact.Rigid),
  longPress: () => Haptics.impactAsync(Impact.Medium),
  success: () => Haptics.notificationAsync(Notice.Success),
  warning: () => Haptics.notificationAsync(Notice.Warning),
  error: () => Haptics.notificationAsync(Notice.Error),
};

const ANDROID: Record<PressHapticKind, Haptics.AndroidHaptics> = {
  select: AndroidHaptics.Segment_Tick,
  tick: AndroidHaptics.Segment_Frequent_Tick,
  press: AndroidHaptics.Virtual_Key,
  land: AndroidHaptics.Gesture_End,
  threshold: AndroidHaptics.Context_Click,
  longPress: AndroidHaptics.Long_Press,
  success: AndroidHaptics.Confirm,
  warning: AndroidHaptics.Reject,
  error: AndroidHaptics.Reject,
};

function androidEffect(kind: HapticKind, on: boolean): Haptics.AndroidHaptics {
  if (kind === 'toggle') return on ? AndroidHaptics.Toggle_On : AndroidHaptics.Toggle_Off;
  return ANDROID[kind];
}

let enabled = true;
let lastAny = Number.NEGATIVE_INFINITY;
const lastByKind = new Map<HapticKind, number>();
/** Kinds whose Android constant threw on this device: they play `impactAsync(Light)` from then on. */
const androidFallback = new Set<HapticKind>();

/** Settings "Haptics" switch. The session store keeps this in sync with its persisted `hapticsEnabled`. */
export function configureHaptics(options: { enabled: boolean }) {
  enabled = options.enabled;
}

export function hapticsEnabled(): boolean {
  return enabled;
}

const ignore = () => {};

function lightImpact() {
  Haptics.impactAsync(Impact.Light).catch(ignore);
}

function playAndroid(kind: HapticKind, on: boolean) {
  if (androidFallback.has(kind)) {
    lightImpact();
    return;
  }
  const fallBack = () => {
    // Older Android lacks the constant (Toggle_On, Segment_Tick… need API 30–34): try it once per kind.
    androidFallback.add(kind);
    lightImpact();
  };
  try {
    Haptics.performAndroidHapticsAsync(androidEffect(kind, on)).catch(fallBack);
  } catch {
    fallBack();
  }
}

/** Throttle gate: true (and recorded) when `kind` may fire at time `t`. */
function admit(kind: HapticKind, t: number): boolean {
  if (t - lastAny < HAPTIC_ANY_KIND_GAP_MS) return false;
  if (t - (lastByKind.get(kind) ?? Number.NEGATIVE_INFINITY) < HAPTIC_SAME_KIND_GAP_MS) return false;
  lastAny = t;
  lastByKind.set(kind, t);
  return true;
}

function play(kind: HapticKind, on = true): void {
  const os = Platform.OS;
  if (!enabled || (os !== 'ios' && os !== 'android')) return;
  if (!admit(kind, Date.now())) return;
  if (os === 'android') playAndroid(kind, on);
  else IOS[kind]().catch(ignore);
}

/** The only haptics API screens may use (docs/HAPTICS.md has the call-site map). */
export const haptic = {
  select: () => play('select'),
  tick: () => play('tick'),
  toggle: (on: boolean) => play('toggle', on),
  press: () => play('press'),
  land: () => play('land'),
  threshold: () => play('threshold'),
  longPress: () => play('longPress'),
  success: () => play('success'),
  warning: () => play('warning'),
  error: () => play('error'),
} as const;

/** Fire a pressable's `hapticKind`. */
export function playHaptic(kind: PressHapticKind): void {
  play(kind);
}

/** Test hook: clears the throttle, the Android fallback memory and the enabled flag. */
export function resetHapticsForTests() {
  enabled = true;
  lastAny = Number.NEGATIVE_INFINITY;
  lastByKind.clear();
  androidFallback.clear();
}
