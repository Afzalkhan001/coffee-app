/**
 * Placeholder brand — replace with the client's details (PRD §28).
 *
 * Market: India (Bengaluru). Money is whole Indian rupees end to end (`currency.decimals = 0`),
 * shown with Indian digit grouping (₹1,25,000); prices are GST-exclusive and GST is added at
 * checkout. Phone numbers are Indian mobiles (+91, 10 digits, see `lib/format.ts`).
 */
export const brand = {
  name: 'Ember Roast',
  fullName: 'Ember Roast Coffee',
  tagline: 'Small-batch coffee, baked daily.',
  /** The single source for money formatting and rounding (`formatMoney`, `roundMoney`, RollingNumber). */
  currency: { code: 'INR', symbol: '₹', locale: 'en-IN', decimals: 0 },
  /** GST on café food and drinks (restaurant service, no input tax credit). */
  taxRate: 0.05,
  /** Short label for the tax line: "GST (5%)". */
  taxLabel: 'GST',
  supportPhone: '+91 80 4718 2290',
  supportEmail: 'hello@emberroast.example',
  store: {
    id: 'store-main',
    name: 'Ember Roast — Indiranagar',
    shortName: 'Indiranagar',
    address: '12th Main Rd, HAL 2nd Stage, Indiranagar, Bengaluru 560038',
    distanceKm: 0.8,
    hours: 'Open · until 9:00 PM',
    closesAt: '9:00 PM',
    /** Opening hours, local time, 24h decimal (7 → 7:00 AM, 21 → 9:00 PM). Drives the open/closed
     * status and clamps pickup slots (lib/storeHours.ts). */
    opensAtHour: 7,
    closesAtHour: 21,
    lat: 12.9716,
    lng: 77.6412,
    deliveryRadiusKm: 5,
    /** ₹, whole rupees. */
    deliveryFee: 40,
    /** Delivery is free from this subtotal (₹) up. */
    freeDeliveryOver: 499,
    minPrepMinutes: 8,
    tables: ['Window bar', 'Patio', 'Lounge', 'Table 1', 'Table 2', 'Table 3', 'Table 4', 'Table 5', 'Table 6'],
  },
  loyalty: {
    /** Points per rupee: 0.2 = 1 pt for every ₹5 spent (floored per order). */
    pointsPerUnit: 0.2,
    welcomeBonus: 150,
  },
} as const;

/** "GST (5%)" */
export const TAX_LINE_LABEL = `${brand.taxLabel} (${Math.round(brand.taxRate * 100)}%)`;

/** Spend per loyalty point in rupees (₹5). */
export const SPEND_PER_POINT = Math.round(1 / brand.loyalty.pointsPerUnit);

/** "1 pt per ₹5" */
export const EARN_RATE_LABEL = `1 pt per ${brand.currency.symbol}${SPEND_PER_POINT}`;

/**
 * Rounds a money amount to the currency's minor unit (whole rupees for INR), half up (₹14.50 →
 * ₹15; symmetric for negatives, −₹14.50 → −₹15, and never −0). Every money computation goes
 * through it, so totals never drift and never show paise.
 */
export function roundMoney(n: number): number {
  const f = 10 ** brand.currency.decimals;
  const r = Math.round((Math.abs(n) + Number.EPSILON) * f) / f;
  return n < 0 && r !== 0 ? -r : r;
}

/** "1,25,000" — Indian digit grouping, `currency.decimals` fraction digits, no sign. */
export function formatAmount(value: number): string {
  const { decimals } = brand.currency;
  const fixed = roundMoney(Math.abs(value)).toFixed(decimals);
  const [int = '0', frac] = fixed.split('.');
  return `${groupIndian(int)}${frac ? `.${frac}` : ''}`;
}

/**
 * Indian (lakh/crore) grouping of a digit string: "125000" → "1,25,000". Implemented by hand rather
 * than with `toLocaleString('en-IN')` because Hermes builds without full ICU fall back to Western
 * grouping ("125,000").
 */
export function groupIndian(int: string): string {
  if (int.length <= 3) return int;
  const head = int.slice(0, -3);
  return `${head.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${int.slice(-3)}`;
}

/** "₹250", "₹1,250", "₹1,25,000"; negatives with a typographic minus ("−₹40", like the discount rows). */
export function formatMoney(value: number): string {
  const rounded = roundMoney(value);
  const sign = rounded < 0 ? '−' : '';
  return `${sign}${brand.currency.symbol}${formatAmount(rounded)}`;
}
