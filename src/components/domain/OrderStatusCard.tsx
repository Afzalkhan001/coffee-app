import { router } from 'expo-router';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { enterUp, PulseRing, withAlpha } from '@/components/motion';
import { Icon, PressableScale, Text } from '@/components/ui';
import { pluralize } from '@/lib/format';
import { MODE_META, statusLabel, statusProgress } from '@/lib/orderFlow';
import { pickupCode, usesPickupCode } from '@/lib/pickupCode';
import { fonts, makeStyles, makeThemed, radii, spacing, useColors } from '@/theme';
import type { Order } from '@/types/models';
import { staggerIndex, useNow, useValueChange } from './hooks';
import { etaLabel, flowPosition, orderImages } from './orderText';
import { ArtStack, ProductArt } from './productArt';

const easeOutQuint = Easing.bezier(0.22, 1, 0.36, 1);

/**
 * - `hero` (default): the `night` card — the first active order on Orders (in dark, the warm
 *   `espresso` card, so the lead order still stands apart from the canvas and the `surface` cards).
 * - `light`: the same card on `surface`, for further active orders.
 * - `compact`: the Home active-order strip (`capsule`: ink in light, lifted espresso in dark; 64h,
 *   r22): a 54px cut-out overflowing the top, "Preparing · ready in ~6 min", a 3px progress bar,
 *   "+N" and a chevron. White content in both schemes.
 */
export type OrderStatusCardVariant = 'hero' | 'light' | 'compact';

export interface OrderStatusCardProps {
  order: Order;
  /** Default: push the tracking screen /order/[id]. */
  onPress?: () => void;
  /** Staggered entrance index. */
  index?: number;
  variant?: OrderStatusCardVariant;
  /** Compact only: how many OTHER active orders there are ("+2" before the chevron). */
  more?: number;
  style?: StyleProp<ViewStyle>;
}

interface Palette {
  bg: string;
  title: string;
  meta: string;
  track: string;
  fill: string;
  codeBg: string;
  codeLabel: string;
  shadow: 'light' | 'dark';
}

const usePalettes = makeThemed(
  (c, t): Record<'hero' | 'light', Palette> => ({
    hero: {
      bg: t.isDark ? c.espresso : c.night,
      title: c.white,
      meta: withAlpha(c.white, 0.6),
      track: withAlpha(c.white, 0.15),
      fill: c.peach,
      codeBg: withAlpha(c.white, 0.1),
      codeLabel: withAlpha(c.white, 0.6),
      shadow: 'dark',
    },
    light: {
      bg: c.surface,
      title: c.ink,
      meta: c.inkSoft,
      track: c.line,
      fill: c.ink,
      codeBg: c.bg,
      codeLabel: c.inkSoft,
      shadow: 'light',
    },
  }),
);

