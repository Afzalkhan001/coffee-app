/**
 * Inline status line for the sign-in screens (OTP errors, offline errors with a retry, "new code
 * sent"). R3: quiet text, no box; the only glyph is a state glyph (cloud-off when offline).
 * Springs in (fade + rise), fades out, and glides when siblings move.
 */
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { enterUp, exitFade, layoutSpring, withAlpha } from '@/components/motion';
import { Icon, Text } from '@/components/ui';
import { fonts, makeThemed, useColors } from '@/theme';

export type NoticeTone = 'error' | 'info' | 'success';
/** `light`: on the canvas sheet (adapts to the scheme). `dark`: on the night top (fixed). */
export type NoticeSurface = 'light' | 'dark';

const useTextTones = makeThemed((c): Record<NoticeSurface, Record<NoticeTone, string>> => ({
  light: { error: c.danger, info: c.inkSoft, success: c.sageText },
  dark: { error: c.peach, info: withAlpha(c.white, 0.7), success: c.sage },
}));

export interface InlineNoticeProps {
  tone: NoticeTone;
  message: string;
  surface?: NoticeSurface;
  /** A state glyph only (e.g. 'cloud-offline'); decorative icons are dropped in R3. */
  icon?: string;
  action?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
}

const STATE_GLYPHS = new Set(['cloud-offline', 'cloud-off']);

export function InlineNotice({ tone, message, surface = 'light', icon, action, style }: InlineNoticeProps) {
  const c = useColors();
  const color = useTextTones()[surface][tone];
  const glyph = icon && STATE_GLYPHS.has(icon) ? icon : undefined;
  return (
    <Animated.View
      entering={enterUp(0)}
      exiting={exitFade}
      layout={layoutSpring}
      style={[styles.row, style]}
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
    >
      {glyph ? (
        <View style={styles.glyph}>
          <Icon name={glyph} size={16} color={color} />
        </View>
      ) : null}
      <Text style={styles.message} color={color}>
        {message}
        {action ? ' ' : ''}
      </Text>
      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          hitSlop={12}
        >
          <Text style={styles.action} color={surface === 'dark' ? c.white : c.ink}>
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', columnGap: 6 },
  glyph: { paddingTop: 2 },
  message: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
  action: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, textDecorationLine: 'underline' },
});
