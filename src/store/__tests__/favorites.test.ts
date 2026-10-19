jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/* eslint-disable import/first */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/lib/storage';
import { MAX_FAVORITES, sanitizeFavorites, toggleFavoriteId, useFavorites } from '@/store/favorites';
import { useSession } from '@/store/session';
import type { Profile } from '@/types/models';
/* eslint-enable import/first */

const profile = (phone: string): Profile => ({ id: `u-${phone}`, phone, name: 'Ava Stone', createdAt: '2026-08-14T10:00:00.000Z' });

beforeEach(() => {
  useFavorites.getState().reset();
  useSession.setState({ onboardingDone: true, phone: null, profile: null, lastPhone: null });
});

describe('favourite ids', () => {
  it('toggles an id in and out, newest first', () => {
    expect(toggleFavoriteId([], 'latte')).toEqual(['latte']);
    expect(toggleFavoriteId(['latte'], 'mocha')).toEqual(['mocha', 'latte']);
    expect(toggleFavoriteId(['mocha', 'latte'], 'latte')).toEqual(['mocha']);
  });

  it('keeps at most MAX_FAVORITES, dropping the oldest', () => {
    const full = Array.from({ length: MAX_FAVORITES }, (_, i) => `p${i}`);
    const next = toggleFavoriteId(full, 'new');
    expect(next).toHaveLength(MAX_FAVORITES);
    expect(next[0]).toBe('new');
    expect(next).not.toContain(`p${MAX_FAVORITES - 1}`);
  });

  it('reads anything storage held as valid data', () => {
    expect(sanitizeFavorites(undefined)).toEqual({ ids: [], vegOnly: false, owner: null });
    expect(sanitizeFavorites('junk')).toEqual({ ids: [], vegOnly: false, owner: null });
    expect(sanitizeFavorites({ ids: ['latte', 'latte', 3, '', 'mocha'], vegOnly: 'yes', owner: '' })).toEqual({
      ids: ['latte', 'mocha'],
      vegOnly: false,
      owner: null,
    });
    expect(sanitizeFavorites({ ids: ['latte'], vegOnly: true, owner: '9876543210' })).toEqual({
      ids: ['latte'],
      vegOnly: true,
      owner: '9876543210',
    });
  });
});

describe('favourites store', () => {
  it('toggle reports the new state; remove and Veg only update it', () => {
    let on = false;
    on = useFavorites.getState().toggle('latte');
    expect(on).toBe(true);
    expect(useFavorites.getState().ids).toEqual(['latte']);
    on = useFavorites.getState().toggle('latte');
    expect(on).toBe(false);
    useFavorites.getState().toggle('mocha');
    useFavorites.getState().remove('mocha');
    expect(useFavorites.getState().ids).toEqual([]);
    useFavorites.getState().setVegOnly(true);
    expect(useFavorites.getState().vegOnly).toBe(true);
  });

  it('persists under ember.favorites.v2 (ids, Veg only and owner only)', async () => {
    useFavorites.getState().toggle('flat-white');
    useFavorites.getState().setVegOnly(true);
    await new Promise((r) => setTimeout(r, 0));
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.favorites);
    expect(raw).not.toBeNull();
    const saved = JSON.parse(raw ?? '{}') as { state: Record<string, unknown> };
    expect(saved.state).toEqual({ ids: ['flat-white'], vegOnly: true, owner: null });
  });

  it('belongs to the signed-in number: the same number keeps them, another starts empty', () => {
    useSession.getState().signIn('9876543210', profile('9876543210'));
    useFavorites.getState().toggle('latte');
    expect(useFavorites.getState().owner).toBe('9876543210');

    useSession.getState().signOut();
    expect(useFavorites.getState().ids).toEqual(['latte']);
    useSession.getState().signIn('9876543210', profile('9876543210'));
    expect(useFavorites.getState().ids).toEqual(['latte']);

    useSession.getState().signOut();
    useSession.getState().signIn('9123456780', profile('9123456780'));
    expect(useFavorites.getState().ids).toEqual([]);
    expect(useFavorites.getState().owner).toBe('9123456780');
  });

  it('Reset demo clears favourites and Veg only', () => {
    useSession.getState().signIn('9876543210', profile('9876543210'));
    useFavorites.getState().toggle('latte');
    useFavorites.getState().setVegOnly(true);
    useSession.getState().resetAll();
    expect(useFavorites.getState()).toMatchObject({ ids: [], vegOnly: false, owner: null });
  });
});
