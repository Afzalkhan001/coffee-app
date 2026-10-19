/**
 * Menu (DESIGN.md §R3.B Menu, ref 2). Fixed "MENU" header with search + cart over a faint serif
 * "Ember Roast" watermark that scrolls away, the 60px gradient store row (its ink "Pickup ⌄" pill
 * opens the mode sheet), sticky frosted text chips, then every category as a "Coffee 8" section with
 * a 2-column grid of cut-out cards — food in the first viewport. Tapping a chip smooth-scrolls to its
 * section; scrolling moves the chip selection (scroll-spy). The header's "Veg only" switch keeps just
 * the veg-marked items (categories without any drop out, named in a quiet note at the end).
 */
import { router, useLocalSearchParams, useScrollToTop } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getMenu } from '@/api';
import { useAsync } from '@/api/hooks';
import {
  CartButton,
  CategoryChips,
  COMPACT_SCREEN_HEIGHT,
  ErrorState,
  FLOATING_CART_BAR_SPACE,
  FloatingCartBar,
  StoreCard,
} from '@/components/domain';
import { vegFilter } from '@/components/domain/VegMark';
import {
  availableFirst,
  MenuChipsSkeleton,
  MenuSection,
  MenuSectionSkeleton,
  useScrollSpy,
  vegHiddenCategoriesNote,
  VegOnlyToggle,
} from '@/components/home';
import { enterFade, enterUp, FrostedLayer, withAlpha } from '@/components/motion';
import { useTabBarSpace } from '@/components/navigation/TabBar';
import { useLivePillSpace } from '@/components/order/livePillSpace';
import { CircleButton, PressableScale, Text } from '@/components/ui';
import { MODE_META } from '@/lib/orderFlow';
import { useCartCount } from '@/store/cart';
import { useFavorites, useVegOnly } from '@/store/favorites';
import { useSession } from '@/store/session';
import { fonts, layout, makeStyles, spacing, type as typeScale, useColors } from '@/theme';
import { brand } from '@/theme/brand';
import type { Category, Product } from '@/types/models';

/** Sticky chip bar: 40px chips + 8px above and below. */
const CHIPS_BAR = 56;
/**
 * Sections mounted (and animated) with the first paint; the rest mount one per frame afterwards
 * without entrances, so the first Menu visit never lands ~27 animations in a single frame.
 */
const FIRST_SECTIONS = 2;

interface Section {
  category: Category;
  products: Product[];
}

function buildSections(categories: Category[], products: Product[]): Section[] {
  return categories
    .map((category) => ({ category, products: availableFirst(products.filter((p) => p.categoryId === category.id)) }))
    .filter((s) => s.products.length > 0);
}

const firstParam = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const STICKY_CHIPS = [1];

