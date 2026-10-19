/**
 * "The beans" card for coffee (design-refs A2 #4 + #5): origin line, tasting-note pills,
 * a roast meter of 5 bean dots and acidity / body / sweetness bars of 5 segments.
 * Beans pop in and the bars fill left → right on mount (UI thread; instant under Reduce Motion).
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  clamp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { easeOutQuint, popIn, withAlpha } from '@/components/motion';
import { Icon, Text } from '@/components/ui';
import { fonts, makeStyles, radii, spacing, useColors } from '@/theme';
import type { Product } from '@/types/models';

type CoffeeDetails = NonNullable<Product['coffee']>;

const ROAST_LABELS = ['Light', 'Medium-light', 'Medium', 'Medium-dark', 'Dark'] as const;
const SEGMENTS = 5;
const LABEL_WIDTH = 76;
/** Bars start filling once the sheet has settled. */
const FILL_DELAY = 520;

export interface CoffeeProfileProps {
  coffee: CoffeeDetails;
}

export function CoffeeProfile({ coffee }: CoffeeProfileProps) {
  const c = useColors();
  const styles = useStyles();
  const roastLabel = ROAST_LABELS[coffee.roast - 1] ?? 'Medium';
  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <Text variant="h3">The beans</Text>
        <Text variant="caption" color={c.inkSoft}>
          Roasted in-house weekly
        </Text>
      </View>

      <View style={styles.origin}>
        <Icon name="location-outline" size={15} color={c.roastText} />
        <Text variant="caption" color={c.inkSoft} style={styles.originText}>
          {coffee.origin}
        </Text>
      </View>

      <View style={styles.notes}>
        {coffee.notes.map((note) => (
          <View key={note} style={styles.note}>
            <View style={styles.noteDot} />
            <Text style={styles.noteText}>{note}</Text>
          </View>
        ))}
      </View>

      <View style={styles.meters}>
        <View style={styles.meterRow} accessible accessibilityLabel={`Roast: ${roastLabel}`}>
          <Text variant="caption" color={c.inkSoft} style={styles.meterLabel}>
            Roast
          </Text>
          <View style={styles.beans}>
            {Array.from({ length: SEGMENTS }, (_, i) => (
              <Animated.View key={i} entering={popIn(6 + i)}>
                <BeanDot filled={i < coffee.roast} />
              </Animated.View>
            ))}
          </View>
          <Text style={styles.meterValue}>{roastLabel}</Text>
        </View>
        <TasteBar label="Acidity" value={coffee.acidity} delay={FILL_DELAY} />
        <TasteBar label="Body" value={coffee.body} delay={FILL_DELAY + 90} />
        <TasteBar label="Sweetness" value={coffee.sweetness} delay={FILL_DELAY + 180} />
      </View>
    </View>
  );
}

function BeanDot({ filled }: { filled: boolean }) {
  const c = useColors();
  const styles = useStyles();
  // A graphic, not a fill under text: `roastText` keeps the earned beans at ≥ 3:1 on the dark card.
  const fill = filled ? c.roastText : c.line;
  const crease = filled ? withAlpha(c.white, 0.55) : c.surface;
  return (
    <View style={styles.bean}>
      <Svg width={14} height={18} viewBox="0 0 14 18">
        <Ellipse cx={7} cy={9} rx={5.6} ry={8} fill={fill} />
        <Path d="M7.8 1.8 C 4.6 5.6, 9.8 11.6, 6.2 16.2" stroke={crease} strokeWidth={1.3} strokeLinecap="round" fill="none" />
      </Svg>
    </View>
  );
}

function TasteBar({ label, value, delay }: { label: string; value: number; delay: number }) {
  const c = useColors();
  const styles = useStyles();
  const level = clamp(Math.round(value), 0, SEGMENTS);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(withDelay(delay, withTiming(level, { duration: 360 + level * 110, easing: easeOutQuint })));
  }, [progress, level, delay]);

  return (
    <View style={styles.meterRow} accessible accessibilityLabel={`${label}: ${level} of ${SEGMENTS}`}>
      <Text variant="caption" color={c.inkSoft} style={styles.meterLabel}>
        {label}
      </Text>
      <View style={styles.segments}>
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <Segment key={i} index={i} progress={progress} />
        ))}
      </View>
    </View>
  );
}

function Segment({ index, progress }: { index: number; progress: SharedValue<number> }) {
  const styles = useStyles();
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: clamp(progress.get() - index, 0, 1) }],
  }));
  return (
    <View style={styles.segment}>
      <Animated.View style={[styles.segmentFill, fillStyle]} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    backgroundColor: c.bg,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  headRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  origin: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  originText: { flex: 1 },
  notes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    paddingHorizontal: 11,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
  },
  noteDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.peach },
  noteText: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: c.ink },
  meters: { gap: 10, marginTop: spacing.xxs },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 20 },
  meterLabel: { width: LABEL_WIDTH },
  beans: { flex: 1, flexDirection: 'row', gap: 6 },
  bean: { transform: [{ rotate: '22deg' }] },
  meterValue: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, color: c.ink },
  segments: { flex: 1, flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 6, borderRadius: 3, backgroundColor: c.line, overflow: 'hidden' },
  segmentFill: { ...StyleSheet.absoluteFill, backgroundColor: c.ink, transformOrigin: 'left' },
}));
