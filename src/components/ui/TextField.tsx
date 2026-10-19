import { forwardRef, useState } from 'react';
import {
  Platform,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { fonts, makeStyles, radii, spacing, useColors } from '@/theme';
import { Icon, type IconName } from './Icon';
import { MAX_FONT_SCALE, Text } from './Text';

/**
 * Web only: Chrome's focus ring is `outline-style: auto`, which ignores a 0 width, so inputs reset
 * it to 'none'. Never sent to native: 'none' is not a native `outlineStyle` (only solid / dotted /
 * dashed), and Fabric logs "Could not parse OutlineStyle" for every input that carries it.
 */
export const WEB_NO_FOCUS_RING = (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as TextStyle;

export interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  icon?: IconName | string;
  containerStyle?: StyleProp<ViewStyle>;
  /** `light` (default): on the canvas or a sheet, follows the scheme. `dark`: on `night` (same in both schemes). */
  tone?: 'light' | 'dark';
}

/**
 * Web: bring the focused field to the middle of the viewport, clear of sticky bottom bars (Place
 * order, Confirm) and the on-screen keyboard. Native screens handle this with keyboard avoidance.
 */
function revealAboveBars(nativeEvent: unknown) {
  const el = (nativeEvent as { target?: { scrollIntoView?: (o: object) => void } } | null)?.target;
  if (!el || typeof el.scrollIntoView !== 'function') return;
  // After the keyboard / visual viewport has settled.
  setTimeout(() => el.scrollIntoView?.({ block: 'center', behavior: 'smooth' }), 120);
}

/** Rounded input with animated focus ring and inline error. */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, hint, icon, containerStyle, tone = 'light', onFocus, onBlur, style, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const c = useColors();
  const styles = useStyles();
  const dark = tone === 'dark';
  // Token values ride in the worklet's closure: a scheme change re-creates it with the new colours.
  const ringColor = error ? c.danger : focused ? (dark ? c.peach : c.ink) : dark ? c.glassBorder : c.line;
  const ring = useAnimatedStyle(() => ({
    borderColor: withTiming(ringColor, { duration: 180 }),
  }));

  return (
    <View style={containerStyle}>
      {label ? (
        <Text variant="label" color={dark ? c.peachSoft : c.inkSoft} style={{ marginBottom: 6 }}>
          {label}
        </Text>
      ) : null}
      <Animated.View style={[styles.field, dark ? styles.fieldDark : null, ring]}>
        {icon ? <Icon name={icon} size={18} color={dark ? c.peachSoft : c.inkSoft} /> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={dark ? 'rgba(255,255,255,0.4)' : c.inkMuted}
          selectionColor={c.ember}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            if (Platform.OS === 'web') revealAboveBars(e.nativeEvent);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.input,
            WEB_NO_FOCUS_RING,
            { color: dark ? c.white : c.ink },
            rest.multiline ? styles.multiline : null,
            style,
          ]}
        />
      </Animated.View>
      {error ? (
        <Text variant="caption" color={c.danger} style={{ marginTop: 6 }}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color={dark ? 'rgba(255,255,255,0.55)' : c.inkSoft} style={{ marginTop: 6 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const useStyles = makeStyles((c) => ({
  field: {
    minHeight: 54,
    borderRadius: radii.sm + 4,
    borderWidth: 1.5,
    backgroundColor: c.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  fieldDark: { backgroundColor: 'rgba(255,255,255,0.06)' },
  input: {
    flex: 1,
    // Web: an <input> flex item won't shrink below its intrinsic width (~260px) without this, which
    // widens narrow rows (375pt phones) and lets focus scroll the clipped parent sideways.
    minWidth: 0,
    fontFamily: fonts.regular,
    fontSize: 16,
    paddingVertical: 14,
  },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
}));
