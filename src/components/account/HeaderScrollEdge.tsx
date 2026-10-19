import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { withAlpha } from '@/components/motion';
import { makeStyles, makeThemed } from '@/theme';

/** Soft edge under the header once content scrolls beneath it. */
const EDGE = 10;
const useFade = makeThemed((c) => [withAlpha(c.bg, 0.9), withAlpha(c.bg, 0)] as const);

/**
 * Scroll position for a screen whose `ScreenHeader` sits above an `Animated.ScrollView`: pass
 * `onScroll` to the scroll view and `scrollY` to `<HeaderScrollEdge>`.
 */
export function useHeaderScroll(): {
  scrollY: SharedValue<number>;
  onScroll: ReturnType<typeof useAnimatedScrollHandler>;
} {
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.set(e.contentOffset.y);
    },
  });
  return { scrollY, onScroll };
}

/**
 * Header separation for account screens (D-27): a hairline plus a 10px cream fade that appear once
 * the content scrolls under the header, so rows dissolve instead of being sliced by the header's
 * edge. Render it as a sibling right after the scroll view, inside a `flex: 1` wrapper.
 */
export function HeaderScrollEdge({ scrollY }: { scrollY: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [4, 18], [0, 1], Extrapolation.CLAMP),
  }));
  const styles = useStyles();
  const fade = useFade();
  return (
    <Animated.View style={[styles.edge, style]}>
      <View style={styles.hairline} />
      <LinearGradient colors={fade} style={styles.fade} />
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  edge: { position: 'absolute', top: 0, left: 0, right: 0, height: EDGE, pointerEvents: 'none' },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: withAlpha(c.line, 0.9) },
  fade: { flex: 1 },
}));
