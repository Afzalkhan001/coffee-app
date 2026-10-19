# Phase 4 plan: Supabase backend

This plan connects the Ember Roast prototype to Supabase, following PRD §21–22 and §29 Phase 4. It also outlines the Phase 6 admin dashboard. It is written against the code as it stands: every function named here exists in `src/api/`, and every column comes from `src/types/models.ts`.

## Principles

1. **Keep the seam.** Screens only call `src/api/index.ts` and `src/api/hooks.ts`. Phase 4 replaces function *bodies* and keeps the signatures, so no screen changes (except the few direct mock imports listed in §10).
2. **The server is the source of truth for money, status and points.** The client still prices the cart live for the UI, but the server recomputes every total, decides every status change and writes every loyalty transaction. The client only *reads* those.
3. **RLS on every table.** The app uses the publishable (anon) key plus the user's session. The service-role key only exists in Edge Functions and the admin dashboard's server code.
4. **Keep the mock.** A build flag (`EXPO_PUBLIC_DATA_SOURCE=mock|supabase`) keeps the offline demo working for sales and for screenshots.

---

## 1. Setup

| Step | Detail |
|---|---|
| Project | Create a Supabase project in the client's account; the client owns hosting and SMS costs (PRD §30). Use one project for staging and one for production. |
| Repo | Add `supabase/` (CLI: `supabase init`) with `migrations/`, `functions/` and `seed.sql`. |
| Client package | `npx expo install @supabase/supabase-js`. This is the only new app dependency for Phase 4; AsyncStorage is already installed for session storage. Follow Supabase's Expo quickstart for any polyfills it lists. |
| Env | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_DATA_SOURCE`. Never ship the service-role key in the app. |
| Client file | New `src/api/supabase.ts`: `createClient(url, key, { auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })`. |
| Types | `supabase gen types typescript --linked > src/types/database.ts`. Keep `src/types/models.ts` as the app-facing types and map rows → models in a new `src/api/mappers.ts`. |
| Seed | Generate `seed.sql` from `src/data/mock/menu.ts`, `modifiers.ts` and `marketing.ts`, so staging starts with the demo menu. |

---

## 2. Auth: phone OTP (PRD §5)

| Prototype | Supabase |
|---|---|
| `sendOtp(phone)` returns `{ expiresAt, resendAt }` | `supabase.auth.signInWithOtp({ phone: toE164(phone) })`. Compute `expiresAt` / `resendAt` client-side from `OTP_TTL_MS` / `OTP_RESEND_MS`, set to match the project's Auth settings (OTP expiry and SMS rate limit). |
| `verifyOtp(phone, code)` returns `{ profile \| null }` | `supabase.auth.verifyOtp({ phone, token: code, type: 'sms' })`, then `select * from profiles where id = auth.uid()`. No row means a new user → `auth/profile`. |
| `saveProfile(phone, { name, email })` | `upsert` into `profiles` (id = `auth.uid()`). A trigger on the first insert creates the loyalty account and the welcome bonus (§5). |
| `OtpError('invalid' \| 'expired')` | Map Auth API errors. Supabase may report invalid and expired codes with the same error, so keep the client-side expiry timer to tell them apart (the OTP screen already runs one). |
| `useSession.signOut()` | Also call `supabase.auth.signOut()`. |

Notes:
- **Phone format.** The app stores the bare 10-digit Indian mobile number (`"9876543210"`; `nationalPhone()` in `src/lib/format.ts` strips a typed `+91` or leading `0`). Convert at the seam with `PHONE_DIAL` from `src/lib/format.ts` (also `COUNTRY.dial` in `src/components/onboarding/authFormat.ts`): E.164 `+919876543210`.
- **SMS provider.** Supabase phone auth needs one, for example Twilio, MessageBird or Vonage (or an Indian provider such as MSG91 through a custom SMS hook). It is a client-paid third-party cost. Sending OTPs to Indian numbers requires **DLT registration** (entity, sender ID and the OTP template) through the provider before launch.
- **Demo code in staging.** Configure Supabase's test phone numbers / test OTPs (CLI `config.toml`: `[auth.sms.test_otp]`) so `123456` keeps working for demos without sending SMS.
- **Remove `seedNewCustomer()`** from `src/api/index.ts`. Fake past orders (flagged `demoSeed` in the mock) must not exist in production.

---

## 3. Schema (PRD §22)

**Conventions**
- Keys: `uuid` primary keys (`gen_random_uuid()`), except catalog ids, which can stay readable slugs (`'latte'`, `'size-m'`) to match the seed.
- Columns: money is `numeric(10,2)` in INR (the app works in whole rupees, `brand.currency.decimals = 0`, so stored values have no paise; keep two decimals so a gateway amount in paise maps cleanly), points are `integer`, every table has `created_at timestamptz default now()`, and mutable tables also have `updated_at`.

**Enums** (from `models.ts`)

```sql
create type order_mode       as enum ('dine_in','pickup','in_car','delivery');
create type order_status     as enum ('placed','accepted','preparing','ready','out_for_delivery','completed','cancelled');
create type payment_status   as enum ('pending','paid','failed','refunded');
create type payment_method   as enum ('card','apple_pay','google_pay','pay_at_store');
create type dietary_tag      as enum ('vegan','vegetarian','gluten_free','dairy_free','nut_free','contains_nuts','low_cal');
create type product_badge    as enum ('best_seller','new','seasonal');
create type selection_type   as enum ('single','multi');
create type group_display    as enum ('size_circles','list');
create type loyalty_txn_type as enum ('earn','redeem','bonus','refund');   -- 'refund' formalises today's bonus-with-lifetime:false
create type staff_role       as enum ('staff','manager','admin');
```

### PRD §22 entities

| Table | Columns | Source in the app |
|---|---|---|
| `profiles` | `id uuid pk references auth.users`, `phone text unique` (E.164), `name text not null`, `email text`, `order_updates bool default true`, `marketing_opt_in bool default false`, `marketing_opt_in_at timestamptz` | `Profile`, `NotificationPrefs` |
| `stores` | `id text pk`, `name`, `short_name`, `address`, `lat`, `lng`, `timezone`, `opens_at time`, `closes_at time`, `is_accepting_orders bool` (manual pause), `modes_enabled order_mode[]`, `tables text[]`, `delivery_radius_km`, `delivery_fee`, `free_delivery_over`, `min_prep_minutes`, `tax_rate numeric(5,4)` (GST, `0.05`), `currency text` (`'INR'`), `support_phone`, `support_email` | `Store`, `brand.store` in `src/theme/brand.ts` |
| `categories` | `id text pk`, `store_id`, `name`, `icon` (LineIcon glyph), `tint` (hero-tint key), `image_path`, `sort_order`, `is_active` | `Category`, `CATEGORY_PHOTOS` |
| `products` | `id text pk`, `category_id`, `name`, `description`, `story`, `price`, `compare_at_price`, `image_path`, `kcal`, `dietary dietary_tag[]`, `badge product_badge`, `is_featured`, `is_popular`, `is_available` (sold out today), `is_archived` (disabled), `allows_instructions`, `prep_minutes`, `coffee jsonb` (`{origin, roast, notes[], acidity, body, sweetness}`), `rating`, `rating_count`, `sort_order` | `Product` |
| `modifier_groups` | `id text pk`, `name`, `display group_display`, `selection_type`, `required bool`, `min_select int`, `max_select int`, with check constraints `min_select <= max_select` and `not required or min_select >= 1` | `ModifierGroup` |
| `modifier_options` | `id text pk`, `group_id`, `name`, `short_name`, `price_delta`, `is_default`, `is_available`, `kcal_delta`, `caption`, `sort_order` | `ModifierOption` |
| `product_modifier_groups` | `product_id`, `group_id`, `sort_order`, `pk (product_id, group_id)` | `ProductModifierGroup` |
| `addresses` | `id uuid pk`, `user_id`, `kind` (`home` / `work` / `other`), `label`, `flat_no`, `building`, `street`, `landmark`, `area`, `city`, `state`, `pin text check (pin ~ '^[1-9][0-9]{5}$')`, `notes`, `contact_name`, `contact_phone`, `lat`, `lng`, `is_default` (the display lines `line1` / `line2` / city line are derived by `composeAddress`, or stored as generated columns) | `Address` + `Address.parts` (replaces `SEED_ADDRESSES`) |
| `carts` | `id uuid pk`, `user_id unique`, `coupon_code`, `reward_id`, `updated_at` | `useCart` (optional, see note) |
| `cart_items` | `id uuid pk`, `cart_id`, `product_id`, `quantity`, `modifiers jsonb` (snapshots), `instructions`, `config_key` | `CartItem` |
| `orders` | `id uuid pk`, `number text unique` (`ER-####`, from a sequence), `user_id` (owner), `store_id`, `mode order_mode`, `table_label`, `pickup_asap bool`, `scheduled_for timestamptz`, `car jsonb` (`{make,color,plate}`), `delivery_address jsonb` (snapshot of `Address`), `status order_status default 'placed'`, `payment_status`, `payment_method`, `subtotal`, `discount`, `tax`, `delivery_fee`, `total`, `coupon_code`, `reward_id`, `customer_name`, `customer_phone`, `eta_minutes numeric`, `points_earned int`, `arrived_at timestamptz`, `confirmed_at timestamptz` (null = awaiting payment) | `Order` + `OrderRecord` (`ownerPhone` → `user_id`, `scheduledFor` → `scheduled_for`) |
| `order_items` | `id uuid pk`, `order_id`, `product_id`, `name`, `image`, `base_price`, `quantity`, `instructions`, `line_total` | `OrderItem` (frozen copy at order time) |
| `order_item_modifiers` | `id uuid pk`, `order_item_id`, `group_id`, `group_name`, `option_id`, `option_name`, `short_name`, `price_delta` | `SelectedModifierSnapshot` |
| `payments` | `id uuid pk`, `order_id`, `provider`, `provider_ref` (payment intent / charge id), `amount`, `currency`, `method payment_method`, `status payment_status`, `raw jsonb` | `Payment` |
| `loyalty_accounts` | `user_id pk`, `balance int check (balance >= 0)`, `lifetime int` (drives the tier) | `LoyaltyAccount` in `mockDb.ts` |
| `loyalty_transactions` | `id uuid pk`, `user_id`, `type loyalty_txn_type`, `points int`, `description`, `order_id` | `LoyaltyTransaction` |
| `coupons` | `code citext pk`, `description`, `type ('percent'\|'fixed')`, `value`, `min_subtotal`, `max_discount`, `is_active`, `first_order_only bool`, `starts_at`, `ends_at`, `usage_limit`, `per_user_limit` | `Coupon`, `FIRST_ORDER_COUPONS` |
| `promotions` | `id text pk`, `title`, `subtitle`, `code`, `cta`, `image_path`, `theme ('ember'\|'espresso'\|'sage')`, `target_type ('menu'\|'category'\|'product')`, `target_id`, `audience ('all'\|'first_order'\|'returning')`, `sort_order`, `starts_at`, `ends_at`, `is_active` | `Promotion`, `REGULAR_PROMOTION` swap in `components/home/homeData.ts` |
| `notifications` | `id uuid pk`, `user_id`, `kind ('order_status'\|'marketing')`, `title`, `body`, `order_id`, `read_at` | Home bell inbox (`components/home/notifications.ts`, derived today) |

