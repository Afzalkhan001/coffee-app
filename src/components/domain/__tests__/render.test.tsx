/**
 * Render smoke test for the domain kit + splash: every component mounts with real mock data,
 * reacts to store/prop changes and unmounts without throwing. Catches runtime-only mistakes
 * (bad data access, hook order, effects) that the type checker can't see. Not a visual test.
 */
import { Component, type ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { View } from 'react-native';

jest.useFakeTimers();

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({ useIsFocused: () => true, router: { push: jest.fn() } }));
jest.mock('@/lib/haptics', () => {
  const noop = () => {};
  return {
    haptic: { select: noop, tick: noop, toggle: noop, press: noop, land: noop, threshold: noop, longPress: noop, success: noop, warning: noop, error: noop },
    playHaptic: noop,
    configureHaptics: noop,
    hapticsEnabled: () => true,
  };
});
jest.mock('@expo/vector-icons/Ionicons', () => {
  const { Text: RNText } = require('react-native');
  return function MockIonicon({ name }: { name: string }) {
    return <RNText>{name}</RNText>;
  };
});

/* eslint-disable import/first */
import { NetworkError } from '@/api';
import { OverlayHost } from '@/components/motion';
import { AnimatedSplash, useSplashLifted } from '@/components/onboarding/AnimatedSplash';
import { CATEGORIES, PRODUCTS } from '@/data/mock/menu';
import { PROMOTIONS } from '@/data/mock/marketing';
import { quickAddLine } from '../quickAdd';
import { useCart } from '@/store/cart';
import type { Order, OrderStatus, Product } from '@/types/models';
import {
  ArtCluster,
  ArtStack,
  ArtThumb,
  ArtTile,
  Avatar,
  CartButton,
  ContactShadow,
  ProductArt,
  CategoryChips,
  CategoryTile,
  DietaryTags,
  EmptyState,
  ErrorState,
  FloatingCartBar,
  MetaChips,
  ModeCards,
  OrderAgainCard,
  OrderHistoryRow,
  OrderRowSkeleton,
  OrderStatusCard,
  PointsPill,
  PriceText,
  ProductCard,
  ProductGridSkeleton,
  ProductRow,
  ProductRowSkeleton,
  PromoCarousel,
  PromoCarouselSkeleton,
  QuantityStepper,
  SearchBarButton,
  StatusTimeline,
  StoreCard,
  SummaryCard,
} from '../index';
/* eslint-enable import/first */

function flush(ms = 4000) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

