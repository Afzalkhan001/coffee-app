import { SEED_ADDRESSES } from '@/data/mock/marketing';
import {
  addressCityLine,
  addressKind,
  addressLandmark,
  composeAddress,
  defaultAddressKind,
  emptyAddressFields,
  fieldsFromAddress,
  firstAddressError,
  firstInvalidField,
  formatAddress,
  isOutOfRangeDemo,
  isValidPin,
  landmarkLine,
  lookupPin,
  receiverLine,
  replaceAddress,
  sameFields,
  selectionAfterRemove,
  upgradeLegacySeeds,
  validateAddressFields,
  withPin,
  type AddressFields,
} from '@/lib/address';
import { isDeliverable } from '@/lib/geo';
import type { Address } from '@/types/models';

const seed = (id: string) => SEED_ADDRESSES.find((a) => a.id === id)!;
const home = seed('addr-home');

const complete = (extra: Partial<AddressFields> = {}): AddressFields => ({
  ...emptyAddressFields('home'),
  flatNo: 'Flat 4B',
  building: 'Sunrise Residency',
  street: '6th Cross',
  landmark: 'Domlur Flyover',
  area: 'Domlur',
  pin: '560071',
  ...extra,
});

describe('display lines', () => {
  it('formats the Home seed short and full, with the landmark as "Near …"', () => {
    expect(formatAddress(home, 'short')).toBe('Flat 4B, Sunrise Residency, 6th Cross');
    expect(formatAddress(home)).toBe('Flat 4B, Sunrise Residency, 6th Cross');
    expect(formatAddress(home, 'full')).toBe('Flat 4B, Sunrise Residency, 6th Cross, Near Domlur Flyover, Domlur, Bengaluru, Karnataka 560071');
    expect(addressCityLine(home)).toBe('Domlur, Bengaluru 560071');
    expect(addressLandmark(home)).toBe('Near Domlur Flyover');
  });

  it('keeps a landmark that already reads as a direction', () => {
    expect(landmarkLine('Domlur Flyover')).toBe('Near Domlur Flyover');
    expect(landmarkLine('opp. Forum Mall')).toBe('Opp. Forum Mall');
    expect(landmarkLine('Behind the temple')).toBe('Behind the temple');
    expect(landmarkLine('near  the  lake ')).toBe('Near the lake');
    expect(landmarkLine('   ')).toBeUndefined();
  });

  it('falls back to the stored lines for addresses saved before the structured form', () => {
    const legacy: Address = { id: 'a1', label: 'Studio', line1: 'Level 3, Prestige Tower, Residency Rd', city: 'Bengaluru 560025', lat: 0, lng: 0 };
    expect(formatAddress(legacy, 'short')).toBe(legacy.line1);
    expect(formatAddress(legacy, 'full')).toBe('Level 3, Prestige Tower, Residency Rd, Bengaluru 560025');
    expect(addressCityLine(legacy)).toBe('Bengaluru 560025');
    expect(addressLandmark(legacy)).toBeUndefined();
  });

  it('every seed’s display lines are what the structured fields derive', () => {
    for (const a of SEED_ADDRESSES) {
      expect(a.parts).toBeDefined();
      const composed = composeAddress(fieldsFromAddress(a));
      expect(composed).toMatchObject({ label: a.label, kind: a.kind, line1: a.line1, line2: a.line2, city: a.city });
    }
    expect(SEED_ADDRESSES.map((a) => [a.label, isDeliverable(a)])).toEqual([
      ['Home', true],
      ['Work', true],
      ['Nandi Hills cottage', false],
    ]);
  });

  it('describes someone else receiving the order', () => {
    expect(receiverLine({ contactName: 'Priya', contactPhone: '9845012345' })).toBe('For Priya · +91 98450 12345');
    expect(receiverLine({})).toBeUndefined();
  });
});

