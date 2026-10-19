jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/* eslint-disable import/first */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LEGACY_STORAGE_KEYS, purgeLegacyStorage, STORAGE_KEYS } from '@/lib/storage';

describe('persisted keys (India data model)', () => {
  it('every store is on v2, so v1 USD carts, orders and US phone numbers are never read', () => {
    expect(STORAGE_KEYS).toEqual({
      session: 'ember.session.v2',
      cart: 'ember.cart.v2',
      demo: 'ember.demo.v2',
      db: 'ember.mockdb.v2',
      favorites: 'ember.favorites.v2',
    });
    for (const key of Object.values(STORAGE_KEYS)) expect(LEGACY_STORAGE_KEYS).not.toContain(key);
  });

  it('purges the v1 stores once and keeps the v2 ones', async () => {
    await AsyncStorage.multiSet([
      ['ember.cart.v1', '{"state":{"items":[{"basePrice":5.2}]}}'],
      ['ember.mockdb.v1', '{}'],
      ['ember.cart.v2', '{"state":{"items":[]}}'],
    ]);
    await purgeLegacyStorage();
    expect(await AsyncStorage.getItem('ember.cart.v1')).toBeNull();
    expect(await AsyncStorage.getItem('ember.mockdb.v1')).toBeNull();
    expect(await AsyncStorage.getItem('ember.cart.v2')).not.toBeNull();
    // Once per launch: a second call reuses the first purge.
    expect(purgeLegacyStorage()).toBe(purgeLegacyStorage());
  });

  it('never throws or rejects when storage fails', async () => {
    let fresh!: typeof import('@/lib/storage');
    let store!: typeof AsyncStorage;
    jest.isolateModules(() => {
      store = require('@react-native-async-storage/async-storage');
      fresh = require('@/lib/storage');
    });
    jest.spyOn(store, 'multiRemove').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    await expect(fresh.purgeLegacyStorage()).resolves.toBeUndefined();
  });
});
