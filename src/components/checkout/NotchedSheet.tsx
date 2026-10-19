import { useState, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { makeStyles, radii, useColors } from '@/theme';
import { nestedLayout } from './LayoutBlock';

const R = radii.sheet;
const NOTCH_W = 90;
const NOTCH_D = 12;

/** Top edge of the sheet: r32 corners with one small concave notch at the centre (ref 1 cart). */
function notchPath(w: number): string {
  const x1 = (w - NOTCH_W) / 2;
  const x2 = (w + NOTCH_W) / 2;
  const cx = w / 2;
  return [
    `M0 ${R + 1}`,
    `L0 ${R}`,
    `A${R} ${R} 0 0 1 ${R} 0`,
    `L${x1} 0`,
    `C${x1 + NOTCH_W * 0.24} 0 ${cx - NOTCH_W * 0.24} ${NOTCH_D} ${cx} ${NOTCH_D}`,
    `C${cx + NOTCH_W * 0.24} ${NOTCH_D} ${x2 - NOTCH_W * 0.24} 0 ${x2} 0`,
    `L${w - R} 0`,
    `A${R} ${R} 0 0 1 ${w} ${R}`,
    `L${w} ${R + 1}`,
    'Z',
  ].join(' ');
}

export interface NotchedSheetProps {
  children: ReactNode;
  /**
   * Content inside the notch. Defaults to a 6px peach dot: a decorative accent, not a grabber (the
   * sheet can't be dragged, so it mustn't look draggable). Pass `null` for nothing.
   */
  notch?: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * The cart's white list sheet (R3.B cart, ref 1): r32, no shadow, a 12-deep × 90-wide concave notch
 * at the top centre holding a peach dot. Its height springs as rows come and go.
 */
export function NotchedSheet({ children, notch, style, contentStyle }: NotchedSheetProps) {
  const c = useColors();
  const styles = useStyles();
  const [width, setWidth] = useState(0);
  // In the body, not as a default parameter (React Compiler skips computed defaults).
  const notchContent = notch === undefined ? <View style={styles.dot} /> : notch;
  return (
    <Animated.View layout={nestedLayout} style={style} onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}>
      <View style={styles.top}>
        {width > 0 ? (
          <Svg width={width} height={R + 1} style={styles.svg}>
            <Path d={notchPath(width)} fill={c.surface} />
          </Svg>
        ) : null}
        {notchContent ? <View style={styles.notch}>{notchContent}</View> : null}
      </View>
      <View style={[styles.body, contentStyle]}>{children}</View>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  top: { height: R, alignItems: 'center' },
  svg: { position: 'absolute', left: 0, top: 0 },
  notch: { marginTop: NOTCH_D + 5, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.peach },
  body: {
    backgroundColor: c.surface,
    borderBottomLeftRadius: R,
    borderBottomRightRadius: R,
    paddingBottom: 12,
    marginTop: -1,
  },
}));
