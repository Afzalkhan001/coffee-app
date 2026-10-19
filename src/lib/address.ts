/**
 * Indian address helpers (pure: no React, no stores). A saved `Address` keeps the display lines every
 * screen reads — `line1`, `line2`, `city` — and, when it was saved with the structured form, the
 * `parts` they are derived from:
 *
 *   parts  { flatNo: 'Flat 4B', building: 'Sunrise Residency', street: '6th Cross',
 *            landmark: 'Domlur Flyover', area: 'Domlur', city: 'Bengaluru', state: 'Karnataka', pin: '560071' }
 *   line1  "Flat 4B, Sunrise Residency, 6th Cross"
 *   line2  "Near Domlur Flyover"
 *   city   "Domlur, Bengaluru 560071"
 *
 * Addresses saved before the structured form (v2 data without `parts`) keep their stored lines;
 * `fieldsFromAddress` splits those lines back into fields when one is edited.
 */
import type { Address, AddressKind, AddressParts } from '@/types/models';
import { displayPhone, isValidPhone, nationalPhone } from './format';

export const DEFAULT_CITY = 'Bengaluru';
export const DEFAULT_STATE = 'Karnataka';

// ── PIN codes ────────────────────────────────────────────────────────────────

/** A valid Indian PIN code: 6 digits, never starting with 0. */
export const PIN_PATTERN = /^[1-9][0-9]{5}$/;

export function isValidPin(pin: string): boolean {
  return PIN_PATTERN.test(pin.trim());
}

/** Bengaluru's PIN range in the simulated directory (560001–560103). */
const BENGALURU_PINS = { from: 560001, to: 560103 } as const;

/**
 * Simulated PIN directory (no network): a Bengaluru PIN (560001–560103) resolves to Bengaluru,
 * Karnataka; any other PIN resolves to nothing, so the city and state stay as typed.
 */
export function lookupPin(pin: string): { city: string; state: string } | null {
  if (!isValidPin(pin)) return null;
  const n = Number(pin.trim());
  return n >= BENGALURU_PINS.from && n <= BENGALURU_PINS.to ? { city: DEFAULT_CITY, state: DEFAULT_STATE } : null;
}

/** Out-of-range demo: an area or city mentioning Nandi (Hills) or Mysuru / Mysore lands far away. */
export const OUT_OF_RANGE_DEMO = /nandi|mysuru|mysore/i;

// ── Display lines ────────────────────────────────────────────────────────────

const clean = (s: string | undefined) => (s ?? '').trim().replace(/\s+/g, ' ');

/** "Flat 4B, Sunrise Residency, 6th Cross" (house → building → street). */
export function partsLine1(p: Pick<AddressParts, 'flatNo' | 'building' | 'street'>): string {
  return [p.flatNo, p.building, p.street].map(clean).filter(Boolean).join(', ');
}

/** "Domlur, Bengaluru 560071": area, city and the PIN (Indian address order; the state is left out). */
export function partsCityLine(p: Pick<AddressParts, 'area' | 'city' | 'pin'>): string {
  const place = [p.area, p.city].map(clean).filter(Boolean).join(', ');
  return [place, clean(p.pin)].filter(Boolean).join(' ');
}

/** Already reads as a direction: "Opp. Forum Mall", "Behind the temple", "Near…". */
const LANDMARK_LEAD = /^(near|opp\b\.?|opposite|behind|beside|besides|next to|above|below|in front of|across|facing|adjacent to|off)\b/i;

/** "Domlur Flyover" → "Near Domlur Flyover"; "opp. Forum Mall" → "Opp. Forum Mall"; '' → undefined. */
export function landmarkLine(landmark: string | undefined): string | undefined {
  const t = clean(landmark);
  if (!t) return undefined;
  return LANDMARK_LEAD.test(t) ? t.charAt(0).toUpperCase() + t.slice(1) : `Near ${t}`;
}

/** A saved address's landmark line ("Near Domlur Flyover"), if it has one. */
export function addressLandmark(a: Pick<Address, 'parts'>): string | undefined {
  return landmarkLine(a.parts?.landmark);
}

/** The city line ("Domlur, Bengaluru 560071"): derived from the parts, else the stored line. */
export function addressCityLine(a: Pick<Address, 'parts' | 'city'>): string {
  return (a.parts && partsCityLine(a.parts)) || a.city;
}

