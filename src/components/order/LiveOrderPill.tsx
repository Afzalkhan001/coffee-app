/**
 * Live order pill: while the signed-in customer has an active order, a small ink capsule (a lifted
 * espresso `capsule` in dark) floats over the app — a cup that fills with peach coffee as the order advances, the short status and a minute
 * countdown ("Preparing · ~4 min", "Ready for pickup", "On the way · ~6 min"), and "2 orders" when
 * there is more than one (it leads with the soonest). Mounted once by the root layout, above the
 * Stack and below toasts and fly-to-cart.
 *
 *  - Where: floating at the bottom centre, 12px above the tab bar on tab screens, above the "View
 *    cart" bar when that shows, otherwise above the home indicator (`pillRoute`). It stays away
 *    where the same orders are already live on screen (Home strip, Orders, tracking), where the
 *    bottom is the ordering flow's primary action (product, cart, checkout, order type, address,
 *    payment, confirmation), on onboarding / sign-in, and while the keyboard is open.
 *  - Motion: springs up in / sinks out (`smooth`), grows a touch on press, and pops with a peach
 *    ring when the lead order changes status. That pop has no haptic: the root layout already plays
 *    `success` when an order is ready (docs/HAPTICS.md).
 *  - Tap: opens tracking for the lead order (silent). Swipe it sideways or down to hide it until any
 *    order's status changes, with a `threshold` click as the drag crosses the hide point
 *    (VoiceOver / TalkBack: the "Hide" action).
 */
import { router, usePathname } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Keyboard, Platform, StyleSheet, useWindowDimensions, View, type AccessibilityActionEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  ReduceMotion,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { useActiveOrders } from '@/api/hooks';
import { FLOATING_CART_BAR_SPACE, useNow, useValueChange } from '@/components/domain';
import { easeOutQuint, enterFade, layoutSpring, RollingNumber, withAlpha } from '@/components/motion';
import { TAB_BAR_HEIGHT, tabBarBottom } from '@/components/navigation/TabBar';
import { Icon, PressableScale, Text } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { useCartCount } from '@/store/cart';
import { fonts, makeStyles, radii, spacing, springs, useTheme } from '@/theme';
import type { Order } from '@/types/models';
import { CupGlyph } from './CupGlyph';
import {
  cupLevel,
  pillA11yLabel,
  pillCountLabel,
  pillEta,
  pillRoute,
  pillSignature,
  pillTitle,
  soonestFirst,
  type PillRoute,
} from './liveOrder';
import { LIVE_PILL_HEIGHT, useLivePillHidden } from './livePillSpace';

export { LIVE_PILL_HEIGHT };
/** Air between the pill and whatever floats below it (the tab bar, the cart bar). */
const GAP = spacing.sm;
/** Where the pill rests with nothing else floating at the bottom of the screen. */
const BASE_GAP = spacing.xs;
/** Rise when springing in / sinking out: short, so it never sweeps across the tab bar below it. */
const TRAVEL = 28;
/** Swipe distances that dismiss (px), and fling speeds (px/s). */
const DISMISS_X = 90;
const DISMISS_Y = 34;
const FLING_X = 900;
const FLING_Y = 650;

/** Distance from the screen bottom to the pill's bottom edge on a route. */
export function livePillBottom(route: PillRoute, insetBottom: number, cartCount: number): number {
  let bottom = route.tabBar ? tabBarBottom(insetBottom) + TAB_BAR_HEIGHT + GAP : Math.max(insetBottom, spacing.md) + BASE_GAP;
  // The cart bar's own height plus the same 12px of air (FLOATING_CART_BAR_SPACE = bar + 12).
  if (route.cartBar && cartCount > 0) bottom += FLOATING_CART_BAR_SPACE;
  return bottom;
}

