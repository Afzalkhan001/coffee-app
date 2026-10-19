/**
 * Cart (DESIGN.md §R3.B "Cart", ref 1). The total is always visible without scrolling:
 *  - header: back circle, "Cart" at x 76, and the sage count badge with its ring (the fly target);
 *  - a scrolling white notched list sheet: 88px rows (tile, name, modifiers, stepper, price pill),
 *    swipe-to-delete (taught once per session by a small nudge), and one "Often added" upsell;
 *  - the dock: the peach total card (≤ 2 breakdown pills, the 44px rolling total, the order's
 *    cut-outs bleeding off its corner) over the ink Checkout bar. It follows the end of the list
 *    (24 under the sheet: one composition, no void between two islands) and pins to the bottom only
 *    once the list would run under it — then the list scrolls behind a 24px canvas fade. Either
 *    way the total is visible without scrolling.
 * Promo codes, the ordering mode and the subtotal live on checkout.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cartLineIssue } from '@/api';
import { CartTarget, enterFade, enterUp, popIn, RollingNumber, setHeroOrigin, usePop, withAlpha, type WindowRect } from '@/components/motion';
import { EmptyState, SUMMARY_DOCK_HEIGHT, SummaryCard, useValueChange } from '@/components/domain';
import { PopularRightNow } from '@/components/home';
import { PrimaryBar, ScreenHeader } from '@/components/ui';
import { HeaderScrollEdge, useHeaderScroll } from '@/components/account/HeaderScrollEdge';
import { BAR_HINT_SPACE } from '@/components/checkout/BottomBar';
import { CartLine } from '@/components/checkout/CartLine';
import { useCartTotals, useModeDetails, useMounted } from '@/components/checkout/hooks';
import { NotchedSheet } from '@/components/checkout/NotchedSheet';
import { SwipeRow } from '@/components/checkout/SwipeRow';
import { upsellAvailable, UpsellRow } from '@/components/checkout/UpsellRow';
import { formatMoney, pluralize } from '@/lib/format';
import { isDeliverable } from '@/lib/geo';
import { haptic } from '@/lib/haptics';
import { useCart } from '@/store/cart';
import { fonts, layout, makeStyles, makeThemed, spacing, springs, useColors } from '@/theme';
import type { CartItem, OrderModeDetails } from '@/types/models';

/** The swipe nudge plays once per app session (R3.C6). */
let swipeHintPlayed = false;

const SHEET_INSET = 12;
const DOCK_GAP = 12;
/** Gap between the list sheet and the dock while it follows the list; also the fade's height once pinned. */
const DOCK_FADE = 24;
const useFade = makeThemed((c) => [withAlpha(c.bg, 0), c.bg] as const);
/** A tap this soon after a row drag started is the tail of the swipe, not an "edit" tap. */
const DRAG_TAP_GUARD_MS = 450;
/** Event-time helpers (only ever called from handlers): when a drag started, and whether one just did. */
const markDrag = (ref: { current: number }) => {
  ref.current = Date.now();
};
const draggedRecently = (ref: { current: number }) => Date.now() - ref.current < DRAG_TAP_GUARD_MS;