export type AddressFormat = 'short' | 'full';

/**
 * - `short`: line 1, "Flat 4B, Sunrise Residency, 6th Cross" (rows, checkout, the mode sheet).
 * - `full`: one line for receipts and riders, "Flat 4B, Sunrise Residency, 6th Cross, Near Domlur
 *   Flyover, Domlur, Bengaluru, Karnataka 560071". Older addresses join their stored lines.
 */
export function formatAddress(a: Pick<Address, 'line1' | 'line2' | 'city' | 'parts'>, format: AddressFormat = 'short'): string {
  const p = a.parts;
  if (format === 'short') return (p && partsLine1(p)) || a.line1;
  if (!p) return [a.line1, a.line2, a.city].map(clean).filter(Boolean).join(', ');
  const statePin = [clean(p.state), clean(p.pin)].filter(Boolean).join(' ');
  return [partsLine1(p), landmarkLine(p.landmark), clean(p.area), clean(p.city), statePin].filter(Boolean).join(', ');
}

// ── Labels ───────────────────────────────────────────────────────────────────

export const ADDRESS_KINDS: readonly { kind: AddressKind; label: string }[] = [
  { kind: 'home', label: 'Home' },
  { kind: 'work', label: 'Work' },
  { kind: 'other', label: 'Other' },
];

export function kindLabel(kind: AddressKind): string {
  return ADDRESS_KINDS.find((k) => k.kind === kind)?.label ?? 'Other';
}

/** The kind of a saved address: its `kind`, or for older records the label ("Home", "work" → work). */
export function addressKind(a: Pick<Address, 'kind' | 'label'>): AddressKind {
  if (a.kind) return a.kind;
  const l = a.label.trim().toLowerCase();
  return l === 'home' ? 'home' : l === 'work' ? 'work' : 'other';
}

/** The display label: "Home", "Work", or an Other address's own name (falls back to "Other"). */
export function addressLabel(kind: AddressKind, otherName: string): string {
  return kind === 'other' ? clean(otherName) || 'Other' : kindLabel(kind);
}

/** First of Home / Work not saved yet, else Other (no second "Home" by default). */
export function defaultAddressKind(existing: readonly Pick<Address, 'kind' | 'label'>[]): AddressKind {
  const used = new Set(existing.map(addressKind));
  return used.has('home') ? (used.has('work') ? 'other' : 'work') : 'home';
}

// ── The form's field model ───────────────────────────────────────────────────

/** Everything the address form edits, as typed. */
export interface AddressFields {
  kind: AddressKind;
  /** An Other address's own name ("Parents' place"). */
  otherName: string;
  flatNo: string;
  building: string;
  street: string;
  landmark: string;
  area: string;
  city: string;
  state: string;
  pin: string;
  /** Delivery instructions for the rider. */
  notes: string;
  /** Someone else takes the delivery ("Receiver's details"). */
  forSomeoneElse: boolean;
  contactName: string;
  /** Digits as typed (a +91 / 0 prefix is fine); saved as the bare 10-digit number. */
  contactPhone: string;
}

export type AddressFieldKey = 'flatNo' | 'building' | 'area' | 'pin' | 'city' | 'state' | 'contactName' | 'contactPhone';
export type AddressFieldErrors = Partial<Record<AddressFieldKey, string>>;

/** Form order, top to bottom: the first invalid one gets focus after a failed save. */
export const ADDRESS_FIELD_ORDER: readonly AddressFieldKey[] = ['flatNo', 'building', 'area', 'pin', 'city', 'state', 'contactName', 'contactPhone'];

export function emptyAddressFields(kind: AddressKind = 'home'): AddressFields {
  return {
    kind,
    otherName: '',
    flatNo: '',
    building: '',
    street: '',
    landmark: '',
    area: '',
    city: DEFAULT_CITY,
    state: DEFAULT_STATE,
    pin: '',
    notes: '',
    forSomeoneElse: false,
    contactName: '',
    contactPhone: '',
  };
}

