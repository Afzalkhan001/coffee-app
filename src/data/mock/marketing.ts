import { brand, SPEND_PER_POINT } from '@/theme/brand';
import type { Address, Coupon, PaymentMethod, Promotion, Reward } from '@/types/models';
import { PHOTOS } from './photos';

export const PROMOTIONS: Promotion[] = [
  {
    id: 'promo-first',
    title: '20% off your\nfirst order',
    subtitle: 'Welcome to Ember Roast. Offer ends Sunday.',
    code: 'FIRST20',
    cta: 'Order now',
    image: PHOTOS.icedLatte,
    theme: 'ember',
    target: { type: 'menu' },
  },
  {
    id: 'promo-spanish',
    title: 'New:\nSpanish Latte',
    subtitle: 'Double ristretto, condensed milk. Limited run.',
    cta: 'Try it',
    image: PHOTOS.spanishLatte,
    theme: 'espresso',
    target: { type: 'product', id: 'spanish-latte' },
  },
  {
    id: 'promo-matcha',
    title: 'Matcha\nseason',
    subtitle: 'Ceremonial Uji matcha, whisked to order.',
    cta: 'Explore',
    image: PHOTOS.matchaLatte,
    theme: 'sage',
    target: { type: 'category', id: 'tea' },
  },
];

/**
 * Shown in place of a first-order promo once the customer has an order (FIRST20 would be refused at
 * checkout), so the banner always advertises a code the viewer can actually use.
 */
export const REGULAR_PROMOTION: Promotion = {
  id: 'promo-regular',
  title: '10% off your\nnext order',
  subtitle: 'Thanks for coming back. Offer ends Sunday.',
  code: 'WELCOME10',
  cta: 'Order now',
  image: PHOTOS.icedLatte,
  theme: 'ember',
  target: { type: 'menu' },
};

/** Coupon values, caps and minimums are whole rupees (₹). */
export const COUPONS: Coupon[] = [
  { code: 'FIRST20', description: '20% off your first order (up to ₹150)', type: 'percent', value: 20, maxDiscount: 150, isActive: true },
  { code: 'EMBER100', description: '₹100 off orders of ₹500 or more', type: 'fixed', value: 100, minSubtotal: 500, isActive: true },
  { code: 'WELCOME10', description: '10% off', type: 'percent', value: 10, isActive: true },
  { code: 'SUMMER25', description: 'Summer special', type: 'percent', value: 25, isActive: false },
];

/** Codes limited to a customer's first confirmed order. */
export const FIRST_ORDER_COUPONS: ReadonlySet<string> = new Set(['FIRST20']);

/**
 * Item rewards and the categories they apply to (capped at the cheapest eligible item). Rewards
 * not listed here (₹500 off) apply to the whole order. `noun` completes "Add … to use this reward".
 */
export const REWARD_ELIGIBILITY: Readonly<Record<string, { categoryIds: readonly string[]; noun: string }>> = {
  'rw-shot': { categoryIds: ['coffee', 'tea', 'cold'], noun: 'a drink' },
  'rw-pastry': { categoryIds: ['bakery'], noun: 'a pastry' },
  'rw-drink': { categoryIds: ['coffee', 'tea', 'cold'], noun: 'a drink' },
};

/** `value` is the most a reward takes off, in ₹ (item rewards are capped at the cheapest eligible item). */
export const REWARDS: Reward[] = [
  { id: 'rw-shot', name: 'Free extra shot', description: 'Add a shot to any drink', cost: 150, image: PHOTOS.espresso, value: 50 },
  { id: 'rw-pastry', name: 'Any pastry', description: 'Croissant, cookie or bread', cost: 400, image: PHOTOS.croissant, value: 180 },
  { id: 'rw-drink', name: 'Any drink', description: 'Any size, any milk', cost: 600, image: PHOTOS.caramelMacchiato, value: 300 },
  { id: 'rw-500off', name: '₹500 off', description: 'Treat the whole table', cost: 1000, image: PHOTOS.cookie, value: 500 },
];

/**
 * Demo saved addresses (Bengaluru, around the Indiranagar café), in the structured Indian form.
 * `line1` / `line2` / `city` are the display lines `composeAddress()` (`src/lib/address.ts`) derives
 * from `parts` (a test keeps them in step). "Nandi Hills cottage" is ~45 km out, beyond the 5 km
 * delivery radius, on purpose (the "No delivery to this address" state).
 */
