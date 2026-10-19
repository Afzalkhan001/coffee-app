/**
 * Pure helpers for the orders / rewards / account screens (no React, unit-tested).
 */
import { orderPaymentLabel } from '@/api/payments';
import { displayPhone, formatCount, formatMoney, relativeDay } from '@/lib/format';
import { statusProgress } from '@/lib/orderFlow';
import { hashString, pickupCode as codeFromNumber, usesPickupCode } from '@/lib/pickupCode';
import { brand } from '@/theme/brand';
import type { BadgeTone } from '@/components/ui';
import type { LoyaltyTransaction, Order, PaymentMethodType, Reward } from '@/types/models';

/** Short counter code derived from the order number: "ER-4827" → "N27" (shared with checkout). */
export function pickupCode(order: Pick<Order, 'number'>): string {
  return codeFromNumber(order.number);
}

/** Modes where the customer collects at the café (or it's brought from the bar) and needs a code. */
export function needsPickupCode(order: Pick<Order, 'details'>): boolean {
  return usesPickupCode(order.details.mode);
}

export interface Countdown {
  /** "6:42" (or "0:00" once due). */
  text: string;
  /** Whole minutes left, rounded up, never below 0. */
  minutes: number;
  /** True once the ETA has passed. */
  overdue: boolean;
}

