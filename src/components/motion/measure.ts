import type { RefObject } from 'react';
import type { View } from 'react-native';

/** A rectangle in window coordinates (same space as the root overlay). */
export interface WindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Anything with RN's `measureInWindow` (host views, Animated.View instances). */
type Measurable = Pick<View, 'measureInWindow'>;

/** Measure a view ref in window coordinates (native + web). Resolves null if unmounted/unlaid. */
export function measureInWindowAsync(ref: RefObject<Measurable | null>): Promise<WindowRect | null> {
  return new Promise((resolve) => {
    const node = ref.current;
    if (!node) {
      resolve(null);
      return;
    }
    let settled = false;
    const done = (rect: WindowRect | null) => {
      if (settled) return;
      settled = true;
      resolve(rect);
    };
    // Guard: measureInWindow never calls back for a view detached mid-measure.
    const guard = setTimeout(() => done(null), 400);
    node.measureInWindow((x, y, width, height) => {
      clearTimeout(guard);
      done(width > 0 && height > 0 ? { x, y, width, height } : null);
    });
  });
}
