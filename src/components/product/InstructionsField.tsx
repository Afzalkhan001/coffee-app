/**
 * "Add a note" (R3.B product detail): a 56px row that opens a multiline field with a live
 * 140-character counter. The row shows the saved note as its value while closed. Exposes an
 * animated ref so the screen can lift the field above the keyboard on the UI thread.
 */
import { useEffect, useRef } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, type AnimatedRef } from 'react-native-reanimated';
import { Icon, PressableScale, Text, TextField } from '@/components/ui';
import { fieldsIn, fieldsOut } from '@/components/checkout/motion';
import { fonts, spacing, springs, useTheme } from '@/theme';
import { INSTRUCTIONS_MAX } from './useProductConfigurator';

export interface InstructionsFieldProps {
  value: string;
  onChange: (text: string) => void;
  placeholder: string;
  node: AnimatedRef<Animated.View>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

export function InstructionsField({ value, onChange, placeholder, node, open, onOpenChange, onFocus, onBlur }: InstructionsFieldProps) {
  const { colors: c, keyboardAppearance } = useTheme();
  const nearLimit = value.length >= INSTRUCTIONS_MAX - 10;
  const inputRef = useRef<TextInput>(null);
  const turn = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    turn.set(withSpring(open ? 1 : 0, springs.smooth));
  }, [open, turn]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get() * 45}deg` }] }));

  // Focus once the field has faded in (the row was the tap target).
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 260);
    return () => clearTimeout(t);
  }, [open]);

  const note = value.trim();
  return (
    <Animated.View ref={node} collapsable={false}>
      <PressableScale
        onPress={() => onOpenChange(!open)}
        activeScale={0.985}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={note ? `Note: ${note}. Edit note` : 'Add a note'}
        style={styles.header}
      >
        <Text style={styles.title}>Add a note</Text>
        <View style={styles.valueRow}>
          {note && !open ? (
            <Text style={styles.value} color={c.inkSoft} numberOfLines={1}>
              {`“${note}”`}
            </Text>
          ) : null}
          <Animated.View style={iconStyle}>
            <Icon name="add" size={20} color={c.inkMuted} />
          </Animated.View>
        </View>
      </PressableScale>
      {open ? (
        <Animated.View entering={fieldsIn} exiting={fieldsOut} style={styles.body}>
          <TextField
            ref={inputRef}
            value={value}
            onChangeText={onChange}
            placeholder={placeholder}
            multiline
            maxLength={INSTRUCTIONS_MAX}
            keyboardAppearance={keyboardAppearance}
            onFocus={onFocus}
            onBlur={onBlur}
            accessibilityLabel="Special instructions"
            accessibilityHint={`Up to ${INSTRUCTIONS_MAX} characters`}
            style={styles.input}
          />
          <Text style={styles.counter} color={nearLimit ? c.roastText : c.inkMuted} align="right">
            {`${value.length}/${INSTRUCTIONS_MAX}`}
          </Text>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, minHeight: 56 },
  title: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  valueRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  value: { flexShrink: 1, fontFamily: fonts.regular, fontSize: 15, lineHeight: 20 },
  body: { gap: 6, paddingBottom: spacing.md },
  input: { minHeight: 76 },
  counter: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
});