describe('PIN codes', () => {
  it('are 6 digits, never starting with 0', () => {
    expect(isValidPin('560038')).toBe(true);
    expect(isValidPin(' 560038 ')).toBe(true);
    for (const bad of ['56003', '5600381', '060038', 'abcdef', '']) expect(isValidPin(bad)).toBe(false);
  });

  it('a Bengaluru PIN (560001–560103) fills in the city and state', () => {
    expect(lookupPin('560001')).toEqual({ city: 'Bengaluru', state: 'Karnataka' });
    expect(lookupPin('560103')).toEqual({ city: 'Bengaluru', state: 'Karnataka' });
    expect(lookupPin('560104')).toBeNull();
    expect(lookupPin('562103')).toBeNull();
    expect(lookupPin('5600')).toBeNull();

    const typedElsewhere = { ...emptyAddressFields(), city: 'Mysuru', state: 'Karnataka' };
    expect(withPin(typedElsewhere, '570 001')).toMatchObject({ pin: '570001', city: 'Mysuru' });
    expect(withPin(typedElsewhere, '56007')).toMatchObject({ pin: '56007', city: 'Mysuru' });
    expect(withPin({ ...typedElsewhere, city: '', state: '' }, '560071x9')).toMatchObject({ pin: '560071', city: 'Bengaluru', state: 'Karnataka' });
  });
});

describe('validation', () => {
  it('a complete address passes', () => {
    expect(validateAddressFields(complete())).toEqual({});
    expect(validateAddressFields(complete({ building: '', landmark: '' }))).toEqual({});
  });

  it('asks for the house, a building or street, the area, a valid PIN, city and state, top to bottom', () => {
    const blank = { ...emptyAddressFields(), city: '', state: '' };
    const errors = validateAddressFields(blank);
    expect(Object.keys(errors)).toEqual(['flatNo', 'building', 'area', 'pin', 'city', 'state']);
    expect(firstInvalidField(errors)).toBe('flatNo');
    expect(firstAddressError(errors)).toBe('Add the house or flat number');
    expect(validateAddressFields(complete({ pin: '56007' })).pin).toBe('Enter a 6-digit PIN code');
    expect(validateAddressFields(complete({ pin: '060071' })).pin).toBe('Enter a 6-digit PIN code');
  });

  it('checks the receiver only when someone else is receiving (+91 mobiles)', () => {
    expect(validateAddressFields(complete({ contactName: '', contactPhone: '12' }))).toEqual({});
    const missing = validateAddressFields(complete({ forSomeoneElse: true }));
    expect(missing).toEqual({ contactName: 'Add their name', contactPhone: 'Add their mobile number' });
    expect(validateAddressFields(complete({ forSomeoneElse: true, contactName: 'Priya', contactPhone: '5550142290' })).contactPhone).toBe(
      'Enter a 10-digit mobile number',
    );
    expect(validateAddressFields(complete({ forSomeoneElse: true, contactName: 'Priya', contactPhone: '+91 98450 12345' }))).toEqual({});
  });

  it('the out-of-range demo keywords', () => {
    expect(isOutOfRangeDemo({ area: 'Nandi Hills', city: 'Chikkaballapur' })).toBe(true);
    expect(isOutOfRangeDemo({ area: 'Gokulam', city: 'Mysore' })).toBe(true);
    expect(isOutOfRangeDemo({ area: 'Domlur', city: 'Bengaluru' })).toBe(false);
  });
});

