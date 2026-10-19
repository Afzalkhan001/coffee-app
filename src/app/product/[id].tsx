/**
 * Product detail + customization (DESIGN.md §R3.B "Product detail", ref 1; motion §7 / R3.C).
 * Params: `id`, optional `lineId` (edit an existing cart line).
 *
 * Layers, back to front: flat tinted hero plane (split title + "▣ ★ 4.5 · 6 min" inside it, led by
 * the diet mark; the cut-out standing on its plate, kcal badge, steam; parallax / stretch) →
 * scrolling white notched sheet → floating frosted top bar (back, cart target, compact header) and
 * the favourite heart beside the cart (it recedes as the compact title arrives) → sticky add bar.
 *
 * Sheet, first viewport: the ingredients line, S / M / L with one caption, and the edge-bump
 * quantity row. Below the fold: required groups always open (option tiles), every other group a
 * collapsed row, "About the beans" (coffee: opens the bean profile in a sheet) and "Add a note".
 * Sold out: no customizer — a "back tomorrow" line and a "Try instead" rail.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  measure,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type AnimatedRef,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { getCategorySync, getProductSync } from '@/api';
import { EmptyState, MetaChips, sizedPhoto, useFlash } from '@/components/domain';
import { FavoriteButton } from '@/components/domain/FavoriteButton';
import { VegMark } from '@/components/domain/VegMark';
import {
  easeOutQuint,
  enterFade,
  enterUp,
  measureInWindowAsync,
  shakeValue,
  takeHeroOrigin,
  useFlyToCart,
  useToast,
  type WindowRect,
} from '@/components/motion';
import { ModalSheet } from '@/components/account/ModalSheet';
import { LayoutBlock } from '@/components/checkout/LayoutBlock';
import { AddToCartBar } from '@/components/product/AddToCartBar';
import { subjectTop } from '@/components/product/artMetrics';
import { CoffeeProfile } from '@/components/product/CoffeeProfile';
import { EdgeQuantity } from '@/components/product/EdgeQuantity';
import { HeroImage } from '@/components/product/HeroImage';
import { InstructionsField } from '@/components/product/InstructionsField';
import {
  CONTENT_MAX_WIDTH,
  heroScaleForSize,
  SHEET_EDGE,
  TITLE_LEFT,
  TITLE_SIZE,
  TOP_BUTTON,
  useProductLayout,
} from '@/components/product/layout';
import { ModifierGroupSection, type ModifierGroupHandle } from '@/components/product/ModifierGroupSection';
import { NotchedSheet } from '@/components/product/NotchedSheet';
import { IngredientsLine } from '@/components/product/ProductIntro';
import { ProductTopBar } from '@/components/product/ProductTopBar';
import { SoldOutAlternatives } from '@/components/product/SoldOutAlternatives';
import { STEAM_HEIGHT, SteamWisps } from '@/components/product/SteamWisps';
import { useKeyboardHeight } from '@/components/product/useKeyboardHeight';
import { useProductConfigurator } from '@/components/product/useProductConfigurator';
import { CircleButton, Icon, PressableScale, Screen, SplitTitle, Text } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { effectiveMax } from '@/lib/modifiers';
import { MAX_LINE_QTY, useCart } from '@/store/cart';
import { fonts, makeStyles, spacing, springs, useTheme } from '@/theme';
import type { CartItem, ID, ModifierGroup, Product, ProductWithModifiers, Selections } from '@/types/models';

const FLY_TIMEOUT_MS = 1500;
const IS_WEB = Platform.OS === 'web';
const DRINK_CATEGORIES = new Set(['coffee', 'tea', 'cold']);
const HOT_BY_DEFAULT = new Set(['coffee', 'tea']);
const ROAST_LABELS = ['Light', 'Medium-light', 'Medium', 'Medium-dark', 'Dark'] as const;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
/** `warning` on the frame the missing group starts to shake (after the reveal scroll, if there is one). */
function warnWithShake(delayMs: number) {
  if (delayMs > 0) setTimeout(haptic.warning, delayMs);
  else haptic.warning();
}
const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

/** Steam only for hot drinks: Hot chosen, or no temperature choice and a hot-drink category. */
function isHotDrink(product: Product, groups: ModifierGroup[], selections: Selections): boolean {
  const temperature = groups.find((g) => g.id === 'temperature');
  if (!temperature) return HOT_BY_DEFAULT.has(product.categoryId);
  const hot = temperature.options.find((o) => /hot/i.test(o.name));
  return !!hot && (selections[temperature.id] ?? []).includes(hot.id);
}

