/**
 * Ordering-context editors shared by the mode sheet and checkout: pickup slot chips (40h, selected
 * = ink fill, text only — R3.A7), table chips and the in-car make/colour/plate fields.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { withAlpha } from '@/components/motion/color';
import { Chip, Text, TextField } from '@/components/ui';
import { pickupSlots } from '@/lib/format';
import { storeStatus } from '@/lib/storeHours';
import { brand } from '@/theme/brand';
import { fonts, spacing, useColors, useTheme } from '@/theme';
import type { CarDetails } from '@/types/models';
import { effectiveSlot } from './modeText';

/** R3.A10 section-label tone (600 15 `inkSoft`) with an optional "Required" tag on the right. */
export function FieldLabel({ children, required, missing }: { children: string; required?: boolean; missing?: boolean }) {
  const c = useColors();
  return (
    <View style={styles.labelRow}>
      <Text style={styles.label} color={c.inkSoft} accessibilityRole="header">
        {children}
      </Text>
      {required ? (
        <Text style={styles.tag} color={missing ? c.ember : c.inkMuted}>
          {missing ? '*Required' : 'Required'}
        </Text>
      ) : null}
    </View>
  );
}

// ── Pickup time slots ─────────────────────────────────────────

export interface SlotChipsProps {
  value: string | undefined;
  onChange: (slotId: string) => void;
  /** Quoted ASAP time ("ASAP · ~6 min"), from `quotedEtaMinutes` so it matches the order's ETA. */
  etaMinutes: number;
  /** Bleed the scroller to the screen edges (pass the horizontal padding of the parent). */
  bleed?: number;
  /** Background behind the row: a 24px right-edge fade into it says the row scrolls. Omit for none. */
  fadeColor?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * "ASAP · ~8 min" then 10-minute slots on a fixed grid. A stale or off-grid saved slot shows (and is
 * placed) as ASAP. While the store is closed there's no ASAP: the slots start at the next opening
 * ("Tomorrow, 7:10 AM") under a short note.
 */
export function SlotChips({ value, onChange, etaMinutes, bleed = 0, fadeColor, style }: SlotChipsProps) {
  const slots = pickupSlots();
  const effective = effectiveSlot(value);
  const selected = slots.some((s) => s.id === effective) ? effective : slots[0]?.id;
  const status = storeStatus();
  return (
    <View style={style}>
      {status.open ? null : <InfoNote text={`${status.label}. Schedule it for when we open.`} style={styles.closed} />}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -bleed }}
        contentContainerStyle={[styles.slots, { paddingHorizontal: bleed }]}
        accessibilityRole="radiogroup"
        accessibilityLabel="Pickup time"
      >
        {slots.map((slot) => (
          <Chip
            key={slot.id}
            tone="filled"
            label={slot.id === 'asap' ? `ASAP · ~${etaMinutes} min` : slot.label}
            selected={slot.id === selected}
            onPress={() => onChange(slot.id)}
          />
        ))}
      </ScrollView>
      {fadeColor ? <EdgeFade color={fadeColor} bleed={bleed} /> : null}
    </View>
  );
}

/** 24px fade at the right screen edge over a bleeding chip row (the row reads as scrollable). */
function EdgeFade({ color, bleed }: { color: string; bleed: number }) {
  return (
    <View style={[styles.edgeFade, { right: -bleed }]}>
      <LinearGradient colors={[withAlpha(color, 0), color]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
    </View>
  );
}

// ── Dine-in tables ────────────────────────────────────────────

/** One scrolling row of table / area chips (like the slots), bleeding to the edges like them. */
export function TableChips({
  value,
  onChange,
  bleed = 0,
  fadeColor,
  style,
}: {
  value: string | undefined;
  onChange: (table: string) => void;
  bleed?: number;
  /** Background behind the row, for the right-edge fade (see `SlotChips`). */
  fadeColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={style}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -bleed }}
        contentContainerStyle={[styles.slots, { paddingHorizontal: bleed }]}
        accessibilityRole="radiogroup"
        accessibilityLabel="Table or area"
      >
        {brand.store.tables.map((t) => (
          <Chip key={t} tone="filled" label={t} selected={t === value} onPress={() => onChange(t)} />
        ))}
      </ScrollView>
      {fadeColor ? <EdgeFade color={fadeColor} bleed={bleed} /> : null}
    </View>
  );
}

// ── In-car details ────────────────────────────────────────────

export const EMPTY_CAR: CarDetails = { make: '', color: '', plate: '' };

export interface CarFieldsProps {
  value: CarDetails;
  onChange: (car: CarDetails) => void;
  /** Highlight empty fields (after a failed checkout attempt). */
  showErrors?: boolean;
}

export function CarFields({ value, onChange, showErrors = false }: CarFieldsProps) {
  const { keyboardAppearance } = useTheme();
  const missing = (v: string) => (showErrors && !v.trim() ? 'Required' : undefined);
  return (
    <View style={styles.car}>
      <View style={styles.carRow}>
        <TextField
          label="Make & model"
          placeholder="Hyundai Creta"
          value={value.make}
          onChangeText={(make) => onChange({ ...value, make })}
          autoCapitalize="words"
          error={missing(value.make)}
          containerStyle={styles.carHalf}
          enterKeyHint="next"
          keyboardAppearance={keyboardAppearance}
        />
        <TextField
          label="Colour"
          placeholder="Black"
          value={value.color}
          onChangeText={(color) => onChange({ ...value, color })}
          autoCapitalize="words"
          error={missing(value.color)}
          containerStyle={styles.carHalf}
          enterKeyHint="next"
          keyboardAppearance={keyboardAppearance}
        />
      </View>
      <TextField
        label="Licence plate"
        placeholder="KA 03 MN 4521"
        value={value.plate}
        onChangeText={(plate) => onChange({ ...value, plate: plate.toUpperCase() })}
        autoCapitalize="characters"
        autoCorrect={false}
        error={missing(value.plate)}
        enterKeyHint="done"
        keyboardAppearance={keyboardAppearance}
      />
    </View>
  );
}

/** One quiet caption line (fee notes, warnings). R3.A8: no info icon, no box. */
export function InfoNote({ text, tone = 'default', style }: { icon?: string; text: string; tone?: 'default' | 'warn'; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <Animated.View style={[styles.note, style]}>
      <Text variant="caption" color={tone === 'warn' ? c.danger : c.inkSoft} style={styles.noteText}>
        {text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  label: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
  tag: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  slots: { gap: spacing.xs, paddingVertical: 2 },
  edgeFade: { position: 'absolute', bottom: 0, height: 44, width: 24, pointerEvents: 'none' },
  closed: { marginBottom: spacing.sm },
  car: { gap: spacing.sm },
  carRow: { flexDirection: 'row', gap: spacing.sm },
  carHalf: { flex: 1, minWidth: 0 },
  note: { flexDirection: 'row', alignItems: 'center' },
  noteText: { flex: 1 },
});
