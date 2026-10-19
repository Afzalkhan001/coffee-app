/**
 * Order confirmation — the hero moment (DESIGN.md §R3.B "Confirmation", R3.C8; ref 1 mood).
 * `night` canvas with one peach glow; the order's cut-outs (up to 3) rise into a loose cluster over a
 * black pool while confetti bursts from it; a sage check draws; "Order / *placed.*" (light display +
 * Fraunces italic) rises; one mode-aware line; the pickup code rolls in letter by letter; a white
 * "Track order" bar. "Done" (top right) goes home.
 *
 * Sequence: glow 0ms (400ms fade) → cut-outs 120 / 200 / 280ms (rise 40px, 0.85 → 1, `gentle`) →
 * confetti 350ms → check 500ms → title 650ms → code letters 800ms (40ms stagger) → idle float.
 * Reduce Motion: quick fades, no confetti, no float. An unknown order id (old link, reset demo)
 * gets a calm "couldn't find it" state, never a fake celebration.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { AccessibilityInfo, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useOrder } from '@/api/hooks';
import { AnimatedCheck, ConfettiBurst, easeOutQuint, withAlpha } from '@/components/motion';
import { clusterImages, etaLabel, minutesLeft, ProductArt, scheduledReadyLabel, useNow } from '@/components/domain';
import { LightStatusBar, PrimaryBar, PressableScale, Text } from '@/components/ui';
import { useDelayedFlag } from '@/components/checkout/hooks';
import { popAfter, riseIn } from '@/components/checkout/motion';
import { pickupCode, usesPickupCode } from '@/lib/pickupCode';
import { brand } from '@/theme/brand';
import { fonts, makeStyles, makeThemed, spacing, springs, type as typeScale, useColors } from '@/theme';
import type { Order } from '@/types/models';

/** A night screen: these are fixed tokens (the same in both schemes). */
const useConfetti = makeThemed((c) => [c.peach, c.sage, c.white]);
const CHECK = 44;
/** Cluster box (390pt reference): the main piece is 230, the others 170 and 140. */
const CLUSTER_H = 300;
const GLOW_MS = 400;
const PIECE_AT = [120, 200, 280] as const;
const CONFETTI_AT = 350;
const CHECK_AT = 500;
const TITLE_AT = 650;
const CODE_AT = 800;
const CODE_STAGGER = 40;

