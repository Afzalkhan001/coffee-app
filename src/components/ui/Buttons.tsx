import { type ReactNode } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { withAlpha } from '@/components/motion/color';
import { fonts, layout, makeStyles, makeThemed, radii, spacing, useTheme } from '@/theme';
import type { PressHapticKind } from '@/lib/haptics';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

// ── CircleButton ─────────────────────────────────────────────
/**
 * - `white`: header icon buttons on the canvas (R3: flat, no shadow).
 * - `canvas`: `bg` fill, for controls inside white sheets (qty steppers).
 * - `frost`: white 55% + blur over a tinted hero (Android: an opaque-ish fill, no real blur).
 * - `ink`, `glass` (on night), `cream` (legacy), `ghost` (hairline outline).
 */
export type CircleTone = 'white' | 'ink' | 'glass' | 'cream' | 'ghost' | 'canvas' | 'frost';

type ToneColors = { bg: string; fg: string; border?: string };

const useCircleTones = makeThemed((c, t): Record<CircleTone, ToneColors> => ({
  white: { bg: c.surface, fg: c.ink },
  ink: { bg: c.ink, fg: c.onInk },
  // On night in both schemes.
  glass: { bg: c.glass, fg: c.white, border: c.glassBorder },
  cream: { bg: c.surfaceAlt, fg: c.ink },
  ghost: { bg: 'transparent', fg: c.ink, border: c.line },
  canvas: { bg: c.bg, fg: c.ink },
  // Android BlurView is only a tint: a denser fill keeps the glyph readable over the hero.
  frost: {
    bg: Platform.OS === 'android' ? (t.isDark ? 'rgba(36,28,23,0.86)' : 'rgba(255,255,255,0.78)') : c.frost,
    fg: c.ink,
  },
}));

export function CircleButton({
  icon,
  onPress,
  size = layout.circleButton,
  tone = 'white',
  iconSize,
  disabled,
  accessibilityLabel,
  style,
  shadow = false,
  hapticKind = null,
  activeScale = 0.92,
  children,
}: {
  icon?: IconName | string;
  onPress?: () => void;
  size?: number;
  tone?: CircleTone;
  /** Glyph size. Default: 20 for 44px header buttons (R3.A8), else 42% of the size. */
  iconSize?: number;
  disabled?: boolean;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
  /** R3: circles are flat on the canvas (planes separate by colour). Opt in for a floating circle. */
  shadow?: boolean;
  hapticKind?: PressHapticKind | null;
  /** Press scale (quantity bumps use 0.9). */
  activeScale?: number;
  children?: ReactNode;
}) {
  const theme = useTheme();
  const t = useCircleTones()[tone];
  const glyph = iconSize ?? (size === layout.headerButton ? 20 : Math.round(size * 0.42));
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      hapticKind={hapticKind}
      activeScale={activeScale}
      hitSlop={size < 44 ? (44 - size) / 2 : undefined}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: t.bg,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: t.border ? StyleSheet.hairlineWidth * 2 : 0,
          borderColor: t.border,
          opacity: disabled ? 0.4 : 1,
          overflow: tone === 'frost' ? 'hidden' : undefined,
        },
        shadow ? theme.shadows.float : null,
        style,
      ]}
    >
      {tone === 'frost' && Platform.OS !== 'android' ? (
        <BlurView intensity={24} tint={theme.blurTint} style={StyleSheet.absoluteFill} />
      ) : null}
      {children ?? (icon ? <Icon name={icon} size={glyph} color={t.fg} /> : null)}
    </PressableScale>
  );
}

// ── PillButton ───────────────────────────────────────────────
/**
 * - `ink` (primary in-flow action; inverts in dark), `white`, `outline` (1.5px ink), `muted`
 *   (1.5px `inkMuted` outline — a locked reward cost), `ember`, `sage` (deep sage), `cream`,
 *   `danger` (a destructive confirm: white on `danger` in both schemes).
 * R3.A8: no leading icons in text buttons — leave `icon` empty unless the spec keeps a glyph.
 */
export type PillTone = 'ink' | 'white' | 'outline' | 'muted' | 'ember' | 'sage' | 'cream' | 'danger';

const usePillTones = makeThemed((c): Record<PillTone, ToneColors> => ({
  ink: { bg: c.ink, fg: c.onInk },
  white: { bg: c.surface, fg: c.ink },
  outline: { bg: 'transparent', fg: c.ink, border: c.ink },
  muted: { bg: 'transparent', fg: c.inkMuted, border: c.inkMuted },
  ember: { bg: c.ember, fg: c.white },
  sage: { bg: c.sageDeep, fg: c.white }, // white on plain sage is ~2.4:1 (DESIGN §2)
  cream: { bg: c.bg, fg: c.ink },
  danger: { bg: c.danger, fg: c.white },
}));

const PILL_HEIGHT = { xs: 32, sm: 36, md: 48, lg: 56 } as const;

