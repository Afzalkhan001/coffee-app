import { useState, type Ref } from 'react';
import { Pressable, TextInput, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cubicBezier, Easing, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { Icon, MAX_FONT_SCALE, WEB_NO_FOCUS_RING } from '@/components/ui';
import { fonts, makeStyles, radii, spacing, springs, useTheme } from '@/theme';

const easeOutQuint = cubicBezier(0.22, 1, 0.36, 1);
// Spring on native; web ignores springify(), so it gets an overshooting bezier instead of linear.
const clearIn = ZoomIn.springify()
  .damping(springs.snappy.damping)
  .stiffness(springs.snappy.stiffness)
  .mass(1)
  .easing(Easing.bezier(0.34, 1.56, 0.64, 1));
const clearOut = ZoomOut.duration(140);

export interface SearchFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  ref?: Ref<TextInput>;
  style?: StyleProp<ViewStyle>;
}

/** Editable white search pill (ref 3, R3: 52h, flat): magnifier, input, a clear button that pops in, 1.5px ink focus ring. */
export function SearchField({
  value,
  onChangeText,
  onSubmit,
  placeholder = 'Search the menu',
  autoFocus = false,
  ref,
  style,
}: SearchFieldProps) {
  const { colors: c, keyboardAppearance } = useTheme();
  const styles = useStyles();
  const [focused, setFocused] = useState(false);

  return (
    <Animated.View
      style={[
        styles.field,
        {
          borderColor: focused ? c.ink : c.surface,
          transitionProperty: 'borderColor',
          transitionDuration: 200,
          transitionTimingFunction: easeOutQuint,
        },
        style,
      ]}
    >
      <Icon name="search" size={20} color={focused ? c.ink : c.inkSoft} />
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={c.inkMuted}
        selectionColor={c.roastText}
        cursorColor={c.ink}
        keyboardAppearance={keyboardAppearance}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        autoFocus={autoFocus}
        autoCorrect={false}
        autoCapitalize="none"
        enterKeyHint="search"
        inputMode="search"
        accessibilityLabel="Search the menu"
        style={[styles.input, WEB_NO_FOCUS_RING]}
      />
      {value.length > 0 ? (
        <Animated.View entering={clearIn} exiting={clearOut}>
          <Pressable
            onPress={() => onChangeText('')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            style={styles.clear}
          >
            <Icon name="close" size={14} color={c.white} />
          </Pressable>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  field: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.md + 2,
    paddingRight: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    backgroundColor: c.surface,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    fontFamily: fonts.regular,
    fontSize: 16,
    color: c.ink,
    paddingVertical: 0,
  },
  clear: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: c.inkMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
