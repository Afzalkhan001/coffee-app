import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, type EntryExitAnimationFunction } from 'react-native-reanimated';
import { enterFade, exitFade, layoutSpring, popIn, reducedMotionAtLaunch, riseEntrance, RollingNumber, withAlpha } from '@/components/motion';
import { NotchBite, Text } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { formatTotalsLine, totalsBreakdown } from '@/lib/pricing';
import { TAX_LINE_LABEL } from '@/theme/brand';
import { fonts, makeStyles, radii, springs, type as typeScale, useColors } from '@/theme';
import type { OrderMode, OrderTotals } from '@/types/models';
import { ArtCluster, type ArtClusterPiece } from './productArt';

/** Cart dock card height (R3 cart: 140h, r30). */
export const SUMMARY_DOCK_HEIGHT = 140;
const PAD = 22;
const NOTCH_W = 60;
const NOTCH_D = 10;
/**
 * The cut-outs sit in a box on the card's bottom edge: its right edge runs `CLUSTER_BLEED` past the
 * card (they bleed off the bottom-right corner), and it never starts closer than `CLUSTER_GAP` to
 * the measured total — a wide total pushes the cluster further off the card instead of under it.
 */
const CLUSTER_H = 110;
const CLUSTER_BLEED = 14;
const CLUSTER_GAP = 12;

/** Peach-card cut-out layouts for 1–3 items (rotations −10° / 8° / −4°), from the cluster box's left. */
const CLUSTER_LAYOUTS: Record<1 | 2 | 3, ArtClusterPiece[]> = {
  1: [{ size: 100, x: 0, y: 8, rotate: -10 }],
  2: [
    { size: 92, x: 0, y: 14, rotate: -10, z: 2 },
    { size: 84, x: 60, y: 26, rotate: 8, z: 1 },
  ],
  3: [
    { size: 88, x: 0, y: 20, rotate: -10, z: 3 },
    { size: 80, x: 52, y: 30, rotate: 8, z: 2 },
    { size: 72, x: 98, y: 40, rotate: -4, z: 1 },
  ],
};

function clusterSpan(layout: readonly ArtClusterPiece[]): number {
  return layout.reduce((w, p) => Math.max(w, p.x + p.size), 0);
}

/** R3.C5: a removed line's cut-out scales to 0.6 and fades (web / Reduce Motion: a plain fade). */
const pieceExit: EntryExitAnimationFunction | typeof exitFade =
  Platform.OS === 'web' || reducedMotionAtLaunch
    ? exitFade
    : () => {
        'worklet';
        return {
          initialValues: { opacity: 1, transform: [{ scale: 1 }] },
          animations: { opacity: withTiming(0, { duration: 200 }), transform: [{ scale: withTiming(0.6, { duration: 220 }) }] },
        };
      };
/** Cluster pieces pop in with a 60ms stagger. */
const pieceEnter = (i: number) => popIn().delay(120 + i * 60);

export interface SummaryCardProps {
  totals: OrderTotals;
  /** Line images: up to three unique cut-outs bleed off the card's bottom-right. */
  itemImages?: string[];
  /** When 'delivery', the delivery fee shows even when free; otherwise only when a fee applies. */
  mode?: OrderMode;
  /**
   * `full` (default, checkout): Subtotal / Discount / Packaging / GST (5%) / Delivery fee / Delivery
   * partner tip rows (`totalsBreakdown`), then the 44px total.
   * `dock` (cart): a fixed 140px card — at most two breakdown pills, "Total" and the 44px total, a
   * small top notch, rising 24px on mount.
   */
  variant?: 'full' | 'dock';
  /** Dock only: the colour behind the card, used to cut the top notch (default the canvas). */
  notchColor?: string;
  style?: StyleProp<ViewStyle>;
}

interface Breakdown {
  label: string;
  value: string;
  tone?: 'saved';
}

/** The dock's two pills: Saved, Delivery, GST, then Packaging, in that priority (GST stays visible). */
function breakdown(totals: OrderTotals, mode?: OrderMode): Breakdown[] {
  const rows: Breakdown[] = [];
  if (totals.discount > 0) rows.push({ label: 'Saved', value: `−${formatMoney(totals.discount)}`, tone: 'saved' });
  if (mode === 'delivery' || totals.deliveryFee > 0) {
    rows.push({ label: 'Delivery', value: totals.deliveryFee === 0 ? 'Free' : formatMoney(totals.deliveryFee) });
  }
  rows.push({ label: TAX_LINE_LABEL, value: formatMoney(totals.tax) });
  if ((totals.packaging ?? 0) > 0) rows.push({ label: 'Packaging', value: formatMoney(totals.packaging ?? 0) });
  return rows.slice(0, 2);
}

/**
 * Ref-1 peach summary card (R3): ink copy on peach (white fails contrast), the total as a 44px
 * rolling odometer, and the order's cut-outs overlapping off the bottom-right corner (no rings).
 * The peach card is the same in both schemes, so its copy is `inkFixed`; only the notch (drawn in
 * the canvas colour behind the card) follows the scheme.
 */
