/**
 * Store opening hours (brand.store.opensAtHour → closesAtHour, local time) and the demo override.
 * Pure: the demo store registers its `forceStoreOpen` flag here when it loads (no store import, so
 * lib/ stays free of persisted state).
 */
import { brand } from '@/theme/brand';

let readForceOpen: () => boolean = () => true;

/** Called by store/demo: where the "keep the store open for demos" flag lives. */
export function registerForceOpenReader(reader: () => boolean) {
  readForceOpen = reader;
}

const HOUR_MS = 3_600_000;

/** Today's opening and closing instants (epoch ms) for the day containing `now`. */
export function storeDayBounds(now: Date): { opens: number; closes: number } {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return { opens: midnight + brand.store.opensAtHour * HOUR_MS, closes: midnight + brand.store.closesAtHour * HOUR_MS };
}

/** Within real opening hours (ignores the demo override). */
export function isWithinHours(now = new Date()): boolean {
  const { opens, closes } = storeDayBounds(now);
  const t = now.getTime();
  return t >= opens && t < closes;
}

/** "9pm", "7:30am" for a 24h decimal hour. */
export function hourLabel(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 ? 'am' : 'pm'}`;
}

export type StoreStatus =
  | { open: true; forced: false; label: string }
  | { open: true; forced: true; label: string }
  | { open: false; forced: false; label: string };

/**
 * Open/closed status: "Open · until 9pm", "Closed · opens 7am", or — when the demo keeps the
 * store open outside its hours — "Open late (demo)".
 */
export function storeStatus(now = new Date(), forceOpen = readForceOpen()): StoreStatus {
  if (isWithinHours(now)) return { open: true, forced: false, label: `Open · until ${hourLabel(brand.store.closesAtHour)}` };
  if (forceOpen) return { open: true, forced: true, label: 'Open late (demo)' };
  return { open: false, forced: false, label: `Closed · opens ${hourLabel(brand.store.opensAtHour)}` };
}

/**
 * Latest pickup slot allowed for `now`: today's closing time while open within hours, unlimited when
 * the demo forces the store open, and null (no slots today) when closed.
 */
export function lastSlotAt(now = new Date(), forceOpen = readForceOpen()): number | null {
  if (isWithinHours(now)) return storeDayBounds(now).closes;
  return forceOpen ? Number.POSITIVE_INFINITY : null;
}
