import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { enterUp, layoutSpring } from '@/components/motion';
import { Text } from '@/components/ui';
import { fonts, makeStyles, radii, useColors } from '@/theme';

export interface ListGroupProps {
  /** Sentence-case label above the sheet ("Account"). Omit it when the content is obvious. */
  title?: string;
  /** Right side of the label row (e.g. "3 ready"). */
  right?: ReactNode;
  children: ReactNode;
  /** Rendered inside the sheet after the rows, without a hairline. */
  footer?: ReactNode;
  /** Rendered under the sheet (a quiet caption). */
  below?: ReactNode;
  /** Where the hairlines between rows start (the row text's left edge). Default 16. */
  dividerInset?: number;
  /** Staggered entrance index. */
  index?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * R3.A10 "one list = one white sheet": a sentence-case label (600 15 `inkSoft`, 8px above the
 * sheet), then a white r28 sheet with no shadow and no border; rows are separated by hairlines
 * inset to where their text starts.
 */
export function ListGroup({ title, right, children, footer, below, dividerInset = 16, index = 0, style }: ListGroupProps) {
  const c = useColors();
  const styles = useStyles();
  const rows = Children.toArray(children);
  return (
    <Animated.View entering={enterUp(index)} layout={layoutSpring} style={style}>
      {title ? (
        <View style={styles.labelRow}>
          <Text style={styles.label} color={c.inkSoft} accessibilityRole="header">
            {title}
          </Text>
          {right}
        </View>
      ) : null}
      <View style={styles.sheet}>
        {rows.map((row, i) => (
          <Fragment key={isValidElement(row) && row.key != null ? row.key : i}>
            {i > 0 ? <View style={[styles.hairline, { marginLeft: dividerInset }]} /> : null}
            {row}
          </Fragment>
        ))}
        {footer}
      </View>
      {below}
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  label: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
  sheet: { backgroundColor: c.surface, borderRadius: radii.lg, overflow: 'hidden' },
  hairline: { height: StyleSheet.hairlineWidth * 2, backgroundColor: c.line, marginRight: 16 },
}));
