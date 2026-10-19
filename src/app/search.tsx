/**
 * Search (DESIGN.md §R3.B Search, ref 3 search bar). Autofocused flat pill input with back + cart;
 * recent and popular text chips plus "Popular this week" when idle; debounced results in one white
 * sheet that re-flows with springs and highlights the matched words; a quiet "Nothing for …" state
 * that keeps selling (suggestions + a "Popular right now" rail); offline state. The results row
 * carries the "Veg only" switch (shared with Menu and Category); with it on, lists keep veg items only.
 */
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type TextInput } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getMenu } from '@/api';
import { useAsync } from '@/api/hooks';
import {
  CartButton,
  EmptyState,
  ErrorState,
  FLOATING_CART_BAR_SPACE,
  FloatingCartBar,
  openProduct,
  PRODUCT_ROW_TEXT_INSET,
  ProductRow,
  ProductRowSkeleton,
} from '@/components/domain';
import { vegFilter } from '@/components/domain/VegMark';
import {
  HomeSection,
  popularPicks,
  PopularRightNow,
  SearchField,
  SearchResultRow,
  searchTerms,
  useKeyboardVisible,
  useProductSearch,
  vegHiddenReason,
  VegOnlyToggle,
} from '@/components/home';
import { enterFade, layoutSpring } from '@/components/motion';
import { useLivePillSpace } from '@/components/order/livePillSpace';
import { Chip, CircleButton, Icon, KeyboardAvoider, PillButton, PressableScale, Text, useKeyboardAfterTransition } from '@/components/ui';
import { useCartCount } from '@/store/cart';
import { useFavorites, useVegOnly } from '@/store/favorites';
import { useSession } from '@/store/session';
import { fonts, layout, makeStyles, radii, spacing, useColors } from '@/theme';
import type { Product } from '@/types/models';

/** R3.A7: at most 6 popular and 3 recent chips, text only. */
const POPULAR_SEARCHES = ['Latte', 'Cold brew', 'Croissant', 'Matcha', 'Dairy-free', 'Cheesecake'] as const;
const MAX_RECENT = 3;
const NO_MATCH_SUGGESTIONS = ['Latte', 'Iced', 'Croissant', 'Matcha'] as const;
/** Distance from the screen bottom for the floating cart bar on screens without the tab bar. */
const floatingBarBottom = (insetBottom: number) => Math.max(insetBottom, spacing.md) + spacing.xs;

const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

