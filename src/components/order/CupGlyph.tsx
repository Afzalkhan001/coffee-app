/**
 * The live pill's progress mark: a small line-art cup (white, 1.6 stroke, open top, handle, saucer)
 * that fills with peach coffee to `level`. The surface carries a gentle travelling wave; the level
 * pours up on mount and eases to each new step. Transform-only on the UI thread; the wave pauses
 * when `active` is false and under Reduce Motion (the level still shows, without the pour).
 */
import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { easeOutQuint, withAlpha } from '@/components/motion';
import { useColors } from '@/theme';

/** Glyph box (square). */
export const CUP_GLYPH_SIZE = 26;
const STROKE = 1.6;
const BOWL = { left: 3, top: 6, width: 16, height: 15 } as const;
const INNER_W = BOWL.width - STROKE * 2;
const INNER_H = BOWL.height - STROKE;
const WAVE_H = 4;
const WAVE_AMP = 1.1;
const WAVE_MS = 2600;

/** One wavelength per bowl width, two drawn, so sliding by one wavelength loops seamlessly. */
function wavePath(): string {
  const width = INNER_W * 2;
  const mid = WAVE_H / 2;
  let d = `M0 ${mid.toFixed(2)}`;
  for (let x = 1; x <= width; x += 1) {
    d += ` L${x} ${(mid - WAVE_AMP * Math.sin((2 * Math.PI * x) / INNER_W)).toFixed(2)}`;
  }
  return `${d} L${width} ${WAVE_H} L0 ${WAVE_H} Z`;
}
const WAVE_D = wavePath();

export interface CupGlyphProps {
  /** 0…1 fill. */
  level: number;
  /** Run the wave (pause it while the pill is hidden). */
  active?: boolean;
  color?: string;
  fill?: string;
  style?: StyleProp<ViewStyle>;
}

export function CupGlyph({ level, active = true, color: colorProp, fill: fillProp, style }: CupGlyphProps) {
  // Defaults are for the live pill's `capsule` (dark in both schemes): a white cup, peach coffee.
  const c = useColors();
  const color = colorProp ?? c.white;
  const fill = fillProp ?? c.peach;
  const reduced = useReducedMotion();
  const target = Math.max(0, Math.min(1, level));
  const fillLevel = useSharedValue(reduced ? target : 0);
  const phase = useSharedValue(0);

  useEffect(() => {
    // Pours on mount (after the pill has sprung in), then eases to each new step.
    fillLevel.set(withDelay(120, withTiming(target, { duration: 900, easing: easeOutQuint })));
  }, [target, fillLevel]);

  const wave = active && !reduced;
  useEffect(() => {
    if (!wave) return;
    phase.set(0);
    phase.set(withRepeat(withTiming(1, { duration: WAVE_MS, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(phase);
  }, [wave, phase]);

  const liquidStyle = useAnimatedStyle(() => ({
    // A full-height block slid down: the level animates as a transform, never as a height.
    transform: [{ translateY: (1 - fillLevel.get()) * (INNER_H + WAVE_H) }],
  }));
  const waveStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -phase.get() * INNER_W }] }));

  return (
    <View style={[styles.box, style]} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.bowlClip}>
        <Animated.View style={[styles.liquid, liquidStyle]}>
          <Animated.View style={[styles.wave, waveStyle]}>
            <Svg width={INNER_W * 2} height={WAVE_H}>
              <Path d={WAVE_D} fill={fill} />
            </Svg>
          </Animated.View>
          <View style={[styles.body, { backgroundColor: fill }]} />
        </Animated.View>
      </View>
      <View style={[styles.bowl, { borderColor: color }]} />
      <View style={[styles.handle, { borderColor: color }]} />
      <View style={[styles.saucer, { backgroundColor: withAlpha(color, 0.55) }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: CUP_GLYPH_SIZE, height: CUP_GLYPH_SIZE },
  // The liquid lives inside the bowl's stroke; the outline is drawn on top of it.
  bowlClip: {
    position: 'absolute',
    left: BOWL.left + STROKE,
    top: BOWL.top,
    width: INNER_W,
    height: INNER_H,
    overflow: 'hidden',
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
  },
  liquid: { position: 'absolute', left: 0, right: 0, top: -WAVE_H, height: INNER_H + WAVE_H },
  wave: { position: 'absolute', left: 0, top: 0, width: INNER_W * 2, height: WAVE_H },
  body: { position: 'absolute', left: 0, right: 0, top: WAVE_H - 1, bottom: 0 },
  bowl: {
    position: 'absolute',
    left: BOWL.left,
    top: BOWL.top,
    width: BOWL.width,
    height: BOWL.height,
    borderWidth: STROKE,
    borderTopWidth: 0,
    borderBottomLeftRadius: 6.5,
    borderBottomRightRadius: 6.5,
  },
  handle: {
    position: 'absolute',
    left: BOWL.left + BOWL.width - STROKE,
    top: BOWL.top + 2.5,
    width: 5.5,
    height: 7,
    borderWidth: STROKE,
    borderLeftWidth: 0,
    borderTopRightRadius: 3.5,
    borderBottomRightRadius: 3.5,
  },
  saucer: { position: 'absolute', left: 1, width: BOWL.width + 4, top: BOWL.top + BOWL.height + 1.5, height: STROKE, borderRadius: STROKE / 2 },
});
