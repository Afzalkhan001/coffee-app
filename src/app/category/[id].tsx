/**
 * Category list (DESIGN.md §R3.B Category). A `heroTints` plane with the sentence-case title,
 * "8 drinks · from ₹160" and the signature cut-out bleeding off the right edge; a fixed back / cart
 * bar that frosts on scroll (with the "Veg only" switch beside the cart); text filter chips that
 * re-flow the 2-column grid with springs; empty (also "no veg items here") and offline states.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { categoryImage, getCategorySync, getMenu } from '@/api';
import { useAsync } from '@/api/hooks';
import { CartButton, EmptyState, ErrorState, FLOATING_CART_BAR_SPACE, FloatingCartBar } from '@/components/domain';
import { vegFilter } from '@/components/domain/VegMark';
import {
  applyFilter,
  availableFirst,
  CATEGORY_PLANE_GONE,
  CategoryHero,
  categorySummary,
  expectsFilters,
  FilterChipsRow,
  FilterChipsSkeleton,
  FrostedTopBar,
  noVegMessage,
  ProductGrid,
  ProductGridSkeletons,
  usefulFilters,
  VegOnlyToggle,
  type ProductFilterId,
} from '@/components/home';
import { enterFade } from '@/components/motion';
import { useLivePillSpace } from '@/components/order/livePillSpace';
import { useCartCount } from '@/store/cart';
import { useFavorites, useVegOnly } from '@/store/favorites';
import { makeStyles, spacing } from '@/theme';

const firstParam = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
/** Distance from the screen bottom for the floating cart bar on screens without the tab bar. */
const floatingBarBottom = (insetBottom: number) => Math.max(insetBottom, spacing.md) + spacing.xs;
const browseMenu = () => router.navigate('/menu');

export default function CategoryScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  // Room for the live order pill floating over the end of the list (0 when it isn't here).
  const pillSpace = useLivePillSpace();
  const params = useLocalSearchParams<{ id: string }>();
  const id = firstParam(params.id) ?? '';
  const category = getCategorySync(id);
  const cartCount = useCartCount();

  const vegOnly = useVegOnly();
  const setVegOnly = useFavorites((s) => s.setVegOnly);
  const menu = useAsync(getMenu);
  const all = menu.data ? availableFirst(menu.data.products.filter((p) => p.categoryId === id)) : undefined;
  // The hero describes the whole category; "Veg only" narrows what the chips and grid work on.
  const listed = all ? vegFilter(all, vegOnly) : undefined;
  const filters = listed ? usefulFilters(listed) : [];
  const [filter, setFilter] = useState<ProductFilterId>('all');
  // A filter the veg list no longer offers falls back to everything (no dead "No iced picks" state).
  const activeFilter = filters.some((f) => f.id === filter) ? filter : 'all';
  const shown = listed ? applyFilter(listed, activeFilter) : [];
  const filterLabel = filters.find((f) => f.id === activeFilter)?.label ?? 'matching';
  // While "Veg only" narrows the category, the hero says so and never shows an item it hid.
  const vegNarrowed = !!all && !!listed && listed.length > 0 && listed.length < all.length;
  const signature = categoryImage(id);
  const vegArt = listed?.find((p) => p.isAvailable) ?? listed?.[0];
  const heroImage = vegNarrowed && vegArt && !listed.some((p) => p.image === signature) ? vegArt.image : undefined;
  const heroCaption = vegNarrowed && category ? categorySummary(category, listed, { veg: true }) : undefined;

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.set(e.contentOffset.y);
    },
  });

  const bottomPad = insets.bottom + spacing.xxl + (cartCount > 0 ? FLOATING_CART_BAR_SPACE : 0) + pillSpace;
  const cart = <CartButton />;
  const actions = (
    <View style={styles.actions}>
      <VegOnlyToggle value={vegOnly} onValueChange={setVegOnly} />
      {cart}
    </View>
  );

  if (!category) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 60 }]}>
        <EmptyState
          art="none"
          title="We couldn’t find that category"
          message="It may have moved."
          action={{ label: 'Browse the menu', onPress: browseMenu }}
        />
        <FrostedTopBar title="Menu" scrollY={scrollY} revealFrom={0} revealTo={1} right={cart} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* No scrollEventThrottle: Animated.ScrollView defaults to 1 (every frame, also on 120Hz). */}
      <Animated.ScrollView
        onScroll={onScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
      >
        <CategoryHero
          category={category}
          products={all}
          scrollY={scrollY}
          topInset={insets.top}
          image={heroImage}
          caption={heroCaption}
        />

        {menu.error ? (
          <ErrorState error={menu.error} onRetry={menu.reload} compact style={styles.state} />
        ) : !all ? (
          // Reserve the filter row when one is coming, so the grid doesn't jump when the menu lands.
          expectsFilters(id) ? (
            <>
              <FilterChipsSkeleton style={styles.filters} />
              <ProductGridSkeletons count={4} style={styles.grid} />
            </>
          ) : (
            <ProductGridSkeletons count={4} style={styles.gridFirst} />
          )
        ) : (
          <>
            {listed && listed.length === 0 && all.length > 0 ? (
              // Every item here is egg or non-veg: say so plainly, and offer the way back.
              <EmptyState
                key="no-veg"
                art="none"
                title="No veg items here"
                message={noVegMessage(category.name, all)}
                action={{ label: 'Show all items', onPress: () => setVegOnly(false) }}
                compact
                style={styles.state}
              />
            ) : null}
            {filters.length > 1 ? (
              <Animated.View entering={enterFade(2)}>
                <FilterChipsRow filters={filters} value={activeFilter} onChange={setFilter} style={styles.filters} />
              </Animated.View>
            ) : null}

            {shown.length > 0 ? (
              <ProductGrid products={shown} animateLayout style={filters.length > 1 ? styles.grid : styles.gridFirst} />
            ) : listed && listed.length === 0 && all.length > 0 ? null : all.length === 0 ? (
              <EmptyState
                title="Nothing here today"
                message="Back tomorrow morning."
                action={{ label: 'Browse the menu', onPress: browseMenu }}
                compact
                style={styles.state}
              />
            ) : (
              <EmptyState
                key={activeFilter}
                art="none"
                title={`No ${filterLabel.toLowerCase()} picks today`}
                action={{ label: 'Show everything', onPress: () => setFilter('all') }}
                compact
                style={styles.state}
              />
            )}
          </>
        )}
      </Animated.ScrollView>

      {/* The canvas backdrop arrives as the (dissolved) hero plane's edge reaches the bar. */}
      <FrostedTopBar
        title={category.name}
        scrollY={scrollY}
        revealFrom={70}
        revealTo={130}
        backdropFrom={CATEGORY_PLANE_GONE - 26}
        backdropTo={CATEGORY_PLANE_GONE}
        right={actions}
      />
      <FloatingCartBar bottomOffset={floatingBarBottom(insets.bottom)} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.bg },
  // Chips 20 below the hero plane, then the grid as on Menu.
  filters: { marginTop: spacing.lg },
  grid: { marginTop: spacing.lg },
  gridFirst: { marginTop: spacing.xl },
  state: { marginTop: spacing.md },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
}));
