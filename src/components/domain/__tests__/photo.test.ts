// photo.tsx pulls in the UI kit (Reanimated): mock the worklets runtime like the render test does.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));

/* eslint-disable import/first */
import { sizedPhoto } from '../photo';
/* eslint-enable import/first */

const SQUARE = 'https://images.unsplash.com/photo-1?w=800&h=800&q=80&auto=format&fit=crop&crop=entropy';
const WIDE = 'https://images.unsplash.com/photo-2?w=1200&h=600&q=80&auto=format&fit=crop';
const WIDTH_ONLY = 'https://images.unsplash.com/photo-3?w=1200&q=80&auto=format&fit=crop';

const param = (url: string, key: string) => Number(new URL(url).searchParams.get(key));

describe('sizedPhoto', () => {
  it('scales h= with w= so fit=crop keeps the original aspect ratio', () => {
    const small = sizedPhoto(SQUARE, 60);
    expect(param(small, 'w')).toBeLessThan(800);
    expect(param(small, 'h')).toBe(param(small, 'w'));

    const wide = sizedPhoto(WIDE, 100);
    expect(param(wide, 'h') * 2).toBe(param(wide, 'w'));
  });

  it('only rewrites w= when the URL has no h=', () => {
    const out = sizedPhoto(WIDTH_ONLY, 100);
    expect(new URL(out).searchParams.has('h')).toBe(false);
    expect(param(out, 'w')).toBeLessThan(1200);
  });

  it('is deterministic (fly-to-cart clones must request the same URL as the card)', () => {
    expect(sizedPhoto(SQUARE, 140)).toBe(sizedPhoto(SQUARE, 140));
  });

  it('leaves non-Unsplash URLs alone', () => {
    expect(sizedPhoto('https://example.com/a.png?w=10', 300)).toBe('https://example.com/a.png?w=10');
  });
});
