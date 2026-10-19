import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  clamp,
  css,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { makeThemed, useColors } from '@/theme';
import { easeInOutCubic } from './hooks';
import { LINE_ART, LINE_ART_VIEWBOX, type LineArtName, type LineArtStroke } from './lineArtPaths';

export type { LineArtName } from './lineArtPaths';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Slow idle drift (CSS keyframes: real CSS on web, native CSS engine on iOS/Android).
const floatSmall = css.keyframes({
  from: { transform: [{ translateY: 0 }, { rotate: '-2deg' }] },
  to: { transform: [{ translateY: -3 }, { rotate: '2deg' }] },
});
const floatMedium = css.keyframes({
  from: { transform: [{ translateY: 0 }, { rotate: '-2.5deg' }] },
  to: { transform: [{ translateY: -5 }, { rotate: '2.5deg' }] },
});
const floatLarge = css.keyframes({
  from: { transform: [{ translateY: 0 }, { rotate: '-2deg' }] },
  to: { transform: [{ translateY: -7 }, { rotate: '2deg' }] },
});

export interface LineArtProps {
  name: LineArtName;
  /** Rendered square size in px. Default 64. */
  size?: number;
  /** Main stroke colour. Default peach. */
  color?: string;
  /** Colour for detail strokes (steam, sparkles, texture). Default = `color`. */
  accentColor?: string;
  /** Stroke width in px (kept visually constant across sizes). Default 1.75 (2 at ≥96px). */
  strokeWidth?: number;
  /** Draw the strokes on (strokeDashoffset) when mounted / when this flips to true. */
  draw?: boolean;
  /** Draw-on delay in ms. */
  delay?: number;
  /** Total draw duration in ms. Default scales with stroke count (≤1.8s). */
  duration?: number;
  /** Gentle float drift (off under Reduce Motion). */
  float?: boolean;
  style?: StyleProp<ViewStyle>;
}

interface DrawnStrokeProps {
  stroke: LineArtStroke;
  index: number;
  count: number;
  progress: SharedValue<number>;
  color: string;
  width: number;
}

/** One stroke drawing itself inside its [start, end] window of the shared progress. */
function DrawnStroke({ stroke, index, count, progress, color, width }: DrawnStrokeProps) {
  const length = stroke.length;
  // Pad > half the stroke width so the round cap leaves no dot while hidden.
  const pad = width;
  const start = count > 1 ? (index / count) * 0.62 : 0;
  const end = count > 1 ? Math.min(1, start + 0.5) : 1;

  const animatedProps = useAnimatedProps(() => {
    const local = clamp((progress.get() - start) / (end - start), 0, 1);
    return { strokeDashoffset: (length + pad) * (1 - local) };
  });

  return (
    <AnimatedPath
      d={stroke.d}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={[length, length + 2 * pad]}
      animatedProps={animatedProps}
    />
  );
}

/** Hand-drawn line illustration (react-native-svg) with optional draw-on and float drift. */
export function LineArt({
  name,
  size = 64,
  color: colorProp,
  accentColor,
  strokeWidth,
  draw = false,
  delay = 0,
  duration,
  float = false,
  style,
}: LineArtProps) {
  const reduced = useReducedMotion();
  const c = useColors();
  const color = colorProp ?? c.peach;
  const strokes = LINE_ART[name];
  const px = strokeWidth ?? (size >= 96 ? 2 : 1.75);
  const width = (px * LINE_ART_VIEWBOX) / size;
  const accent = accentColor ?? color;
  const animateDraw = draw && !reduced;
  const total = duration ?? Math.min(900 + strokes.length * 110, 1800);
  const progress = useSharedValue(animateDraw ? 0 : 1);

  useEffect(() => {
    if (!animateDraw) {
      progress.set(1);
      return;
    }
    progress.set(0);
    progress.set(withDelay(delay, withTiming(1, { duration: total, easing: easeInOutCubic })));
    return () => cancelAnimation(progress);
  }, [animateDraw, delay, total, name, progress]);

  const drift = float && !reduced;
  const floatStyle = drift
    ? {
        animationName: size < 32 ? floatSmall : size < 72 ? floatMedium : floatLarge,
        animationDuration: 4200 + ((size * 37 + delay) % 2400),
        animationDirection: 'alternate' as const,
        animationIterationCount: 'infinite' as const,
        animationTimingFunction: 'ease-in-out' as const,
      }
    : null;

  return (
    <View
      style={[{ width: size, height: size }, style]}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[styles.fill, floatStyle]}>
        <Svg width={size} height={size} viewBox={`0 0 ${LINE_ART_VIEWBOX} ${LINE_ART_VIEWBOX}`}>
          {strokes.map((s, i) =>
            animateDraw ? (
              <DrawnStroke
                key={i}
                stroke={s}
                index={i}
                count={strokes.length}
                progress={progress}
                color={s.accent ? accent : color}
                width={width}
              />
            ) : (
              <Path
                key={i}
                d={s.d}
                fill="none"
                stroke={s.accent ? accent : color}
                strokeWidth={width}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ),
          )}
        </Svg>
      </Animated.View>
    </View>
  );
}

