# Haptics: crisp, sparse, in sync

**Why this exists:** the user's feedback was "haptics feel cheap". The causes:
- **Too many.** Every `PressableScale` fires `impactAsync(Light)` by default, so every card, back button and row tap buzzes.
- **Wrong engine on Android.** `impactAsync` on Android uses the generic vibration motor and feels mushy. Android's system haptic constants (`performAndroidHapticsAsync`) use the same tuned effects as the system keyboard and switches, and feel crisp.
- **Wrong flavour on iOS.** `Light` and `Medium` impacts feel soft and thumpy. Crisp UI feedback on iOS comes from `selectionAsync` and `ImpactFeedbackStyle.Rigid`.
- **Out of sync.** Some haptics fire on release or before the visual change, and the order simulator fires `success` on every status tick, about every 9 seconds.

## Principles
1. **Haptics mark meaning, not touches.** A tap that only navigates (cards, rows, back, links) is silent. Feedback is for:
   - choices (select);
   - state changes (toggle, add);
   - thresholds;
   - outcomes (success, error).
2. **Crisp over strong.** Default to `select` and `tick`. Use the heavier effects only for real outcomes.
3. **In sync with the motion.** Fire at the frame where the visual change happens:
   - the selection indicator starts moving;
   - the item lands in the cart;
   - the swipe crosses the delete threshold;
   - the pay button turns into the check.
4. **Never double-fire.** A component that fires its own semantic haptic passes `hapticKind={null}` to `PressableScale`. The wrapper also throttles: the same kind can't repeat within 60 ms, and nothing fires within 30 ms of another haptic.
5. **Respect the user.** Settings has a "Haptics" switch, on by default. Respect Reduce Motion only for continuous or decorative haptics; outcome haptics stay.

## Vocabulary (`src/lib/haptics.ts`): the only API screens may use
| Kind | When | iOS | Android (`performAndroidHapticsAsync`) |
|---|---|---|---|
| `select` | A discrete choice changes: chips, size S/M/L, radio rows, segmented control, tab change, mode cards, pickup slot | `selectionAsync()` | `AndroidHaptics.Segment_Tick` |
| `tick` | Rapid or small steps: quantity stepper, OTP digit entered, carousel page snap, scroll-spy chip change | `selectionAsync()` | `AndroidHaptics.Segment_Frequent_Tick` |
| `toggle(on)` | Switches (notification prefs, demo tools, Veg only, favourites heart) | `impactAsync(Rigid)` | `Toggle_On` / `Toggle_Off` |
| `press` | Press-in on the few committing CTAs only: Add to cart, Place order, Pay, Confirm | `impactAsync(Rigid)` | `Virtual_Key` |
| `land` | The fly-to-cart thumbnail reaches the cart and the badge pops; a sheet snaps open | `impactAsync(Soft)` | `Gesture_End` |
| `threshold` | A drag crosses its commit point: swipe-to-delete armed, pull-to-refresh armed, sheet or live order pill past its dismiss line | `impactAsync(Rigid)` | `Context_Click` |
| `longPress` | A long press opens something (cart row options) | `impactAsync(Medium)` | `Long_Press` |
| `success` | Order placed, payment approved, reward redeemed, order ready | `notificationAsync(Success)` | `Confirm` |
| `warning` | Nudge for a missing required step (tapping the disabled Add or Place order bar) | `notificationAsync(Warning)` | `Reject` |
| `error` | Payment declined, invalid or expired OTP, coupon rejected | `notificationAsync(Error)` | `Reject` |

Implementation notes:
- If `performAndroidHapticsAsync` throws (older Android), fall back to `impactAsync(Light)`, at most once per kind.
- Web is a no-op.
- Keep the deprecated names (`light`, `medium`, `heavy`, `selection`) as aliases that map to the new kinds until every call site is migrated, then delete them.
- `PressableScale`'s default `hapticKind` becomes `null`.

## Call-site map (what should buzz)
- **Silent:** navigation taps (product cards, rows, back, links, "See all", header icons), opening sheets, scrolling.
- **Tab bar:** `select` when the active tab changes. Re-tapping the active tab (scroll to top) is silent.
- **Product detail:**
  - `select` on size and option changes;
  - `tick` on quantity;
  - `warning` when tapping the disabled bar (fired together with the shake);
  - `press` on the Add bar's press-in, then `land` when the flying thumbnail arrives;
  - `toggle` on favourite.
- **Quick-add "+" on cards:** `press` on press-in, `land` on arrival.
- **Reorder pills** (Orders, Home "Order again", tracking) and the cart's upsell "+": `press` on press-in, `land` when the thumbnail arrives (the same as quick-add).
- **Cart:**
  - `tick` on quantity;
  - `threshold` when the swipe crosses the delete point;
  - delete commit is silent (the threshold already said it);
  - `error` or `success` on coupon apply.
- **Checkout and payment:**
  - `select` on slot and method;
  - `press` on Place order and Pay press-in;
  - `success` exactly when the pay button morphs to the check;
  - `error` on decline.
  - UPI: opening the app and the approval countdown are silent, as is **Cancel**; the approval's `success` is the pay button's check above (one haptic, not two). Tip chips and the payment rows click `select` when the choice changes.
- **Delivery address:** `select` when a checked address becomes the choice, `warning` when it's out of range, `error` when the check fails (offline); the form's disabled **Save address** bar plays `warning` with its shake, and its Home / Work / Other chips and the receiver switch use the shared `select` / `toggle`.
- **Auth:**
  - `tick` per OTP digit;
  - `error` on wrong or expired code;
  - `success` on verify.
- **Rewards:** `success` on redeem.
- **Toggles:** `toggle(on)`.
- **Settings → Appearance (System · Light · Dark):** `select` when the choice changes (the app re-themes on the same tap); re-tapping the current choice is silent.
- **Order simulator (root layout):** `success` only when an order becomes **ready**, plus completed-and-delivered for delivery orders. Every other status change is silent.
- **Live order pill:** silent tap (it navigates); `threshold` when a swipe crosses its hide point (a fling that never crossed it clicks at commit). Its status-change pop has no haptic of its own: the order simulator's `success` above already marks "ready".
