/**
 * Pure customization engine (PRD §11): selection rules, validation,
 * snapshots and summaries. No React, no side effects — unit tested.
 */
import type {
  ID,
  ModifierGroup,
  ModifierOption,
  Product,
  SelectedModifierSnapshot,
  Selections,
} from '@/types/models';

/** Effective minimum: required groups need at least one choice. */
export function effectiveMin(group: ModifierGroup): number {
  return group.required ? Math.max(1, group.min) : group.min;
}

/** Effective maximum: single-select is always 1. */
export function effectiveMax(group: ModifierGroup): number {
  return group.selectionType === 'single' ? 1 : Math.max(group.max, effectiveMin(group));
}

export function defaultSelections(groups: ModifierGroup[]): Selections {
  const out: Selections = {};
  for (const g of groups) {
    const defaults = g.options.filter((o) => o.isDefault && o.isAvailable).map((o) => o.id);
    out[g.id] = defaults.slice(0, effectiveMax(g));
  }
  return out;
}

export interface ToggleResult {
  selections: Selections;
  /** True when a multi-select group is already at max and the tap was ignored. */
  limitReached: boolean;
}

export function toggleOption(group: ModifierGroup, selections: Selections, optionId: ID): ToggleResult {
  const option = group.options.find((o) => o.id === optionId);
  if (!option || !option.isAvailable) return { selections, limitReached: false };

  const current = selections[group.id] ?? [];
  const isSelected = current.includes(optionId);

  if (group.selectionType === 'single') {
    // Required single groups can't be cleared by tapping the selected option.
    if (isSelected) {
      if (effectiveMin(group) > 0) return { selections, limitReached: false };
      return { selections: { ...selections, [group.id]: [] }, limitReached: false };
    }
    return { selections: { ...selections, [group.id]: [optionId] }, limitReached: false };
  }

  if (isSelected) {
    return {
      selections: { ...selections, [group.id]: current.filter((id) => id !== optionId) },
      limitReached: false,
    };
  }
  if (current.length >= effectiveMax(group)) {
    return { selections, limitReached: true };
  }
  return { selections: { ...selections, [group.id]: [...current, optionId] }, limitReached: false };
}

export interface GroupError {
  groupId: ID;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: GroupError[];
  /** First invalid group — used to scroll + shake. */
  firstInvalidGroupId?: ID;
}

export function validateSelections(groups: ModifierGroup[], selections: Selections): ValidationResult {
  const errors: GroupError[] = [];
  for (const g of groups) {
    const chosen = (selections[g.id] ?? []).filter((id) => g.options.some((o) => o.id === id && o.isAvailable));
    const min = effectiveMin(g);
    const max = effectiveMax(g);
    if (chosen.length < min) {
      errors.push({
        groupId: g.id,
        message: min === 1 ? `Choose a ${g.name.toLowerCase()}` : `Choose at least ${min} ${g.name.toLowerCase()}`,
      });
    } else if (chosen.length > max) {
      errors.push({ groupId: g.id, message: `Choose up to ${max}` });
    }
  }
  return { valid: errors.length === 0, errors, firstInvalidGroupId: errors[0]?.groupId };
}

/** Badge text for a group header: "*Choose one", "Choose up to 3", "Optional". */
export function groupRuleLabel(group: ModifierGroup): string {
  const min = effectiveMin(group);
  const max = effectiveMax(group);
  if (group.selectionType === 'single') return min > 0 ? 'Choose one' : 'Optional';
  if (min > 0 && min === max) return `Choose ${min}`;
  if (min > 0) return `Choose ${min}–${max}`;
  return max > 1 ? `Optional · up to ${max}` : 'Optional';
}

export function buildSnapshots(groups: ModifierGroup[], selections: Selections): SelectedModifierSnapshot[] {
  const out: SelectedModifierSnapshot[] = [];
  for (const g of groups) {
    const ids = selections[g.id] ?? [];
    // Preserve option display order, not tap order, for stable summaries/keys.
    for (const o of g.options) {
      if (ids.includes(o.id)) {
        out.push({
          groupId: g.id,
          groupName: g.name,
          optionId: o.id,
          optionName: o.name,
          shortName: o.shortName,
          priceDelta: o.priceDelta,
        });
      }
    }
  }
  return out;
}

export function selectionsFromSnapshots(snapshots: SelectedModifierSnapshot[]): Selections {
  const out: Selections = {};
  for (const s of snapshots) {
    (out[s.groupId] ??= []).push(s.optionId);
  }
  return out;
}

/** "Large · Oat milk · Vanilla" */
export function summarizeModifiers(snapshots: SelectedModifierSnapshot[], separator = ' · '): string {
  return snapshots.map((s) => s.optionName).join(separator);
}

export function configKey(productId: ID, snapshots: SelectedModifierSnapshot[], instructions?: string): string {
  const mods = snapshots
    .map((s) => `${s.groupId}:${s.optionId}`)
    .sort()
    .join('|');
  const note = (instructions ?? '').trim().toLowerCase();
  return `${productId}#${mods}#${note}`;
}

export function modifiersDelta(snapshots: SelectedModifierSnapshot[]): number {
  return snapshots.reduce((sum, s) => sum + s.priceDelta, 0);
}

export function estimateKcal(product: Product, groups: ModifierGroup[], selections: Selections): number | undefined {
  if (product.kcal == null) return undefined;
  let kcal = product.kcal;
  for (const g of groups) {
    for (const id of selections[g.id] ?? []) {
      const o: ModifierOption | undefined = g.options.find((x) => x.id === id);
      kcal += o?.kcalDelta ?? 0;
    }
  }
  return Math.max(0, Math.round(kcal));
}

export function isOptionSelected(selections: Selections, groupId: ID, optionId: ID): boolean {
  return (selections[groupId] ?? []).includes(optionId);
}
