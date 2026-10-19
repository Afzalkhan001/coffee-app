/**
 * The onboarding sage capsule (DESIGN.md §R3.B, ref 1): a bold rounded capsule that bleeds off the
 * right edge, a thin white wave and a glowing orange dot with a translucent halo that travels the
 * wave with the pager's progress (UI thread, one formula for the path and the dot).
 */
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { clamp, css, useAnimatedStyle, useReducedMotion, type SharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { withAlpha } from '@/components/motion';
import { makeStyles, useColors } from '@/theme';

/** Wave at the 140px reference height: 16px amplitude, 176px wavelength, starting 22px in. */
const REF_HEIGHT = 140;
const AMPLITUDE = 16;
const WAVELENGTH = 176;
const START = 22;
/** Dot travel: from this far into the capsule (page 1) to this far before its visible end (page 3). */
const TRAVEL_IN = 44;
const TRAVEL_END = 48;
const DOT = 14;
const HALO = 44;
const SAMPLES = 64;

const breathe = css.keyframes({
  from: { transform: [{ scale: 0.86 }], opacity: 0.85 },
  to: { transform: [{ scale: 1.08 }], opacity: 1 },
});

interface Wave {
  mid: number;
  amp: number;
  length: number;
  /** x where the sine crosses the midline going down (the page-1 dot rests there). */
  origin: number;
}

function waveY(x: number, w: Wave) {
  'worklet';
  return w.mid + w.amp * Math.sin(((x - w.origin) / w.length) * Math.PI * 2);
}

function wavePath(w: Wave, from: number, to: number): string {
  const pts: [number, number][] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const x = from + ((to - from) * i) / SAMPLES;
    pts.push([x, waveY(x, w)]);
  }
  // Catmull-Rom → cubic Bézier for a silky curve.
  let d = `M${pts[0]![0].toFixed(2)} ${pts[0]![1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d;
}

export interface SageCapsuleProps {
  /** 0..1 across all onboarding pages. */
  progress: SharedValue<number>;
  /** Full capsule width (including the part past the screen edge). */
  width: number;
  height: number;
  /** The part of the capsule that is on screen (the dot never travels past it). */
  visibleWidth: number;
  style?: StyleProp<ViewStyle>;
}

export function SageCapsule({ progress, width, height, visibleWidth, style }: SageCapsuleProps) {
  const c = useColors();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const k = height / REF_HEIGHT;
  const wave: Wave = { mid: height / 2, amp: AMPLITUDE * k, length: WAVELENGTH * k, origin: TRAVEL_IN * k };
  const d = wavePath(wave, START * k, width);
  const from = TRAVEL_IN * k;
  const to = Math.max(from + 1, visibleWidth - TRAVEL_END * k);

  const dotStyle = useAnimatedStyle(() => {
    const x = from + clamp(progress.get(), 0, 1) * (to - from);
    const y = waveY(x, wave);
    return { transform: [{ translateX: x - HALO / 2 }, { translateY: y - HALO / 2 }] };
  });

  return (
    <View
      style={[styles.capsule, { width, height, borderRadius: height / 2 }, style]}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Path d={d} fill="none" stroke={c.white} strokeOpacity={0.95} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
      <Animated.View style={[styles.dotBox, dotStyle]}>
        <Animated.View
          style={[
            styles.halo,
            reduced
              ? null
              : {
                  animationName: breathe,
                  animationDuration: 1700,
                  animationDirection: 'alternate',
                  animationIterationCount: 'infinite',
                  animationTimingFunction: 'ease-in-out',
                },
          ]}
        />
        <View style={styles.dot} />
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  capsule: { backgroundColor: c.sage, overflow: 'hidden' },
  dotBox: { position: 'absolute', left: 0, top: 0, width: HALO, height: HALO, alignItems: 'center', justifyContent: 'center' },
  halo: {
    position: 'absolute',
    width: HALO,
    height: HALO,
    borderRadius: HALO / 2,
    backgroundColor: withAlpha(c.white, 0.24),
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: c.glow,
    boxShadow: `0px 0px 14px 4px ${withAlpha(c.glow, 0.75)}`,
  },
}));
