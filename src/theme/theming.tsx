/**
 * Runtime theme (DESIGN.md §R4, BUILD_CONTRACT → Theming).
 *
 *  - `<ThemeProvider preference>` (root layout): resolves the scheme from the Appearance preference
 *    and the OS (`useColorScheme`), keeps the web document / native root background in step.
 *  - `useTheme()` → `{ scheme, isDark, colors, tileTints, heroTints, shadows, boxShadows, contact,
 *    blurTint, statusBarStyle, keyboardAppearance }`; `useColors()` is `useTheme().colors`.
 *  - `makeStyles((c, t) => ({ … }))` at module scope → a `useStyles()` hook. Both schemes' sheets
 *    are built once, up front, so a scheme change re-styles every mounted component on its next
 *    render (no remount, no per-render StyleSheet work).
 *  - `makeThemed((c, t) => value)`: the same for any non-style value (tone tables, gradients).
 *  - `<ThemeScope scheme>` pins a subtree to one scheme (rare: a surface that must stay light).
 * Outside any provider (unit tests) everything resolves to the light theme.
 */
import * as SystemUI from 'expo-system-ui';
import { createContext, use, useEffect, type ReactNode } from 'react';
import { Platform, StyleSheet, useColorScheme } from 'react-native';
import { resolveScheme, type AppearancePreference } from './appearance';
import {
  darkBoxShadows,
  darkColors,
  darkContact,
  darkHeroTints,
  darkTileTints,
  lightBoxShadows,
  lightColors,
  lightContact,
  lightHeroTints,
  lightTileTints,
  type BoxShadowTokens,
  type ColorScheme,
  type ColorTokens,
  type ContactShadowTokens,
  type HeroTint,
} from './palette';

/** Shadow style objects (`boxShadow`), the scheme-aware form of the old static `shadows`. */
export interface ShadowStyles {
  /** Tab bar, floating cart bar, toasts. */
  float: { boxShadow: string };
  /** Primary bar, white CTA on night. */
  cta: { boxShadow: string };
  /** @deprecated R3: alias of `cta`. */
  strong: { boxShadow: string };
  /** @deprecated R3: retired on cards, rows, tiles and sheets. */
  soft: { boxShadow: string };
  /** @deprecated R3: retired on cards, rows, tiles and sheets. */
  card: { boxShadow: string };
}

export interface Theme {
  scheme: ColorScheme;
  isDark: boolean;
  colors: ColorTokens;
  tileTints: Readonly<Record<HeroTint, string>>;
  heroTints: Readonly<Record<HeroTint, string>>;
  shadows: ShadowStyles;
  boxShadows: BoxShadowTokens;
  contact: ContactShadowTokens;
  /** expo-blur `tint` for frosted layers on the canvas. */
  blurTint: 'light' | 'dark';
  /** Status-bar content on the canvas (`<LightStatusBar>` still forces light on night screens). */
  statusBarStyle: 'dark' | 'light';
  /** `TextInput.keyboardAppearance` (iOS). */
  keyboardAppearance: 'light' | 'dark';
}

function shadowStyles(scheme: ColorScheme): ShadowStyles {
  if (scheme === 'dark') {
    return {
      float: { boxShadow: darkBoxShadows.float },
      cta: { boxShadow: darkBoxShadows.cta },
      strong: { boxShadow: darkBoxShadows.cta },
      soft: { boxShadow: darkBoxShadows.soft },
      card: { boxShadow: '0px 6px 16px rgba(0, 0, 0, 0.3)' },
    };
  }
  // The exact R3 strings (`theme.shadows` before R4).
  return {
    float: { boxShadow: '0px 10px 30px rgba(59, 38, 24, 0.12)' },
    cta: { boxShadow: '0px 12px 24px rgba(28, 23, 20, 0.22)' },
    strong: { boxShadow: '0px 12px 24px rgba(28, 23, 20, 0.22)' },
    soft: { boxShadow: '0px 8px 24px rgba(59, 38, 24, 0.08)' },
    card: { boxShadow: '0px 6px 16px rgba(59, 38, 24, 0.06)' },
  };
}

