import { View, type StyleProp, type ViewStyle } from 'react-native';
import { getMenu } from '@/api';
import { useAsync } from '@/api/hooks';
import { popularPicks } from './homeData';
import { SectionTitle } from './HomeSection';
import { ProductRail } from './ProductRail';
import type { Product } from '@/types/models';

export interface PopularRightNowProps {
  /**
   * Horizontal padding of the parent to bleed out of, so the rail runs edge to edge in the 20px
   * gutter (EmptyState pads its copy by 32).
   */
  bleed?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * "Popular right now": an h2 over a rail of R3 product cards, so a dead end keeps selling (search
 * with no matches, the empty cart). Pass `products` when the screen already has the menu; without
 * them it fetches the menu itself. Renders nothing until there are products (or when the menu is
 * unavailable).
 */
export function PopularRightNow({ products, ...rest }: PopularRightNowProps & { products?: Product[] }) {
  if (products) return <PopularRail products={products} {...rest} />;
  return <FetchedPopularRail {...rest} />;
}

function FetchedPopularRail(props: PopularRightNowProps) {
  const menu = useAsync(getMenu);
  return <PopularRail products={menu.data ? popularPicks(menu.data.products) : []} {...props} />;
}

function PopularRail({ products, bleed = 0, style }: PopularRightNowProps & { products: Product[] }) {
  if (products.length === 0) return null;
  return (
    <View style={[{ marginHorizontal: -bleed }, style]}>
      <SectionTitle title="Popular right now" />
      <ProductRail products={products} accessibilityLabel="Popular right now" animateEntrance={false} />
    </View>
  );
}