/** "Up to 2 syrups", "Up to 3 extras", "Up to 2 options". */
function limitMessage(group: ModifierGroup): string {
  const name = group.name.toLowerCase();
  const noun = /\s/.test(name) ? 'options' : name.endsWith('s') ? name : `${name}s`;
  return `Up to ${effectiveMax(group)} ${noun}`;
}

/** "House blend · Brazil & Ethiopia · Medium roast" (the origin line already names the roast). */
function beansCaption(coffee: NonNullable<Product['coffee']>): string {
  if (/roast/i.test(coffee.origin)) return coffee.origin;
  return `${coffee.origin} · ${ROAST_LABELS[coffee.roast - 1] ?? 'Medium'} roast`;
}

export default function ProductRoute() {
  const params = useLocalSearchParams<{ id: string; lineId?: string }>();
  const id = first(params.id) ?? '';
  const lineId = first(params.lineId);
  const product = useMemo(() => getProductSync(id), [id]);

  if (!product) return <ProductNotFound />;
  return <ProductDetail key={`${product.id}:${lineId ?? ''}`} product={product} lineId={lineId} />;
}

function ProductDetail({ product, lineId }: { product: ProductWithModifiers; lineId?: string }) {
  const { colors: c, heroTints } = useTheme();
  const styles = useStyles();
  const geo = useProductLayout(product.name);
  const reduced = useReducedMotion();
  const toast = useToast();
  const fly = useFlyToCart();
  const addLine = useCart((s) => s.add);
  const replaceLine = useCart((s) => s.replace);
  const keyboard = useKeyboardHeight();

  const [editLine] = useState<CartItem | undefined>(() =>
    lineId ? useCart.getState().items.find((i) => i.id === lineId && i.productId === product.id) : undefined,
  );
  const [origin] = useState(() => takeHeroOrigin(product.id));
  const cfg = useProductConfigurator(product, editLine);
  const category = getCategorySync(product.categoryId);
  const tint = heroTints[category?.tint ?? 'coffee'];
  const soldOut = !product.isAvailable;
  const flying = !!origin && !reduced;
  // The sheet rises with the hero (not after it), so its contents only trail by a beat.
  const stagger = flying ? 2 : 1;
  const isDrink = DRINK_CATEGORIES.has(product.categoryId);

  const [openGroup, setOpenGroup] = useState<ID | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [beansOpen, setBeansOpen] = useState(false);

  // ── art: hero-sized source, with the card's cached image as an instant placeholder (remote only) ──
  const art = geo.artSize;
  const heroUri = sizedPhoto(product.image, art);
  const cardUri = origin ? sizedPhoto(product.image, Math.round(Math.min(origin.width, origin.height))) : undefined;
  const placeholderUri = cardUri !== heroUri ? cardUri : undefined;
  const [heroLoaded, setHeroLoaded] = useState(false);
  const heroPhotoRef = useRef<View>(null);
  const barCircleRef = useRef<View>(null);

  // ── scroll-driven hero: 0.5× parallax + fade up, stretch on pull-down (iOS bounce) ──
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.set(e.contentOffset.y);
    },
  });
  const heroH = geo.heroHeight;
  /** Where the art box rests (window coordinates): the flight's destination, known before layout. */
  const heroTarget: WindowRect = { x: geo.artLeft, y: geo.artTop, width: art, height: art };
  const heroStyle = useAnimatedStyle(() => {
    const y = scrollY.get();
    const fade = interpolate(y, [0, heroH * 0.7], [1, 0], Extrapolation.CLAMP);
    if (reduced) return { opacity: fade };
    if (y < 0) return { opacity: 1, transform: [{ translateY: -y / 2 }, { scale: 1 - y / heroH }] };
    return { opacity: fade, transform: [{ translateY: -y * 0.5 }, { scale: 1 }] };
  });

  // ── backdrop: the tint fades in under the flying cut-out (instant without a flight) ──
  const backdrop = useSharedValue(flying ? 0 : 1);
  useEffect(() => {
    backdrop.set(withTiming(1, { duration: 380, easing: easeOutQuint }));
  }, [backdrop]);
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.get() }));
  // White floor behind the sheet so a bottom bounce never shows the tint.
  const floorStyle = useAnimatedStyle(() => ({
    opacity: backdrop.get(),
    transform: [{ translateY: Math.max(0, -scrollY.get()) }],
  }));

  // ── size → art scale (S 0.9 / M 1 / L 1.08, smooth spring) ──
  const sizeGroup = cfg.groups.find((g) => g.display === 'size_circles');
  const listGroups = cfg.groups.filter((g) => g.display !== 'size_circles');
  const sizeCount = sizeGroup?.options.length ?? 0;
  const sizeIndex = sizeGroup
    ? sizeGroup.options.findIndex((o) => (cfg.selections[sizeGroup.id] ?? []).includes(o.id))
    : -1;
  const sizeScale = useSharedValue(heroScaleForSize(sizeIndex, sizeCount));
  useEffect(() => {
    sizeScale.set(withSpring(heroScaleForSize(sizeIndex, sizeCount), springs.smooth));
  }, [sizeIndex, sizeCount, sizeScale]);
  /** Press-down of the art as it lifts off to the cart (1 at rest). */
  const pulse = useSharedValue(1);
  // The steam rises from the cup's rim; the art scales about its bottom centre, so a point
  // `rimFromBottom` above the base moves by (1 − s) × rimFromBottom.
  const rimTop = Math.round(art * (subjectTop(product.image) + 0.03));
  const rimFromBottom = art - rimTop;
  const steamStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: rimFromBottom * (1 - sizeScale.get() * pulse.get()) }],
  }));

  // ── favourite heart (beside the cart): recedes as the compact header's centred title arrives ──
  const titleAt = geo.sheetTop - geo.headerHeight;
  const heartStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [titleAt - 48, titleAt - 16], [1, 0], Extrapolation.CLAMP),
  }));
  const [heartAway, setHeartAway] = useState(false);
  useAnimatedReaction(
    () => scrollY.get() > titleAt - 24,
    (away, prev) => {
      if (away !== prev) scheduleOnRN(setHeartAway, away);
    },
  );

  // ── group handles: scroll into view + shake on the UI thread ──
  const groupHandles = useRef<Map<ID, ModifierGroupHandle> | null>(null);
  const handles = () => {
    if (!groupHandles.current) groupHandles.current = new Map();
    return groupHandles.current;
  };
  const registerGroup = (groupId: ID, handle: ModifierGroupHandle | null) => {
    if (handle) handles().set(groupId, handle);
    else handles().delete(groupId);
  };

  const topClear = geo.headerHeight + spacing.sm;
  /**
   * Scrolls `node` below the compact header if it isn't comfortably visible, then (optionally) shakes
   * it; `warn` adds the `warning` haptic on the shake's first frame (docs/HAPTICS.md).
   */
  const reveal = (node: AnimatedRef<Animated.View>, bottomClear: number, offset?: SharedValue<number>, warn = false) => {
    scheduleOnUI(() => {
      'worklet';
      const target = measure(node);
      const viewport = measure(scrollRef);
      let delay = 0;
      if (target !== null && viewport !== null) {
        const top = viewport.pageY + topClear;
        const bottom = viewport.pageY + viewport.height - bottomClear;
        const fits = target.pageY >= top && target.pageY + Math.min(target.height, bottom - top) <= bottom;
        if (!fits) {
          scrollTo(scrollRef, 0, Math.max(0, scrollY.get() + target.pageY - top), true);
          delay = 320;
        }
      }
      if (offset) shakeValue(offset, 6, 3, delay);
      if (warn) scheduleOnRN(warnWithShake, offset ? delay : 0);
    });
  };

  const pointAtMissing = () => {
    const groupId = cfg.validation.firstInvalidGroupId;
    const handle = groupId ? groupHandles.current?.get(groupId) : undefined;
    if (!handle) {
      haptic.warning();
      return;
    }
    handle.highlight();
    reveal(handle.node, geo.barSpace, handle.offset, true);
  };

  const onToggle = (group: ModifierGroup, optionId: ID) => {
    const outcome = cfg.toggle(group, optionId);
    if (outcome === 'changed') {
      // The selection indicator starts moving on this render.
      haptic.select();
      return;
    }
    if (outcome !== 'limit') return;
    // At the group's limit: a nudge, together with the small shake below.
    haptic.warning();
    toast(limitMessage(group), { icon: 'information-circle' });
    const offset = groupHandles.current?.get(group.id)?.offset;
    if (offset) {
      scheduleOnUI(() => {
        'worklet';
        shakeValue(offset, 4, 2);
      });
    }
  };

  const onOpenChange = (groupId: ID, open: boolean) => {
    setOpenGroup((cur) => (open ? groupId : cur === groupId ? null : cur));
    if (open) setNoteOpen(false);
  };
  const onNoteOpenChange = (open: boolean) => {
    setNoteOpen(open);
    if (open) setOpenGroup(null);
  };

  // ── special instructions: lift above the keyboard ──
  const instructionsNode = useAnimatedRef<Animated.View>();
  const instructionsFocused = useRef(false);
  useEffect(() => {
    // Runs only when the keyboard opens or resizes (re-running on every render would fight the user's scroll).
    if (keyboard > 0 && instructionsFocused.current) reveal(instructionsNode, keyboard + spacing.md);
  }, [keyboard]);

  // ── add to cart / update line ──
  const [justAdded, flashAdded] = useFlash(1500);
  const [nudge, showNudge] = useFlash(4200);
  const inFlight = useRef(false);

  /** Flight source: the hero art box, or the bar's bag circle once the hero has scrolled away. */
  const flySource = async (): Promise<{ rect: WindowRect; image: string } | null> => {
    const heroInView = scrollY.get() < heroH * 0.4;
    const rect = await measureInWindowAsync(heroInView ? heroPhotoRef : barCircleRef);
    if (!rect) return null;
    return { rect, image: heroLoaded || !placeholderUri ? heroUri : placeholderUri };
  };

  const commit = async () => {
    const line = cfg.buildLine();
    if (!line || inFlight.current) return;

    if (editLine) {
      // The bar's press-in already clicked; the toast and the return to the cart are the outcome.
      const result = replaceLine(editLine.id, line);
      // A row is about to disappear from the cart: say where it went.
      toast(result.merged ? `Merged with your other ${product.name} (now ${result.quantity})` : `${product.name} updated`, {
        tone: 'success',
        icon: 'checkmark-circle',
      });
      if (router.canGoBack()) router.back();
      else router.replace('/cart');
      return;
    }

    inFlight.current = true;
    flashAdded();
    const source = await flySource();
    if (source && !reduced) {
      // The art gives a little as the cut-out lifts off it.
      pulse.set(withSequence(withTiming(0.94, { duration: 110, easing: easeOutQuint }), withSpring(1, springs.bouncy)));
    }
    if (source) {
      await Promise.race([fly({ image: source.image, from: source.rect }).catch(() => undefined), wait(FLY_TIMEOUT_MS)]);
    } else {
      haptic.land(); // no flight to land: the add lands here
    }
    addLine(line); // lands with the cut-out, so the badge pops on arrival
    inFlight.current = false;
    showNudge();
    if (Platform.OS !== 'web') {
      AccessibilityInfo.announceForAccessibility(`Added ${line.quantity} ${product.name} to your cart`);
    }
  };

  const onPressBar = () => {
    if (!cfg.validation.valid) {
      pointAtMissing();
      return;
    }
    void commit();
  };

  const hot = !soldOut && isHotDrink(product, cfg.groups, cfg.selections);
  const androidKeyboardPad = Platform.OS === 'android' ? keyboard : 0;
  // Re-render trigger for the rows' layout transitions (web): anything that changes a row's height.
  const layoutKey = [openGroup, noteOpen, cfg.validation.firstInvalidGroupId].join('|');
  const coffee = product.coffee;

  return (
    <View style={[styles.root, IS_WEB ? styles.rootWeb : null]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: tint }, backdropStyle]} />
      <Animated.View style={[styles.floor, { top: geo.sheetTop + SHEET_EDGE }, floorStyle]} />

      {/* Hero: behind the scroll view, so the sheet slides over it */}
      <Animated.View style={[styles.hero, { height: heroH }, heroStyle]}>
        <HeroTitleBlock product={product} stagger={stagger - 1} width={geo.titleWidth} style={[styles.title, { top: geo.titleTop }]} />
        <Animated.View style={[styles.steam, { top: geo.artTop + rimTop - STEAM_HEIGHT }, steamStyle]}>
          <SteamWisps visible={hot} />
        </Animated.View>
        <View style={[styles.artSlot, { top: geo.artTop, left: geo.artLeft }]}>
          <HeroImage
            uri={heroUri}
            placeholderUri={placeholderUri}
            size={art}
            target={heroTarget}
            origin={origin}
            sizeScale={sizeScale}
            pulse={pulse}
            kcal={soldOut ? undefined : cfg.kcal}
            soldOut={soldOut}
            photoRef={heroPhotoRef}
            onLoad={() => setHeroLoaded(true)}
          />
        </View>
      </Animated.View>

      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingTop: geo.sheetTop }}
      >
        <NotchedSheet width={geo.width} minBodyHeight={geo.height - geo.sheetTop - SHEET_EDGE} delay={flying ? 60 : 40}>
          <View style={[styles.body, geo.compact ? styles.bodyCompact : null, { paddingBottom: geo.barSpace + androidKeyboardPad }]}>
            <Animated.View entering={enterUp(stagger)}>
              <IngredientsLine product={product} width={geo.width} />
            </Animated.View>

            {soldOut ? (
              <Animated.View entering={enterUp(stagger + 2)} style={styles.content}>
                <SoldOutAlternatives product={product} category={category} />
              </Animated.View>
            ) : (
              <>
                {sizeGroup ? (
                  <Animated.View entering={enterUp(stagger + 1)} style={geo.compact ? styles.sizesCompact : styles.sizes}>
                    <ModifierGroupSection
                      ref={(handle) => registerGroup(sizeGroup.id, handle)}
                      group={sizeGroup}
                      selected={cfg.selections[sizeGroup.id] ?? []}
                      onToggle={onToggle}
                    />
                  </Animated.View>
                ) : null}

                <Animated.View
                  entering={enterUp(stagger + 2)}
                  style={sizeGroup ? (geo.compact ? styles.qtyCompact : styles.qty) : styles.qtyNoSize}
                >
                  <EdgeQuantity value={cfg.quantity} onChange={cfg.setQuantity} max={MAX_LINE_QTY} />
                </Animated.View>

                <View style={styles.content}>
                  {listGroups.map((group, i) => (
                    <LayoutBlock key={group.id} layoutKey={layoutKey} entering={enterUp(stagger + 3 + i)} style={styles.row}>
                      <ModifierGroupSection
                        ref={(handle) => registerGroup(group.id, handle)}
                        group={group}
                        selected={cfg.selections[group.id] ?? []}
                        onToggle={onToggle}
                        open={openGroup === group.id}
                        onOpenChange={onOpenChange}
                      />
                    </LayoutBlock>
                  ))}

                  {coffee ? (
                    <LayoutBlock layoutKey={layoutKey} entering={enterUp(stagger + 3 + listGroups.length)} style={styles.row}>
                      <PressableScale
                        onPress={() => setBeansOpen(true)}
                        activeScale={0.985}
                        accessibilityRole="button"
                        accessibilityLabel={`About the beans. ${beansCaption(coffee)}`}
                        style={styles.beansRow}
                      >
                        <View style={styles.beansCopy}>
                          <Text style={styles.rowTitle}>About the beans</Text>
                          <Text variant="caption" color={c.inkSoft} numberOfLines={1}>
                            {beansCaption(coffee)}
                          </Text>
                        </View>
                        <Icon name="chevron-forward" size={18} color={c.inkMuted} />
                      </PressableScale>
                    </LayoutBlock>
                  ) : null}

                  {product.allowsInstructions ? (
                    <LayoutBlock layoutKey={layoutKey} entering={enterUp(stagger + 4 + listGroups.length)} style={styles.row}>
                      <InstructionsField
                        node={instructionsNode}
                        value={cfg.instructions}
                        onChange={cfg.setInstructions}
                        open={noteOpen}
                        onOpenChange={onNoteOpenChange}
                        placeholder={
                          isDrink ? 'e.g. room for milk, no lid' : 'e.g. cut in half, extra napkins'
                        }
                        onFocus={() => {
                          instructionsFocused.current = true;
                        }}
                        onBlur={() => {
                          instructionsFocused.current = false;
                        }}
                      />
                    </LayoutBlock>
                  ) : null}
                </View>
              </>
            )}
          </View>
        </NotchedSheet>
      </Animated.ScrollView>

      <ProductTopBar title={product.name} scrollY={scrollY} geometry={geo} onBack={goBack} />
      <Animated.View
        entering={enterFade(1)}
        style={[styles.heart, { top: geo.topBarTop, pointerEvents: heartAway ? 'none' : 'box-none' }]}
        accessibilityElementsHidden={heartAway}
        importantForAccessibility={heartAway ? 'no-hide-descendants' : 'auto'}
      >
        <Animated.View style={heartStyle}>
          <FavoriteButton productId={product.id} productName={product.name} variant="frost" />
        </Animated.View>
      </Animated.View>

      <AddToCartBar
        mode={editLine ? 'edit' : 'add'}
        total={cfg.total}
        compareAtTotal={cfg.compareAtTotal}
        valid={cfg.validation.valid}
        missing={cfg.missing}
        remaining={cfg.remaining}
        hint={cfg.hint}
        soldOut={soldOut}
        added={justAdded}
        nudge={nudge && !justAdded}
        hidden={keyboard > 0}
        bottomInset={geo.barBottom}
        circleRef={barCircleRef}
        onPress={onPressBar}
        onViewCart={() => router.push('/cart')}
      />

      {coffee ? (
        <ModalSheet visible={beansOpen} onClose={() => setBeansOpen(false)} accessibilityLabel="About the beans">
          <Text variant="h2" style={styles.beansTitle}>
            About the beans
          </Text>
          <CoffeeProfile coffee={coffee} />
        </ModalSheet>
      ) : null}
    </View>
  );
}

