/**
 * Tilt-to-move for a hero cut-out: two shared values (−1…1) that follow how the phone is tilted from
 * the user's own holding angle (native, `DeviceMotion` ≈ 60 Hz) or where a mouse points (web). The
 * math lives in `tiltMath.ts`; this hook owns the subscriptions and their lifetime:
 *  - Off under Reduce Motion, while `active` is false (screen not focused, sold out…) and while the
 *    app isn't in the foreground; the values ease back to 0 (centred) whenever it pauses, and the
 *    neutral angle is re-taken from the first sample after a resume.
 *  - Native: no permission prompt. `DeviceMotion` reads CoreMotion / Android sensor fusion, which
 *    need none (expo-sensors' "motion" permission is the iOS pedometer's, and asking for it without
 *    `NSMotionUsageDescription` aborts the app, so this never calls it). Unavailable → stays centred.
 *  - Web: mouse / pen pointer parallax relative to `anchor` (devices with a fine, hovering pointer
 *    only; touch drags scroll the page and never move the art).
 * Each sample retargets a soft spring on the UI thread, so the motion stays smooth between samples.
 */
import { DeviceMotion } from 'expo-sensors';
import { useEffect, useState, type RefObject } from 'react';
import { AppState, Platform } from 'react-native';
import { useReducedMotion, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { springs } from '@/theme';
import { gravityOf, initialTiltState, pointerTilt, stepTilt, tiltAngles, type MotionSample } from './tiltMath';

export interface Tilt {
  /** −1…1: the right edge turned away from the user (native) / pointer to the right (web). */
  x: SharedValue<number>;
  /** −1…1: the top tipped away (native) / pointer above (web). */
  y: SharedValue<number>;
}

/** Sensor update interval (ms): ≈ 60 Hz. */
export const TILT_INTERVAL_MS = 16;
/** Follows each sample: soft and slightly lagging, so the art feels weighty rather than twitchy. */
const FOLLOW = { mass: 1, damping: 20, stiffness: 150 } as const;
/** Values that move less than this are not re-sent to the UI thread. */
const EPSILON = 0.002;
/** Web: the pointer reaches the full effect this many art-widths from its centre. */
const POINTER_REACH = 1.1;

/** Something whose DOM rect can be read on web (a react-native-web View ref is its element). */
type Anchor = RefObject<unknown>;

function rectOf(anchor: Anchor | undefined): DOMRect | null {
  const node = anchor?.current as { getBoundingClientRect?: () => DOMRect } | null | undefined;
  return node?.getBoundingClientRect ? node.getBoundingClientRect() : null;
}

/** Native: DeviceMotion → tilt. Returns the cleanup. */
function startMotion(x: SharedValue<number>, y: SharedValue<number>): () => void {
  let alive = true;
  let sub: { remove: () => void } | null = null;
  let state = initialTiltState();
  let last = 0;
  let sentX = 0;
  let sentY = 0;

  DeviceMotion.isAvailableAsync()
    .then((available) => {
      if (!alive || !available) return;
      DeviceMotion.setUpdateInterval(TILT_INTERVAL_MS);
      sub = DeviceMotion.addListener((m: MotionSample) => {
        const g = gravityOf(m);
        if (!g) return;
        const now = Date.now();
        const dt = last === 0 ? TILT_INTERVAL_MS : Math.min(120, now - last);
        last = now;
        const out = stepTilt(state, tiltAngles(g), dt);
        state = out.state;
        if (Math.abs(out.x - sentX) < EPSILON && Math.abs(out.y - sentY) < EPSILON) return;
        sentX = out.x;
        sentY = out.y;
        x.set(withSpring(out.x, FOLLOW));
        y.set(withSpring(out.y, FOLLOW));
      });
    })
    .catch(() => {
      // No sensor (simulator, old Android without a gyroscope): the art simply stays centred.
    });

  return () => {
    alive = false;
    sub?.remove();
  };
}

/** Web: pointer parallax relative to `anchor`. Returns the cleanup. */
function startPointer(x: SharedValue<number>, y: SharedValue<number>, anchor: Anchor | undefined): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !anchor) return () => {};
  const fine = typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!fine) return () => {};

  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    const rect = rectOf(anchor);
    if (!rect || rect.width === 0) return;
    const p = pointerTilt(e.clientX, e.clientY, rect, Math.max(rect.width, 200) * POINTER_REACH);
    x.set(withSpring(p.x, FOLLOW));
    y.set(withSpring(p.y, FOLLOW));
  };
  const onLeave = () => {
    x.set(withSpring(0, springs.gentle));
    y.set(withSpring(0, springs.gentle));
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  document.documentElement.addEventListener('mouseleave', onLeave);
  return () => {
    window.removeEventListener('pointermove', onMove);
    document.documentElement.removeEventListener('mouseleave', onLeave);
  };
}

/**
 * `active`: run while true (pass the screen's focus, and false for sold-out art). `anchor`: web only,
 * the view whose centre the pointer is measured from (a plain View ref; omit for no web parallax).
 */
export function useTilt(active: boolean, anchor?: Anchor): Tilt {
  const reduced = useReducedMotion();
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const [foreground, setForeground] = useState(() => AppState.currentState !== 'background');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setForeground(s === 'active'));
    return () => sub.remove();
  }, []);

  const on = active && foreground && !reduced;

  useEffect(() => {
    if (!on) {
      x.set(withSpring(0, springs.gentle));
      y.set(withSpring(0, springs.gentle));
      return;
    }
    const stop = Platform.OS === 'web' ? startPointer(x, y, anchor) : startMotion(x, y);
    return () => {
      stop();
      // Paused (blurred, backgrounded, unmounted): settle back to centre.
      x.set(withSpring(0, springs.gentle));
      y.set(withSpring(0, springs.gentle));
    };
  }, [on, x, y, anchor]);

  return { x, y };
}
