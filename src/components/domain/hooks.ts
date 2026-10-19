/**
 * Small state hooks shared by domain components. These drive data/state
 * only; every visual change they trigger is animated on the UI thread.
 */
import { useEffect, useRef, useState } from 'react';

/**
 * A boolean that turns on when triggered and switches itself off after `duration` ms
 * (e.g. "+" briefly becoming a check after quick-add). Re-triggering restarts the timer.
 */
export function useFlash(duration = 1400): [boolean, () => void] {
  const [on, setOn] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (nonce === 0) return;
    const t = setTimeout(() => setOn(false), duration);
    return () => clearTimeout(t);
  }, [nonce, duration]);

  const trigger = () => {
    setOn(true);
    setNonce((n) => n + 1);
  };
  return [on, trigger];
}

/** Current epoch ms, refreshed every `intervalMs` (ETA countdowns). */
export function useNow(intervalMs = 30_000, resetKey?: string): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    // A new key (e.g. the card now shows another order) re-reads the clock right away instead of
    // waiting up to `intervalMs`, so ETAs agree with screens that just mounted.
    const first = resetKey !== undefined ? setTimeout(tick, 0) : undefined;
    const t = setInterval(tick, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [intervalMs, resetKey]);
  return now;
}

/**
 * Calls `onChange(next, prev)` whenever `value` changes after the first render
 * (badge pops, cart-bar pulses, timeline advances). Never fires on mount.
 */
export function useValueChange<T>(value: T, onChange: (next: T, prev: T) => void) {
  const prev = useRef(value);
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  });
  useEffect(() => {
    const before = prev.current;
    prev.current = value;
    if (!Object.is(value, before)) cb.current(value, before);
  }, [value]);
}

/**
 * Stagger index for list entrances: the first screenful staggers (40ms steps); items that
 * mount later while scrolling (virtualized lists) enter immediately instead of waiting.
 */
export function staggerIndex(index: number, firstScreen = 8): number {
  return index < firstScreen ? index : 0;
}
