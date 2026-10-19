/**
 * Three steam strokes that rise ~22px and fade, staggered 600ms (design-refs A2 #2, snippet A).
 * Shown above hot drinks only; they fade in/out when the temperature changes. Static and faint
 * under Reduce Motion. Only transform + opacity animate (UI thread), and the loops stop while the
 * screen is covered (e.g. the cart pushed on top), so hidden views never keep the UI thread busy.
 */
import { useIsFocused } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { easeOutQuint, withAlpha } from '@/components/motion';
import { makeThemed } from '@/theme';

const WISP_D = 'M6 46 C 0 36, 12 30, 6 20 S 2 6, 6 0';
const WISP_W = 15;
const WISP_H = 58;
const RISE = 22;

const appear = FadeIn.duration(520).easing(easeOutQuint);
const vanish = FadeOut.duration(360);

function Wisp({ delay, color, active }: { delay: number; color: string; active: boolean }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    if (!active) {
      cancelAnimation(t);
      t.set(withTiming(0, { duration: 240, easing: easeOutQuint }));
      return;
    }
    t.set(withDelay(delay, withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, false)));
    return () => cancelAnimation(t);
  }, [delay, reduced, active, t]);

  const style = useAnimatedStyle(() => {
    const p = t.get();
    return {
      opacity: reduced ? 0.4 : interpolate(p, [0, 0.25, 1], [0, 0.9, 0]),
      transform: [{ translateY: -RISE * p }, { scaleY: 0.9 + 0.25 * p }],
    };
  });

  return (
    <Animated.View style={style}>
      <Svg width={WISP_W} height={WISP_H} viewBox="0 0 12 46">
        <Path d={WISP_D} stroke={color} strokeWidth={2} strokeLinecap="round" fill="none" />
      </Svg>
    </Animated.View>
  );
}

export interface SteamWispsProps {
  visible: boolean;
  style?: StyleProp<ViewStyle>;
}

/** White wisps with one peach; a touch softer on the dark hero, where full white would glare. */
const useWispTones = makeThemed((c, t) => ({ white: withAlpha(c.white, t.isDark ? 0.78 : 0.95), accent: c.peach }));

export function SteamWisps({ visible, style }: SteamWispsProps) {
  const focused = useIsFocused();
  const tones = useWispTones();
  return (
    <View style={[styles.slot, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {visible ? (
        <Animated.View entering={appear} exiting={vanish} style={styles.row}>
          <Wisp delay={0} color={tones.white} active={focused} />
          <Wisp delay={600} color={tones.accent} active={focused} />
          <Wisp delay={1200} color={tones.white} active={focused} />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Height the steam needs above the plate. */
export const STEAM_HEIGHT = WISP_H;

const styles = StyleSheet.create({
  slot: { height: WISP_H, alignItems: 'center', justifyContent: 'flex-end', pointerEvents: 'none' },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
});
