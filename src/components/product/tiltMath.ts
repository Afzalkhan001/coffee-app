/**
 * Pure math behind tilt-to-move (`useTilt`): no React, no sensors, so it is unit-tested.
 *
 * Native input is expo-sensors `DeviceMotion`. Its `accelerationIncludingGravity` minus
 * `acceleration` is the gravity vector in device coordinates on both platforms (expo flips Android's
 * reaction-force convention to iOS's: lying face up reads z ≈ −9.8), with the hand's own shake already
 * removed. From it come two angles that stay stable at every holding angle (attitude Euler angles
 * gimbal-lock when the phone is held upright):
 *  - roll  = asin(g.x): the right edge lower / turned away is positive;
 *  - pitch = atan2(−g.z, −g.y): 0 upright, +90° lying face up, so tipping the top away is positive.
 *
 * `stepTilt` low-passes them and measures them against a baseline that is the user's own holding
 * angle: it is set by the first sample and then slowly follows the phone (a few seconds), faster after
 * a big change of posture, so the art recentres instead of staying pinned when the phone is held at
 * an angle. The output is −1…1 per axis with a soft (tanh) limit.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** The parts of a `DeviceMotionMeasurement` the tilt reads (either may be missing on Android). */
export interface MotionSample {
  acceleration?: Vec3 | null;
  accelerationIncludingGravity?: Vec3 | null;
}

export interface TiltAngles {
  /** Radians; the right edge lower / turned away is positive. */
  roll: number;
  /** Radians; 0 upright, tipping the top away is positive. */
  pitch: number;
}

export interface TiltState {
  ready: boolean;
  /** Low-passed angles (radians). */
  roll: number;
  pitch: number;
  /** The neutral holding angle the tilt is measured against (radians). */
  baseRoll: number;
  basePitch: number;
}

export interface TiltOutput {
  state: TiltState;
  /** −1…1: the right edge turned away is positive. */
  x: number;
  /** −1…1: the top tipped away is positive. */
  y: number;
}

const DEG = Math.PI / 180;

export const TILT = {
  /** Device tilt from the neutral angle that maps to ≈ 0.76 of the full effect (tanh(1)). */
  range: 12 * DEG,
  /** Low-pass time constant for the raw angles (ms): removes sensor noise, keeps it responsive. */
  smoothMs: 70,
  /** The neutral angle follows the phone with this time constant (ms)… */
  recentreMs: 2600,
  /** …and this much faster once the phone is held far from it (a new posture). */
  recentreFastMs: 600,
  /** "Far": beyond this many `range`s. */
  fastBeyond: 1,
  /** Gravity magnitude below this (m/s²) is a free fall or a broken sample. */
  minGravity: 2,
} as const;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Wraps an angle difference into −π…π (pitch crosses ±π when the phone is held upside down). */
export function wrapAngle(a: number): number {
  let v = a;
  while (v > Math.PI) v -= 2 * Math.PI;
  while (v < -Math.PI) v += 2 * Math.PI;
  return v;
}

/** Unit gravity vector in device coordinates, or null for an unusable sample. */
export function gravityOf(sample: MotionSample): Vec3 | null {
  const a = sample.accelerationIncludingGravity;
  if (!a || !isNum(a.x) || !isNum(a.y) || !isNum(a.z)) return null;
  const u = sample.acceleration;
  const user = u && isNum(u.x) && isNum(u.y) && isNum(u.z) ? u : { x: 0, y: 0, z: 0 };
  const gx = a.x - user.x;
  const gy = a.y - user.y;
  const gz = a.z - user.z;
  const n = Math.hypot(gx, gy, gz);
  if (n < TILT.minGravity) return null;
  return { x: gx / n, y: gy / n, z: gz / n };
}

/** Roll and pitch (radians) of a unit gravity vector; see the file comment for the conventions. */
export function tiltAngles(g: Vec3): TiltAngles {
  return { roll: Math.asin(clamp(g.x, -1, 1)), pitch: Math.atan2(-g.z, -g.y) };
}

export function initialTiltState(): TiltState {
  return { ready: false, roll: 0, pitch: 0, baseRoll: 0, basePitch: 0 };
}

/** Fraction of the gap an exponential filter closes in `dt` ms with time constant `tau` ms. */
export function smoothing(dt: number, tau: number): number {
  if (dt <= 0) return 0;
  return 1 - Math.exp(-dt / Math.max(1, tau));
}

/**
 * One sensor sample → the next state and the −1…1 tilt. `dtMs` is the time since the previous
 * sample (clamp it; a long gap just converges faster). The first sample calibrates: it becomes the
 * neutral angle, so the art starts centred however the phone is held.
 */
export function stepTilt(state: TiltState, angles: TiltAngles, dtMs: number): TiltOutput {
  if (!state.ready) {
    const next: TiltState = { ready: true, roll: angles.roll, pitch: angles.pitch, baseRoll: angles.roll, basePitch: angles.pitch };
    return { state: next, x: 0, y: 0 };
  }
  const k = smoothing(dtMs, TILT.smoothMs);
  const roll = state.roll + (angles.roll - state.roll) * k;
  const pitch = state.pitch + wrapAngle(angles.pitch - state.pitch) * k;

  const dRoll = roll - state.baseRoll;
  const dPitch = wrapAngle(pitch - state.basePitch);
  const far = Math.max(Math.abs(dRoll), Math.abs(dPitch)) > TILT.fastBeyond * TILT.range;
  const kb = smoothing(dtMs, far ? TILT.recentreFastMs : TILT.recentreMs);
  const baseRoll = state.baseRoll + dRoll * kb;
  const basePitch = wrapAngle(state.basePitch + dPitch * kb);

  return {
    state: { ready: true, roll, pitch: wrapAngle(pitch), baseRoll, basePitch },
    x: Math.tanh(dRoll / TILT.range),
    y: Math.tanh(dPitch / TILT.range),
  };
}

/**
 * Web: the pointer's offset from the centre of `rect`, as the same −1…1 pair (pointer to the right
 * → +x, above → +y), saturating softly at `reach` px.
 */
export function pointerTilt(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  reach: number,
): { x: number; y: number } {
  const r = Math.max(1, reach);
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  return { x: Math.tanh((clientX - cx) / r), y: Math.tanh((cy - clientY) / r) };
}