/** Time left until `createdAt + etaMinutes`, as an mm:ss clock. */
export function countdown(order: Pick<Order, 'createdAt' | 'etaMinutes'>, now: number): Countdown {
  const due = new Date(order.createdAt).getTime() + order.etaMinutes * 60_000;
  const left = Math.max(0, due - now);
  const totalSec = Math.ceil(left / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return { text: `${mm}:${String(ss).padStart(2, '0')}`, minutes: Math.ceil(left / 60_000), overdue: left <= 0 };
}

/**
 * Ring fill for a live order. It shares the countdown's timeline (createdAt → createdAt + ETA, the
 * same one the simulator advances on), so the arc and the "5:19 until it's ready" clock never
 * disagree: elapsed / ETA, never below a small floor for the current step and never full until
 * the order is actually ready (then it closes to 100%, matching the check in the centre).
 */
export function ringProgress(order: Order, now: number): number {
  const { status } = order;
  if (status === 'ready' || status === 'completed') return 1;
  if (status === 'cancelled') return 0;
  const start = new Date(order.createdAt).getTime();
  const span = Math.max(3_000, order.etaMinutes * 60_000);
  const time = (now - start) / span;
  const floor = statusProgress(order.details.mode, status) * 0.4;
  return Math.min(0.97, Math.max(0.06, floor, time));
}

/**
 * How the order was paid, as the customer chose it: "Google Pay", "UPI · ava@okicici",
 * "RuPay •••• 6011", "Cash on delivery" (the order's frozen payment label; older orders fall back
 * to their method type).
 */
export function paymentMethodLabel(order: Pick<Order, 'payment' | 'paymentMethod'>): string {
  return orderPaymentLabel(order);
}

/**
 * The one refund message, used by the cancel dialog ("ask") and the cancelled hero ("done"), so the
 * timing never contradicts itself: refunded now, 3–5 days to appear on the statement.
 */
export function refundCopy(order: Pick<Order, 'totals' | 'paymentMethod' | 'payment'>, when: 'ask' | 'done'): string {
  const amount = formatMoney(order.totals.total);
  const method = paymentMethodLabel(order);
  return when === 'ask'
    ? `We’ll refund ${amount} to ${method} now. It can take 3–5 days to show on your statement.`
    : `We refunded ${amount} to ${method}. It can take 3–5 days to show on your statement.`;
}

export function paymentMethodIcon(type: PaymentMethodType): string {
  switch (type) {
    case 'apple_pay':
      return 'logo-apple';
    case 'google_pay':
      return 'logo-google';
    case 'pay_at_store':
      return 'storefront-outline';
    case 'upi':
      return 'phone-portrait-outline';
    case 'cod':
      return 'cash-outline';
    default:
      return 'card-outline';
  }
}

/** Payment status chip for the receipt. */
export function paymentStatusMeta(order: Pick<Order, 'paymentStatus' | 'paymentMethod'>): { label: string; tone: BadgeTone } {
  switch (order.paymentStatus) {
    case 'paid':
      return { label: 'Paid', tone: 'sage' };
    case 'refunded':
      return { label: 'Refunded', tone: 'outline' };
    case 'failed':
      return { label: 'Payment failed', tone: 'danger' };
    default:
      if (order.paymentMethod === 'pay_at_store') return { label: 'Pay at counter', tone: 'cream' };
      if (order.paymentMethod === 'cod') return { label: 'Pay on delivery', tone: 'cream' };
      return { label: 'Pending', tone: 'cream' };
  }
}

export interface OrderSection {
  title: string;
  orders: Order[];
}

/** Newest first, grouped under "Today" / "Yesterday" / "Monday" / "3 Oct 2026". */
export function groupOrdersByDay(orders: Order[], now = new Date()): OrderSection[] {
  const sorted = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const sections: OrderSection[] = [];
  for (const order of sorted) {
    const title = relativeDay(order.createdAt, now);
    const last = sections[sections.length - 1];
    if (last && last.title === title) last.orders.push(order);
    else sections.push({ title, orders: [order] });
  }
  return sections;
}

/** "+91 98765 43210" (see `displayPhone` in `@/lib/format`). */
export { displayPhone };

/** "Oct 2026" */
export function memberSince(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

// ── Loyalty ──────────────────────────────────────────────────

export interface Tier {
  name: string;
  /** Lifetime points needed. */
  min: number;
}

export const TIERS: readonly Tier[] = [
  { name: 'Ember Newcomer', min: 0 },
  { name: 'Ember Regular', min: 300 },
  { name: 'Ember Insider', min: 1500 },
  { name: 'Ember Reserve', min: 5000 },
];

export function tierFor(lifetime: number): { tier: Tier; next: Tier | undefined } {
  let index = 0;
  TIERS.forEach((t, i) => {
    if (lifetime >= t.min) index = i;
  });
  return { tier: TIERS[index] ?? TIERS[0]!, next: TIERS[index + 1] };
}

export interface RewardProgress {
  /** The cheapest reward still out of reach, if any. */
  next: Reward | undefined;
  /** 0..1 toward `next` (1 when everything is affordable). */
  ratio: number;
  /** Points still needed for `next` (0 when none). */
  remaining: number;
}

export function nextRewardProgress(balance: number, rewards: readonly Reward[]): RewardProgress {
  const next = [...rewards].sort((a, b) => a.cost - b.cost).find((r) => r.cost > balance);
  if (!next) return { next: undefined, ratio: rewards.length > 0 ? 1 : 0, remaining: 0 };
  return { next, ratio: Math.max(0, Math.min(1, balance / next.cost)), remaining: next.cost - balance };
}

export const STAMP_SLOTS = 10;

/** Stamp card state: one stamp per completed order, a free drink every 10th. */
export function stampState(completedOrders: number): { stamps: number; toGo: number; caption: string } {
  const stamps = completedOrders % STAMP_SLOTS;
  const toGo = STAMP_SLOTS - stamps;
  // R3.A6: short, numbers over adjectives, no exclamation marks.
  const caption =
    completedOrders > 0 && stamps === 0
      ? 'Card complete · a fresh card starts now'
      : toGo === 1
        ? 'Your next drink is free'
        : `10th drink free · ${toGo} to go`;
  return { stamps, toGo, caption };
}

/** Stable redeem code per customer + reward: "ER-7Q4K". */
export function ticketCode(rewardId: string, phone: string | null): string {
  const n = hashString(`${rewardId}:${phone ?? 'guest'}`);
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let out = '';
  let v = n;
  for (let i = 0; i < 4; i++) {
    out += alphabet[v % alphabet.length];
    v = Math.floor(v / alphabet.length) + (i + 1) * 7919;
  }
  return `ER-${out}`;
}

/** Points history, newest first. */
export function sortTransactions(txns: readonly LoyaltyTransaction[]): LoyaltyTransaction[] {
  return [...txns].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Points per rupee (0.2) and the copy for it: "1 pt per ₹5". */
export const EARN_RATE = brand.loyalty.pointsPerUnit;
export { EARN_RATE_LABEL, SPEND_PER_POINT } from '@/theme/brand';
export const WELCOME_BONUS = brand.loyalty.welcomeBonus;

/** "+124" / "−400" with a real minus sign (Indian grouping past 99,999). */
export function signedPoints(points: number): string {
  return points >= 0 ? `+${formatCount(points)}` : `−${formatCount(Math.abs(points))}`;
}

/** Deterministic PRNG (mulberry32) for decorative patterns. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A QR-looking module grid as ONE SVG path (decorative: the prototype has no scanner).
 * Three finder squares + seeded random modules, so each code always draws the same pattern.
 */
export function pseudoQrPath(code: string, size: number, modules = 21): string {
  const m = size / modules;
  const rand = mulberry32(hashString(code));
  const finders = [
    [0, 0],
    [modules - 7, 0],
    [0, modules - 7],
  ] as const;
  const inFinderZone = (x: number, y: number) => finders.some(([fx, fy]) => x >= fx - 1 && x <= fx + 7 && y >= fy - 1 && y <= fy + 7);
  const finderDark = (x: number, y: number) =>
    finders.some(([fx, fy]) => {
      const dx = x - fx;
      const dy = y - fy;
      if (dx < 0 || dy < 0 || dx > 6 || dy > 6) return false;
      const ring = dx === 0 || dy === 0 || dx === 6 || dy === 6;
      const core = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
      return ring || core;
    });
  const r = (n: number) => Math.round(n * 100) / 100;
  let d = '';
  for (let y = 0; y < modules; y++) {
    for (let x = 0; x < modules; x++) {
      const dark = inFinderZone(x, y) ? finderDark(x, y) : rand() < 0.48;
      if (dark) d += `M${r(x * m)} ${r(y * m)}h${r(m)}v${r(m)}h${r(-m)}z`;
    }
  }
  return d;
}

/** Ticket outline with two concave perforation notches at `notchY` (one closed SVG path). */
export function ticketPath(width: number, height: number, notchY: number, radius = 24, notch = 13): string {
  const w = width;
  const h = height;
  const R = Math.min(radius, w / 2, h / 2);
  const n = notch;
  const y = Math.min(Math.max(notchY, R + n), h - R - n);
  return [
    `M${R} 0`,
    `H${w - R}`,
    `A${R} ${R} 0 0 1 ${w} ${R}`,
    `V${y - n}`,
    `A${n} ${n} 0 0 0 ${w} ${y + n}`,
    `V${h - R}`,
    `A${R} ${R} 0 0 1 ${w - R} ${h}`,
    `H${R}`,
    `A${R} ${R} 0 0 1 0 ${h - R}`,
    `V${y + n}`,
    `A${n} ${n} 0 0 0 0 ${y - n}`,
    `V${R}`,
    `A${R} ${R} 0 0 1 ${R} 0`,
    'Z',
  ].join(' ');
}
