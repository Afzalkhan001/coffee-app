import { useEffect } from 'react';
import { BackHandler, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { ProductArt } from '@/components/domain';
import { withAlpha } from '@/components/motion';
import { Icon, PressableScale, Text } from '@/components/ui';
import { fonts, makeStyles, radii, spacing, springs, useColors, useTheme } from '@/theme';
import type { Promotion } from '@/types/models';
import { useHomeNotifications } from './notifications';

export interface NotificationItem {
  id: string;
  /** The row's cut-out (R3 "small" art, no container): the order's first item, the promo's product, a reward. */
  image?: string;
  title: string;
  body: string;
  onPress: () => void;
}

export interface NotificationsPopoverProps {
  open: boolean;
  onClose: () => void;
  items: NotificationItem[];
  /** Distance from the top of the screen (just under the bell). */
  top: number;
}

const MAX_WIDTH = 344;
/** R3.A4 "small" surface: a bare 48px cut-out, no tile, no disc. */
const ART = 48;

/**
 * Small inbox card that springs out of the bell (scale from its top-right corner + fade) over a
 * soft dim. Rows lead with a bare 48px cut-out (R3: no icon discs, no doodles). Stays mounted so it
 * can animate out; ignores touches while closed.
 */
export function NotificationsPopover({ open, onClose, items, top }: NotificationsPopoverProps) {
  const theme = useTheme();
  const c = useColors();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(MAX_WIDTH, width - spacing.gutter * 2);
  const progress = useSharedValue(0);

  useEffect(() => {
    const to = open ? 1 : 0;
    progress.set(reduced ? withTiming(to, { duration: 160 }) : withSpring(to, springs.smooth));
  }, [open, reduced, progress]);

  // Android back closes the popover first. It isn't a Modal, so without this the back press went
  // to the tab navigator and, on Home, sent the app to the background.
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [open, onClose]);

  const dimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 1], [0, 1], Extrapolation.CLAMP),
  }));
  const cardStyle = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: interpolate(p, [0, 0.45], [0, 1], Extrapolation.CLAMP),
      transform: [{ translateY: (1 - p) * -10 }, { scale: 0.9 + 0.1 * p }],
    };
  });

  const select = (item: NotificationItem) => {
    onClose();
    item.onPress();
  };

  return (
    // Closed: no touches, hidden from screen readers (aria-hidden on web too) and out of the tab order.
    <View
      style={[StyleSheet.absoluteFill, { pointerEvents: open ? 'auto' : 'none' }]}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
      aria-hidden={!open}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.dim, dimStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          tabIndex={open ? 0 : -1}
          accessibilityRole="button"
          accessibilityLabel="Close notifications"
        />
      </Animated.View>

      <Animated.View style={[styles.card, theme.shadows.float, { top, width: cardWidth }, cardStyle]} accessibilityViewIsModal={open}>
        <View style={styles.header}>
          <Text variant="h3" accessibilityRole="header">
            Notifications
          </Text>
        </View>

        {items.length === 0 ? (
          <View style={styles.empty}>
            <Text variant="body" color={c.inkSoft} align="center">
              You’re all caught up
            </Text>
          </View>
        ) : (
          items.map((item, i) => (
            <View key={item.id}>
              {i > 0 ? <View style={styles.divider} /> : null}
              <PressableScale
                onPress={() => select(item)}
                tabIndex={open ? 0 : -1}
                activeScale={0.98}
                style={styles.row}
                accessibilityLabel={`${item.title}. ${item.body}`}
              >
                <View style={styles.art}>{item.image ? <ProductArt image={item.image} size={ART} shadow={0.18} /> : null}</View>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text variant="caption" color={c.inkSoft} numberOfLines={2}>
                    {item.body}
                  </Text>
                </View>
                <Icon name="chevron-forward" size={18} color={c.inkMuted} />
              </PressableScale>
            </View>
          ))
        )}
      </Animated.View>
    </View>
  );
}

/** The Home bell's popover with its live items (kept in its own component so the ETA clock only re-renders this). */
export function HomeInbox({
  promotions,
  ...rest
}: Omit<NotificationsPopoverProps, 'items'> & { promotions: Promotion[] | undefined }) {
  const items = useHomeNotifications(promotions);
  return <NotificationsPopover {...rest} items={items} />;
}

const useStyles = makeStyles((c, t) => ({
  // An ink dim would lighten the espresso canvas in dark: a black one there (DESIGN §R4 "Modal scrim").
  dim: { backgroundColor: t.isDark ? withAlpha(c.black, 0.5) : withAlpha(c.ink, 0.18) },
  card: {
    position: 'absolute',
    right: spacing.gutter,
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxs,
    transformOrigin: 'top right',
    // Dark: a hairline edge lifts the card off the canvas (the black shadow alone reads as a hole).
    ...(t.isDark ? { borderWidth: StyleSheet.hairlineWidth * 2, borderColor: withAlpha(c.white, 0.08) } : null),
  },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxs },
  empty: { alignItems: 'center', paddingVertical: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
    paddingVertical: 6,
    minHeight: 68,
  },
  art: { width: ART, height: ART },
  rowCopy: { flex: 1, minWidth: 0, gap: 1 },
  rowTitle: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: c.ink },
  divider: { height: StyleSheet.hairlineWidth * 2, backgroundColor: c.line, marginLeft: spacing.sm + ART + spacing.sm, marginRight: spacing.md },
}));
