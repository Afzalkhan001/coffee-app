/**
 * Short counter code derived from the order number ("ER-4827" → "N27"). Shown big on the
 * confirmation and tracking screens for pickup / in-car / dine-in, so both MUST use this helper.
 */
import type { OrderMode } from '@/types/models';

// No I / O / Q: they read as digits on a busy counter.
const CODE_LETTERS = 'ABCDEFGHJKLMNPRSTUVWXYZ';

/** Small stable string hash (djb2): deterministic codes and names from ids. */
export function hashString(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
  return h;
}

export function pickupCode(orderNumber: string): string {
  const digits = Number.parseInt(orderNumber.replace(/\D/g, ''), 10);
  const n = Number.isFinite(digits) ? digits : hashString(orderNumber);
  const letter = CODE_LETTERS[Math.floor(n / 100) % CODE_LETTERS.length] ?? 'A';
  return `${letter}${String(n % 100).padStart(2, '0')}`;
}

/** Delivery orders don't need a counter code. */
export function usesPickupCode(mode: OrderMode): boolean {
  return mode !== 'delivery';
}