export default function SearchScreen() {
  const c = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  // Room for the live order pill floating over the end of the list (0 when it isn't here).
  const pillSpace = useLivePillSpace();
  const [query, setQuery] = useState('');
  const search = useProductSearch(query);
  const terms = search.partialTerms ?? searchTerms(search.query);
  const keyboardVisible = useKeyboardVisible();
  const cartCount = useCartCount();
  const inputRef = useRef<TextInput>(null);
  // Android: autoFocus fires at the start of the fade; make sure the keyboard is up once it ends.
  useKeyboardAfterTransition(inputRef);
  // Fetched once for the idle "Popular this week" rows (kept across query edits; hidden if it fails).
  const vegOnly = useVegOnly();
  const setVegOnly = useFavorites((s) => s.setVegOnly);
  const menu = useAsync(getMenu);
  const popularAll = menu.data ? vegFilter(popularPicks(menu.data.products), vegOnly) : undefined;
  const popular = popularAll ? popularAll.slice(0, 4) : menu.error ? null : undefined;

  const recent = useSession((s) => s.recentSearches);
  const pushRecentSearch = useSession((s) => s.pushRecentSearch);
  const clearRecentSearches = useSession((s) => s.clearRecentSearches);

  const remember = () => {
    if (query.trim()) pushRecentSearch(query.trim());
  };
  const runSuggestion = (term: string) => {
    setQuery(term);
    pushRecentSearch(term);
  };
  const openResult = (product: Product) => {
    remember();
    openProduct(product.id);
  };

  const idle = query.trim().length === 0;
  const bottomPad = insets.bottom + spacing.xxl + (cartCount > 0 ? FLOATING_CART_BAR_SPACE : 0) + pillSpace;
  const results = vegFilter(search.results, vegOnly);
  const count = results.length;
  /** Matches "Veg only" set aside (shown again with one tap). */
  const hiddenByVeg = search.results.filter((p) => !results.includes(p));
  const resultsLabel = search.partialTerms
    ? `No exact matches for “${search.query}”. Showing ${search.partialTerms.map((t) => `“${t}”`).join(' or ')}`
    : count === 0
      ? 'No veg results'
      : `${count} ${vegOnly ? 'veg ' : ''}${count === 1 ? 'result' : 'results'}`;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Animated.View entering={enterFade(0)} style={styles.header}>
        <CircleButton icon="chevron-back" size={layout.headerButton} onPress={goBack} accessibilityLabel="Go back" />
        <SearchField
          ref={inputRef}
          value={query}
          onChangeText={setQuery}
          onSubmit={remember}
          autoFocus
          style={styles.field}
        />
        <CartButton />
      </Animated.View>

      {/* Android edge-to-edge: results shrink above the keyboard, so the last rows stay reachable. */}
      <KeyboardAvoider>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottomPad }}
        >
          {idle ? (
            <IdleSuggestions
              recent={recent.slice(0, MAX_RECENT)}
              popular={popular}
              onPick={runSuggestion}
              onClearRecent={clearRecentSearches}
              onOpenProduct={(p) => openProduct(p.id)}
            />
          ) : search.error && !search.pending ? (
            <ErrorState error={search.error} onRetry={search.retry} compact style={styles.state} />
          ) : search.results.length === 0 ? (
            search.pending ? (
              <View style={[styles.sheet, styles.resultsSheet]} accessibilityLabel="Searching" accessible>
                {[0, 1, 2].map((i) => (
                  <ProductRowSkeleton key={i} />
                ))}
              </View>
            ) : (
              <NoMatches query={search.query} onPick={runSuggestion} popular={popularAll} />
            )
          ) : (
            <View>
              <Animated.View entering={enterFade(0)} style={styles.resultsHeader}>
                <Text style={styles.resultsCount} color={c.inkSoft} accessibilityLiveRegion="polite">
                  {resultsLabel}
                </Text>
                <VegOnlyToggle value={vegOnly} onValueChange={setVegOnly} size="sm" />
              </Animated.View>
              {count === 0 ? (
                // Everything that matched is egg or non-veg: say so, and offer the one-tap way back.
                <Animated.View entering={enterFade(1)} style={styles.vegEmpty}>
                  <Text style={styles.vegEmptyText} color={c.inkSoft} align="center">
                    {vegHiddenReason(hiddenByVeg)}
                  </Text>
                  <PillButton label="Show all results" size="sm" onPress={() => setVegOnly(false)} style={styles.vegEmptyAction} />
                </Animated.View>
              ) : null}
              {/* One white sheet; rows keep their keys so a new query re-flows them with springs. */}
              <Animated.View layout={layoutSpring} style={[styles.sheet, count === 0 ? styles.hidden : null]}>
                <Animated.View
                  style={{
                    opacity: search.pending ? 0.55 : 1,
                    transitionProperty: 'opacity',
                    transitionDuration: 180,
                  }}
                >
                  {results.map((product, i) => (
                    <SearchResultRow key={product.id} product={product} terms={terms} index={i} onOpen={openResult} divider={i > 0} />
                  ))}
                </Animated.View>
              </Animated.View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoider>

      {keyboardVisible ? null : <FloatingCartBar bottomOffset={floatingBarBottom(insets.bottom)} />}
    </View>
  );
}

// ── idle: recent, popular searches, popular products ─────────