// ── LineArtField (R3.A9 compositions) ─────────────────────────────────────────

type Tone = 'peach' | 'white';
/** Onboarding / auth (night) doodles: fixed accents, the same in both schemes. */
const useToneColors = makeThemed((c): Record<Tone, string> => ({ peach: c.peach, white: c.white }));

/** One drawing in the 390-wide reference frame (x/y px from the screen top-left, assuming a 47pt safe area). */
interface FieldItem {
  name: LineArtName;
  x: number;
  y: number;
  size: number;
  rotate?: number;
  tone: Tone;
  accent?: Tone;
  opacity?: number;
  /** Persists across all three onboarding pages (croissant, portafilter). */
  shared?: boolean;
}

/** Page 1 (R3.A9 table). Croissant and portafilter crop off the screen edges on purpose. */
const PAGE_1: readonly FieldItem[] = [
  { name: 'croissant', x: -46, y: 92, size: 168, rotate: -16, tone: 'peach', shared: true },
  { name: 'cup', x: 128, y: 22, size: 118, rotate: 8, tone: 'white', opacity: 0.92 },
  { name: 'portafilter', x: 250, y: 104, size: 196, rotate: 26, tone: 'peach', shared: true },
  { name: 'beans', x: 24, y: 262, size: 84, rotate: 18, tone: 'white', opacity: 0.9 },
  { name: 'latte', x: 140, y: 186, size: 132, rotate: -10, tone: 'peach' },
  { name: 'cookie', x: 300, y: 280, size: 86, rotate: 0, tone: 'white', opacity: 0.85 },
];

const SHARED = PAGE_1.filter((i) => i.shared);

/** Page 2: the café (latte) with a dotted route to a big pin. */
const PAGE_2: readonly FieldItem[] = [
  ...SHARED,
  { name: 'latte', x: 40, y: 150, size: 120, rotate: -8, tone: 'peach' },
  { name: 'pin', x: 196, y: 96, size: 150, rotate: 6, tone: 'peach', accent: 'white' },
  { name: 'beans', x: 300, y: 290, size: 70, rotate: 18, tone: 'white', opacity: 0.9 },
];

/** Page 3: the order-ready bell. */
const PAGE_3: readonly FieldItem[] = [
  ...SHARED,
  { name: 'bell', x: 110, y: 80, size: 160, rotate: -8, tone: 'peach', accent: 'white' },
  { name: 'steam', x: 60, y: 250, size: 70, tone: 'white', opacity: 0.9 },
  { name: 'cookie', x: 290, y: 270, size: 86, tone: 'white', opacity: 0.85 },
];

/** Page 2's route: 8 dots (4px, white 50%) curving from the latte towards the pin's tip. */
const ROUTE: readonly { x: number; y: number }[] = Array.from({ length: 8 }, (_, i) => {
  const t = 0.08 + (0.84 * i) / 7;
  const u = 1 - t;
  const [x0, y0, cx, cy, x1, y1] = [150, 300, 212, 318, 262, 244];
  return { x: u * u * x0 + 2 * u * t * cx + t * t * x1, y: u * u * y0 + 2 * u * t * cy + t * t * y1 };
});

/**
 * - `onboarding` / `onboarding2` / `onboarding3`: the R3 page compositions (page 1 is also the
 *   default). `onboardingCompact` is an alias of page 1 (the composition scales to short bands).
 * - `auth`: page 1 at scale 0.9 (sign-in top), so croissant and portafilter still crop.
 * - `confirmation` / `empty`: retired by R3 (cut-outs and confetti / no art); render nothing.
 */
