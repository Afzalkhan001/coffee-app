/**
 * S / M / L (ref 1, R3.B product detail): 58px circles 22 apart, the letter only (18/600), centred
 * on the sheet, with ONE caption under them for the selected size ("12 oz · +₹30"). A single ink
 * fill slides (and stretches mid-travel) between circles on a spring; each letter flips to white
 * exactly as the fill passes over it. The first pick pops the fill in place. After a failed add the
 * caption reads "*Choose a size" in ember.
 *
 * Every per-circle style reads the indicator through a `useDerivedValue` (`cover`), never through
 * a component-scope worklet helper: a mapper only subscribes to the shared values in its own
 * closure, so a helper that reads `pos` would freeze the letters at the last React render.
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  clamp,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { PressableScale, Text } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { fonts, makeStyles, springs, useColors } from '@/theme';
import type { ID, ModifierGroup, ModifierOption } from '@/types/models';

const D = 58;
const GAP = 22;
const PITCH = D + GAP;
/** Peak horizontal stretch of the indicator, reached mid-travel. */
const STRETCH = 0.14;

/** "12 oz · +₹30" for the selected size; "8, 12 or 16 oz" before a pick. */
export function sizeCaption(group: ModifierGroup, selectedId: ID | null): string {
  const option = group.options.find((o) => o.id === selectedId);
  if (option) {
    const delta = option.priceDelta > 0 ? `+${formatMoney(option.priceDelta)}` : null;
    return [option.caption ?? option.name, delta].filter(Boolean).join(' · ');
  }
  const caps = group.options.map((o) => o.caption).filter((c): c is string => !!c);
  if (caps.length === 0) return group.options.map((o) => o.name).join(' · ');
  const nums = caps.map((c) => c.replace(/\s*oz$/i, ''));
  const unit = caps.every((c) => /oz$/i.test(c)) ? ' oz' : '';
  return nums.length > 1 ? `${nums.slice(0, -1).join(', ')} or ${nums[nums.length - 1]}${unit}` : caps[0]!;
}

export interface SizeSelectorProps {
  group: ModifierGroup;
  selectedId: ID | null;
  onSelect: (optionId: ID) => void;
  /** A failed add pointed here: the caption asks for a size in ember. */
  alert?: boolean;
  /** Sold-out product: the circles stay visible for reference but can't be picked. */
  disabled?: boolean;
}

export function SizeSelector({ group, selectedId, onSelect, alert = false, disabled = false }: SizeSelectorProps) {
  const c = useColors();
  const styles = useStyles();
  const options = group.options;
  const count = options.length;
  const selectedIndex = options.findIndex((o) => o.id === selectedId);

  const pos = useSharedValue(Math.max(0, selectedIndex));
  const from = useSharedValue(Math.max(0, selectedIndex));
  const target = useSharedValue(Math.max(0, selectedIndex));
  const shown = useSharedValue(selectedIndex >= 0 ? 1 : 0);

  useEffect(() => {
    if (selectedIndex < 0) return;
    target.set(selectedIndex);
    // The stretch is measured along THIS slide; a retarget mid-flight starts a new one from here.
    from.set(pos.get());
    if (shown.get() === 0) {
      pos.set(selectedIndex); // first pick: pop in place, don't slide in from S
      from.set(selectedIndex);
      shown.set(withSpring(1, springs.snappy));
    } else {
      // `smooth`: snappy overshoots past the outer circles on an S ↔ L jump.
      pos.set(withSpring(selectedIndex, springs.smooth));
    }
  }, [selectedIndex, pos, from, target, shown]);

  const indicatorStyle = useAnimatedStyle(() => {
    const p = pos.get();
    const s = shown.get();
    // 0 at the start of the slide → peak mid-travel → 0 as it lands (no first-frame jump).
    const start = from.get();
    const span = Math.abs(target.get() - start);
    const f = span > 0 ? Math.min(Math.abs(p - start) / span, 1) : 1;
    const stretch = 1 + STRETCH * Math.sin(Math.PI * f);
    return {
      opacity: Math.min(s, 1),
      transform: [{ translateX: p * PITCH }, { scaleX: stretch }, { scale: 0.6 + 0.4 * s }],
    };
  });

  const caption = alert && selectedIndex < 0 ? `*Choose a ${group.name.toLowerCase()}` : sizeCaption(group, selectedId);

  return (
    <View style={styles.wrap}>
      <View
        style={[styles.row, { width: count * D + (count - 1) * GAP }, disabled ? styles.rowDisabled : null]}
        accessibilityRole="radiogroup"
        accessibilityLabel={group.name}
        accessibilityState={{ disabled }}
      >
        <Animated.View style={[styles.indicator, indicatorStyle]} />
        {options.map((option, i) => (
          <SizeCircle
            key={option.id}
            option={option}
            index={i}
            selected={i === selectedIndex}
            pos={pos}
            shown={shown}
            groupDisabled={disabled}
            onPress={() => onSelect(option.id)}
          />
        ))}
      </View>
      <Text
        style={[styles.caption, alert && selectedIndex < 0 ? styles.captionAlert : null]}
        color={alert && selectedIndex < 0 ? c.ember : c.inkSoft}
        align="center"
        accessibilityLiveRegion="polite"
      >
        {caption}
      </Text>
    </View>
  );
}