export default function MenuScreen() {
  const c = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  // Short phones: tighter gaps above the first section, so its first row clears the View cart bar.
  const compact = useWindowDimensions().height < COMPACT_SCREEN_HEIGHT;
  const tabSpace = useTabBarSpace();
  const pillSpace = useLivePillSpace();
  const cartCount = useCartCount();
  const params = useLocalSearchParams<{ category?: string }>();
  const requestedCategory = firstParam(params.category);

  const mode = useSession((s) => s.mode);
  const vegOnly = useVegOnly();
  const setVegOnly = useFavorites((s) => s.setVegOnly);
  const menu = useAsync(getMenu);
  const sections = menu.data ? buildSections(menu.data.categories, vegFilter(menu.data.products, vegOnly)) : [];
  const counts = Object.fromEntries(sections.map((s) => [s.category.id, s.products.length]));
  // Categories "Veg only" emptied (they have items, none of them veg): named in the closing note.
  const hiddenNames =
    menu.data && vegOnly
      ? buildSections(menu.data.categories, menu.data.products)
          .filter((s) => !sections.some((v) => v.category.id === s.category.id))
          .map((s) => s.category.name)
      : [];
  /** Section keys change with the filter: every section remounts and re-measures for the scroll-spy. */
  const sectionKey = vegOnly ? 'veg' : 'all';

  const [mountedCount, setMountedCount] = useState(FIRST_SECTIONS);
  useEffect(() => {
    if (!menu.data || mountedCount >= sections.length) return;
    const frame = requestAnimationFrame(() => setMountedCount((n) => n + 1));
    return () => cancelAnimationFrame(frame);
  }, [menu.data, mountedCount, sections.length]);

  const [viewportHeight, setViewportHeight] = useState(0);
  // A section takes the chip once its header crosses 40% of the list viewport (not the sticky line).
  const { scrollRef, scrollY, onScroll, activeIndex, registerSection, scrollToSection, scrollToTop, lastSectionHeight } =
    useScrollSpy({ stickyOffset: CHIPS_BAR, count: sections.length, probeOffset: Math.round(viewportHeight * 0.4) });
  /** Content y where the chip bar starts (= bottom of the store block); its backdrop fades in there. */
  const chipsTop = useSharedValue(0);

  // The chips' frosted layer fades in as the bar sticks.
  const chipsFrost = useDerivedValue(() => {
    const top = chipsTop.get();
    return interpolate(scrollY.get(), [top - 12, top], [0, 1], Extrapolation.CLAMP);
  });
  // The watermark rides with the content, so it scrolls away under the fixed header.
  const watermarkStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -Math.max(0, scrollY.get()) }] }));
  // Hairline under the header while the store block slides beneath it; the stuck chips take over after.
  const headerLineStyle = useAnimatedStyle(() => {
    const y = scrollY.get();
    const top = chipsTop.get();
    const appear = interpolate(y, [0, 12], [0, 1], Extrapolation.CLAMP);
    const handOff = interpolate(y, [top - 12, top], [1, 0], Extrapolation.CLAMP);
    return { opacity: Math.min(appear, handOff) };
  });

  // Re-tapping the Menu tab scrolls back to the top.
  const scrollTopTarget = useRef({ scrollTo: (_options: { y?: number; animated?: boolean }) => scrollToTop() });
  useScrollToTop(scrollTopTarget);

  // Deep link from Home ("Fresh from the oven · See all" → /menu?category=bakery): jump once laid out.
  const layoutReady = lastSectionHeight > 0;
  useEffect(() => {
    if (!requestedCategory || !layoutReady) return;
    const index = sections.findIndex((s) => s.category.id === requestedCategory);
    if (index >= 0) scrollToSection(index);
    router.setParams({ category: undefined });
    // Runs when a new category is requested or once layout is ready; the helpers it calls are stable.
  }, [requestedCategory, layoutReady]);

  const changeVegOnly = (next: boolean) => {
    setVegOnly(next);
    // The sections remount (new keys): mount them progressively again, and if the list was scrolled
    // into the sections, land on the first one under the chips rather than mid-way into new content.
    setMountedCount(FIRST_SECTIONS);
    if (scrollY.get() > chipsTop.get()) scrollToSection(0);
  };

  const selectChip = (id: string) => {
    const index = sections.findIndex((s) => s.category.id === id);
    if (index >= 0) scrollToSection(index);
  };

  const bottomPad = tabSpace + (cartCount > 0 ? FLOATING_CART_BAR_SPACE : 0) + pillSpace;
  // Let the last section scroll all the way up under the chips, so every chip tap lands its section.
  const endSpacer = Math.max(bottomPad, viewportHeight - CHIPS_BAR - lastSectionHeight);
  const activeId = sections[activeIndex]?.category.id;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Ref 2's faint serif watermark: behind everything, clipped by the screen edge, hidden from screen readers. */}
      <Animated.View
        entering={enterFade(0)}
        style={[styles.watermark, { top: insets.top - 18 }, watermarkStyle]}
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text style={styles.watermarkText} numberOfLines={1}>
          {brand.name}
        </Text>
      </Animated.View>

      <View style={styles.header}>
        <Animated.View entering={enterUp(0)} style={styles.titleWrap}>
          <Text variant="screenTitle" accessibilityRole="header">
            Menu
          </Text>
        </Animated.View>
        <Animated.View entering={enterUp(1)} style={styles.headerActions}>
          <VegOnlyToggle value={vegOnly} onValueChange={changeVegOnly} />
          <CircleButton icon="search" size={layout.headerButton} onPress={() => router.push('/search')} accessibilityLabel="Search the menu" />
          <CartButton />
        </Animated.View>
        <Animated.View style={[styles.headerLine, headerLineStyle]} />
      </View>

      {/*
        stickyHeaderIndices stays constant: toggling it re-keys every child (sticky wrapping), which
        remounted the store row and replayed its entrance as a blank flash when the menu arrived.
        Child 1 is the chips slot in every state (skeleton, an empty slot while offline, or the chips).
        No scrollEventThrottle: Animated.ScrollView defaults to 1 (every frame, also on 120Hz).
      */}
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        stickyHeaderIndices={STICKY_CHIPS}
        showsVerticalScrollIndicator={false}
        onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
      >
        {/* 0 · store + ordering mode (one 64px row) */}
        <View
          style={[styles.storeBlock, compact ? styles.storeBlockCompact : null]}
          onLayout={(e) => chipsTop.set(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}
        >
          <Animated.View entering={enterUp(2)}>
            <StoreCard compact modeLabel={MODE_META[mode].label} />
          </Animated.View>
        </View>

        {/* 1 · sticky chips (or their placeholder; an empty slot while offline, so the error never sticks) */}
        {menu.data ? (
          <View style={styles.chipsBar}>
            <FrostedLayer progress={chipsFrost} />
            <CategoryChips
              categories={sections.map((s) => s.category)}
              selectedId={activeId}
              onSelect={selectChip}
              counts={counts}
              contentContainerStyle={styles.chipsContent}
            />
          </View>
        ) : menu.error ? (
          <View />
        ) : (
          <MenuChipsSkeleton />
        )}

        {/* 2… · sections */}
        {menu.data
          ? sections.slice(0, mountedCount).map((section, i) => (
              <MenuSection
                key={`${section.category.id}:${sectionKey}`}
                category={section.category}
                products={section.products}
                onLayout={registerSection(i)}
                animateEntrance={i < FIRST_SECTIONS}
                style={i === 0 ? (compact ? styles.firstSectionCompact : styles.firstSection) : undefined}
              />
            ))
          : null}
        {menu.data && hiddenNames.length > 0 && mountedCount >= sections.length ? (
          <Animated.View entering={enterFade(1)} style={styles.vegNote}>
            <Text style={styles.vegNoteText} color={c.inkSoft} align="center">
              {vegHiddenCategoriesNote(hiddenNames, sections.length)}
            </Text>
            <PressableScale
              onPress={() => changeVegOnly(false)}
              activeScale={0.95}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Show all items"
              style={styles.vegNoteAction}
            >
              <Text style={styles.vegNoteActionText}>Show all items</Text>
            </PressableScale>
          </Animated.View>
        ) : null}
        {menu.error && !menu.data ? <ErrorState error={menu.error} onRetry={menu.reload} compact /> : null}
        {!menu.data && !menu.error ? <MenuSectionSkeleton count={6} style={compact ? styles.firstSectionCompact : styles.firstSection} /> : null}

        <View style={{ height: menu.data ? endSpacer : bottomPad }} />
      </Animated.ScrollView>

      <FloatingCartBar />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  // Clips the watermark at the screen edge.
  root: { flex: 1, backgroundColor: c.bg, overflow: 'hidden' },
  // "Ember" reads in the gap between MENU and the header circles.
  watermark: { position: 'absolute', left: 120, width: 720, pointerEvents: 'none' },
  watermarkText: { ...typeScale.watermark, color: withAlpha(c.ink, 0.06) },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 60,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  headerLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.line,
  },
  titleWrap: { flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  storeBlock: { paddingHorizontal: spacing.gutter, paddingTop: spacing.xs, paddingBottom: spacing.sm },
  storeBlockCompact: { paddingTop: spacing.xxs, paddingBottom: spacing.xxs },
  chipsBar: { height: CHIPS_BAR, justifyContent: 'center' },
  chipsContent: { paddingVertical: spacing.xs },
  firstSection: { paddingTop: spacing.md },
  vegNote: { alignItems: 'center', gap: spacing.xxs, paddingTop: spacing.xxl, paddingHorizontal: spacing.xxl },
  vegNoteText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  vegNoteAction: { minHeight: 32, justifyContent: 'center', paddingHorizontal: spacing.xs },
  vegNoteActionText: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18, color: c.ink },
  firstSectionCompact: { paddingTop: spacing.xs },
}));
