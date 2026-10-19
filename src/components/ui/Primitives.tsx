import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { withAlpha } from '@/components/motion/color';
import { fonts, makeStyles, makeThemed, radii, spacing, type as typeScale, useColors } from '@/theme';
import type { PressHapticKind } from '@/lib/haptics';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

// ── Card ─────────────────────────────────────────────────────
/**
 * A plain container. R3.A3/A10: planes separate by colour — no shadow, and white is only for lists,
 * forms and sheets (prefer `Sheet` for a list of rows).
 */
export function Card({
  children,
  style,
  onPress,
  padded = true,
  tone = 'surface',
  hapticKind,
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  padded?: boolean;
  tone?: 'surface' | 'alt' | 'ink' | 'espresso';
  hapticKind?: PressHapticKind | null;
  accessibilityLabel?: string;
}) {
  const c = useColors();
  const styles = useStyles();
  // `ink` inverts in dark (put `onInk` content in it); `espresso` stays dark in both schemes.
  const bg = tone === 'surface' ? c.surface : tone === 'alt' ? c.surfaceAlt : tone === 'ink' ? c.ink : c.espresso;
  const base = [styles.card, { backgroundColor: bg }, padded ? styles.cardPad : null, style];
  if (onPress) {
    return (
      <PressableScale onPress={onPress} style={base} hapticKind={hapticKind} accessibilityLabel={accessibilityLabel}>
        {children}
      </PressableScale>
    );
  }
  return <View style={base}>{children}</View>;
}

// ── Chip (ref 2 outlined pills) ──────────────────────────────
/** 40px pills + 2px slop above and below = the 44px minimum tap target. */
const CHIP_HIT_SLOP = { top: 2, bottom: 2, left: 0, right: 0 };

/**
 * R3.A7 chips (Menu categories, Category filters, Search recent/popular, pickup slots only): text
 * only. `outline`: 1px `line`, selected 1.5px ink + 600 ink. `filled` (slot chips): selected = ink
 * fill. The `icon` prop is kept for older call sites; R3 chips carry no icons.
 */
