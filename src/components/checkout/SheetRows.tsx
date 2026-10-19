/**
 * One white sheet built from sibling blocks (R3.A10 "one list = one white sheet"): each block is a
 * `LayoutBlock`, so when one grows (slot chips, an editor, the item lines) the blocks below glide on
 * web too — a single nested container would replay its parent's move there. The first block rounds
 * the top corners, the last the bottom ones, and every other block draws a hairline inset to where
 * the row text starts. No shadow, no border.
 */
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, type AnimatedStyle } from 'react-native-reanimated';
import type { EntryAnimation } from '@/components/motion';
import { Icon, PressableScale, Text } from '@/components/ui';
import { fonts, makeStyles, radii, spacing, springs, useColors } from '@/theme';
import { fieldsIn, fieldsOut } from './motion';
import { LayoutBlock } from './LayoutBlock';

export const SHEET_PAD = spacing.md;
const R = radii.lg;

export interface SheetBlockProps {
  first?: boolean;
  last?: boolean;
  /** Hairline inset from the left (where this block's row text starts). Default 16. */
  dividerInset?: number;
  layoutKey: string;
  entering?: EntryAnimation;
  onLayout?: (e: LayoutChangeEvent) => void;
  /** From `useShake()` (a failed "Place order" points here). */
  shakeStyle?: AnimatedStyle<ViewStyle>;
  /** Inline validation message under the block's content. */
  error?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function SheetBlock({
  first = false,
  last = false,
  dividerInset = SHEET_PAD,
  layoutKey,
  entering,
  onLayout,
  shakeStyle,
  error,
  children,
  style,
}: SheetBlockProps) {
  const c = useColors();
  const styles = useStyles();
  return (
    <LayoutBlock layoutKey={layoutKey} entering={entering} onLayout={onLayout} style={style}>
      <Animated.View style={[styles.block, first ? styles.first : null, last ? styles.last : null, shakeStyle]}>
        {first ? null : <View style={[styles.divider, { left: dividerInset }]} />}
        {children}
        {error ? (
          <Animated.View entering={fieldsIn} exiting={fieldsOut} style={styles.error} accessibilityLiveRegion="polite">
            <Text variant="caption" color={c.danger}>
              {error}
            </Text>
          </Animated.View>
        ) : null}
      </Animated.View>
    </LayoutBlock>
  );
}

export interface ValueRowProps {
  title: string;
  value?: string;
  /** Leading art (a cut-out stack, a brand mark). */
  left?: ReactNode;
  onPress?: () => void;
  /** `right`: navigates; `down`: expands (turns 180° when `expanded`). Default right when pressable. */
  chevron?: 'right' | 'down' | 'none';
  expanded?: boolean;
  valueColor?: string;
  accessibilityLabel?: string;
  children?: ReactNode;
}

/** A 56px row: title 16/600 ink, value 15 `inkSoft` on the right, chevron 18 `inkMuted`. */
export function ValueRow({ title, value, left, onPress, chevron, expanded = false, valueColor, accessibilityLabel, children }: ValueRowProps) {
  const c = useColors();
  const styles = useStyles();
  const turn = useSharedValue(expanded ? 1 : 0);
  useEffect(() => {
    turn.set(withSpring(expanded ? 1 : 0, springs.smooth));
  }, [expanded, turn]);
  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get() * 180}deg` }] }));
  const kind = chevron ?? (onPress ? 'right' : 'none');

  const content = (
    <>
      {left}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.valueSlot}>
        {value ? (
          <Text style={styles.value} color={valueColor ?? c.inkSoft} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        {children}
        {kind === 'right' ? <Icon name="chevron-forward" size={18} color={c.inkMuted} /> : null}
        {kind === 'down' ? (
          <Animated.View style={chevronStyle}>
            <Icon name="chevron-down" size={18} color={c.inkMuted} />
          </Animated.View>
        ) : null}
      </View>
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <PressableScale
      onPress={onPress}
      activeScale={0.985}
      accessibilityRole="button"
      accessibilityState={kind === 'down' ? { expanded } : undefined}
      accessibilityLabel={accessibilityLabel ?? (value ? `${title}, ${value}` : title)}
      style={styles.row}
    >
      {content}
    </PressableScale>
  );
}

const useStyles = makeStyles((c) => ({
  block: { backgroundColor: c.surface, paddingHorizontal: SHEET_PAD },
  first: { borderTopLeftRadius: R, borderTopRightRadius: R, paddingTop: 4 },
  last: { borderBottomLeftRadius: R, borderBottomRightRadius: R, paddingBottom: 4 },
  divider: { position: 'absolute', top: 0, right: SHEET_PAD, height: StyleSheet.hairlineWidth * 2, backgroundColor: c.line },
  error: { paddingBottom: spacing.sm, marginTop: -2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 56 },
  title: { flexShrink: 0, maxWidth: '58%', fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  valueSlot: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  value: { flexShrink: 1, fontFamily: fonts.regular, fontSize: 15, lineHeight: 20, textAlign: 'right' },
}));
