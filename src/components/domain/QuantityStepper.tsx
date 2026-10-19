import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { RollingNumber } from '@/components/motion';
import { CircleButton, type CircleTone } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { fonts } from '@/theme';

export interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Circle diameter. R3 cart rows: 28 (default). */
  size?: number;
  tone?: CircleTone;
  style?: StyleProp<ViewStyle>;
}

/**
 * − [ n ] + : `bg`-filled circles (R3: controls inside white sheets use the canvas colour) and a
 * rolling digit (15/600 at row sizes). Each bump presses to 0.9 with a `tick`; disabled at
 * the bounds. (The product detail's edge-bump stepper is its own layout.)
 */
export function QuantityStepper({ value, onChange, min = 1, max = 20, size = 28, tone = 'canvas', style }: QuantityStepperProps) {
  const atMin = value <= min;
  const atMax = value >= max;
  const small = size <= 36;
  const fontSize = small ? 15 : Math.round(size * 0.4);

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
      <CircleButton
        icon="remove"
        tone={tone}
        size={size}
        shadow={false}
        disabled={atMin}
        hapticKind={null}
        activeScale={0.9}
        iconSize={small ? 14 : undefined}
        onPress={() => step(-1)}
        accessibilityLabel="Decrease quantity"
      />
      <View style={[styles.value, { minWidth: small ? 22 : Math.max(32, size * 0.8) }]}>
        <RollingNumber value={value} decimals={0} fontSize={fontSize} fontFamily={small ? fonts.semibold : fonts.bold} />
      </View>
      <CircleButton
        icon="add"
        tone={tone}
        size={size}
        shadow={false}
        disabled={atMax}
        hapticKind={null}
        activeScale={0.9}
        iconSize={small ? 14 : undefined}
        onPress={() => step(1)}
        accessibilityLabel="Increase quantity"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  value: { alignItems: 'center', justifyContent: 'center' },
});
