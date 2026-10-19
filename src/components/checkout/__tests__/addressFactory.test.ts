/**
 * Mock addresses around the Indiranagar café: typed addresses land in their neighbourhood (or within
 * 3 km), an area mentioning Nandi / Mysuru lands out of range, edits keep their point unless the
 * place changed, and "Use current location" pre-fills the nearest known neighbourhood (a GPS fix
 * outside Bengaluru is moved next to the café for demos).
 */
import { addressFromDraft, addressFromFields, DEMO_SNAP_KM, locateFix } from '@/components/checkout/addressFactory';
import { SEED_ADDRESSES } from '@/data/mock/marketing';
import { emptyAddressFields, fieldsFromAddress, isValidPin, OUT_OF_RANGE_DEMO, type AddressFields } from '@/lib/address';
import { distanceFromStoreKm, distanceKm, findLocality, isDeliverable } from '@/lib/geo';

const fields = (extra: Partial<AddressFields>): AddressFields => ({
  ...emptyAddressFields('home'),
  flatNo: 'Flat 2A',
  building: 'Palm Grove Apartments',
  street: '2nd Main Rd',
  area: 'Koramangala',
  pin: '560034',
  ...extra,
});

describe('typed addresses', () => {
  it('derive the display lines and land in the named neighbourhood', () => {
    const koramangala = findLocality({ area: 'Koramangala' })!;
    for (let i = 0; i < 20; i++) {
      const a = addressFromFields(fields({ landmark: 'Forum Mall' }));
      expect(a).toMatchObject({
        kind: 'home',
        label: 'Home',
        line1: 'Flat 2A, Palm Grove Apartments, 2nd Main Rd',
        line2: 'Near Forum Mall',
        city: 'Koramangala, Bengaluru 560034',
      });
      expect(a.parts).toMatchObject({ area: 'Koramangala', city: 'Bengaluru', state: 'Karnataka', pin: '560034' });
      expect(distanceKm(a, koramangala)).toBeLessThanOrEqual(0.26);
      expect(isDeliverable(a)).toBe(true);
    }
  });

  it('an unknown area lands within 3 km of the café', () => {
    for (let i = 0; i < 20; i++) {
      const a = addressFromFields(fields({ area: 'Somewhere Layout', pin: '560099' }));
      expect(distanceFromStoreKm(a)).toBeLessThanOrEqual(3.01);
    }
  });

  it('an area mentioning Nandi, Mysuru or Mysore lands out of range', () => {
    for (const area of ['Nandi Hills', 'near nandi', 'Mysuru', 'MYSORE']) {
      expect(OUT_OF_RANGE_DEMO.test(area)).toBe(true);
      const a = addressFromFields(fields({ area, pin: '562103', city: 'Chikkaballapur' }));
      expect(isDeliverable(a)).toBe(false);
      expect(distanceFromStoreKm(a)).toBeGreaterThan(20);
    }
  });

  it('an edit keeps the id, and the point unless the area, city or PIN changed', () => {
    const home = SEED_ADDRESSES.find((a) => a.id === 'addr-home')!;
    const renamed = addressFromFields({ ...fieldsFromAddress(home), flatNo: 'Flat 5C', kind: 'other', otherName: 'Old flat' }, { previous: home });
    expect(renamed).toMatchObject({ id: home.id, lat: home.lat, lng: home.lng, label: 'Old flat', kind: 'other', line1: 'Flat 5C, Sunrise Residency, 6th Cross' });
    const moved = addressFromFields({ ...fieldsFromAddress(home), area: 'Mysuru' }, { previous: home });
    expect(moved.id).toBe(home.id);
    expect(isDeliverable(moved)).toBe(false);
  });

  it('keeps the receiver only when someone else is receiving, as a bare 10-digit mobile', () => {
    const forPriya = addressFromFields(fields({ forSomeoneElse: true, contactName: ' Priya ', contactPhone: '+91 98450 12345' }));
    expect(forPriya).toMatchObject({ contactName: 'Priya', contactPhone: '9845012345' });
    const forMe = addressFromFields(fields({ forSomeoneElse: false, contactName: 'Priya', contactPhone: '9845012345' }));
    expect(forMe.contactName).toBeUndefined();
    expect(forMe.contactPhone).toBeUndefined();
  });
});

describe('current location (no reverse geocoding)', () => {
  it('a fix outside Bengaluru (> 60 km) is moved next to the café and named after its neighbourhood', () => {
    const mumbai = { lat: 19.076, lng: 72.8777 };
    for (let i = 0; i < 10; i++) {
      const fix = locateFix(mumbai);
      expect(fix.snapped).toBe(true);
      expect(distanceFromStoreKm(fix)).toBeLessThan(2);
      expect(fix.fill.city).toBe('Bengaluru');
      expect(fix.fill.state).toBe('Karnataka');
      expect(fix.fill.area).not.toBe('');
      expect(isValidPin(fix.fill.pin)).toBe(true);
    }
    expect(DEMO_SNAP_KM).toBe(60);
  });

  it('a fix inside Bengaluru keeps the real position (so > 5 km is honestly out of range)', () => {
    const domlur = { lat: 12.9612, lng: 77.6389 };
    const near = locateFix(domlur);
    expect(near).toMatchObject({ lat: domlur.lat, lng: domlur.lng, snapped: false, fill: { area: 'Domlur', pin: '560071' } });
    // Saved untouched, the address sits exactly on the fix.
    const saved = addressFromFields({ ...emptyAddressFields('home'), ...near.fill, flatNo: '12', building: 'Lake View' }, { located: near });
    expect(saved).toMatchObject({ lat: domlur.lat, lng: domlur.lng, city: 'Domlur, Bengaluru 560071' });

    const whitefield = { lat: 12.9698, lng: 77.75 };
    const far = locateFix(whitefield);
    expect(far.snapped).toBe(false);
    // No known neighbourhood within 2 km: the customer types the area, and the fix still stands.
    expect(far.fill.area).toBe('');
    const typed = addressFromFields({ ...emptyAddressFields('home'), ...far.fill, flatNo: '7', street: 'ITPL Main Rd', area: 'Whitefield', pin: '560066' }, { located: far });
    expect(typed).toMatchObject({ lat: whitefield.lat, lng: whitefield.lng });
    expect(isDeliverable(typed)).toBe(false);
  });
});

describe('legacy draft (pre-structured form)', () => {
  it('still builds an address with the PIN on the city line', () => {
    const a = addressFromDraft({ label: 'Home', street: '80 Feet Rd', apt: 'Flat 2A', city: 'Koramangala, Bengaluru', pin: '560034', notes: '' });
    expect(a.city).toBe('Koramangala, Bengaluru 560034');
    expect(a.line2).toBe('Flat 2A');
    expect(a.parts).toBeUndefined();
    expect(isDeliverable(a)).toBe(true);
  });
});
