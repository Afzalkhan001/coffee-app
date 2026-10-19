import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { makeStyles, useTheme } from '@/theme';
import { withAlpha } from './color';

const IS_IOS = Platform.OS === 'ios';
const IS_ANDROID = Platform.OS === 'android';

/**
 * BlurView whose `intensity` can be driven by `useAnimatedProps` (create once, at module scope).
 * iOS: animate the blur strength, never the opacity of the blur or its parents — UIVisualEffectView
 * renders a plain tint at alpha < 1 and the frost snaps in at the end of the fade.
 */
export const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

/** Soft edge under a frosted header: content dissolves into it instead of being sliced. */
export const FROSTED_EDGE = 10;

export interface FrostedLayerProps {
  /** 0..1 reveal (blur strength + fill opacity), usually scroll-driven. Omit = fully shown. */
  progress?: SharedValue<number>;
  /** Blur tint. Default: the scheme's (`theme.blurTint`). */
  tint?: 'light' | 'dark';
  /** Blur intensity at progress 1 (iOS/web). Default 70. */
  intensity?: number;
  /** Fill colour token. Default the scheme's canvas (`bg`: cream / espresso). */
  fill?: string;
  /** Fill opacity at progress 1. Default 0.93 (0.97 on Android, where there is no real blur). */
  fillOpacity?: number;
  /** 50% hairline + a 10px gradient fade below the layer. Default true. */
  edge?: boolean;
  /** Fixed height from the top; omitted, the layer fills its parent. */
  height?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Frosted backdrop for sticky headers, top bars and modal scrims (DESIGN §7 "Depth"). Opaque enough
 * that nothing is readable through it (the old 78% fill + light blur let text ghost through), with a
 * soft gradient edge. On iOS the blur fades in by intensity (see `AnimatedBlurView`); on web the
 * blur element's own opacity fades (never a parent's: see below); Android uses a near-opaque fill.
 */
export function FrostedLayer({
  progress,
  tint: tintProp,
  intensity = 70,
  fill: fillProp,
  fillOpacity,
  edge = true,
  height,
  style,
}: FrostedLayerProps) {
  const theme = useTheme();
  const styles = useStyles();
  const tint = tintProp ?? theme.blurTint;
  const fill = fillProp ?? theme.colors.bg;
  const opacity = fillOpacity ?? (IS_ANDROID ? 0.97 : 0.93);
  const p = useDerivedValue(() => (progress ? progress.get() : 1));

  const fadeStyle = useAnimatedStyle(() => ({ opacity: p.get() }));
  const blurProps = useAnimatedProps(() => ({ intensity: intensity * p.get() }));

  return (
    <View style={[styles.wrap, height === undefined ? styles.fillParent : { height }, style]}>
      <View style={[StyleSheet.absoluteFill, styles.clip]}>
        {IS_IOS ? (
          <AnimatedBlurView tint={tint} animatedProps={blurProps} style={StyleSheet.absoluteFill} />
        ) : IS_ANDROID ? null : (
          // Web: fade the blur element's OWN opacity. Chrome stops sampling a backdrop-filter for good
          // once an ancestor has been at 0 < opacity < 1 (it becomes the backdrop root), so a wrapper
          // fade left the bar unblurred after a slow scroll.
          <AnimatedBlurView intensity={intensity} tint={tint} style={[StyleSheet.absoluteFill, fadeStyle]} />
        )}
        {/* Sibling fill: expo-blur on web overwrites a BlurView's own backgroundColor. */}
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(fill, opacity) }, fadeStyle]} />
      </View>
      {edge ? <Animated.View style={[styles.hairline, fadeStyle]} /> : null}
      {edge ? (
        <Animated.View style={[styles.edge, fadeStyle]}>
          <LinearGradient colors={[withAlpha(fill, 0.9), withAlpha(fill, 0)]} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: 'none' },
  fillParent: { bottom: 0 },
  clip: { overflow: 'hidden' },
  hairline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: withAlpha(c.line, 0.5),
  },
  edge: { position: 'absolute', left: 0, right: 0, bottom: -FROSTED_EDGE, height: FROSTED_EDGE },
}));
