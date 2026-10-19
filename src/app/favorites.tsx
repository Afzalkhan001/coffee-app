/**
 * Favourites (Profile → Favourites, Home "Your favourites" → See all). The saved products as the
 * Menu's 2-column cut-out grid, most recently saved first, sold-out last. Every tile shows its filled
 * heart: tapping it un-favourites and the grid re-flows with springs. Empty, loading and offline
 * states. Favourites belong to the signed-in number and persist (`ember.favorites.v2`).
 */
import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getMenu } from '@/api';
import { useAsync } from '@/api/hooks';
import { CartButton, EmptyState, ErrorState, FLOATING_CART_BAR_SPACE, FloatingCartBar } from '@/components/domain';
import { favoritePicks, ProductGrid, ProductGridSkeletons } from '@/components/home';
import { useLivePillSpace } from '@/components/order/livePillSpace';
import { Screen, ScreenHeader } from '@/components/ui';
import { useCartCount } from '@/store/cart';
import { useFavoriteIds } from '@/store/favorites';
import { spacing } from '@/theme';

/** Distance from the screen bottom for the floating cart bar on screens without the tab bar. */
const floatingBarBottom = (insetBottom: number) => Math.max(insetBottom, spacing.md) + spacing.xs;
const browseMenu = () => router.navigate('/menu');

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  // Room for the live order pill floating over the end of the list (0 when it isn't here).
  const pillSpace = useLivePillSpace();
  const cartCount = useCartCount();
  const ids = useFavoriteIds();
  const menu = useAsync(getMenu);
  const favorites = menu.data ? favoritePicks(menu.data.products, ids) : undefined;
  const bottomPad = insets.bottom + spacing.xxl + (cartCount > 0 ? FLOATING_CART_BAR_SPACE : 0) + pillSpace;

  return (
    <Screen>
      <ScreenHeader title="Favourites" right={<CartButton />} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPad }}>
        {menu.error ? (
          <ErrorState error={menu.error} onRetry={menu.reload} compact style={styles.state} />
        ) : !favorites ? (
          // Only reserve as many cards as there are favourites (at most two rows), so nothing jumps.
          <ProductGridSkeletons count={Math.min(4, Math.max(2, ids.length + (ids.length % 2)))} style={styles.grid} />
        ) : favorites.length === 0 ? (
          <EmptyState
            title="No favourites yet"
            message="Save items with the heart on their page."
            action={{ label: 'Browse the menu', onPress: browseMenu }}
            style={styles.empty}
          />
        ) : (
          <ProductGrid products={favorites} animateLayout style={styles.grid} />
        )}
      </ScrollView>
      <FloatingCartBar bottomOffset={floatingBarBottom(insets.bottom)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { marginTop: spacing.md },
  state: { marginTop: spacing.md },
  empty: { marginTop: spacing.xxxl },
});
