/**
 * The live order pill and the screens under it:
 *  - `useLivePillSpace()`: the extra bottom padding a scroll view needs while the pill floats over
 *    the current route, so its last row can scroll clear of the pill (0 where the pill never shows
 *    or there's no active order).
 *  - `useHideLivePill(open)`: overlays (`ModalSheet`: the redeem ticket, Edit name, confirm dialogs)
 *    send the pill away while they're open. On web an RN `Modal` is a portal in the same document,
 *    and the root-level pill was painted over its dim.
 */
import { usePathname } from 'expo-router';
import { useEffect, useSyncExternalStore } from 'react';
import { useActiveOrderCount } from '@/api/hooks';
import { spacing } from '@/theme';
import { pillRoute } from './liveOrder';

export const LIVE_PILL_HEIGHT = 48;
/** The pill plus the 12px of air above whatever sits under it. */
export const LIVE_PILL_SPACE = LIVE_PILL_HEIGHT + spacing.sm;

/** Bottom padding to add while the pill can float over this route (it can still be swiped away). */
export function useLivePillSpace(): number {
  const pathname = usePathname();
  const active = useActiveOrderCount();
  return active > 0 && pillRoute(pathname).show ? LIVE_PILL_SPACE : 0;
}

let hiders = 0;
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function notify() {
  listeners.forEach((l) => l());
}
const getHidden = () => hiders > 0;
const getServerHidden = () => false;

/** Hides the pill while `hidden` is true (counted, so nested overlays work). */
export function useHideLivePill(hidden: boolean): void {
  useEffect(() => {
    if (!hidden) return;
    hiders += 1;
    notify();
    return () => {
      hiders -= 1;
      notify();
    };
  }, [hidden]);
}

/** True while any overlay asked the pill to stay away. */
export function useLivePillHidden(): boolean {
  return useSyncExternalStore(subscribe, getHidden, getServerHidden);
}
