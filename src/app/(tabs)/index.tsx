/**
 * Home (DESIGN.md §R3.B Home, §7 "Home scroll"). A collapsing header — the location row is the
 * ordering-mode switch, "Morning, Ava" + points, a sticky search pill — then five quiet sections:
 * the live-order strip, the promo carousel, category tiles, "Popular now" and "Order again".
 * Once the customer has favourites, "Your favourites" takes the "Popular now" slot (R3: ≤ 5
 * sections; their own picks beat the generic list, which Menu still carries).
 */
import { router, useFocusEffect, useScrollToTop } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { scrollTo, useAnimatedReaction, useAnimatedRef, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { getMenu, getPromotions } from '@/api';
import { useActiveOrders, useAsync, useLoyalty, useMyOrders } from '@/api/hooks';
import { isRealOrder } from '@/api/mockDb';
import {
  CartButton,
  ErrorState,
  FLOATING_CART_BAR_SPACE,
  FloatingCartBar,
  OrderAgainCard,
  OrderStatusCard,
  openProduct,
  PROMO_BLEED,
  PromoCarousel,
  PromoCarouselSkeleton,
  SearchBarButton,
  useLastCompletedOrder,
  useValueChange,
} from '@/components/domain';
import {
  BellButton,
  CategoryRail,
  CategoryRailSkeleton,
  CollapsingHomeHeader,
  GreetingRow,
  HOME_HEADER_HEIGHT,
  HOME_ROW1,
  HOME_ROW2,
  HomeInbox,
  favoritePicks,
  HomeSection,
  LocationButton,
  popularPicks,
  promosFor,
  ProductRail,
  ProductRailSkeleton,
  useHasHomeNotifications,
} from '@/components/home';
import { enterFade, enterUp } from '@/components/motion';
import { useTabBarSpace } from '@/components/navigation/TabBar';
import { useSplashLifted } from '@/components/onboarding/AnimatedSplash';
import { useCartCount } from '@/store/cart';
import { useFavoriteIds } from '@/store/favorites';
import { useSession } from '@/store/session';
import { makeStyles, spacing } from '@/theme';
import type { Category, Promotion } from '@/types/models';

/** The search pill ends 4px above the scroll content (HOME_ROW3's bottom padding). */
const SEARCH_TAIL = 4;
/** First block 16 below the search pill. */
const LEAD = 16 - SEARCH_TAIL;
/** The promo banner sits 30 below what's above it; its cut-out bleeds 40 above the banner. */
const PROMO_GAP = 30;
/**
 * The View cart bar waits until the first screen has scrolled by: the header cart already carries
 * the badge, and the bar + tab bar would stack two ink slabs over the category row on short phones.
 */
const CART_BAR_AFTER = 220;

// ── navigation helpers ───────────────────────────────────────
const goMenu = () => router.navigate('/menu');
const goRewards = () => router.navigate('/rewards');
const goOrders = () => router.navigate('/orders');
const goFavorites = () => router.push('/favorites');
const openModeSheet = () => router.push('/mode');
const openCategory = (c: Category) => router.push({ pathname: '/category/[id]', params: { id: c.id } });

function openPromo(promo: Promotion) {
  switch (promo.target.type) {
    case 'menu':
      goMenu();
      return;
    case 'product':
      openProduct(promo.target.id);
      return;
    case 'category':
      router.push({ pathname: '/category/[id]', params: { id: promo.target.id } });
  }
}

export default function HomeScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  // The first screen mounts under the launch splash: start the entrance when it lifts.
  const lifted = useSplashLifted();
  const tabSpace = useTabBarSpace();
  const cartCount = useCartCount();

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);

  const [pastFold, setPastFold] = useState(false);
  useAnimatedReaction(
    () => scrollY.get() > CART_BAR_AFTER,
    (past, prev) => {
      if (past !== prev) scheduleOnRN(setPastFold, past);
    },
  );

  // Half-collapsed header snaps open/closed when the finger lifts (native only: web fires onScroll alone).
  const snap = (offset: number) => {
    'worklet';
    if (offset > 0 && offset < HOME_ROW2) scrollTo(scrollRef, 0, offset < HOME_ROW2 / 2 ? 0 : HOME_ROW2, true);
  };
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.set(e.contentOffset.y);
    },
    onEndDrag: (e) => {
      if (Math.abs(e.velocity?.y ?? 0) < 0.2) snap(e.contentOffset.y);
    },
    onMomentumEnd: (e) => {
      snap(e.contentOffset.y);
    },
  });

  // Re-tapping the Home tab scrolls back to the top (useScrollToTop calls `scrollTo` on this target).
  const scrollTopTarget = useRef({
    scrollTo: (_options: { x?: number; y?: number; animated?: boolean }) => {
      scheduleOnUI(() => {
        scrollTo(scrollRef, 0, 0, true);
      });
    },
  });
  useScrollToTop(scrollTopTarget);

  // ── data ──
  const name = useSession((s) => s.profile?.name);
  const { balance } = useLoyalty();
  const activeOrders = useActiveOrders();
  const lastOrder = useLastCompletedOrder();
  const menu = useAsync(getMenu);
  const promos = useAsync(getPromotions);
  // FIRST20 is first-order only: regulars see a code checkout will accept (WELCOME10) instead.
  const isFirstOrder = !useMyOrders().some((o) => o.status !== 'cancelled' && isRealOrder(o));
  const promoList = promos.data ? promosFor(promos.data, isFirstOrder) : undefined;
  const retry = () => {
    menu.reload();
    promos.reload();
  };

  // ── bell inbox ──
  const hasUpdates = useHasHomeNotifications(promoList);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [unread, setUnread] = useState(true);
  const orderStatusKey = activeOrders.map((o) => `${o.id}:${o.status}`).join('|');
  useValueChange(orderStatusKey, () => setUnread(true)); // a status change re-lights the dot
  useFocusEffect(
    useCallback(() => () => setInboxOpen(false), []), // close when leaving the tab
  );
  const openInbox = () => {
    setInboxOpen(true);
    setUnread(false);
  };

  const bottomPad = tabSpace + (cartCount > 0 ? FLOATING_CART_BAR_SPACE : 0);
  const products = menu.data?.products ?? [];
  const favoriteIds = useFavoriteIds();
  const favorites = favoritePicks(products, favoriteIds);
  // Decided from the saved ids while the menu loads (its skeleton holds the slot), then from what resolved.
  const showFavorites = menu.data ? favorites.length > 0 : favoriteIds.length > 0;
  const firstOrder = activeOrders[0];
  const moreOrders = activeOrders.length - 1;
  // The banner is PROMO_GAP below the strip, or below the search pill (which ends SEARCH_TAIL into the content).
  const promoTop = (firstOrder ? PROMO_GAP : PROMO_GAP - SEARCH_TAIL) - PROMO_BLEED;

  return (
    <View style={styles.root}>
      {lifted ? (
        <>
          {/* No scrollEventThrottle: Animated.ScrollView defaults to 1 (every frame, also on 120Hz). */}
          <Animated.ScrollView
            ref={scrollRef}
            onScroll={onScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: insets.top + HOME_HEADER_HEIGHT, paddingBottom: bottomPad }}
          >
            {/* 1 · live order: an ink strip (the full card lives on Orders / tracking); "+2" when there are more */}
            {firstOrder ? (
              <OrderStatusCard
                order={firstOrder}
                index={4}
                variant="compact"
                more={moreOrders}
                onPress={moreOrders > 0 ? goOrders : undefined}
                style={styles.strip}
              />
            ) : null}

            {/* Offline / failed catalogue: one retryable state replaces the catalogue-backed sections */}
            {menu.error ? <ErrorState error={menu.error} onRetry={retry} compact style={styles.error} /> : null}

            {/* 2 · promo banners (their cut-outs bleed 40px above, inside the carousel's own padding) */}
            {menu.error || (!promoList && !promos.loading) ? null : (
              <View style={{ marginTop: promoTop }}>
                {promoList ? (
                  // Replaces its skeleton: fade in right away (a stagger delay here would flash an empty slot).
                  <Animated.View entering={enterFade(0)}>
                    <PromoCarousel promotions={promoList} onPress={openPromo} />
                  </Animated.View>
                ) : (
                  <PromoCarouselSkeleton />
                )}
              </View>
            )}

            {/* 3 · categories: no header, the tiles speak for themselves */}
            {menu.error ? null : (
              <HomeSection index={5} padded={false}>
                {menu.data ? <CategoryRail categories={menu.data.categories} onPress={openCategory} /> : <CategoryRailSkeleton />}
              </HomeSection>
            )}

            {/* 4 · their favourites (once there are any), else food first: cut-outs + prices */}
            {menu.error ? null : showFavorites ? (
              <HomeSection
                key="favorites"
                index={6}
                title="Your favourites"
                action={{ label: 'See all', onPress: goFavorites, accessibilityLabel: 'See all favourites' }}
                padded={false}
              >
                {menu.data ? (
                  <Animated.View entering={enterFade(0)}>
                    <ProductRail
                      products={favorites}
                      accessibilityLabel="Your favourites"
                      animateEntrance={false}
                      saleTone="ink"
                      showFavorite={false}
                    />
                  </Animated.View>
                ) : (
                  <ProductRailSkeleton />
                )}
              </HomeSection>
            ) : (
              <HomeSection
                key="popular"
                index={6}
                title="Popular now"
                action={{ label: 'See all', onPress: goMenu, accessibilityLabel: 'See all popular items' }}
                padded={false}
              >
                {menu.data ? (
                  // The section already rises in: cards don't travel again, the rail just fades over its skeleton.
                  <Animated.View entering={enterFade(0)}>
                    <ProductRail
                      products={popularPicks(products)}
                      accessibilityLabel="Popular now"
                      animateEntrance={false}
                      saleTone="ink"
                    />
                  </Animated.View>
                ) : (
                  <ProductRailSkeleton />
                )}
              </HomeSection>
            )}

            {/* 5 · order again (only with a completed order) */}
            {lastOrder ? (
              // The card runs its own rise: the section only fades, so nothing travels twice.
              <HomeSection index={7} title="Order again" childrenAnimate>
                <OrderAgainCard order={lastOrder} index={7} />
              </HomeSection>
            ) : null}
          </Animated.ScrollView>

          <CollapsingHomeHeader
            scrollY={scrollY}
            row1={
              <>
                <Animated.View entering={enterUp(0)} style={styles.flex}>
                  <LocationButton onPress={openModeSheet} />
                </Animated.View>
                <Animated.View entering={enterUp(1)}>
                  <BellButton unread={unread && hasUpdates} onPress={openInbox} />
                </Animated.View>
                <Animated.View entering={enterUp(2)}>
                  <CartButton />
                </Animated.View>
              </>
            }
            row2={
              <Animated.View entering={enterUp(2)} style={styles.flex}>
                <GreetingRow name={name} points={balance} onPointsPress={goRewards} />
              </Animated.View>
            }
            row3={
              <Animated.View entering={enterUp(3)}>
                <SearchBarButton onPress={() => router.push('/search')} />
              </Animated.View>
            }
          />

          <FloatingCartBar suppressed={!pastFold} />

          {/* Last, so its dim covers the floating cart bar too */}
          <HomeInbox
            open={inboxOpen}
            onClose={() => setInboxOpen(false)}
            promotions={promoList}
            top={insets.top + HOME_ROW1 - 2}
          />
        </>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },
  strip: { marginTop: LEAD, paddingHorizontal: spacing.gutter },
  error: { marginTop: spacing.xs },
}));
