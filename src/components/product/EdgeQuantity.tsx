/**
 * Ref-1 quantity row: "−" and "+" sit in 60px canvas circles centred ON the sheet's left and right
 * edges (half of each circle is off screen, so they read as bumps cut into the sheet), with the
 * glyph in the visible half, and the count in a 52×36 canvas pill in the middle (a rolling 17/700
 * digit). Each bump presses to 0.9 (`snappy`) with a `tick`; disabled at the bounds.
 * Lay it out at the sheet's full width (it does not clip itself).
 */
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { RollingNumber } from '@/components/motion';
import { Icon, PressableScale } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { fonts, makeStyles, useColors } from '@/theme';

const BUMP = 60;
const PILL_W = 52;
const PILL_H = 36;
/** Widen the visible half-circle's hit area to 44px on the inner side. */
const HIT = { top: 0, bottom: 0, left: 0, right: 14 } as const;
const HIT_RIGHT = { top: 0, bottom: 0, left: 14, right: 0 } as const;

export interface EdgeQuantityProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max: number;
  style?: StyleProp<ViewStyle>;
}

export function EdgeQuantity({ value, onChange, min = 1, max, style }: EdgeQuantityProps) {
  const c = useColors();
  const styles = useStyles();
  const atMin = value <= min;
  const atMax = value >= max;
  const step = (delta: number) => {
    const next = Math.min(max, Math.max(min, value + delta));
    if (next === value) return;
    haptic.tick();
    onChange(next);
  };

  return (
    <View
      style={[styles.row, style]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Quantity"
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
    >
      <PressableScale
        onPress={() => step(-1)}
        disabled={atMin}
        hapticKind={null}
        activeScale={0.9}
        hitSlop={HIT}
        accessibilityLabel="Decrease quantity"
        style={[styles.bump, styles.left, atMin ? styles.off : null]}
      >
        <Icon name="remove" size={20} color={c.ink} />
      </PressableScale>

      <View style={styles.pill}>
        <RollingNumber value={value} decimals={0} fontSize={17} lineHeight={22} fontFamily={fonts.bold} color={c.ink} />
      </View>

      <PressableScale
        onPress={() => step(1)}
        disabled={atMax}
        hapticKind={null}
        activeScale={0.9}
        hitSlop={HIT_RIGHT}
        accessibilityLabel="Increase quantity"
        style={[styles.bump, styles.right, atMax ? styles.off : null]}
      >
        <Icon name="add" size={20} color={c.ink} />
      </PressableScale>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: { height: BUMP, alignItems: 'center', justifyContent: 'center' },
  bump: {
    position: 'absolute',
    top: 0,
    width: BUMP,
    height: BUMP,
    borderRadius: BUMP / 2,
    backgroundColor: c.bg,
    justifyContent: 'center',
  },
  // The glyph sits in the visible half: centred 15px in from the screen edge.
  left: { left: -BUMP / 2, alignItems: 'flex-end', paddingRight: BUMP / 4 - 10 },
  right: { right: -BUMP / 2, alignItems: 'flex-start', paddingLeft: BUMP / 4 - 10 },
  off: { opacity: 0.45 },
  pill: {
    width: PILL_W,
    height: PILL_H,
    borderRadius: PILL_H / 2,
    backgroundColor: c.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
