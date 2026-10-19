/**
 * The white notched sheet (ref 1, R3.B product detail): r32 shoulders, one smooth concave notch
 * (22 deep × 260 wide) at the top centre where the plate sits, and a 36×4 grabber 12px below the
 * notch. The top edge is an SVG so the notch is a true curve. Springs up 24px + fades in on mount
 * (`smooth`); Reduce Motion → quick fade only.
 */
import { useEffect, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { easeOutQuint } from '@/components/motion';
import { makeStyles, springs, useColors } from '@/theme';
import { NOTCH_DEPTH, NOTCH_WIDTH, SHEET_EDGE } from './layout';

const RISE = 24;

/** Top-edge outline: rounded corners, flat shoulders, one soft concave notch of `notchWidth`. */
export function sheetEdgePath(width: number, notchWidth: number): string {
  const r = SHEET_EDGE;
  const cx = width / 2;
  const half = Math.min(notchWidth / 2, cx - r - 6);
  const x0 = cx - half;
  const x1 = cx + half;
  const d = NOTCH_DEPTH;
  // Long, shallow shoulders into a flat-bottomed dip (ref 1's sheet), not a V.
  const ease = half * 0.52;
  const floor = half * 0.3;
  return [
    `M0 ${r}`,
    `A${r} ${r} 0 0 1 ${r} 0`,
    `L${x0} 0`,
    `C${x0 + ease} 0 ${cx - floor - ease * 0.35} ${d} ${cx - floor} ${d}`,
    `L${cx + floor} ${d}`,
    `C${cx + floor + ease * 0.35} ${d} ${x1 - ease} 0 ${x1} 0`,
    `L${width - r} 0`,
    `A${r} ${r} 0 0 1 ${width} ${r}`,
    `L${width} ${r + 1}`,
    `L0 ${r + 1}`,
    'Z',
  ].join(' ');
}

export interface NotchedSheetProps {
  width: number;
  /** Minimum height of the white body below the edge (fills the screen on short content). */
  minBodyHeight: number;
  /** Delay before the sheet springs up (lets the hero land first). */
  delay?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function NotchedSheet({ width, minBodyHeight, delay = 0, children, style }: NotchedSheetProps) {
  const c = useColors();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const enter = useSharedValue(0);

  useEffect(() => {
    enter.set(
      withDelay(
        delay,
        reduced
          ? withTiming(1, { duration: 180, easing: easeOutQuint, reduceMotion: ReduceMotion.Never })
          : withSpring(1, springs.smooth),
        ReduceMotion.Never,
      ),
    );
  }, [enter, delay, reduced]);

  const enterStyle = useAnimatedStyle(() => {
    const e = enter.get();
    return {
      opacity: interpolate(e, [0, 0.5], [0, 1], Extrapolation.CLAMP),
      transform: [{ translateY: reduced ? 0 : (1 - e) * RISE }],
    };
  });

  return (
    <Animated.View style={[enterStyle, style]}>
      <View style={{ height: SHEET_EDGE }}>
        <Svg width={width} height={SHEET_EDGE + 1} style={styles.edge}>
          <Path d={sheetEdgePath(width, NOTCH_WIDTH)} fill={c.surface} />
        </Svg>
      </View>
      <View style={[styles.body, { minHeight: minBodyHeight }]}>{children}</View>
      {/* After the body: it hangs 2px below the 32px edge strip and must paint over the white. */}
      <View style={styles.grabber} />
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  edge: { position: 'absolute', left: 0, top: 0 },
  grabber: {
    position: 'absolute',
    top: NOTCH_DEPTH + 12,
    left: '50%',
    marginLeft: -18,
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.line,
  },
  body: { backgroundColor: c.surface, marginTop: -1, paddingTop: 1 },
}));