function useKeyboardShown(): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => setShown(true));
    const hide = Keyboard.addListener(hideEvent, () => setShown(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return shown;
}

const ACTIONS = [
  { name: 'activate', label: 'Track order' },
  { name: 'dismiss', label: 'Hide' },
];

export function LiveOrderPill() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const keyboard = useKeyboardShown();
  const cartCount = useCartCount();
  const active = soonestFirst(useActiveOrders());
  const signature = pillSignature(active);
  const now = useNow(15_000, signature);
  // The pill is a `capsule`: ink in light, a lifted espresso in dark; white content in both.
  const { colors: c, shadows } = useTheme();
  const styles = useStyles();
  const route = pillRoute(pathname);
  // An open ModalSheet (redeem ticket, Edit name, a confirm dialog) sends the pill away.
  const overlayOpen = useLivePillHidden();

  const [dismissed, setDismissed] = useState<string | null>(null);
  const lead = active[0];
  // The last lead stays on the pill while it sinks away after the final order completes.
  const [held, setHeld] = useState<Order | undefined>(lead);
  if (lead && lead !== held) setHeld(lead);
  const order = lead ?? held;

  const visible = !!lead && route.show && !keyboard && !overlayOpen && signature !== dismissed;
  const bottom = livePillBottom(route, insets.bottom, cartCount);

  // ── in / out, resting height, drag ──
  const shown = useSharedValue(0);
  const lift = useSharedValue(bottom);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const pulse = useSharedValue(1);
  const ring = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      // A fresh appearance (or one after a swipe) starts from rest.
      dragX.set(0);
      dragY.set(0);
    }
    shown.set(reduced ? withTiming(visible ? 1 : 0, { duration: 180 }) : withSpring(visible ? 1 : 0, springs.smooth));
  }, [visible, reduced, shown, dragX, dragY]);

  useEffect(() => {
    // Re-seats when the cart bar comes and goes; jumps while hidden (no slide from the old route's height).
    lift.set(shown.get() > 0.01 && !reduced ? withSpring(bottom, springs.smooth) : bottom);
  }, [bottom, lift, shown, reduced]);

  // Status change on the lead order → a little pop and a peach ring (its cup pours up on its own).
  useValueChange(order ? `${order.id}:${order.status}` : '', (next, prev) => {
    if (reduced || !prev || !next || next.split(':')[0] !== prev.split(':')[0]) return;
    pulse.set(withSequence(withSpring(1.06, springs.snappy), withSpring(1, springs.smooth)));
    ring.set(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 760, easing: easeOutQuint })));
  });

  const wrapStyle = useAnimatedStyle(() => {
    const s = shown.get();
    const away = Math.min(1, Math.abs(dragX.get()) / (width * 0.6));
    return {
      opacity: interpolate(s, [0, 0.5, 1], [0, 1, 1]) * (1 - away),
      transform: [
        { translateY: -lift.get() + (1 - s) * (reduced ? 0 : TRAVEL) + dragY.get() },
        { translateX: dragX.get() },
        { scale: (reduced ? 1 : 0.92 + 0.08 * s) * pulse.get() },
      ],
    };
  });
  const ringStyle = useAnimatedStyle(() => {
    const r = ring.get();
    return { opacity: r >= 1 ? 0 : 0.9 * (1 - r), transform: [{ scaleX: 1 + 0.12 * r }, { scaleY: 1 + 0.4 * r }] };
  });

  // ── tap / swipe ──
  /** 1 while a drag runs and briefly after (a drag on web also ends in a click: don't navigate then). */
  const dragging = useSharedValue(0);
  /** The signature a swipe hides (read by the gesture on the UI thread). */
  const hideKey = useSharedValue(signature);
  useEffect(() => {
    hideKey.set(signature);
  }, [signature, hideKey]);
  /** The drag is past its dismiss point (the `threshold` haptic has said "let go to hide"). */
  const armed = useSharedValue(false);
  const dismiss = () => setDismissed(signature);
  const open = () => {
    if (!order || dragging.get() > 0) return;
    router.push({ pathname: '/order/[id]', params: { id: order.id } });
  };

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-12, 12])
        .activeOffsetY([-12, 12])
        .onStart(() => {
          dragging.set(1);
        })
        .onFinalize(() => {
          dragging.set(withDelay(350, withTiming(0, { duration: 0, reduceMotion: ReduceMotion.Never }), ReduceMotion.Never));
        })
        .onChange((e) => {
          dragX.set(dragX.get() + e.changeX);
          const y = dragY.get() + e.changeY;
          // Down is free (toward the edge it lives on); up resists.
          dragY.set(y > 0 ? y : y * 0.25);
        })
        .onEnd((e) => {
          const x = dragX.get();
          const sideways = Math.abs(x) > DISMISS_X || Math.abs(e.velocityX) > FLING_X;
          const down = !sideways && (dragY.get() > DISMISS_Y || e.velocityY > FLING_Y);
          // The commit is silent once armed; a fling that never crossed the point clicks now instead.
          if ((sideways || down) && !armed.get()) scheduleOnRN(haptic.threshold);
          if (sideways) {
            const dir = (x === 0 ? e.velocityX : x) > 0 ? 1 : -1;
            dragX.set(
              withTiming(dir * width, { duration: 220, easing: easeOutQuint }, (done) => {
                if (done) scheduleOnRN(setDismissed, hideKey.get());
              }),
            );
            return;
          }
          if (down) {
            dragY.set(
              withTiming(LIVE_PILL_HEIGHT + lift.get(), { duration: 220, easing: easeOutQuint }, (done) => {
                if (done) scheduleOnRN(setDismissed, hideKey.get());
              }),
            );
            return;
          }
          dragX.set(withSpring(0, springs.snappy));
          dragY.set(withSpring(0, springs.snappy));
        }),
    [dragX, dragY, lift, width, dragging, hideKey, armed],
  );

  // `threshold` on the frame the drag crosses its dismiss point (docs/HAPTICS.md), not on the commit.
  useAnimatedReaction(
    () => Math.abs(dragX.get()) > DISMISS_X || dragY.get() > DISMISS_Y,
    (past, wasPast) => {
      if (dragging.get() === 0) {
        armed.set(false);
        return;
      }
      armed.set(past);
      if (wasPast !== null && past && !wasPast) scheduleOnRN(haptic.threshold);
    },
  );

  const onAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'dismiss') dismiss();
    else open();
  };

  if (!order) return null;
  const eta = pillEta(order, now);
  const count = pillCountLabel(active.length);
  const soft = withAlpha(c.white, 0.6);

  return (
    // The host clips: a parked (hidden) pill and its resting peach ring sit just below the screen
    // edge, and on web anything there grows the document, so focusing a field scrolled the page.
    <View style={styles.host}>
      <Animated.View style={[styles.wrap, wrapStyle]}>
        <View
          style={{ pointerEvents: visible ? 'auto' : 'none' }}
          aria-hidden={!visible}
          accessibilityElementsHidden={!visible}
          importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
        >
          <GestureDetector gesture={pan}>
            <Animated.View layout={layoutSpring} style={[styles.frame, { maxWidth: width - spacing.gutter * 2 }]}>
              <Animated.View style={[styles.ring, ringStyle]} />
              <PressableScale
                onPress={open}
                activeScale={1.04}
                focusable={visible}
                tabIndex={visible ? 0 : -1}
                style={[styles.pill, shadows.float]}
                accessibilityLabel={pillA11yLabel(order, active.length || 1, now)}
                accessibilityHint="Opens order tracking"
                accessibilityActions={ACTIONS}
                onAccessibilityAction={onAction}
              >
                <CupGlyph level={cupLevel(order)} active={visible} />
                <Animated.View key={`${order.id}:${order.status}`} entering={enterFade(0)} style={styles.copy}>
                  <Text style={styles.title} color={c.white} numberOfLines={1}>
                    {pillTitle(order)}
                  </Text>
                  {eta ? (
                    <>
                      <Dot color={soft} />
                      {eta.kind === 'minutes' ? (
                        <RollingNumber value={eta.minutes} prefix="~" suffix=" min" fontSize={15} lineHeight={20} fontFamily={fonts.regular} color={soft} grouping={false} />
                      ) : (
                        <Text style={styles.soft} color={soft} numberOfLines={1}>
                          {eta.label}
                        </Text>
                      )}
                    </>
                  ) : null}
                  {count ? (
                    <>
                      <Dot color={soft} />
                      <Text style={styles.soft} color={soft} numberOfLines={1}>
                        {count}
                      </Text>
                    </>
                  ) : null}
                </Animated.View>
                <Icon name="chevron-forward" size={16} color={withAlpha(c.white, 0.45)} />
              </PressableScale>
            </Animated.View>
          </GestureDetector>
        </View>
      </Animated.View>
    </View>
  );
}

/** " · " between the parts (margins, not spaces: web trims a text node's edge spaces in a row). */
function Dot({ color }: { color: string }) {
  const styles = useStyles();
  return (
    <Text style={[styles.soft, styles.dot]} color={color}>
      ·
    </Text>
  );
}

const useStyles = makeStyles((c, t) => ({
  host: { ...StyleSheet.absoluteFill, overflow: 'hidden', pointerEvents: 'box-none' },
  // Full-width strip anchored to the bottom (it never takes touches itself); the pill is centred in it.
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', pointerEvents: 'box-none' },
  frame: { borderRadius: radii.pill },
  ring: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: c.peach,
    pointerEvents: 'none',
  },
  pill: {
    height: LIVE_PILL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 11,
    paddingRight: 14,
    borderRadius: radii.pill,
    backgroundColor: c.capsule,
    borderWidth: StyleSheet.hairlineWidth * 2,
    // A touch brighter in dark, where the edge (not the shadow) lifts the capsule off the canvas.
    borderColor: withAlpha(c.white, t.isDark ? 0.12 : 0.08),
  },
  copy: { flexShrink: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  title: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
  soft: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 20 },
  dot: { marginHorizontal: 5 },
}));

