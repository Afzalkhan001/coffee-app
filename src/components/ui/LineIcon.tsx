import { memo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useColors } from '@/theme';
import { LINE_ICONS, lineIconStroke, type LineIconName } from './lineIconPaths';

export { LINE_ICONS, isLineIconName, resolveLineIcon, type LineIconName } from './lineIconPaths';

export interface LineIconProps {
  name: LineIconName;
  /** Rendered square size in px. Default 24. */
  size?: number;
  color?: string;
  /** Stroke in 24-grid units at 24px (default 1.75); compensated for small and large sizes. */
  strokeWidth?: number;
  /** Fill the glyph's solid shape where it has one (rating star, heart). */
  filled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Ember Roast's custom line icon set: 24×24 grid, 1.75 stroke, round caps and joins, drawn in the
 * same soft hand-drawn language as the `LineArt` illustrations. `<Icon>` renders through this
 * automatically whenever a name (or a mapped Ionicons name) is in the set.
 */
function LineIconImpl({ name, size = 24, color: colorProp, strokeWidth, filled = false, style }: LineIconProps) {
  const c = useColors();
  const color = colorProp ?? c.ink;
  const glyph = LINE_ICONS[name];
  const sw = lineIconStroke(size, strokeWidth);
  const solid = 'solid' in glyph && filled ? glyph.solid : undefined;
  const dots = 'dots' in glyph ? glyph.dots : undefined;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style} pointerEvents="none">
      {solid?.map((d, i) => <Path key={`s${i}`} d={d} fill={color} />)}
      {glyph.d.map((d, i) => (
        <Path
          key={i}
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {dots?.map(([cx, cy, r], i) => <Circle key={`d${i}`} cx={cx} cy={cy} r={r} fill={color} />)}
    </Svg>
  );
}

export const LineIcon = memo(LineIconImpl);