describe('form fields ↔ saved address', () => {
  it('composes the structured address and its display lines', () => {
    const a = composeAddress(complete({ kind: 'other', otherName: '  Parents’ place ', notes: ' Ring twice ' }));
    expect(a).toMatchObject({
      kind: 'other',
      label: 'Parents’ place',
      line1: 'Flat 4B, Sunrise Residency, 6th Cross',
      line2: 'Near Domlur Flyover',
      city: 'Domlur, Bengaluru 560071',
      notes: 'Ring twice',
    });
    expect(composeAddress(complete({ kind: 'other' })).label).toBe('Other');
    expect(composeAddress(complete({ landmark: '' })).line2).toBeUndefined();
  });

  it('round-trips a structured address', () => {
    const f = fieldsFromAddress(home);
    expect(f).toMatchObject({ kind: 'home', flatNo: 'Flat 4B', building: 'Sunrise Residency', street: '6th Cross', landmark: 'Domlur Flyover', notes: 'Ring 4B, leave with security' });
    expect(sameFields(f, fieldsFromAddress(home))).toBe(true);
    expect(sameFields(f, { ...f, flatNo: ' Flat 4B ' })).toBe(true);
    expect(sameFields(f, { ...f, flatNo: 'Flat 5C' })).toBe(false);
    expect(sameFields(f, { ...f, forSomeoneElse: true })).toBe(false);
  });

  it('splits an older address back into fields (best effort)', () => {
    const studio: Address = { id: 'a1', label: 'Studio', line1: 'Level 3, Prestige Tower, Residency Rd', city: 'Bengaluru 560025', lat: 0, lng: 0 };
    expect(fieldsFromAddress(studio)).toMatchObject({
      kind: 'other',
      otherName: 'Studio',
      flatNo: 'Level 3',
      building: 'Prestige Tower',
      street: 'Residency Rd',
      area: '',
      city: 'Bengaluru',
      state: 'Karnataka',
      pin: '560025',
    });
    // The old form kept the flat on line 2 and "area, city" before the PIN.
    const typed: Address = { id: 'a2', label: 'Home', line1: '80 Feet Rd', line2: 'Flat 2A', city: 'Koramangala, Bangalore 560034', lat: 0, lng: 0 };
    expect(fieldsFromAddress(typed)).toMatchObject({ kind: 'home', flatNo: 'Flat 2A', street: '80 Feet Rd', area: 'Koramangala', city: 'Bengaluru', pin: '560034' });
  });
});

describe('labels', () => {
  it('kind from the record or its label', () => {
    expect(addressKind({ label: 'Work' })).toBe('work');
    expect(addressKind({ label: ' home ' })).toBe('home');
    expect(addressKind({ label: 'Studio' })).toBe('other');
    expect(addressKind({ label: 'Studio', kind: 'work' })).toBe('work');
  });

  it('a new address defaults to the first of Home / Work not saved yet', () => {
    expect(defaultAddressKind([])).toBe('home');
    expect(defaultAddressKind([{ label: 'Home' }, { label: 'Studio' }])).toBe('work');
    expect(defaultAddressKind(SEED_ADDRESSES)).toBe('other');
  });
});

describe('saved list', () => {
  const list = SEED_ADDRESSES;

  it('replaces an edited address in place', () => {
    const edited = { ...home, label: 'Flat' };
    expect(replaceAddress(list, edited).map((a) => a.label)).toEqual(['Flat', 'Work', 'Nandi Hills cottage']);
  });

  it('removing the selected address selects the next one we deliver to', () => {
    expect(selectionAfterRemove(list, 'addr-home', 'addr-home', isDeliverable)).toBe('addr-work');
    expect(selectionAfterRemove(list, 'addr-cabin', 'addr-home', isDeliverable)).toBe('addr-home');
    expect(selectionAfterRemove(list, 'addr-work', 'addr-home', isDeliverable)).toBe('addr-home');
    // Nothing deliverable left: no selection (the bar asks for an address).
    expect(selectionAfterRemove(list.filter((a) => a.id !== 'addr-work'), 'addr-home', 'addr-home', isDeliverable)).toBeUndefined();
  });

  it('upgrades untouched pre-structured demo seeds, and nothing else', () => {
    const oldHome: Address = { id: 'addr-home', label: 'Home', line1: 'Flat 4B, Sunrise Residency, 6th Cross', city: 'Domlur, Bengaluru 560071', lat: 12.961, lng: 77.6387 };
    const oldStudio: Address = { id: 'addr-work', label: 'Studio', line1: 'Level 3, Prestige Tower, Residency Rd', city: 'Bengaluru 560025', lat: 12.9718, lng: 77.6062 };
    const mine: Address = { id: 'addr_x', label: 'Gym', line1: '100 Feet Rd', city: 'Indiranagar, Bengaluru 560038', lat: 12.97, lng: 77.64 };
    const upgraded = upgradeLegacySeeds([mine, oldHome, oldStudio], SEED_ADDRESSES);
    expect(upgraded.map((a) => a.label)).toEqual(['Gym', 'Home', 'Work']);
    expect(upgraded[0]).toBe(mine);
    expect(upgraded[1]!.line2).toBe('Near Domlur Flyover');
    // Already current: the same array comes back (no store write).
    expect(upgradeLegacySeeds(SEED_ADDRESSES, SEED_ADDRESSES)).toBe(SEED_ADDRESSES);
  });
});
