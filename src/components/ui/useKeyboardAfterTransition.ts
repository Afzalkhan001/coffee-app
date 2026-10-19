import { useNavigation } from 'expo-router';
import { useEffect, type RefObject } from 'react';
import { Keyboard, Platform, type TextInput } from 'react-native';

/** The one native-stack event this hook needs (expo-router's default navigation type omits it). */
type TransitionEvents = {
  addListener: (type: 'transitionEnd', listener: (e: { data?: { closing?: boolean } }) => void) => () => void;
};

/** Let the keyboard's own show animation report in before deciding it never came up. */
const SETTLE_MS = 250;

/**
 * Android: make sure an auto-focused field really has its keyboard once the screen's push / fade
 * has finished. `autoFocus` focuses the EditText as soon as it attaches, which is at the START of a
 * native-stack transition; `showSoftInput` called then is often ignored (the field is focused but no
 * keyboard appears, and a plain `focus()` is a no-op on an already-focused input). After the
 * transition, if the keyboard still isn't up, (re-)focus the field. Pass `enabled = false` while the
 * field is locked (e.g. verifying a code). No-op on iOS and web, and whenever the keyboard came up.
 */
export function useKeyboardAfterTransition(ref: RefObject<TextInput | null>, enabled = true): void {
  const navigation = useNavigation<TransitionEvents>();
  useEffect(() => {
    if (Platform.OS !== 'android' || !enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = navigation.addListener('transitionEnd', (e) => {
      if (e.data?.closing) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const input = ref.current;
        if (!input || Keyboard.isVisible()) return;
        // Focused without a keyboard: focus() alone is ignored for the already-focused input.
        if (input.isFocused()) input.blur();
        input.focus();
      }, SETTLE_MS);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [navigation, ref, enabled]);
}
