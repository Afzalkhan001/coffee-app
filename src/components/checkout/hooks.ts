/**
 * Cart/checkout state hooks. They only read stores and derive values; visuals stay on the UI thread.
 */
import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { couponAllowedFor, findCoupon } from '@/api';
import { useCartReward } from '@/api/hooks';
import { cartCount, cartSubtotal, computeTotals, evaluateCoupon, type CouponCheck } from '@/lib/pricing';
import { useCart } from '@/store/cart';
import { selectModeDetails, useSession } from '@/store/session';

/**
 * Live cart totals with the selected mode, coupon and redeemed reward applied — priced exactly as
 * `createOrder` will: a first-order-only code the account can no longer use takes nothing off, and
 * a reward only takes what it really covers (eligible items, enough points). Packaging follows the
 * mode; checkout passes the delivery partner `tip` (the cart has none yet).
 */
export function useCartTotals(tip?: number) {
  const items = useCart((s) => s.items);
  const couponCode = useCart((s) => s.couponCode);
  const mode = useSession((s) => s.mode);
  const phone = useSession((s) => s.phone);
  const { reward, affordable: rewardAffordable, discount: rewardValue, warning: rewardWarning } = useCartReward();

  const coupon = findCoupon(couponCode);
  const subtotal = cartSubtotal(items);
  const allowed = !coupon || !phone || couponAllowedFor(coupon, phone);
  const couponCheck: CouponCheck | undefined = !coupon
    ? undefined
    : allowed
      ? evaluateCoupon(coupon, subtotal)
      : { ok: false, reason: 'inactive', message: 'This code is for your first order only.' };
  const totals = computeTotals({ items, mode, coupon: allowed ? coupon : undefined, rewardValue, tip });

  return { items, mode, couponCode, coupon, couponCheck, reward, rewardAffordable, rewardValue, rewardWarning, totals, count: cartCount(items) };
}

/** The current ordering context (mode + table/slot/car/address). Shallow-compared: no render loops. */
export function useModeDetails() {
  return useSession(useShallow(selectModeDetails));
}

/** True while the software keyboard is up (iOS "will" events feel instant; Android only has "did"). */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => setVisible(true));
    const hide = Keyboard.addListener(hideEvent, () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

/** A focused text field on web (`input`, `textarea` or a contenteditable). */
function isEditable(el: Element | null): boolean {
  if (!el) return false;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    return !['button', 'checkbox', 'radio', 'submit', 'range', 'color', 'file'].includes(type);
  }
  return (el as HTMLElement).isContentEditable === true;
}

/**
 * Web only: true while a text field on the page has focus. Browsers never fire RN keyboard events,
 * so this is how sticky bars get out of the way of a focused field (and the soft keyboard on
 * phones). Always false on native, where `useKeyboardVisible` covers it.
 */
export function useTextInputFocused(): boolean {
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    // focusout fires before the next element gains focus: read activeElement after the move.
    let raf = 0;
    const sync = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setFocused(isEditable(document.activeElement)));
    };
    document.addEventListener('focusin', sync);
    document.addEventListener('focusout', sync);
    sync();
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('focusin', sync);
      document.removeEventListener('focusout', sync);
    };
  }, []);
  return focused;
}

/**
 * Turns true `delayMs` after mount (or after `enabled` flips on). Sequences one-shot UI-thread
 * animations (e.g. the confetti burst after the check lands); it never steps an animation itself.
 */
export function useDelayedFlag(delayMs: number, enabled = true): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => setOn(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs, enabled]);
  return on;
}

/**
 * True from the frame after the first commit: lets list items stagger on mount but enter instantly
 * later. (The flip is scheduled, not set inside the effect body, so it never cascades a second
 * synchronous render into the mount.)
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return mounted;
}
