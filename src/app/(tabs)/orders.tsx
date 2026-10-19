import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, SectionList, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { useMyOrders } from '@/api/hooks';
import { groupOrdersByDay } from '@/components/account/format';
import { PAST_ROW_PAD, PAST_ROW_THUMB, PastOrderRow } from '@/components/account/PastOrderRow';
import { SegmentedControl } from '@/components/account/SegmentedControl';
import { TabHeader } from '@/components/account/TabHeader';
import { CartButton, EmptyState, OrderStatusCard, useReorder, useValueChange } from '@/components/domain';
import { exitFade, layoutSpring, measureInWindowAsync } from '@/components/motion';
import { useTabBarSpace } from '@/components/navigation/TabBar';
import { Screen, Text } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { isActiveStatus } from '@/lib/orderFlow';
import { fonts, makeStyles, radii, useColors } from '@/theme';
import type { Order } from '@/types/models';

const SEGMENTS = ['Active', 'Past'] as const;
/** Past-row geometry (the reorder flight leaves from the thumbnail tile). */
const ROW_PAD = PAST_ROW_PAD;
const ROW_THUMB = PAST_ROW_THUMB;

const byNewest = (a: Order, b: Order) => b.createdAt.localeCompare(a.createdAt);

/**
 * Orders tab (DESIGN.md §R3.B "Orders"): a swipeable Active / Past pager. The segmented ink pill
 * follows the finger (scroll-driven on the UI thread); live orders update in place as the
 * simulator advances them.
 */
export default function OrdersScreen() {
  const styles = useStyles();
  const orders = useMyOrders();
  const active = orders.filter((o) => isActiveStatus(o.status)).sort(byNewest);
  const past = orders.filter((o) => !isActiveStatus(o.status));
  const bottom = useTabBarSpace();
  const { width: windowWidth } = useWindowDimensions();

  // Open on Past only when there's history but nothing live; a brand-new customer sees "Order now".
  const [initialPage] = useState(() => (active.length === 0 && past.length > 0 ? 1 : 0));
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);
  const placed = useRef(false);

  const pagerRef = useAnimatedRef<Animated.ScrollView>();
  const pageW = useSharedValue(windowWidth);
  const scrollX = useSharedValue(initialPage * windowWidth);
  const progress = useDerivedValue(() => {
    const w = pageW.get();
    return w > 0 ? scrollX.get() / w : 0;
  });

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.set(e.contentOffset.x);
    },
  });

  const settle = (index: number) => {
    setPage(index);
    haptic.select();
  };

  // Mirror the page to React only when the pill crosses the midpoint (taps and swipes alike).
  useAnimatedReaction(
    () => Math.round(progress.get()),
    (current, previous) => {
      if (previous !== null && current !== previous) scheduleOnRN(settle, current);
    },
  );

  const goTo = (index: number) => {
    scheduleOnUI(() => {
      scrollTo(pagerRef, index * pageW.get(), 0, true);
    });
  };

  // A new live order (e.g. just placed from checkout) brings the Active page forward.
  useValueChange(active.length, (next, prev) => {
    if (next > prev) goTo(0);
  });

  // Explicit page size: on web a horizontal ScrollView's row doesn't stretch its pages vertically,
  // so each inner vertical list needs a real height to scroll.
  const pageStyle = pageSize ? { width: pageSize.width, height: pageSize.height } : { width: windowWidth };

  return (
    <Screen>
      <TabHeader title="Orders" right={<CartButton />} />

      <View style={styles.segmentWrap}>
        <SegmentedControl
          segments={[
            { key: 'active', label: SEGMENTS[0], count: active.length },
            { key: 'past', label: SEGMENTS[1] },
          ]}
          progress={progress}
          selectedIndex={page}
          onSelect={goTo}
          haptics={false}
        />
      </View>

      <View
        style={styles.flex}
        onLayout={(e) => {
          const { width: w, height: h } = e.nativeEvent.layout;
          if (w <= 0) return;
          const resized = pageSize !== null && Math.abs(pageSize.width - w) > 1;
          pageW.set(w);
          setPageSize({ width: w, height: h });
          if (!placed.current || resized) {
            // First layout: open on the initial page. Width change (rotation, web resize): keep the page.
            const x = (placed.current ? page : initialPage) * w;
            placed.current = true;
            scrollX.set(x);
            scheduleOnUI(() => {
              scrollTo(pagerRef, x, 0, false);
            });
          }
        }}
      >
        <Animated.ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          contentOffset={{ x: initialPage * windowWidth, y: 0 }}
          style={styles.flex}
        >
          <ScrollView
            style={pageStyle}
            contentContainerStyle={[styles.page, { paddingBottom: bottom }]}
            showsVerticalScrollIndicator={false}
            accessibilityLabel="Active orders"
          >
            <ActivePage orders={active} />
          </ScrollView>
          <PastList orders={past} style={pageStyle} bottom={bottom} />
        </Animated.ScrollView>
      </View>
    </Screen>
  );
}

