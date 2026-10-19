import { useEffect, useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, type AccessibilityActionEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { easeOutQuint, layoutSpring, type EntryAnimation } from '@/components/motion';
import { Icon, Text } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { fonts, makeStyles, radii, springs, useColors } from '@/theme';

/** How far the row rests open to show the trash button. */
export const SWIPE_REVEAL = 92;
/** Past this (or a fast fling) the row deletes itself. */
const DELETE_AT = 168;
/** One-time swipe nudge (R3.C6): how far the row peeks, and when. */
const PEEK = 28;
const PEEK_DELAY = 600;
/** Slide-out, then height collapse (siblings follow it frame by frame on native and web). */
const SLIDE_MS = 200;
const COLLAPSE_MS = 260;

export interface SwipeRowProps {
  children: ReactNode;
  /** Row id, passed back to the callbacks (keeps them stable so the gesture is never rebuilt mid-drag). */
  id: string;
  /** Remove the line from the store. Called after the row has slid fully away. */
  onDelete: (id: string) => void;
  /** Controlled "open" state so only one row is open at a time. */
  open: boolean;
  onOpenChange: (id: string, open: boolean) => void;
  /**
   * Called when a horizontal drag takes over AND again when it ends, so the parent can ignore the
   * click a mouse drag ends with on web (timed from the release, however slow the drag was).
   */
  onDragStart?: (id: string) => void;
  /** Accessible name of the item (for the delete action label). */
  label: string;
  entering?: EntryAnimation;
  /**
   * Teach the gesture once (R3.C6): 600ms after mount the row nudges −28px and springs back
   * (`snappy`), showing the red delete behind it. Skipped under Reduce Motion.
   */
  peek?: boolean;
}

/**
 * Swipe-left-to-delete row (Gesture.Pan on the UI thread): a danger reveal with a trash button,
 * a fling or long drag deletes. Deleting slides the row out (the red reveal fading with it), then
 * collapses the row's own height to 0 before the store drops it, so the rows and blocks below
 * glide up with it frame by frame on native AND web, and nothing ghosts over them (no `exiting`).
 */
export function SwipeRow({ children, id, onDelete, open, onOpenChange, onDragStart, label, entering, peek = false }: SwipeRowProps) {
  const c = useColors();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const x = useSharedValue(0);
  const peeking = useSharedValue(0);
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  const collapse = useSharedValue(1);
  const deleting = useSharedValue(false);
  /** The drag is past the delete point (the `threshold` haptic has said "let go to delete"). */
  const armed = useSharedValue(false);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-12, 12])
        .failOffsetY([-10, 10])
        .onStart(() => {
          if (onDragStart) scheduleOnRN(onDragStart, id);
        })
        .onChange((e) => {
          if (deleting.get()) return;
          const next = x.get() + e.changeX;
          const w = width.get() || 360;
          // Rubber-band past 70% of the row and when dragging right.
          if (next > 0) x.set(next * 0.25);
          else if (next < -w * 0.7) x.set(-w * 0.7 + (next + w * 0.7) * 0.35);
          else x.set(next);
        })
        .onEnd((e) => {
          if (deleting.get()) return;
          const pos = x.get();
          if (pos < -DELETE_AT || e.velocityX < -1400) {
            deleting.set(true);
            // The commit is silent once armed; a fling that never crossed the point clicks now instead.
            if (!armed.get()) scheduleOnRN(haptic.threshold);
            x.set(
              withTiming(-(width.get() || 400), { duration: SLIDE_MS, easing: easeOutQuint }, (slid) => {
                if (!slid) return;
                collapse.set(
                  withTiming(0, { duration: COLLAPSE_MS, easing: easeOutQuint }, (gone) => {
                    if (gone) scheduleOnRN(onDelete, id);
                  }),
                );
              }),
            );
            return;
          }
          const shouldOpen = pos < -SWIPE_REVEAL / 2 && e.velocityX < 600;
          x.set(withSpring(shouldOpen ? -SWIPE_REVEAL : 0, springs.snappy));
          scheduleOnRN(onOpenChange, id, shouldOpen);
        })
        .onFinalize((_e, activated) => {
          if (activated && onDragStart) scheduleOnRN(onDragStart, id);
        }),
    [x, width, collapse, deleting, armed, id, onDelete, onOpenChange, onDragStart],
  );

  // `threshold` on the frame the drag crosses the delete point (docs/HAPTICS.md), not on the commit.
  useAnimatedReaction(
    () => x.get() < -DELETE_AT,
    (past, wasPast) => {
      if (deleting.get()) return;
      armed.set(past);
      if (wasPast !== null && past && !wasPast) scheduleOnRN(haptic.threshold);
    },
  );

  // Parent closed us (another row opened, or a tap elsewhere).
  useEffect(() => {
    if (deleting.get()) return;
    x.set(withSpring(open ? -SWIPE_REVEAL : 0, springs.snappy));
  }, [open, x, deleting]);

  // The one-time nudge: out 28px, then a snappy spring home, the delete showing behind it.
  useEffect(() => {
    if (!peek || reduced) return;
    peeking.set(withDelay(PEEK_DELAY, withSequence(withTiming(1, { duration: 120 }), withDelay(260, withTiming(0, { duration: 200 })))));
    x.set(
      withDelay(
        PEEK_DELAY,
        withSequence(withTiming(-PEEK, { duration: 260, easing: easeOutQuint }), withDelay(120, withSpring(0, springs.snappy))),
      ),
    );
    // Mount-only: the nudge plays once.
  }, []);

  const remove = () => {
    if (deleting.get()) return;
    // The trash button / accessibility action: a plain tap, silent like the swipe's commit.
    deleting.set(true);
    x.set(
      withTiming(-(width.get() || 400), { duration: SLIDE_MS, easing: easeOutQuint }, (slid) => {
        if (!slid) return;
        collapse.set(
          withTiming(0, { duration: COLLAPSE_MS, easing: easeOutQuint }, (gone) => {
            if (gone) scheduleOnRN(onDelete, id);
          }),
        );
      }),
    );
  };

  // While deleting, the row owns its height (measured at rest) and shrinks it to 0.
  const rootStyle = useAnimatedStyle(() =>
    deleting.get() && height.get() > 0 ? { height: height.get() * collapse.get(), opacity: collapse.get() } : {},
  );
  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const revealStyle = useAnimatedStyle(() => {
    const pos = x.get();
    const w = width.get() || 400;
    // Fades in as the row opens, and out again as a deleted row leaves (no full-width red slab).
    const opening = interpolate(pos, [-SWIPE_REVEAL * 0.9, -12], [1, 0], Extrapolation.CLAMP);
    const leaving = interpolate(pos, [-w * 0.55, -w], [1, 0], Extrapolation.CLAMP);
    // The nudge shows the delete only while the row is left of rest (never on its spring overshoot).
    return { opacity: Math.max(opening, pos < -2 ? peeking.get() : 0) * leaving };
  });
  const trashStyle = useAnimatedStyle(() => {
    const pos = x.get();
    const w = width.get() || 400;
    return {
      transform: [
        { scale: interpolate(pos, [-SWIPE_REVEAL, -16], [1, 0.6], Extrapolation.CLAMP) },
        // Past the reveal, the trash follows the edge of the row so it reads "let go to delete".
        { translateX: pos < -SWIPE_REVEAL ? Math.max(pos + SWIPE_REVEAL, -(w - SWIPE_REVEAL)) : 0 },
      ],
    };
  });

  const onAccessibilityAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'delete') remove();
  };

  return (
    <Animated.View
      layout={layoutSpring}
      entering={entering}
      onLayout={(e) => {
        if (deleting.get()) return;
        width.set(e.nativeEvent.layout.width);
        height.set(e.nativeEvent.layout.height);
      }}
      accessibilityActions={[{ name: 'delete', label: `Remove ${label}` }]}
      onAccessibilityAction={onAccessibilityAction}
      style={[styles.root, rootStyle]}
    >
      <Animated.View style={[styles.reveal, revealStyle]}>
        <Animated.View style={[styles.trashSlot, trashStyle]}>
          <Pressable
            onPress={remove}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${label}`}
            hitSlop={8}
            style={styles.trashButton}
          >
            <Icon name="trash-outline" size={20} color={c.white} />
            <Text style={styles.trashText} color={c.white}>
              Remove
            </Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
      <GestureDetector gesture={pan} touchAction="pan-y">
        <Animated.View style={[styles.front, rowStyle]}>{children}</Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { borderRadius: radii.md, overflow: 'hidden' },
  reveal: {
    ...StyleSheet.absoluteFill,
    backgroundColor: c.danger,
    borderRadius: radii.md,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  trashSlot: { width: SWIPE_REVEAL, alignItems: 'center', justifyContent: 'center' },
  trashButton: { alignItems: 'center', justifyContent: 'center', gap: 3, minWidth: 64, minHeight: 56 },
  trashText: { fontFamily: fonts.semibold, fontSize: 11.5, lineHeight: 14 },
  front: { backgroundColor: c.surface, borderRadius: radii.md },
}));
