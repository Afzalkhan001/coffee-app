/**
 * The onboarding doodle composition (DESIGN.md §R3.A9): big, loose line drawings in peach or white,
 * rotated, several cropped by the screen edge, no sparkles and nothing behind them. One bold
 * composition per screen instead of scattered stickers.
 *
 * Positions come from the R3.A9 table (390-wide frame, y from the screen top assuming a 47pt safe
 * area). x and size scale by frame / 390, y by min(1, band / 362), shifted by the real safe area.
 * Laid out against the onboarding FRAME (not the window), so a centred 520px column on desktop web
 * keeps the phone composition.
 *
 * The pager splits it in layers: the croissant and portafilter (`shared`) stay put across all three
 * pages while each page's own pieces (`page1/2/3`) slide with their page at 1.2× and draw on as the
 * page arrives. `auth` is the page-1 composition at 0.9 for the sign-in top, without the low row
 * (beans, cookie) so the wordmark has clean night canvas under it.
 */
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { LineArt, popIn, withAlpha, type LineArtName } from '@/components/motion';
import { makeStyles, makeThemed } from '@/theme';
import { FIELD_REFERENCE_BAND } from './onboardingLayout';

type Tone = 'peach' | 'white';
/** Night art: the same in both schemes (fixed tokens). */
const useTones = makeThemed((c): Record<Tone, string> => ({ peach: c.peach, white: c.white }));

interface Doodle {
  name: LineArtName;
  x: number;
  y: number;
  size: number;
  rotate?: number;
  tone: Tone;
  accent?: Tone;
  opacity?: number;
}

const CROISSANT: Doodle = { name: 'croissant', x: -46, y: 92, size: 168, rotate: -16, tone: 'peach' };
const PORTAFILTER: Doodle = { name: 'portafilter', x: 250, y: 104, size: 196, rotate: 26, tone: 'peach' };

/** Persist across all three pages. */
const SHARED: readonly Doodle[] = [CROISSANT, PORTAFILTER];

const PAGE_1: readonly Doodle[] = [
  { name: 'cup', x: 128, y: 22, size: 118, rotate: 8, tone: 'white', opacity: 0.92 },
  { name: 'beans', x: 24, y: 262, size: 84, rotate: 18, tone: 'white', opacity: 0.9 },
  { name: 'latte', x: 140, y: 186, size: 132, rotate: -10, tone: 'peach' },
  { name: 'cookie', x: 300, y: 280, size: 86, rotate: 0, tone: 'white', opacity: 0.85 },
];

/**
 * The café (latte) with a dotted route curving up to a big pin. R3.A9 put the latte and pin on top of
 * the croissant and portafilter that stay on screen; here the pin takes the centre gap between them
 * (where page 1's cup and latte sit) and the latte drops to the low-left corner (page 1's beans).
 */
const PAGE_2: readonly Doodle[] = [
  { name: 'pin', x: 124, y: 66, size: 150, rotate: 6, tone: 'peach', accent: 'white' },
  { name: 'latte', x: 22, y: 250, size: 104, rotate: -8, tone: 'peach' },
  { name: 'beans', x: 300, y: 290, size: 70, rotate: 18, tone: 'white', opacity: 0.9 },
];

/** The order-ready bell. */
const PAGE_3: readonly Doodle[] = [
  // Centred in the gap between the croissant and the portafilter, a little lower (R3.A9: 110, 80).
  { name: 'bell', x: 118, y: 108, size: 160, rotate: -8, tone: 'peach', accent: 'white' },
  { name: 'steam', x: 60, y: 250, size: 70, tone: 'white', opacity: 0.9 },
  { name: 'cookie', x: 290, y: 270, size: 86, tone: 'white', opacity: 0.85 },
];

/** Sign-in top: page 1 at 0.9 minus the low row (beans, cookie), which would sit under the wordmark. */
const AUTH: readonly Doodle[] = [CROISSANT, PAGE_1[0]!, PORTAFILTER, PAGE_1[2]!];

