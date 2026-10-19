import { useEffect, useRef } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useValueChange } from '@/components/domain';
import { enterUp } from '@/components/motion';
import { Icon, Text } from '@/components/ui';
import { fonts, makeStyles, radii, springs, useColors } from '@/theme';
import { STAMP_SLOTS, stampState } from './format';

const STAMP_STAGGER = 55;
const ENTRANCE_DELAY = 260;
const SLOT = 26;

export interface StampCardProps {
  /** Completed orders: one stamp each, a free drink every 10th. */
  completedOrders: number;
  index?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Stamps (DESIGN.md §R3.B "Rewards"): one white sheet with a single row of ten 26px slots, earned =
 * roast with a white cup, empty = dashed, the 10th = peach with a gift. The newest stamp pops.
 */
export function StampCard({ completedOrders, index = 0, style }: StampCardProps) {
  const c = useColors();
  const styles = useStyles();
  const { stamps, caption } = stampState(completedOrders);

  return (
    <Animated.View entering={enterUp(index)} style={[styles.card, style]}>
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          Stamps
        </Text>
        <Text style={styles.tally} color={c.inkSoft} accessibilityLabel={`${stamps} of ${STAMP_SLOTS} stamps`}>
          {`${stamps} of ${STAMP_SLOTS}`}
        </Text>
      </View>

      <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {Array.from({ length: STAMP_SLOTS }, (_, i) => (
          <Stamp key={i} slot={i} filled={i < stamps} newest={i === stamps - 1} />
        ))}
      </View>

      <Text style={styles.caption} color={c.inkSoft}>
        {caption}
      </Text>
    </Animated.View>
  );
}

function Stamp({ slot, filled, newest }: { slot: number; filled: boolean; newest: boolean }) {
  const c = useColors();
  const styles = useStyles();
  const free = slot === STAMP_SLOTS - 1;
  // Hand-stamped look: each stamp lands at its own small angle.
  const tilt = ((slot * 37) % 17) - 8;
  const scale = useSharedValue(filled ? 0.3 : 1);
  const entered = useRef(false);

  // Mount-only entrance (live changes are handled by useValueChange below).
  useEffect(() => {
    if (entered.current) return;
    entered.current = true;
    if (!filled) return;
    const delay = ENTRANCE_DELAY + slot * STAMP_STAGGER;
    scale.set(
      newest
        ? withDelay(delay + 120, withSequence(withSpring(1.3, springs.snappy), withSpring(1, springs.snappy)))
        : withDelay(delay, withSpring(1, springs.snappy)),
    );
  }, [filled, newest, slot, scale]);

  useValueChange(filled, (next) => {
    if (!next) {
      scale.set(withSpring(1, springs.snappy));
      return;
    }
    // Silent: a decorative pop (the order's own `success` already marked the moment).
    scale.set(withSequence(withTiming(0.6, { duration: 0 }), withSpring(1.3, springs.snappy), withSpring(1, springs.snappy)));
  });

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }, { rotate: `${filled ? tilt : 0}deg` }] }));

  return (
    <Animated.View style={[styles.stamp, filled ? styles.stampFilled : free ? styles.stampFree : styles.stampEmpty, style]}>
      {filled ? (
        <Icon name="cafe" size={14} color={c.white} />
      ) : free ? (
        <Icon name="gift" size={14} color={c.white} />
      ) : null}
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  card: { backgroundColor: c.surface, borderRadius: radii.lg, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 18 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  title: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: c.ink },
  tally: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 18 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  stamp: { width: SLOT, height: SLOT, borderRadius: SLOT / 2, alignItems: 'center', justifyContent: 'center' },
  stampFilled: { backgroundColor: c.roast },
  stampEmpty: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.line },
  stampFree: { backgroundColor: c.peach },
  caption: { marginTop: 14, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
}));
