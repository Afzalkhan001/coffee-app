/**
 * Pure helpers for the sign-in flow (phone → OTP → profile).
 *
 * Phone numbers are stored as the bare 10-digit Indian mobile number ("9876543210"): that is what
 * goes to `sendOtp`/`verifyOtp`, `session.signIn` and `profile.phone`. `formatPhone()` renders it
 * as "98765 43210" while typing, and `displayPhone()` adds the +91 dial code everywhere else.
 */
import { displayPhone as displayAnyPhone, formatPhone, nationalPhone, PHONE_DIAL, PHONE_LENGTH } from '@/lib/format';

/** The prototype ships one market (India); the chip is still shown so the layout is ready for more. */
export const COUNTRY = { iso: 'IN', dial: PHONE_DIAL } as const;
/** National number length for the market above. */
export const PHONE_DIGITS = PHONE_LENGTH;

/**
 * Keeps digits only, drops a pasted country code or trunk zero ("+91 98765 43210" or
 * "098765 43210" → "9876543210") and caps the length.
 */
export function phoneDigits(raw: string): string {
  return nationalPhone(raw).slice(0, PHONE_DIGITS);
}

/**
 * How many raw digits the field may hold before the number is complete: a 10-digit mobile behind
 * "0091" (14), "91" + trunk "0" (13), "91" (12) or a trunk "0" (11). "0" / "00" / "009" may still
 * be the start of "0091", so they keep room for it.
 */
function inputCap(d: string): number {
  if (d.startsWith('0091') || d === '0' || d === '00' || d === '009') return PHONE_DIGITS + 4;
  if (d.startsWith('0')) return PHONE_DIGITS + 1;
  if (d.startsWith('910')) return PHONE_DIGITS + 3;
  if (d.startsWith('91')) return PHONE_DIGITS + 2;
  return PHONE_DIGITS;
}

/**
 * The phone field's state while typing. Plain numbers cap at 10 digits; a number typed with its
 * country code or trunk zero keeps those extra digits until it is complete, then collapses to the
 * national number. (Capping at 10 straight away left "919876543210" stuck at "91987 65432", a valid
 * but wrong number.) A 10-digit "91…" stays as typed: it is a real mobile number too.
 */
export function phoneInput(raw: string): string {
  const d = raw.replace(/\D/g, '');
  const cap = inputCap(d);
  const kept = d.slice(0, cap);
  return kept.length === cap && cap > PHONE_DIGITS ? nationalPhone(kept) : kept;
}

/** What the field shows for `phoneInput()` state: "98765 43210", or the raw digits while a prefix is still being typed. */
export function formatPhoneInput(digits: string): string {
  return digits.length > PHONE_DIGITS ? digits : formatPhone(digits);
}

/** "+91 98765 43210" */
export function displayPhone(digits: string): string {
  return displayAnyPhone(digits);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/** 83_000 → "1:23" (rounded up, never negative). */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** Shared promise helpers (re-exported here for the sign-in flow). */
export { attempt, withTimeout, type Attempt } from '@/lib/async';
