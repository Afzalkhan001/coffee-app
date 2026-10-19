/**
 * Pure motion math (no React / RN imports) — unit-tested in __tests__/math.test.ts.
 * Functions marked 'worklet' are also called on the UI thread.
 */
import type { WindowRect } from './measure';

// ── RollingNumber ────────────────────────────────────────────────────────────

/** Digit grouping: `true` / 'western' = thousands ("1,234,567"), 'indian' = lakh/crore ("12,34,567"). */
export type DigitGrouping = boolean | 'western' | 'indian';

/** Groups an integer digit string ("1234567") per `grouping`. */
export function groupDigits(int: string, grouping: DigitGrouping): string {
  if (!grouping) return int;
  if (grouping === 'indian') {
    if (int.length <= 3) return int;
    return `${int.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${int.slice(-3)}`;
  }
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** "2300.5" → "2,300.50" (decimals fixed, optional grouping — see `DigitGrouping` — no "-0"). */
export function formatRollingNumber(value: number, decimals: number, grouping: DigitGrouping): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const [int = '0', frac] = fixed.split('.');
  const grouped = groupDigits(int, grouping);
  const negative = value < 0 && Number(fixed) !== 0;
  return `${negative ? '-' : ''}${grouped}${frac ? `.${frac}` : ''}`;
}

/**
 * Plan one odometer column move in "digit space" (strip covers s ∈ [-1, 21): two 0–9 copies plus a
 * pad cell each side). Forward (dir ≥ 0) rolls upward through higher digits and wraps 9 → 0;
 * backward rolls the other way. `from` is visually identical to `p` (copies are identical).
 */
export function planRoll(p: number, digit: number, dir: number): { from: number; to: number } {
  'worklet';
  let from = p;
  let to = digit;
  if (dir >= 0) {
    while (from >= 10) from -= 10;
    while (from < 0) from += 10;
    if (to < from - 0.001) to += 10;
  } else {
    while (from >= 20) from -= 10;
    while (from < 10) from += 10;
    to = digit + 10;
    if (to > from + 0.001) to -= 10;
  }
  return { from, to };
}

// ── Fly to cart ──────────────────────────────────────────────────────────────

export interface FlightPlan {
  /** Clone diameter (texture size), capped at 128. */
  size: number;
  /** Scale at t=0 so the clone exactly covers the source photo (a ~300px hero starts at ~2.3). */
  startScale: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  endScale: number;
  hasTarget: boolean;
  duration: number;
}

const clampNum = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Quadratic-bezier flight plan: P0 = source centre, P2 = cart centre (or top-right), P1 lifted above both. */
export function planFlight(from: WindowRect, to: WindowRect | null, windowWidth: number, topInset: number): FlightPlan {
  const size = clampNum(Math.min(from.width, from.height), 44, 128);
  const startScale = Math.min(from.width, from.height) / size;
  const x0 = from.x + from.width / 2;
  const y0 = from.y + from.height / 2;
  const x2 = to ? to.x + to.width / 2 : windowWidth - 40;
  const y2 = to ? to.y + to.height / 2 : topInset + 18;
  const distance = Math.hypot(x2 - x0, y2 - y0);
  return {
    size,
    startScale,
    x0,
    y0,
    // Lean the control point toward the source so the thumb lifts first, then dives in.
    x1: x0 + (x2 - x0) * 0.32,
    // Apex above both ends, but kept on screen for header carts.
    y1: Math.max(Math.min(y0, y2) - 120, topInset * 0.6 + 8),
    x2,
    y2,
    endScale: to ? Math.max(14, Math.min(to.width, to.height) * 0.6) / size : 0.3,
    hasTarget: to !== null,
    duration: Math.round(clampNum(560 + distance * 0.32, 640, 920)),
  };
}

/** Point on the plan's quadratic bezier at t ∈ [0, 1]. */
export function flightPoint(plan: FlightPlan, t: number): { x: number; y: number } {
  'worklet';
  const u = 1 - t;
  return {
    x: u * u * plan.x0 + 2 * u * t * plan.x1 + t * t * plan.x2,
    y: u * u * plan.y0 + 2 * u * t * plan.y1 + t * t * plan.y2,
  };
}
