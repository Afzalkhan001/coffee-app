import { groupIndian } from '@/theme/brand';
import { lastSlotAt, storeDayBounds } from './storeHours';

export { formatMoney } from '@/theme/brand';

/**
 * A whole count (points, quantities) with Indian digit grouping: 2300 → "2,300", 125000 →
 * "1,25,000". Used instead of `toLocaleString()`, which follows the device locale (and Hermes
 * without full ICU), so every number in the app groups the same way as the ₹ amounts.
 */
export function formatCount(n: number): string {
  const v = Math.round(Number.isFinite(n) ? n : 0);
  return `${v < 0 ? '−' : ''}${groupIndian(String(Math.abs(v)))}`;
}

let counter = 0;
/** Collision-resistant enough for a mock layer. */
export function uid(prefix = 'id'): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function orderNumber(): string {
  return `ER-${Math.floor(1000 + Math.random() * 9000)}`;
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function firstName(name?: string): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? '';
}

/** "Ava Stone" → "AS"; '' when the name has no letters (Avatar then draws a line-art cup). */
export function initials(name?: string): string {
  const parts = (name ?? '').trim().split(/\s+/).filter((p) => /\p{L}/u.test(p));
  const letter = (p?: string) => (p ? (p.match(/\p{L}/u)?.[0] ?? '') : '');
  return (letter(parts[0]) + letter(parts[1])).toUpperCase();
}

// ── Phone numbers (India: +91, 10-digit mobiles) ─────────────────────────────
// Stored everywhere (session.phone, profile.phone, order.customer.phone, OTP) as the bare 10-digit
// national number ("9876543210"); shown as "+91 98765 43210" (`displayPhone`).

/** Country calling code for the one market the prototype ships. */
export const PHONE_DIAL = '+91';
/** National mobile number length. */
export const PHONE_LENGTH = 10;

/** Bare digits of a phone number ("98765 43210" → "9876543210"). */
export function phoneDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

/**
 * The 10-digit national number: digits only, minus a leading country code ("+91 98765 43210",
 * "919876543210", "0091 98765 43210", also "+91 098765 43210") or trunk zero ("098765 43210").
 * Anything else is returned as bare digits.
 */
export function nationalPhone(raw: string): string {
  let d = phoneDigits(raw);
  // International access prefix "00" before the country code.
  if (d.length > PHONE_LENGTH + 2 && d.startsWith('0091')) d = d.slice(2);
  if (d.length === PHONE_LENGTH + 2 && d.startsWith('91')) return d.slice(2);
  if (d.length === PHONE_LENGTH + 3 && d.startsWith('910')) return d.slice(3);
  if (d.length === PHONE_LENGTH + 1 && d.startsWith('0')) return d.slice(1);
  return d;
}

/** "98765 43210" (Indian 5 + 5 grouping) from a national number, also while it's being typed. */
export function formatPhone(raw: string): string {
  const d = nationalPhone(raw).slice(0, PHONE_LENGTH);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)} ${d.slice(5)}`;
}

/** A valid Indian mobile: exactly 10 digits starting with 6, 7, 8 or 9 (a +91 / 0 prefix is fine). */
export function isValidPhone(raw: string): boolean {
  return /^[6-9]\d{9}$/.test(nationalPhone(raw));
}

/** "+91 98765 43210" for any stored or typed form; '' for nothing. Non-Indian lengths show as typed digits. */
export function displayPhone(raw: string | null | undefined): string {
  if (!raw) return '';
  const d = nationalPhone(raw);
  if (!d) return '';
  return d.length === PHONE_LENGTH ? `${PHONE_DIAL} ${formatPhone(d)}` : `${raw.trim().startsWith('+') ? '+' : ''}${d}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/**
 * "28 Sep 2026": day-first like Indian receipts (and the legal pages' "1 October 2026"), built by
 * hand so a phone set to English (US), or Hermes without full ICU, doesn't print "Sep 28, 2026".
 */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)} · ${formatTime(iso)}`;
}

export function relativeDay(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return formatDate(iso);
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Slot instants on the fixed grid (shared by `pickupSlots` and `effectivePickupTime`). */
function slotTimes(count: number, stepMin: number, minLeadMin: number, now: Date): { asap: boolean; times: number[] } {
  const step = stepMin * 60_000;
  const lead = minLeadMin * 60_000;
  const last = lastSlotAt(now);
  let first = Math.ceil((now.getTime() + lead) / step) * step;
  let limit = last ?? Number.POSITIVE_INFINITY;
  if (last === null) {
    // Closed: schedule from the next opening (later today if before opening, otherwise tomorrow).
    const today = storeDayBounds(now);
    const opens = now.getTime() < today.opens ? today.opens : storeDayBounds(new Date(now.getTime() + 86_400_000)).opens;
    first = Math.ceil((opens + lead) / step) * step;
    limit = storeDayBounds(new Date(opens)).closes;
  }
  const times: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = first + i * step;
    if (t > limit) break;
    times.push(t);
  }
  return { asap: last !== null, times };
}

/**
 * Pickup time slots on a FIXED grid (every `stepMin` minutes on the clock, starting at least
 * `minLeadMin` from now), so a slot's id stays the same until it expires instead of drifting every
 * 5 minutes. Slots never run past closing time; while the store is closed there is no ASAP and the
 * slots start at the next opening ("Tomorrow, 7:10 AM").
 */
export function pickupSlots(count = 6, stepMin = 10, minLeadMin = 10, now = new Date()): { id: string; label: string }[] {
  const { asap, times } = slotTimes(count, stepMin, minLeadMin, now);
  const todayKey = now.toDateString();
  const slots = times.map((ms) => {
    const t = new Date(ms);
    const time = t.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return { id: t.toISOString(), label: t.toDateString() === todayKey ? time : `Tomorrow, ${time}` };
  });
  return asap ? [{ id: 'asap', label: 'ASAP' }, ...slots] : slots;
}

/**
 * The pickup time an order will really use: the stored value when it is still one of the offered
 * slots, otherwise the first offered option (ASAP while open). Keeps a stale or off-grid stored slot
 * from being placed silently while the chips show ASAP.
 */
export function effectivePickupTime(stored: 'asap' | string | undefined, now = new Date()): 'asap' | string {
  const { asap, times } = slotTimes(6, 10, 10, now);
  if (stored === 'asap' && asap) return 'asap';
  if (stored && stored !== 'asap') {
    const t = new Date(stored).getTime();
    if (times.includes(t)) return new Date(t).toISOString();
  }
  if (asap) return 'asap';
  return times[0] !== undefined ? new Date(times[0]).toISOString() : 'asap';
}
