/**
 * "Tip your delivery partner" (checkout, delivery only): five equal 40px pills on one row — No tip
 * (default), ₹10, ₹20, ₹30, Other — canvas-filled inside the white sheet, the choice ink-filled.
 * "Other" opens a ₹ field (₹1–₹500). One caption: the partner keeps all of it. The tip isn't taxed
 * or discounted (see `computeTotals`).
 */
import { useEffect, useRef } from 'react';
import { TextInput, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { easeOutQuint, withAlpha } from '@/components/motion';
import { MAX_FONT_SCALE, PressableScale, Text, WEB_NO_FOCUS_RING } from '@/components/ui';
import { brand } from '@/theme/brand';
import { fonts, makeStyles, spacing, useColors, useTheme } from '@/theme';
import { fieldsIn, fieldsOut } from './motion';
import { nestedLayout } from './LayoutBlock';
import { TIP_CHOICES, tipChoiceLabel, type TipChoice } from './tip';

export interface TipChipsProps {
  value: TipChoice;
  onChange: (choice: TipChoice) => void;
  otherText: string;
  onOtherTextChange: (text: string) => void;
  /** A bad "Other" amount, shown after a failed "Place order". */
  error?: string;
}

export function TipChips({ value, onChange, otherText, onOtherTextChange, error }: TipChipsProps) {
  const { colors: c, keyboardAppearance } = useTheme();
  const styles = useStyles();
  const otherRef = useRef<TextInput>(null);
  const other = value === 'other';
  // Picking "Other" goes straight to the amount.
  useEffect(() => {
    if (!other) return;
    const t = setTimeout(() => otherRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [other]);

  return (
    <View style={styles.wrap}>
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Tip your delivery partner">
        {TIP_CHOICES.map((choice) => (
          <TipPill key={String(choice)} label={tipChoiceLabel(choice)} selected={choice === value} onPress={() => onChange(choice)} />
        ))}
      </View>
      {other ? (
        <Animated.View entering={fieldsIn} exiting={fieldsOut} layout={nestedLayout} style={styles.otherBlock}>
          <View style={[styles.field, error ? styles.fieldError : null]}>
            <Text style={styles.currency} color={c.inkSoft}>
              {brand.currency.symbol}
            </Text>
            <TextInput
              ref={otherRef}
              value={otherText}
              onChangeText={(t) => onOtherTextChange(t.replace(/[^\d]/g, '').slice(0, 3))}
              placeholder="Amount, up to 500"
              placeholderTextColor={c.inkMuted}
              inputMode="numeric"
              keyboardType="number-pad"
              enterKeyHint="done"
              selectionColor={c.ember}
              keyboardAppearance={keyboardAppearance}
              maxFontSizeMultiplier={MAX_FONT_SCALE}
              accessibilityLabel="Tip amount in rupees"
              style={[styles.input, WEB_NO_FOCUS_RING]}
            />
          </View>
        </Animated.View>
      ) : null}
      <Text variant="caption" color={error ? c.danger : c.inkSoft} style={styles.caption}>
        {error ?? 'Your delivery partner gets 100% of the tip.'}
      </Text>
    </View>
  );
}

function TipPill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const c = useColors();
  const styles = useStyles();
  const idle = c.bg;
  const active = c.ink;
  const on = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    on.set(withTiming(selected ? 1 : 0, { duration: 200, easing: easeOutQuint }));
  }, [selected, on]);
  const fill = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(on.get(), [0, 1], [idle, active]) }));
  return (
    <PressableScale
      onPress={onPress}
      activeScale={0.94}
      hapticKind={selected ? null : 'select'}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label === 'No tip' || label === 'Other' ? label : `Tip ${label}`}
      style={styles.pillHit}
    >
      <Animated.View style={[styles.pill, fill]}>
        <Text style={[styles.pillLabel, selected ? styles.pillLabelOn : null]} color={selected ? c.onInk : c.ink} numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
    </PressableScale>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { paddingTop: spacing.md, paddingBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.xs },
  pillHit: { flex: 1, minWidth: 0 },
  pill: { height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  pillLabel: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 18 },
  pillLabelOn: { fontFamily: fonts.semibold },
  otherBlock: { marginTop: spacing.sm },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 48,
    paddingHorizontal: spacing.md,
    borderRadius: 14,
    backgroundColor: c.bg,
    borderWidth: 1.5,
    borderColor: c.bg,
  },
  fieldError: { borderColor: withAlpha(c.danger, 0.6) },
  currency: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  input: { flex: 1, minWidth: 0, height: 48, fontFamily: fonts.semibold, fontSize: 16, color: c.ink },
  caption: { marginTop: spacing.sm },
}));
