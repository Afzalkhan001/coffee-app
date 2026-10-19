// productArt.tsx pulls in Reanimated: mock the worklets runtime like the render test does.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));

/* eslint-disable import/first */
import { PRODUCTS } from '@/data/mock/menu';
import { PHOTOS } from '@/data/mock/photos';
import { tileTints } from '@/theme';
import { dietaryLine } from '../DietaryTags';
import { metaLine } from '../MetaChips';
import { visibleSticker } from '../ProductBadges';
import { clusterImages, resolveTileColor, tileRadius, tintForCategory, tintForImage } from '../productArt';
/* eslint-enable import/first */

describe('product art helpers (R3.A4)', () => {
  it('finds the category tint for a bare image string, legacy URLs included', () => {
    expect(tintForImage(PHOTOS.icedLatte)).toBe('cold');
    expect(tintForImage(PHOTOS.croissant)).toBe('snacks');
    expect(tintForImage(PHOTOS.matchaLatte)).toBe('tea');
    expect(tintForImage('https://images.unsplash.com/photo-1582623196338-9454316891dd?w=240')).toBe('desserts');
    expect(tintForImage('https://example.com/x.png')).toBe('coffee');
    expect(tintForImage(undefined)).toBe('coffee');
    expect(tintForCategory('bakery')).toBe('snacks');
    expect(tintForCategory('nope')).toBe('coffee');
  });

  it('resolves tint keys through tileTints and passes colours through', () => {
    expect(resolveTileColor('cold')).toBe(tileTints.cold);
    expect(resolveTileColor('#123456')).toBe('#123456');
  });

  it('uses rounded squares, never circles, for product tiles', () => {
    expect(tileRadius(168)).toBe(28);
    expect(tileRadius(64)).toBe(20);
    expect(tileRadius(80)).toBe(22);
    expect(tileRadius(48)).toBe(16);
  });

  it('clusters at most three unique cut-outs (no "+N")', () => {
    const legacyLatte = 'https://images.unsplash.com/photo-1654921469305-28d0081c7a79?w=800';
    expect(clusterImages([PHOTOS.latte, legacyLatte, PHOTOS.croissant, '', PHOTOS.cookie, PHOTOS.mocha])).toEqual([
      PHOTOS.latte,
      PHOTOS.croissant,
      PHOTOS.cookie,
    ]);
    expect(clusterImages([PHOTOS.latte, PHOTOS.mocha], 1)).toEqual([PHOTOS.latte]);
  });
});

describe('card copy (R3.A7)', () => {
  it('shows at most one sticker: sold out > best seller > new; never seasonal', () => {
    const byId = (id: string) => PRODUCTS.find((p) => p.id === id)!;
    expect(visibleSticker(byId('caramel-macchiato'))).toBe('best_seller');
    expect(visibleSticker(byId('spanish-latte'))).toBe('new');
    expect(visibleSticker({ ...byId('caramel-macchiato'), isAvailable: false })).toBe('sold_out');
    expect(visibleSticker({ isAvailable: true, badge: 'seasonal' })).toBeNull();
    expect(PRODUCTS.filter((p) => visibleSticker(p) === 'best_seller').map((p) => p.id)).toEqual(['caramel-macchiato']);
  });

  it('turns meta and dietary data into quiet text', () => {
    expect(metaLine({ rating: 4.5, prepMinutes: 6 })).toBe('★ 4.5 · 6 min');
    expect(metaLine({ rating: 4.5, prepMinutes: 6 }, { withRating: false, kcal: 245 })).toBe('6 min · 245 kcal');
    expect(dietaryLine(['vegetarian', 'low_cal', 'dairy_free'])).toBe('Vegetarian · Dairy-free');
    expect(dietaryLine(['low_cal'], { includeLowCal: true })).toBe('Low cal');
    expect(dietaryLine([])).toBe('');
  });
});