interface SizeCircleProps {
  option: ModifierOption;
  index: number;
  selected: boolean;
  pos: SharedValue<number>;
  shown: SharedValue<number>;
  groupDisabled: boolean;
  onPress: () => void;
}

function SizeCircle({ option, index, selected, pos, shown, groupDisabled, onPress }: SizeCircleProps) {
  const c = useColors();
  const styles = useStyles();
  const label = option.shortName ?? option.name.charAt(0);
  const unavailable = !option.isAvailable;
  const disabled = unavailable || groupDisabled;

  // 1 while the ink fill covers this circle. A derived value, so all three styles subscribe to it.
  const cover = useDerivedValue(() => clamp(1 - Math.abs(pos.get() - index), 0, 1) * Math.min(shown.get(), 1));
  const idleRing = c.line;
  const onRing = c.ink;
  const circleStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(cover.get(), [0, 1], [idleRing, onRing]),
  }));
  const inkLayer = useAnimatedStyle(() => ({ opacity: 1 - cover.get() }));
  const whiteLayer = useAnimatedStyle(() => ({ opacity: cover.get() }));

  const delta = option.priceDelta > 0 ? `+${formatMoney(option.priceDelta)}` : null;
  const a11y = [option.name, option.caption, delta, unavailable ? 'unavailable' : null].filter(Boolean).join(', ');

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      hapticKind={null}
      activeScale={0.92}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={a11y}
      style={unavailable ? styles.unavailable : null}
    >
      <Animated.View style={[styles.circle, circleStyle]}>
        <Animated.View style={[styles.face, inkLayer]}>
          <Text style={styles.letter} color={c.ink}>
            {label}
          </Text>
        </Animated.View>
        <Animated.View style={[styles.face, whiteLayer]}>
          <Text style={styles.letter} color={c.onInk}>
            {label}
          </Text>
        </Animated.View>
      </Animated.View>
    </PressableScale>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { alignItems: 'center' },
  row: { flexDirection: 'row', gap: GAP, height: D },
  rowDisabled: { opacity: 0.45 },
  indicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: D,
    height: D,
    borderRadius: D / 2,
    backgroundColor: c.ink,
  },
  unavailable: { opacity: 0.35 },
  circle: {
    width: D,
    height: D,
    borderRadius: D / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  face: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  letter: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 22 },
  caption: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, marginTop: 12 },
  captionAlert: { fontFamily: fonts.semibold },
}));
