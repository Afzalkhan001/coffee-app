/**
 * Sign-in input (DESIGN.md §R3.B "Phone / OTP / profile"): a 56px white field, r16, 1px `line`
 * border that turns into a 1.5px ink border on focus (danger on error), with an optional label
 * above and an error / hint line below. The border width change is absorbed by the padding, so the
 * text never shifts.
 */
import { forwardRef, useState, type ReactNode } from 'react';
import { Platform, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { MAX_FONT_SCALE, Text, WEB_NO_FOCUS_RING } from '@/components/ui';
import { fonts, makeStyles, useTheme } from '@/theme';
import { authPlanes } from './AuthScaffold';

export const AUTH_FIELD_HEIGHT = 56;
const PAD = 16;

export interface AuthFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  /** Rendered inside the field on the right (e.g. the valid tick). */
  right?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * Web: bring the focused field into view above the pinned bar. Native screens use keyboard avoidance.
 */
function reveal(nativeEvent: unknown) {
  const el = (nativeEvent as { target?: { scrollIntoView?: (o: object) => void } } | null)?.target;
  if (!el || typeof el.scrollIntoView !== 'function') return;
  setTimeout(() => el.scrollIntoView?.({ block: 'center', behavior: 'smooth' }), 120);
}

export const AuthField = forwardRef<TextInput, AuthFieldProps>(function AuthField(
  { label, error, hint, right, containerStyle, onFocus, onBlur, style, ...rest },
  ref,
) {
  const { colors: c, keyboardAppearance } = useTheme();
  const styles = useStyles();
  const [focused, setFocused] = useState(false);
  const strong = focused || !!error;
  const border = strong ? 1.5 : 1;
  const borderColor = error ? c.danger : focused ? c.ink : c.line;

  return (
    <View style={containerStyle}>
      {label ? (
        <Text style={styles.label} color={c.inkSoft}>
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.field,
          { borderWidth: border, borderColor, paddingHorizontal: PAD - border },
          Platform.OS === 'web' ? ({ transitionProperty: 'border-color', transitionDuration: '160ms' } as ViewStyle) : null,
        ]}
      >
        <TextInput
          ref={ref}
          placeholderTextColor={c.inkMuted}
          selectionColor={c.ember}
          keyboardAppearance={keyboardAppearance}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            if (Platform.OS === 'web') reveal(e.nativeEvent);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, WEB_NO_FOCUS_RING, style]}
        />
        {right}
      </View>
      {error ? (
        <Text style={styles.below} color={c.danger} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.below} color={c.inkSoft}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const useStyles = makeStyles((c, t) => ({
  label: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, marginBottom: 8 },
  field: {
    height: AUTH_FIELD_HEIGHT,
    borderRadius: 16,
    backgroundColor: authPlanes(c, t).field,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    // Web: an <input> flex item won't shrink below its intrinsic width without this.
    minWidth: 0,
    height: '100%',
    fontFamily: fonts.regular,
    fontSize: 16,
    color: c.ink,
  },
  below: { marginTop: 8, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
}));