export const SEED_ADDRESSES: Address[] = [
  {
    id: 'addr-home',
    kind: 'home',
    label: 'Home',
    line1: 'Flat 4B, Sunrise Residency, 6th Cross',
    line2: 'Near Domlur Flyover',
    city: 'Domlur, Bengaluru 560071',
    notes: 'Ring 4B, leave with security',
    parts: {
      flatNo: 'Flat 4B',
      building: 'Sunrise Residency',
      street: '6th Cross',
      landmark: 'Domlur Flyover',
      area: 'Domlur',
      city: 'Bengaluru',
      state: 'Karnataka',
      pin: '560071',
    },
    lat: 12.961,
    lng: 77.6387,
  },
  {
    id: 'addr-work',
    kind: 'work',
    label: 'Work',
    line1: 'Level 3, Prestige Tower, Residency Rd',
    city: 'Ashok Nagar, Bengaluru 560025',
    parts: {
      flatNo: 'Level 3',
      building: 'Prestige Tower',
      street: 'Residency Rd',
      area: 'Ashok Nagar',
      city: 'Bengaluru',
      state: 'Karnataka',
      pin: '560025',
    },
    lat: 12.9718,
    lng: 77.6062,
  },
  {
    id: 'addr-cabin',
    kind: 'other',
    label: 'Nandi Hills cottage',
    line1: 'Survey No. 9, Nandi Hills Rd',
    city: 'Nandi Hills, Chikkaballapur 562103',
    parts: {
      flatNo: 'Survey No. 9',
      street: 'Nandi Hills Rd',
      area: 'Nandi Hills',
      city: 'Chikkaballapur',
      state: 'Karnataka',
      pin: '562103',
    },
    lat: 13.3702,
    lng: 77.6835,
  },
];

/**
 * Simulated payment methods, UPI first (how most of India pays): four UPI apps (shown as text with a
 * tinted monogram, never their logos), "Pay with UPI ID", two saved cards plus a simulated "Add new
 * card", then cash on delivery (delivery only) or pay at the counter (pickup, dine-in, in-car).
 * No Apple Pay (not available in India); Google Pay is a UPI app. `availableMethods(mode)`
 * (components/checkout/payment.ts) filters this per mode. Nothing here moves real money.
 */
export const PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'pm-gpay', type: 'upi', label: 'Google Pay', upiApp: 'gpay' },
  { id: 'pm-phonepe', type: 'upi', label: 'PhonePe', upiApp: 'phonepe' },
  { id: 'pm-paytm', type: 'upi', label: 'Paytm', upiApp: 'paytm' },
  { id: 'pm-bhim', type: 'upi', label: 'BHIM', upiApp: 'bhim' },
  { id: 'pm-upi-id', type: 'upi', label: 'Pay with UPI ID' },
  { id: 'pm-card', type: 'card', label: 'Visa', brand: 'visa', last4: '4242' },
  { id: 'pm-rupay', type: 'card', label: 'RuPay', brand: 'rupay', last4: '6011' },
  { id: 'pm-card-new', type: 'card', label: 'Add new card', brand: 'new' },
  { id: 'pm-cod', type: 'cod', label: 'Cash on delivery' },
  { id: 'pm-store', type: 'pay_at_store', label: 'Pay at the counter' },
];

/** The café's UPI ID that collect requests come from (simulated). */
export const MERCHANT_VPA = 'emberroast@icici';

export const HELP_FAQ: { q: string; a: string }[] = [
  { q: 'How long does my order take?', a: 'Most drinks are ready in 6–10 minutes. Delivery usually arrives within 25–35 minutes.' },
  { q: 'Can I change my order after placing it?', a: 'You can cancel while your order is “Placed” or “Accepted”. Once we start preparing it, please contact the café.' },
  { q: 'How do I earn points?', a: `You earn 1 point for every ${brand.currency.symbol}${SPEND_PER_POINT} spent. Points are added when your order is completed.` },
  { q: 'What is In-Car pickup?', a: 'Park in a marked bay, tap “I’m here” in the app, and a barista will bring your order to your car.' },
  { q: 'Do you have dairy-free options?', a: 'Yes — oat, almond and soy milk are available for every milk-based drink.' },
];
