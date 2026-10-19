import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cancelOrder, isNetworkError, markArrived } from '@/api';
import { useOrder } from '@/api/hooks';
import { ConfirmSheet } from '@/components/account/ConfirmSheet';
import { refundCopy } from '@/components/account/format';
import { HeaderScrollEdge, useHeaderScroll } from '@/components/account/HeaderScrollEdge';
import { ItemsCard, ModeDetailsCard, ReceiptCard } from '@/components/account/OrderDetails';
import { OrderHero } from '@/components/account/OrderHero';
import { InvoiceLinkRow } from '@/components/invoice/InvoiceLinkRow';
import {
  ArtStack,
  EmptyState,
  orderImages,
  resolveTileColor,
  StatusTimeline,
  tintForImage,
  useFlash,
  useReorder,
  useValueChange,
} from '@/components/domain';
import { ConfettiBurst, easeOutQuint, enterUp, measureInWindowAsync, useToast, withAlpha } from '@/components/motion';
import { ListRow, PillButton, PrimaryBar, Screen, ScreenHeader, Text } from '@/components/ui';
import { formatMoney, pluralize } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { canCancel, isActiveStatus } from '@/lib/orderFlow';
import { fonts, layout, makeStyles, makeThemed, radii, spacing, springs, useTheme } from '@/theme';
import type { Order } from '@/types/models';

/** Reorder tile (64, r20) holding up to two overlapping cut-outs; the flight leaves at the tile size. */
const REORDER_TILE = 64;
const REORDER_ART = 46;
const barIn = FadeInDown.springify().damping(springs.smooth.damping).stiffness(springs.smooth.stiffness).mass(1).easing(easeOutQuint);
const barOut = FadeOutDown.duration(180);
const useBarFade = makeThemed((c) => [withAlpha(c.bg, 0), c.bg] as const);

/** User-facing copy for a failed request (kept out of try/catch: React Compiler can't lower value blocks there). */
function describeError(e: unknown, fallback: string): string {
  if (isNetworkError(e)) return 'You’re offline. Check your connection and try again.';
  return e instanceof Error && e.message ? e.message : fallback;
}

/**
 * Order tracking + details + receipt (DESIGN.md §R3.B "Tracking"; live: re-renders as the simulator
 * advances the status).
 */
export default function OrderScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const order = useOrder(id);

  if (!order) return <OrderNotFound />;
  return <OrderTracking order={order} />;
}

