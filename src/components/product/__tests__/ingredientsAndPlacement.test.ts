// ProductIntro pulls in the domain kit (Reanimated, the cart store): mock their native edges.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/* eslint-disable import/first */
import { PRODUCTS } from '@/data/mock/menu';
import { PHOTOS } from '@/data/mock/photos';
import { ART_BASELINE, artPlacement, artPlacementTransform, placedSubjectTop } from '@/data/mock/photoMetrics';
import type { DietaryTag } from '@/types/models';
import { ingredientsLine } from '../ProductIntro';
/* eslint-enable import/first */

const product = (id: string) => PRODUCTS.find((p) => p.id === id)!;
const plain = (s: string) => s.replace(/⁠/g, '').replace(/ /g, ' ');

describe('ingredients line (R3 product detail)', () => {
  it('keeps short lines on one line, dietary words glued to the text', () => {
    const line = ingredientsLine(product('iced-latte'), 390);
    expect(plain(line)).toBe('Espresso over ice with cold milk · Vegetarian');
    expect(line).not.toContain('\n');
    expect(line).toContain('milk · Vegetarian');
  });

  it('gives the dietary words line 2 to themselves instead of widowing one', () => {
    expect(plain(ingredientsLine(product('matcha-latte'), 390))).toBe('Ceremonial-grade Uji matcha whisked with milk\nVegetarian');
    // A fixed fixture: the mock cheesecake is now marked `diet: 'egg'` and no longer says "Vegetarian".
    const twoWords = { description: 'Burnt top, custardy centre', dietary: ['vegetarian', 'gluten_free'] as DietaryTag[] };
    expect(plain(ingredientsLine(twoWords, 390))).toBe('Burnt top, custardy centre\nVegetarian · Gluten-free');
  });

  it('never lets a hyphenated dietary word break', () => {
    const line = ingredientsLine(product('cheesecake'), 390);
    expect(line).toContain('Gluten⁠-⁠free');
    expect(line).not.toMatch(/Gluten-free/);
  });

  it('runs the dietary words on after a two-line description when they fit', () => {
    const line = plain(ingredientsLine(product('caramel-macchiato'), 390));
    expect(line).toBe('Vanilla, steamed milk, espresso and a caramel lattice · Vegetarian');
  });

  it('leaves products without dietary words alone', () => {
    expect(ingredientsLine(product('breakfast-sandwich'), 390)).toBe('Free-range fried egg, smoked bacon, rocket, aioli');
  });
});

describe('cut-out placement (photoMetrics)', () => {
  it('is the identity for cups, which already rest on the baseline', () => {
    expect(artPlacement(PHOTOS.latte)).toEqual({ scale: 1, shift: 0 });
    expect(artPlacementTransform(PHOTOS.latte, 120)).toBeUndefined();
    expect(artPlacement('https://example.com/remote.png')).toEqual({ scale: 1, shift: 0 });
  });

  it('seats food items on their shadow: the contact point lands on the baseline', () => {
    for (const key of ['croissant', 'cheesecake', 'tiramisu'] as const) {
      const { scale, shift } = artPlacement(PHOTOS[key]);
      expect(shift).toBeGreaterThan(0); // moved down onto the shadow
      // Whatever the scale, the contact line ends on 1 − baseline (scale is about the box centre).
      const contact = { croissant: 0.08, cheesecake: 0.06, tiramisu: 0.07 }[key];
      expect(0.5 + shift + scale * (1 - contact - 0.5)).toBeCloseTo(1 - ART_BASELINE, 6);
    }
  });

  it('shows the cheesecake smaller so the set reads as one scale', () => {
    expect(artPlacement(PHOTOS.cheesecake).scale).toBeLessThan(0.9);
    expect(artPlacementTransform(PHOTOS.cheesecake, 100)?.transform[1]).toEqual({ scale: 0.84 });
  });

  it('reports where the subject top lands after placement', () => {
    expect(placedSubjectTop(PHOTOS.caramelMacchiato)).toBeCloseTo(0.16, 3);
    expect(placedSubjectTop(PHOTOS.croissant)).toBeGreaterThan(0.346);
  });
});
