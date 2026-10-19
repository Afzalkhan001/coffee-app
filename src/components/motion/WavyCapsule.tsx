import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  clamp,
  css,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { makeStyles, useColors } from '@/theme';
import { withAlpha } from './color';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const DOT = 12;
const SAMPLES = 48;

const breathe = css.keyframes({
  from: { transform: [{ scale: 0.85 }], opacity: 0.55 },
  to: { transform: [{ scale: 1.25 }], opacity: 0.2 },
});

interface Wave {
  pad: number;
  span: number;
  mid: number;
  amp: number;
  waves: number;
}

/** y(x) of the steam line — a worklet so the SAME formula builds the path (JS) and moves the dot (UI). */
function waveY(x: number, w: Wave) {
  'worklet';
  const t = (x - w.pad) / w.span;
  return w.mid + w.amp * Math.sin(t * w.waves * Math.PI * 2);
}

/** Smooth path through the sampled wave + an x → arc-length lookup for the travelled trail. */
function buildWave(w: Wave) {
  const xs: number[] = [];
  const lens: number[] = [];
  const pts: [number, number][] = [];
  let len = 0;
  for (let i = 0; i <= SAMPLES; i++) {
    const x = w.pad + (w.span * i) / SAMPLES;
    const y = waveY(x, w);
    const prev = pts[pts.length - 1];
    if (prev) len += Math.hypot(x - prev[0], y - prev[1]);
    pts.push([x, y]);
    xs.push(x);
    lens.push(len);
  }
  // Catmull-Rom → cubic Bézier for a silky curve.
  let d = `M${pts[0]?.[0].toFixed(2)} ${pts[0]?.[1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)] ?? p2;
    if (!p0 || !p1 || !p2 || !p3) continue;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return { d, xs, lens, total: len };
}

export interface WavyCapsuleProps {
  /** 0..1 across all onboarding pages (e.g. scrollX / (pageWidth × (pages − 1))). */
  progress: SharedValue<number>;
  /** Default 220. */
  width?: number;
  /** Default 60. */
  height?: number;
  style?: StyleProp<ViewStyle>;
}

/** Sage capsule holding a white steam wave; a glowing peach dot travels along it with progress. */
export function WavyCapsule({ progress, width = 220, height = 60, style }: WavyCapsuleProps) {
  const reduced = useReducedMotion();
  const c = useColors();
  const styles = useStyles();
  const wave: Wave = { pad: height * 0.5, span: width - height, mid: height / 2, amp: height * 0.17, waves: 2.5 };
  const { d, xs, lens, total } = buildWave(wave);

  const trailProps = useAnimatedProps(() => {
    const x = wave.pad + clamp(progress.get(), 0, 1) * wave.span;
    return { strokeDashoffset: total + 2 - interpolate(x, xs, lens) };
  });

  const dotStyle = useAnimatedStyle(() => {
    const x = wave.pad + clamp(progress.get(), 0, 1) * wave.span;
    const y = waveY(x, wave);
    return { transform: [{ translateX: x - DOT / 2 }, { translateY: y - DOT / 2 }] };
  });

  const haloAnimation = reduced
    ? null
    : {
        animationName: breathe,
        animationDuration: 1600,
        animationDirection: 'alternate' as const,
        animationIterationCount: 'infinite' as const,
        animationTimingFunction: 'ease-in-out' as const,
      };

  return (
    <View
      style={[styles.capsule, { width, height, borderRadius: height / 2 }, style]}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Path d={d} fill="none" stroke={withAlpha(c.white, 0.42)} strokeWidth={2} strokeLinecap="round" />
        <AnimatedPath
          d={d}
          fill="none"
          stroke={c.white}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={[total + 2, total + 2]}
          animatedProps={trailProps}
        />
      </Svg>
      <Animated.View style={[styles.dot, dotStyle]}>
        <Animated.View style={[styles.halo, haloAnimation]} />
        <View style={styles.core} />
        <View style={styles.highlight} />
      </Animated.View>
    </View>
  );
}

const HALO = DOT * 2.6;

// Onboarding (night) only: fixed accents, identical in both schemes.
const useStyles = makeStyles((c) => ({
  capsule: {
    backgroundColor: c.sage,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: withAlpha(c.white, 0.22),
  },
  dot: { position: 'absolute', left: 0, top: 0, width: DOT, height: DOT },
  halo: {
    position: 'absolute',
    left: (DOT - HALO) / 2,
    top: (DOT - HALO) / 2,
    width: HALO,
    height: HALO,
    borderRadius: HALO / 2,
    backgroundColor: withAlpha(c.peach, 0.45),
  },
  core: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: c.peach,
    boxShadow: `0px 0px 10px ${withAlpha(c.peach, 0.95)}`,
  },
  highlight: {
    position: 'absolute',
    left: DOT * 0.28,
    top: DOT * 0.22,
    width: DOT * 0.3,
    height: DOT * 0.3,
    borderRadius: DOT,
    backgroundColor: withAlpha(c.white, 0.85),
  },
}));
