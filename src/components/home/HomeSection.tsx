import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { enterFade, enterUp } from '@/components/motion';
import { PressableScale, Text } from '@/components/ui';
import { fonts, makeStyles, spacing, useColors } from '@/theme';

export interface SectionAction {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  /** Link (navigates, default) or plain button (e.g. "Clear"). */
  role?: 'link' | 'button';
}

export interface SectionTitleProps {
  title: string;
  action?: SectionAction;
  /** `h2` 19/24 (default) or the smaller 16/600 label used by Search ("Recent", "Popular"). */
  size?: 'h2' | 'label';
  style?: StyleProp<ViewStyle>;
}

/** R3 section header: a title and a quiet "See all" on the right (14/500 `inkSoft`). No subtitle (R3.A6). */
export function SectionTitle({ title, action, size = 'h2', style }: SectionTitleProps) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={[styles.titleRow, style]}>
      <Text variant={size === 'h2' ? 'h2' : undefined} style={size === 'label' ? styles.label : null} accessibilityRole="header" numberOfLines={1}>
        {title}
      </Text>
      {action ? (
        <PressableScale
          onPress={action.onPress}
          activeScale={0.94}
          hitSlop={10}
          accessibilityRole={action.role ?? 'link'}
          accessibilityLabel={action.accessibilityLabel ?? action.label}
          style={styles.action}
        >
          <Text style={styles.actionText} color={c.inkSoft}>
            {action.label}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

export interface HomeSectionProps extends Partial<Omit<SectionTitleProps, 'style'>> {
  /** Entrance order on the screen (40ms stagger, capped). */
  index?: number;
  /** Wrap the children in the 20px screen gutter. Rails pass false and pad themselves. */
  padded?: boolean;
  /**
   * The children run their own staggered rise (e.g. a list of rows): the section then only fades
   * in place, so nothing travels twice (DESIGN §7 checklist #6).
   */
  childrenAnimate?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** A Home/Search block (28 above): title row + content, rising in on mount. */
export function HomeSection({
  title,
  action,
  size,
  index = 0,
  padded = true,
  childrenAnimate = false,
  children,
  style,
}: HomeSectionProps) {
  const styles = useStyles();
  return (
    <Animated.View entering={childrenAnimate ? enterFade(index) : enterUp(index)} style={[styles.section, style]}>
      {title ? <SectionTitle title={title} action={action} size={size} /> : null}
      <View style={padded ? styles.padded : null}>{children}</View>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  section: { marginTop: 28 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.gutter,
    marginBottom: 14,
    minHeight: 24,
  },
  label: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: c.ink, flexShrink: 1 },
  action: { minHeight: 32, justifyContent: 'center', paddingLeft: spacing.xs },
  actionText: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 18 },
  padded: { paddingHorizontal: spacing.gutter },
}));
