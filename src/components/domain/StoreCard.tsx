import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon, PillButton, PressableScale, Text } from '@/components/ui';
import { openInMaps } from '@/lib/maps';
import { storeStatus } from '@/lib/storeHours';
import { brand } from '@/theme/brand';
import { fonts, makeStyles, makeThemed, radii, spacing, useColors } from '@/theme';

/** R3.A10 store-card gradient at 100°: #FBF4EA → #F1E2CE (light), warm espresso in dark (R4). */
const useGradient = makeThemed((c) => [c.storeFrom, c.storeTo] as const);
const GRADIENT_START = { x: 0.01, y: 0.41 };
const GRADIENT_END = { x: 0.99, y: 0.59 };

/** "Open · until 9pm", "Closed · opens 7am" or "Open late (demo)" (live from the store hours). */
export function storeStatusLabel(): string {
  return storeStatus().label;
}

/** R3 copy: "Open until 9pm" / "Closed, opens 7am" (no middle dot inside the status itself). */
function shortStatus(label: string): string {
  return label.replace('Open · ', 'Open ').replace('Closed · ', 'Closed, ');
}

/** Status dot + label, no chip container (R3). Sage-deep while open, muted when closed. */
export function StoreStatusChip({ style }: { tone?: 'surface' | 'clear'; style?: StyleProp<ViewStyle> }) {
  const status = storeStatus();
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={[styles.status, style]} accessible accessibilityLabel={`Store ${status.label.replace(' · ', ', ')}`}>
      <View style={[styles.statusDot, status.open ? null : styles.statusDotClosed]} />
      <Text style={styles.statusText} color={status.open ? c.sageText : c.inkSoft}>
        {shortStatus(status.label)}
      </Text>
    </View>
  );
}

/** The store in the phone's own maps app (Apple Maps / geo: intent), Google Maps on the web. */
const openStoreInMaps = () => openInMaps({ lat: brand.store.lat, lng: brand.store.lng, label: brand.store.name });

export interface StoreCardProps {
  /** Override the default (opens the store in Apple Maps / the Android maps app; Google Maps on web). */
  onViewMap?: () => void;
  /**
   * Menu store row (60h gradient pill-card, r30): name over "0.8 km · Open until 9pm" and an ink
   * "Pickup ⌄" pill that opens the ordering-mode sheet.
   */
  compact?: boolean;
  /** Compact only: the current mode's label on the pill (e.g. "Pickup"). */
  modeLabel?: string;
  /** Compact only: tap on the pill / row (default: push /mode). */
  onModePress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * R3 store card (ref 2): the store gradient, no photo, no eyebrow, no doodle, no chip containers.
 * Full (Order type sheet): name 20/700, "0.8 km · 12th Main Rd, HAL 2nd Stage…", "● Open until 9pm" and an ink
 * "View on Maps" pill. Compact: the Menu row.
 */
export function StoreCard({ onViewMap, compact = false, modeLabel, onModePress, style }: StoreCardProps) {
  const street = brand.store.address.split(',')[0];
  const distance = `${brand.store.distanceKm.toFixed(1)} km`;
  const viewMap = onViewMap ?? (() => void openStoreInMaps());
  const status = storeStatus();
  const c = useColors();
  const styles = useStyles();
  const GRADIENT = useGradient();

  if (compact) {
    const openMode = onModePress ?? (() => router.push('/mode'));
    return (
      <PressableScale
        onPress={openMode}
        activeScale={0.98}
        style={[styles.row, style]}
        accessibilityLabel={`${brand.store.shortName}, ${distance}, ${status.label}${modeLabel ? `. ${modeLabel}, change` : ''}`}
      >
        <LinearGradient colors={GRADIENT} start={GRADIENT_START} end={GRADIENT_END} style={[StyleSheet.absoluteFill, styles.rowFill]} />
        <View style={styles.rowCopy}>
          <Text style={styles.rowName} numberOfLines={1}>
            {brand.store.shortName}
          </Text>
          <Text style={styles.rowMeta} color={c.inkSoft} numberOfLines={1}>
            {`${distance} · ${shortStatus(status.label)}`}
          </Text>
        </View>
        {modeLabel ? (
          <View style={styles.modePill}>
            <Text style={styles.modeText} color={c.onInk}>
              {modeLabel}
            </Text>
            <Icon name="chevron-down" size={16} color={c.onInk} />
          </View>
        ) : null}
      </PressableScale>
    );
  }

  return (
    <View style={[styles.card, style]}>
      <LinearGradient colors={GRADIENT} start={GRADIENT_START} end={GRADIENT_END} style={StyleSheet.absoluteFill} />
      <Text style={styles.name} numberOfLines={1}>
        {brand.store.shortName}
      </Text>
      <Text variant="caption" color={c.inkSoft} numberOfLines={1} style={styles.address}>
        {`${distance} · ${street}`}
      </Text>
      <StoreStatusChip style={styles.statusLine} />
      <PillButton
        label="View on Maps"
        tone="ink"
        size="sm"
        onPress={viewMap}
        accessibilityLabel={`View ${brand.store.shortName} on Maps`}
        style={styles.cta}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: { borderRadius: radii.lg, padding: spacing.lg, overflow: 'hidden', backgroundColor: c.storeFrom },
  name: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, color: c.ink },
  address: { marginTop: 2 },
  statusLine: { marginTop: 6 },
  cta: { marginTop: spacing.md, height: 40 },
  row: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.lg,
    paddingRight: 8,
    borderRadius: radii.banner,
    backgroundColor: c.storeFrom,
  },
  rowFill: { borderRadius: radii.banner },
  rowCopy: { flex: 1, minWidth: 0 },
  rowName: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: c.ink },
  rowMeta: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
  modePill: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: spacing.md,
    paddingRight: 14,
    borderRadius: radii.pill,
    backgroundColor: c.ink,
  },
  modeText: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 17 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  statusDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: c.sageText },
  statusDotClosed: { backgroundColor: c.inkMuted },
  statusText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
}));