/** Render errors are otherwise swallowed by React 19 (the tree just unmounts), so surface them. */
const caught: unknown[] = [];
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    caught.push(error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

afterEach(() => {
  const errors = caught.splice(0);
  expect(errors).toEqual([]);
});

const wrap = (node: ReactNode) => (
  <Boundary>
    <OverlayHost>{node}</OverlayHost>
  </Boundary>
);

function mount(node: ReactNode): ReactTestRenderer {
  let r: ReactTestRenderer | undefined;
  act(() => {
    r = create(wrap(node));
  });
  if (!r) throw new Error('not mounted');
  return r;
}

const product = (i: number): Product => {
  const p = PRODUCTS[i];
  if (!p) throw new Error(`no product ${i}`);
  return p;
};

function makeOrder(status: OrderStatus, mode: Order['details']['mode'] = 'pickup'): Order {
  const p = product(0);
  const at = new Date(2026, 9, 7, 9, 30).toISOString();
  return {
    id: 'ord-1',
    number: 'ER-1042',
    createdAt: at,
    details: { mode },
    items: [
      { id: 'l1', productId: p.id, name: p.name, image: p.image, basePrice: p.price, quantity: 2, modifiers: [], lineTotal: p.price * 2 },
      { id: 'l2', productId: product(1).id, name: product(1).name, image: product(1).image, basePrice: 180, quantity: 1, modifiers: [], lineTotal: 180 },
    ],
    totals: { subtotal: 720, discount: 100, tax: 31, deliveryFee: 0, total: 651 },
    status,
    history: [
      { status: 'placed', at },
      { status: 'accepted', at },
    ],
    paymentStatus: 'paid',
    paymentMethod: 'card',
    customer: { name: 'Ava', phone: '9876543210' },
    etaMinutes: 8,
    pointsEarned: 130,
  };
}

describe('domain components render', () => {
  it('product surfaces mount, quick-add and unmount', () => {
    const food = PRODUCTS.find((p) => quickAddLine(p) !== null);
    expect(food).toBeDefined();
    const r = mount(
      <View>
        <CartButton />
        {PRODUCTS.slice(0, 6).map((p, i) => (
          <ProductCard key={p.id} product={p} index={i} />
        ))}
        <ProductRow product={product(2)} onPress={() => {}} />
        <ProductRow product={{ ...product(3), isAvailable: false }} onPress={() => {}} />
        <FloatingCartBar />
      </View>,
    );
    // Cart changes drive the badge pop, the floating bar and its rolling total.
    act(() => {
      const line = food ? quickAddLine(food) : null;
      if (line) useCart.getState().add(line);
    });
    flush();
    act(() => {
      useCart.getState().clear();
    });
    flush();
    act(() => r.unmount());
  });

  it('"+" on a one-tap product adds it to the cart', async () => {
    const food = PRODUCTS.find((p) => quickAddLine(p) !== null);
    if (!food) throw new Error('no quick-addable product in the mock menu');
    // Braces matter: persisted zustand setters return a promise, which act() would treat as async.
    act(() => {
      useCart.getState().clear();
    });
    const r = mount(<ProductCard product={food} />);
    const plus = r.root.find((n) => n.props.accessibilityLabel === `Add ${food.name} to cart` && typeof n.props.onPress === 'function');
    await act(async () => {
      void plus.props.onPress();
      await jest.advanceTimersByTimeAsync(2000); // measure guard + flight safety net
    });
    flush();
    expect(useCart.getState().items.map((i) => i.productId)).toEqual([food.id]);
    act(() => {
      useCart.getState().clear();
    });
    act(() => r.unmount());
  });

  it('browsing pieces mount and update', () => {
    const onSelect = jest.fn();
    const r = mount(
      <View>
        <SearchBarButton onPress={() => {}} />
        <SearchBarButton onPress={() => {}} placeholder="Search the menu" />
        <CategoryChips categories={CATEGORIES} selectedId="coffee" onSelect={onSelect} counts={{ coffee: 8 }} />
        <CategoryTile category={CATEGORIES[0]!} selected onPress={() => {}} accent="ember" />
        <PromoCarousel promotions={PROMOTIONS} onPress={() => {}} />
        <ModeCards value="pickup" onChange={() => {}} />
        <ModeCards value="delivery" onChange={() => {}} compact />
        <StoreCard />
        <Avatar name="Ava Stone" />
        <PointsPill points={2300} onPress={() => {}} />
        <PointsPill points={150} />
      </View>,
    );
    flush(6000); // rotate the search placeholder
    act(() =>
      r.update(
        wrap(
          <>
            <CategoryChips categories={CATEGORIES} selectedId="desserts" onSelect={onSelect} />
            <ModeCards value="in_car" onChange={() => {}} />
            <PointsPill points={2450} />
          </>,
        ),
      ),
    );
    flush();
    act(() => r.unmount());
  });

  it('detail + cart pieces mount and update', () => {
    const p = product(1);
    const r = mount(
      <View>
        <PriceText price={310} compareAt={340} size={20} />
        <PriceText price={250} />
        <MetaChips product={p} />
        <MetaChips product={p} compact withRating kcal={180} />
        <DietaryTags tags={['vegan', 'gluten_free', 'contains_nuts']} max={2} />
        <DietaryTags tags={[]} />
        <QuantityStepper value={1} onChange={() => {}} size={52} />
        <SummaryCard
          totals={{ subtotal: 460, discount: 100, tax: 18, deliveryFee: 40, total: 418 }}
          itemImages={[p.image, product(2).image, product(3).image, product(4).image]}
          mode="delivery"
        />
      </View>,
    );
    act(() =>
      r.update(
        wrap(
          <>
            <QuantityStepper value={3} onChange={() => {}} />
            <SummaryCard totals={{ subtotal: 1250, discount: 0, tax: 63, deliveryFee: 0, total: 1313 }} mode="pickup" />
          </>,
        ),
      ),
    );
    flush();
    act(() => r.unmount());
  });

  it('order pieces follow status changes', () => {
    const r = mount(
      <View>
        <OrderStatusCard order={makeOrder('accepted')} />
        <StatusTimeline order={makeOrder('accepted')} />
        <OrderHistoryRow order={makeOrder('completed')} onReorder={() => {}} />
        <OrderHistoryRow order={makeOrder('cancelled', 'delivery')} onReorder={() => {}} />
        <OrderAgainCard order={makeOrder('completed')} />
        <OrderAgainCard />
      </View>,
    );
    for (const status of ['preparing', 'ready', 'completed'] as const) {
      act(() =>
        r.update(
          wrap(
            <>
              <OrderStatusCard order={makeOrder(status)} />
              <StatusTimeline order={makeOrder(status)} />
            </>,
          ),
        ),
      );
      flush(1000);
    }
    act(() =>
      r.update(
        wrap(
          <>
            <StatusTimeline order={makeOrder('cancelled', 'delivery')} />
          </>,
        ),
      ),
    );
    flush();
    act(() => r.unmount());
  });

  it('R3 art kit mounts: cut-outs, remote fallback, float, clusters and the dock card', () => {
    const p = product(0);
    const r = mount(
      <View>
        <ProductArt image={p.image} size={136} />
        <ProductArt image={p.image} size={200} float floatPhase={0.4} shadow="hero" />
        <ProductArt image="https://example.com/remote.jpg" size={64} />
        <ProductArt image={undefined} size={40} shadow={false} />
        <ContactShadow box={120} tone="dark" />
        <ArtTile image={p.image} width={168} height={176} artBottom={6} artOpacity={0.45}>
          <View />
        </ArtTile>
        <ArtThumb image={product(3).image} />
        <ArtStack images={[p.image, product(1).image, p.image]} size={64} overlap={22} />
        <ArtCluster
          images={[p.image, product(1).image, product(2).image, product(3).image]}
          layout={[
            { size: 100, x: 0, y: 0, rotate: -10 },
            { size: 96, x: 60, y: 10, rotate: 8 },
            { size: 88, x: 120, y: 20 },
          ]}
          float
        />
        <SummaryCard
          variant="dock"
          totals={{ subtotal: 460, discount: 46, tax: 21, deliveryFee: 40, total: 475 }}
          itemImages={[p.image, product(1).image]}
          mode="delivery"
        />
        <OrderStatusCard order={makeOrder('preparing')} variant="compact" more={2} />
        <OrderStatusCard order={makeOrder('preparing', 'delivery')} variant="light" />
        <OrderHistoryRow order={makeOrder('completed')} onReorder={() => {}} divider />
        <ProductRow product={product(5)} onPress={() => {}} divider />
        <EmptyState art="plate" title="Your cart is empty" />
        <EmptyState art="none" title="Nothing for “zzzz”" />
      </View>,
    );
    // A removed line's cut-out leaves the dock cluster; the total rolls.
    act(() =>
      r.update(
        wrap(
          <SummaryCard
            variant="dock"
            totals={{ subtotal: 290, discount: 0, tax: 15, deliveryFee: 0, total: 305 }}
            itemImages={[p.image]}
          />,
        ),
      ),
    );
    flush();
    act(() => r.unmount());
  });

  it('money reads in rupees with GST (INR)', () => {
    const r = mount(
      <View>
        <PriceText price={310} compareAt={340} />
        <SummaryCard totals={{ subtotal: 1250, discount: 100, tax: 58, deliveryFee: 0, total: 1208 }} mode="pickup" />
      </View>,
    );
    flush();
    const json = JSON.stringify(r.toJSON());
    expect(json).toContain('₹310');
    expect(json).toContain('₹340');
    expect(json).toContain('₹1,250');
    expect(json).toContain('−₹100');
    expect(json).toContain('GST (5%)');
    expect(json).toContain('Total ₹1,208');
    expect(json).not.toContain('$');
    act(() => r.unmount());
  });

  it('states and skeletons mount', () => {
    const r = mount(
      <View>
        <EmptyState art="bag" title="Your cart is empty" message="Add something warm." action={{ label: 'Browse menu', onPress: () => {} }} />
        <EmptyState art="beans" title="No results" compact />
        <ErrorState error={new NetworkError()} onRetry={() => {}} />
        <ErrorState error={new Error('Boom')} onRetry={() => {}} compact />
        <ProductGridSkeleton count={2} />
        <ProductRowSkeleton />
        <PromoCarouselSkeleton />
        <OrderRowSkeleton />
      </View>,
    );
    flush();
    act(() => r.unmount());
  });
});

describe('AnimatedSplash', () => {
  it('plays its timeline, lifts the gate, then calls onFinish once', () => {
    const onFinish = jest.fn();
    const seen: boolean[] = [];
    function GateProbe() {
      seen.push(useSplashLifted());
      return null;
    }
    const r = mount(
      <>
        <GateProbe />
        <AnimatedSplash onFinish={onFinish} />
      </>,
    );
    expect(seen[0]).toBe(false);
    flush(1000);
    expect(onFinish).not.toHaveBeenCalled();
    flush(2000);
    expect(seen[seen.length - 1]).toBe(true);
    expect(onFinish).toHaveBeenCalledTimes(1);
    act(() => r.unmount());
  });
});
