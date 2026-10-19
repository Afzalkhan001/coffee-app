/**
 * Dark mode foundation (DESIGN.md §R4, BUILD_CONTRACT → Theming): the palettes, how the Appearance
 * preference resolves, the provider / scope / hooks, `makeStyles` + `makeThemed` (memoised per
 * scheme, re-styling without a remount) and the persisted session preference.
 */
import { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text, View } from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/* eslint-disable import/first */
import {
  darkColors,
  darkHeroTints,
  darkTileTints,
  FOLLOW_SYSTEM_SCHEME,
  lightColors,
  lightHeroTints,
  lightTileTints,
  makeStyles,
  makeThemed,
  resolveScheme,
  sanitizeAppearance,
  ThemeProvider,
  ThemeScope,
  themeFor,
  useColors,
  useTheme,
  type AppearancePreference,
  type Theme,
} from '@/theme';
import { colors as staticColors, heroTints as staticHeroTints, shadows as staticShadows, tileTints as staticTileTints } from '@/theme';
import { boxShadows as staticBoxShadows } from '@/components/motion/color';
import { useSession } from '@/store/session';
/* eslint-enable import/first */

// ── WCAG contrast ──────────────────────────────────────────────────────────────
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

function mount(node: React.ReactElement): ReactTestRenderer {
  let r: ReactTestRenderer | undefined;
  act(() => {
    r = create(node);
  });
  if (!r) throw new Error('not mounted');
  return r;
}

describe('palettes', () => {
  it('keeps the light theme pixel-identical to R3', () => {
    expect(lightColors).toMatchObject({
      bg: '#F3ECE3',
      surface: '#FFFFFF',
      surfaceAlt: '#EFE7DC',
      ink: '#1C1714',
      inkSoft: '#6E625A',
      inkMuted: '#A39689',
      line: '#E6DCCF',
      night: '#15110E',
      peach: '#F4A672',
      ember: '#E8692C',
      sage: '#8DB37E',
      sageDeep: '#5E8A50',
      danger: '#D64545',
      veg: '#1B8A3B',
      egg: '#B5780A',
      nonVeg: '#8B3A1E',
      storeFrom: '#FBF4EA',
      storeTo: '#F1E2CE',
      overlay: 'rgba(28,23,20,0.45)',
    });
    // The new role tokens resolve to exactly what light code drew before them.
    expect(lightColors.onInk).toBe('#FFFFFF');
    expect(lightColors.control).toBe(lightColors.surface);
    expect(lightColors.onControl).toBe(lightColors.ink);
    expect(lightColors.capsule).toBe(lightColors.ink);
    expect(lightColors.inkFixed).toBe(lightColors.ink);
    expect(lightColors.sageText).toBe(lightColors.sageDeep);
    expect(lightColors.roastText).toBe(lightColors.roast);
    expect(lightColors.peachTint).toBe(lightColors.peachSoft);
    expect(lightTileTints.coffee).toBe('#EBDBC6');
    expect(lightHeroTints.coffee).toBe('#E7D4BD');
  });

  it('keeps the deprecated static exports equal to the light theme', () => {
    expect(staticColors).toBe(lightColors);
    expect(staticTileTints).toEqual(lightTileTints);
    expect(staticHeroTints).toEqual(lightHeroTints);
    expect(staticShadows.float).toEqual(themeFor('light').shadows.float);
    expect(staticShadows.cta).toEqual(themeFor('light').shadows.cta);
    expect(staticBoxShadows.float).toBe(themeFor('light').boxShadows.float);
    expect(staticBoxShadows.strong).toBe(themeFor('light').boxShadows.strong);
  });

  it('defines every token in both schemes', () => {
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(lightColors).sort());
    expect(Object.keys(darkTileTints).sort()).toEqual(Object.keys(lightTileTints).sort());
    expect(Object.keys(darkHeroTints).sort()).toEqual(Object.keys(lightHeroTints).sort());
    expect(Object.keys(themeFor('dark').shadows).sort()).toEqual(Object.keys(themeFor('light').shadows).sort());
    expect(Object.keys(themeFor('dark').boxShadows).sort()).toEqual(Object.keys(themeFor('light').boxShadows).sort());
  });

  it('keeps the fixed and accent tokens identical across schemes', () => {
    for (const key of ['night', 'white', 'black', 'glass', 'glassBorder', 'glow', 'inkFixed', 'peach', 'peachSoft', 'ember', 'sage', 'sageDeep', 'roast', 'espresso', 'espressoDeep'] as const) {
      expect([key, darkColors[key]]).toEqual([key, lightColors[key]]);
    }
  });

  it('meets WCAG AA in dark (text 4.5:1, marks and glyphs 3:1)', () => {
    const d = darkColors;
    for (const plane of [d.bg, d.surface]) {
      expect(contrast(d.ink, plane)).toBeGreaterThanOrEqual(7);
      expect(contrast(d.inkSoft, plane)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(d.inkMuted, plane)).toBeGreaterThanOrEqual(3);
      expect(contrast(d.sageText, plane)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(d.roastText, plane)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(d.danger, plane)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(d.peach, plane)).toBeGreaterThanOrEqual(4.5);
      for (const mark of [d.veg, d.egg, d.nonVeg]) expect(contrast(mark, plane)).toBeGreaterThanOrEqual(3);
    }
    expect(contrast(d.onInk, d.ink)).toBeGreaterThanOrEqual(7);
    expect(contrast(d.onInkSoft, d.ink)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(d.onControl, d.control)).toBeGreaterThanOrEqual(7);
    expect(contrast(d.white, d.capsule)).toBeGreaterThanOrEqual(7);
    expect(contrast(d.danger, d.dangerSoft)).toBeGreaterThanOrEqual(4.4);
    expect(contrast(d.ink, d.peachTint)).toBeGreaterThanOrEqual(7);
    expect(contrast(d.white, d.danger)).toBeGreaterThanOrEqual(3);
    // Planes stay distinguishable: tiles and sheets lift off the canvas.
    for (const tile of Object.values(darkTileTints)) expect(contrast(tile, d.bg)).toBeGreaterThan(1.15);
    expect(contrast(d.surface, d.bg)).toBeGreaterThan(1.08);
    // The peach card keeps its fixed ink copy.
    expect(contrast(d.inkFixed, d.peach)).toBeGreaterThanOrEqual(7);
  });

  it('keeps the light text pairs at their R3 contrast', () => {
    const l = lightColors;
    expect(contrast(l.inkSoft, l.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(l.onInk, l.ink)).toBeGreaterThanOrEqual(7);
  });
});

