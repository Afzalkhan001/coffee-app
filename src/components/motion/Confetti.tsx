import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { makeThemed, useColors } from '@/theme';
import { LINE_ART, LINE_ART_VIEWBOX } from './lineArtPaths';

type Kind = 'bean' | 'sparkle' | 'steam' | 'dot' | 'ring';

interface Particle {
  vx: number;
  vy: number;
  spin: number;
  size: number;
  kind: Kind;
  color: string;
  /** Launch offset, fraction of the timeline. */
  delay: number;
  /** Fraction of the timeline the particle stays visible. */
  life: number;
  flutter: number;
  phase: number;
}

const DURATION_S = 2.2;
const GRAVITY = 1250; // px/s²
const DRAG = 1.7; // 1/s air drag on the launch velocity
const KINDS: readonly Kind[] = ['bean', 'sparkle', 'bean', 'dot', 'steam', 'sparkle', 'ring', 'bean'];
/** For the night confirmation canvas (fixed accents: the same in both schemes). */
const useDefaultPalette = makeThemed((c): readonly string[] => [c.peach, c.white, c.sage, c.peachSoft]);
const STEAM_D = 'M7 19 C3 15 11 12 8 8 C6 5 10 2 10 1';
const FLASH = 84;

/** Deterministic PRNG: same burst for a seed, no Math.random() in render. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeParticles(count: number, palette: readonly string[], seed: number): Particle[] {
  const rand = mulberry32(seed);
  return Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + (rand() - 0.5) * Math.PI * 1.25; // upward fan, ±112°
    const speed = 480 + rand() * 560;
    return {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      spin: (rand() - 0.5) * 900,
      size: 12 + rand() * 11,
      kind: KINDS[i % KINDS.length] ?? 'dot',
      color: palette[Math.floor(rand() * palette.length)] ?? palette[0] ?? 'transparent',
      delay: rand() * 0.1,
      life: 0.72 + rand() * 0.28,
      flutter: 4 + rand() * 8,
      phase: rand() * Math.PI * 2,
    };
  });
}

function ParticleShape({ p }: { p: Particle }) {
  const stroke = 1.8;
  if (p.kind === 'dot') {
    const d = p.size * 0.42;
    return <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: p.color }} />;
  }
  if (p.kind === 'ring') {
    const d = p.size * 0.6;
    return <View style={{ width: d, height: d, borderRadius: d / 2, borderWidth: stroke, borderColor: p.color }} />;
  }
  if (p.kind === 'steam') {
    return (
      <Svg width={p.size} height={p.size} viewBox="0 0 20 20">
        <Path d={STEAM_D} fill="none" stroke={p.color} strokeWidth={(stroke * 20) / p.size} strokeLinecap="round" />
      </Svg>
    );
  }
  const strokes = p.kind === 'bean' ? LINE_ART.bean : LINE_ART.sparkle.slice(0, 1);
  return (
    <Svg width={p.size} height={p.size} viewBox={`0 0 ${LINE_ART_VIEWBOX} ${LINE_ART_VIEWBOX}`}>
      {strokes.map((s, i) => (
        <Path
          key={i}
          d={s.d}
          fill="none"
          stroke={p.color}
          strokeWidth={(stroke * LINE_ART_VIEWBOX) / p.size}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}

function ParticleView({ p, t, ox, oy }: { p: Particle; t: SharedValue<number>; ox: number; oy: number }) {
  const animatedStyle = useAnimatedStyle(() => {
    const local = Math.max(0, (t.get() - p.delay) / (1 - p.delay));
    const s = local * DURATION_S;
    const k = (1 - Math.exp(-DRAG * s)) / DRAG; // ∫ e^(−DRAG·t): velocity with air drag
    const x = p.vx * k + Math.sin(s * 5 + p.phase) * p.flutter * local;
    const y = p.vy * k + 0.5 * GRAVITY * s * s;
    return {
      opacity:
        local === 0 || local >= 1
          ? 0
          : interpolate(local, [0, 0.04, p.life * 0.65, p.life], [0, 1, 1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: ox + x - p.size / 2 },
        { translateY: oy + y - p.size / 2 },
        { rotate: `${p.spin * k}deg` },
        { scale: interpolate(local, [0, 0.07, 0.14], [0.2, 1.15, 1], Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <Animated.View style={[styles.particle, { width: p.size, height: p.size }, animatedStyle]}>
      <ParticleShape p={p} />
    </Animated.View>
  );
}

function Flash({ t, ox, oy, color }: { t: SharedValue<number>; ox: number; oy: number; color: string }) {
  const animatedStyle = useAnimatedStyle(() => {
    const v = t.get();
    return {
      opacity: v <= 0 || v >= 0.3 ? 0 : interpolate(v, [0, 0.04, 0.28], [0, 0.32, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: ox - FLASH / 2 },
        { translateY: oy - FLASH / 2 },
        { scale: interpolate(v, [0, 0.2], [0.2, 3], Extrapolation.CLAMP) },
      ],
    };
  });
  return <Animated.View style={[styles.flash, { backgroundColor: color }, animatedStyle]} />;
}

export interface ConfettiBurstProps {
  /** Fires on mount if true, and again each time it flips false → true. */
  play: boolean;
  /** Burst origin from the top of the container (px). Default 38% of its height. */
  originY?: number;
  /** Burst origin from the left (px). Default centre. */
  originX?: number;
  /** Particle colours. Default peach / white / sage / peach-soft (for the espresso screen). */
  colors?: string[];
  /** Default 28. */
  count?: number;
  seed?: number;
  style?: StyleProp<ViewStyle>;
}

/** Celebration burst of line-art beans, sparkles and steam; physics run per frame on the UI thread. */
export function ConfettiBurst({ play, originY, originX, colors: palette, count = 28, seed = 11, style }: ConfettiBurstProps) {
  const reduced = useReducedMotion();
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const c = useColors();
  const defaultPalette = useDefaultPalette();
  const t = useSharedValue(0);
  const particles = makeParticles(count, palette ?? defaultPalette, seed);

  useEffect(() => {
    if (!play || reduced || !box) return;
    // ONE linear clock for every particle; each worklet evaluates closed-form physics.
    t.set(0);
    t.set(withTiming(1, { duration: DURATION_S * 1000, easing: Easing.linear }));
  }, [play, reduced, box, t]);

  if (reduced) return null; // DESIGN §7: no particles under Reduce Motion

  const ox = originX ?? (box ? box.w / 2 : 0);
  const oy = originY ?? (box ? box.h * 0.38 : 0);

  return (
    <View
      style={[styles.layer, style]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (!box || box.w !== width || box.h !== height) setBox({ w: width, h: height });
      }}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {box ? (
        <>
          <Flash t={t} ox={ox} oy={oy} color={palette?.[0] ?? c.peach} />
          {particles.map((p, i) => (
            <ParticleView key={i} p={p} t={t} ox={ox} oy={oy} />
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, pointerEvents: 'none' },
  particle: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'center' },
  flash: { position: 'absolute', left: 0, top: 0, width: FLASH, height: FLASH, borderRadius: FLASH / 2 },
});
