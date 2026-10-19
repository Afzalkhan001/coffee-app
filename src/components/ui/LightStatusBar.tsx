import { useIsFocused } from 'expo-router';
import { StatusBar } from 'react-native';

export interface LightStatusBarProps {
  /** Extra condition on top of focus (e.g. only once a dark layer covers the screen). Default true. */
  active?: boolean;
}

/**
 * White status-bar content for a dark screen (onboarding, sign-in, the confirmation, the payment
 * reveal) — only while that screen is focused.
 *
 * React Native keeps one stack of mounted <StatusBar> props, and stack screens stay mounted under
 * the ones pushed on top. So:
 *  - `barStyle` is `undefined` when unfocused: the entry drops out of the merge and the root
 *    layout's dark style applies to whatever cream screen is on top (e.g. Legal pushed over
 *    sign-in, which used to inherit white icons on a cream page);
 *  - it is declarative, not `setStatusBarStyle()`: on Android RN re-applies the merged stack after
 *    ANY <StatusBar> mounts or updates, which silently reverted imperative calls.
 * Must render inside a screen (uses navigation focus).
 */
export function LightStatusBar({ active = true }: LightStatusBarProps) {
  const focused = useIsFocused();
  return <StatusBar barStyle={focused && active ? 'light-content' : undefined} animated />;
}