/** A leading flat / floor part of an Indian address line ("Flat 4B", "Level 3", "No. 12", "#221"). */
const UNIT_PART = /^(flat|apt|apartment|unit|level|floor|no\.?|#)\s*\S*$/i;

/** "Flat 4B, Sunrise Residency, 6th Cross" → "Sunrise Residency"; "80 Feet Road" → "80 Feet Rd". */
function shortStreet(line1: string): string {
  const parts = line1
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const street = parts.find((p) => !UNIT_PART.test(p)) ?? parts[0] ?? line1;
  return street.replace(/\bRoad\b/, 'Rd').replace(/\bStreet\b/, 'St').replace(/\bAvenue\b/, 'Ave');
}

/** One mode-aware line: where and when (R3 copy). Live status copy once it's past "preparing". */
function readyLine(order: Order, now: number): string {
  const early = order.status === 'placed' || order.status === 'accepted' || order.status === 'preparing';
  // Pay-later reminder: in-car orders are paid when they're brought out to the car.
  const atCounter =
    order.paymentMethod === 'pay_at_store' ? (order.details.mode === 'in_car' ? ' · pay at your car' : ' · pay at the counter') : '';
  if (!early) return etaLabel(order, now);
  const store = brand.store.shortName;
  const at = scheduledReadyLabel(order);
  const m = minutesLeft(order, now);
  switch (order.details.mode) {
    case 'pickup':
      return (at ? `Ready for pickup at ${at} · ${store}` : `Ready for pickup in ~${m} min at ${store}`) + atCounter;
    case 'in_car':
      return (at ? `Out to your car at ${at}` : `Out to your car in ~${m} min`) + atCounter;
    case 'dine_in':
      return `We’ll bring it to your table${atCounter}`;
    case 'delivery':
      return order.details.address ? `Arriving in ~${m} min · ${shortStreet(order.details.address.line1)}` : `Arriving in ~${m} min`;
  }
}

export default function ConfirmationScreen() {
  const c = useColors();
  const styles = useStyles();
  const confetti = useConfetti();
  const params = useLocalSearchParams<{ id?: string }>();
  const orderId = typeof params.id === 'string' ? params.id : undefined;
  const order = useOrder(orderId);
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const reduced = useReducedMotion();
  const now = useNow(15_000);
  const found = !!order && order.status !== 'cancelled';
  const burst = useDelayedFlag(CONFETTI_AT, found);
  const settled = useDelayedFlag(1200, found);

  // A cancelled order has nothing to celebrate: show its details instead.
  const cancelled = order?.status === 'cancelled';
  useEffect(() => {
    if (cancelled && orderId) router.replace({ pathname: '/order/[id]', params: { id: orderId } });
  }, [cancelled, orderId]);

  const orderNumber = order?.number;
  const etaMinutes = order?.etaMinutes;
  useEffect(() => {
    if (!orderNumber || Platform.OS === 'web') return;
    AccessibilityInfo.announceForAccessibility(`Order placed. Order ${orderNumber}. Ready in about ${etaMinutes ?? 8} minutes.`);
  }, [orderNumber, etaMinutes]);

  // The glow fades in first (the payment reveal hands over on an identical night frame).
  const glow = useSharedValue(0);
  useEffect(() => {
    glow.set(withTiming(1, { duration: GLOW_MS, easing: easeOutQuint, reduceMotion: ReduceMotion.Never }));
  }, [glow]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.get() }));

  if (!order || cancelled) return <MissingOrder cancelled={cancelled} topInset={insets.top} bottomInset={insets.bottom} />;

  const trackOrder = () => {
    if (!orderId) return;
    router.replace({ pathname: '/order/[id]', params: { id: orderId } });
  };
  const goHome = () => router.dismissTo('/');

  const showCode = usesPickupCode(order.details.mode);
  const code = pickupCode(order.number);
  const images = clusterImages(order.items.map((i) => i.image), 3);

  // Fit: the cluster takes what the copy and the bar leave (full size on a 390×844 iPhone); short
  // phones shrink the cluster first, then the title type.
  const bottomPad = Math.max(insets.bottom, spacing.md);
  const ctaSpace = 64 + bottomPad + spacing.lg;
  const topGap = 40;
  const textBlock = 14 + CHECK + 16 + 58 + 58 + 14 + 22 + (showCode ? spacing.lg + 18 + 50 : spacing.md + 18);
  const room = H - insets.top - topGap - ctaSpace - textBlock;
  const tight = room < CLUSTER_H * 0.8;
  const k = Math.max(0.55, Math.min(1, W / 390, (room + (tight ? 22 : 0)) / CLUSTER_H));
  // Spare height (tall screens, web) is shared: half above the cluster, a quarter under it.
  const spare = Math.max(0, room - CLUSTER_H * k);
  const clusterTop = insets.top + topGap + Math.round(spare * 0.5);
  const clusterH = Math.round(CLUSTER_H * k + spare * 0.25);

  return (
    <View style={styles.screen}>
      {/* Light status bar on the dark screen (focus-aware: dark again under Track order). */}
      <LightStatusBar />
      <Animated.View style={[styles.glow, glowStyle]}>
        <Glow width={W} height={H} />
      </Animated.View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: clusterTop, paddingBottom: ctaSpace + spacing.sm }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Cluster images={images} width={W} scale={k} height={clusterH} poolY={Math.round(CLUSTER_H * k * 0.88)} float={settled && !reduced} />

        <View style={styles.copy}>
          <Animated.View entering={popAfter(CHECK_AT - 80)} style={styles.check}>
            <AnimatedCheck size={CHECK - 6} color={c.white} play delay={CHECK_AT} ring={false} strokeWidth={3} />
          </Animated.View>

          <View accessible accessibilityRole="header" accessibilityLabel="Order placed" style={styles.title}>
            <Animated.View entering={riseIn(TITLE_AT, 14)}>
              <Text style={[styles.order, tight ? styles.orderTight : null]} color={c.white}>
                Order
              </Text>
            </Animated.View>
            <Animated.View entering={riseIn(TITLE_AT + 70, 14)}>
              <Text style={[styles.placed, tight ? styles.placedTight : null]} color={c.peach}>
                placed.
              </Text>
            </Animated.View>
          </View>

          <Animated.View entering={riseIn(TITLE_AT + 120, 10)}>
            <Text style={styles.line} color={withAlpha(c.white, 0.62)}>
              {readyLine(order, now)}
            </Text>
          </Animated.View>

          {showCode ? (
            <Animated.View entering={riseIn(CODE_AT - 60, 8)} style={styles.codeBlock}>
              <Text style={styles.small} color={withAlpha(c.white, 0.5)}>
                {order.details.mode === 'dine_in' ? 'Order code' : 'Pickup code'}
              </Text>
              <View style={styles.codeRow}>
                <RollingCode code={code} delay={CODE_AT} />
                <Text style={styles.number} color={withAlpha(c.white, 0.5)}>
                  {`#${order.number}`}
                </Text>
              </View>
            </Animated.View>
          ) : (
            <Animated.View entering={riseIn(CODE_AT - 60, 8)} style={styles.numberOnly}>
              <Text style={styles.small} color={withAlpha(c.white, 0.5)}>
                {`Order #${order.number}`}
              </Text>
            </Animated.View>
          )}
        </View>
      </ScrollView>

      {/* Above the content (touch-transparent), below the actions. */}
      <ConfettiBurst
        play={burst}
        originX={W / 2}
        originY={clusterTop + clusterH * 0.45}
        colors={confetti}
        count={30}
        seed={7}
      />

      <PressableScale
        onPress={goHome}
        activeScale={0.94}
        accessibilityRole="button"
        accessibilityLabel="Done"
        hitSlop={8}
        style={[styles.done, { top: insets.top + 8 }]}
      >
        <Text style={styles.doneText} color={withAlpha(c.white, 0.7)}>
          Done
        </Text>
      </PressableScale>

      <Animated.View entering={riseIn(TITLE_AT + 260, 16)} style={[styles.actions, { paddingBottom: bottomPad }]}>
        <PrimaryBar label="Track order" tone="white" onPress={trackOrder} accessibilityLabel="Track order" />
      </Animated.View>
    </View>
  );
}

