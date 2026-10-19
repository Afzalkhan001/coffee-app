/**
 * Dark mode coverage for the SHARED kit (DESIGN.md §R4): every ui / domain / motion / invoice
 * component mounts under `<ThemeProvider preference="dark">` and no light-only colour leaks into
 * what it renders (a static `colors.*` left behind would show up here as a cream plane, a light
 * hairline or a light tile). The same tree in light still renders the R3 values.
 */
import { Component, type ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { View } from 'react-native';
import { makeMutable } from 'react-native-reanimated';

jest.useFakeTimers();

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({ useIsFocused: () => true, router: { push: jest.fn(), canGoBack: () => true, back: jest.fn() } }));
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
import { buildInvoice } from '@/components/invoice/invoice';
import { InvoiceSheet } from '@/components/invoice/InvoiceSheet';
import { AnimatedCheck, MorphPayButton, OverlayHost, PageDots, RollingNumber, Skeleton } from '@/components/motion';
import {
  Badge,
  Card,
  Chip,
  CircleButton,
  Divider,
  ListRow,
  PillButton,
  PrimaryBar,
  Screen,
  ScreenHeader,
  SectionHeader,
  SectionLabel,
  Sheet,
  SplitTitle,
  Text,
  TextField,
  type BadgeTone,
  type CircleTone,
  type PillTone,
} from '@/components/ui';
import { CATEGORIES, PRODUCTS } from '@/data/mock/menu';
import { PROMOTIONS } from '@/data/mock/marketing';
import { useCart } from '@/store/cart';
import { darkColors, lightBoxShadows, lightColors, lightHeroTints, lightTileTints, ThemeProvider, themeFor, type AppearancePreference } from '@/theme';
import type { Order, OrderStatus, Product } from '@/types/models';
import { BadgeSticker, SoldOutOverlay } from '../ProductBadges';
import { FavoriteButton } from '../FavoriteButton';
import { VegMark } from '../VegMark';
import { quickAddLine } from '../quickAdd';
import {
  ArtTile,
  ArtThumb,
  Avatar,
  CartButton,
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
  PromoCarousel,
  QuantityStepper,
  QuickAddButton,
  SearchBarButton,
  StatusTimeline,
  StoreCard,
  SummaryCard,
} from '../index';
/* eslint-enable import/first */

function flush(ms = 3000) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

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
  expect(caught.splice(0)).toEqual([]);
});

function mount(preference: AppearancePreference, node: ReactNode): ReactTestRenderer {
  let r: ReactTestRenderer | undefined;
  act(() => {
    r = create(
      <Boundary>
        <ThemeProvider preference={preference}>
          <OverlayHost>{node}</OverlayHost>
        </ThemeProvider>
      </Boundary>,
    );
  });
  if (!r) throw new Error('not mounted');
  flush();
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
    id: `ord-${status}-${mode}`,
    number: 'ER-1042',
    createdAt: at,
    details: { mode },
    items: [
      { id: 'l1', productId: p.id, name: p.name, image: p.image, basePrice: p.price, quantity: 2, modifiers: [], lineTotal: p.price * 2 },
      { id: 'l2', productId: product(1).id, name: product(1).name, image: product(1).image, basePrice: 180, quantity: 1, modifiers: [], lineTotal: 180 },
    ],
    totals: { subtotal: 720, discount: 100, packaging: 15, tax: 32, deliveryFee: 0, total: 667 },
    status,
    history: [
      { status: 'placed', at },
      { status: 'accepted', at },
    ],
    paymentStatus: status === 'completed' ? 'paid' : 'paid',
    paymentMethod: 'card',
    customer: { name: 'Ava', phone: '9876543210' },
    etaMinutes: 8,
    pointsEarned: 130,
  };
}

const CIRCLE_TONES: CircleTone[] = ['white', 'ink', 'glass', 'cream', 'ghost', 'canvas', 'frost'];
const PILL_TONES: PillTone[] = ['ink', 'white', 'outline', 'muted', 'ember', 'sage', 'cream'];
const BADGE_TONES: BadgeTone[] = ['ember', 'sage', 'roast', 'ink', 'cream', 'outline', 'danger'];