### Extra tables the app needs (not listed in PRD §22)

| Table | Columns | Why |
|---|---|---|
| `rewards` | `id text pk`, `name`, `description`, `cost int`, `image_path`, `value numeric`, `eligible_category_ids text[]` (empty = whole order), `eligibility_noun` ("a pastry"), `is_active`, `sort_order` | `Reward` + `REWARD_ELIGIBILITY` |
| `order_status_events` | `id bigserial`, `order_id`, `status order_status`, `at timestamptz`, `actor uuid` (staff or null for system) | `Order.history` (the tracking timeline) |
| `staff_members` | `user_id pk references auth.users`, `store_id`, `role staff_role` | Admin login and RLS |
| `push_tokens` | `user_id`, `expo_push_token text unique`, `platform`, `updated_at` | Phase 5 push |

**Cart note.** Keep the cart on the device (`useCart`, persisted) for the MVP: it is fast, works offline and needs no round trips. Add `carts` / `cart_items` sync only if cross-device carts or abandoned-cart marketing are wanted.

---

## 4. Row Level Security (sketch)

```sql
create function is_staff() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff_members where user_id = auth.uid());
$$;

alter table orders enable row level security;
create policy "own orders: read"   on orders for select using (user_id = auth.uid() or is_staff());
create policy "staff: update"      on orders for update using (is_staff());
-- no insert/update policy for customers: they go through create-order / cancel_order / mark_arrived
```