function OrderTracking({ order }: { order: Order }) {
  const { colors: c, tileTints } = useTheme();
  const styles = useStyles();
  const barFade = useBarFade();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const reorder = useReorder();
  const thumbsRef = useRef<View>(null);
  const [added, flashAdded] = useFlash(1800);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string>();
  const [arriving, setArriving] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  const active = isActiveStatus(order.status);
  const cancellable = canCancel(order.status);
  const needsArrival = order.details.mode === 'in_car' && order.status === 'ready' && !order.arrived;
  const car = order.details.car;

  // Finished while you watched: draw the check and throw a little confetti.
  useValueChange(order.status, (next) => {
    if (next === 'completed') setCelebrate(true);
    if (next !== 'placed' && next !== 'accepted') setConfirmOpen(false);
  });

  const onArrive = async () => {
    setArriving(true);
    try {
      await markArrived(order.id);
      haptic.success();
      toast('Thanks! A barista is bringing it out.', { tone: 'success', icon: 'car-sport' });
    } catch (e) {
      haptic.error();
      toast(describeError(e, 'Couldn’t reach the café. Try again.'), { tone: 'error' });
    }
    setArriving(false);
  };

  const onCancel = async () => {
    setCancelError(undefined);
    const doneMessage = order.paymentStatus === 'paid' ? 'Order cancelled · refund on its way' : 'Order cancelled';
    try {
      await cancelOrder(order.id);
      setConfirmOpen(false);
      // Silent: the dialog's Confirm already clicked; the toast is the outcome.
      toast(doneMessage, { icon: 'close-circle' });
    } catch (e) {
      setCancelError(describeError(e, 'Couldn’t cancel the order. Please try again.'));
    }
  };

  const onReorder = async () => {
    flashAdded();
    const rect = await measureInWindowAsync(thumbsRef);
    await reorder(order.items, rect, REORDER_TILE);
  };

  // Header separation: a hairline + soft fade appear once the content scrolls under it.
  const { scrollY, onScroll } = useHeaderScroll();

  const barSpace = needsArrival ? layout.ctaHeight + spacing.xl + 22 : 0;
  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);
  const reorderTitle = active ? 'Order it again' : order.status === 'cancelled' ? 'Still want it?' : 'Order it again';

  return (
    <Screen>
      <ScreenHeader title={active ? 'Track order' : 'Order details'} centerTitle style={styles.header} />

      <View style={styles.flexFill}>
        <Animated.ScrollView
          onScroll={onScroll}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl + barSpace }]}
          showsVerticalScrollIndicator={false}
        >
          <OrderHero order={order} />

          <Animated.View entering={enterUp(1)}>
            <Text variant="h2" style={styles.sectionTitle} accessibilityRole="header">
              Progress
            </Text>
            <View style={[styles.sheet, styles.timeline]}>
              {/* The hero already carries the status line: the timeline stays labels + times. */}
              <StatusTimeline order={order} descriptions={false} />
              {cancellable ? (
                <View style={styles.cancelRow}>
                  <Text style={[styles.flex, styles.cancelHint]} color={c.inkSoft}>
                    You can cancel until we start making it.
                  </Text>
                  <PillButton
                    label="Cancel order"
                    tone="outline"
                    size="sm"
                    onPress={() => {
                      setCancelError(undefined);
                      setConfirmOpen(true);
                    }}
                  />
                </View>
              ) : null}
            </View>
          </Animated.View>

          <ModeDetailsCard order={order} index={2} />
          <ItemsCard order={order} index={3} />
          <ReceiptCard order={order} index={4} />

          <Animated.View entering={enterUp(5)} style={styles.reorder}>
            <View
              ref={thumbsRef}
              collapsable={false}
              style={[styles.reorderTile, { backgroundColor: resolveTileColor(tintForImage(order.items[0]?.image), tileTints) }]}
            >
              <ArtStack images={orderImages(order)} size={REORDER_ART} max={2} overlap={26} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.reorderTitle}>{reorderTitle}</Text>
              <Text style={styles.reorderCaption} color={c.inkSoft}>
                {`${formatMoney(order.totals.subtotal)} · ${pluralize(itemCount, 'item')}`}
              </Text>
            </View>
            <PillButton
              label={added ? 'Added' : 'Reorder'}
              tone={added ? 'sage' : active ? 'outline' : 'ink'}
              size="sm"
              hapticKind="press"
              onPress={added ? undefined : () => void onReorder()}
              accessibilityLabel={`Reorder, ${formatMoney(order.totals.subtotal)}`}
              style={[styles.reorderPill, added ? styles.addedPill : null]}
            />
          </Animated.View>

          <Animated.View entering={enterUp(6)} style={styles.sheet}>
            <InvoiceLinkRow order={order} />
            <ListRow title="Get help with this order" onPress={() => router.push('/help')} />
          </Animated.View>
        </Animated.ScrollView>
        <HeaderScrollEdge scrollY={scrollY} />
      </View>

      {needsArrival ? (
        <Animated.View
          entering={barIn}
          exiting={barOut}
          style={[styles.bar, { paddingBottom: insets.bottom + spacing.md }]}
        >
          <LinearGradient colors={barFade} style={styles.barFade} />
          <PrimaryBar
            label="I’m here"
            icon="car-sport"
            loading={arriving}
            onPress={() => void onArrive()}
            hint={
              car
                ? `${`${car.color} ${car.make}`.trim()}${car.plate ? ` · ${car.plate.toUpperCase()}` : ''} · tap once you’ve parked`
                : 'Tap once you’ve parked in a marked bay'
            }
            accessibilityLabel="I’m here. Tell the café you’ve parked"
          />
        </Animated.View>
      ) : null}

      <ConfettiBurst play={celebrate} originY={insets.top + 200} />

      <ConfirmSheet
        visible={confirmOpen}
        icon="close-circle-outline"
        title="Cancel this order?"
        message={order.paymentStatus === 'paid' ? refundCopy(order, 'ask') : 'Nothing has been charged yet, so there’s nothing to refund.'}
        confirmLabel="Cancel order"
        cancelLabel="Keep my order"
        destructive
        error={cancelError}
        onConfirm={onCancel}
        onCancel={() => setConfirmOpen(false)}
      />
    </Screen>
  );
}

function OrderNotFound() {
  const styles = useStyles();
  return (
    <Screen>
      <ScreenHeader title="Order" centerTitle style={styles.header} />
      <View style={styles.notFound}>
        <EmptyState
          art="plate"
          title="We couldn’t find that order"
          message="It may have been cleared by a demo reset."
          action={{ label: 'View my orders', onPress: () => router.navigate('/orders') }}
        />
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1, minWidth: 0 },
  flexFill: { flex: 1 },
  header: { paddingBottom: spacing.xs },
  content: { paddingHorizontal: spacing.gutter, paddingTop: spacing.sm, gap: spacing.xl },
  sectionTitle: { marginBottom: spacing.sm, paddingHorizontal: spacing.xxs },
  // R3.A10: one white sheet, r28, no shadow.
  sheet: { backgroundColor: c.surface, borderRadius: radii.lg, overflow: 'hidden' },
  timeline: { padding: spacing.lg },
  cancelHint: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  cancelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: c.line,
  },
  reorder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    paddingRight: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: c.surface,
  },
  reorderTile: {
    width: REORDER_TILE,
    height: REORDER_TILE,
    borderRadius: radii.thumb,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 8,
  },
  reorderTitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  reorderCaption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, marginTop: 2 },
  reorderPill: { paddingHorizontal: spacing.sm + 2 },
  // White on plain sage is ~2.4:1; small filled pills use the deep sage (DESIGN §2 contrast).
  addedPill: { backgroundColor: c.sageDeep },
  barFade: { position: 'absolute', left: 0, right: 0, top: -28, height: 28, pointerEvents: 'none' },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
    backgroundColor: c.bg,
  },
  notFound: { flex: 1 },
}));

