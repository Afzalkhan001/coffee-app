/**
 * Appearance preference (Settings → Preferences → Appearance) and how it resolves to a scheme.
 * Pure + platform glue only: no React, no stores (the session store persists the preference and
 * mirrors it here with `applyNativeAppearance`; the root layout passes it to `<ThemeProvider>`).
 */
import { Appearance, Platform } from 'react-native';
import type { ColorScheme } from './palette';

/** What the person picked. `system` follows the phone (see `FOLLOW_SYSTEM_SCHEME`). */
export type AppearancePreference = 'system' | 'light' | 'dark';

export const APPEARANCE_PREFERENCES: readonly AppearancePreference[] = ['system', 'light', 'dark'];

export const APPEARANCE_LABEL: Readonly<Record<AppearancePreference, string>> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

/**
 * Rollout switch for "System". It was `false` while screens were being moved onto the theme
 * (BUILD_CONTRACT → Theming), so a phone in dark mode never opened a half-converted app. Every
 * screen is converted (`npm run theme:check -- --strict` passes) and checked in both schemes, so
 * "System" now follows the phone. Setting it back to `false` makes System resolve to light again.
 */
export const FOLLOW_SYSTEM_SCHEME = true;

/** Any persisted value → a valid preference (unknown / missing → `system`). */
export function sanitizeAppearance(value: unknown): AppearancePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

/**
 * The scheme to render: an explicit choice wins; `system` follows the OS scheme (`useColorScheme()`,
 * null/unspecified → light) when `followSystem` is on, else light.
 */
export function resolveScheme(
  preference: AppearancePreference,
  system: string | null | undefined,
  followSystem: boolean = FOLLOW_SYSTEM_SCHEME,
): ColorScheme {
  if (preference === 'light' || preference === 'dark') return preference;
  return followSystem && system === 'dark' ? 'dark' : 'light';
}

let applied: 'light' | 'dark' | 'unspecified' = 'unspecified';

/**
 * iOS: pin the app's native chrome (keyboard, alerts, context menus, the form-sheet grabber) to
 * the resolved scheme with `Appearance.setColorScheme`; `unspecified` hands it back to the system.
 * It updates `Appearance.getColorScheme()` synchronously, so `useColorScheme()` agrees on the next
 * render. Android: not called — `setDefaultNightMode` can recreate the activity in hosts that
 * don't handle `uiMode` (Expo Go), and RN draws everything we show. Web: no such API.
 */
export function applyNativeAppearance(preference: AppearancePreference, followSystem: boolean = FOLLOW_SYSTEM_SCHEME) {
  if (Platform.OS !== 'ios' || typeof Appearance.setColorScheme !== 'function') return;
  const next = preference === 'system' ? (followSystem ? 'unspecified' : 'light') : preference;
  if (next === applied) return;
  applied = next;
  try {
    Appearance.setColorScheme(next);
  } catch {
    // Older hosts without the override: the app still themes itself.
  }
}
