import { describe, expect, it } from '@jest/globals';
import { mapsUrl, mapsWebUrl } from '@/lib/maps';
import { brand } from '@/theme/brand';

// The real store point (Indiranagar, Bengaluru), so a coordinate typo in brand.ts fails here.
const store = { lat: brand.store.lat, lng: brand.store.lng, label: brand.store.name };

describe('mapsUrl', () => {
  it('points at the Indiranagar café', () => {
    expect(store).toEqual({ lat: 12.9716, lng: 77.6412, label: 'Ember Roast — Indiranagar' });
  });

  it('opens Apple Maps on iOS with the label as the pin title', () => {
    expect(mapsUrl(store, 'ios')).toBe(
      'https://maps.apple.com/?ll=12.9716,77.6412&q=Ember%20Roast%20%E2%80%94%20Indiranagar',
    );
  });

  it('uses a labelled geo: intent on Android', () => {
    expect(mapsUrl(store, 'android')).toBe(
      'geo:12.9716,77.6412?q=12.9716,77.6412(Ember%20Roast%20%E2%80%94%20Indiranagar)',
    );
  });

  it('falls back to the Google Maps web page elsewhere', () => {
    expect(mapsUrl(store, 'web')).toBe(mapsWebUrl(store));
    expect(mapsWebUrl(store)).toBe('https://www.google.com/maps/search/?api=1&query=12.9716,77.6412');
  });
});