/** The whole shared kit, in one tree. */
function Kit() {
  const p = product(0);
  const progress = makeMutable(0.4);
  return (
    <View>
      {/* ui */}
      <Screen>
        <ScreenHeader title="Cart" subtitle="Two lines" right={<CartButton />} />
        <ScreenHeader title="Track order" centerTitle />
        <ScreenHeader title="Settings" layout="stacked" subtitle="Quiet" />
        <Text>Default ink</Text>
        <SplitTitle>Caramel Macchiato</SplitTitle>
        {CIRCLE_TONES.map((tone) => (
          <CircleButton key={tone} icon="close" tone={tone} accessibilityLabel={tone} shadow />
        ))}
        {PILL_TONES.map((tone) => (
          <PillButton key={tone} label={tone} tone={tone} />
        ))}
        <PrimaryBar label="Checkout" />
        <PrimaryBar label="Add" disabled hint="Choose a size to continue" />
        <PrimaryBar label="Track order" tone="white" />
        <PrimaryBar label="Track order" tone="white" disabled />
        <Card>
          <Text>Card</Text>
        </Card>
        <Card tone="alt">
          <Text>Alt</Text>
        </Card>
        <Chip label="Latte" />
        <Chip label="Latte" selected />
        <Chip label="9:30" tone="filled" selected icon="time" />
        <Chip label="9:45" tone="filled" />
        {BADGE_TONES.map((tone) => (
          <Badge key={tone} label={tone} tone={tone} icon="checkmark" />
        ))}
        <Divider />
        <SectionHeader title="Popular" action="See all" />
        <SectionLabel>Preferences</SectionLabel>
        <Sheet>
          <ListRow title="Haptics" value="On" onPress={() => {}} />
          <ListRow title="Help" subtitle="FAQ" icon="help" onPress={() => {}} />
          <ListRow title="Log out" danger center onPress={() => {}} />
        </Sheet>
        <TextField label="Name" placeholder="Your name" hint="As on your ID" />
        <TextField label="Email" error="Check the address" value="ava@" />
      </Screen>

      {/* domain */}
      {PRODUCTS.slice(0, 4).map((x, i) => (
        <ProductCard key={x.id} product={x} index={i} width={168} />
      ))}
      <ProductRow product={product(5)} onPress={() => {}} divider />
      <ProductRow product={{ ...product(6), isAvailable: false }} onPress={() => {}} />
      {CATEGORIES.slice(0, 3).map((cat, i) => (
        <CategoryTile key={cat.id} category={cat} selected={i === 0} onPress={() => {}} />
      ))}
      <CategoryChips categories={CATEGORIES} selectedId={CATEGORIES[1]?.id} onSelect={() => {}} />
      <PriceText price={310} compareAt={340} />
      <MetaChips product={p} kcal={245} />
      <DietaryTags tags={['vegetarian', 'dairy_free']} />
      <QuantityStepper value={2} onChange={() => {}} />
      <QuickAddButton onPress={() => {}} accessibilityLabel="add" />
      <QuickAddButton onPress={() => {}} added accessibilityLabel="added" />
      <QuickAddButton onPress={() => {}} tone="ink" accessibilityLabel="ink" />
      <QuickAddButton onPress={() => {}} tone="canvas" accessibilityLabel="canvas" />
      <SearchBarButton onPress={() => {}} />
      <ModeCards value="pickup" onChange={() => {}} />
      <StoreCard />
      <StoreCard compact modeLabel="Pickup" />
      <SummaryCard totals={{ subtotal: 1250, discount: 100, packaging: 15, tax: 58, deliveryFee: 0, total: 1223 }} mode="pickup" />
      <SummaryCard variant="dock" totals={{ subtotal: 460, discount: 0, tax: 23, deliveryFee: 40, total: 523 }} itemImages={[p.image]} mode="delivery" />
      <OrderStatusCard order={makeOrder('preparing')} />
      <OrderStatusCard order={makeOrder('ready')} variant="light" />
      <OrderStatusCard order={makeOrder('preparing', 'delivery')} variant="compact" more={1} />
      <OrderHistoryRow order={makeOrder('completed')} onReorder={() => {}} divider />
      <OrderHistoryRow order={makeOrder('cancelled')} onReorder={() => {}} />
      <OrderAgainCard order={makeOrder('completed')} />
      <StatusTimeline order={makeOrder('preparing')} />
      <EmptyState art="plate" title="Your cart is empty" message="Nothing here yet." action={{ label: 'Browse menu', onPress: () => {} }} />
      <ErrorState error={new NetworkError()} onRetry={() => {}} />
      <ProductGridSkeleton count={2} />
      <OrderRowSkeleton />
      <VegMark diet="veg" />
      <VegMark diet="egg" />
      <VegMark diet="nonveg" />
      <FavoriteButton productId={p.id} productName={p.name} variant="frost" />
      <Avatar name="Ava Stone" />
      <PointsPill points={610} />
      <PromoCarousel promotions={PROMOTIONS} onPress={() => {}} />
      <ArtTile image={p.image} width={168} />
      <ArtThumb image={p.image} tint="cold" />
      <BadgeSticker badge="best_seller" />
      <BadgeSticker badge="new" />
      <SoldOutOverlay />
      <FloatingCartBar />

      {/* motion */}
      <RollingNumber value={1250} money />
      <Skeleton height={20} />
      <MorphPayButton state="idle" label="Pay ₹667" onPress={() => {}} />
      <MorphPayButton state="loading" label="Pay" onPress={() => {}} />
      <AnimatedCheck size={40} play />
      <PageDots count={3} progress={progress} />

      {/* invoice */}
      <InvoiceSheet invoice={buildInvoice(makeOrder('completed'))!} />
    </View>
  );
}

