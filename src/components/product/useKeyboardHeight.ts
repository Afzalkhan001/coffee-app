import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * How much of the window's bottom edge the software keyboard covers (0 when hidden). iOS reports on
 * "will" for an earlier start, and its height is measured from the screen bottom. Android's
 * `keyboardDidShow` height leaves out the navigation bar under the keyboard (IME inset minus the
 * system-bar inset), while edge-to-edge content runs all the way down: add the bottom inset back, or
 * a field "lifted above the keyboard" stays 24–48dp behind it.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  const { bottom } = useSafeAreaInsets();
  const navBar = Platform.OS === 'android' ? bottom : 0;

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height > 0 ? height + navBar : 0;
}
