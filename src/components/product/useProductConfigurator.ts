/**
 * Customization state for product detail: selections, quantity and instructions, plus
 * everything derived from them (validation, live price, kcal, the cart line). Pure rules live
 * in `@/lib/modifiers` + `@/lib/pricing`; this hook only owns the React state.
 */
import { useState } from 'react';
import {
  buildSnapshots,
  defaultSelections,
  effectiveMax,
  estimateKcal,
  selectionsFromSnapshots,
  toggleOption,
  validateSelections,
  type ValidationResult,
} from '@/lib/modifiers';
import { roundMoney, unitPrice } from '@/lib/pricing';
import { MAX_LINE_QTY, type NewCartLine } from '@/store/cart';
import type { CartItem, ID, ModifierGroup, ProductWithModifiers, Selections } from '@/types/models';

export const INSTRUCTIONS_MAX = 140;

export type ToggleOutcome = 'changed' | 'unchanged' | 'limit';

/** Defaults for a new item; the saved choices (still-available options only) when editing a line. */
export function initialSelections(groups: ModifierGroup[], line?: CartItem): Selections {
  if (!line) return defaultSelections(groups);
  const saved = selectionsFromSnapshots(line.modifiers);
  const out: Selections = {};
  for (const g of groups) {
    const ids = (saved[g.id] ?? []).filter((id) => g.options.some((o) => o.id === id && o.isAvailable));
    out[g.id] = ids.slice(0, effectiveMax(g));
  }
  return out;
}

export interface ProductConfigurator {
  groups: ModifierGroup[];
  selections: Selections;
  quantity: number;
  setQuantity: (n: number) => void;
  instructions: string;
  setInstructions: (text: string) => void;
  validation: ValidationResult;
  /** "Choose a size to continue" while a required group is unmet (screen readers). */
  hint?: string;
  /** The first unmet requirement as a next step: "Choose a size". */
  missing?: string;
  /** Number of groups whose rule is still unmet. */
  remaining: number;
  unit: number;
  total: number;
  /** Struck-through total when the product is on sale. */
  compareAtTotal?: number;
  kcal?: number;
  toggle: (group: ModifierGroup, optionId: ID) => ToggleOutcome;
  /** The cart line for the current configuration, or null while invalid / sold out. */
  buildLine: () => NewCartLine | null;
}

export function useProductConfigurator(product: ProductWithModifiers, editLine?: CartItem): ProductConfigurator {
  const groups = product.modifierGroups;
  const [selections, setSelections] = useState<Selections>(() => initialSelections(groups, editLine));
  const [quantity, setQuantityState] = useState(() => editLine?.quantity ?? 1);
  const [instructions, setInstructionsState] = useState(() => editLine?.instructions ?? '');

  const validation = validateSelections(groups, selections);
  const firstError = validation.errors[0];
  const snapshots = buildSnapshots(groups, selections);
  const unit = unitPrice(product.price, snapshots);
  const total = roundMoney(unit * quantity);
  const compareAtTotal =
    product.compareAtPrice != null && product.compareAtPrice > product.price
      ? roundMoney(unitPrice(product.compareAtPrice, snapshots) * quantity)
      : undefined;

  const toggle = (group: ModifierGroup, optionId: ID): ToggleOutcome => {
    const result = toggleOption(group, selections, optionId);
    if (result.limitReached) return 'limit';
    if (result.selections === selections) return 'unchanged';
    setSelections(result.selections);
    return 'changed';
  };

  const setQuantity = (n: number) => setQuantityState(Math.min(MAX_LINE_QTY, Math.max(1, Math.round(n))));
  const setInstructions = (text: string) => setInstructionsState(text.slice(0, INSTRUCTIONS_MAX));

  const buildLine = (): NewCartLine | null => {
    if (!product.isAvailable || !validation.valid) return null;
    return {
      productId: product.id,
      name: product.name,
      image: product.image,
      basePrice: product.price,
      quantity,
      modifiers: snapshots,
      instructions: instructions.trim() || undefined,
    };
  };

  return {
    groups,
    selections,
    quantity,
    setQuantity,
    instructions,
    setInstructions,
    validation,
    hint: firstError ? `${firstError.message} to continue` : undefined,
    missing: firstError?.message,
    remaining: validation.errors.length,
    unit,
    total,
    compareAtTotal,
    kcal: estimateKcal(product, groups, selections),
    toggle,
    buildLine,
  };
}
