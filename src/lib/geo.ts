import { brand } from '@/theme/brand';

const R_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in km (haversine). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function distanceFromStoreKm(point: { lat: number; lng: number }): number {
  return distanceKm(point, { lat: brand.store.lat, lng: brand.store.lng });
}

export function isDeliverable(point: { lat: number; lng: number }): boolean {
  return distanceFromStoreKm(point) <= brand.store.deliveryRadiusKm;
}

export function formatKm(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

// ── Simulated geocoder (no network) ──────────────────────────────────────────

/** A Bengaluru neighbourhood around the café: its name, PIN code and a centre point. */
export interface Locality {
  area: string;
  pin: string;
  lat: number;
  lng: number;
  /** Other spellings people type ("Halasuru" for Ulsoor). */
  aliases?: readonly string[];
}

/**
 * Neighbourhoods inside the 5 km delivery radius (all within ~4.1 km of the café), standing in for
 * reverse geocoding: "Use current location" names the nearest one, and a typed area or PIN that
 * matches one is placed there.
 */
export const LOCALITIES: readonly Locality[] = [
  { area: 'Indiranagar', pin: '560038', lat: 12.9784, lng: 77.6408, aliases: ['indira nagar'] },
  { area: 'HAL 2nd Stage', pin: '560008', lat: 12.969, lng: 77.646, aliases: ['hal ii stage', 'hal second stage'] },
  { area: 'Domlur', pin: '560071', lat: 12.961, lng: 77.6387 },
  { area: 'Ulsoor', pin: '560008', lat: 12.9817, lng: 77.6265, aliases: ['halasuru', 'ulsoor lake'] },
  { area: 'Jeevan Bima Nagar', pin: '560075', lat: 12.965, lng: 77.658, aliases: ['jb nagar'] },
  { area: 'Murugeshpalya', pin: '560017', lat: 12.9563, lng: 77.656 },
  { area: 'CV Raman Nagar', pin: '560093', lat: 12.9855, lng: 77.663, aliases: ['c v raman nagar', 'cv raman'] },
  { area: 'Cox Town', pin: '560005', lat: 12.996, lng: 77.6185 },
  { area: 'Ejipura', pin: '560047', lat: 12.9445, lng: 77.625 },
  { area: 'Ashok Nagar', pin: '560025', lat: 12.9718, lng: 77.6062, aliases: ['residency road', 'residency rd'] },
  { area: 'MG Road', pin: '560001', lat: 12.975, lng: 77.607, aliases: ['m g road', 'mahatma gandhi road'] },
  { area: 'Koramangala', pin: '560034', lat: 12.938, lng: 77.626 },
];

/** How far a fix may be from the nearest known locality and still be named after it. */
export const LOCALITY_MATCH_KM = 2;

/** The known locality nearest to a point, with its distance in km. */
export function nearestLocality(point: { lat: number; lng: number }): { locality: Locality; km: number } {
  let best = { locality: LOCALITIES[0]!, km: Number.POSITIVE_INFINITY };
  for (const locality of LOCALITIES) {
    const km = distanceKm(point, locality);
    if (km < best.km) best = { locality, km };
  }
  return best;
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * A known locality by typed area ("Koramangala 4th Block", "halasuru") or, failing that, by PIN code.
 * Matching is by whole words, so "Domlur Layout" finds Domlur but "Indira" finds nothing.
 */
export function findLocality(query: { area?: string; pin?: string }): Locality | undefined {
  const area = ` ${squash(query.area ?? '')} `;
  if (area.trim()) {
    const hit = LOCALITIES.find((l) => [l.area, ...(l.aliases ?? [])].some((name) => area.includes(` ${squash(name)} `)));
    if (hit) return hit;
  }
  const pin = query.pin?.trim();
  return pin ? LOCALITIES.find((l) => l.pin === pin) : undefined;
}