| Table(s) | Customer (authenticated) | Anonymous | Staff |
|---|---|---|---|
| `stores`, `categories`, `products`, `modifier_groups`, `modifier_options`, `product_modifier_groups`, `promotions`, `rewards` | select where active / not archived | select (menu browsing before sign-in later) | all |
| `profiles` | select / update own (`id = auth.uid()`) | none | select all |
| `addresses`, `carts`, `cart_items`, `push_tokens` | full CRUD on own rows | none | none |
| `orders` | select own; writes only via RPC / Edge Function | none | select / update |
| `order_items`, `order_item_modifiers`, `order_status_events`, `payments` | select where the parent order is own | none | select (+ insert events via RPC) |
| `loyalty_accounts`, `loyalty_transactions` | select own; writes only by triggers / service role | none | select; manual adjustments via RPC |
| `coupons` | **no select** (stops code enumeration); check via `validate_coupon()` RPC | none | all |
| `notifications` | select own, update `read_at` | none | insert |
| `staff_members` | none | none | admins manage |

---

## 5. Server logic

### Edge Functions (TypeScript, Deno)

| Function | Called by | What it does |
|---|---|---|
| `create-order` | `createOrder()` | Re-prices every line from `products` / `modifier_options`, using the same rules as `src/lib/pricing.ts` and `src/lib/modifiers.ts` (copy them to `supabase/functions/_shared/` so client and server totals can't drift). It validates availability (`cartLineIssue`), store open or slot, mode enabled, delivery radius, coupon (`first_order_only`, minimum spend), and reward affordability and eligibility. It computes `eta_minutes` (slowest `prep_minutes`, +18 for delivery, as `baseEtaMinutes` does), then calls `insert_order(jsonb)` (security definer, service role only) to write the order, items and modifiers atomically, with `confirmed_at = null`. It replaces the user's previous unconfirmed order, as the mock does. |
| `payment-intent` | `payOrder()` | Creates a payment intent with the chosen gateway for `orders.total` and returns the client secret. The app then shows the gateway's payment sheet. Pay at the counter skips this and calls `confirm_pay_at_store(order_id)`. |
| `payment-webhook` | The gateway | Verifies the signature, upserts `payments`, and on success sets `orders.payment_status = 'paid'`, `confirmed_at = now()`, inserts the `placed` status event and writes the reward `redeem` transaction. **This is the only place an order becomes paid** (PRD §14). On failure it sets `payment_status = 'failed'`. |
| `refund-payment` | `cancel_order` (via a database webhook) or the dashboard | Refunds through the gateway, sets `payment_status = 'refunded'`, and writes the loyalty `refund` if a reward was redeemed. |
| `notify-order-status` | Database webhook on `order_status_events` insert | Sends an Expo push (`exp.host/--/api/v2/push/send`) to the owner's `push_tokens` when `profiles.order_updates` is on, and inserts into `notifications`. |
| `geocode-address` (optional) | `checkDelivery()` / the address form | Proxies Google Places or Mapbox so the API key stays server-side. It replaces today's fake `addressFromDraft()` coordinates. |

### SQL functions and triggers

| Function / trigger | Behaviour (mirrors today's mock) |
|---|---|
| `validate_coupon(code, subtotal)` RPC | Same results and messages as `validateCoupon` / `evaluateCoupon`, including first-order-only via the caller's confirmed orders. |
| `confirm_pay_at_store(order_id)` RPC | Owner only. Confirms with `payment_status = 'pending'` (staff mark it paid at the counter). |
| `cancel_order(order_id)` RPC | Owner only, and only while `placed` / `accepted` (`canCancel`). Sets `cancelled` and appends the event; the refund follows via `refund-payment`. |
| `mark_arrived(order_id)` RPC | Owner, in-car, `ready` only. Sets `arrived_at`; the dashboard alerts staff. |
| `advance_order_status(order_id, next)` RPC | Staff. A trigger allows only the next step in the mode's flow (`STATUS_FLOW` in `src/lib/orderFlow.ts`) or `cancelled`, and appends `order_status_events`. |
| Trigger `on order completed` | Inserts the `earn` transaction for `points_earned` (1 per ₹5, floored: `pointsForTotal`), as the simulator does today. |
| Trigger `on profile insert` | Creates `loyalty_accounts` and the 150-point `bonus` (`brand.loyalty.welcomeBonus`). |
| Trigger `on loyalty_transactions insert` | Updates `balance` and `lifetime` (earn and bonus only count toward lifetime). `check (balance >= 0)` rejects overdrafts, like `db.addLoyalty`. |

---

## 6. Realtime: order status (PRD §15)

- Add `orders`, `order_status_events` and `loyalty_transactions` to the `supabase_realtime` publication. RLS applies to `postgres_changes`, so customers only receive their own rows.
- New `src/api/realtime.ts`, started from `src/app/_layout.tsx` where `startOrderSimulator()` runs today:

```ts
supabase.channel(`orders:${uid}`)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${uid}` }, onOrder)
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_status_events' }, onEvent)
  .subscribe();
