/**
 * Builds mock `Address` records for the prototype (no geocoding backend). Coordinates come from the
 * simulated geocoder in `@/lib/geo`: a typed area or PIN that names a known neighbourhood is placed
 * there, anything else lands within ~3 km of the Indiranagar café, and an area or city mentioning
 * "Nandi" (Hills) or "Mysuru" (also "Mysore") lands 24–38 km out so the out-of-range state can be
 * demoed. "Use current location" names the nearest known neighbourhood instead of reverse
 * geocoding, and a GPS fix far from the café (> 60 km, e.g. outside Bengaluru) is moved next to it.
 */
import {
  DEFAULT_CITY,
  DEFAULT_STATE,
  composeAddress,
  fieldsFromAddress,
  isOutOfRangeDemo,
  OUT_OF_RANGE_DEMO,
  sameLocation,
  type AddressFields,
} from '@/lib/address';
import { uid } from '@/lib/format';
import { distanceFromStoreKm, findLocality, LOCALITY_MATCH_KM, nearestLocality } from '@/lib/geo';
import { brand } from '@/theme/brand';
import type { Address } from '@/types/models';

const KM_PER_DEG_LAT = 111.32;
/** GPS fixes farther than this from the café are treated as "demo, somewhere else in the world". */
export const DEMO_SNAP_KM = 60;
/** A typed address in a known neighbourhood lands within this of its centre. */
const LOCALITY_JITTER_KM = 0.25;

type Point = { lat: number; lng: number };

/** A point at a random bearing, between `minKm` and `maxKm` from `center` (default: the café). */
function pointNear(minKm: number, maxKm: number, center: Point = brand.store): Point {
  const bearing = Math.random() * Math.PI * 2;
  const km = minKm + Math.random() * (maxKm - minKm);
  const lat = center.lat + (km * Math.cos(bearing)) / KM_PER_DEG_LAT;
  const lng = center.lng + (km * Math.sin(bearing)) / (KM_PER_DEG_LAT * Math.cos((center.lat * Math.PI) / 180));
  return { lat, lng };
}

/** Where "Use current location" put the customer, and what it filled in. */
export interface LocatedFix extends Point {
  /** The fields it pre-fills: area and PIN of the nearest known neighbourhood, city and state. */
  fill: Pick<AddressFields, 'area' | 'pin' | 'city' | 'state'>;
  /** The fix was more than 60 km out and was moved next to the café (demo anywhere). */
  snapped: boolean;
}

/**
 * Turns a GPS fix into form pre-fills (no reverse geocoding): a fix more than 60 km from the café is
 * moved next to it; the area and PIN come from the nearest known neighbourhood when it is within
 * 2 km of the fix (otherwise the customer types them), with Bengaluru, Karnataka.
 */
export function locateFix(pos: Point): LocatedFix {
  const snapped = distanceFromStoreKm(pos) > DEMO_SNAP_KM;
  const at = snapped ? pointNear(0.5, 1.8) : pos;
  const { locality, km } = nearestLocality(at);
  const named = km <= LOCALITY_MATCH_KM;
  return {
    lat: at.lat,
    lng: at.lng,
    snapped,
    fill: { area: named ? locality.area : '', pin: named ? locality.pin : '', city: DEFAULT_CITY, state: DEFAULT_STATE },
  };
}

/** Coordinates for a typed (or edited) address. */
function placeFields(fields: AddressFields, previous: Address | undefined, located: LocatedFix | undefined): Point {
  // An edit that kept the area, city and PIN keeps its point (the distance doesn't jump about).
  if (previous && sameLocation(fieldsFromAddress(previous), fields)) return { lat: previous.lat, lng: previous.lng };
  // "Use current location" filled these in and they weren't changed: the real (or snapped) fix.
  if (located && sameLocation(located.fill, fields)) return { lat: located.lat, lng: located.lng };
  if (isOutOfRangeDemo(fields)) return pointNear(24, 38);
  // A fix we couldn't name: the customer typed the area for that spot, so the fix stands.
  if (located && !located.fill.area) return { lat: located.lat, lng: located.lng };
  const locality = findLocality({ area: fields.area, pin: fields.pin });
  return locality ? pointNear(0, LOCALITY_JITTER_KM, locality) : pointNear(0.4, 3);
}

/**
 * A saved address from the structured form: display lines and parts from `composeAddress`, an id
 * (kept when editing `previous`) and coordinates (see `placeFields`).
 */
export function addressFromFields(fields: AddressFields, opts: { previous?: Address; located?: LocatedFix } = {}): Address {
  const { previous, located } = opts;
  const at = placeFields(fields, previous, located);
  return { id: previous?.id ?? uid('addr'), ...composeAddress(fields), lat: at.lat, lng: at.lng };
}

/**
 * @deprecated The pre-structured form's draft (street, flat, "area, city", PIN, notes). Kept for
 * older tests that still build addresses from it; new code uses `AddressFields`.
 */
export interface AddressDraft {
  label: string;
  street: string;
  apt: string;
  /** Area / locality and city ("Indiranagar, Bengaluru"). */
  city: string;
  /** Indian PIN code (6 digits, optional). */
  pin: string;
  notes: string;
}

/** @deprecated Builds an address without `parts` from an `AddressDraft`; new code uses `addressFromFields`. */
export function addressFromDraft(draft: AddressDraft): Address {
  const far = OUT_OF_RANGE_DEMO.test(draft.city);
  const pin = draft.pin.trim();
  const at = far ? pointNear(24, 38) : pointNear(0.4, 3);
  return {
    id: uid('addr'),
    label: draft.label,
    line1: draft.street.trim(),
    line2: draft.apt.trim() || undefined,
    // "Indiranagar, Bengaluru 560038": the PIN rides on the city line (Indian address order).
    city: [draft.city.trim(), pin].filter(Boolean).join(' '),
    notes: draft.notes.trim() || undefined,
    lat: at.lat,
    lng: at.lng,
  };
}