/** Live-order card (Orders) and strip (Home): status, ETA, progress, cut-outs and the pickup code. The whole card taps through. */
export function OrderStatusCard({ order, onPress, index = 0, variant = 'hero', more = 0, style }: OrderStatusCardProps) {
  const now = useNow(30_000, `${order.id}:${order.status}`);
  const c = useColors();
  const styles = useStyles();
  const palettes = usePalettes();
  const mode = order.details.mode;
  const label = statusLabel(order.status, mode);
  const eta = etaLabel(order, now);
  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);

  const open = onPress ?? (() => router.push({ pathname: '/order/[id]', params: { id: order.id } }));
  const a11y = `Order ${order.number}, ${label}, ${eta}`;

  if (variant === 'compact') {
    const thumb = order.items[0]?.image;
    return (
      <Animated.View entering={enterUp(staggerIndex(index))} style={style}>
        <PressableScale
          onPress={open}
          activeScale={0.98}
          style={styles.strip}
          accessibilityLabel={more > 0 ? `${a11y}, and ${more} more active ${more === 1 ? 'order' : 'orders'}` : a11y}
          accessibilityHint={more > 0 ? 'Opens your orders' : 'Opens order tracking'}
        >
          <View style={styles.stripCopy}>
            <Text style={styles.stripTitle} color={c.white} numberOfLines={1}>
              {label}
              <Text style={styles.stripEta} color={withAlpha(c.white, 0.6)}>{` · ${eta.charAt(0).toLowerCase()}${eta.slice(1)}`}</Text>
            </Text>
            <ProgressLine value={statusProgress(mode, order.status)} />
          </View>
          {more > 0 ? (
            <Text style={styles.stripMore} color={withAlpha(c.white, 0.6)}>{`+${more}`}</Text>
          ) : null}
          <Icon name="chevron-forward" size={20} color={c.white} />
          {thumb ? <ProductArt image={thumb} size={STRIP_ART} shadow={false} style={styles.stripArt} /> : null}
        </PressableScale>
      </Animated.View>
    );
  }

  const p = palettes[variant];
  const { index: step, total } = flowPosition(order);
  const segments = Math.max(1, total - 1);
  const code = usesPickupCode(mode) ? pickupCode(order.number) : null;

  return (
    <Animated.View entering={enterUp(staggerIndex(index))} style={style}>
      <PressableScale
        onPress={open}
        activeScale={0.98}
        style={[styles.card, { backgroundColor: p.bg }]}
        accessibilityLabel={code ? `${a11y}, pickup code ${code}` : a11y}
        accessibilityHint="Opens order tracking"
      >
        <View style={styles.copy}>
          <View style={styles.liveRow}>
            <View style={styles.liveDot}>
              <PulseRing size={10} color={c.sage} active />
              <View style={styles.liveCore} />
            </View>
            <Text style={styles.meta} color={p.meta} numberOfLines={1}>
              {`${MODE_META[mode].short} · ${order.number}`}
            </Text>
          </View>
          <Text style={styles.status} color={p.title} numberOfLines={2}>
            {label}
          </Text>
          <Text style={styles.meta} color={p.meta} numberOfLines={1}>
            {`${eta} · ${pluralize(itemCount, 'item')}`}
          </Text>
          <View style={styles.track}>
            {Array.from({ length: segments }, (_, i) => (
              <Segment key={i} filled={i < step} active={i === step} track={p.track} fill={p.fill} />
            ))}
          </View>
        </View>

        <View style={styles.side}>
          <ArtStack images={orderImages(order)} size={64} max={2} overlap={22} shadow={p.shadow} />
          {code ? (
            <View style={[styles.code, { backgroundColor: p.codeBg }]}>
              <Text style={styles.codeLabel} color={p.codeLabel}>
                Code
              </Text>
              <Text style={styles.codeValue} color={p.title}>
                {code}
              </Text>
            </View>
          ) : null}
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const STRIP_ART = 54;

/** Continuous 3px bar (Home strip): peach on white 15%, eased when the order advances. */
function ProgressLine({ value }: { value: number }) {
  const target = Math.max(0.06, Math.min(1, value));
  const fill = useSharedValue(target);
  useValueChange(target, (next) => {
    fill.set(withTiming(next, { duration: 520, easing: easeOutQuint }));
  });
  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.get() }] }));
  const styles = useStyles();
  return (
    <View style={styles.line}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.lineFill, fillStyle]} />
    </View>
  );
}

/** One progress segment: fills left→right with a timing sweep when the order advances. */
function Segment({ filled, active, track, fill: fillColor }: { filled: boolean; active: boolean; track: string; fill: string }) {
  const target = filled ? 1 : active ? 0.4 : 0;
  const fill = useSharedValue(target);

  useValueChange(target, (next) => {
    fill.set(withTiming(next, { duration: 520, easing: easeOutQuint }));
  });

  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.get() }] }));
  const styles = useStyles();

  return (
    <View style={[styles.segment, { backgroundColor: track }]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.segmentFill, { backgroundColor: fillColor }, fillStyle]} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  copy: { flex: 1, minWidth: 0, justifyContent: 'center' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  liveCore: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: c.sage },
  meta: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  status: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, marginTop: 4, marginBottom: 2 },
  track: { flexDirection: 'row', gap: 6, marginTop: spacing.md },
  segment: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  segmentFill: { borderRadius: 2, transformOrigin: 'left' },
  side: { alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.sm },
  code: { minWidth: 64, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, alignItems: 'center' },
  codeLabel: { fontFamily: fonts.medium, fontSize: 10, lineHeight: 12 },
  codeValue: { fontFamily: fonts.extrabold, fontSize: 22, lineHeight: 26 },
  // ── Home strip ──
  strip: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: 70,
    paddingRight: spacing.md,
    borderRadius: 22,
    backgroundColor: c.capsule,
  },
  stripArt: { position: 'absolute', left: 4, top: -4 },
  stripCopy: { flex: 1, minWidth: 0, paddingRight: spacing.xs },
  stripTitle: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
  stripEta: { fontFamily: fonts.regular, fontSize: 15 },
  stripMore: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  line: { height: 3, borderRadius: 1.5, marginTop: 8, backgroundColor: withAlpha(c.white, 0.15), overflow: 'hidden' },
  lineFill: { borderRadius: 1.5, backgroundColor: c.peach, transformOrigin: 'left' },
}));
