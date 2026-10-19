/**
 * Indian diet marks: the mock data's veg / egg / non-veg assignments, the "Veg only" filter, the
 * copy for its quiet states, the favourites rail selector and the mark itself.
 */
import { act, create } from 'react-test-renderer';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/* eslint-disable import/first */
import { PRODUCTS } from '@/data/mock/menu';
import { categorySummary } from '@/components/home/categoryCopy';
import { favoritePicks } from '@/components/home/homeData';
import { joinNames, noVegMessage, vegHiddenCategoriesNote, vegHiddenReason } from '@/components/home/vegCopy';
import { darkColors, lightColors } from '@/theme';
import { DIET_META, dietColor, dietLabel, isVegProduct, VegMark, vegFilter } from '../VegMark';
/* eslint-enable import/first */

const byId = (id: string) => {
  const p = PRODUCTS.find((x) => x.id === id);
  if (!p) throw new Error(id);
  return p;
};

describe('diet data (India)', () => {
  it('marks every product; drinks are veg, egg bakes are egg, the bacon brioche is non-veg', () => {
    expect(PRODUCTS.every((p) => p.diet === 'veg' || p.diet === 'egg' || p.diet === 'nonveg')).toBe(true);
    for (const p of PRODUCTS.filter((x) => ['coffee', 'tea', 'cold'].includes(x.categoryId))) expect(p.diet).toBe('veg');
    expect(byId('avocado-toast').diet).toBe('veg');
    expect(byId('breakfast-sandwich').diet).toBe('nonveg');
    for (const id of ['croissant', 'banana-bread', 'cookie', 'cheesecake', 'brownie', 'tiramisu']) expect(byId(id).diet).toBe('egg');
  });

  it('never calls an egg or non-veg item "vegetarian" (Indian usage)', () => {
    for (const p of PRODUCTS.filter((x) => x.diet !== 'veg')) {
      expect(p.dietary).not.toContain('vegetarian');
      expect(p.dietary).not.toContain('vegan');
    }
  });
});

describe('Veg only', () => {
  it('keeps only items marked veg, in order; an unmarked item is never veg', () => {
    const list = [byId('latte'), byId('croissant'), byId('avocado-toast'), byId('breakfast-sandwich')];
    expect(vegFilter(list, false)).toEqual(list);
    expect(vegFilter(list, false)).not.toBe(list);
    expect(vegFilter(list, true).map((p) => p.id)).toEqual(['latte', 'avocado-toast']);
    expect(isVegProduct({ diet: undefined })).toBe(false);
    expect(dietLabel('veg')).toBe('Vegetarian');
    expect(dietLabel('egg')).toBe('Contains egg');
    expect(dietLabel('nonveg')).toBe('Non-vegetarian');
    expect(dietLabel(undefined)).toBeUndefined();
  });

  it('uses the theme diet tokens (circle for veg / egg, triangle for non-veg)', () => {
    expect(DIET_META.veg).toMatchObject({ tone: 'veg', symbol: 'circle' });
    expect(DIET_META.egg).toMatchObject({ tone: 'egg', symbol: 'circle' });
    expect(DIET_META.nonveg).toMatchObject({ tone: 'nonVeg', symbol: 'triangle' });
    // The mark colour follows the scheme (re-tuned for contrast on the dark planes).
    expect(dietColor('veg', lightColors)).toBe('#1B8A3B');
    expect(dietColor('egg', lightColors)).toBe(lightColors.egg);
    expect(dietColor('nonveg', lightColors)).toBe(lightColors.nonVeg);
    expect(dietColor('veg', darkColors)).toBe(darkColors.veg);
    expect(dietColor('veg', darkColors)).not.toBe(dietColor('veg', lightColors));
  });

  it('words its quiet states plainly', () => {
    expect(joinNames([])).toBe('');
    expect(joinNames(['Desserts'])).toBe('Desserts');
    expect(joinNames(['Bakery & Snacks', 'Desserts'])).toBe('Bakery & Snacks and Desserts');
    expect(joinNames(['Tea', 'Bakery', 'Desserts'])).toBe('Tea, Bakery and Desserts');
    expect(vegHiddenCategoriesNote(['Bakery & Snacks', 'Desserts'], 4)).toBe('No veg items in Bakery & Snacks and Desserts');
    expect(vegHiddenCategoriesNote(['Desserts'], 0)).toBe('No veg items on the menu right now');

    const desserts = PRODUCTS.filter((p) => p.categoryId === 'desserts');
    expect(noVegMessage('Desserts', desserts)).toBe('Everything in Desserts contains egg.');
    expect(noVegMessage('Breakfast', [byId('breakfast-sandwich')])).toBe('Everything in Breakfast is non-veg.');
    expect(noVegMessage('Mixed', [byId('breakfast-sandwich'), byId('brownie')])).toBe('Everything in Mixed has egg or meat.');
    expect(noVegMessage('New', [{ diet: undefined }])).toBe('Nothing in New is marked veg yet.');

    expect(vegHiddenReason([byId('brownie')])).toBe('The one match contains egg.');
    expect(vegHiddenReason([byId('brownie'), byId('cookie')])).toBe('All 2 matches contain egg.');
    expect(vegHiddenReason([byId('breakfast-sandwich')])).toBe('The one match is non-veg.');
    expect(vegHiddenReason([byId('breakfast-sandwich'), byId('cookie')])).toBe('All 2 matches have egg or meat.');
  });

  it('names a narrowed category in the hero caption', () => {
    const breakfast = { id: 'breakfast' };
    expect(categorySummary(breakfast, [byId('avocado-toast')], { veg: true })).toBe('1 veg item · from ₹420');
    expect(categorySummary({ id: 'coffee' }, [byId('latte'), byId('espresso')], { veg: true })).toBe('2 veg drinks · from ₹160');
    expect(categorySummary(breakfast, [byId('avocado-toast'), byId('breakfast-sandwich')])).toBe('2 items · from ₹360');
  });
});

describe('favourites rail', () => {
  it('follows the saved order, puts sold-out last and skips ids the menu dropped', () => {
    const products = [byId('latte'), { ...byId('croissant'), isAvailable: false }, byId('mocha')];
    expect(favoritePicks(products, ['croissant', 'gone', 'mocha', 'latte']).map((p) => p.id)).toEqual(['mocha', 'latte', 'croissant']);
    expect(favoritePicks(products, [])).toEqual([]);
  });
});

describe('VegMark', () => {
  it('announces the diet, or stays silent when decorative', () => {
    let r!: ReturnType<typeof create>;
    act(() => {
      r = create(
        <>
          <VegMark diet="veg" />
          <VegMark diet="egg" size={12} />
          <VegMark diet="nonveg" size={16} decorative />
        </>,
      );
    });
    const labelled = r.root.findAll(
      (n) => typeof n.type === 'string' && typeof n.props?.accessibilityLabel === 'string' && n.props.accessible === true,
    );
    expect(labelled.map((n) => n.props.accessibilityLabel)).toEqual(['Vegetarian', 'Contains egg']);
    act(() => r.unmount());
  });
});