/** One peach radial glow at 22% (ellipse 70% × 42% at 50% 30%). */
function Glow({ width, height }: { width: number; height: number }) {
  const c = useColors();
  return (
    <Svg width={width} height={height}>
      <Defs>
        <RadialGradient id="confGlow" cx="50%" cy="30%" rx="70%" ry="42%" fx="50%" fy="30%">
          <Stop offset="0" stopColor={c.peach} stopOpacity={0.22} />
          <Stop offset="0.55" stopColor={c.peach} stopOpacity={0.08} />
          <Stop offset="1" stopColor={c.peach} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#confGlow)" />
    </Svg>
  );
}

interface PieceSpec {
  size: number;
  /** Left of the art box; negative / past the width to bleed. */
  x: number;
  y: number;
  rotate: number;
  z: number;
}

/** R3 cluster placement on a 390-wide frame, scaled by `k`: main 230, second 170 (front), third 140 (behind). */
function pieces(width: number, k: number): PieceSpec[] {
  const main = 230 * k;
  const second = 170 * k;
  const third = 140 * k;
  return [
    { size: main, x: width / 2 - 99 * k, y: 0, rotate: 0, z: 2 },
    { size: second, x: 20 * k, y: 102 * k, rotate: -12, z: 3 },
    { size: third, x: width + 10 * k - third, y: 120 * k, rotate: 10, z: 1 },
  ];
}

/**
 * The order's cut-outs (up to 3, unique) rising in one by one over a black pool: each lifts 40px and
 * scales 0.85 → 1 on `gentle`, then floats (0.4s phase offsets) once the sequence has settled.
 */
function Cluster({
  images,
  width,
  scale,
  height,
  poolY,
  float,
}: {
  images: string[];
  width: number;
  scale: number;
  height: number;
  /** Centre line of the black pool (just under the pieces' bases). */
  poolY: number;
  float: boolean;
}) {
  const layout = pieces(width, scale);
  // A lone item takes the main slot, centred.
  const placed = images.length === 1 && layout[0] ? [{ ...layout[0], x: (width - layout[0].size) / 2 }] : layout.slice(0, images.length);
  const poolW = 250 * scale;
  const poolH = 34 * scale;
  return (
    <View style={{ height }} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Pool width={poolW} height={poolH} style={{ left: (width - poolW) / 2 - spacing.gutter, top: poolY - poolH / 2 }} />
      {images.map((img, i) => {
        const p = placed[i];
        if (!p) return null;
        return (
          <RisingPiece key={img} image={img} spec={p} delay={PIECE_AT[i] ?? 280} index={i} float={float} offsetLeft={-spacing.gutter} />
        );
      })}
    </View>
  );
}

function RisingPiece({
  image,
  spec,
  delay,
  index,
  float,
  offsetLeft,
}: {
  image: string;
  spec: PieceSpec;
  delay: number;
  index: number;
  float: boolean;
  offsetLeft: number;
}) {
  const styles = useStyles();
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? 0.6 : 0);
  useEffect(() => {
    p.set(
      withDelay(
        reduced ? delay / 3 : delay,
        reduced ? withTiming(1, { duration: 200, reduceMotion: ReduceMotion.Never }) : withSpring(1, springs.gentle),
        ReduceMotion.Never,
      ),
    );
  }, [p, delay, reduced]);
  const style = useAnimatedStyle(() => {
    const v = p.get();
    return {
      opacity: Math.min(1, v * 1.6),
      transform: [{ translateY: (1 - v) * 40 }, { scale: 0.85 + 0.15 * v }, { rotate: `${spec.rotate}deg` }],
    };
  });
  return (
    <Animated.View
      style={[styles.piece, { left: spec.x + offsetLeft, top: spec.y, width: spec.size, height: spec.size, zIndex: spec.z }, style]}
    >
      <ProductArt image={image} size={spec.size} shadow={false} float={float} floatPhase={index * 0.4} eager priority="high" />
    </Animated.View>
  );
}