describe('Appearance preference', () => {
  it('resolves an explicit choice regardless of the OS', () => {
    expect(resolveScheme('dark', 'light', true)).toBe('dark');
    expect(resolveScheme('light', 'dark', true)).toBe('light');
    expect(resolveScheme('dark', null, false)).toBe('dark');
  });

  it('follows the OS for System once the rollout switch is on', () => {
    expect(resolveScheme('system', 'dark', true)).toBe('dark');
    expect(resolveScheme('system', 'light', true)).toBe('light');
    expect(resolveScheme('system', null, true)).toBe('light');
    expect(resolveScheme('system', 'unspecified', true)).toBe('light');
  });

  it('keeps System on light while screens are converted (rollout switch off)', () => {
    expect(resolveScheme('system', 'dark', false)).toBe('light');
  });

  it('ships with System following the phone (every screen is converted)', () => {
    expect(FOLLOW_SYSTEM_SCHEME).toBe(true);
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', 'light')).toBe('light');
  });

  it('sanitises persisted values', () => {
    expect(sanitizeAppearance('dark')).toBe('dark');
    expect(sanitizeAppearance('light')).toBe('light');
    expect(sanitizeAppearance('system')).toBe('system');
    expect(sanitizeAppearance(undefined)).toBe('system');
    expect(sanitizeAppearance('sepia')).toBe('system');
    expect(sanitizeAppearance(1)).toBe('system');
  });
});

// ── Provider + hooks ──────────────────────────────────────────────────────────

const useProbeStyles = makeStyles((c, t) => ({
  box: { backgroundColor: c.bg, borderColor: c.line, boxShadow: t.boxShadows.float },
}));
const useProbeTones = makeThemed((c, t) => ({ fill: c.ink, scheme: t.scheme }));

const seen: { theme: Theme; styles: ReturnType<typeof useProbeStyles>; tones: ReturnType<typeof useProbeTones>; colors: ReturnType<typeof useColors> }[] = [];
let mounts = 0;

function Probe() {
  const theme = useTheme();
  const styles = useProbeStyles();
  const tones = useProbeTones();
  const c = useColors();
  useEffect(() => {
    mounts += 1;
  }, []);
  // Every committed render, after the fact (no side effects during render).
  useEffect(() => {
    seen.push({ theme, styles, tones, colors: c });
  });
  return (
    <View style={styles.box} testID="probe">
      <Text>{theme.scheme}</Text>
    </View>
  );
}

function App({ preference }: { preference: AppearancePreference }) {
  return (
    <ThemeProvider preference={preference}>
      <Probe />
    </ThemeProvider>
  );
}