export function SummaryCard({ totals, itemImages = [], mode, variant = 'full', notchColor, style }: SummaryCardProps) {
  const c = useColors();
  const styles = useStyles();
  const notch = notchColor ?? c.bg;
  const [cardWidth, setCardWidth] = useState(0);
  const [totalRight, setTotalRight] = useState(0);
  const count = Math.min(3, new Set(itemImages).size);
  const totalLabel = `Total ${formatMoney(totals.total)}`;
  const onCardLayout = (e: LayoutChangeEvent) => setCardWidth(Math.round(e.nativeEvent.layout.width));
  const onTotalLayout = (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setTotalRight(Math.ceil(x + width));
  };

  const cluster =
    count > 0 && cardWidth > 0 && totalRight > 0 ? (
      <ClusterSlot images={itemImages} count={count as 1 | 2 | 3} cardWidth={cardWidth} totalRight={totalRight} />
    ) : null;

  const total = (
    <View accessible accessibilityLabel={totalLabel}>
      <Text style={styles.totalLabel} color={withAlpha(c.inkFixed, 0.72)}>
        Total
      </Text>
      <RollingNumber
        value={totals.total}
        money
        fontSize={typeScale.priceHero.fontSize}
        lineHeight={typeScale.priceHero.lineHeight}
        fontFamily={fonts.bold}
        color={c.inkFixed}
      />
    </View>
  );

  if (variant === 'dock') {
    const pills = breakdown(totals, mode);
    return (
      <Animated.View entering={riseEntrance({ distance: 24 })} onLayout={onCardLayout} style={[styles.card, styles.dock, style]}>
        {cluster}
        {cardWidth > 0 ? <NotchBite width={NOTCH_W} depth={NOTCH_D} color={notch} style={{ left: (cardWidth - NOTCH_W) / 2 }} /> : null}
        <View style={styles.pills}>
          {pills.map((p) => (
            <View key={p.label} style={styles.pillPair} accessible accessibilityLabel={`${p.label} ${p.value}`}>
              <Text style={styles.breakLabel} color={withAlpha(c.inkFixed, 0.72)}>
                {p.label}
              </Text>
              <View style={styles.pill}>
                <Text style={styles.pillText} color={p.tone === 'saved' ? c.sageDeep : c.inkFixed}>
                  {p.value}
                </Text>
              </View>
            </View>
          ))}
        </View>
        <View style={styles.dockTotal} onLayout={onTotalLayout}>
          {total}
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View layout={layoutSpring} onLayout={onCardLayout} style={[styles.card, styles.full, style]}>
      {cluster}
      {totalsBreakdown(totals, mode).map((line) =>
        // Rows that come and go with a choice (a code, a tip) fade in; the rest are fixed.
        line.key === 'discount' || line.key === 'tip' ? (
          <Animated.View key={line.key} entering={enterFade()} exiting={exitFade}>
            <Row label={line.label} value={formatTotalsLine(line)} tone={line.key === 'discount' ? 'saved' : undefined} />
          </Animated.View>
        ) : (
          <Row key={line.key} label={line.label} value={formatTotalsLine(line)} />
        ),
      )}
      <View style={styles.fullTotal} onLayout={onTotalLayout}>
        {total}
      </View>
    </Animated.View>
  );
}

/**
 * The cut-out cluster on the card's bottom edge, clear of the total: as far right as the bleed
 * allows, pushed further off the card when the total is wide. Glides (spring) when the total's
 * width or the item count changes.
 */
function ClusterSlot({ images, count, cardWidth, totalRight }: { images: string[]; count: 1 | 2 | 3; cardWidth: number; totalRight: number }) {
  const layout = CLUSTER_LAYOUTS[count];
  const span = clusterSpan(layout);
  const left = Math.max(cardWidth + CLUSTER_BLEED - span, totalRight + CLUSTER_GAP);
  const x = useSharedValue(left);
  useEffect(() => {
    x.set(withSpring(left, springs.smooth));
  }, [left, x]);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const styles = useStyles();
  return (
    <Animated.View style={[styles.clusterBox, { width: span }, slide]}>
      <ArtCluster images={images} layout={layout} shadow={false} entering={pieceEnter} exiting={pieceExit} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'saved' }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label} ${value}`}>
      <Text style={styles.breakLabel} color={withAlpha(c.inkFixed, 0.72)}>
        {label}
      </Text>
      <Text style={styles.rowValue} color={tone === 'saved' ? c.sageDeep : c.inkFixed}>
        {value}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: { backgroundColor: c.peach, borderRadius: radii.banner, overflow: 'hidden' },
  dock: { height: SUMMARY_DOCK_HEIGHT },
  full: { paddingHorizontal: PAD, paddingTop: 18, paddingBottom: 20 },
  clusterBox: { position: 'absolute', left: 0, bottom: 0, height: CLUSTER_H, pointerEvents: 'none' },
  pills: { position: 'absolute', left: PAD, top: 20, flexDirection: 'row', alignItems: 'center', gap: 14 },
  pillPair: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  breakLabel: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  pill: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: withAlpha(c.white, 0.4),
    justifyContent: 'center',
  },
  pillText: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 17 },
  dockTotal: { position: 'absolute', left: PAD, top: 62 },
  totalLabel: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 28 },
  rowValue: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
  fullTotal: { marginTop: 12, alignSelf: 'flex-start' },
}));