/** A trailing PIN on an older city line ("Domlur, Bengaluru 560071"). */
const TRAILING_PIN = /\s*\b([1-9]\d{5})\s*$/;
/** City names an older city line may end with. */
const KNOWN_CITIES = /^(bengaluru|bangalore)$/i;
/** A leading flat / floor part of an older line 1 ("Flat 4B", "Level 3", "No. 12", "#221"). */
const UNIT_PART = /^(?:(?:flat|apt|apartment|unit|level|floor|house|door)\b|no\b\.?|#)/i;

/**
 * Splits an address saved before the structured form back into fields (best effort): line 1 by
 * commas into house / building / street, the city line into area, city and PIN. Structured
 * addresses map one to one.
 */
export function fieldsFromAddress(a: Address): AddressFields {
  const kind = addressKind(a);
  const base: AddressFields = {
    ...emptyAddressFields(kind),
    otherName: kind === 'other' ? a.label : '',
    notes: a.notes ?? '',
    forSomeoneElse: !!(a.contactName || a.contactPhone),
    contactName: a.contactName ?? '',
    contactPhone: a.contactPhone ?? '',
  };
  if (a.parts) {
    const p = a.parts;
    return {
      ...base,
      flatNo: p.flatNo,
      building: p.building ?? '',
      street: p.street ?? '',
      landmark: p.landmark ?? '',
      area: p.area,
      city: p.city,
      state: p.state,
      pin: p.pin,
    };
  }

  // Line 1 (+ the old form's separate flat line).
  const pieces = a.line1.split(',').map(clean).filter(Boolean);
  let flatNo = clean(a.line2);
  let building = '';
  let street = '';
  if (!flatNo && pieces.length > 1 && UNIT_PART.test(pieces[0]!)) flatNo = pieces.shift()!;
  if (pieces.length > 1) {
    street = pieces.pop()!;
    building = pieces.join(', ');
  } else {
    street = pieces[0] ?? '';
  }

  // City line: "<area>, <city> <pin>".
  const pinMatch = TRAILING_PIN.exec(a.city);
  const pin = pinMatch ? pinMatch[1]! : '';
  const place = (pinMatch ? a.city.slice(0, pinMatch.index) : a.city).split(',').map(clean).filter(Boolean);
  let city = '';
  if (place.length > 1 || (place.length === 1 && KNOWN_CITIES.test(place[0]!))) city = place.pop()!;
  const area = place.join(', ');
  const known = lookupPin(pin);
  return {
    ...base,
    flatNo,
    building,
    street,
    area,
    pin,
    city: KNOWN_CITIES.test(city) ? DEFAULT_CITY : city || known?.city || '',
    state: known?.state ?? DEFAULT_STATE,
  };
}

/**
 * Inline validation. Required: house / flat, a building or a street, area, a 6-digit PIN, city and
 * state; with "Ordering for someone else" on, their name and a valid +91 mobile.
 */
export function validateAddressFields(f: AddressFields): AddressFieldErrors {
  const errors: AddressFieldErrors = {};
  if (!clean(f.flatNo)) errors.flatNo = 'Add the house or flat number';
  if (!clean(f.building) && !clean(f.street)) errors.building = 'Add a building or street';
  if (!clean(f.area)) errors.area = 'Add the area';
  if (!clean(f.pin)) errors.pin = 'Add the PIN code';
  else if (!isValidPin(f.pin)) errors.pin = 'Enter a 6-digit PIN code';
  if (!clean(f.city)) errors.city = 'Add the city';
  if (!clean(f.state)) errors.state = 'Add the state';
  if (f.forSomeoneElse) {
    if (!clean(f.contactName)) errors.contactName = 'Add their name';
    if (!clean(f.contactPhone)) errors.contactPhone = 'Add their mobile number';
    else if (!isValidPhone(f.contactPhone)) errors.contactPhone = 'Enter a 10-digit mobile number';
  }
  return errors;
}

export function firstInvalidField(errors: AddressFieldErrors): AddressFieldKey | undefined {
  return ADDRESS_FIELD_ORDER.find((k) => errors[k]);
}

/** The first problem, top to bottom (the hint above a disabled "Save address" bar). */
export function firstAddressError(errors: AddressFieldErrors): string | undefined {
  const key = firstInvalidField(errors);
  return key ? errors[key] : undefined;
}

/** Same form contents, ignoring spacing at the ends (unsaved-changes check). */
export function sameFields(a: AddressFields, b: AddressFields): boolean {
  const keys = Object.keys(a) as (keyof AddressFields)[];
  return keys.every((k) => {
    const x = a[k];
    const y = b[k];
    return typeof x === 'string' && typeof y === 'string' ? clean(x) === clean(y) : x === y;
  });
}

/** The PIN as typed (digits only, at most 6); a Bengaluru PIN fills in the city and state. */
export function withPin(f: AddressFields, typed: string): AddressFields {
  const pin = typed.replace(/\D/g, '').slice(0, 6);
  const known = lookupPin(pin);
  return known ? { ...f, pin, city: known.city, state: known.state } : { ...f, pin };
}

/** True when the area or city triggers the out-of-range demo (Nandi Hills, Mysuru). */
export function isOutOfRangeDemo(f: Pick<AddressFields, 'area' | 'city'>): boolean {
  return OUT_OF_RANGE_DEMO.test(`${f.area} ${f.city}`);
}

/** The saved address's display and structured fields (no id or coordinates: see `addressFromFields`). */
export type ComposedAddress = Pick<Address, 'label' | 'kind' | 'line1' | 'line2' | 'city' | 'notes' | 'parts' | 'contactName' | 'contactPhone'>;

export function composeAddress(f: AddressFields): ComposedAddress {
  const optional = (s: string) => clean(s) || undefined;
  const parts: AddressParts = {
    flatNo: clean(f.flatNo),
    building: optional(f.building),
    street: optional(f.street),
    landmark: optional(f.landmark),
    area: clean(f.area),
    city: clean(f.city),
    state: clean(f.state),
    pin: clean(f.pin),
  };
  const contact = f.forSomeoneElse && clean(f.contactName) && clean(f.contactPhone);
  return {
    kind: f.kind,
    label: addressLabel(f.kind, f.otherName),
    line1: partsLine1(parts),
    line2: landmarkLine(parts.landmark),
    city: partsCityLine(parts),
    notes: optional(f.notes),
    parts,
    contactName: contact ? clean(f.contactName) : undefined,
    contactPhone: contact ? nationalPhone(f.contactPhone) : undefined,
  };
}

/** Same place for coordinates: the area, city and PIN didn't change (case and spacing aside). */
export function sameLocation(a: Pick<AddressFields, 'area' | 'city' | 'pin'>, b: Pick<AddressFields, 'area' | 'city' | 'pin'>): boolean {
  const key = (f: Pick<AddressFields, 'area' | 'city' | 'pin'>) => [f.area, f.city, f.pin].map((s) => clean(s).toLowerCase()).join('|');
  return key(a) === key(b);
}

/** "For Priya · +91 98765 43210" when someone else takes the delivery. */
export function receiverLine(a: Pick<Address, 'contactName' | 'contactPhone'>): string | undefined {
  const name = clean(a.contactName);
  if (!name) return undefined;
  return [`For ${name}`, displayPhone(a.contactPhone)].filter(Boolean).join(' · ');
}

/**
 * Saved addresses from before the structured form that are still the untouched demo seeds (same
 * id, no `parts`: there was no way to edit an address back then) become today's structured seeds,
 * so a device that ran an earlier v2 build shows the landmark and labels without a reset. Anything
 * else, and anything already structured, is returned as is. Returns the same array when nothing
 * changed.
 */
export function upgradeLegacySeeds(saved: Address[], seeds: readonly Address[]): Address[] {
  let changed = false;
  const next = saved.map((a) => {
    const seed = a.parts ? undefined : seeds.find((s) => s.id === a.id && s.parts);
    if (!seed) return a;
    changed = true;
    return seed;
  });
  return changed ? next : saved;
}

/** Replaces one saved address in place (same position in the list). */
export function replaceAddress(list: readonly Address[], next: Address): Address[] {
  return list.map((a) => (a.id === next.id ? next : a));
}

/**
 * Who gets selected after `removedId` is deleted: the current selection when it survives, else the
 * first remaining address we deliver to (`deliverable`), else nothing.
 */
export function selectionAfterRemove(
  list: readonly Address[],
  removedId: string,
  selectedId: string | undefined,
  deliverable: (a: Address) => boolean,
): string | undefined {
  if (selectedId && selectedId !== removedId && list.some((a) => a.id === selectedId)) return selectedId;
  return list.find((a) => a.id !== removedId && deliverable(a))?.id;
}
