/**
 * Manual shared-element hand-off: product card image → product detail hero.
 * (`sharedTransitionTag` is off in Expo Go and unsupported on web, so the detail screen
 * flies its own hero from the stored card rect — see docs/research/reanimated4.md §6.)
 */
import type { WindowRect } from './measure';

export type { WindowRect } from './measure';

const origins = new Map<string, WindowRect>();

/** Store where the product image was on screen (call right before `router.push`). */
export function setHeroOrigin(productId: string, rect: WindowRect): void {
  origins.set(productId, rect);
}

/** Read-once: returns and clears the stored rect. Call from a `useState` initializer. */
export function takeHeroOrigin(productId: string): WindowRect | undefined {
  const rect = origins.get(productId);
  origins.delete(productId);
  return rect;
}
