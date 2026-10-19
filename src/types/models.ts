/**
 * Domain models. Names mirror the PRD §22 database entities so the mock
 * layer (src/api) can later be swapped for Supabase without touching screens.
 */
import type { HeroTint } from '@/theme';

export type ID = string;

export type OrderMode = 'dine_in' | 'pickup' | 'in_car' | 'delivery';

export type DietaryTag = 'vegan' | 'vegetarian' | 'gluten_free' | 'dairy_free' | 'nut_free' | 'contains_nuts' | 'low_cal';

/**
 * Indian diet mark (FSSAI convention, `VegMark`): `veg` (green square, filled circle), `egg`
 * (contains egg: amber square, filled circle) or `nonveg` (brown square, filled triangle).
 */
export type Diet = 'veg' | 'egg' | 'nonveg';

export interface Store {
  id: ID;
  name: string;
  address: string;
  lat: number;
  lng: number;
  deliveryRadiusKm: number;
  isOpen: boolean;
}

export interface Category {
  id: ID;
  name: string;
  /** Ionicons glyph name used on category tiles. */
  icon: string;
  tint: HeroTint;
  sortOrder: number;
}

export type SelectionType = 'single' | 'multi';

export interface ModifierOption {
  id: ID;
  groupId: ID;
  name: string;
  /** Short label for compact UIs (e.g. size circles: "S"). */
  shortName?: string;
  priceDelta: number;
  isDefault?: boolean;
  isAvailable: boolean;
  /** Optional calorie delta for the kcal badge. */
  kcalDelta?: number;
  /** Secondary caption, e.g. "12 oz · 355 ml" under a size circle. */
  caption?: string;
}

export interface ModifierGroup {
  id: ID;
  name: string;
  /** How the group is rendered in product detail. */
  display: 'size_circles' | 'list';
  selectionType: SelectionType;
  required: boolean;
  min: number;
  max: number;
  options: ModifierOption[];
}

/** Join table: which reusable groups a product uses, and in which order. */
export interface ProductModifierGroup {
  productId: ID;
  groupId: ID;
  sortOrder: number;
}

export type ProductBadge = 'best_seller' | 'new' | 'seasonal';

export interface Product {
  id: ID;
  categoryId: ID;
  name: string;
  description: string;
  /** Curated one-liner for list rows (≤ 26 characters, never truncated): "Espresso, steamed milk". */
  tagline?: string;
  /** Longer copy for the detail sheet. */
  story?: string;
  price: number;
  /** If set, the product is on sale: shows struck-through compareAtPrice. */
  compareAtPrice?: number;
  image: string;
  kcal?: number;
  dietary: DietaryTag[];
  /** Diet mark. Optional (additive): without one no mark shows and "Veg only" never counts it as veg. */
  diet?: Diet;
  badge?: ProductBadge;
  isFeatured: boolean;
  isPopular: boolean;
  isAvailable: boolean;
  allowsInstructions: boolean;
  /** Approx prep time in minutes. */
  prepMinutes: number;
  /** Coffee details for the detail sheet (roast meter, taste bars, tasting notes). */
  coffee?: {
    origin: string;
    roast: 1 | 2 | 3 | 4 | 5;
    notes: string[];
    acidity: number;
    body: number;
    sweetness: number;
  };
  /** Average rating 1–5 and number of ratings (food-ordering cue). */
  rating: number;
  ratingCount: number;
}

/** product + its resolved modifier groups, ready for the detail screen. */
export interface ProductWithModifiers extends Product {
  modifierGroups: ModifierGroup[];
}

/** groupId → selected optionIds */
export type Selections = Record<ID, ID[]>;

/** A frozen copy of a selected option, stored with cart/order lines. */
export interface SelectedModifierSnapshot {
  groupId: ID;
  groupName: string;
  optionId: ID;
  optionName: string;
  shortName?: string;
  priceDelta: number;
}

export interface CartItem {
  /** Unique line id. */
  id: ID;
  productId: ID;
  name: string;
  image: string;
  basePrice: number;
  quantity: number;
  modifiers: SelectedModifierSnapshot[];
  instructions?: string;
  /** Stable hash of product + modifiers + instructions — used to merge identical lines. */
  configKey: string;
}

/** "Save as" kind of a saved address. `Address.label` stays the display name. */
export type AddressKind = 'home' | 'work' | 'other';

/**
 * A structured Indian address, house to PIN. `Address.line1` / `line2` / `city` are derived from it
 * (`src/lib/address.ts`): "Flat 4B, Sunrise Residency, 6th Cross" / "Near Domlur Flyover" /
 * "Domlur, Bengaluru 560071".
 */
export interface AddressParts {
  /** House / flat / floor no. ("Flat 4B"). */
  flatNo: string;
  /** Building / apartment name ("Sunrise Residency"). */
  building?: string;
  /** Street / road ("6th Cross"). */
  street?: string;
  /** Nearby landmark as typed ("Domlur Flyover"), shown as "Near Domlur Flyover". */
  landmark?: string;
  /** Area / locality ("Domlur"). */
  area: string;
  /** City ("Bengaluru"). */
  city: string;
  /** State ("Karnataka"). */
  state: string;
  /** 6-digit PIN code ("560071"). */
  pin: string;
}