function IdleSuggestions({
  recent,
  popular,
  onPick,
  onClearRecent,
  onOpenProduct,
}: {
  recent: string[];
  /** Products for "Popular this week": undefined while loading, null when unavailable. */
  popular: Product[] | null | undefined;
  onPick: (term: string) => void;
  onClearRecent: () => void;
  onOpenProduct: (product: Product) => void;
}) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View>
      {recent.length > 0 ? (
        <HomeSection
          index={1}
          title="Recent"
          size="label"
          action={{ label: 'Clear', onPress: onClearRecent, accessibilityLabel: 'Clear recent searches', role: 'button' }}
          style={styles.firstSection}
        >
          <View style={styles.chips}>
            {recent.map((term) => (
              <Chip key={term} label={term} onPress={() => onPick(term)} />
            ))}
          </View>
        </HomeSection>
      ) : null}

      <HomeSection index={2} title="Popular" size="label" style={recent.length > 0 ? styles.chipSection : styles.firstSection}>
        <View style={styles.chips}>
          {POPULAR_SEARCHES.map((term) => (
            <Chip key={term} label={term} onPress={() => onPick(term)} />
          ))}
        </View>
      </HomeSection>

      {popular === null ? null : (
        <HomeSection index={3} title="Popular this week" childrenAnimate>
          <View style={styles.sheetFlat}>
            {popular
              ? popular.map((product, i) => (
                  <ProductRow key={product.id} product={product} index={i + 3} onPress={onOpenProduct} divider={i > 0} />
                ))
              : [0, 1, 2].map((i) => <ProductRowSkeleton key={i} />)}
            {popular ? (
              // Four rows, then the way into everything else (a text row aligned with the names above).
              <Animated.View entering={enterFade(4)}>
                <View style={styles.browseDivider} />
                <PressableScale
                  onPress={() => router.navigate('/menu')}
                  activeScale={0.98}
                  style={styles.browseRow}
                  accessibilityRole="link"
                  accessibilityLabel="Browse the menu"
                >
                  <Text style={styles.browseLabel}>Browse the menu</Text>
                  <Icon name="chevron-forward" size={18} color={c.inkMuted} />
                </PressableScale>
              </Animated.View>
            ) : null}
          </View>
        </HomeSection>
      )}
    </View>
  );
}

// ── no matches ───────────────────────────────────────────────

function NoMatches({
  query,
  onPick,
  popular,
}: {
  query: string;
  onPick: (term: string) => void;
  /** The screen's popular picks for the rail (hidden while the menu is unavailable). */
  popular: Product[] | undefined;
}) {
  const styles = useStyles();
  return (
    <EmptyState
      art="none"
      title={`Nothing for “${query}”`}
      message="Try another word or browse the menu."
      action={{ label: 'Browse the menu', onPress: () => router.navigate('/menu') }}
      compact
      style={styles.state}
    >
      {/* EmptyState pads its copy by 32px: the rows below reach back out to the screen gutter. */}
      <View style={styles.bleed}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionRow}>
          {NO_MATCH_SUGGESTIONS.map((term) => (
            <Chip key={term} label={term} onPress={() => onPick(term)} />
          ))}
        </ScrollView>
        {popular ? <PopularRightNow products={popular} style={styles.popularRail} /> : null}
      </View>
    </EmptyState>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  field: { flex: 1 },
  firstSection: { marginTop: spacing.md },
  chipSection: { marginTop: spacing.xl },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  // R3.A10: one list = one white sheet (r28, no shadow, no border).
  sheet: { backgroundColor: c.surface, borderRadius: radii.lg, marginHorizontal: spacing.gutter, overflow: 'hidden' },
  sheetFlat: { backgroundColor: c.surface, borderRadius: radii.lg, overflow: 'hidden' },
  browseDivider: {
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: c.line,
    marginLeft: PRODUCT_ROW_TEXT_INSET,
    marginRight: spacing.md,
  },
  browseRow: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: PRODUCT_ROW_TEXT_INSET,
    paddingRight: spacing.md,
  },
  browseLabel: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: c.ink },
  resultsSheet: { marginTop: spacing.md },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.gutter + 4,
    paddingRight: spacing.gutter,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  resultsCount: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  vegEmpty: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xl, paddingHorizontal: spacing.xxl },
  vegEmptyText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  vegEmptyAction: { alignSelf: 'center' },
  hidden: { display: 'none' },
  state: { marginTop: spacing.sm },
  bleed: { marginHorizontal: -spacing.xxl },
  suggestionRow: { paddingHorizontal: spacing.gutter, gap: spacing.xs, paddingVertical: 2, flexGrow: 1, justifyContent: 'center' },
  popularRail: { marginTop: spacing.xxl },
}));