function Pool({ width, height, style }: { width: number; height: number; style: object }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={[styles.pool, { width, height }, style]}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="confPool" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={c.black} stopOpacity={0.55} />
            <Stop offset="0.5" stopColor={c.black} stopOpacity={0.3} />
            <Stop offset="1" stopColor={c.black} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={width / 2} cy={height / 2} rx={width / 2} ry={height / 2} fill="url(#confPool)" />
      </Svg>
    </View>
  );
}

/** The pickup code: each letter rolls up out of its own clipped cell, 40ms apart. */
function RollingCode({ code, delay }: { code: string; delay: number }) {
  const styles = useStyles();
  return (
    <View style={styles.codeChars} accessible accessibilityLabel={`Pickup code ${code.split('').join(' ')}`}>
      {code.split('').map((ch, i) => (
        <CodeChar key={`${i}-${ch}`} ch={ch} delay={delay + i * CODE_STAGGER} />
      ))}
    </View>
  );
}

function CodeChar({ ch, delay }: { ch: string; delay: number }) {
  const c = useColors();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const v = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    v.set(withDelay(delay, withSpring(1, springs.smooth)));
  }, [v, delay, reduced]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, v.get() * 1.4),
    transform: [{ translateY: (1 - v.get()) * typeScale.code.lineHeight }],
  }));
  return (
    <View style={styles.codeCell}>
      <Animated.View style={style}>
        <Text style={styles.code} color={c.peach}>
          {ch}
        </Text>
      </Animated.View>
    </View>
  );
}

/** Unknown order id (old link, reset demo): no confetti, no "Order placed", a way back instead. */
function MissingOrder({ cancelled, topInset, bottomInset }: { cancelled: boolean; topInset: number; bottomInset: number }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={[styles.screen, styles.missing, { paddingTop: topInset + spacing.xl, paddingBottom: Math.max(bottomInset, spacing.md) + spacing.xl }]}>
      <LightStatusBar />
      {cancelled ? null : (
        <>
          <Animated.View entering={riseIn(80)}>
            <Text style={styles.missingTitle} color={c.white} align="center" accessibilityRole="header">
              We couldn’t find that order
            </Text>
            <Text variant="body" color={withAlpha(c.white, 0.62)} align="center" style={styles.missingBody}>
              It may be from an old link, or the demo was reset.
            </Text>
          </Animated.View>
          <Animated.View entering={riseIn(180)} style={styles.missingActions}>
            <PrimaryBar label="View my orders" tone="white" onPress={() => router.replace('/orders')} accessibilityLabel="View my orders" />
            <PressableScale onPress={() => router.dismissTo('/')} activeScale={0.96} accessibilityLabel="Back to home" style={styles.home}>
              <Text style={styles.homeText} color={withAlpha(c.white, 0.7)}>
                Back to home
              </Text>
            </PressableScale>
          </Animated.View>
        </>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.night },
  glow: { ...StyleSheet.absoluteFill, pointerEvents: 'none' },
  content: { flexGrow: 1, paddingHorizontal: spacing.gutter },
  piece: { position: 'absolute' },
  pool: { position: 'absolute' },
  copy: { paddingHorizontal: 4 },
  check: {
    width: CHECK,
    height: CHECK,
    borderRadius: CHECK / 2,
    backgroundColor: c.sage,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  title: { marginTop: 16 },
  order: { ...typeScale.display, fontSize: 56, lineHeight: 58 },
  orderTight: { fontSize: 44, lineHeight: 48 },
  placed: { fontFamily: fonts.serif, fontSize: 60, lineHeight: 64, marginTop: -6 },
  placedTight: { fontSize: 48, lineHeight: 52 },
  line: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, marginTop: 14 },
  codeBlock: { marginTop: spacing.lg },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  codeRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  codeChars: { flexDirection: 'row' },
  codeCell: { height: typeScale.code.lineHeight, overflow: 'hidden' },
  code: { ...typeScale.code },
  number: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, marginBottom: 8 },
  numberOnly: { marginTop: spacing.md },
  done: { position: 'absolute', right: 10, height: 44, minWidth: 64, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  doneText: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20 },
  actions: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.gutter },
  home: { height: 48, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs },
  homeText: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
  missing: { justifyContent: 'center', paddingHorizontal: spacing.gutter },
  missingTitle: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 32 },
  missingBody: { marginTop: spacing.xs, maxWidth: 320, alignSelf: 'center' },
  missingActions: { marginTop: spacing.xl, alignSelf: 'stretch' },
}));
