import { type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

export interface KeyboardAvoiderProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Wrap a screen's form ScrollView so a focused field is never left under the software keyboard.
 *
 * - Android: SDK 57 apps are edge-to-edge, so `adjustResize` no longer shrinks the window and a
 *   ScrollView keeps its full height under the keyboard (fields in the lower half stayed hidden and
 *   the end of the list was unreachable). A `padding` KeyboardAvoidingView shrinks the area above the
 *   keyboard instead, and Android's ScrollView then scrolls the focused field into the smaller
 *   viewport by itself (ScrollView.onSizeChanged).
 * - iOS: a plain View; the ScrollView inside keeps `automaticallyAdjustKeyboardInsets`, which insets
 *   the content and scrolls the focused field into view in step with the keyboard.
 * - Web: a plain View (no keyboard events).
 *
 * KeyboardAvoidingView measures itself with onLayout (relative to its parent), so keep the parent at
 * the top of the window (a full-screen `Screen` / root View). Sticky bottom bars stay outside it:
 * they hide themselves while the keyboard is up.
 */
export function KeyboardAvoider({ children, style }: KeyboardAvoiderProps) {
  if (Platform.OS === 'android') {
    return (
      <KeyboardAvoidingView behavior="padding" style={[styles.fill, style]}>
        {children}
      </KeyboardAvoidingView>
    );
  }
  return <View style={[styles.fill, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