export const lightTheme: Theme = {
  scheme: 'light',
  isDark: false,
  colors: lightColors,
  tileTints: lightTileTints,
  heroTints: lightHeroTints,
  shadows: shadowStyles('light'),
  boxShadows: lightBoxShadows,
  contact: lightContact,
  blurTint: 'light',
  statusBarStyle: 'dark',
  keyboardAppearance: 'light',
};

export const darkTheme: Theme = {
  scheme: 'dark',
  isDark: true,
  colors: darkColors,
  tileTints: darkTileTints,
  heroTints: darkHeroTints,
  shadows: shadowStyles('dark'),
  boxShadows: darkBoxShadows,
  contact: darkContact,
  blurTint: 'dark',
  statusBarStyle: 'light',
  keyboardAppearance: 'dark',
};

const THEMES: Readonly<Record<ColorScheme, Theme>> = { light: lightTheme, dark: darkTheme };

/** The theme object for a scheme (non-React code, worklet inputs, tests). */
export function themeFor(scheme: ColorScheme): Theme {
  return THEMES[scheme];
}

const ThemeContext = createContext<Theme>(lightTheme);

/** The current theme. Light outside a provider. */
export function useTheme(): Theme {
  return use(ThemeContext);
}

/** Shorthand for `useTheme().colors`. */
export function useColors(): ColorTokens {
  return use(ThemeContext).colors;
}

/**
 * Root provider. `preference` comes from the persisted session (`useSession((s) => s.appearance)`);
 * `system` follows `useColorScheme()` (see `FOLLOW_SYSTEM_SCHEME`).
 */
export function ThemeProvider({ preference = 'system', children }: { preference?: AppearancePreference; children: ReactNode }) {
  const system = useColorScheme();
  const theme = THEMES[resolveScheme(preference, system)];

  // Behind the app: the web document (overscroll, the area under the keyboard, form controls and
  // scrollbars via `color-scheme`) and the native root view (keyboard and modal transitions).
  useEffect(() => {
    const bg = theme.colors.bg;
    if (Platform.OS === 'web') {
      if (typeof document === 'undefined') return;
      document.documentElement.style.colorScheme = theme.scheme;
      document.documentElement.style.backgroundColor = bg;
      if (document.body) document.body.style.backgroundColor = bg;
      return;
    }
    SystemUI.setBackgroundColorAsync(bg).catch(() => {});
  }, [theme]);

  return <ThemeContext value={theme}>{children}</ThemeContext>;
}

/** Pins a subtree to one scheme (e.g. a surface that must stay light inside a dark screen). */
export function ThemeScope({ scheme, children }: { scheme: ColorScheme; children: ReactNode }) {
  return <ThemeContext value={THEMES[scheme]}>{children}</ThemeContext>;
}

type NamedStyles<T> = StyleSheet.NamedStyles<T>;

/**
 * Themed styles, declared at module scope next to the component (the replacement for a module-level
 * `StyleSheet.create` that read static `colors`):
 *
 * ```tsx
 * const useStyles = makeStyles((c) => ({ root: { backgroundColor: c.bg }, title: { color: c.ink } }));
 * function Row() { const s = useStyles(); return <View style={s.root} />; }
 * ```
 * The factory runs once per scheme at import time (two `StyleSheet.create` calls); the hook just
 * picks the sheet for the current scheme. Keep factories pure: tokens in, styles out.
 */
export function makeStyles<T extends NamedStyles<T> | NamedStyles<any>>(
  factory: (c: ColorTokens, t: Theme) => T & NamedStyles<any>,
): () => T {
  const sheets: Readonly<Record<ColorScheme, T>> = {
    light: StyleSheet.create(factory(lightTheme.colors, lightTheme)),
    dark: StyleSheet.create(factory(darkTheme.colors, darkTheme)),
  };
  return function useStyles() {
    return sheets[use(ThemeContext).scheme];
  };
}

/**
 * Any value derived from the theme (tone tables, gradient stops, palettes), built once per scheme:
 * `const useTones = makeThemed((c) => ({ ink: { bg: c.ink, fg: c.onInk } }))`.
 */
export function makeThemed<T>(factory: (c: ColorTokens, t: Theme) => T): () => T {
  const values: Readonly<Record<ColorScheme, T>> = {
    light: factory(lightTheme.colors, lightTheme),
    dark: factory(darkTheme.colors, darkTheme),
  };
  return function useThemed() {
    return values[use(ThemeContext).scheme];
  };
}