export function PillButton({
  label,
  onPress,
  tone = 'ink',
  icon,
  iconRight,
  size = 'md',
  disabled,
  loading,
  fullWidth,
  style,
  hapticKind = null,
  accessibilityLabel,
}: {
  label: string;
  onPress?: () => void;
  tone?: PillTone;
  icon?: IconName | string;
  iconRight?: IconName | string;
  /** xs 32 (Reorder), sm 36, md 48, lg 56. */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  hapticKind?: PressHapticKind | null;
  accessibilityLabel?: string;
}) {
  const styles = useStyles();
  const t = usePillTones()[tone];
  const h = PILL_HEIGHT[size];
  const small = size === 'xs' || size === 'sm';
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      hapticKind={hapticKind}
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={h < 44 ? { top: (44 - h) / 2, bottom: (44 - h) / 2 } : undefined}
      style={[
        {
          height: h,
          paddingHorizontal: size === 'xs' ? 14 : small ? spacing.md : spacing.xl,
          borderRadius: radii.pill,
          backgroundColor: t.bg,
          borderWidth: t.border ? 1.5 : 0,
          borderColor: t.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={t.fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={small ? 16 : 18} color={t.fg} /> : null}
          <Text style={small ? styles.pillSmall : styles.pillLabel} color={t.fg}>
            {label}
          </Text>
          {iconRight ? <Icon name={iconRight} size={small ? 16 : 18} color={t.fg} /> : null}
        </>
      )}
    </PressableScale>
  );
}

// ── PrimaryBar (ref 1 black pill with white circle) ───────────
/**
 * The one primary action per screen: a 64px pill with the label (18/700) on the left and a 52px
 * circle (22px glyph) inset 6px on the right. `ink` (default) on the canvas: an ink bar with a
 * white circle in light, inverted (cream bar, espresso circle) in dark. `white` on `night`
 * (confirmation "Track order": white bar, ink circle) is the same in both schemes.
 */
export function PrimaryBar({
  label,
  left,
  icon = 'arrow-forward',
  onPress,
  disabled,
  loading,
  hint,
  tone = 'ink',
  style,
  hapticKind = null,
  disabledHapticKind = 'warning',
  accessibilityLabel,
}: {
  /** Text on the left of the bar (e.g. "Checkout" or a price). */
  label?: string;
  /** Custom left content (e.g. a RollingNumber). Overrides label. */
  left?: ReactNode;
  icon?: IconName | string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Shown above the bar when disabled (e.g. "Choose a size to continue"). */
  hint?: string;
  tone?: 'ink' | 'white';
  style?: StyleProp<ViewStyle>;
  /**
   * Default `null` (a bar that only moves on is silent); committing CTAs (Add, Place order, Confirm)
   * pass `press`.
   */
  hapticKind?: PressHapticKind | null;
  /**
   * What a tap on the `disabled` bar fires. Default `warning`, together with the screen's nudge
   * (shake / scroll to the missing step), so `onPress` must not fire its own. Pass `null` when the
   * screen picks the haptic itself (e.g. OTP: `warning` for a short code, `error` for an expired one).
   */
  disabledHapticKind?: PressHapticKind | null;
  accessibilityLabel?: string;
}) {
  const { colors: c, shadows } = useTheme();
  const styles = useStyles();
  const white = tone === 'white';
  // R3 disabled: keep the bar's own fill (no greyed-out web button) and drop the CTA shadow; the
  // label dims and the circle turns into a translucent disc with a dimmed glyph.
  const fg = white ? (disabled ? withAlpha(c.inkFixed, 0.45) : c.inkFixed) : disabled ? withAlpha(c.onInk, 0.5) : c.onInk;
  const glyph = white ? (disabled ? withAlpha(c.white, 0.7) : c.white) : disabled ? withAlpha(c.onInk, 0.6) : c.ink;
  return (
    <View style={style}>
      {hint ? (
        // Canvas pill: the hint sits in the translucent top of a bottom-bar fade, over scrolled content.
        <Text variant="caption" color={c.inkSoft} align="center" style={styles.barHint}>
          {hint}
        </Text>
      ) : null}
      <PressableScale
        onPress={onPress}
        disabled={loading}
        hapticKind={disabled ? disabledHapticKind : hapticKind}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: !!disabled }}
        activeScale={0.98}
        shadow={disabled ? undefined : 'strong'}
        style={[styles.bar, disabled ? null : shadows.cta, white ? styles.barWhite : null]}
      >
        <View style={styles.barLeft}>
          {left ?? (
            <Text style={styles.barLabel} color={fg} numberOfLines={1}>
              {label}
            </Text>
          )}
        </View>
        <View
          style={[
            styles.barCircle,
            white ? styles.barCircleInk : null,
            disabled ? (white ? styles.barCircleInkDisabled : styles.barCircleDisabled) : null,
          ]}
        >
          {loading ? <ActivityIndicator color={glyph} /> : <Icon name={icon} size={22} color={glyph} />}
        </View>
      </PressableScale>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  pillLabel: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  pillSmall: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18 },
  barHint: {
    alignSelf: 'center',
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: c.bg,
    overflow: 'hidden',
  },
  bar: {
    height: layout.ctaHeight,
    borderRadius: radii.pill,
    backgroundColor: c.ink,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 26,
    paddingRight: 6,
  },
  // On night in both schemes.
  barWhite: { backgroundColor: c.white },
  barLeft: { flex: 1, justifyContent: 'center' },
  barLabel: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24 },
  barCircle: {
    width: layout.ctaCircle,
    height: layout.ctaCircle,
    borderRadius: layout.ctaCircle / 2,
    backgroundColor: c.onInk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barCircleInk: { backgroundColor: c.inkFixed },
  barCircleDisabled: { backgroundColor: withAlpha(c.onInk, 0.14) },
  barCircleInkDisabled: { backgroundColor: withAlpha(c.inkFixed, 0.35) },
}));