/**
 * The hero's split title and its one meta line, led by the diet mark ("▣ ★ 4.5 · 6 min"). Same
 * geometry as ProductIntro's HeroTitle (2 × 36 + 4 + 18), which `useProductLayout` sizes the art for.
 */
function HeroTitleBlock({
  product,
  stagger,
  width,
  style,
}: {
  product: Product;
  stagger: number;
  width: number;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return (
    <View style={[{ width }, style]}>
      <Animated.View entering={enterUp(stagger)}>
        <SplitTitle size={TITLE_SIZE} numberOfLines={2} style={styles.titleText}>
          {product.name}
        </SplitTitle>
      </Animated.View>
      <Animated.View entering={enterUp(stagger + 1)} style={styles.meta}>
        {product.diet ? <VegMark diet={product.diet} size={14} /> : null}
        <MetaChips
          product={{ prepMinutes: product.prepMinutes, rating: product.rating, ratingCount: product.ratingCount, kcal: product.kcal }}
        />
      </Animated.View>
    </View>
  );
}

function ProductNotFound() {
  const styles = useStyles();
  return (
    <Screen>
      <View style={styles.notFoundBar}>
        <CircleButton icon="chevron-back" size={44} tone="white" onPress={goBack} accessibilityLabel="Go back" />
      </View>
      <EmptyState
        art="plate"
        title="This one’s off the menu"
        message="It may have left the menu for the season."
        action={{ label: 'Browse the menu', onPress: () => router.replace('/menu') }}
        style={styles.notFound}
      />
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.bg, overflow: 'hidden' },
  // Web: the tint layer is the only fill, so once the stack shows this route as a transparent card
  // the previous screen stays visible under the fading tint during the hand-off (no cut to cream).
  rootWeb: { backgroundColor: 'transparent' },
  floor: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: c.surface },
  hero: { position: 'absolute', left: 0, right: 0, top: 0, pointerEvents: 'none' },
  title: { position: 'absolute', left: TITLE_LEFT },
  titleText: { lineHeight: 36 },
  // One 18px line: the mark centres on it, 8 before the star.
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, minHeight: 18 },
  // Beside the cart circle (same row, 8 apart).
  heart: { position: 'absolute', right: spacing.gutter + TOP_BUTTON + spacing.xs },
  artSlot: { position: 'absolute' },
  steam: { position: 'absolute', left: 0, right: 0 },
  // The grabber sits 12px below the notch; the ingredients line starts 14px under it.
  body: { paddingTop: 18 },
  sizes: { marginTop: 18 },
  qty: { marginTop: 18 },
  // Short phones: the first viewport keeps the quantity row above the sticky bar.
  bodyCompact: { paddingTop: 14 },
  sizesCompact: { marginTop: 12 },
  qtyCompact: { marginTop: 8 },
  qtyNoSize: { marginTop: 22 },
  content: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: spacing.gutter,
    marginTop: 28,
  },
  row: { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: c.line },
  rowTitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  beansRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64, paddingVertical: 10 },
  beansCopy: { flex: 1, minWidth: 0 },
  beansTitle: { marginBottom: spacing.md },
  notFoundBar: { paddingHorizontal: spacing.gutter, paddingTop: spacing.xs },
  notFound: { flex: 1 },
}));
