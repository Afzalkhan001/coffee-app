import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Ellipse } from 'react-native-svg';
import { isNetworkError } from '@/api';
import { enterUp, type LineArtName } from '@/components/motion';
import { Icon, PillButton, Text } from '@/components/ui';
import { fonts, makeStyles, spacing, useColors } from '@/theme';
import { ContactShadow } from './productArt';

/**
 * R3 empty-state art: `plate` (an empty plate on its contact shadow — empty cart, no past orders)
 * or `none` (search empty). Legacy line-art names are accepted so older call sites compile and
 * render the plate (R3.A9: no line-art in empty states).
 */
export type EmptyArt = 'plate' | 'none' | LineArtName;

export interface EmptyStateProps {
  /** Default 'plate'. */
  art?: EmptyArt;
  title: string;
  /** Optional, ≤ 10 words (R3). */
  message?: string;
  /** Ink pill. `icon` is ignored: R3 text buttons carry no leading icon. */
  action?: { label: string; onPress: () => void; icon?: string };
  /** Tighter spacing for inline use (inside lists/sheets). */
  compact?: boolean;
  /** @deprecated R3 has no sparkles; ignored. */
  sparkle?: boolean;
  /** Extra content under the action — e.g. a "Popular right now" rail so empty search keeps selling. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

const PLATE_W = 160;
const PLATE_H = 28;

/** An empty plate (ellipse 160×28, 1.5px `line`) standing on a contact shadow. */
function EmptyPlate() {
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={styles.plate} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* The pool sits just under the rim (the plate's white fill covers its top half). */}
      <ContactShadow box={PLATE_W} tone="light" widthRatio={0.86} style={styles.plateShadow} />
      <Svg width={PLATE_W} height={PLATE_H}>
        <Ellipse cx={PLATE_W / 2} cy={PLATE_H / 2} rx={PLATE_W / 2 - 1} ry={PLATE_H / 2 - 1} fill={c.surface} stroke={c.line} strokeWidth={1.5} />
        <Ellipse cx={PLATE_W / 2} cy={PLATE_H / 2} rx={PLATE_W * 0.3} ry={PLATE_H * 0.27} fill="none" stroke={c.line} strokeWidth={1.5} />
      </Svg>
    </View>
  );
}

/** R3 empty state: no disc, no line-art — optional plate, 22/700 title, short message, ink pill. */
export function EmptyState({ art = 'plate', title, message, action, compact = false, children, style }: EmptyStateProps) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={[styles.wrap, compact ? styles.wrapCompact : null, style]}>
      {art !== 'none' ? (
        <Animated.View entering={enterUp(0)} style={styles.art}>
          <EmptyPlate />
        </Animated.View>
      ) : null}
      <Animated.View entering={enterUp(1)}>
        <Text style={styles.title} align="center" accessibilityRole="header">
          {title}
        </Text>
      </Animated.View>
      {message ? (
        <Animated.View entering={enterUp(2)}>
          <Text variant="body" color={c.inkSoft} align="center" style={styles.message}>
            {message}
          </Text>
        </Animated.View>
      ) : null}
      {action ? (
        <Animated.View entering={enterUp(3)} style={styles.action}>
          <PillButton label={action.label} tone="ink" onPress={action.onPress} />
        </Animated.View>
      ) : null}
      {children ? (
        <Animated.View entering={enterUp(4)} style={styles.extra}>
          {children}
        </Animated.View>
      ) : null}
    </View>
  );
}

export interface ErrorStateProps {
  error: unknown;
  onRetry: () => void;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Offline / failure state (R3): a 28px cloud-off glyph, "You're offline", one line, "Try again". */
export function ErrorState({ error, onRetry, compact, style }: ErrorStateProps) {
  const offline = isNetworkError(error);
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={[styles.wrap, compact ? styles.wrapCompact : null, style]}>
      <Animated.View entering={enterUp(0)} style={styles.glyph}>
        <Icon name={offline ? 'cloud-off' : 'alert'} size={28} color={c.inkSoft} />
      </Animated.View>
      <Animated.View entering={enterUp(1)}>
        <Text style={styles.title} align="center" accessibilityRole="header">
          {offline ? 'You’re offline' : 'Something went wrong'}
        </Text>
      </Animated.View>
      <Animated.View entering={enterUp(2)}>
        <Text variant="body" color={c.inkSoft} align="center" style={styles.message}>
          {offline ? 'Check your connection and try again.' : 'Please try again in a moment.'}
        </Text>
      </Animated.View>
      <Animated.View entering={enterUp(3)} style={styles.action}>
        <PillButton label="Try again" tone="ink" onPress={onRetry} />
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl, paddingVertical: spacing.xxxl },
  wrapCompact: { paddingVertical: spacing.xl },
  art: { marginBottom: 40 },
  plate: { width: PLATE_W, height: PLATE_H },
  plateShadow: { top: PLATE_H - 8 },
  glyph: { marginBottom: spacing.md },
  title: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, color: c.ink },
  message: { marginTop: spacing.xs, maxWidth: 300 },
  action: { marginTop: spacing.xl },
  extra: { alignSelf: 'stretch', marginTop: spacing.xxl },
}));
