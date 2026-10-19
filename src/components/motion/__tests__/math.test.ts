import { flightPoint, formatRollingNumber, planFlight, planRoll } from '../math';

/** Digit shown at a strip position (strip: [9, 0…9, 0…9, 0] at s = -1…20). */
const digitAt = (s: number) => ((Math.round(s) % 10) + 10) % 10;

describe('formatRollingNumber', () => {
  it('formats money with fixed decimals', () => {
    expect(formatRollingNumber(5.4, 2, true)).toBe('5.40');
    expect(formatRollingNumber(12, 2, true)).toBe('12.00');
  });
  it('groups thousands', () => {
    expect(formatRollingNumber(2300, 0, true)).toBe('2,300');
    expect(formatRollingNumber(1234567.891, 2, true)).toBe('1,234,567.89');
    expect(formatRollingNumber(2300, 0, false)).toBe('2300');
  });
  it('groups lakhs and crores the Indian way', () => {
    expect(formatRollingNumber(250, 0, 'indian')).toBe('250');
    expect(formatRollingNumber(1250, 0, 'indian')).toBe('1,250');
    expect(formatRollingNumber(125000, 0, 'indian')).toBe('1,25,000');
    expect(formatRollingNumber(12345678, 0, 'indian')).toBe('1,23,45,678');
    expect(formatRollingNumber(99999.4, 0, 'indian')).toBe('99,999');
    expect(formatRollingNumber(125000, 0, 'western')).toBe('125,000');
  });
  it('handles negatives without a "-0"', () => {
    expect(formatRollingNumber(-3.5, 2, true)).toBe('-3.50');
    expect(formatRollingNumber(-0.001, 2, true)).toBe('0.00');
  });
});

describe('planRoll', () => {
  it('is a no-op when already on the digit', () => {
    const { from, to } = planRoll(4, 4, 1);
    expect(to - from).toBeCloseTo(0);
  });

  it('rolls forward through the wrap when the number grows (9 → 0, 7 → 2)', () => {
    expect(planRoll(9, 0, 1)).toEqual({ from: 9, to: 10 });
    expect(planRoll(7, 2, 1)).toEqual({ from: 7, to: 12 });
  });

  it('rolls backward through the wrap when the number shrinks (0 → 9, 2 → 7)', () => {
    expect(planRoll(0, 9, -1)).toEqual({ from: 10, to: 9 });
    expect(planRoll(2, 7, -1)).toEqual({ from: 12, to: 7 });
  });

  it('keeps every move inside the strip with room for spring overshoot', () => {
    for (let p = -0.9; p < 20.9; p += 0.37) {
      for (let digit = 0; digit <= 9; digit++) {
        for (const dir of [-1, 0, 1]) {
          const { from, to } = planRoll(p, digit, dir);
          // `from` shows the same digit as `p` (identical copies)…
          expect(digitAt(from - p + Math.round(p))).toBe(digitAt(Math.round(p)));
          // …the target shows the requested digit…
          expect(digitAt(to)).toBe(digit);
          // …the move is less than one full revolution in the requested direction…
          if (dir > 0) expect(to).toBeGreaterThanOrEqual(from - 0.001);
          if (dir < 0) expect(to).toBeLessThanOrEqual(from + 0.001);
          expect(Math.abs(to - from)).toBeLessThan(10);
          // …and ±0.5 of overshoot still lands on a real cell (-1 … 20).
          expect(Math.min(from, to) - 0.5).toBeGreaterThanOrEqual(-1);
          expect(Math.max(from, to) + 0.5).toBeLessThanOrEqual(21);
        }
      }
    }
  });
});

describe('planFlight', () => {
  const card = { x: 40, y: 500, width: 140, height: 140 };
  const cart = { x: 320, y: 60, width: 44, height: 44 };

  it('starts at the source centre and ends at the cart centre', () => {
    const plan = planFlight(card, cart, 390, 47);
    expect(flightPoint(plan, 0)).toEqual({ x: 110, y: 570 });
    expect(flightPoint(plan, 1)).toEqual({ x: 342, y: 82 });
    expect(plan.hasTarget).toBe(true);
  });

  it('keeps the arc apex on screen for header carts', () => {
    const plan = planFlight(card, cart, 390, 47);
    let minY = Infinity;
    for (let t = 0; t <= 1; t += 0.01) minY = Math.min(minY, flightPoint(plan, t).y);
    expect(minY).toBeGreaterThan(0);
  });

  it('shrinks into the badge and clamps the thumb size', () => {
    const plan = planFlight(card, cart, 390, 47);
    expect(plan.size).toBe(128);
    expect(plan.size * plan.endScale).toBeCloseTo(26.4);
    expect(planFlight({ x: 0, y: 0, width: 20, height: 20 }, cart, 390, 0).size).toBe(44);
  });

  it('starts the clone exactly over the source photo (a big hero lifts off, not a stamped copy)', () => {
    const hero = { x: 45, y: 120, width: 300, height: 300 };
    const plan = planFlight(hero, cart, 390, 47);
    expect(plan.size).toBe(128);
    expect(plan.size * plan.startScale).toBeCloseTo(300);
    expect(planFlight(card, cart, 390, 47).startScale).toBeCloseTo(140 / 128);
    expect(planFlight({ x: 0, y: 0, width: 100, height: 100 }, cart, 390, 0).startScale).toBe(1);
  });

  it('falls back to the top-right corner without a target', () => {
    const plan = planFlight(card, null, 390, 47);
    expect(plan.hasTarget).toBe(false);
    expect(flightPoint(plan, 1)).toEqual({ x: 350, y: 65 });
  });

  it('scales duration with distance within bounds', () => {
    const near = planFlight({ x: 300, y: 70, width: 40, height: 40 }, cart, 390, 47);
    const far = planFlight({ x: 0, y: 2000, width: 40, height: 40 }, cart, 390, 47);
    expect(near.duration).toBe(640);
    expect(far.duration).toBe(920);
  });
});