export type LineArtFieldVariant =
  | 'onboarding'
  | 'onboarding2'
  | 'onboarding3'
  | 'onboardingCompact'
  | 'auth'
  | 'confirmation'
  | 'empty';

const FIELDS: Record<LineArtFieldVariant, readonly FieldItem[]> = {
  onboarding: PAGE_1,
  onboarding2: PAGE_2,
  onboarding3: PAGE_3,
  onboardingCompact: PAGE_1,
  auth: PAGE_1,
  confirmation: [],
  empty: [],
};

/** Reference band: capsule top (0.448 × 844) − 16 on the 390×844 frame. */
const REFERENCE_BAND = 362;
const REFERENCE_SAFE_TOP = 47;
/** R3.A9: doodles render big with a 2.2px stroke. */
const FIELD_STROKE = 2.2;

export interface LineArtFieldProps {
  variant?: LineArtFieldVariant;
  /**
   * Which drawings to render: `all` (default), only the pieces `shared` across onboarding pages
   * (croissant, portafilter), or only the `page`-specific ones — so a pager can keep the shared
   * pair still while page pieces change.
   */
  pieces?: 'all' | 'shared' | 'page';
  /** Draw the illustrations on, staggered. Default true. */
  draw?: boolean;
  /** Base delay before the first illustration draws (ms). */
  delay?: number;
  /** Safe-area top of the screen the field starts at (default: the window's inset). */
  safeTop?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * One bold, intentional doodle composition (R3.A9): big drawings (74–196px) in peach or white at
 * 85–92%, rotated −16°…26°, several cropped by the screen edge — no sparkles, no discs. Fills its
 * parent, which should start at the screen top and end 16px above the onboarding capsule: x and
 * size scale by W/390, y by min(1, fieldHeight / 362), shifted by the real safe area.
 */
export function LineArtField({ variant = 'onboarding', pieces = 'all', draw = true, delay = 0, safeTop, style }: LineArtFieldProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const TONE_COLOR = useToneColors();
  const [fieldHeight, setFieldHeight] = useState(0);
  const all = FIELDS[variant];
  const items = pieces === 'all' ? all : all.filter((i) => (pieces === 'shared' ? i.shared : !i.shared));
  const k = variant === 'auth' ? 0.9 : 1;
  const sx = (width / 390) * k;
  const sy = Math.min(1, fieldHeight / REFERENCE_BAND) * k;
  // Auth scales about the centre, so the edge pieces still bleed off both sides.
  const offsetX = variant === 'auth' ? (width - 390 * sx) / 2 : 0;
  const offsetY = (safeTop ?? insets.top) - REFERENCE_SAFE_TOP;
  const showRoute = variant === 'onboarding2' && pieces !== 'shared';

  return (
    <View
      onLayout={(e) => setFieldHeight(Math.round(e.nativeEvent.layout.height))}
      style={[styles.field, style]}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {fieldHeight > 0
        ? items.map((item, i) => {
            const size = Math.round(item.size * sx);
            return (
              <View
                key={`${item.name}-${i}`}
                style={[
                  styles.item,
                  {
                    left: Math.round(offsetX + item.x * sx),
                    top: Math.round(item.y * sy + offsetY),
                    opacity: item.opacity ?? 1,
                    transform: [{ rotate: `${item.rotate ?? 0}deg` }],
                  },
                ]}
              >
                <LineArt
                  name={item.name}
                  size={size}
                  color={TONE_COLOR[item.tone]}
                  accentColor={item.accent ? TONE_COLOR[item.accent] : undefined}
                  strokeWidth={FIELD_STROKE}
                  draw={draw}
                  delay={delay + i * 110}
                  float
                />
              </View>
            );
          })
        : null}
      {fieldHeight > 0 && showRoute
        ? ROUTE.map((d, i) => (
            <View
              key={`route-${i}`}
              style={[styles.dot, { left: Math.round(offsetX + d.x * sx) - 2, top: Math.round(d.y * sy + offsetY) - 2 }]}
            />
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill },
  field: { ...StyleSheet.absoluteFill, overflow: 'hidden', pointerEvents: 'none' },
  item: { position: 'absolute' },
  dot: { position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.5)' },
});
