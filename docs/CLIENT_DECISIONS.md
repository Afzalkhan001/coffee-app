# Client decisions (PRD §28)

The prototype had to assume an answer to each open question in PRD §28, so it shows every option working. This page lists:
- what the prototype currently assumes;
- what each possible answer changes (app, backend, operations, cost);
- where the assumption lives in code.

Most answers only remove or switch off something that already exists. The expensive answers are flagged.

**How to use it.** Walk through the [demo script](../README.md#demo-script) first, then go through the questions below with the client. Record each answer in the "Decision" line.

---

## At a glance

| # | Question | Prototype assumes | Default we recommend |
|---|---|---|---|
| 1 | Which ordering modes? | All four: Dine-In, Pickup, In-Car, Delivery | Pickup + Dine-In at launch; add the others when operations are ready |
| 2 | Is delivery available? | Yes, 5 km radius, ₹40 fee, free from ₹499 | Only if the café can staff or outsource it reliably |
| 3 | Who handles delivery? | The café's own courier (implied) | Own staff for a small radius, or a delivery-as-a-service API |
| 4 | Live delivery tracking? | No: status timeline and ETA countdown only | No for the MVP (PRD §27) |
| 5 | Payment gateway? | Simulated UPI first (Google Pay, PhonePe, Paytm, BHIM, UPI ID), saved Visa / RuPay cards; no Apple Pay | An Indian gateway with UPI (Razorpay, Cashfree, PhonePe PG) or the one that matches the café's POS |
| 6 | Cash / pay at store? | Yes: pay at the counter for Pickup, Dine-In and In-Car; cash on delivery for Delivery | Yes for Dine-In; consider limits for Pickup and cash on delivery |
| 7 | Loyalty in the MVP? | Yes: points, rewards, tiers, stamp card | Points + rewards; drop tiers or the stamp card to keep one clear scheme |
| 8 | Dine-in table ordering? | Yes, choose the table or area from a list | Yes, ideally with a QR code per table |
| 9 | In-car ordering? | Yes, car details + "I'm here" | Only if there is parking where staff can bring orders out |
| 10 | Final menu, prices, modifiers? | 21 placeholder items, 12 modifier groups | The client supplies the full list (template below) |
| 11 | Brand colors, logo, type? | Placeholder "Ember Roast" | The client supplies brand assets |
| 12 | Web admin dashboard? | None (the menu is in code, statuses are simulated) | Yes: at least an orders board and a sold-out toggle |

---

## 1. Which ordering modes are required?

**Prototype assumes:** all four modes, each with its own fields and status flow:
- **Dine-In:** table or area, required. The ready step reads "Coming to your table".
- **Pickup:** ASAP or a 10-minute slot. The ready step reads "Ready for pickup", with a pickup code.
- **In-Car:** car details plus a slot, and an "I'm here" button.
- **Delivery:** address, range check and fee. Uses "Out for delivery" in place of Ready.

**Impact of the answer**

| Answer | App | Backend / ops |
|---|---|---|
| Keep all four | No change | Staff must handle four workflows; the dashboard needs per-mode views |
| Drop one or more | Remove the cards from `ORDER_MODES`; the sheet, checkout and cart adapt. Fewer fields means faster checkout | `stores.modes_enabled` lets staff switch a mode off later without a release (for example, pausing delivery on a busy day) |
| Pickup only | The mode sheet could collapse to a pickup-time picker, and the address screen is not needed | Simplest operations and the cheapest build |

**In code:** `src/lib/orderFlow.ts` (`ORDER_MODES`, `STATUS_FLOW`, `MODE_META`), `src/app/mode.tsx`, `src/components/domain/ModeCards.tsx`, and `availableMethods` in `src/components/checkout/PaymentMethods.tsx`.

**Decision:** ______

---

## 2. Is delivery actually available?

**Prototype assumes:**
- **Range and fee:** delivery within a 5 km straight-line radius of the Indiranagar store. The fee is ₹40, free from a ₹499 subtotal, and the ETA adds 18 minutes to prep time.
- **Addresses:** saved Bengaluru addresses (Home in Domlur, Work on Residency Rd) plus a "Nandi Hills cottage" that is out of range on purpose. The form is the usual Indian one: house / flat / floor, building, street, an optional nearby landmark, area, a required 6-digit PIN code (a Bengaluru PIN fills in the city and state), city and state; Save as Home, Work or Other; delivery instructions; and a receiver's name and +91 mobile when ordering for someone else. Saved addresses can be edited and removed. Typed addresses aren't geocoded, and "Use current location" pre-fills the nearest known neighbourhood instead of reverse geocoding.

**Impact of the answer**
- **No:**
  - Remove the Delivery mode and the delivery fee row. `address` and Saved addresses become unnecessary.
  - Fewer screens to test, no maps or geocoding costs.
- **Yes:**
  - **Geocoding:** real geocoding is needed (Google Places or Mapbox autocomplete, client-paid per PRD §30).
  - **Area and fees:** the client must define the area (radius or a drawn polygon), the fee rules (flat, by distance, minimum order) and the delivery hours.
  - **Code:** the plan adds a `geocode-address` Edge Function ([SUPABASE_PLAN.md](SUPABASE_PLAN.md) §5) in place of the fake coordinates in `src/components/checkout/addressFactory.ts`.

**In code:** `brand.store.deliveryRadiusKm / deliveryFee / freeDeliveryOver` in `src/theme/brand.ts`, `src/lib/geo.ts`, `deliveryFee()` in `src/lib/pricing.ts`, and `baseEtaMinutes()` in `src/lib/orderFlow.ts`.

**Decision:** ______

---

## 3. Who handles delivery?

**Prototype assumes:** the café's own courier. Staff move the order to "Out for delivery" and then "Delivered". There is no driver app (out of scope, PRD §27).

**Impact of the answer**

| Answer | What it adds |
|---|---|
| Café staff | Nothing new: one "Out for delivery" button on the dashboard orders board |
| Delivery-as-a-service API (for example Uber Direct or DoorDash Drive) | Quote and dispatch calls from an Edge Function, courier webhooks mapped to our statuses, fees per delivery and a possible fee pass-through to the customer, and a tracking link to show in the app |
| Marketplace apps only (orders come in through them) | Remove Delivery from this app; those orders never touch it |

**Decision:** ______

---

## 4. Is live delivery tracking required?

**Prototype assumes:** no. Tracking is the status timeline, the countdown ring and an ETA. PRD §27 puts live driver GPS out of scope for the prototype.

**Impact of the answer**
- **No:** nothing to add.
- **Yes, with a third-party courier:** show the courier's tracking URL or the live position from its API. This costs little if question 3 is answered "delivery-as-a-service".
- **Yes, with our own drivers:** this is **large**. It needs a separate driver app (or driver mode), background location, a maps SDK and its usage costs, real-time location storage, plus privacy and battery work. Treat it as its own phase.

**Decision:** ______

---

## 5. Which payment gateway will be used?

**Prototype assumes:**
- **What's simulated:** there is no gateway. UPI comes first: Google Pay, PhonePe, Paytm and BHIM (text with a monogram, no logos) open a mock "Approve ₹X in Google Pay" step with a 5:00 countdown that approves itself after ~2 s, and "Pay with UPI ID" (name@bank, validated) sends a mock collect request from `emberroast@icici`. Then a saved Visa •••• 4242 and RuPay •••• 6011 and a simulated "Add new card" (no card entry), and cash on delivery / pay at the counter. No Apple Pay (not available in India). UPI references and transaction ids on paid orders are made up.
- **Order states:** "Simulate a failed payment" shows the decline and retry state; a UPI request can be cancelled. An order is only marked paid after the approval (PRD §14).
- **Tip and packaging:** delivery orders can add a delivery partner tip (₹10 / ₹20 / ₹30 / up to ₹500), passed on in full, not taxed. A ₹15 packaging charge applies to Pickup, In-Car and Delivery, with GST on it. Confirm both amounts (and whether the café wants a packaging charge at all). The questions are listed under [Other decisions](#other-decisions-the-prototype-surfaced).
- **GST invoice:** paid orders show a mock tax invoice (placeholder GSTIN and FSSAI numbers, CGST/SGST split, SAC 996331). A real one needs the café's GSTIN, legal name, invoice series and, above a turnover threshold, e-invoicing. See [Other decisions](#other-decisions-the-prototype-surfaced) for the list.

**Impact of the answer**
- **Gateway SDK:** most need a **development build** instead of Expo Go, so testing moves to EAS builds.
- **Server side:**
  - a `payment-intent` Edge Function and a signed `payment-webhook` (the only place an order becomes paid);
  - refunds wired to cancellation ([SUPABASE_PLAN.md](SUPABASE_PLAN.md) §5).
- **Wallets:**
  - Apple Pay needs an Apple merchant ID and certificates;
  - Google Pay needs a Google Pay business profile.
- **POS fit:** if the café already runs a POS (Petpooja, Posist, Pine Labs…), its gateway can put app orders and payments in the same reports. That often decides the question.
- **India:** customers expect **UPI** (intent / QR via the gateway) alongside cards and wallets; Apple Pay is not available in India and Google Pay there is a UPI app. The prototype's UPI screens map onto a gateway's UPI intent (app list) and collect (UPI ID) flows. Card payments follow RBI rules (tokenised saved cards, 3-D Secure / OTP for most transactions).
- **Costs:** transaction fees are paid by the client (PRD §14, §30). The prototype assumes **INR, whole rupees, GST 5%** added at checkout on the discounted subtotal (prices shown GST-exclusive, delivery fee outside GST). Confirm the GST treatment with the café's accountant: 5% without input tax credit is the usual rate for standalone restaurants, but cafés inside some hotels charge 18%, and invoices need the GSTIN and a CGST/SGST split.

**In code:** `src/app/payment.tsx` (+ `src/components/checkout/UpiApproval.tsx`), `payOrder()` in `src/api/index.ts`, the method rules in `src/api/payments.ts`, `PAYMENT_METHODS` in `src/data/mock/marketing.ts`, packaging and tip in `src/lib/pricing.ts`, and the invoice in `src/components/invoice/`.

**Decision:** ______

---

## 6. Is cash / payment at the store required?

**Prototype assumes:** yes, "Pay at the counter" for Pickup, Dine-In and In-Car (paid when the order is brought out), and "Cash on delivery" (cash or UPI to the rider) for Delivery.
- **At confirmation:** the order is confirmed straight away as unpaid, and the confirmation reads "Pay ₹X at the counter".
- **Points:** they are still earned on completion.

**Impact of the answer**
- **Yes:**
  - **Risk:** orders are made before payment, so no-shows cost the café. Consider limits, such as a maximum order value, Dine-In only, or only for customers with a completed order.
  - **Dashboard:** staff need a "mark paid" button.
- **No:** remove the method. Every order is prepaid, which gives cleaner reconciliation.
- **Cash on delivery:** offered for Delivery; it needs courier cash handling (or a UPI QR with the rider) and a way to mark it collected.

**In code:** `availablePaymentMethods()` in `src/api/payments.ts`, and the pay-later branch (`paysLater`) in `payOrder()` (`src/api/index.ts`).

**Decision:** ______

---

## 7. Is loyalty required in the MVP?

**Prototype assumes:** yes, with the full set:

| Element | Prototype setting |
|---|---|
| Earning | 1 point for every ₹5 spent (`pointsPerUnit: 0.2`, floored per order), added when the order completes |
| Welcome bonus | 150 points |
| Rewards | Free extra shot (150 pts, worth up to ₹50), Any pastry (400, up to ₹180), Any drink (600, up to ₹300), ₹500 off (1,000). Item rewards are capped at the cheapest matching item |
| Redeem rules | Item rewards need a matching item in the cart. Points are deducted when payment succeeds and refunded if the order is cancelled |
| Tiers | Newcomer, Regular (300), Insider (1,500), Reserve (5,000 lifetime points) |
| Stamp card | 10 slots, one stamp per completed order. Display only: no free drink is issued yet |
| History | Points history on the Rewards tab |

**Impact of the answer**
- **No:**
  - **App:** hide the Rewards tab (the tab bar becomes Home · Menu · Orders · Profile) and remove the points pill, the "+N pts" lines and the reward chip at checkout.
  - **Backend:** drop the `loyalty_*` tables and `rewards`.
  - Saves backend and dashboard work.
- **Yes:**
  - **Rules to confirm:** the earn rate, the rewards catalog, point expiry (the legal copy says points may expire after 12 months), and whether points come from the total before or after discounts.
  - **Recommendation:** pick **one** visible scheme, points *or* stamps, so customers aren't confused. If stamps stay, decide whether a stamp is per order or per drink, and make the 10th one issue a real reward.

**In code:** `brand.loyalty` in `src/theme/brand.ts`, `REWARDS` / `REWARD_ELIGIBILITY` in `src/data/mock/marketing.ts`, `TIERS` in `src/components/account/format.ts`, and `src/app/(tabs)/rewards.tsx`.

**Decision:** ______

---

## 8. Is dine-in table ordering required?

**Prototype assumes:** yes. The customer picks a table or area from chips: Window bar, Patio, Lounge, Table 1–6. A table is required for Dine-In, Pay at the counter is allowed, and the confirmation says "Your server will call this code".

**Impact of the answer**
- **Yes, chosen from a list:** works today. Staff manage the table list in the dashboard (`stores.tables`).
- **Yes, with a QR code per table:** print a QR code per table that deep-links into the app with the table pre-selected (the app already has the `emberroast://` scheme). It needs a small deep-link handler and a web fallback for customers without the app.
- **No table (order at counter, collect by code):** keep Dine-In without the table field; the pickup code is enough.
- **No dine-in:** drop the mode (see question 1).

**In code:** `brand.store.tables`, `TableChips` in `src/components/checkout/ContextFields.tsx`.

**Decision:** ______

---

## 9. Is in-car ordering required?

**Prototype assumes:** yes.
- **Ordering:** the customer enters make and model, colour and plate (all required), with a pickup slot.
- **Arrival:** the order waits at "Ready to bring out" until they tap **I'm here**, then a barista brings it out.

**Impact of the answer**
- **Yes:**
  - **On site:** needs marked parking bays and staff free to run orders out.
  - **Dashboard:** needs an "arrived" alert showing the car.
  - **Optional:** a geofence that taps "I'm here" automatically. That needs background location permission, more privacy review and a development build.
- **No:** remove the mode, the car fields and the "I'm here" flow.

**In code:** `CarFields` in `src/components/checkout/ContextFields.tsx`, `markArrived()` in `src/api/index.ts`, and the in-car branch in `src/app/order/[id].tsx`.

**Decision:** ______

---

## 10. What are the final menu items, prices and modifiers?

**Prototype assumes:**
- **Menu:** 21 placeholder products in 6 categories: Coffee, Tea & Matcha, Iced & Cold, Breakfast, Bakery & Snacks, Desserts.
- **Modifiers:** 12 reusable modifier groups, such as Size, Temperature, Milk, Shots, Syrup, Sweetness, Extras, Bread and Add-ons.
- **Pricing:** INR in whole rupees, set at Bengaluru specialty-café levels (espresso ₹160, latte ₹250, Spanish latte ₹310, croissant ₹180, avocado toast ₹420; size M +₹30 / L +₹60, plant milk +₹40–50, syrups +₹40), GST 5% added at checkout. Coupons: FIRST20 (20% off the first order, up to ₹150), EMBER100 (₹100 off from ₹500), WELCOME10 (10% off).
- **Product details:** demo ratings, kcal values and prep times.
- **Photos:** Unsplash stock photos, cut out into transparent product images and bundled with the app (works offline). Real product cut-outs from the client replace them.

**What we need from the client** (a spreadsheet is fine):

| Sheet | Columns |
|---|---|
| Categories | name, order, (optional) photo |
| Products | name, category, description, price, sale price, **veg / egg / non-veg**, dietary tags and allergens, kcal (if shown or legally required), prep minutes, badge (best seller / new / seasonal), photo |
| Modifier groups | name, required?, single or multi, min / max selections, default option |
| Options | group, name, price change, kcal change, available? |
| Product ↔ groups | which groups each product uses, in order |
| GST | rate (5% assumed) and whether prices are shown inclusive or exclusive of GST; GSTIN for invoices |

**Impact**
- **Data entry:** done through the admin dashboard (question 12), or seeded once from the sheet.
- **Ratings:** the star ratings are fake. Either remove them or plan a review feature.
- **Photos:** cut-out product photos, transparent PNGs of at least 1000 px, make the biggest visual difference (DESIGN.md §10).

**In code:** `src/data/mock/menu.ts`, `src/data/mock/modifiers.ts`, and `brand.currency` / `brand.taxRate` / `brand.taxLabel` in `src/theme/brand.ts` (all money goes through `roundMoney` and `formatMoney` there).

**Decision:** ______

---

## 11. What are the brand colors, logo and typography?

**Prototype assumes:**
- **Identity:** the placeholder "Ember Roast Coffee", with a warm cream, espresso, peach and sage palette.
- **Type:** Outfit for the UI and Fraunces Italic for the wordmark.
- **Mark:** a line-art bean.
- **App icon and splash image:** a placeholder Ember Roast bean mark (peach line-art on espresso), to be replaced with the client's logo.

**Impact**
- **Rebrand effort:** a token swap with no screen rewrites. The files involved:
  - `src/theme/brand.ts`, `src/theme/palette.ts` (light and dark colours) and `src/theme/index.ts`;
  - `src/data/mock/photos.ts`;
  - `app.json` and the files in `assets/`.

  See [README → How to rebrand](../README.md#how-to-rebrand).
- **Fonts:** custom fonts must be licensed for app embedding; Google Fonts (OFL) need no licence.
- **What we need:** a logo (SVG), an app icon (1024 px), the brand colors, fonts, and the tone of voice for copy.
- **Store listings:** these assets are also needed for Phase 8.

**Decision:** ______

---

## 12. Does the client need a web admin dashboard?

**Prototype assumes:** no dashboard. The menu lives in code, and an on-device simulator plays the café's role in moving orders along.

**Impact of the answer**
- **Yes, a Next.js dashboard (PRD §21, Phase 6):**
  - orders board, accept or reject, status changes, in-car alerts;
  - menu, modifiers and the sold-out toggle;
  - image uploads, promotions, coupons, rewards and basic reports.

  Outline in [SUPABASE_PLAN.md](SUPABASE_PLAN.md) §11.
- **No:** the app cannot run a real café, because nobody can see or accept orders. The bare minimum is an orders board plus a sold-out toggle. Supabase Studio can edit data in the meantime, but it is not suitable for baristas.
- **POS integration instead:** orders print on the café's POS and the menu syncs from it. This depends on the POS vendor's API, which ties into question 5.

**Decision:** ______

---

## Other decisions the prototype surfaced

These are not in PRD §28, but the build needs an answer:

| Topic | Prototype assumes | Question |
|---|---|---|
| Store hours | 7am–9pm every day; outside hours, the slot chips offer tomorrow ("Keep store open (demo)" is on by default for demos) | Real hours, holidays, and should customers schedule ahead when closed? |
| Pickup slots | ASAP or 6 slots in 10-minute steps, at least 10 minutes ahead | Slot length and how far ahead? Any capacity limit per slot? |
| Cancellation | Customers can cancel while the order is Placed or Accepted; refunds are automatic | Is that the right cut-off? Who approves refunds after that? |
| Markets | India only: Indian mobiles (+91, 10 digits starting 6–9), INR, one Bengaluru café (Indiranagar) | Confirm the store address and coordinates. SMS OTP in India needs DLT registration (sender ID and template) with the SMS provider before launch |
| Cup sizes | Still labelled 8 / 12 / 16 oz | Switch to ml (240 / 350 / 470 ml) or plain Small / Regular / Large for India? |
| GST invoice: seller details | Paid orders show a mock tax invoice from "Ember Roast Cafés Pvt. Ltd." with a **placeholder** GSTIN `29AAHCE1234F1Z5` and a **placeholder** FSSAI licence number `11224333000123` (`SELLER` in `src/components/invoice/invoice.ts`). The invoice number is the financial year plus the order number (`ER/2026-27/004827`). Place of supply is Karnataka (29), with SAC 996331 and CGST 2.5% + SGST 2.5%. Every invoice says "Prototype — not a valid tax invoice." | We need the café's legal name, registered address, GSTIN and FSSAI licence number. Which invoice series should we use (one sequence per financial year)? Who issues the real invoice: the POS, the payment gateway or our backend? Does the café's turnover require e-invoicing? Confirm the 5% rate with the accountant (see question 5). |
| Packaging charge | ₹15 per order for Pickup, In-Car and Delivery, none for Dine-In. It's its own line on the cart, checkout, receipt and invoice, and GST is charged on it (`PACKAGING_FEE` / `packagingFee()` in `src/lib/pricing.ts`) | Charge for packaging at all, or build it into the prices? Should it be a flat fee per order or per item or cup? Should In-Car pay it? Is the amount right? |
| Delivery partner tip | Delivery only. **No tip** is the default, then ₹10 / ₹20 / ₹30 or **Other** (₹1–₹500, whole rupees). It's added after GST, so it's never taxed, never discounted and earns no points. It's stored with the order, shown on the receipt and as "not taxed" on the invoice, and is part of the total, so cancelling a paid order refunds it with the rest (`TIP_PRESETS`, `TIP_MAX` in `src/lib/pricing.ts`) | Offer a tip at all? Who receives it (the café's own riders or a delivery partner through an API), and how is it paid out to them? Are the presets and the ₹500 cap right? Ask for the tip at checkout only, or also after delivery? |
| UPI provider and flows | A mock "intent" flow (pick Google Pay, PhonePe, Paytm or BHIM, then approve in that app) and a mock "collect" flow (**Pay with UPI ID**, checked as name@handle). Both pay the café's placeholder UPI ID `emberroast@icici` (`MERCHANT_VPA` in `src/data/mock/marketing.ts`) within a 5:00 approval window. App names are text with a monogram, no logos. No real app opens and no request is sent | Which gateway / payment provider (question 5)? List fixed UPI apps, or let the gateway show the ones installed on the phone? Keep paying by UPI ID? It depends on the gateway supporting collect requests for the café. What are the café's real merchant UPI ID and bank? Use the apps' logos, which needs each brand's usage rules? Should the rider carry a UPI QR for cash on delivery? |
| Veg / egg / non-veg marks | Every item carries the Indian diet mark (`diet` in `src/data/mock/menu.ts`, drawn by `VegMark`). Assumed: every drink is **veg** (dairy counts as veg); Avocado Toast **veg**; Bacon & Egg Brioche **non-veg**; Butter Croissant (egg wash), Banana Bread, Sea Salt Choc Chip Cookie, Basque Cheesecake, Fudge Brownie and Espresso Tiramisu **contain egg**. Egg items no longer say "Vegetarian" (Indian usage). With **Veg only** on, Bakery & Snacks and Desserts are empty | Confirm each item's mark, ideally from the kitchen's recipes (it's an FSSAI labelling matter, not a design choice). Does the café bake **eggless** versions (eggless brownie, eggless croissant)? Those sell well in Bengaluru and would keep the bakery visible to veg-only customers. Show an egg mark at all, or fold egg into non-veg? Is "Veg only" a whole-app mode (Home too) or just the menu filter it is now? |
| Favourites | Saved on the device per mobile number; Home's "Popular now" becomes "Your favourites" once there is one | Should favourites sync to the account (needs the backend, Phase 4)? Keep "Popular now" on Home as well? |
| Notifications | Order updates on by default, marketing off (opt-in) | Which events push? Marketing pushes and their frequency? |
| Single store | One store (PRD §1) | Any plan for a second location? It affects the schema early (`store_id` is already planned) |
| Dark mode | Built as a user setting (Settings → Preferences → Appearance: System / Light / Dark; DESIGN.md §R4). The dark palette keeps the brand: an espresso-night canvas, the product tiles lifted in their category colours, the peach total card and the colour promo banners unchanged, and the black primary buttons turned cream so the main action stays the brightest thing on screen. Every screen is converted, so "System" (the default) now follows the phone | Is the cream primary button right for the brand in dark, or should dark use a peach / ember primary? Should the app follow the phone's setting by default (the prototype does), or stay light unless the customer chooses Dark? Any brand rule for the logo on dark (store listing screenshots need both)? |
| Accounts and costs | n/a | Apple Developer, Google Play, SMS, payment, maps and hosting accounts in the client's name (PRD §30) |
