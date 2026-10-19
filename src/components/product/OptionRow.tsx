/**
 * Options of a modifier group (ref 2 options list, R3.B product detail):
 *  - `OptionRow`: a 52px row inside an expanded group — radio for single-select, rounded checkbox
 *    for multi-select, name on the left, "+₹40" on the right, hairlines between rows.
 *  - `OptionTile`: a half-width 52px tile for an always-open required group (Temperature): 1px
 *    `line`, r16; selected = 1.5px ink + a filled radio.
 * Unavailable options are greyed with "Unavailable". Controls spring (`snappy`) on the UI thread.
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { Icon, PressableScale, Text } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { fonts, makeStyles, spacing, springs, useColors } from '@/theme';
import type { ModifierOption } from '@/types/models';

const CONTROL = 20;

export interface OptionRowProps {
  option: ModifierOption;
  kind: 'radio' | 'checkbox';
  selected: boolean;
  onPress: () => void;
  /** Hide the divider under the last row. */
  last?: boolean;
}

export function OptionRow({ option, kind, selected, onPress, last }: OptionRowProps) {
  const c = useColors();
  const styles = useStyles();
  const disabled = !option.isAvailable;
  const on = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    on.set(withSpring(selected ? 1 : 0, springs.snappy));
  }, [selected, on]);

  const price = option.priceDelta > 0 ? `+${formatMoney(option.priceDelta)}` : null;

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      hapticKind={null}
      activeScale={0.985}
      accessibilityRole={kind === 'radio' ? 'radio' : 'checkbox'}
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={[option.name, price, disabled ? 'unavailable' : null].filter(Boolean).join(', ')}
      style={[styles.row, last ? null : styles.divider]}
    >
      <View style={disabled ? styles.dim : null}>
        {kind === 'radio' ? <RadioMark on={on} /> : <CheckMark on={on} />}
      </View>
      <Text
        style={[styles.name, selected ? styles.nameOn : null]}
        color={disabled ? c.inkMuted : c.ink}
        numberOfLines={1}
      >
        {option.name}
      </Text>
      {disabled ? (
        <Text variant="caption" color={c.inkMuted}>
          Unavailable
        </Text>
      ) : price ? (
        <Text style={styles.price} color={selected ? c.ink : c.inkSoft}>
          {price}
        </Text>
      ) : null}
    </PressableScale>
  );
}

export interface OptionTileProps {
  option: ModifierOption;
  selected: boolean;
  onPress: () => void;
}

export function OptionTile({ option, selected, onPress }: OptionTileProps) {
  const c = useColors();
  const styles = useStyles();
  const disabled = !option.isAvailable;
  const on = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    on.set(withSpring(selected ? 1 : 0, springs.snappy));
  }, [selected, on]);

  const price = option.priceDelta > 0 ? `+${formatMoney(option.priceDelta)}` : null;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      hapticKind={null}
      activeScale={0.97}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={[option.name, price, disabled ? 'unavailable' : null].filter(Boolean).join(', ')}
      style={[styles.tile, selected ? styles.tileOn : null, disabled ? styles.dim : null]}
    >
      <RadioMark on={on} filled />
      <Text style={[styles.tileName, selected ? styles.nameOn : null]} color={c.ink} numberOfLines={1}>
        {option.name}
      </Text>
      {price ? (
        <Text style={styles.tilePrice} color={c.inkSoft}>
          {price}
        </Text>
      ) : null}
    </PressableScale>
  );
}

function RadioMark({ on, filled = false }: { on: SharedValue<number>; filled?: boolean }) {
  const c = useColors();
  const styles = useStyles();
  const idle = c.line;
  const active = c.ink;
  const face = c.surface;
  const ringStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(Math.min(1, on.get()), [0, 1], [idle, active]),
    backgroundColor: filled ? interpolateColor(Math.min(1, on.get()), [0, 1], [face, active]) : 'transparent',
  }));
  const dotStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, on.get() * 2),
    transform: [{ scale: on.get() }],
  }));
  return (
    <Animated.View style={[styles.radio, ringStyle]}>
      <Animated.View style={[filled ? styles.radioDotFilled : styles.radioDot, dotStyle]} />
    </Animated.View>
  );
}

function CheckMark({ on }: { on: SharedValue<number> }) {
  const c = useColors();
  const styles = useStyles();
  const idle = c.line;
  const active = c.ink;
  const boxStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(Math.min(1, on.get()), [0, 1], [idle, active]),
  }));
  const fillStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, on.get() * 1.6),
    transform: [{ scale: 0.4 + 0.6 * on.get() }],
  }));
  return (
    <Animated.View style={[styles.check, boxStyle]}>
      <Animated.View style={[styles.checkFill, fillStyle]}>
        <Icon name="checkmark" size={15} color={c.onInk} />
      </Animated.View>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingVertical: spacing.sm,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: c.line },
  dim: { opacity: 0.5 },
  name: { flex: 1, fontFamily: fonts.regular, fontSize: 15, lineHeight: 20 },
  nameOn: { fontFamily: fonts.medium },
  price: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 18 },
  radio: {
    width: CONTROL,
    height: CONTROL,
    borderRadius: CONTROL / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.ink },
  radioDotFilled: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.onInk },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
  },
  // 0.5px more border comes out of the padding, so the content never shifts.
  tileOn: { borderWidth: 1.5, borderColor: c.ink, paddingHorizontal: 13.5 },
  tileName: { flex: 1, fontFamily: fonts.regular, fontSize: 15, lineHeight: 20 },
  tilePrice: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  check: {
    width: CONTROL,
    height: CONTROL,
    borderRadius: 7,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  checkFill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: c.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