function ActivePage({ orders }: { orders: Order[] }) {
  const styles = useStyles();
  if (orders.length === 0) {
    return (
      <EmptyState
        art="plate"
        title="No active orders"
        message="Your next order will show up here."
        action={{ label: 'Order now', onPress: () => router.navigate('/menu') }}
      />
    );
  }
  return (
    <View style={styles.activeList}>
      {/* The leading order is the night card; the rest are white, so the page isn't a dark wall. */}
      {orders.map((order, i) => (
        <Animated.View key={order.id} layout={layoutSpring} exiting={exitFade}>
          <OrderStatusCard order={order} index={i} variant={i === 0 ? 'hero' : 'light'} />
        </Animated.View>
      ))}
    </View>
  );
}

interface PastSection {
  title: string;
  first: boolean;
  data: Order[];
}

const keyOf = (order: Order) => order.id;

/**
 * Past orders as a virtualized SectionList grouped by day (DESIGN §7 checklist: history lists are
 * virtualized). R3: a sentence-case day label over one white sheet per group; the rows draw the
 * sheet themselves (rounded first / last row), so the list stays virtualized. Reorder flies the
 * row's cut-out into the header cart.
 */
function PastList({ orders, style, bottom }: { orders: Order[]; style: StyleProp<ViewStyle>; bottom: number }) {
  const c = useColors();
  const styles = useStyles();
  const reorder = useReorder();
  const rowRefs = useRef(new Map<string, View | null>());

  const groups = groupOrdersByDay(orders);
  const flat = groups.flatMap((g) => g.orders);
  // One order a day reads as a stack of identical one-row cards: then it's ONE sheet with the day
  // folded into each caption ("Today · Pickup"). Busier days keep a label over a sheet per day.
  const merged = groups.length > 1 && groups.every((g) => g.orders.length === 1);
  const dayOf = new Map(groups.flatMap((g) => g.orders.map((o) => [o.id, g.title] as const)));
  const sections: PastSection[] = merged
    ? [{ title: '', first: true, data: flat }]
    : groups.map((g, i) => ({ title: g.title, first: i === 0, data: g.orders }));
  // Running index across sections, so the entrance stagger flows top to bottom.
  const indexOf = new Map(flat.map((o, i) => [o.id, i] as const));

  const register = (id: string, node: View | null) => {
    rowRefs.current.set(id, node);
  };

  const onReorder = async (order: Order) => {
    const node = rowRefs.current.get(order.id) ?? null;
    const row = await measureInWindowAsync({ current: node });
    // Fly from the thumbnail tile at the row's left edge, not the whole row.
    const from = row
      ? { x: row.x + ROW_PAD, y: row.y + (row.height - ROW_THUMB) / 2, width: ROW_THUMB, height: ROW_THUMB }
      : null;
    await reorder(order.items, from, ROW_THUMB);
  };

  return (
    <SectionList
      style={style}
      sections={sections}
      keyExtractor={keyOf}
      stickySectionHeadersEnabled={false}
      initialNumToRender={10}
      windowSize={7}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.page, { paddingBottom: bottom }]}
      accessibilityLabel="Past orders"
      renderSectionHeader={({ section }) =>
        section.title ? (
          <Text style={[styles.dayLabel, section.first ? null : styles.dayLabelSpaced]} color={c.inkSoft} accessibilityRole="header">
            {section.title}
          </Text>
        ) : null
      }
      renderItem={({ item, index, section }) => (
        <PastRow
          order={item}
          index={indexOf.get(item.id) ?? 0}
          first={index === 0}
          last={index === section.data.length - 1}
          day={merged ? dayOf.get(item.id) : undefined}
          onReorder={onReorder}
          register={register}
        />
      )}
      ListEmptyComponent={
        <EmptyState
          art="plate"
          title="No past orders yet"
          message="Finished orders land here for one-tap reorders."
          action={{ label: 'Browse the menu', onPress: () => router.navigate('/menu') }}
        />
      }
    />
  );
}

function PastRow({
  order,
  index,
  first,
  last,
  day,
  onReorder,
  register,
}: {
  order: Order;
  index: number;
  first: boolean;
  last: boolean;
  day?: string;
  onReorder: (order: Order) => Promise<void>;
  register: (id: string, node: View | null) => void;
}) {
  const styles = useStyles();
  return (
    <View
      ref={(node) => register(order.id, node)}
      collapsable={false}
      style={[styles.sheetRow, first ? styles.sheetTop : null, last ? styles.sheetBottom : null]}
    >
      <PastOrderRow order={order} index={index} divider={!first} day={day} onReorder={() => void onReorder(order)} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  segmentWrap: { paddingHorizontal: 20, paddingBottom: 16 },
  page: { paddingHorizontal: 20, paddingTop: 4, flexGrow: 1 },
  activeList: { gap: 16 },
  dayLabel: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, marginBottom: 8, paddingHorizontal: 4 },
  dayLabelSpaced: { marginTop: 24 },
  sheetRow: { backgroundColor: c.surface, overflow: 'hidden' },
  sheetTop: { borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg },
  sheetBottom: { borderBottomLeftRadius: radii.lg, borderBottomRightRadius: radii.lg },
}));