export default function CartScreen() {
  const styles = useStyles();
  const fade = useFade();
  const insets = useSafeAreaInsets();
  const { items, mode, totals, count } = useCartTotals();
  const details = useModeDetails();
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);
  const mounted = useMounted();
  const { scrollY, onScroll } = useHeaderScroll();
  const [openRow, setOpenRow] = useState<string | null>(null);
  // On web a mouse drag ends with a click on the row; ignore taps right after a swipe.
  const lastDragAt = useRef(0);
  // Decided once, on the first render with lines: only this cart's first row nudges.
  const [peek] = useState(() => !swipeHintPlayed && useCart.getState().items.length > 0);
  useEffect(() => {
    if (peek) swipeHintPlayed = true;
  }, [peek]);

  const empty = count === 0;
  const soldOut = items.filter((i) => cartLineIssue(i) !== null).length;
  const showUpsell = upsellAvailable(items);
  const dockBottom = Math.max(insets.bottom, spacing.md);
  const dockHeight = SUMMARY_DOCK_HEIGHT + DOCK_GAP + layout.ctaHeight + dockBottom + (soldOut > 0 ? BAR_HINT_SPACE : 0);

  // ── dock placement: min(end of the list + 24, pinned to the bottom), on the UI thread ──
  const sheetBottom = useSharedValue(-1); // in scroll-content coordinates; -1 until measured
  const bodyHeight = useSharedValue(0);
  const onSheetLayout = (e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    const next = y + height;
    // First measurement lands in place; later changes (a line removed, the upsell added) glide.
    sheetBottom.set(sheetBottom.get() < 0 ? next : withSpring(next, springs.smooth));
  };
  const onBodyLayout = (e: LayoutChangeEvent) => bodyHeight.set(e.nativeEvent.layout.height);
  const dockStyle = useAnimatedStyle(() => {
    const ready = sheetBottom.get() >= 0 && bodyHeight.get() > 0;
    const pinned = bodyHeight.get() - dockHeight;
    const follow = sheetBottom.get() + DOCK_FADE - scrollY.get();
    return { opacity: ready ? 1 : 0, transform: [{ translateY: ready ? Math.min(follow, pinned) : pinned }] };
  });
  // The fade only shows while rows actually pass under the pinned dock.
  const fadeStyle = useAnimatedStyle(() => {
    const overflow = sheetBottom.get() + DOCK_FADE - scrollY.get() - (bodyHeight.get() - dockHeight);
    return { opacity: interpolate(overflow, [0, DOCK_FADE], [0, 1], Extrapolation.CLAMP) };
  });

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const edit = (item: CartItem, from: WindowRect | null) => {
    if (draggedRecently(lastDragAt)) return;
    if (openRow) {
      setOpenRow(null);
      return;
    }
    // The product screen flies its hero cut-out out of this thumbnail's art box.
    if (from) setHeroOrigin(item.productId, from);
    router.push({ pathname: '/product/[id]', params: { id: item.productId, lineId: item.id } });
  };
  const handleDragStart = () => {
    markDrag(lastDragAt);
  };
  const handleOpenChange = (id: string, open: boolean) => setOpenRow((cur) => (open ? id : cur === id ? null : cur));
  const handleDelete = (id: string) => {
    remove(id);
    setOpenRow((cur) => (cur === id ? null : cur));
  };
  const checkout = () => {
    if (soldOut > 0) return; // the disabled bar's hint says what to do (PrimaryBar fires the warning haptic)
    if (mode === 'delivery' && deliveryBlocked(details)) {
      router.push({ pathname: '/address', params: { next: 'checkout' } });
      return;
    }
    router.push('/checkout');
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="Cart"
        onBack={back}
        right={
          // Fly-to-cart target: the upsell cut-out lands here; the count pops as it grows.
          <CartTarget popScale={1}>{count > 0 ? <CountBadge count={count} /> : <View style={styles.badgeSpace} />}</CartTarget>
        }
      />

      {empty ? (
        <Animated.View entering={enterFade()} style={styles.empty}>
          <EmptyState art="plate" title="Your cart is empty" action={{ label: 'Browse menu', onPress: () => router.navigate('/menu') }}>
            {/* A dead end that keeps selling: the same rail as search's no-results, 40 under the pill. */}
            <PopularRightNow bleed={spacing.xxl} style={styles.emptyRail} />
          </EmptyState>
        </Animated.View>
      ) : (
        <View style={styles.flex} onLayout={onBodyLayout}>
          <Animated.ScrollView
            onScroll={onScroll}
            contentContainerStyle={[styles.content, { paddingBottom: dockHeight + DOCK_FADE }]}
            showsVerticalScrollIndicator={false}
            onScrollBeginDrag={() => setOpenRow(null)}
          >
            <View onLayout={onSheetLayout}>
              <NotchedSheet>
                {items.map((item, i) => (
                  <SwipeRow
                    key={item.id}
                    id={item.id}
                    label={item.name}
                    open={openRow === item.id}
                    onOpenChange={handleOpenChange}
                    onDragStart={handleDragStart}
                    onDelete={handleDelete}
                    entering={enterUp(mounted ? 0 : i + 1)}
                    peek={peek && i === 0}
                  >
                    <CartLine
                      item={item}
                      issue={cartLineIssue(item)}
                      divider={i < items.length - 1}
                      onEdit={(from) => edit(item, from)}
                      onLongPress={() => {
                        // The long press opens the row's delete action.
                        haptic.longPress();
                        setOpenRow(item.id);
                      }}
                      onRemove={() => setOpenRow(item.id)}
                      onQuantity={(q) => setQuantity(item.id, q)}
                    />
                  </SwipeRow>
                ))}
                <UpsellRow visible={showUpsell} />
              </NotchedSheet>
            </View>
          </Animated.ScrollView>
          <HeaderScrollEdge scrollY={scrollY} />

          <Animated.View style={[styles.dock, { paddingBottom: dockBottom }, dockStyle]}>
            <Animated.View style={[styles.dockFade, fadeStyle]}>
              <LinearGradient colors={fade} style={StyleSheet.absoluteFill} />
            </Animated.View>
            <SummaryCard variant="dock" totals={totals} mode={mode} itemImages={items.map((i) => i.image)} />
            <Animated.View entering={enterUp(mounted ? 0 : 2)} style={styles.bar}>
              <PrimaryBar
                label="Checkout"
                onPress={checkout}
                disabled={soldOut > 0}
                hint={soldOut > 0 ? `Remove ${soldOut === 1 ? 'the unavailable item' : 'unavailable items'} to continue` : undefined}
                accessibilityLabel={`Checkout, ${pluralize(count, 'item')}, ${formatMoney(totals.total)}`}
              />
            </Animated.View>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

/** Delivery selected but no address we can deliver to → Checkout routes to /address first. */
function deliveryBlocked(details: OrderModeDetails): boolean {
  if (details.mode !== 'delivery') return false;
  return !details.address || !isDeliverable(details.address);
}

const BADGE = 44;
const RING = 54;

/** Ref 1's green count: a 44px sageDeep circle with the rolling count, inside a 54px sage ring. */
function CountBadge({ count }: { count: number }) {
  const c = useColors();
  const styles = useStyles();
  const { style: popStyle, pop } = usePop(1.22);
  useValueChange(count, (next, prev) => {
    if (next !== prev) pop();
  });
  return (
    <Animated.View entering={popIn(1)} accessible accessibilityLabel={`${pluralize(count, 'item')} in your cart`} style={styles.ring}>
      <Animated.View style={[styles.badge, popStyle]}>
        <RollingNumber value={count} decimals={0} fontSize={17} fontFamily={fonts.bold} color={c.white} />
      </Animated.View>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },
  ring: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 1.5,
    borderColor: withAlpha(c.sage, 0.6),
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: -5,
    marginRight: -5,
  },
  badge: {
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    // sageDeep: white on plain sage is ≈2.4:1 (DESIGN §2 contrast rule).
    backgroundColor: c.sageDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSpace: { width: BADGE, height: BADGE },
  empty: { flex: 1, justifyContent: 'center', paddingBottom: spacing.xxxl },
  emptyRail: { marginTop: spacing.xs },
  content: { paddingHorizontal: SHEET_INSET, paddingTop: spacing.xxs },
  // Placed by `dockStyle` (top 0 + translateY): under the list, or pinned to the bottom.
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: spacing.gutter,
    backgroundColor: c.bg,
  },
  dockFade: { position: 'absolute', left: 0, right: 0, top: -DOCK_FADE, height: DOCK_FADE, pointerEvents: 'none' },
  bar: { marginTop: DOCK_GAP },
}));