/** Values that only exist in the LIGHT palette: any of them in a dark render is a static leak. */
const LIGHT_ONLY = [
  lightColors.bg,
  lightColors.surfaceAlt,
  lightColors.line,
  lightColors.inkMuted,
  lightColors.danger,
  lightColors.dangerSoft,
  lightColors.storeFrom,
  lightColors.storeTo,
  lightColors.veg,
  lightColors.egg,
  lightColors.nonVeg,
  lightColors.frost,
  ...Object.values(lightTileTints),
  ...Object.values(lightHeroTints),
  // The R3 espresso shadows (dark shadows are black pools; ink alphas of `inkFixed` are legitimate).
  'rgba(59, 38, 24',
  ...Object.values(lightBoxShadows),
  ...Object.values(themeFor('light').shadows).map((x) => x.boxShadow),
].map((v) => v.toLowerCase());

/**
 * Every string a host element carries in its props (styles, fills, strokes, gradient stops), plus
 * its text: the rendered tree as one searchable string. Refs and functions are skipped.
 */
function render(r: ReactTestRenderer): string {
  const out: string[] = [];
  const seen = new WeakSet<object>();
  const collect = (value: unknown, depth: number) => {
    if (depth > 12 || value == null) return;
    if (typeof value === 'string' || typeof value === 'number') {
      out.push(String(value));
      return;
    }
    if (typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const v of value) collect(v, depth + 1);
      return;
    }
    for (const [k, v] of Object.entries(value)) {
      if (k === 'ref' || k === 'current' || typeof v === 'function') continue;
      collect(v, depth + 1);
    }
  };
  const walk = (node: ReturnType<ReactTestRenderer['toJSON']>) => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node === 'string') {
      out.push(node);
      return;
    }
    collect(node.props, 0);
    node.children?.forEach((child) => walk(child as ReturnType<ReactTestRenderer['toJSON']>));
  };
  walk(r.toJSON());
  return out.join(' ');
}

function leaks(json: string): string[] {
  const lower = json.toLowerCase();
  return LIGHT_ONLY.filter((v) => lower.includes(v));
}

describe('shared kit in dark', () => {
  beforeEach(() => {
    const food = PRODUCTS.find((x) => quickAddLine(x) !== null);
    const line = food ? quickAddLine(food) : null;
    act(() => {
      useCart.getState().clear();
      if (line) useCart.getState().add(line);
    });
  });

  it('renders every shared component with no light-only colour', () => {
    const r = mount('dark', <Kit />);
    const json = render(r);
    expect(leaks(json)).toEqual([]);
    // It really is dark: the canvas, the sheets and the inverted ink fill are on screen.
    expect(json).toContain(darkColors.bg);
    expect(json).toContain(darkColors.surface);
    expect(json).toContain(darkColors.ink);
    act(() => r.unmount());
  });

  it('would catch a static leak (the check itself works)', () => {
    const r = mount(
      'dark',
      <View style={{ backgroundColor: lightColors.bg, borderColor: lightTileTints.tea }}>
        <Text>Static</Text>
      </View>,
    );
    expect(leaks(render(r))).toEqual([lightColors.bg.toLowerCase(), lightTileTints.tea.toLowerCase()]);
    act(() => r.unmount());
  });

  it('renders the same tree in light with the R3 values', () => {
    const r = mount('light', <Kit />);
    const json = render(r).toLowerCase();
    expect(json).toContain(lightColors.bg.toLowerCase());
    expect(json).toContain(lightColors.line.toLowerCase());
    expect(json).toContain(lightTileTints.coffee.toLowerCase());
    expect(json).not.toContain(darkColors.bg.toLowerCase());
    expect(json).not.toContain(darkColors.surface.toLowerCase());
    act(() => r.unmount());
  });
});
