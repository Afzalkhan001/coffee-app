/**
 * One modifier group on the product sheet (R3.B product detail, ref 2 options list):
 *  - `size_circles` → the centred S / M / L circles with their one caption (first viewport).
 *  - a required group with no default (Temperature, Bread) → always open: a 56px header row
 *    ("Temperature" + "*Choose one", or the chosen value) over half-width option tiles.
 *  - any other group (defaulted or optional: Milk, Syrup, Extras) → a collapsed 56px row,
 *    "Milk · Whole milk ⌄", that opens its radio / checkbox rows (one group open at a time). The
 *    chevron turns 180° with `smooth`; the rows fade in while the rows below glide (`layoutSpring`).
 * Exposes a handle so the screen can scroll it into view and shake it on the UI thread
 * (required-group-missing and multi-max feedback, DESIGN.md §7).
 */
import { useEffect, useImperativeHandle, useState, type Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type AnimatedRef,
  type SharedValue,
} from 'react-native-reanimated';
import { useFlash } from '@/components/domain';
import { Icon, PressableScale, Text } from '@/components/ui';
import { effectiveMin, groupRuleLabel } from '@/lib/modifiers';
import { fonts, spacing, springs, useColors } from '@/theme';
import type { ID, ModifierGroup } from '@/types/models';
import { fieldsIn, fieldsOut } from '@/components/checkout/motion';
import { GroupTag, type GroupTagTone } from './GroupTag';
import { OptionRow, OptionTile } from './OptionRow';
import { SizeSelector } from './SizeSelector';

export interface ModifierGroupHandle {
  /** Measured on the UI thread to scroll the group into view. */
  node: AnimatedRef<Animated.View>;
  /** Horizontal shake offset (drive with `shakeValue`). */
  offset: SharedValue<number>;
  /** Flash the "*Choose one" tag ember (and keep it ember until met); opens a collapsed group. */
  highlight: () => void;
}

/** Required and nothing chosen for you: the group stays open (ref 2's always-visible options). */
export function isAlwaysOpen(group: ModifierGroup): boolean {
  return group.display !== 'size_circles' && effectiveMin(group) > 0 && !group.options.some((o) => o.isDefault && o.isAvailable);
}

/** The chosen options' names ("Oat milk", "Vanilla, Caramel"), or undefined. */
function chosenLabel(group: ModifierGroup, selected: ID[]): string | undefined {
  const names = group.options.filter((o) => selected.includes(o.id)).map((o) => o.name);
  return names.length > 0 ? names.join(', ') : undefined;
}

export interface ModifierGroupSectionProps {
  group: ModifierGroup;
  selected: ID[];
  onToggle: (group: ModifierGroup, optionId: ID) => void;
  /** Collapsible groups only: open state (the screen keeps one open at a time). */
  open?: boolean;
  onOpenChange?: (groupId: ID, open: boolean) => void;
  /** Sold-out product: shown for reference only — dimmed, not pressable, no ember "required" tag. */
  disabled?: boolean;
  ref?: Ref<ModifierGroupHandle>;
}

export function ModifierGroupSection({
  group,
  selected,
  onToggle,
  open = false,
  onOpenChange,
  disabled = false,
  ref,
}: ModifierGroupSectionProps) {
  const node = useAnimatedRef<Animated.View>();
  const offset = useSharedValue(0);
  const [alert, flashAlert] = useFlash(1600);
  const [attempted, setAttempted] = useState(false);
  const alwaysOpen = isAlwaysOpen(group);

  const highlight = () => {
    setAttempted(true);
    flashAlert();
    if (!alwaysOpen && group.display !== 'size_circles' && !open) onOpenChange?.(group.id, true);
  };
  useImperativeHandle(ref, () => ({ node, offset, highlight }));

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));

  if (group.display === 'size_circles') {
    return (
      <Animated.View ref={node} collapsable={false} style={shakeStyle}>
        <SizeSelector
          group={group}
          selectedId={selected[0] ?? null}
          onSelect={(optionId) => onToggle(group, optionId)}
          alert={attempted}
          disabled={disabled}
        />
      </Animated.View>
    );
  }

  const chosen = selected.filter((id) => group.options.some((o) => o.id === id && o.isAvailable)).length;
  const min = effectiveMin(group);
  const value = chosenLabel(group, selected);
  const kind = group.selectionType === 'single' ? 'radio' : 'checkbox';

  if (alwaysOpen) {
    const tone: GroupTagTone = disabled ? 'muted' : chosen >= min ? 'met' : 'required';
    return (
      <Animated.View ref={node} collapsable={false} style={[styles.group, shakeStyle]}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
            {group.name}
          </Text>
          <GroupTag label={tone === 'met' && value ? value : groupRuleLabel(group)} tone={tone} alert={alert} attempted={attempted} />
        </View>
        <View style={[styles.tiles, disabled ? styles.locked : null]} accessibilityRole="radiogroup" accessibilityLabel={group.name}>
          {group.options.map((option) => (
            <View key={option.id} style={styles.tileCell}>
              <OptionTile option={option} selected={selected.includes(option.id)} onPress={() => onToggle(group, option.id)} />
            </View>
          ))}
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View ref={node} collapsable={false} style={[styles.group, shakeStyle]}>
      <CollapsedHeader
        title={group.name}
        value={value}
        open={open}
        onPress={() => onOpenChange?.(group.id, !open)}
      />
      {open ? (
        <Animated.View entering={fieldsIn} exiting={fieldsOut} style={[styles.rows, disabled ? styles.locked : null]}>
          {group.options.map((option, i) => (
            <OptionRow
              key={option.id}
              option={option}
              kind={kind}
              selected={selected.includes(option.id)}
              onPress={() => onToggle(group, option.id)}
              last={i === group.options.length - 1}
            />
          ))}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

/** "Milk          Whole milk ⌄" — the chevron turns as the group opens. */
function CollapsedHeader({ title, value, open, onPress }: { title: string; value?: string; open: boolean; onPress: () => void }) {
  const c = useColors();
  const turn = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    turn.set(withSpring(open ? 1 : 0, springs.smooth));
  }, [open, turn]);
  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get() * 180}deg` }] }));
  return (
    <PressableScale
      onPress={onPress}
      activeScale={0.985}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`${title}, ${value ?? 'optional'}`}
      style={styles.header}
    >
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.valueRow}>
        <Text style={styles.value} color={value ? c.inkSoft : c.inkMuted} numberOfLines={1}>
          {value ?? 'Optional'}
        </Text>
        <Animated.View style={chevronStyle}>
          <Icon name="chevron-down" size={18} color={c.inkMuted} />
        </Animated.View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  group: {},
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, minHeight: 56 },
  title: { flexShrink: 0, fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  valueRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  value: { flexShrink: 1, fontFamily: fonts.regular, fontSize: 15, lineHeight: 20, textAlign: 'right' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: spacing.md },
  tileCell: { flexBasis: '45%', flexGrow: 1 },
  rows: { marginTop: -4, paddingBottom: spacing.xs },
  locked: { opacity: 0.45, pointerEvents: 'none' },
});