```

- Keep a small zustand cache in place of `useMockDb`, so `useMyOrders`, `useActiveOrders`, `useActiveOrderCount`, `useOrder` and `useLoyalty` keep their signatures and stay reactive.
- Refetch on app foreground and on channel reconnect.
- **Delete `src/api/simulator.ts`.** `onOrderStatusChange` (local notification + haptic) is driven by the Realtime events instead. When the app is closed, push from `notify-order-status` covers it.

---

## 7. Storage: product and banner images

| Bucket | Access | Path |
|---|---|---|
| `product-images` | public read, staff write | `products/{product_id}/{uuid}.png` |
| `category-images` | public read, staff write | `categories/{category_id}.png` |
| `banner-images` | public read, staff write | `promotions/{promotion_id}/{uuid}.jpg` |

- Store the **path** in `image_path`, and build URLs in the mapper with `supabase.storage.from(bucket).getPublicUrl(path, { transform: { width, height, resize: 'cover' } })`.
- `sizedPhoto(url, size)` in `src/components/domain/photo.tsx` currently rewrites Unsplash `w`/`h` parameters. Point it at the transform options instead. Image transformations need a paid Supabase plan; the alternative is to have the dashboard upload two or three pre-sized renditions.
- Ask for cut-out PNGs of at least 1000 px (DESIGN.md §10).

---

## 8. Mapping every `src/api` export

| Export | Phase 4 implementation |
|---|---|
| `sendOtp`, `verifyOtp`, `saveProfile`, `OTP_TTL_MS`, `OTP_RESEND_MS`, `DEMO_OTP` | §2. `DEMO_OTP` stays only for the mock / staging test number. |
| `getMenu` | Select `categories` + `products` (`is_archived = false`), ordered by `sort_order`. Write the result to a persisted **catalog cache**. |
| `getProduct` | Select the product with its groups and options (the cache is usually enough). |
| `getProductSync`, `getCategorySync`, `categoryImage`, `resolveModifierGroups`, `getRewardSync`, `findCoupon` (UI hints only) | Read from the catalog cache. These must stay synchronous because the product screen's first paint and the cart's checks depend on it. |
| `searchProducts` | Filter the cached catalog client-side (about 25 items). Move to a `tsvector` search later if the menu grows. |
| `getPromotions` | Select active promotions in their date window. Filter `audience` by whether the user has a confirmed order. |
| `getRewards` | Select active rewards. |
| `rewardDiscountFor`, `rewardHint`, `canAffordReward`, `cartLineIssue`, `reorderableLines`, `couponAllowedFor` | Stay as client-side helpers over the cache and loyalty balance (UI feedback). The server re-checks all of it in `create-order`. |
| `validateCoupon` | `validate_coupon()` RPC. |
| `checkDelivery` | Haversine against `stores.lat/lng/delivery_radius_km` client-side, authoritative in `create-order`. Real geocoding via `geocode-address`. |
| `createOrder` | `create-order` Edge Function. |
| `payOrder` | `payment-intent` + gateway sheet, then wait for the webhook's `payment_status = 'paid'` over Realtime, with a timeout and a refetch. Pay at the counter uses `confirm_pay_at_store`. Map declines to `PaymentError`. |
| `cancelOrder` | `cancel_order()` RPC. |
| `markArrived` | `mark_arrived()` RPC. |
| `getOrders`, `useMyOrders`, `useActiveOrders`, `useActiveOrderCount`, `useOrder` | Select own orders where `confirmed_at is not null`, with items, modifiers and events, plus the Realtime cache (§6). Today "confirmed" means `history.length > 0`. |
| `useLoyalty`, `useCartReward` | `loyalty_accounts` + `loyalty_transactions` (own), Realtime-updated. |
| `useAsync` | Unchanged. |
| `quotedEtaMinutes` | Client estimate from cached `prep_minutes`; the order carries the server's `eta_minutes`. |
| `orderOwner`, `orderScheduledFor`, `OrderRecord` | Replaced by `orders.user_id` / `scheduled_for` columns. Add `scheduledFor?` to `Order` in `models.ts`. |
| `NetworkError`, `isNetworkError` | Thrown when `fetch` fails or the client is offline, so every existing offline / retry state keeps working. |
| `PHOTOS` | Removed; images come from Storage. |

---

## 9. Order lifecycle end to end

1. **Checkout → `create-order`.** The server re-prices the cart and creates the order with `confirmed_at = null`, then the app opens `/payment`.
2. **`payment-intent` → gateway sheet → `payment-webhook`.** The webhook confirms the order, inserts the `placed` event and redeems any reward. The app, waiting on Realtime, navigates to the confirmation.
3. **Dashboard: Accept → Preparing → Ready / Out for delivery → Completed.** Each step goes through `advance_order_status`; the app timeline updates live and push notifications fire.
4. **In-car.** At Ready, the customer taps "I'm here" (`mark_arrived`), and the dashboard shows the car, colour and plate.
5. **Completed.** A trigger adds the earned points.
6. **Cancel while Placed / Accepted.** `cancel_order` runs, then `refund-payment` refunds the payment and any points.

---

## 10. App changes outside `src/api`

These files import mock modules directly today and need small edits:

| File | Today | Change |
|---|---|---|
| `src/app/_layout.tsx` | `startOrderSimulator`, `onOrderStatusChange` | Start the Realtime subscription; register for push (Phase 5). |
| `src/app/auth/otp.tsx` | Reads `db.get().otp` for the timers | Keep the timers in session state from the `sendOtp` result. |
| `src/app/settings.tsx` | `db.reset()` in Reset demo | Hide Demo tools in production builds (show them only when `EXPO_PUBLIC_DATA_SOURCE=mock`). |
| `src/store/hydration.ts` | Waits on `useMockDb` | Wait on the auth session plus the catalog cache. |
| `src/components/domain/orderText.ts` | `orderScheduledFor` from `mockDb` | Read `order.scheduledFor`. |
| `src/app/payment.tsx`, `src/components/checkout/PaymentMethods.tsx`, `src/components/account/format.ts` | `PAYMENT_METHODS` mock | Saved methods come from the gateway customer; keep Pay at the counter as a local option. |
| `src/components/home/homeData.ts` | `REGULAR_PROMOTION`, `FIRST_ORDER_COUPONS` | `promotions.audience`. |
| `src/store/session.ts` | `SEED_ADDRESSES` | Addresses from the `addresses` table (and add delete, which the UI lacks today). |
| `src/app/help.tsx` | `HELP_FAQ` | Keep static, or move to a table if staff should edit it. |
| `src/types/models.ts` | n/a | Add `scheduledFor?`, the `'refund'` loyalty type, and `image?` on `Category`. |

---

## 11. Admin dashboard (Next.js)

This covers PRD §20, for Phase 6. Phase 4 needs at least the orders board, otherwise nobody can accept orders.

**Stack**
- Next.js (App Router) + `@supabase/ssr`, hosted on Vercel or similar.
- Staff sign in with email and password (or magic link). Access requires a `staff_members` row, so RLS does the authorization.
- The service-role key is only used in server actions that need it (refunds, manual point adjustments), never in the browser.
- Share the generated `database.ts` types with the app.

| Page | PRD §20 item | Key features |
|---|---|---|
| Login | Admin login | Email / password; role check |
| **Orders board** | View new and active orders; accept / reject; change status | Realtime columns: New · Accepted · Preparing · Ready / Out for delivery. New-order sound, accept or reject (reject = cancel + refund), one-tap next status, ETA adjust, in-car "arrived" alert with car details, pay-at-counter "mark paid" |
| Order detail | View orders | Items with modifiers and instructions, contact, payment status and refund, status history, reprint ticket |
| Categories | Manage categories | Create, edit, sort, icon, image, active |
| Products | Create / edit / disable products; upload images; mark unavailable | Form with price, compare-at price, dietary tags, badge, kcal, prep minutes, coffee profile; image upload to `product-images`; an **"Sold out today"** toggle (`is_available`) separate from archive (`is_archived`) |
| Modifier groups | Create groups and options; prices and selection rules | Required, min / max, single / multi, display type, option price deltas, defaults, availability; attach to products with drag-to-order (`product_modifier_groups`) |
| Promotions | Manage banners | Image upload, copy, code, target (menu / category / product), audience, schedule, order |
| Coupons | Manage coupons | Percent / fixed, minimum spend, cap, first-order-only, dates, usage limits, redemptions |
| Rewards | (loyalty) | Cost, value, eligible categories, active |
| Store settings | n/a | Hours, pause ordering, enabled modes, tables, delivery radius, fee and free threshold, tax rate |
| Reports | Basic order / sales info | Today and 7 / 30 days: orders, revenue, average ticket, top products, mode mix (SQL views; no BI, per §27) |
| Customers (optional) | n/a | Look up by phone, order history, adjust points (audited `bonus` / `redeem`) |

---

## 12. Order of work

1. **Schema and seed.** Migrations for the enums, the catalog and the stores; `seed.sql` from the mock data; RLS on the catalog. Then `getMenu` and the catalog cache, running against staging with the mock flag still available.
2. **Auth and profiles.** Phone OTP with a test number, profiles, the welcome-bonus trigger.
3. **Orders.** The `create-order` function, the `insert_order` RPC, orders RLS, Realtime hooks and the status trigger, plus the minimal dashboard orders board. Delete the simulator.
4. **Payments (Phase 5).** Gateway, `payment-intent`, `payment-webhook`, refunds, pay at the counter.
5. **Loyalty and coupons.** RPCs and triggers, rewards redemption at payment.
6. **Storage and push.** Image buckets and the dashboard upload; push tokens and `notify-order-status`.
7. **Hardening.** RLS tests (`supabase test db` with pgTAP) for "a customer can't read or alter another customer's order or points", load-test the orders board, and finish the remaining dashboard pages.
