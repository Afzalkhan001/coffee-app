import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cubicBezier, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { withAlpha } from '@/components/motion/color';
import { Icon, PressableScale, Text } from '@/components/ui';
import { MODE_META, ORDER_MODES } from '@/lib/orderFlow';
import { fonts, makeStyles, radii, spacing, springs, useColors } from '@/theme';
import type { OrderMode } from '@/types/models';

const GAP = spacing.sm;
/** One-line subtitles (R3: 13 `inkSoft`, never two lines). */
const SUBTITLE: Record<OrderMode, string> = {
  dine_in: 'At your table',
  pickup: 'Skip the queue',
  in_car: 'To your car',
  delivery: 'To your door',
};
const easeOutQuint = cubicBezier(0.22, 1, 0.36, 1);
const FADE = { transitionProperty: 'opacity', transitionDuration: 260, transitionTimingFunction: easeOutQuint } as const;

export interface ModeCardsProps {
  value: OrderMode;
  onChange: (mode: OrderMode) => void;
  /** Slightly shorter cards (sheets). */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * R3 2×2 ordering modes (ref 2): outlined white cards (1px `line`, r22, no shadow), a 26px mode
 * glyph top-left with no disc, title 16/600 and a one-line subtitle. The selected card is filled
 * ink: one shared ink plate springs between the cards (the existing shared transition) while each
 * card's glyph and copy cross-fade to white. No check badge. In dark the plate is the inverted
 * ink (cream) and the selected copy `onInk`.
 */
export function ModeCards({ value, onChange, compact = false, style }: ModeCardsProps) {
  const styles = useStyles();
  const [gridWidth, setGridWidth] = useState(0);
  const cardHeight = compact ? 104 : 112;
  // Floor: two fractional widths + gap can exceed the row by a sub-pixel and wrap the 2nd card.
  const cardWidth = gridWidth > 0 ? Math.floor((gridWidth - GAP) / 2) : 0;
  const selectedIndex = Math.max(0, ORDER_MODES.indexOf(value));

  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const plateOpacity = useSharedValue(0);

  useEffect(() => {
    if (cardWidth === 0) return;
    const tx = (selectedIndex % 2) * (cardWidth + GAP);
    const ty = Math.floor(selectedIndex / 2) * (cardHeight + GAP);
    if (plateOpacity.get() === 0) {
      // First layout: place the plate without travelling, then fade it in.
      x.set(tx);
      y.set(ty);
      plateOpacity.set(withTiming(1, { duration: 200 }));
    } else {
      x.set(withSpring(tx, springs.smooth));
      y.set(withSpring(ty, springs.smooth));
    }
  }, [selectedIndex, cardWidth, cardHeight, x, y, plateOpacity]);

  const plateStyle = useAnimatedStyle(() => ({
    opacity: plateOpacity.get(),
    transform: [{ translateX: x.get() }, { translateY: y.get() }],
  }));

  return (
    <View style={[styles.grid, style]} onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)} accessibilityRole="radiogroup">
      {/* Layer 1: the white outlined bases. Layer 2: the sliding ink plate. Layer 3: the pressable content. */}
      {cardWidth > 0
        ? ORDER_MODES.map((mode, i) => (
            <View
              key={`base-${mode}`}
              style={[
                styles.base,
                { width: cardWidth, height: cardHeight, left: (i % 2) * (cardWidth + GAP), top: Math.floor(i / 2) * (cardHeight + GAP) },
              ]}
            />
          ))
        : null}
      {cardWidth > 0 ? <Animated.View style={[styles.plate, { width: cardWidth, height: cardHeight }, plateStyle]} /> : null}
      {ORDER_MODES.map((mode) => (
        <ModeCard
          key={mode}
          mode={mode}
          selected={mode === value}
          width={cardWidth}
          height={cardHeight}
          onPress={() => {
            if (mode !== value) onChange(mode);
          }}
        />
      ))}
    </View>
  );
}

function ModeCard({
  mode,
  selected,
  width,
  height,
  onPress,
}: {
  mode: OrderMode;
  selected: boolean;
  width: number;
  height: number;
  onPress: () => void;
}) {
  const meta = MODE_META[mode];
  const c = useColors();
  const styles = useStyles();
  return (
    <PressableScale
      onPress={onPress}
      hapticKind={selected ? null : 'select'}
      activeScale={0.96}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${meta.label}. ${SUBTITLE[mode]}`}
      style={[styles.card, { width: width || '48%', height }]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.content, FADE, { opacity: selected ? 0 : 1 }]}>
        <CardContent mode={mode} glyph={c.roastText} title={c.ink} subtitle={c.inkSoft} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.content, FADE, { opacity: selected ? 1 : 0 }]}>
        <CardContent mode={mode} glyph={c.onInk} title={c.onInk} subtitle={withAlpha(c.onInk, 0.7)} />
      </Animated.View>
    </PressableScale>
  );
}

function CardContent({ mode, glyph, title, subtitle }: { mode: OrderMode; glyph: string; title: string; subtitle: string }) {
  const meta = MODE_META[mode];
  const styles = useStyles();
  return (
    <>
      <Icon name={meta.icon} size={26} color={glyph} />
      <View style={styles.text}>
        <Text style={styles.title} color={title} numberOfLines={1}>
          {meta.label}
        </Text>
        <Text variant="caption" color={subtitle} numberOfLines={1}>
          {SUBTITLE[mode]}
        </Text>
      </View>
    </>
  );
}

const useStyles = makeStyles((c) => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  base: {
    position: 'absolute',
    borderRadius: radii.category,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
  },
  plate: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: radii.category,
    backgroundColor: c.ink,
    pointerEvents: 'none',
  },
  card: { borderRadius: radii.category },
  content: { padding: spacing.md, justifyContent: 'space-between', pointerEvents: 'none' },
  text: { gap: 1 },
  title: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 21 },
}));
