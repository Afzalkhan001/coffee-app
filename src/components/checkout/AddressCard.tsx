import { ActivityIndicator, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cubicBezier } from 'react-native-reanimated';
import { Icon, PressableScale, Text } from '@/components/ui';
import { addressCityLine, formatAddress, receiverLine } from '@/lib/address';
import { distanceFromStoreKm, formatKm, isDeliverable } from '@/lib/geo';
import { fonts, makeStyles, radii, spacing, useColors } from '@/theme';
import type { Address } from '@/types/models';

const easeOut = cubicBezier(0.22, 1, 0.36, 1);
const RADIO = 22;
/** Where an address row's text starts inside its sheet (16 + radio + 12): the hairline inset. */
export const ADDRESS_TEXT_INSET = spacing.md + RADIO + spacing.sm;

export interface AddressRowProps {
  address: Address;
  selected: boolean;
  checking?: boolean;
  /** Inline failure (e.g. offline while checking). */
  error?: string;
  onPress: () => void;
  /** A trailing text action instead of the radio (e.g. "Change" in the Order type sheet). */
  actionLabel?: string;
  /** A trailing edit button (the pencil glyph, no disc) that opens the address in the form. */
  onEdit?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * One saved address as a row of a white sheet (R3 delivery address): a radio on the left, the label
 * (16/600, plus "For Priya" when someone else receives it), line 1 (15, `formatAddress(a, 'short')`)
 * and "Domlur, Bengaluru 560071 · 1.2 km" (13 `inkSoft`). An address we can't deliver to says "Out of
 * range" (13/500 danger) instead and dims to 50%. An optional pencil on the right edits it. No icon
 * discs, no chips.
 */
export function AddressRow({ address, selected, checking = false, error, onPress, actionLabel, onEdit, style }: AddressRowProps) {
  const c = useColors();
  const styles = useStyles();
  const km = distanceFromStoreKm(address);
  const ok = isDeliverable(address);
  const line1 = formatAddress(address, 'short');
  const caption = [addressCityLine(address), formatKm(km)].filter(Boolean).join(' · ');
  const receiver = address.contactName ? `For ${address.contactName}` : undefined;
  return (
    <View style={[styles.wrap, style]}>
      <PressableScale
        onPress={onPress}
        disabled={checking}
        activeScale={0.985}
        // Silent on tap: as a radio the screen clicks `select` once the deliverability check moves the
        // selection; with an `actionLabel` ("Change") it only navigates.
        accessibilityRole={actionLabel ? 'button' : 'radio'}
        accessibilityState={{ selected, busy: checking }}
        accessibilityLabel={`${address.label}, ${line1}, ${formatKm(km)} away, ${ok ? 'we deliver here' : 'out of delivery range'}${
          receiverLine(address) ? `, ${receiverLine(address)}` : ''
        }${actionLabel ? `. ${actionLabel}` : ''}`}
        style={styles.row}
      >
        {actionLabel ? null : (
          <View style={styles.radioSlot}>
            {checking ? (
              <ActivityIndicator size="small" color={c.ink} />
            ) : (
              <Animated.View
                style={[
                  styles.radio,
                  {
                    borderColor: selected ? c.ink : c.line,
                    backgroundColor: selected ? c.ink : c.surface,
                    transitionProperty: ['borderColor', 'backgroundColor'],
                    transitionDuration: 180,
                    transitionTimingFunction: easeOut,
                  },
                ]}
              >
                {selected ? <View style={styles.dot} /> : null}
              </Animated.View>
            )}
          </View>
        )}
        <View style={styles.copy}>
          <View style={[styles.labelLine, ok ? null : styles.dim]}>
            <Text style={styles.label} numberOfLines={1}>
              {address.label}
            </Text>
            {receiver ? (
              <Text style={styles.receiver} color={c.inkSoft} numberOfLines={1}>
                {receiver}
              </Text>
            ) : null}
          </View>
          <Text style={[styles.line1, ok ? null : styles.dim]} numberOfLines={1}>
            {line1}
          </Text>
          {error ? (
            <Text variant="caption" color={c.danger} numberOfLines={2}>
              {error}
            </Text>
          ) : ok ? (
            <Text variant="caption" color={c.inkSoft} numberOfLines={1}>
              {caption}
            </Text>
          ) : (
            <Text style={styles.out} color={c.danger}>
              Out of range
            </Text>
          )}
        </View>
        {actionLabel ? (
          <Text style={styles.action} color={c.ink}>
            {actionLabel}
          </Text>
        ) : null}
      </PressableScale>
      {onEdit && !actionLabel ? (
        <PressableScale
          onPress={onEdit}
          disabled={checking}
          activeScale={0.9}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${address.label}`}
          style={styles.edit}
        >
          <Icon name="edit" size={18} color={c.inkSoft} />
        </PressableScale>
      ) : null}
    </View>
  );
}

/** Kept for the Order type sheet: the selected address as a one-row sheet with "Change". */
export function AddressCard(props: AddressRowProps) {
  const styles = useStyles();
  return (
    <View style={styles.sheet}>
      <AddressRow {...props} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  sheet: { backgroundColor: c.surface, borderRadius: radii.lg, paddingHorizontal: spacing.md },
  wrap: { flexDirection: 'row', alignItems: 'center' },
  row: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 14, minHeight: 84 },
  radioSlot: { width: RADIO, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', marginTop: 2 },
  radio: { width: RADIO, height: RADIO, borderRadius: RADIO / 2, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.onInk },
  copy: { flex: 1, minWidth: 0, gap: 1 },
  dim: { opacity: 0.5 },
  labelLine: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  label: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  receiver: { flexShrink: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  line1: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 20 },
  out: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  action: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, textDecorationLine: 'underline' },
  // 44px target; the glyph sits on the label line's optical centre, flush with the sheet's padding.
  edit: { width: 44, height: 44, marginRight: -spacing.sm, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', marginTop: 6 },
}));
