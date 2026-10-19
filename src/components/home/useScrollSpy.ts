/**
 * Scroll-spy for a long sectioned list under a sticky bar (Menu): tracks which section sits under
 * the bar on the UI thread, and smooth-scrolls to a section on demand without the selection
 * flickering through every section it passes on the way. A chip change the finger drives (drag or
 * its momentum) ticks (docs/HAPTICS.md); programmatic scrolls and Reduce Motion stay silent.
 */
import { useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import Animated, {
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { haptic } from '@/lib/haptics';

/** Safety release for a programmatic scroll that never lands exactly on its target. */
const LOCK_TIMEOUT_MS = 1200;

export function useScrollSpy({
  stickyOffset,
  count,
  probeOffset,
}: {
  stickyOffset: number;
  count: number;
  /**
   * Viewport y of the activation line (default: just under the sticky bar). A section becomes active
   * once its top crosses this line; Menu uses 40% of the viewport so the chip follows the header
   * the eye is on rather than waiting for it to reach the sticky chips.
   */
  probeOffset?: number;
}) {
  const probeAt = Math.max(stickyOffset + 1, probeOffset ?? 0);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  /** Section tops in content coordinates (UI-thread copy for the reaction). */
  const offsets = useSharedValue<number[]>([]);
  /** Target y of an in-flight programmatic scroll, or -1. While set, the spy holds still. */
  const lockY = useSharedValue(-1);
  /** True from a drag until the next programmatic scroll: only then does a chip change tick. */
  const fingerDriven = useSharedValue(false);
  // A tick per section scrolled past is a continuous haptic: off under Reduce Motion.
  const tickOnChange = !useReducedMotion();
  const tops = useRef<number[]>([]);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lastSectionHeight, setLastSectionHeight] = useState(0);

  useEffect(
    () => () => {
      if (lockTimer.current) clearTimeout(lockTimer.current);
    },
    [],
  );

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      const y = e.contentOffset.y;
      scrollY.set(y);
      const lock = lockY.get();
      if (lock >= 0 && Math.abs(y - lock) < 2) lockY.set(-1);
    },
    // A finger on the list always wins over an in-flight jump (native only; web has no drag events).
    onBeginDrag: () => {
      lockY.set(-1);
      fingerDriven.set(true);
    },
  });

  useAnimatedReaction(
    () => {
      if (lockY.get() >= 0) return -1;
      const probe = scrollY.get() + probeAt;
      const list = offsets.get();
      let index = 0;
      for (let i = 0; i < list.length; i++) {
        const top = list[i];
        if (top !== undefined && top <= probe) index = i;
      }
      return index;
    },
    (index, previous) => {
      if (index < 0 || index === previous) return;
      scheduleOnRN(setActiveIndex, index);
      // Not on the first read, nor when a jump's lock releases (-1 → index: the tap already clicked).
      if (tickOnChange && fingerDriven.get() && previous !== null && previous >= 0) scheduleOnRN(haptic.tick);
    },
  );

  /** onLayout for section `index` (attach to a direct child of the scroll view). */
  const registerSection = (index: number) => (e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    tops.current[index] = y;
    offsets.set(tops.current.slice(0, count));
    if (index === count - 1) setLastSectionHeight(height);
  };

  /** Smooth-scroll so section `index` sits right under the sticky bar; selects it immediately. */
  const scrollToSection = (index: number) => {
    const top = tops.current[index];
    if (top === undefined) return;
    const target = Math.max(0, Math.round(top - stickyOffset));
    setActiveIndex(index);
    fingerDriven.set(false);
    lockY.set(target);
    scheduleOnUI(() => {
      scrollTo(scrollRef, 0, target, true);
    });
    if (lockTimer.current) clearTimeout(lockTimer.current);
    lockTimer.current = setTimeout(() => lockY.set(-1), LOCK_TIMEOUT_MS);
  };

  const scrollToTop = () => {
    fingerDriven.set(false);
    scheduleOnUI(() => {
      scrollTo(scrollRef, 0, 0, true);
    });
  };

  return {
    scrollRef,
    scrollY,
    onScroll,
    activeIndex,
    registerSection,
    scrollToSection,
    scrollToTop,
    /** Height of the last section once laid out (0 before), for the end spacer. */
    lastSectionHeight,
  };
}