const last = () => seen[seen.length - 1]!;

describe('ThemeProvider', () => {
  beforeEach(() => {
    seen.length = 0;
    mounts = 0;
  });

  it('is light outside any provider', () => {
    mount(<Probe />);
    expect(last().theme.scheme).toBe('light');
    expect(last().colors).toBe(lightColors);
    expect(last().styles.box.backgroundColor).toBe(lightColors.bg);
  });

  it('switches schemes in place: new colours, no remount', () => {
    const r = mount(<App preference="light" />);
    expect(last().theme.isDark).toBe(false);
    const lightStyles = last().styles;

    act(() => {
      r.update(<App preference="dark" />);
    });
    expect(last().theme.scheme).toBe('dark');
    expect(last().colors).toBe(darkColors);
    expect(last().styles.box.backgroundColor).toBe(darkColors.bg);
    expect(last().styles.box.borderColor).toBe(darkColors.line);
    expect(last().styles.box.boxShadow).toBe(themeFor('dark').boxShadows.float);
    expect(last().tones).toEqual({ fill: darkColors.ink, scheme: 'dark' });
    expect(last().theme.statusBarStyle).toBe('light');
    expect(last().theme.blurTint).toBe('dark');

    act(() => {
      r.update(<App preference="light" />);
    });
    // Memoised per scheme: the very same sheet object comes back.
    expect(last().styles).toBe(lightStyles);
    expect(mounts).toBe(1);
    const host = r.root.findByProps({ testID: 'probe' });
    expect(host.props.style.backgroundColor).toBe(lightColors.bg);
  });

  it('resolves System to light while the rollout switch is off', () => {
    mount(<App preference="system" />);
    expect(last().theme.scheme).toBe('light');
  });

  it('ThemeScope pins a subtree', () => {
    mount(
      <ThemeProvider preference="dark">
        <ThemeScope scheme="light">
          <Probe />
        </ThemeScope>
      </ThemeProvider>,
    );
    expect(last().theme.scheme).toBe('light');
  });

  it('builds each scheme once (stable identities for memoised children)', () => {
    mount(<App preference="dark" />);
    const a = last();
    mount(<App preference="dark" />);
    const b = last();
    expect(b.styles).toBe(a.styles);
    expect(b.tones).toBe(a.tones);
    expect(b.theme).toBe(themeFor('dark'));
  });
});

describe('session Appearance setting', () => {
  it('defaults to System, persists a choice and survives sign-out and the demo reset', () => {
    expect(useSession.getState().appearance).toBe('system');
    act(() => {
      useSession.getState().setAppearance('dark');
    });
    expect(useSession.getState().appearance).toBe('dark');
    act(() => {
      useSession.getState().signOut();
      useSession.getState().resetAll();
    });
    expect(useSession.getState().appearance).toBe('dark');
    act(() => {
      useSession.getState().setAppearance('bogus' as AppearancePreference);
    });
    expect(useSession.getState().appearance).toBe('system');
  });
});

describe('native Appearance sync', () => {
  /**
   * Runs `fn` against a fresh `appearance` module on the given platform. Everything happens inside
   * `isolateModules`: react-native's lazy getters resolve from the registry active at call time.
   */
  function withPlatform(os: 'ios' | 'android' | 'web', fn: (mod: typeof import('../appearance'), calls: () => unknown[]) => void) {
    jest.isolateModules(() => {
      const RN = require('react-native');
      jest.replaceProperty(RN.Platform, 'OS', os);
      const spy = jest.spyOn(RN.Appearance, 'setColorScheme').mockImplementation(() => {});
      fn(require('../appearance'), () => spy.mock.calls.map((c) => c[0]));
    });
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('iOS: pins the native chrome to an explicit choice and hands System back (rollout on)', () => {
    withPlatform('ios', (mod, calls) => {
      mod.applyNativeAppearance('dark', true);
      mod.applyNativeAppearance('dark', true); // unchanged → no second call
      mod.applyNativeAppearance('system', true);
      mod.applyNativeAppearance('light', true);
      expect(calls()).toEqual(['dark', 'unspecified', 'light']);
    });
  });

  it('iOS: System stays light while the rollout switch is off', () => {
    withPlatform('ios', (mod, calls) => {
      mod.applyNativeAppearance('system', false);
      expect(calls()).toEqual(['light']);
    });
  });

  it('never overrides on Android or web', () => {
    for (const os of ['android', 'web'] as const) {
      withPlatform(os, (mod, calls) => {
        mod.applyNativeAppearance('dark', true);
        expect(calls()).toEqual([]);
      });
    }
  });
});
