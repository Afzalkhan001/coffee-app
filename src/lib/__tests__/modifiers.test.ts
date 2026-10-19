import { MODIFIER_GROUPS } from '@/data/mock/modifiers';
import {
  buildSnapshots,
  configKey,
  defaultSelections,
  groupRuleLabel,
  selectionsFromSnapshots,
  summarizeModifiers,
  toggleOption,
  validateSelections,
} from '@/lib/modifiers';
import type { ModifierGroup } from '@/types/models';

const g = (id: string) => MODIFIER_GROUPS.find((x) => x.id === id)!;
const size = g('size');
const milk = g('milk');
const syrup = g('syrup');
const serve = g('serve');

describe('defaultSelections', () => {
  it('preselects only available defaults', () => {
    const sel = defaultSelections([size, milk, syrup]);
    expect(sel.size).toEqual([]); // size must be chosen explicitly
    expect(sel.milk).toEqual(['milk-whole']);
    expect(sel.syrup).toEqual([]);
  });
});

describe('toggleOption', () => {
  it('single-select replaces the choice', () => {
    let sel = defaultSelections([size]);
    sel = toggleOption(size, sel, 'size-s').selections;
    sel = toggleOption(size, sel, 'size-l').selections;
    expect(sel.size).toEqual(['size-l']);
  });

  it('required single-select cannot be cleared by re-tapping', () => {
    const sel = toggleOption(size, { size: [] }, 'size-m').selections;
    expect(toggleOption(size, sel, 'size-m').selections.size).toEqual(['size-m']);
  });

  it('optional single-select can be cleared', () => {
    const sel = toggleOption(serve, { serve: [] }, 'serve-warm').selections;
    expect(toggleOption(serve, sel, 'serve-warm').selections.serve).toEqual([]);
  });

  it('multi-select respects max and reports limit', () => {
    let sel = { syrup: [] as string[] };
    sel = toggleOption(syrup, sel, 'syrup-vanilla').selections as typeof sel;
    sel = toggleOption(syrup, sel, 'syrup-caramel').selections as typeof sel;
    const res = toggleOption(syrup, sel, 'syrup-hazelnut');
    expect(res.limitReached).toBe(true);
    expect(res.selections.syrup).toEqual(['syrup-vanilla', 'syrup-caramel']);
    // deselect then add works
    const after = toggleOption(syrup, toggleOption(syrup, sel, 'syrup-vanilla').selections, 'syrup-hazelnut');
    expect(after.selections.syrup).toEqual(['syrup-caramel', 'syrup-hazelnut']);
  });

  it('ignores unavailable options', () => {
    const res = toggleOption(milk, { milk: ['milk-whole'] }, 'milk-coconut');
    expect(res.selections.milk).toEqual(['milk-whole']);
  });
});

describe('validateSelections', () => {
  it('flags missing required groups, first invalid in order', () => {
    const res = validateSelections([size, milk, syrup], { size: [], milk: ['milk-oat'], syrup: [] });
    expect(res.valid).toBe(false);
    expect(res.firstInvalidGroupId).toBe('size');
    expect(res.errors).toHaveLength(1);
  });

  it('passes when required groups are satisfied and optional ones empty', () => {
    expect(validateSelections([size, milk, syrup], { size: ['size-m'], milk: ['milk-oat'] }).valid).toBe(true);
  });

  it('enforces min on multi-select groups', () => {
    const atLeastTwo: ModifierGroup = { ...syrup, id: 'two', required: true, min: 2, max: 3 };
    expect(validateSelections([atLeastTwo], { two: ['syrup-vanilla'] }).valid).toBe(false);
    expect(validateSelections([atLeastTwo], { two: ['syrup-vanilla', 'syrup-caramel'] }).valid).toBe(true);
  });

  it('enforces max', () => {
    expect(validateSelections([syrup], { syrup: ['syrup-vanilla', 'syrup-caramel', 'syrup-hazelnut'] }).valid).toBe(false);
  });
});

describe('snapshots, summaries and keys', () => {
  const groups = [size, milk, syrup];
  const sel = { size: ['size-l'], milk: ['milk-oat'], syrup: ['syrup-caramel', 'syrup-vanilla'] };

  it('snapshots follow group then option display order', () => {
    const snaps = buildSnapshots(groups, sel);
    expect(snaps.map((s) => s.optionId)).toEqual(['size-l', 'milk-oat', 'syrup-vanilla', 'syrup-caramel']);
    expect(summarizeModifiers(snaps)).toBe('Large · Oat milk · Vanilla · Caramel');
  });

  it('round-trips snapshots back to selections', () => {
    const snaps = buildSnapshots(groups, sel);
    const back = selectionsFromSnapshots(snaps);
    expect(back.size).toEqual(['size-l']);
    expect(back.syrup?.sort()).toEqual(['syrup-caramel', 'syrup-vanilla']);
  });

  it('configKey is order-insensitive and includes instructions', () => {
    const a = buildSnapshots(groups, sel);
    const b = [...a].reverse();
    expect(configKey('latte', a)).toBe(configKey('latte', b));
    expect(configKey('latte', a, 'extra hot')).not.toBe(configKey('latte', a));
    expect(configKey('latte', a, ' Extra hot ')).toBe(configKey('latte', a, 'extra hot'));
  });
});

describe('groupRuleLabel', () => {
  it('describes rules', () => {
    expect(groupRuleLabel(size)).toBe('Choose one');
    expect(groupRuleLabel(serve)).toBe('Optional');
    expect(groupRuleLabel(syrup)).toBe('Optional · up to 2');
  });
});