export interface Address {
  id: ID;
  /** Display name: "Home", "Work" or an Other address's own name ("Nandi Hills cottage"). */
  label: string;
  /** Display line 1 (derived from `parts` when present). */
  line1: string;
  /** Display line 2: the landmark for structured addresses; the flat for ones saved before them. */
  line2?: string;
  /** Display city line, "Domlur, Bengaluru 560071" (derived from `parts` when present). */
  city: string;
  notes?: string;
  lat: number;
  lng: number;
  /** Structured fields. Optional: addresses saved before the structured form carry only the display lines. */
  parts?: AddressParts;
  kind?: AddressKind;
  /** Receiver's details when someone else takes the delivery (phone: bare 10-digit mobile). */
  contactName?: string;
  contactPhone?: string;
}

export interface CarDetails {
  make: string;
  color: string;
  plate: string;
}

export interface OrderModeDetails {
  mode: OrderMode;
  table?: string;
  pickupTime?: 'asap' | string;
  car?: CarDetails;
  address?: Address;
}

export type OrderStatus =
  | 'placed'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'completed'
  | 'cancelled';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

/**
 * `upi` (an app or a UPI ID), `card`, `cod` (cash on delivery, delivery only) and `pay_at_store`
 * (pickup, dine-in, in-car). `apple_pay` / `google_pay` are legacy: orders saved by earlier builds
 * may still carry them, but they're no longer offered (Google Pay is now a UPI app).
 */
export type PaymentMethodType = 'card' | 'apple_pay' | 'google_pay' | 'pay_at_store' | 'upi' | 'cod';

/** UPI apps offered at checkout (shown as text + a tinted monogram, never their logos). */
export type UpiApp = 'gpay' | 'phonepe' | 'paytm' | 'bhim';

export interface PaymentMethod {
  id: ID;
  type: PaymentMethodType;
  label: string;
  last4?: string;
  brand?: string;
  /** `upi` methods that open an app; a `upi` method without one is "Pay with UPI ID". */
  upiApp?: UpiApp;
}

/**
 * How an order was (or will be) paid, frozen when it's placed; the reference fields are filled in
 * once the payment is approved. Optional on `Order`: orders saved before it only have `paymentMethod`.
 */
export interface OrderPayment {
  /** `PAYMENT_METHODS` id ("pm-phonepe", "pm-upi-id", "pm-rupay"). */
  methodId: ID;
  /** Display name: "PhonePe", "UPI · ava@okicici", "RuPay •••• 6011", "Cash on delivery". */
  label: string;
  upiApp?: UpiApp;
  /** The customer's UPI ID for a collect request ("ava@okicici"). */
  vpa?: string;
  /** Simulated 12-digit UPI reference number (UPI only), set on approval. */
  upiRef?: string;
  /** Simulated gateway transaction id ("TXN…"), set on approval. */
  txnId?: string;
  /** When the payment was approved (ISO). */
  paidAt?: string;
}

export interface Payment {
  id: ID;
  orderId: ID;
  amount: number;
  method: PaymentMethodType;
  status: PaymentStatus;
  createdAt: string;
}

export interface OrderItem {
  id: ID;
  productId: ID;
  name: string;
  image: string;
  basePrice: number;
  quantity: number;
  modifiers: SelectedModifierSnapshot[];
  instructions?: string;
  lineTotal: number;
}

export interface OrderTotals {
  subtotal: number;
  discount: number;
  tax: number;
  deliveryFee: number;
  /**
   * Packaging charge (₹15 for pickup, in-car and delivery; none for dine-in). GST applies to it.
   * Optional: totals saved before it existed have none (read it as 0).
   */
  packaging?: number;
  /** Delivery partner tip (delivery only): not taxed, not discountable. Optional like `packaging`. */
  tip?: number;
  /** subtotal − discount + packaging + tax + deliveryFee + tip. */
  total: number;
}

export interface OrderStatusEvent {
  status: OrderStatus;
  at: string;
}

export interface Order {
  id: ID;
  number: string;
  createdAt: string;
  details: OrderModeDetails;
  items: OrderItem[];
  totals: OrderTotals;
  couponCode?: string;
  rewardId?: ID;
  status: OrderStatus;
  history: OrderStatusEvent[];
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethodType;
  /** Which method exactly (app, card, UPI ID) and its references. Absent on older orders. */
  payment?: OrderPayment;
  customer: { name: string; phone: string };
  etaMinutes: number;
  pointsEarned: number;
  /** In-car: customer tapped "I'm here". */
  arrived?: boolean;
}

export interface Coupon {
  code: string;
  description: string;
  type: 'percent' | 'fixed';
  value: number;
  minSubtotal?: number;
  maxDiscount?: number;
  isActive: boolean;
}

export interface Promotion {
  id: ID;
  title: string;
  subtitle: string;
  code?: string;
  cta: string;
  image: string;
  theme: 'ember' | 'espresso' | 'sage';
  /** Where the CTA goes. */
  target: { type: 'category'; id: ID } | { type: 'product'; id: ID } | { type: 'menu' };
}

export interface Reward {
  id: ID;
  name: string;
  description: string;
  cost: number;
  image: string;
  /** Discount applied to the cart when redeemed. */
  value: number;
}

export type LoyaltyTxnType = 'earn' | 'redeem' | 'bonus';

export interface LoyaltyTransaction {
  id: ID;
  type: LoyaltyTxnType;
  points: number;
  description: string;
  createdAt: string;
  orderId?: ID;
}

export interface Profile {
  id: ID;
  phone: string;
  name: string;
  email?: string;
  createdAt: string;
}

export interface NotificationPrefs {
  orderUpdates: boolean;
  marketing: boolean;
}

export type PermissionState = 'undetermined' | 'granted' | 'denied' | 'skipped';