export function Chip({
  label,
  selected,
  onPress,
  icon,
  style,
  tone = 'outline',
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName | string;
  style?: StyleProp<ViewStyle>;
  tone?: 'outline' | 'filled';
}) {
  const c = useColors();
  const styles = useStyles();
  const filled = tone === 'filled';
  return (
    <PressableScale
      onPress={onPress}
      // A choice chip clicks when the choice changes; a chip that only runs an action (a search
      // term, no `selected`) and a re-tap of the selected chip are silent (docs/HAPTICS.md).
      hapticKind={selected === undefined || selected ? null : 'select'}
      hitSlop={CHIP_HIT_SLOP}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      style={[
        styles.chip,
        filled
          ? { backgroundColor: selected ? c.ink : c.surface, borderColor: selected ? c.ink : c.line }
          : {
              borderColor: selected ? c.ink : c.line,
              borderWidth: selected ? 1.5 : 1,
              // The half pixel of extra border comes out of the padding, so the label never shifts.
              paddingHorizontal: selected ? spacing.md - 0.5 : spacing.md,
            },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={15} color={filled && selected ? c.onInk : selected ? c.ink : c.inkSoft} /> : null}
      <Text
        variant={selected ? 'label' : 'bodyMedium'}
        style={{ fontSize: 14 }}
        color={filled && selected ? c.onInk : selected ? c.ink : c.inkSoft}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

// ── Badge ────────────────────────────────────────────────────
export type BadgeTone = 'ember' | 'sage' | 'roast' | 'ink' | 'cream' | 'outline' | 'danger';
const useBadgeTones = makeThemed((c): Record<BadgeTone, { bg: string; fg: string; border?: string }> => ({
  ember: { bg: c.ember, fg: c.white },
  // Tinted, not solid: white on plain sage is ~2.4:1.
  sage: { bg: withAlpha(c.sage, 0.2), fg: c.sageText },
  roast: { bg: c.roast, fg: c.white },
  ink: { bg: c.ink, fg: c.onInk },
  cream: { bg: c.surfaceAlt, fg: c.ink },
  outline: { bg: 'transparent', fg: c.inkSoft, border: c.line },
  danger: { bg: c.dangerSoft, fg: c.danger },
}));

/** Small status pill. R3.A7: only exceptions get a label — prefer plain 13/500 text ("Cancelled" in danger). */
export function Badge({ label, tone = 'cream', icon, style }: { label: string; tone?: BadgeTone; icon?: IconName | string; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  const t = useBadgeTones()[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg, borderColor: t.border ?? 'transparent', borderWidth: t.border ? 1 : 0 }, style]}>
      {icon ? <Icon name={icon} size={12} color={t.fg} /> : null}
      <Text variant="caption" color={t.fg} style={{ fontFamily: fonts.semibold }}>
        {label}
      </Text>
    </View>
  );
}

// ── Divider / Spacer ─────────────────────────────────────────
export function Divider({ style, inset = 0 }: { style?: StyleProp<ViewStyle>; inset?: number }) {
  const c = useColors();
  return <View style={[{ height: StyleSheet.hairlineWidth * 2, backgroundColor: c.line, marginHorizontal: inset }, style]} />;
}

export function Spacer({ size = spacing.md, horizontal }: { size?: number; horizontal?: boolean }) {
  return <View style={horizontal ? { width: size } : { height: size }} />;
}

// ── SectionHeader ────────────────────────────────────────────
/** `h2` section header with an optional quiet action on the right ("See all", 14/500 `inkSoft`). No subtitle (R3.A6). */
export function SectionHeader({
  title,
  action,
  onAction,
  style,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={[styles.sectionHeader, style]}>
      <Text variant="h2" accessibilityRole="header">
        {title}
      </Text>
      {action ? (
        <PressableScale onPress={onAction} accessibilityLabel={action} hitSlop={10}>
          <Text style={styles.sectionAction} color={c.inkSoft}>
            {action}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

// ── SectionLabel (above a sheet) ─────────────────────────────
/** Section label above a white sheet: Outfit 600 15 `inkSoft`, sentence case, 24 above / 8 below (R3.A10). */
export function SectionLabel({ children, right, style }: { children: string; right?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={[styles.sectionLabel, style]}>
      <Text style={typeScale.sectionLabel} color={c.inkSoft} accessibilityRole="header">
        {children}
      </Text>
      {right}
    </View>
  );
}

// ── Sheet (R3.A10: one list = one white sheet) ────────────────
/**
 * White sheet (r28, no shadow, no border). Children are rows; hairlines are drawn between them,
 * inset to where the row text starts (`dividerInset`, default 16).
 */
export function Sheet({
  children,
  dividerInset = spacing.md,
  dividers = true,
  radius = radii.lg,
  style,
}: {
  children: ReactNode;
  dividerInset?: number;
  /** Draw hairlines between children (default true). */
  dividers?: boolean;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const rows = Children.toArray(children);
  return (
    <View style={[styles.sheet, { borderRadius: radius }, style]}>
      {rows.map((row, i) => (
        <Fragment key={isValidElement(row) && row.key != null ? row.key : i}>
          {dividers && i > 0 ? <Divider style={{ marginLeft: dividerInset, marginRight: spacing.md }} /> : null}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

// ── ListRow (R3.A10 row anatomy) ─────────────────────────────
/**
 * One row of a white sheet: title 16/500 ink, optional right `value` (15 `inkSoft`), chevron 18
 * `inkMuted`. 56px with one line, 68px with a `subtitle`. An `icon` renders inline (20px, no disc —
 * R3 deletes icon discs; use it only where the spec keeps a glyph, e.g. "Use current location").
 */
export function ListRow({
  icon,
  title,
  subtitle,
  value,
  right,
  onPress,
  danger,
  showChevron = true,
  center = false,
  accessibilityLabel,
}: {
  icon?: IconName | string;
  title: string;
  subtitle?: string;
  /** Right-aligned value ("610 pts", "Orders on"). */
  value?: string;
  right?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
  showChevron?: boolean;
  /** Centred title and no chevron (the "Log out" row). */
  center?: boolean;
  accessibilityLabel?: string;
}) {
  const c = useColors();
  const styles = useStyles();
  const content = (
    <>
      {icon ? <Icon name={icon} size={20} color={danger ? c.danger : c.ink} /> : null}
      <View style={styles.rowBody}>
        <Text
          style={[styles.rowTitle, center ? styles.rowTitleCenter : null]}
          color={danger ? c.danger : c.ink}
          align={center ? 'center' : undefined}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color={c.inkSoft} numberOfLines={1} style={styles.rowSubtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text style={styles.rowValue} color={c.inkSoft} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {right}
      {onPress && showChevron && !center ? <Icon name="chevron-forward" size={18} color={c.inkMuted} /> : null}
    </>
  );
  const rowStyle = [styles.row, subtitle ? styles.rowTall : null];
  if (onPress) {
    return (
      <PressableScale
        onPress={onPress}
        style={rowStyle}
        activeScale={0.985}
        accessibilityLabel={accessibilityLabel ?? (value ? `${title}, ${value}` : title)}
      >
        {content}
      </PressableScale>
    );
  }
  return <View style={rowStyle}>{content}</View>;
}

// ── NotchBite (concave notch cut into a container's top edge) ──
/**
 * A smooth concave dip for the top edge of a card (R3.A2: only the product sheet, the cart list
 * sheet and the cart's peach card). Drawn as a `width × depth` shape in the colour BEHIND the card,
 * absolutely positioned at its top — set `left` through `style` to centre it.
 */
export function NotchBite({ width, depth, color, style }: { width: number; depth: number; color: string; style?: StyleProp<ViewStyle> }) {
  const w = width;
  const d = depth;
  // The dip only: everything above the curve is filled with the colour behind the card.
  const styles = useStyles();
  const path = `M0 0 C${w * 0.2} 0 ${w * 0.26} ${d} ${w / 2} ${d} C${w * 0.74} ${d} ${w * 0.8} 0 ${w} 0 Z`;
  return (
    <View style={[styles.notch, { width: w, height: d }, style]}>
      <Svg width={w} height={d}>
        <Path d={path} fill={color} />
      </Svg>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: { borderRadius: radii.lg },
  cardPad: { padding: spacing.md },
  chip: {
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'transparent',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionAction: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 18 },
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.xxs,
  },
  sheet: { backgroundColor: c.surface, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 56,
  },
  rowTall: { minHeight: 68 },
  rowBody: { flex: 1, minWidth: 0, paddingVertical: 10 },
  rowTitle: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 22 },
  rowTitleCenter: { fontFamily: fonts.semibold },
  rowSubtitle: { marginTop: 1 },
  rowValue: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 20, maxWidth: '45%' },
  notch: { position: 'absolute', top: 0, pointerEvents: 'none' },
}));
