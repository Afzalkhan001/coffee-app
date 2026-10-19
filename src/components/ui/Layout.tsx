import { router } from 'expo-router';
import { type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { homeRouteForAuth } from '@/lib/authRoute';
import { fonts, makeStyles, spacing, useColors } from '@/theme';
import { CircleButton } from './Buttons';
import { Text } from './Text';

/** Full-screen container with the canvas background (cream / espresso) and safe-area top padding. */
export function Screen({
  children,
  style,
  bg,
  edges = ['top'],
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  bg?: string;
  edges?: ('top' | 'bottom')[];
}) {
  const insets = useSafeAreaInsets();
  const c = useColors();
  return (
    <View
      style={[
        { flex: 1, backgroundColor: bg ?? c.bg },
        edges.includes('top') ? { paddingTop: insets.top } : null,
        edges.includes('bottom') ? { paddingBottom: insets.bottom } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Default back: pop when there's history, otherwise go to the first screen the current auth state
 * can reach (Home is behind the sign-in guard, so a cold-opened Legal page signed out would
 * otherwise be a dead end).
 */
export function goBackOrHome() {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(homeRouteForAuth());
}

/**
 * R3 screen header (sentence case, `title` type 30/36):
 *  - `inline` (default with a back button): back circle at left 20, the title beside it at x 76,
 *    vertically centred with the circle (ref 1 "Cart"), optional right slot.
 *  - `center` (`centerTitle`): back + a centred 20/600 title ("Track order").
 *  - `stacked`: the title on its own line under the back row.
 *  - `showBack={false}`: a tab-screen header — the title at left 20 and the right slot.
 * `subtitle` is kept for older call sites; R3 screens have no subtitles unless the spec lists one.
 */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  showBack = true,
  right,
  centerTitle = false,
  layout: layoutProp,
  style,
}: {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  showBack?: boolean;
  right?: ReactNode;
  centerTitle?: boolean;
  layout?: 'inline' | 'center' | 'stacked';
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const styles = useStyles();
  const back = onBack ?? goBackOrHome;
  const layout = layoutProp ?? (centerTitle ? 'center' : 'inline');
  const backButton = showBack ? (
    <CircleButton icon="chevron-back" onPress={back} size={44} accessibilityLabel="Go back" tone="white" />
  ) : null;

  if (layout === 'center') {
    return (
      <View style={[styles.header, style]}>
        <View style={styles.headerRow}>
          {backButton ?? <View style={styles.slot} />}
          {title ? (
            <Text style={styles.centerTitle} numberOfLines={1} accessibilityRole="header">
              {title}
            </Text>
          ) : null}
          <View style={styles.headerRight}>{right ?? <View style={styles.slot} />}</View>
        </View>
      </View>
    );
  }

  if (layout === 'stacked') {
    return (
      <View style={[styles.header, style]}>
        {backButton ? (
          <View style={styles.headerRow}>
            {backButton}
            <View style={styles.headerRight}>{right}</View>
          </View>
        ) : null}
        {title ? (
          <View style={backButton ? styles.stackedTitle : null}>
            <Text variant="title" accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? (
              <Text variant="body" color={c.inkSoft} style={styles.subtitle}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.header, style]}>
      <View style={styles.headerRow}>
        {backButton}
        <View style={[styles.inlineTitle, backButton ? styles.inlineTitleAfterBack : null]}>
          {title ? (
            <Text variant="title" numberOfLines={1} accessibilityRole="header">
              {title}
            </Text>
          ) : null}
        </View>
        {right ? <View style={styles.headerRight}>{right}</View> : null}
      </View>
      {subtitle ? (
        <Text variant="body" color={c.inkSoft} style={styles.subtitle}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { paddingHorizontal: spacing.gutter, paddingTop: spacing.xs, paddingBottom: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minWidth: 44, justifyContent: 'flex-end' },
  slot: { width: 44 },
  inlineTitle: { flex: 1, minWidth: 0 },
  // Back circle (44) + 12 = the title starts at x 76 (ref 1 "Cart").
  inlineTitleAfterBack: { marginLeft: spacing.sm },
  centerTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26, color: c.ink, marginHorizontal: spacing.xs },
  stackedTitle: { marginTop: spacing.md },
  subtitle: { marginTop: 2 },
}));
