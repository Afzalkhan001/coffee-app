import {
  gravityOf,
  initialTiltState,
  pointerTilt,
  smoothing,
  stepTilt,
  TILT,
  tiltAngles,
  wrapAngle,
  type TiltState,
  type Vec3,
} from '../tiltMath';

const G = 9.80665;
const DEG = Math.PI / 180;

/** Gravity for a phone pitched back by `pitch` and with its right edge lowered by `roll` (degrees). */
function gravity(pitchDeg: number, rollDeg = 0): Vec3 {
  const p = pitchDeg * DEG;
  const r = rollDeg * DEG;
  return { x: Math.sin(r), y: -Math.cos(r) * Math.cos(p), z: -Math.cos(r) * Math.sin(p) };
}

/** Feeds `ms` worth of 16ms samples at a fixed angle. */
function hold(state: TiltState, g: Vec3, ms: number) {
  let s = state;
  let out = { state: s, x: 0, y: 0 };
  for (let t = 0; t < ms; t += 16) {
    out = stepTilt(s, tiltAngles(g), 16);
    s = out.state;
  }
  return out;
}

describe('gravityOf', () => {
  it('removes the hand’s own acceleration and normalises', () => {
    const g = gravityOf({
      accelerationIncludingGravity: { x: 1, y: -G + 2, z: 0 },
      acceleration: { x: 1, y: 2, z: 0 },
    });
    expect(g).not.toBeNull();
    expect(g!.x).toBeCloseTo(0);
    expect(g!.y).toBeCloseTo(-1);
  });

  it('works without a user-acceleration reading', () => {
    const g = gravityOf({ accelerationIncludingGravity: { x: 0, y: 0, z: -G }, acceleration: null });
    expect(g!.z).toBeCloseTo(-1);
  });

  it('rejects missing, non-finite and free-fall samples', () => {
    expect(gravityOf({})).toBeNull();
    expect(gravityOf({ accelerationIncludingGravity: { x: NaN, y: 0, z: 0 } })).toBeNull();
    expect(gravityOf({ accelerationIncludingGravity: { x: 0.1, y: 0.2, z: 0.1 } })).toBeNull();
  });
});

describe('tiltAngles', () => {
  it('reads upright as 0 and lying face up as +90° pitch', () => {
    expect(tiltAngles(gravity(0)).pitch).toBeCloseTo(0);
    expect(tiltAngles(gravity(90)).pitch).toBeCloseTo(Math.PI / 2);
    expect(tiltAngles(gravity(40)).pitch).toBeCloseTo(40 * DEG);
  });

  it('reads the right edge lowered as positive roll', () => {
    expect(tiltAngles(gravity(40, 10)).roll).toBeCloseTo(10 * DEG);
    expect(tiltAngles(gravity(40, -10)).roll).toBeCloseTo(-10 * DEG);
  });
});

describe('stepTilt', () => {
  it('calibrates on the first sample: any holding angle starts centred', () => {
    const out = stepTilt(initialTiltState(), tiltAngles(gravity(55, 4)), 16);
    expect(out.x).toBe(0);
    expect(out.y).toBe(0);
    expect(out.state.ready).toBe(true);
  });

  it('follows a tilt from the neutral angle with a soft limit', () => {
    const start = stepTilt(initialTiltState(), tiltAngles(gravity(40)), 16).state;
    const back = hold(start, gravity(46), 300); // tipped 6° further back
    expect(back.y).toBeGreaterThan(0.3);
    expect(back.y).toBeLessThan(1);
    expect(Math.abs(back.x)).toBeLessThan(0.05);

    const right = hold(start, gravity(40, 8), 300);
    expect(right.x).toBeGreaterThan(0.4);

    const far = hold(start, gravity(40, -40), 200);
    expect(far.x).toBeLessThan(-0.9);
    expect(far.x).toBeGreaterThanOrEqual(-1);
  });

  it('recentres on a new holding angle within a few seconds', () => {
    const start = stepTilt(initialTiltState(), tiltAngles(gravity(30)), 16).state;
    const soon = hold(start, gravity(38), 300);
    expect(soon.y).toBeGreaterThan(0.4);
    const later = hold(soon.state, gravity(38), 10_000);
    expect(Math.abs(later.y)).toBeLessThan(0.05);
  });

  it('recentres faster after a big change of posture', () => {
    const start = stepTilt(initialTiltState(), tiltAngles(gravity(30)), 16).state;
    const flat = hold(start, gravity(85), 3000); // set down on a table
    expect(Math.abs(flat.y)).toBeLessThan(0.5);
  });

  it('smooths sensor noise', () => {
    const start = stepTilt(initialTiltState(), tiltAngles(gravity(40)), 16).state;
    const spike = stepTilt(start, tiltAngles(gravity(40, 20)), 16);
    expect(spike.x).toBeLessThan(0.5);
  });

  it('never jumps when pitch crosses ±180°', () => {
    const start = stepTilt(initialTiltState(), { roll: 0, pitch: Math.PI - 0.01 }, 16).state;
    const out = stepTilt(start, { roll: 0, pitch: -Math.PI + 0.01 }, 16);
    expect(Math.abs(out.y)).toBeLessThan(0.2);
  });
});

describe('helpers', () => {
  it('wraps angles into −π…π', () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(-1.5 * Math.PI)).toBeCloseTo(0.5 * Math.PI);
    expect(wrapAngle(0.3)).toBeCloseTo(0.3);
  });

  it('smoothing is 0 for no time and approaches 1 for long gaps', () => {
    expect(smoothing(0, TILT.smoothMs)).toBe(0);
    expect(smoothing(10_000, TILT.smoothMs)).toBeCloseTo(1);
  });

  it('maps a pointer to −1…1 around the anchor centre (right and up are positive)', () => {
    const rect = { left: 100, top: 100, width: 200, height: 200 };
    const centre = pointerTilt(200, 200, rect, 220);
    expect(centre.x).toBeCloseTo(0);
    expect(centre.y).toBeCloseTo(0);
    const p = pointerTilt(420, 0, rect, 220);
    expect(p.x).toBeGreaterThan(0.7);
    expect(p.y).toBeGreaterThan(0.3);
    expect(pointerTilt(-5000, 5000, rect, 220).x).toBeCloseTo(-1);
  });
});