/** Page 2's route: 8 dots (4px, white 50%) hooking from the latte along the bottom and up to the pin's tip. */
const ROUTE: readonly { x: number; y: number }[] = Array.from({ length: 8 }, (_, i) => {
  const t = 0.08 + (0.84 * i) / 7;
  const u = 1 - t;
  const [x0, y0, cx, cy, x1, y1] = [134, 318, 214, 336, 204, 230] as const;
  return { x: u * u * x0 + 2 * u * t * cx + t * t * x1, y: u * u * y0 + 2 * u * t * cy + t * t * y1 };
});

export type DoodleSet = 'shared' | 'page1' | 'page2' | 'page3' | 'auth';

const SETS: Record<DoodleSet, readonly Doodle[]> = {
  shared: SHARED,
  page1: PAGE_1,
  page2: PAGE_2,
  page3: PAGE_3,
  auth: AUTH,
};

/** R3.A9: rendered stroke 2.2px at every size. */
const STROKE = 2.2;
const REFERENCE_SAFE_TOP = 47;
const DRAW_STAGGER = 110;

export interface DoodleFieldProps {
  set: DoodleSet;
  /** Frame width the composition is laid out against. */
  width: number;
  /** Band height (screen top → capsule top − 16, or the auth top area). */
  band: number;
  /** Safe-area top of the screen the field starts at. */
  safeTop: number;
  /** Overall scale (auth: 0.9, about the frame's centre so the edge pieces still crop). */
  scale?: number;
  /** Extra vertical shift. */
  offsetY?: number;
  /** Vertical scale override (auth squeezes the rows to fit above its wordmark; sizes keep `scale`). */
  yScale?: number;
  /** Drawings to leave out (auth drops the latte when it would sit under the wordmark). */
  omit?: readonly LineArtName[];
  /** Draw the strokes on, staggered from `delay`. */
  draw?: boolean;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

/** Absolutely fills its parent (which should start at the screen top) and never takes touches. */
export function DoodleField({ set, width, band, safeTop, scale = 1, offsetY = 0, yScale, omit, draw = true, delay = 0, style }: DoodleFieldProps) {
  const styles = useStyles();
  const tones = useTones();
  const items = omit ? SETS[set].filter((d) => !omit.includes(d.name)) : SETS[set];
  const sx = (width / 390) * scale;
  const sy = yScale ?? Math.min(1, band / FIELD_REFERENCE_BAND) * scale;
  const ox = (width - 390 * sx) / 2;
  const oy = safeTop - REFERENCE_SAFE_TOP + offsetY;

  return (
    <View style={[styles.field, style]} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {items.map((item, i) => (
        <View
          key={`${item.name}-${i}`}
          style={[
            styles.item,
            {
              left: Math.round(ox + item.x * sx),
              top: Math.round(oy + item.y * sy),
              opacity: item.opacity ?? 1,
              transform: [{ rotate: `${item.rotate ?? 0}deg` }],
            },
          ]}
        >
          <LineArt
            name={item.name}
            size={Math.round(item.size * sx)}
            color={tones[item.tone]}
            accentColor={item.accent ? tones[item.accent] : undefined}
            strokeWidth={STROKE}
            draw={draw}
            delay={delay + i * DRAW_STAGGER}
            float
          />
        </View>
      ))}
      {set === 'page2'
        ? ROUTE.map((d, i) => (
            <Animated.View
              key={`route-${i}`}
              entering={draw ? popIn(i).delay(delay + 420 + i * 70) : undefined}
              style={[styles.dot, { left: Math.round(ox + d.x * sx) - 2, top: Math.round(oy + d.y * sy) - 2 }]}
            />
          ))
        : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  field: { ...StyleSheet.absoluteFill, pointerEvents: 'none' },
  item: { position: 'absolute' },
  dot: { position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: withAlpha(c.white, 0.5) },
}));
