import { SEED_ADDRESSES } from '@/data/mock/marketing';
import { distanceFromStoreKm, distanceKm, findLocality, formatKm, isDeliverable, LOCALITIES, nearestLocality } from '@/lib/geo';
import { brand } from '@/theme/brand';

const seed = (id: string) => SEED_ADDRESSES.find((a) => a.id === id)!;

describe('deliverability around the Indiranagar café (5 km)', () => {
  it('the store sits in Indiranagar, Bengaluru', () => {
    expect(brand.store).toMatchObject({ lat: 12.9716, lng: 77.6412, deliveryRadiusKm: 5 });
    expect(brand.store.address).toContain('Indiranagar, Bengaluru 560038');
  });

  it('Home (Domlur, ~1.2 km) and Work (Residency Rd, ~3.8 km) are in range', () => {
    const home = seed('addr-home');
    const studio = seed('addr-work');
    expect(home.city).toContain('Bengaluru 560071');
    expect(distanceFromStoreKm(home)).toBeCloseTo(1.2, 1);
    expect(isDeliverable(home)).toBe(true);
    expect(distanceFromStoreKm(studio)).toBeCloseTo(3.8, 1);
    expect(isDeliverable(studio)).toBe(true);
    expect(formatKm(distanceFromStoreKm(home))).toBe('1.2 km');
  });

  it('the Nandi Hills cottage (~45 km) is out of range', () => {
    const cottage = seed('addr-cabin');
    expect(cottage.label).toBe('Nandi Hills cottage');
    expect(distanceFromStoreKm(cottage)).toBeGreaterThan(40);
    expect(isDeliverable(cottage)).toBe(false);
  });

  it('the radius edge is inclusive and short distances read in metres', () => {
    const kmPerDegLat = 6371 * (Math.PI / 180);
    const atEdge = { lat: brand.store.lat + 4.999 / kmPerDegLat, lng: brand.store.lng };
    const past = { lat: brand.store.lat + 5.01 / kmPerDegLat, lng: brand.store.lng };
    expect(isDeliverable(atEdge)).toBe(true);
    expect(isDeliverable(past)).toBe(false);
    expect(formatKm(brand.store.distanceKm)).toBe('800 m');
  });
});

describe('simulated geocoder (no network)', () => {
  it('every known neighbourhood is inside the delivery radius, with a Bengaluru PIN', () => {
    for (const l of LOCALITIES) {
      expect(isDeliverable(l)).toBe(true);
      expect(l.pin).toMatch(/^560\d{3}$/);
    }
  });

  it('names the nearest neighbourhood to a point', () => {
    const domlur = seed('addr-home');
    expect(nearestLocality(domlur).locality.area).toBe('Domlur');
    expect(nearestLocality(domlur).km).toBeLessThan(0.1);
    const whitefield = { lat: 12.9698, lng: 77.75 };
    expect(nearestLocality(whitefield).km).toBeGreaterThan(5);
  });

  it('finds a neighbourhood by whole words of the area, an alias, or else the PIN', () => {
    expect(findLocality({ area: 'Koramangala 4th Block' })?.area).toBe('Koramangala');
    expect(findLocality({ area: 'domlur layout' })?.area).toBe('Domlur');
    expect(findLocality({ area: 'Halasuru' })?.area).toBe('Ulsoor');
    expect(findLocality({ area: 'Residency Road' })?.area).toBe('Ashok Nagar');
    expect(findLocality({ area: 'Indira' })).toBeUndefined();
    expect(findLocality({ area: 'Somewhere', pin: '560071' })?.area).toBe('Domlur');
    expect(findLocality({ area: '', pin: '560999' })).toBeUndefined();
    expect(distanceKm(findLocality({ area: 'Indiranagar' })!, { lat: 12.9716, lng: 77.6412 })).toBeLessThan(1);
  });
});
