# Ember Roast: Design Direction

The visual direction for the coffee-shop app prototype. It combines three reference shots:

| Ref | Source | Weight | What we take |
|---|---|---|---|
| **1** | "Everyday a new pizza" concept (dark onboarding, tinted product detail, black pill CTAs, peach cart summary) | **~40%** | Onboarding mood, product-detail layout, cart layout, black pill action bars with a white circle button, split-weight titles, notched bottom sheets, circular size selectors |
| **2** | "Java Café / Emura Studio" coffee & pastries | **~40%** | Warm cream palette, espresso browns, uppercase screen headers, product grid cards, outlined category chips, mode cards with icon and subtitle, greeting + points pill, options list with "Choose One / Optional" tags, kcal badge, serif-italic accent, sticker badges |
| **3** | "delivo" food delivery | **~20%** | Location header with chevron + bell, search bar, bold promo banner with code chip, category tiles, time/price chips on cards, floating pill bottom nav with an expanded active tab |

The references are for UX and mood only. Don't copy their brands, logos or exact layouts (PRD §25). The full written description of the three shots is in `docs/references/REFERENCES.md`. **§R3 below is the current art direction and overrides the older sections (§0–§10) wherever they conflict.**

**Market (INR round).** The app is localised to India: one café in Indiranagar, Bengaluru; whole-rupee prices with Indian digit grouping (₹250, ₹1,250, ₹1,25,000; `formatMoney`, `RollingNumber money`); "GST (5%)" instead of "Tax"; Indian mobiles shown as "+91 98765 43210"; Bengaluru addresses with 6-digit PIN codes; demo promo codes FIRST20 (20%, max ₹150), EMBER100 (₹100 off from ₹500) and WELCOME10. Example copy in this spec uses those values. Outfit has no "₹" glyph: on web `src/theme/currencyGlyph.web.ts` maps it to a system face of the same weight, and the odometer draws it in the system face itself; never fake it with a different symbol.

---

## R3. Art direction — 10/10 pass (supersedes earlier sections where they conflict)

**Goal.** Keep the vibe, the palette family and every motion the client likes. Remove what makes the app read as "AI-made": filler doodles, round photo stickers, identical white cards, chip and eyebrow clutter, chatty copy and shouting uppercase. The target is a polished Dribbble shot: one focal point per screen, cut-out products, clear tonal planes and a lot of restraint.

**Dark mode** is specified in §R4 below (same composition, re-mapped planes).

**Visual targets.** The mocks in `docs/references/r3-mocks/` (390×844) show the intended composition and scale: `r3-onboarding`, `r3-home`, `r3-menu`, `r3-product`, `r3-cart`, `r3-confirmation`. The written spec below wins where they differ. The reference shots are described in `docs/references/REFERENCES.md`.

**Five laws (apply to every screen):**
1. **Products are cut-outs.** Every product image is a transparent cut-out on a tinted plane, with a soft contact shadow. There are no circular photo crops and no rings.
2. **One focal point.** Each screen has one hero element (the biggest thing on screen), one ink primary action and at most one ember element.
3. **Fewer containers.** Content sits on the canvas. White is only for lists, forms and the two notched sheets. Never stack white card on white card, and never put a shadow on a white container.
4. **Quiet words.** Sentence case. No section subtitles unless this spec lists one. Titles ≤ 6 words, captions ≤ 12 words. No exclamation marks, sparkles or emoji.
5. **Icons earn their place.** An icon must be a control, navigation, or a state. No decorative icon discs.

### R3.A Global system

#### A1. Tonal planes and colour tokens (`src/theme/index.ts`)
There are three clear planes: **canvas** (cream), **tint** (category-coloured tiles and heroes, a visible step darker and warmer than the canvas) and **white** (lists and sheets only). The dark plane is **night** (full-screen dark moments).

| Token | Old | **R3 value** | Use |
|---|---|---|---|
| `bg` | `#F6F1EA` | **`#F3ECE3`** | Canvas, slightly deeper so white sheets read as a plane. Also the fill for controls *inside* white sheets (price pills, qty circles, stepper buttons, input fill). |
| `surface` | `#FFFFFF` | `#FFFFFF` | Lists, forms, notched sheets. Never product cards. |
| `line` | `#E4DACD` | **`#E6DCCF`** | Hairlines on white, outlined chips, mode-card borders |
| `inkSoft` | `#6E625A` | `#6E625A` | Captions (5.1:1 on bg) |
| `night` **(new)** | — | **`#15110E`** | Splash, onboarding, auth top, confirmation, payment reveal. It replaces `espresso` on those screens. Ref 1 calls for near-black, not brown. |
| `glow` **(new)** | — | **`#F08A3C`** | Only the onboarding capsule dot, with a glow shadow `0 0 14px 4px rgba(240,138,60,0.75)` |
| `espresso` | `#3B2618` | keep | Tracking hero card only |
| `roast`, `peach`, `ember`, `sage`, `sageDeep`, `danger` | | keep | Unchanged roles. Ember is limited to one element per screen. |

**Tile tints (new export `tileTints`, same keys as `heroTints`).** Use them for product tiles, category tiles and list thumbnails.

| Key | Tile (`tileTints`) | Hero (`heroTints`, R3: one step deeper than its tile) |
|---|---|---|
| `coffee` | `#EBDBC6` | `#E7D4BD` |
| `tea` | `#DCE5CF` | `#D5E0C7` |
| `cold` | `#D8E2EC` | `#D1DDE9` |
| `breakfast` | `#F2E0BE` | `#EFD9B0` |
| `desserts` | `#EFD8DA` | `#EBCFD2` |
| `snacks` (bakery) | `#EEDDC8` | `#E9D6BF` |

Ambient glow: dark screens get one radial gradient of `peach` at 10–22% (positions are given per screen). No other gradients, except the store card (A10) and the existing payment card.

#### A2. Shape language
- **Rounded squares** for anything that holds a product: tiles `radii.tile = 28` (≥ 140px), category tiles `22` (64px), list thumbnails `radii.thumb = 20` (64px), small thumbnails `16` (≤ 56px).
- **Sheets** `radii.sheet = 32`. **Banners** `radii.banner = 30`. **Primary bar** stays a 64px pill. Disabled keeps the ink fill and drops the `cta` shadow: label white 50%, circle white 14% with the glyph at 60% (never a greyed taupe pill). On web it stays clickable (`aria-disabled`), so a tap still shows what's missing.
- **Circles are reserved** for icon buttons, `+`/`−`, size selectors, the cart count badge, avatars (initials only), page dots, status dots, radio buttons and the kcal badge. **Never a product photo.**
- **Notches:** concave notches appear only on the product sheet, the cart list sheet and the cart's peach card (ref 1). No notch anywhere else.
- Vary scale on purpose. Each screen has one element at least 2× bigger than anything else: the hero product, the total, the headline or the code.

#### A3. Elevation and shadows
| Token | Value | Use |
|---|---|---|
| **contact** (component, not boxShadow) | `ContactShadow`: an SVG `RadialGradient` ellipse, width = 62% of the art box, height = max(8, 7.5% of art box), centred at 95.5% of the art box height. Colour `#3B2618`, centre alpha 0.26 on tiles and 0.30 on heroes, fading to 0. | Under every cut-out on a light plane. On `night`, use a black pool (alpha 0.55) or omit it. |
| `float` **(new)** | `0px 10px 30px rgba(59,38,24,0.12)` | Tab bar, floating cart bar, toasts |
| `cta` (= old `strong`) | `0px 12px 24px rgba(28,23,20,0.22)` | Ink primary bar, white CTA on night |
| `soft` / `card` | — | **Retire on all cards, rows, tiles and sheets.** Planes separate by colour. Press feedback keeps its shadow-on-press layer only on the primary bar. |

#### A4. Product art: cut-outs (the single biggest fix)
- **Assets are ready.** `assets/products/<photoKey>.webp` holds 21 transparent cut-outs, one per `PHOTOS` key: 900×900 WebP with alpha, about 1.2 MB in total. Each subject is centred horizontally, with its base 3% above the bottom edge (where `ContactShadow` sits) and at least 6% clear space on the other sides. Scale is matched across the set: cups with saucers and plates fill the width, and tall glasses are sized by height. They were made with BiRefNet matting plus edge-colour decontamination. `docs/references/tools/cutout.py` was the earlier ISNet feasibility test, and its contact sheet is out of date.
- **Sources replaced.** 20 of the 21 product photos now come from new free Unsplash photos that cut out cleanly; only `coldBrew` keeps its old photo. Photographers and links are in `docs/research/photos/CREDITS.md`. `PHOTOS` values are `local:<key>` strings.
- **Resolution layer:** `src/data/mock/photoSource.ts`, already being wired in this round. Image fields stay plain strings. Bundled art is addressed as `local:<key>`, `photoSource(image)` returns the expo-image source, `isCutoutPhoto(image)` says whether it's a transparent cut-out, and Unsplash URLs persisted by earlier builds map onto the bundled cut-out by photo id. Product-art components branch on `isCutoutPhoto`; there's no second lookup table.
- **`ProductArt({ image, size, shadow = 'light' | 'dark' | false, float?, style })`** renders a `size × size` box: `ContactShadow`, then `expo-image` with `contentFit="contain"` and `transition={250}`. **Fallback** (`isCutoutPhoto` false, e.g. a remote URL or a scene): the image with `contentFit="cover"` in a rounded square (radius = size × 0.22), never a circle.
- **`ArtTile({ image, tint, width, height, radius, artSize })`**: the tinted rounded square with `ProductArt` inside, horizontally centred, art box bottom = tile bottom − 6.
- **`Photo` (circle) and `ThumbStack` (ringed circles) are retired for products.** Every call site (`grep -rn "<Photo\|<ThumbStack" src`) switches to `ProductArt`/`ArtTile` or `ArtCluster` (below). `StoreCard` drops its photo.
- **Non-product images get a product.** Every image on a product-art surface must have a cut-out. In `marketing.ts`, set `promo-first` and `promo-regular` to `PHOTOS.icedLatte` (was `latteArt`) and `rw-10off` to `PHOTOS.cookie` (was `pastries`). The scenes (`latteArt`, `beans`, `pastries`, `cafeInterior` in `assets/scenes`) aren't rendered on product surfaces. A scene may appear only as an opaque full-bleed background, and none is specified in R3.
- **`ArtCluster({ images, sizes, offsets, rotations })`**: overlapping cut-outs with no rings and no `+N` bubble (show at most 3). Used in the peach card, order cards, checkout and confirmation.
- **Angles:** the whole set is shot from one low angle, so every item stands on its contact shadow. Hot drinks are three-quarter (cup on saucer), cold drinks are side-on, and food is three-quarter. No asset is overhead.

**Scale table (390pt wide reference, scale proportionally):**
| Surface | Container | Art box | Placement |
|---|---|---|---|
| Grid card (Menu, Category, Search empty-state rail) | Tile `w × w·1.05`, w = (W − 40 − 14)/2 = 168, r28 | 0.81w = 136 | Centred; box bottom = tile bottom − 6 |
| Home "Popular now" rail card | Tile 156×164, r28 | 128 | Same |
| Home category tile | 64×64, r22 | 56 | Box bottom = tile bottom − 2 |
| List thumbnail (cart, search results, past orders, rewards, checkout lines) | 64×64, r20 | 58 | Centred |
| Small (active-order strip, notifications) | none | 48–54 | Overflows its strip by 4px at the top |
| Product hero | Hero plane | min(W·0.80, 320, space under title) | Centred; base 26px above hero bottom (inside the sheet notch) |
| Category hero | Hero plane | 190 | Right −36 (bleeds off the right edge), bottom −8 |
| Promo banner | Banner | 200 | Right −6, top −40 (bleeds above the banner) |
| Peach total card | Card | 100 / 96 / 88 | Bleeds off the bottom-right, rotations −10° / 8° / −4° |
| Orders active card | Card | 2 × 64, overlap 22 | Top-right |
| Confirmation | Night canvas | 230 / 170 / 140 | See B › Confirmation |

#### A5. Typography (Outfit + Fraunces)
Load **`Fraunces_400Regular_Italic`** in `_layout.tsx` next to the existing 600 italic. Add `fonts.serif = 'Fraunces_400Regular_Italic'`. Never set `fontWeight`.

| Token | Spec | Use |
|---|---|---|
| `display` | Outfit 300, 52/56, ls −1.6 | Onboarding headlines, confirmation "Order" |
| `title` **(new)** | Outfit 700, 30/36, ls −0.4, **sentence case** | Every screen title ("Cart", "Checkout", "Orders", "Rewards", "Profile", "Settings", "Help", "Order type", "Delivery address", "Payment") |
| `screenTitle` | Outfit 800, 28/34, ls 0.6, UPPERCASE | **Only "MENU"** (ref 2's "PICK UP") |
| `heroTitle` | Outfit 700 + 300 split, 30/36 | Product detail hero. Category hero uses 700 34/40. |
| `greeting` **(new)** | Outfit 300, 32/38, ls −0.6, plus the name in `fonts.serif` 35 | Home |
| `h2` | Outfit 600, 19/24 | Section headers |
| `h3` | Outfit 600, 16/22 | Row titles, sheet labels |
| `cardName` **(new)** | Outfit 600, 15/20 | Product card names |
| `body` | Outfit 400, 15/22 | |
| `caption` | **Outfit 400, 13/18** (was 12/16) | Secondary lines, `inkSoft` |
| `micro` **(new)** | Outfit 700, 10/12, ls 0.8, UPPERCASE | Stickers only |
| `priceHero` **(new)** | Outfit 700, 44/48, ls −0.5 | Cart and checkout total. Payment amount uses 52/56. |
| `code` **(new)** | Outfit 800, 46/50, ls 3 | Pickup code (confirmation, tracking) |
| `watermark` **(new)** | `fonts.serif` 96/110, ink at 4.5% | Menu header watermark |

**Fraunces whitelist (at most one serif moment per screen):** wordmark (600, splash and auth), Home greeting name, Menu watermark "Ember Roast", Confirmation "placed.", Rewards tier name and the existing "Ember" watermark, Profile footer wordmark.
**Uppercase whitelist:** "MENU", sticker text (BEST SELLER, NEW), promo code chips (WELCOME10), payment card face (VISA). **Everything else is sentence case.** That includes section labels, the pickup-code label, "Live" and status names. Delete all uppercase eyebrows: ORDER TYPE, CONTACT, YOUR ORDER, SAVINGS, PAYMENT, HOW YOU'LL GET IT, SAVED ADDRESSES, ORDERS & REWARDS, PREFERENCES, SUPPORT, FREQUENTLY ASKED, YOUR BALANCE, ORDER NUMBER, AMOUNT DUE, YOUR CODE, the product category eyebrow (COFFEE / BAKERY & SNACKS), PAIRS WELL, YOUR USUAL · TODAY, LIVE · PICKUP · ER-…, EMBER ROAST (store card) and TODAY/YESTERDAY group headers.

#### A6. Copy voice
Short, confident and human, like a good barista talks. Prefer numbers to adjectives ("Ready in ~6 min"). Buttons are verbs. Don't use: crafting, magic, ritual, "we'll buzz", "ready to brew", "every sip", "your way", "a tap away", exclamation marks or emoji. **A section header gets no subtitle unless one is listed in B.**

**Rewrite list (current → R3):**
| Where | Current | R3 |
|---|---|---|
| Onboarding 1 | "Your daily ritual, brewed for you" + paragraph + 3 feature pills | "Good coffee, / ready when / you are" (3 fixed lines, no body) |
| Onboarding 2 | "Find your nearest café" + 2-line body | "Find your / nearest café". Body: "We'll show what's open near you and where we deliver." |
| Onboarding 3 | "Know the moment it's ready" + "Choose what we send…" | "Know the / moment it's / ready". Body: "Order updates only. Offers are up to you." |
| Phone | "Welcome / Enter your phone number to sign in or create an account." | "What's your number?" / "We'll text you a 6-digit code." |
| Phone | chip "Prototype: any number works" | delete |
| OTP | "Verify your number" | "Enter the code" / "Sent to +91 98765 43210 · Edit" |
| OTP | chip "Demo code: 123456 · tap to fill" | text button "Use demo code 123456" |
| Home | "What Market Street is ordering today", "Switch any time before checkout", "Pastries and cakes, made here every morning" | delete (the sections go too) |
| Home | "+2 more orders in progress · View all" | "+2" inside the active-order strip |
| Menu / Category | all `categoryCopy.ts` subtitles ("Pulled to order on our house blend", …) | delete |
| Search | "Most ordered at Market Street" | delete |
| Cart | "3 items · ready to brew" | delete (the badge shows the count) |
| Cart | "Swipe left to remove · tap an item to edit it" | delete (a one-time swipe nudge replaces it, see C) |
| Cart | "PAIRS WELL / +$3.60 · Baked at 6am · 2 min" | "Often added · ₹180" |
| Cart / Checkout | "Got a code? WELCOME10 takes 10% off." | placeholder "Promo code", caption "Try WELCOME10" |
| Empty cart | "Let's fix that. Fresh espresso, flaky croissants, all a tap away." | "Your cart is empty" (no message) + "Browse menu" |
| Mode sheet | "Same menu, four ways to get it" | delete |
| Checkout | "You'll confirm payment on the next step" | delete |
| Payment | "AMOUNT DUE", "Secure demo checkout · no real charge" | delete / "Demo checkout · no real charge" |
| Confirmation | "Order placed!" / "Thanks, Ava. Your barista is on it." / "+101 pts on completion" | "Order / *placed.*" / "Ready for pickup in ~8 min at Indiranagar" / delete |
| Tracking | "Your barista is crafting your order." / "Pulling your shots now" | "Being made now" / delete |
| Orders | "Track live orders, reorder favourites", "Live updates · we'll buzz you when it's ready" | delete |
| Rewards | "Every sip earns you something", "Every 10th drink is on us", "7 more to a free drink." | delete / "10th drink free · 7 to go" |
| Profile / Settings / Help | "Your account, your way", "Make Ember Roast work your way", "We're here for you, every day", "How can we help? Answers to the questions we hear most at the bar." | delete |
| Settings demo | "Prototype-only switches for walking a client through every state." + three-line captions | delete / one line each: "Requests fail with a network error", "Steps advance every few seconds", "Order outside 7am–9pm" |

Tests that assert removed strings must be updated, not the copy kept.

#### A7. Chip, badge and sticker budget
- **Product card:** at most **one** sticker. Priority: Sold out > BEST SELLER > NEW. A sale shows only in the price row (ember price plus struck-through old price), never as a sticker. **Delete from cards:** the rating chip, the meta line (clock · kcal), the LOW CAL stamp and the SEASONAL sticker.
- **Data:** only `caramel-macchiato` keeps BEST SELLER and only `spanish-latte` keeps NEW. Other badges stay in the model but don't render. Low-cal stays a search filter and lives in the detail kcal badge.
- **Chips exist only in:** Menu category chips (text only, no icons, no counts), Category filters (All / Iced / Dairy-free / Low cal, text only), Search (recent ≤ 3, popular ≤ 6, text only) and pickup-time slots. Nowhere else.
- **Status:** "Completed" and "Delivers" chips are deleted, because the default state needs no label. Only exceptions show, as plain 13/500 text: "Cancelled" and "Out of range" in `danger`, "Refunded" in `inkSoft`.
- **Product detail:** dietary pills and meta chips become text (see B).
- **Per screen:** at most 1 ember element, at most 2 stickers visible in any viewport, and no sparkle icon anywhere (delete `sparkle` from every icon and line-art call).

#### A8. Icons
- The line set and stroke 1.75 stay. Header icon buttons are 44px white circles with 20px glyphs; the primary-bar circle is 52px with a 22px glyph.
- **Allowed:** icon-only buttons (back, cart, bell, search, close, edit, +/−), tab bar, the primary-bar circle, the floating cart bar's bag, the pin before the store name in the Home header, state glyphs (check, cloud-off), mode glyphs in mode cards (26px, no disc), payment brand marks, and the rating star as an inline text glyph (`★`, roast).
- **Delete:** every beige or black **icon disc** (profile, settings, address, checkout, help, mode cards, notification prefs, menu section headers, onboarding toggles, store card); leading icons in text buttons ("Browse menu", "Order again", "Allow location", "Enable notifications", "Reorder"); clock and flame icons in chips; clock icons before prep times; info icons in callouts; the chevron's coloured circle in the FAQ.

#### A9. Decoration and illustration
- **No filler doodles.** Remove `LineArt`/`LineArtField` from Help, Payment, NoDeliveryCard, PointsHero (keep its watermark), PaymentCardVisual, StoreCard, CategoryHero, HomeFooter, NotificationsPopover, EmptyState, Confirmation and the auth `LineArtField` variant.
- **One bold composition is allowed** on onboarding (each page) and the auth top, which reuses the onboarding page-1 composition. The confirmation uses product cut-outs and confetti instead of doodles. The splash bean mark and the wordmark bean stay, because they're the brand mark.
- **Doodle style:** existing `LineArt` drawings rendered **big** (74–196px), rendered stroke **2.2px** (`strokeWidth={2.2}`, which is in px), `peach` or white at 85–92%, rotated −16° to 26°, several **cropped by the screen edge**. No sparkles, no circle behind them, no pin/bell/bag icons on page 1, and no notification cards or labels.
- **Onboarding page-1 composition** (390-wide frame, y from screen top assuming a 47pt safe area; add `safeTop − 47`; scale x and size by W/390, and scale y by min(1, (capsuleTop − 16) / 362)):

| Drawing | x | y | Size | Rotation | Colour |
|---|---|---|---|---|---|
| croissant | −46 | 92 | 168 | −16° | peach |
| cup | 128 | 22 | 118 | 8° | white 92% |
| portafilter | 250 | 104 | 196 | 26° | peach |
| beans | 24 | 262 | 84 | 18° | white 90% |
| latte | 140 | 186 | 132 | −10° | peach |
| cookie | 300 | 280 | 86 | 0° | white 85% |

Page 2 keeps croissant and portafilter at the same positions. It replaces the middle with latte (40, 150, 120, −8°, peach), a route of 8 dots (4px, white 50%) curving to a **pin** (196, 96, 150, 6°, peach with a white accent) and beans (300, 290, 70, 18°, white). Page 3 keeps croissant and portafilter, and adds a **bell** (110, 80, 160, −8°, peach with a white accent), steam (60, 250, 70, white) and cookie (290, 270, 86, white). Delete the dim circle, the "Market Street · 800 m" chip and the notification preview cards.

#### A10. Containers and lists
- **White containers only for:** lists of rows, forms and inputs, and the product and cart notched sheets. **No white container for:** product cards, category tiles, the promo, the store card (gradient), the greeting or the profile identity block.
- **One list = one white sheet** (r28, no shadow, no border). Rows are separated by hairlines inset to where the text starts. Rows are 56px with one line or 68px with two. Row anatomy: title 16/500–600 ink, optional right value 15/400 `inkSoft`, chevron 18 `inkMuted`. No per-row cards and no sub-captions that repeat the value.
- **Section labels** above a sheet: Outfit 600 15 `inkSoft`, sentence case, 24px above and 8px gap. Omit the label when the content is obvious.
- **Outlined cards** (mode cards only): white, 1px `line`, r22, no shadow.
- **Store card** (Menu row and mode sheet): gradient `#FBF4EA → #F1E2CE` at 100°.

### R3.B Screens

#### Splash
Background is `night` instead of espresso, so splash → onboarding is one continuous dark. Everything else stays.

#### Onboarding ×3 (ref 1), see `r3-onboarding.png`
- **Canvas:** `night` plus a radial peach glow at 10% (ellipse 120%×60% at 80% 18%). No wordmark on the screen (the splash just showed it).
- **Top right:** "Skip" on page 1, "Not now" on pages 2–3. Outfit 500 15, white 60%, top = safeTop + 12, right 22, 44px hit area.
- **Doodle field:** A9 composition from y 0 to capsuleTop − 16.
- **Sage capsule:** left = 0.30 W (116), width = W − left + 32 (**bleeds 32px off the right**), height 140 (`min(140, H × 0.166)`; 112 on 667pt screens), radius h/2, top = 0.448 H. Inside: a white wave 1.8px at 95% opacity, amplitude 16, wavelength 176, from x 22 to the right edge; the `glow` dot 14px with a 44px halo (white 24%). The dot travels the wave with progress, as now.
- **Headline:** `display` white, left 24, top = capsule bottom + 34, explicit line breaks, 3 lines max. On 667pt screens use 44/48.
- **Body** (pages 2–3 only): 15/22 white 58%, 12px below the headline, 2 lines max.
- **Page 3 toggles:** two rows straight on the night canvas with no container and no icons. "Order updates" (on by default) and "Offers & new drinks" (off): label 16/500 white, caption 13 white 50%, toggle on the right, hairline white 12% between them, 16px below the body.
- **Page dots:** left 24, vertically centred on the button's centre. Active 24×6 white pill; inactive 6px white 30%.
- **Big button:** 96px circle, **right −14 (bleeds off the right edge)**, bottom = safeBottom + 20. Glossy gradient 150° `#4B4440 → #2A2522 → #1C1815`, inner top highlight 1px white 18%, shadow `0 18px 40px rgba(0,0,0,0.45)`, arrow 30px at stroke 1.4 white. Peach arc: 2px stroke on r61 (128 box, concentric), sweep 34% → 100% with progress, starting at 150°.
- **Actions:** page 1 goes to the next page. Page 2's button requests location then advances (a11y "Allow location and continue"). Page 3's button enables notifications and finishes. "Not now" advances without asking. This is the standard pre-permission pattern.
- **Delete:** the dim circle, sparkles, feature pills, the "01 / 03" counter, the white "Allow location" and "Enable notifications" pills with their "Not now" buttons, the notification preview cards, the distance chip and the top wordmark.

#### Phone / OTP / profile
- **Top:** `night` area, 40% of H, holding the page-1 doodle composition at scale 0.9 so the croissant and portafilter crop off the edges. It draws on.
- **Wordmark:** "Ember Roast" in Fraunces 600 Italic 40 white, left 24, 56px above the sheet. **Delete** the bean disc, the big circle and the tagline.
- **Sheet:** `bg`, r32 top, padding 24. Title `title` 28/34, caption 15 `inkSoft`. Phone field: country pill plus a 56px white field, r16, 1px `line` border; focused = 1.5px ink. OTP: 6 boxes 48×60 r14 white. Under them, one caption row: "Resend in 0:28" left, "Expires 1:58" right, no clock icon. Then the text button "Use demo code 123456" (14/500 roast). CTA: PrimaryBar.
- **Profile:** "What should we call you?" plus the fields. Same scaffold.

#### Home (≈5 sections), see `r3-home.png`
1. **Header** (top safeTop + 8, 48 tall): on the left, the pin glyph plus a 2-line block: caption "Pickup · ● Open until 9pm" (12/16 `inkSoft`, sageDeep dot) over "Indiranagar ⌄" (17/600). Tapping it opens the mode sheet; it **is** the ordering-mode switch. On the right: bell and cart in 44px white circles.
2. **Greeting** (16 below): "Morning, *Ava*" (`greeting`; Morning / Afternoon / Evening by the clock) with the points pill on the right (roast, 36h, "610 pts" 14/600 white, **no sparkle**). **Delete the avatar.**
3. **Search pill** (16 below): white, 52h, r26, no shadow, rotating placeholder.
4. **Active-order strip** (only when an order is active, 16 below): ink, 64h, r22. Cut-out 54 at left 4 (overflows the top by 4). "Preparing" 15/600 white with " · ready in ~6 min" at 60%. A 3px progress bar (peach on white 15%) under the text. Chevron on the right; "+2" (13/600 white 60%) before the chevron when there's more than one order. Tap goes to the order, or to Orders when there's more than one. Replaces the white status card and its "+2 more…" line.
5. **Promo carousel** (24 below): banner 178h, r30. Ember first, then espresso and sageDeep. White code chip (26h, ember 12/700) top-left 22/22. Headline 26/30 700 white, 2 lines, 52% width. Ink "Order now" pill 38h bottom-left. **Promo cut-out 200px at right −6, top −40, bleeding above the banner.** The carousel ScrollView gets 40px top padding so the bleed isn't clipped. Delete the ringed circle photo. Dots 12px below.
6. **Categories** (28 below): **no header.** One row of 64px tinted tiles with signature cut-outs, 74px pitch (the 6th peeks), label 12/500 ink centred 8px below. Delete corner glyph discs, rings and the "Full menu" header.
7. **Popular now** (28 below): `h2` + "See all" (14/500 `inkSoft`), rail of R3 product cards (156 wide). No subtitle.
8. **Order again** (28 below, only with a completed order): `h2` "Order again". One white row, r28, 96h: a coffee tile 80×80 r22 holding 2 overlapping cut-outs; title (item names only, no modifiers: "Caramel Macchiato + Butter Croissant", 15/600, 2 lines at 390pt and up to 3 on a 375pt phone so both names survive); caption "₹550 · 2 items"; ink pill "Reorder" (36h, no icon) on the right, vertically centred.
- **One ember element:** the promo banner. Rail sale prices on Home are ink with the struck-through old price (`saleTone="ink"`).
- **Pinned search:** an opaque canvas behind the pinned rows and a 22px eased canvas fade below them (content dissolves, never a hard cut).
- **View cart bar:** appears once Home has scrolled 220pt (the header cart already carries the badge), so the first viewport isn't two ink slabs.
- **Delete from Home:** the 2×2 mode cards, the stamp-card teaser, the "Fresh from the oven" grid, the brand footer, and every section subtitle.

#### Product card (all grids and rails), see `r3-menu.png`
- **No white card and no shadow.** Tile `w × w·1.05`, r28, `tileTints[category.tint]`. Art box 0.81w with its bottom 6 above the tile bottom.
- **Sticker:** top-left at inset 12/14, 22h, `micro`. BEST SELLER is ink with peach text, rotated −6°. NEW is sageDeep with white text, not rotated.
- **Quick add:** 34px white circle with a 16px ink plus, inset 10 top-right, hit 44. The added state (ink circle with a check) stays.
- **Below the tile, on the canvas:** name `cardName` 10px below the tile, 2 lines max (no reserved second line: grid rows size to the taller card); price 16/700 4px below; sale = ember price plus 13 `inkMuted` struck-through old price.
- **Sold out:** art at 45% opacity, an ink "Sold out" pill (24h) bottom-left inside the tile, quick add hidden.
- Card skeletons match: a tint-coloured tile with two bars below.

#### Menu (ref 2)
- **Watermark:** "Ember Roast" (`watermark`, ink 6%) at left 120, top safeTop − 18, no wrap, clipped by the screen edge, aria-hidden, so "Ember" reads between MENU and the header circles. It scrolls away with the header.
- **Header:** "MENU" (`screenTitle`) left 20, top safeTop + 12. Search and cart as 44px white circles on the right.
- **Store row:** a 60h gradient pill-card (r30): "Indiranagar" 15/600 over "0.8 km · Open until 9pm" (12 `inkSoft`), and an ink "Pickup ⌄" pill (44h) on the right that opens the mode sheet. **Delete the store photo and the status chip.**
- **Chips:** sticky (as now), 40h, 1px `line`, 14/500 `inkSoft`; selected = 1.5px ink border, 600 ink. No icons, no counts.
- **Section header:** "Coffee" 19/600 with " 8" (15/400 `inkMuted`) inline, 24 above and 14 below. Delete the icon disc and subtitle.
- **Grid:** 2 columns, gaps 14 horizontal and 22 vertical.
- **Scroll-spy:** a section takes its chip once its header crosses 40% of the list viewport.

#### Category
- **Hero plane:** height safeTop + 236, `heroTints[category]`, bottom radius 32. Back and cart as 44px white circles. Title "Coffee" (700 34/40) at left 24, top safeTop + 76; caption "8 drinks · from ₹160" (14 `inkSoft`). **The signature cut-out is 190px at right −36, bottom −8, bleeding off the right edge**, with a 0.30 contact shadow and the float motion. It is a sibling of the clipped plane (only the screen clips it), so it breaks the plane's bottom edge. Scrolling fades it out by 96pt and dissolves the emptied plane into the canvas before it reaches the top bar; the bar's opaque canvas backdrop arrives as the plane's edge does. Coffee's signature item is the flat white (not the cappuccino card right below). While loading, the filter row is reserved with a skeleton.
- Filter chips 20px below the hero, then the grid as on Menu.
- **Delete:** the line-art cup, the thumbnail stack, "+1", the clock meta line, the subtitle copy and the uppercase title.

#### Search
- **Top row:** back, field and cart (as now). The field is a white pill 52h; focused = 1.5px ink border.
- **Idle:** "Recent" (16/600) with "Clear" on the right, then text chips (≤ 3). "Popular" (16/600) and chips (≤ 6). Then `h2` "Popular this week": 4 rows, then a "Browse the menu" text row (16/600, chevron) in the same sheet. No icons in chips, no subtitles.
- **Results:** "5 results" (14 `inkSoft`), then **one white sheet** of rows. Each row: 64 thumbnail tile; name 16/600 with the highlight on a `peachSoft` background; the curated `tagline` 13 `inkSoft` (≤ 26 characters, never truncated; no line without one); price 15/700; a 36px `bg` "+" with a 16px ink plus on the right (the ink check stays for the added state; a column of ink dots would break "one ink primary"). Delete the category eyebrow, rating and time meta, and stickers on thumbnails.
- **No results:** no art. "Nothing for “zzzz”" (22/700), caption "Try another word or browse the menu.", suggestion chips, then the "Popular right now" rail. "Browse the menu" stays as an ink pill without an icon.

#### Product detail (ref 1), see `r3-product.png`
- **Hero:** height clamp(H × 0.58, 440, 520) including the safe area, flat `heroTints[tint]`.
- **Top row** (safeTop + 8): back on the left and cart (the fly target, with its badge) on the right. Both are frosted 44px circles: white 55% plus blur, with the Android fill fallback. We keep back on the left (platform convention), unlike ref 1.
- **Title inside the hero:** `heroTitle` ink, left 24, top safeTop + 64, width W − 48, 2 lines max. Under it, one meta line (13/500 `inkSoft`): "★ 4.5 · 6 min" with the star in roast. This replaces the meta chips.
- **Hero art:** size = min(W × 0.80, 320, heroH − titleBottom − 12), centred, art-box bottom = heroH − 26. **Plate:** ellipse rx = art × 0.45, ry = art × 0.078, stroke 1.5px ink 12%, centred at art-box bottom − art × 0.05. The contact shadow (0.30, width 66%) sits on the plate. Steam wisps above hot drinks stay.
- **Kcal badge:** the only ember element. 66px ember outline on white 70%, rotated −10°, centred at (artRight − 26, artTop + 50). It moves and scales with the art, as now.
- **Sheet:** white, concave notch 22 deep × 260 wide centred, sheet top = heroH − 42. Grabber 36×4 in `line`, 12px below the notch bottom.
- **First viewport, in order:**
  1. The ingredients line, centred 14/20 `inkSoft`, 2 lines max. It uses a short form of the description plus dietary words, e.g. "Espresso, vanilla milk, caramel drizzle · Vegetarian".
  2. **S / M / L** 58px circles, gap 22, letter only (18/600), ink fill slides as now.
  3. One caption for the selected size, centred: "12 oz · +₹30".
  4. **Quantity:** "−" and "+" in 60px `bg` circles centred on the sheet edges (left −30 / right −30; glyph in the visible half) and "1" in a 52×36 `bg` pill in the centre (RollingNumber 17/700).
- **Below the fold:** required groups are always expanded, in ref-2 style. The group row shows "Temperature" (16/600) and on the right "*Choose one" (13/500 `inkMuted`; ember only after a failed add, as now), or the chosen value once picked. Temperature uses two half-width option tiles (52h, r16, 1px `line`; selected = 1.5px ink plus a filled radio).
- **Optional or defaulted groups are collapsed rows:** "Milk" with "Whole milk ⌄" (56h). Tapping expands its radio or checkbox rows (52h, hairlines) with `layoutSpring`, and only one group is open at a time.
- **"About the beans"** (coffee only): a 64h row with "About the beans" (16/600), caption "House blend · Brazil & Ethiopia · Medium roast" and a chevron. It opens a `ModalSheet` holding the unchanged `CoffeeProfile` (origin, notes, roast meter, taste bars).
- **"Add a note":** a 56h row that expands `InstructionsField`.
- **Delete:** the category eyebrow, the meta chip pills, dietary pills, "Make it yours / Customize your drink", cup glyphs and oz/price stacks inside the size circles, and the inline coffee-profile card.
- The PrimaryBar behaviour is unchanged. Valid: "₹320" (22/700) + "Add to cart" (15/500 white 65%) + the bag circle. Invalid: "Choose a size" and so on. Sold out keeps today's behaviour with the new art.

#### Cart (ref 1), see `r3-cart.png`. The total must be visible without scrolling.
- **Structure:** header, a scrolling list, then a **fixed bottom dock** (peach card plus CTA). The list scrolls under the dock behind a 24px `bg` gradient fade. List bottom padding = dock height + 24.
- **Header:** back circle at left 20. "Cart" (`title`) at x 76, vertically centred with the back circle. On the right, a **count badge**: 44px sageDeep circle with the white count (17/700) and a 54px ring at 1.5px sage 60%. Delete the subtitle.
- **List sheet:** white, inset 12, r32. Concave notch at top centre (12 deep, 90 wide) holding the 6px peach dot. Rows 88h: 64 thumbnail tile with its cut-out; name 16/600; modifiers caption 13 `inkSoft` on one line; stepper (28px `bg` circles, qty 15/600); price pill on the right (`bg`, 34h, 15/700), vertically centred. Hairlines inset at x 112. The note text moves to the edit screen and checkout lines.
- **Upsell:** exactly one, last in the sheet after a 1.5px dashed `line` divider. Thumbnail, name, "Often added · ₹180", and a 36px ink "+".
- **Dock:** CTA PrimaryBar "Checkout" (18/700) with the arrow circle, no second line. Above it (12px gap), the **peach card**: x 20, width W − 40, 140h, r30, small top notch (60 wide × 10 deep), overflow hidden.
  - Row 1 (top 20): a breakdown label plus a translucent pill (white 40%, 26h, 13/600 ink). Show "GST (5%)" with "₹49"; delivery shows "Delivery" with the fee; an applied discount shows "Saved" with "−₹100". At most 2 pills inline.
  - "Total" (13, ink 72%) at top 62, then the **total at 44/48** (`priceHero`, RollingNumber) at top 78.
  - The **cut-out cluster** of up to 3 items bleeds off the bottom-right. Ink text stays (white on peach fails contrast).
- **Delete from the cart:** the promo row and hint (checkout already has them), the "How you'll get it" mode card (checkout has it), the subtitle, the subtotal row and the helper caption.
- **Fit check (390×844, iOS insets):** the header ends at about 108. The sheet with 3 lines plus the upsell ends at about 572. The dock starts at 844 − 34 − 64 − 12 − 140 = 594. Everything is visible. On 375×667 the list scrolls under the dock, and the total stays visible.

#### Order type (mode sheet)
- Title "Order type" (`title`), no subtitle.
- **Store card:** gradient, r28, padding 20. "Indiranagar" 20/700; "0.8 km · 12th Main Rd, HAL 2nd Stage…" 13 `inkSoft`; "● Open until 9pm" 13/500 sageDeep; ink "View on Maps" pill 40h. Delete the round photo, the eyebrow, the bean doodle and the chip container.
- **Mode cards 2×2:** outlined cards (A10), glyph 26 top-left without a disc, title 16/600, one-line subtitle 13 `inkSoft`. **Selected = ink-filled card** with white title, subtitle and glyph, cross-fading with the existing shared transition. Delete the check badge.
- **Fields:** labels in the section-label style (600 15 `inkSoft`); slot chips 40h (selected = ink fill) with a 24px canvas fade at the right edge. Delete the icon helper line. The CTA reads "Confirm" with the check circle and no second line.

#### Delivery address
- Title "Delivery address", caption "We deliver within 5 km of Indiranagar."
- "Use current location": a row on a white sheet with the navigate glyph inline (20, no disc) and a chevron. No caption.
- "Saved" label, then **one white sheet** of address rows: radio on the left; label 16/600; line 1 at 15; caption "Domlur, Bengaluru 560071 · 1.2 km" 13. An undeliverable row shows "Out of range" (13/500 danger) in place of the caption and dims to 50%. The last row is "+ Add new address" (16/600). Delete the "Delivers" chips, icon discs and separate cards. CTA "Deliver here".

#### Checkout
- Title "Checkout", no subtitle. **One white sheet** of rows:
  1. "Pickup", value "ASAP · ~6 min", chevron; tapping opens the mode sheet. Slot chips sit inline beneath for pickup.
  2. "Ava Stone", value "+91 98765 43210".
  3. "3 items" with one 44px tile (r14) holding the first item's cut-out (no "+N" label; the title already counts) and the value "₹980"; it expands to the lines. Its hairline starts at the title.
  4. An inline promo field "Promo code" with an "Apply" text button (15/600 ink); caption "Try WELCOME10".
- "Payment" label, then a second white sheet of method rows: brand mark 36×24 r6, name 16/600, caption 13, radio on the right. Delete the helper caption.
- The peach summary card sits in flow at the end. Subtotal, discount, GST (5%) and fee rows are 13/15 ink, with the total at 44.
- CTA "Place order · ₹1,029" (unchanged).
- **UPI round (R4):** the "Payment" sheet is **one row** by default: the chosen method's mark (36×24 r6), its name (16/600) over one caption ("UPI · last used"), "Change" (14/500 `inkSoft`) and a chevron that turns. Tapping expands every method in place as 56px radio rows under quiet group labels (13/600 `inkMuted`, a full-width hairline above): **UPI** (Google Pay "G", PhonePe "Pe", Paytm "Pt", BHIM "B" as ink monograms on `tileTints` plates — never logos — and "@" Pay with UPI ID), **Cards** (VISA on espresso, RuPay on roast, "+" Add new card), then **Pay on delivery** / **Pay at the café**. A choice folds the list after 200ms. Pay with UPI ID adds a 48px `bg`-filled "name@bank" field under the row (sage check when valid) with one caption.
- **Tip (delivery only):** "Tip your delivery partner" label over a white sheet with five equal 40px pills (No tip · ₹10 · ₹20 · ₹30 · Other; `bg` fill, the choice ink-filled) and the caption "Your delivery partner gets 100% of the tip." Other opens a ₹ field. The peach card adds "Packaging" and "Delivery partner tip" rows (`totalsBreakdown`).

#### Payment
- Title "Payment", no subtitle. The amount is 52/56 700, centred, 24px below the title, with the caption "Order ER-8120 · 2 items · incl. ₹26 GST". Delete "AMOUNT DUE".
- The card visual stays, minus its bean line-art.
- Delete the details table. In its place, one centred caption: "Demo checkout · no real charge" (13 `inkMuted`).
- MorphPayButton as now. "Simulate a failed payment" becomes a 14/500 `inkMuted` text link with no icon. The success reveal to `night` stays.
- **UPI (R4):** in place of the card, one white r28 row: the app's monogram plate at 64×44, the name 19/700 and "UPI · to emberroast@icici". On Pay its caption becomes "Opening Google Pay…" with a small spinner (≈0.8s), then the row gives way (fade) to the approval: a 132px ring with a 5px ink arc running down from 5:00 (linear, UI thread; it runs under Reduce Motion too), the clock 30/700 with "left", "Approve ₹536 in Google Pay" (22/28 700), one caption ("Open Google Pay and approve the request from emberroast@icici.") and an underlined "Cancel". Approved: the arc closes in `sageDeep` with a check and the title reads "Approved in Google Pay" while the bank confirms; the pay pill's check and the night reveal follow as for cards. A cancel reads "Payment cancelled" in ink (a decline stays danger). RuPay is a night → espresso card; Add new card is a blank roast card marked DEMO. Cash on delivery / pay at the counter: "Pay on delivery" / "Pay when you collect" / "Pay at your car" text over "Confirm order".

#### Tax invoice (R4)
- Header "Invoice" with a 44px white share circle. One **paper-white sheet** (r20, padding 22, no shadow) on the canvas, typographic only: "Tax invoice" 24/700 with the status ("Paid", 13/600 `sageDeep`) on the right; the invoice number 15/600 and the date; hairline; the seller (15/600) with the address, GSTIN and FSSAI lines (12.5 `inkSoft`, values ink); hairline; "Billed to" / "Place of supply" (11.5/600 `inkMuted` labels); hairline; the item table (Item · Qty · Rate · Amount, right-aligned two-decimal amounts, modifiers 12 `inkSoft`) and the SAC line; hairline; the summary rows 14/20 with "Taxable value" set apart by a hairline; a 1.5px ink rule; "Grand total" with the amount 26/700; the amount in words; hairline; payment reference rows; the "Prototype — not a valid tax invoice." footnote, centred 12 `inkMuted`. No icons, no fills, no ember.

#### Confirmation: a real hero moment, see `r3-confirmation.png`
- **Canvas:** `night` plus a peach glow at 22% (ellipse 70%×42% at 50% 30%). Top right: "Done" (15/500 white 70%) goes home and replaces "Back to home".
- **Cut-out cluster** (top = safeTop + 40, 300 tall), using up to 3 ordered items:
  - main item: 230, x = W/2 − 99;
  - second: 170 at left 20, top + 102, rotated −12°, in front;
  - third: 140 at right −10, top + 120, rotated 10°, behind.
  - A black pool ellipse (250×34, 55%) sits under them, and the existing confetti bursts around the cluster in peach, sage and white.
- **Check:** a 44px sage circle with the white `AnimatedCheck`, left 24, 14px below the cluster.
- **Title:** "Order" (`display` 56/58 white), then on a new line "placed." in Fraunces 400 Italic 60 peach. Left 24, 16px below the check.
- **Line:** 15/22 white 62%, mode-aware: "Ready for pickup in ~8 min at Indiranagar", "Arriving in ~26 min · Sunrise Residency", "We'll bring it to your table".
- **Code** (pickup, in-car and dine-in): "Pickup code" (13 white 50%) over the code (`code`, peach, letters roll in). "#ER-8121" (13 white 50%) is right-aligned on the code baseline.
- **CTA:** white 64px pill "Track order" (18/700 ink) with an ink arrow circle.
- **Delete:** the details card, the points line, the doodle field, the "ORDER NUMBER" eyebrow and the thank-you line.

#### Orders
- Title "Orders" with the cart circle on the right, no subtitle. Segmented control as now (48h, r24, ink thumb, white track). Delete the "Live updates…" line.
- **Active:** one card per order (r28, padding 20). There's no stacked second "code" card.
  - The first active order is a **night** card with white text; the rest are white cards.
  - Content: caption "● Pickup · ER-4827" (13); status 24/30 700; caption "Ready in ~5 min · 3 items"; a 4-segment 4px progress bar.
  - Right side: a 2×64 cut-out cluster at the top and a code block at the bottom ("Code" 10/500 over "C27" 22/800) on `bg` (white 10% on night).
  - The whole card taps through. Delete the arrow buttons.
- **Past:** when every day has a single order, **one** white sheet with the day folded into each caption ("Today · Pickup", "Sunday · Cancelled"); otherwise group labels in sentence case ("Today", 15/600 `inkSoft`), no counts, and one white sheet per group. Rows 76h: 56 thumbnail tile (first item); "Caramel Macchiato + 1 more" 16/600 on one line; caption "Pickup · ER-3310"; on the right the price 15/700 over a "Reorder" outline pill (32h). Only "Cancelled" is labelled (13/500 danger, replacing the mode), and its reorder is a 14/600 ink text button instead of the pill.

#### Tracking
- Header: back plus "Track order" (20/600, centred, sentence case).
- **Hero card:** espresso, r32.
  - Meta "● Live · Pickup" (13/500 white 60%). The ring, countdown and steam stay. Status 26/700 white; description 14 white 65% ("Being made now").
  - Barista line: a 32px peach initial circle with "Maya is on your order" (15/600 white), no container and no second line.
  - The pickup-code ticket stays, with the sentence-case label "Pickup code".
- "Progress" `h2` with the timeline in a white sheet: labels and times only (the hero carries the status line); the current dot has a contained halo (ink 14%, pulsing to 1.3×).
- **Completed:** the order's cut-outs (2 × 88, overlapping) on the canvas, "Completed" 26/700 and one 13 `inkSoft` caption "Thanks for ordering with us · +109 pts" (no check badge, no points pill). Details and receipt rows use 56 thumbnail tiles.

#### Rewards
- Title "Rewards", no subtitle.
- **Points hero** (roast, r32): "610" 64/68 700 white with "pts" 20/500 white 70%. Tier "Ember Regular" in Fraunces 400 Italic 20 peach (no pill, no sparkle). A 6px progress bar (peach on white 20%) with the caption "390 pts to ₹500 off" (the reward is named "₹500 off" so its Redeem row stays on one line) and "1,000" on the right. The "Ember" watermark stays. Delete the bean art and "YOUR BALANCE".
- **Stamps:** a white sheet, r28. "Stamps" (16/600) with "3 of 10" on the right. **One row of 10 slots of 26px:**
  - earned = roast fill with a white 14px cup;
  - empty = 1.5px dashed `line`;
  - 10th = peach fill with a gift glyph.
  - Caption "10th drink free · 7 to go". This replaces the two rows of 52px numbered circles.
- **How to earn:** delete the section (the answer lives in the Help FAQ).
- **Redeem:** `h2` with "3 ready" (13 `inkSoft`) on the right, then **one white sheet** of 80h rows: 64 thumbnail tile with the reward's cut-out, title 16/600, one-line description 13. On the right, **the cost is the button**: an ink pill "150 pts" when affordable, an outline `inkMuted` pill when locked. Delete the separate Redeem buttons and the sparkle cost chips. RedeemTicket and points history stay.

#### Profile
- Title "Profile" with the settings circle on the right, no subtitle.
- **Identity, no card:** 72px avatar (initials on the roast gradient, no peach ring), name 24/700, phone 15 `inkSoft`, and a 40px white edit circle.
- **Stats:** one row on the canvas (hairlines above and below, no sheet) with 3 columns and hairline dividers: "7 / Orders", "610 / Points", "Aug 2026 / Member since" (20/700 over 13 `inkSoft`).
- **Groups** (sentence-case labels, white sheets, 56h rows, value on the right, no discs, no sub-captions):
  - "Account": Order history (7), Rewards (610 pts), Saved addresses (3).
  - "Preferences": Notifications ("Orders on"), Settings.
  - "Support": Help & FAQ, Report an issue.
  - "Log out": the Support sheet's last row, danger 16/600, no chevron (three white sheets in all).
- **Footer:** "Ember Roast" (Fraunces 600 Italic 20 `inkMuted`) plus the version (12). Delete the bean.

#### Settings / Help / Legal
- **Settings:** title "Settings", no subtitle.
  - Notifications sheet: toggle rows with a label and a caption of 6 words or fewer, no discs. The "Updates show in the app" callout becomes a 13 `inkMuted` caption under the sheet, with no box and no icon.
  - "Preferences" label over a two-row sheet: "Appearance" with a compact System · Light · Dark pill (§R4), then the "Haptics" toggle row ("Gentle taps for key moments"), on by default (`docs/HAPTICS.md`).
  - "Demo tools" label (no peach chip, no sparkle, no description), a plain white sheet (no dashed border) with one-line captions (A6), "Reset demo" as a danger text row, and the version caption.
- **Help:** title "Help". Delete the "How can we help?" card.
  - "Questions" label over the FAQ accordion in a white sheet; the chevron rotates and has no circle behind it.
  - "Contact" label over a white sheet with two rows: "Call the café" with the number as its value, "Email us" with the address.
- **Legal:** sentence-case title, body unchanged.

#### Empty, error and offline states
- **`EmptyState` R3:** no disc and no line-art. New `art="plate"`: an empty plate (ellipse 160×28, 1.5px `line`) with a contact shadow, 40px above the title. Title 22/700 centred, optional message (≤ 10 words), and an ink action pill with no icon. Empty cart and "No past orders" use the plate; the empty cart adds the "Popular right now" rail 40 under its pill (the same rail as search's no-results). Search empty uses no art.
- **Offline / error:** a 28px cloud-off glyph in `inkSoft`, "You're offline" (22/700), "Check your connection and try again.", and a "Try again" pill.
- **NoDeliveryCard:** delete the pin doodle. **Notifications popover:** delete the bell doodle.

#### Tab bar and floating cart bar
Unchanged (the client likes them). Both use the `float` shadow.

#### Diet marks, Veg only and favourites (R4 addition, India)
- **Diet mark** (`VegMark`, FSSAI convention): a white-filled square outline (stroke ≈ 1.4px at 14, corner 2px) with a filled symbol: `veg` green dot, `egg` amber dot, `nonveg` brown triangle (`colors.veg / egg / nonVeg`). It is information, not decoration, so it doesn't count against the chip and sticker budget (A7). Sizes: 13 before a card name (the name's second line hangs under the name, not the mark), 12 before a list-row name and a cart line's name (top-aligned with its first line), 14 leading the product hero's meta line ("▣ ★ 4.5 · 6 min").
- **Veg only:** one control everywhere: a white pill (44h beside header circles, 36h in a text row) with "Veg" 14/600 and a 38×24 switch whose white thumb carries the veg mark; track `line` off, `veg` on; snappy spring; `toggle` haptic. Menu header (left of search), Category top bar (left of cart), Search results row (right of the count). Copy stays quiet: Menu ends with "No veg items in Bakery & Snacks and Desserts" + a "Show all items" text button; an emptied Category says "No veg items here" / "Everything in Desserts contains egg." with a "Show all items" pill; Search says "No veg results" / "The one match contains egg." with "Show all results". A veg-narrowed Category hero swaps in a veg cut-out and reads "1 veg item · from ₹420".
- **Favourite heart:** ink, like the "+" (ember stays the screen's one accent). Product detail: a 44px frosted circle beside the cart, outline → filled with a 1.28 pop; it fades out as the compact title fades in. Cards: no outline hearts across a grid (restraint); a favourited card shows a 30px white circle with a 15px filled heart at the tile's top-left (mirroring the "+"), replacing its sticker while shown; tapping it un-favourites and it scales away. Home's favourites rail hides the hearts (its title says it).
- **Home:** "Your favourites" (with "See all") takes the "Popular now" slot once there is a favourite, so Home stays at ≤ 5 sections. **Favourites screen:** sentence-case "Favourites" header with the cart, the Menu grid, the plate empty state "No favourites yet" / "Save items with the heart on their page." / "Browse the menu". Profile → Account gets a "Favourites" row with the count.

### R3.C Motion: keep everything; additions only
All §7 motions stay: springs, press scale, staggered entrances, the hero flight, fly-to-cart, odometer, swipe-to-delete, the tab pill, onboarding parallax and dot travel, the pay morph, confetti, the tracking ring and the skeleton shimmer. New and adapted:
1. **Cut-out float** (`useArtFloat(phase?)`): translateY 0 → −5 → 0 over 3.6s as a sine loop, plus rotate ±1.2°. The same shared value drives `ContactShadow` scaleX 1 → 0.92 and opacity 1 → 0.75, so the shadow tightens as the art lifts. It runs on the product hero (replacing the 3° drift), the category hero, the active promo slide and the confirmation cluster (phases offset by 0.4s). It does **not** run on grid cards, and it's off under Reduce Motion.
2. **Size scale** (S 0.9 / M 1.0 / L 1.08) scales the art, plate and shadow as one group from the bottom centre (apply translateY = (1 − s) × box / 2).
3. **Hero flight:** `setHeroOrigin` stores the **art box** rect, not the tile. The flying clone is the bare cut-out (no circle mask, no tile) and lands in the hero art box. The tile-to-hero tint backdrop fade is unchanged.
4. **Fly-to-cart:** the clone is the bare cut-out at the source art-box size, on the same arc with the same pop. Widen `FlyToCartArgs.image` to `string | number` (local asset).
5. **Cart dock:** the peach card rises 24px with `gentle` on mount. Cluster pieces use `popIn` with a 60ms stagger. A removed line's cut-out scales to 0.6 and fades (`exitFade`) while the others re-layout (`layoutSpring`).
6. **Swipe hint:** once per app session, 600ms after the cart mounts, the first row nudges −28px and springs back (`snappy`), revealing the red delete. Skipped under Reduce Motion.
7. **Onboarding:** the doodles draw on, float and parallax at 1.2×. Page-specific pieces (pin, bell) draw on as their page arrives. The big button presses to 0.94 (`snappy`) and the arc sweep follows progress.
8. **Confirmation sequence:**

   | Time | Event |
   |---|---|
   | 0ms | Glow fades in over 400ms |
   | 120 / 200 / 280ms | Cut-outs rise 40px and scale 0.85 → 1 (`gentle`), one per time |
   | 350ms | Confetti bursts from the cluster centre |
   | 500ms | Check draws |
   | 650ms | "Order" / "placed." rise (`enterUp` 0 / 1) |
   | 800ms | Code characters roll in with a 40ms stagger |
   | After | Idle float starts |

9. **Collapsible option rows** expand with `layoutSpring`, and the chevron rotates 180° with `smooth`.
10. **Quantity bumps** press to 0.9 (`snappy`) with a `tick` haptic.
11. **Tilt-to-move (product hero, category hero).** Tipping the phone shifts the hero cut-out up to 10px toward the edge that moved away and turns it up to 3° back toward the eye (perspective counter-rotation), while the contact shadow slides up to 4px the other way and fades slightly, so the product reads as lifted off its plate; the plate stays put and the kcal badge travels a touch further (1.25×). Soft and weighty, never twitchy; it recentres on the user's own holding angle within a few seconds. The category hero cut-out drifts ±6/±3px, translate only. Off under Reduce Motion and while the screen is covered or the app is in the background. Web: the mouse drives it (fine pointers only). It composes with the float, the card-to-hero flight, the size scale and fly-to-cart.
12. **Live order pill.** While an order is active, an ink capsule (48h, `float` shadow, hairline white 8% edge) floats at the bottom centre: 12px above the tab bar, or above the View cart bar when that shows, else above the home indicator. Inside: a 26px white line cup that fills with peach as the order advances (a gentle travelling wave on the surface; it pours up when the pill appears), the status 15/600 white, " · ~4 min" 15/400 white 60% (odometer digits), " · 2 orders" when there is more than one, and a 16px chevron at 45%. Springs in with a 28px rise and scale 0.92 → 1 (`smooth`), presses to 1.04, and pops 1.06 with a fading 1.5px peach ring when the lead order's status changes. Swipe sideways or down to hide it until the next status change (`threshold` as it crosses the hide point). It never shows on Home or Orders (they already show the order live), on tracking or the ordering flow's screens, with the keyboard open, or while a sheet (reward ticket, Edit name, a confirm dialog) is open. Lists it floats over get its height + 12px of extra bottom padding, so their last row scrolls clear of it.

### R3.D Superseded rules and acceptance
- **Superseded:** §0's "metadata chips on cards" and "ordering-mode switch section on Home" (the header switch replaces it). §2's `bg` and `heroTints` values. §3's "screenTitle UPPERCASE everywhere". §4's "soft shadow on cards". §5's circular photos (Category tiles, Product card, Product detail circular crop, Cart round thumbnails, ThumbStack rings), Mode-card check badge, Store-card photo and eyebrow, and Home header Row 2 avatar. §6's empty-state line-art. §10's "circular-cropped stock photos" (the prototype now ships cut-outs). The build contract's "Design additions" for the Home stamp teaser, product meta captions and the inline coffee profile are replaced as specified in B.
- **Implementation order:** (1) tokens, type and the Fraunces 400 italic font; (2) `productArt.tsx` (`cutoutFor`, `ProductArt`, `ArtTile`, `ArtCluster`, `ContactShadow`, `useArtFloat`), the PHOTOS swap and credits; (3) ProductCard, ProductRow, CategoryTile, thumbnails, SummaryCard, the hero origin and fly-to-cart; (4) product detail and cart; (5) onboarding, auth and confirmation; (6) home, menu, category and search; (7) checkout, mode, address and payment; (8) orders, tracking, rewards, profile, settings, help and states; (9) the copy, icon-disc and uppercase purge; (10) screenshot every scenario and compare with the mocks.
- **Acceptance checklist (verify on screenshots at 390×844 and 375×667):**
  - No circular product image anywhere: `Photo`/`ThumbStack` don't appear for products.
  - No beige or black icon discs.
  - Uppercase text appears only on the whitelist (A5).
  - No sparkle glyphs. No `LineArt` outside splash, wordmark, onboarding and auth.
  - Home shows ≤ 5 sections below the header.
  - The seeded 2-line cart shows the peach total and the CTA without scrolling.
  - Every screen has one ink primary action and ≤ 1 ember element. Every product card has ≤ 1 sticker.
  - Copy matches A6.
  - `npx tsc --noEmit` is clean and `npx jest` is green, with tests updated for the removed strings.

---

## R4. Dark mode

**Goal.** The same R3 app at night: one focal point, cut-outs on tinted planes, sentence case, every motion unchanged. Nothing is re-laid-out; only the planes and a few role colours move. The spec below is implemented in `src/theme/palette.ts` (tokens), `src/theme/theming.tsx` (runtime) and the shared kit; screens follow the recipe in `docs/BUILD_CONTRACT.md` → Theming.

**Choosing it.** Settings → Preferences → **Appearance**: System · Light · Dark (a three-way pill in the Preferences sheet, ink indicator that springs between segments, `select` haptic on a change). The choice is a device preference like Haptics: it persists, survives sign-out and Reset demo, and the app re-themes in place (no reload, no remount). **System** (the default) follows the phone: every screen is converted, so `FOLLOW_SYSTEM_SCHEME` in `src/theme/appearance.ts` is on (during the conversion it resolved to light, so a phone in dark mode never opened a half-converted app). On iOS the native chrome (keyboard, alerts, the sheet grabber) follows the choice (`Appearance.setColorScheme`); Android and web draw everything themselves.

**Six rules.**
1. **Planes stay three, re-mapped.** Canvas = espresso-night `#17120F`; tiles = a visible lift (≈ 1.25:1) that keeps each category's hue; `surface` (lists, forms, the notched sheets, header circles) = a quieter lift `#241C17`. Planes still separate by colour, not by shadow.
2. **Ink inverts.** Anything filled with `ink` (the primary bar, View cart, the pay button, selected chips and mode cards, the tab pill, the ink "+", "Sold out") becomes a warm cream pill with espresso content (`onInk`). The primary action stays the brightest thing on the screen.
3. **Capsules stay dark.** Toasts, the live order pill and Home's order strip keep white content on a lifted espresso `capsule` with a 12% white edge (the edge, not a shadow, lifts them off the canvas). Orders' lead card uses the warm `espresso` card so it still stands apart from the `surface` cards.
4. **Accents don't flip.** Peach, ember, sage, deep sage, roast, espresso and the night screens (splash, onboarding, auth top, confirmation, payment reveal) are the same in both schemes. The peach card keeps its `inkFixed` copy; the promo banners keep their white copy, white code chip and ink pill.
5. **Accent TEXT is re-tuned** for AA on the dark planes: `sageText` (Open, savings, Paid), `roastText` (the ★, small links, counters), `danger`, the diet marks.
6. **Shadows are black pools.** `float` / `cta` / contact shadows turn black and deeper (an espresso shadow on espresso reads as a glow). Frosted layers switch to the dark blur tint over a dark fill.

**Tokens (light → dark).** Every key exists in both palettes; names are roles, so code never branches on the scheme except where noted.

| Token | Light (R3) | Dark (R4) | Role / notes |
|---|---|---|---|
| `bg` | `#F3ECE3` | `#17120F` | Canvas; fill for controls inside sheets |
| `surface` | `#FFFFFF` | `#241C17` | Lists, forms, notched sheets, header circles (1.11:1 on the canvas, like white on cream) |
| `surfaceAlt` | `#EFE7DC` | `#2C231D` | Skeleton base, image placeholder, `cream` tones |
| `line` | `#E6DCCF` | `#3A2F27` | Hairlines, outlines, idle input border |
| `overlay` | `rgba(28,23,20,0.45)` | `rgba(0,0,0,0.6)` | Scrims |
| `ink` | `#1C1714` | `#F4ECE2` | Text (15.9:1) **and** the primary fill |
| `inkSoft` | `#6E625A` | `#B8AA9C` | Captions (8.2:1 on bg, 7.4:1 on surface) |
| `inkMuted` | `#A39689` | `#84776B` | Placeholders, chevrons, struck prices (4.3:1) |
| `onInk` | `#FFFFFF` | `#17120F` | Content on an `ink` fill (15.9:1) |
| `onInkSoft` | `#A39689` | `#6E625A` | Secondary text on an ink fill ("· 3 items") |
| `control` / `onControl` | `#FFFFFF` / `#1C1714` | `#F4ECE2` / `#17120F` | The "+" and heart circles standing on tiles |
| `frost` | white 55% | `rgba(36,28,23,0.62)` | Frosted header circles over a hero (+ dark blur) |
| `capsule` | `#1C1714` | `#2C231D` | Toasts, live pill, Home order strip (white content) |
| `sageText` | `#5E8A50` | `#93C083` | Sage text (9.0:1) |
| `roastText` | `#7A5236` | `#CD9B72` | Roast text and the ★ (7.6:1) |
| `danger` / `dangerSoft` | `#D64545` / `#FBE3E1` | `#EA5D52` / `#3B1D1A` | Errors (5.5:1); white glyph on `danger` 3.4:1 |
| `peachTint` | `#FBD9BF` | `#4A3123` | Peach fill behind ink text (search highlight) |
| `storeFrom` → `storeTo` | `#FBF4EA` → `#F1E2CE` | `#2A2019` → `#35271B` | Store card gradient (100°) |
| `veg` / `egg` / `nonVeg` | `#1B8A3B` / `#B5780A` / `#8B3A1E` | `#3DAA5A` / `#D99A2B` / `#DB6A45` | FSSAI marks on a `surface` square (6.3 / 6.9 / 4.9:1) |
| `peach` `peachSoft` `ember` `sage` `sageDeep` `roast` `espresso` `espressoDeep` | — | same | Accent fills (unchanged) |
| `night` `glow` `white` `black` `glass` `glassBorder` `inkFixed` | — | same | Fixed: night screens; `inkFixed` = R3 ink that never flips |

| Tint | Tile light → dark | Hero light → dark |
|---|---|---|
| `coffee` | `#EBDBC6` → `#2F241B` | `#E7D4BD` → `#382A1D` |
| `tea` | `#DCE5CF` → `#252B1F` | `#D5E0C7` → `#2A311F` |
| `cold` | `#D8E2EC` → `#212833` | `#D1DDE9` → `#232D39` |
| `breakfast` | `#F2E0BE` → `#322819` | `#EFD9B0` → `#3A2D19` |
| `desserts` | `#EFD8DA` → `#33242A` | `#EBCFD2` → `#3B272C` |
| `snacks` | `#EEDDC8` → `#30251C` | `#E9D6BF` → `#37291D` |

Dark heroes are one step *richer* than their tile (light heroes are one step deeper), so the `surface` notched sheet under the product hero still reads as its own plane.

| Shadow | Light | Dark |
|---|---|---|
| `float` | `0 10 30 rgba(59,38,24,0.12)` | `0 10 30 rgba(0,0,0,0.5)` |
| `cta` | `0 12 24 rgba(28,23,20,0.22)` | `0 12 24 rgba(0,0,0,0.45)` |
| `ContactShadow` | espresso, 0.26 tile / 0.30 hero | black, 0.50 tile / 0.55 hero (custom alphas × 1.9) |

**Component notes (dark).**
- **Primary bar / View cart / pay button:** cream pill, espresso label, espresso circle with a cream glyph; disabled keeps the cream fill with a 50% label and a 14% circle. The `white` bar on night screens is unchanged.
- **Quick-add "+":** a cream `control` circle on the dark tile; the ✓ after an add is deep sage with a white check (the cream would not read as a change).
- **BEST SELLER sticker:** peach with `inkFixed` text (an ink sticker vanishes on a dark tile). NEW stays deep sage.
- **Tab bar:** dark frosted bar, 8% white rim, the active pill inverts (cream, espresso icon + label).
- **Skeletons:** `surfaceAlt` base with a faint 7% sheen (62% would flash).
- **Modal scrim:** black 66% (an ink scrim barely darkens espresso). Toggles keep their white thumb.
- **Status bar:** light content on the dark canvas (root `StatusBar`); `LightStatusBar` screens are unchanged.
- **Sign-in sheet (phone / OTP / profile):** the dark canvas is almost `night`, so the sheet under the night top lifts to `surface` and its fields, the "IN +91" pill and the OTP boxes sink to the canvas (`bg`), the R3 rule for controls inside a sheet. Light keeps the canvas sheet with white fields. Onboarding, the splash and the auth top are identical in both schemes, so splash → onboarding → sign-in → the dark app is one continuous night.
- **Veg only switch:** the pill and its off track are dark (`surface`, `line`); the thumb stays white and its veg mark keeps the light white-square form (it sits on white).
- **Notifications popover and the redeem ticket:** `surface` cards lifted by an 8–10% white hairline (a black shadow alone reads as a hole); the popover dims with black 50%. The ticket's "Done" becomes the cream ink pill, the brightest thing on screen.
- **Category hero / tracking / rewards:** heroes use the dark `heroTints` with `surface` header circles; the espresso tracking card and the roast points card keep their white copy (accent fills don't flip); the stamp slots keep roast / peach fills, empty slots dash in `line`.
- **Inputs:** every text field passes `keyboardAppearance` from the theme (search, sign-in, OTP, edit name), so the iOS keyboard is dark with the app.

**Acceptance (dark).** Every screen in both schemes at 390×844 and 375×667: no light plane, hairline or tile left behind (`npm run theme:check` empty; the shared-kit leak test in `src/components/domain/__tests__/darkTheme.test.tsx` green); one cream primary action; ≤ 1 ember element; text at AA; the light theme pixel-identical to R3.

---

## 0. It must read instantly as a FOOD-ORDERING app (hard rule)
Within 2 seconds of any browsing screen, a user should think "I can order food and coffee here". Premium styling must never hide the commerce. Every browsing surface must carry these cues:
- **Big, appetizing product photos everywhere.** Each product card, row, cart line and order line has a photo of that exact item: the product itself, close and filling the frame, never a scene or a table. The photo is the largest element on every card.
- **A price on every product surface**, plus a **+ quick-add** button on every card. Sale items show the struck-through old price.
- **Ordering metadata chips** (ref 3): ⏱ prep time ("6 min"), ★ rating with count ("4.8 (320)"), kcal, and dietary tags. Show them on cards (compact) and in product detail (full).
- **The cart is always visible.** Show the cart icon with a count badge in the Home header and in Menu, Category, Search and Product. When the cart has items, a **floating "View cart" bar** sits above the tab bar on Home, Menu, Category and Search. It's an ink pill showing "View cart · 3 items" on the left and the RollingNumber total plus a white circle arrow on the right, and it springs in and out.
- **Clear ordering entry points on Home:** the ordering-mode switch, an "Order now" banner, category tiles, "Popular now", "Order again" (re-order the last order in one tap) and an active-order tracker card when an order is in progress.
- **Menu feels like a real menu:** category chips plus a long 2-column grid grouped by category, with section headers ("Coffee · 8 items").
- **Ordering vocabulary** in copy and CTAs: "Add to cart · ₹310", "View cart", "Checkout", "Place order", "Order again", "Track order", "Ready in ~8 min".

## 1. Personality
Premium, warm and calm, with a bit of playful line-art. The app should feel like a specialty café menu, not a delivery marketplace. Use lots of cream and white space. Espresso-dark is reserved for the main action on each screen. Accent color is used rarely, so when it appears it stands out.

## 2. Color tokens (`src/theme/index.ts`)

| Token | Hex | Use | From |
|---|---|---|---|
| `bg` | `#F6F1EA` | App background (warm cream) | 2 |
| `surface` | `#FFFFFF` | Cards, sheets | 1, 2 |
| `surfaceAlt` | `#EFE7DC` | Image tiles in product cards, input fills | 2 |
| `ink` | `#1C1714` | Primary text, **primary CTAs (black pills)**, selected size circle | 1 |
| `inkSoft` | `#6E625A` | Secondary text | 2 |
| `line` | `#E4DACD` | Dividers, outlined chips | 2 |
| `espresso` | `#3B2618` | Dark onboarding background, headers | 1, 2 |
| `roast` | `#7A5236` | Points pill, brown accents | 2 |
| `peach` | `#F4A672` | Cart summary card, line-art strokes, soft highlights | 1 |
| `ember` | `#E8692C` | Promo banners, sale price, kcal badge outline, "Sold out" | 3, 2 |
| `sage` | `#8DB37E` | Success, "Low calorie" sticker, onboarding capsule, unread dots | 1, 2 |
| `sageDeep` | `#5E8A50` | Small badges with white text (cart count), sage chip text on a 20% sage tint, toggles "on" | — |
| `danger` | `#D64545` | Errors | — |

**Hero tints** for the product detail background, one per category (from ref 1's lavender hero):
- Coffee `#E9DCCB` (latte)
- Tea `#DCE6D3` (matcha)
- Cold drinks `#D9E2EC` (ice)
- Breakfast `#F1E2C6` (butter)
- Desserts `#EED9DC` (berry)
- Snacks `#E6DDD2`

**Rule:** each screen has one ink-black primary action. Ember is used on at most one element per screen (promo, sale price or badge). Product stickers never use ember (BEST SELLER is ink with peach text).
**Contrast:** never put white text on plain `sage` (≈2.4:1). Small badges use `sageDeep`; status chips use a 20% sage tint with `sageDeep` text.

## 3. Typography
- **Outfit** (geometric sans, weights 300–800) is used for all UI text. It covers ref 1's thin display weights and ref 2's bold rounded headings.
- **Fraunces Italic** is only for the brand wordmark and decorative watermark text (ref 2's "Java Café" serif). Don't use it for body copy.

| Style | Font / weight / size | Notes |
|---|---|---|
| `display` | Outfit 300 / 44 / lh 50 | Onboarding headline, thin and large ("Your daily ritual, brewed for you") (ref 1) |
| `screenTitle` | Outfit 800 / 26, **UPPERCASE**, letter-spacing 0.5 | "PICK UP", "MENU", "DETAIL" (ref 2) |
| `splitTitle` | Outfit 700 + Outfit 300 / 28 | Product name: first word bold, rest light ("**Caramel** Macchiato") (ref 1) |
| `h2` | Outfit 600 / 18 | Section headers ("Popular now", "Options Available") |
| `body` | Outfit 400 / 15 | |
| `caption` | Outfit 400 / 12, `inkSoft` | Card subtitles, "Size: M" |
| `price` | Outfit 700 / 16–34 | Big total in the cart summary is 34 |
| `brand` | Fraunces Italic 600 | Wordmark, watermark |

## 3b. Icons (`src/components/ui/LineIcon.tsx`)
- One custom **line icon set** drawn in the same soft, hand-drawn language as the illustrations: 24×24 grid, **1.75 stroke**, round caps and joins, rounded corners, no filled glyphs (exceptions: the rating star and a liked heart, which fill).
- Set: navigation (home, menu cup, orders receipt, rewards gift, profile); commerce (bag, pickup bag with check, search, bell, pin, store, tag, card, lock, sparkle, heart, star, clock, flame, leaf, settings); utility (chevrons, back/forward arrows, plus, minus, close, check, info, alert, help, edit, trash, refresh, repeat, swap, navigate, cloud-off, logout, phone, mail, shield, chat, doc); dietary pills and filters (leaf vegan, sprout vegetarian, drop dairy-free, ban gluten-free, bolt low-cal) and the card face's contactless mark; **categories** (cup, matcha bowl + whisk, iced glass, fried-egg breakfast, croissant, cake slice); **ordering modes** (dine-in table, pickup bag, car, delivery scooter).
- `<Icon name>` renders the line icon automatically for any name in the set **and** for the common Ionicons names mapped onto it (`home`, `cafe`, `bag-handle`, `location`, `time-outline`, `chevron-*`, `star`…). Ionicons remain only as a fallback for glyphs the set doesn't draw.
- The stroke stays visually even across sizes (slightly heavier for 14–16px chips, lighter at 34px+). The active tab uses the same glyph in white on the ink pill.

## 4. Shape, spacing, elevation
- Radii: `sm 12` (chips, inputs), `md 20` (product cards), `lg 28` (banners, summary card), `xl 36` (sheets, hero). `pill 999` for buttons, chips and price tags.
- Spacing scale: 4 / 8 / 12 / 16 / 20 / 24 / 32. Screen gutter is 20.
- Tap targets are at least 48px. Circle buttons are 52–64px.
- Shadows are soft, low and warm: `0 8 24 rgba(59,38,24,0.08)`. Black pills get a slightly stronger shadow.
- **Notched sheet** (ref 1): bottom sheets have a small grabber bar and a gentle concave dip at the top center where the hero image overlaps.

## 5. Signature components

### Primary action bar (ref 1, used everywhere it applies)
A full-width **ink-black pill**, about 64px tall. The left side holds the label or price in white Outfit 700, e.g. "₹310" or "Checkout". On the right, inset 6px, is a **white circle button** holding a black icon (bag, arrow →). When pressed it scales to 0.97. While a required choice is missing the bar stays full ink and reads as the next step ("Choose a size" over "2 choices left · ₹250", a chevron-down in the white circle); once valid it cross-fades to the price and "Add to cart". A truly unavailable action (sold out) uses a muted grey bar.

### Circle arrow button (ref 1 onboarding)
A 64px dark glass circle (`rgba(255,255,255,0.08)` with a white hairline border) holding a thin → arrow. A peach arc partly wraps the circle and grows with onboarding progress.

### Page dots (ref 1)
Inactive dots are 6px circles. The active one is a 24×6 pill. The width animates between them.

### Mode cards (ref 2 "Pick Up / Delivery")
A 2×2 grid on Home with **Dine-In, Pickup, In-Car, Delivery**. Each card is white with a soft icon disc (the custom mode glyph), a title (Outfit 600), and a two-line subtitle in `inkSoft` ("Take it at the store, no queue"). Titles share one baseline across a row (the subtitle box is always two lines tall). The selected card gets a 1.5px ink border and a small check in the top-right corner; the disc fills ink and its glyph cross-fades to white in step. `compact` cards (sheets, Home) are 76px with one-line subtitles.

### Store card (ref 2)
A cream gradient card: a live status chip ("Open · until 9pm" / "Closed · opens 7am", from the `brand.store` hours; "Open late (demo)" while the demo keeps the store open), an "EMBER ROAST" eyebrow over the short store name ("Indiranagar", one line), "0.8 km · 12th Main Rd, HAL 2nd Stage" and an ink pill "View on Maps". Used on the ordering-mode sheet. Menu uses the **compact** 64px row (store photo, name, status · distance, a "Pickup ⌄" chip that opens the mode sheet) so food shows in the first viewport.

### Category chips (ref 2) and tiles (ref 3)
- On **Menu**, chips are outlined pills (`line` border, `inkSoft` text). The selected chip gets an ink border, ink text and weight 600.
- On **Home**, featured categories are 72px cream rounded-square tiles holding a **58px circular photo of the category's signature product** (food first), with the category's line glyph in a small white disc on the corner and the label below. The selected tile gets a 2px ink ring and a semibold ink label (never a solid fill). Without a photo the tile shows the glyph at 34px.
- Menu chips show the category line glyph before the label.

### Product card (ref 2 grid)
Two columns. The top is a cream `surfaceAlt` image tile with radius 16 and a white **+ circle** in the top-right corner. Below it are the name (2 lines max) and the price on the right. A sale shows a struck-through old price in `inkSoft` and the new price in ember. Optional badges sit on the image:
- a rotated **"BEST SELLER"** sticker (ink with peach text, −7°)
- a sage **"Low cal"** circular stamp
- a `ink` 60% overlay with **"Sold out"** for unavailable items (the + is hidden)

### Promo banner (ref 2 poster + ref 3 banner)
A full-width carousel card (radius 28) with photo or illustration on the right. The headline is Outfit 700 in white. A code chip ("Use code **FIRST20**") and an ink pill **"Order now"** sit on the card. The first banner uses ember; later ones use espresso or sage backgrounds. Dots sit below.

### Home header (ref 3 + ref 2)
- **Row 1:** a location pin with the store or address name and a ⌄ chevron (tapping it opens mode/address), a bell with a sage unread dot, and a cart icon with a `sageDeep` count badge. All three use the line icon set in matching white discs.
- **Row 2:** an avatar, "Good afternoon," in `inkSoft` with the name below in Outfit 700, and a **roast-brown points pill** ("2,300 pts") on the right.
- **Row 3:** a search bar (white pill with a 🔍 placeholder, "Search lattes, croissants…") that opens the Search screen.

### Product detail (ref 1 layout + ref 2 options)
- The top ~45% is the hero: the category **hero tint** background, a large product image centered (superseded by §R3: a bundled transparent cut-out on a plate outline with a contact shadow), a white **circle back button** at the top-left, and a tilted **kcal sticker** ("245 kcal", ember outline) on the plate's lower-right rim that moves and scales with the plate.
- A **notched white sheet** slides up over the hero. It contains:
  - split-weight title, short description, and dietary tags (small outlined pills)
  - **Size** as circle selectors (S / M / L, 56px; selected is ink-filled with white text), with the price delta under each
  - other groups as list rows (ref 2): group title plus a right-aligned tag ("*Choose one" in ember if required and unmet, "Optional" in `inkSoft`). Single-select rows use a radio and multi-select rows use a rounded checkbox, with "+₹40" right-aligned
  - special instructions as a multiline input
  - quantity: − [ 1 ] + with 52px circle buttons at the edges (ref 1)
- A sticky **primary action bar** shows the live total and a bag icon.
- **Sold out:** the photo fades to 55% with an ink "Back tomorrow" chip on the plate; the customizer, instructions and quantity are replaced by a "Back tomorrow at 7am" note and a "Try instead" rail of available items (same category first).

### Cart (ref 1)
- An uppercase **"CART"** title on the left and a sage circle with the item count on the right.
- A notched list sheet: 56px **round thumbnails**, name (600) and modifier summary ("M · Oat · +Vanilla") in caption, a qty stepper, and a white **price pill** on the right. Swipe or long-press to remove. Tapping a line edits it.
- A coupon row (outlined pill input + "Apply").
- The **peach summary card** (radius 28) shows rows for Subtotal / GST (5%) / Delivery fee (fee in a translucent white pill), "Total" in small text, and **the total in Outfit 700 34px**. A small cluster of product thumbnails peeks in on the right.
- Ink primary bar: **"Checkout"** with a white arrow circle.

### Bottom navigation (ref 3, ink not ember)
A floating pill bar (white, radius 999, soft shadow) inset 16px from the screen edges. The **active tab expands into an ink pill** with an icon and label. Inactive tabs are icon-only 48px circles. Tabs: **Home · Menu · Orders · Rewards · Profile**.

### Status timeline (orders)
A vertical stepper. Done steps are sage dots with a check, the current step is an ink dot with a pulsing ring, and upcoming steps are hollow `line` dots. Steps adapt to the order mode.

## 6. Illustration
- Line-art on the dark onboarding screens (ref 1): coffee cup with steam, beans, croissant, portafilter, leaf. Strokes are 1.5–2px in `peach`, with a few white strokes. They're drawn as inline SVG (`react-native-svg`) and float slowly.
- The sage capsule on onboarding (ref 1) holds a white wavy "steam" line with a glowing peach dot that moves along it as you progress.
- Empty states (empty cart, no results) use the same line-art style in `roast` strokes on cream. The offline state has its own art (a struck-through cloud), not the empty-cart cup; empty search keeps selling with a "Popular right now" rail under the suggestions (`EmptyState` children).

## 7. Motion & effects: smooth and premium (core requirement)

Motion is one of the main ways this app should feel premium. Every animation runs on the **UI thread** at 60/120fps using **react-native-reanimated** worklets and **react-native-gesture-handler**. JS-thread `Animated` and `setTimeout`-based animation are not allowed.

### Principles
- **Springs, not linear timing.** We use these presets:
  - `snappy` for presses and toggles (damping 18, stiffness 260)
  - `smooth` for sheets and layout changes (damping 22, stiffness 180)
  - `gentle` for hero and entrance animations (damping 26, stiffness 120)
  - Timing curves are only for opacity, using `Easing.bezier(0.22, 1, 0.36, 1)` (easeOutQuint).
- **Interactions are continuous and interruptible.** A gesture can grab an animation mid-flight, and nothing blocks touches while animating.
- **Stagger, don't dump.** Lists and grids enter with a 40ms stagger: fade, rise 12px and scale from 0.98.
- **Haptics** are crisp, sparse and in sync with the motion. The vocabulary and the call-site map are in **`docs/HAPTICS.md`** (it supersedes the old light/medium list):
  - `select` for choices (chips, sizes, options, tabs, segments) and `tick` for small steps (qty stepper, OTP digits, carousel and scroll-spy changes)
  - `toggle(on)` on switches; `press` on the press-in of the few committing CTAs (Add, Place order, Pay, Confirm), then `land` when the flying cut-out reaches the cart
  - `threshold` when a swipe crosses the delete point; `success`, `warning` and `error` for real outcomes
  - navigation taps are silent, and Settings has a Haptics switch (on by default)
- **Depth.** We use `expo-blur` for the floating tab bar, sticky headers once scrolled, and modal backdrops, via `FrostedLayer` (motion kit): a 93% cream fill (97% on Android) over a strong blur so nothing is readable through it, a 50% hairline, and a 10px gradient fade below so content dissolves instead of slicing. On iOS the blur fades in by **intensity** (`AnimatedBlurView`), never by animating the opacity of the blur or its parents. Shadows are soft and grow on press.
- **Respect Reduce Motion.** Read `useReducedMotion()`. If it's on, swap to quick cross-fades and turn off parallax and drift.

### Signature moments
| Moment | Effect |
|---|---|
| **Splash → onboarding** | The wordmark fades in with letter-spacing that tightens, then the line-art draws itself (SVG `strokeDashoffset` animation) and starts a slow float |
| **Onboarding paging** | Swipe-driven horizontal pager. Headline words slide in with parallax (text moves at 0.6× the page speed, illustrations at 1.2×). The peach dot travels along the wavy steam path as you swipe (interpolated along the SVG path). The progress arc around the arrow button fills. Page dots morph width |
| **Press feedback** | Every card, pill and circle button scales to 0.97 with the `snappy` spring (after a 55ms scroll-safe delay on native, so a drag that starts on a card never wobbles it) and, on cards and black bars, fades in a deeper shadow layer. A completed tap releases with a small overshoot; a cancelled press settles without one |
| **Home scroll** | The header compresses on scroll (greeting fades, search bar sticks with a blur behind it). The promo carousel snaps with a scale/opacity falloff for neighboring cards, its dots follow scroll progress, and it advances by itself every 5s (paused while touched, off-screen or under Reduce Motion) |
| **Product card → product detail** | The image **expands into the hero** (shared-element style: measure the card image, animate a floating copy into the hero position, cross-fade to the real screen). Then the notched sheet springs up from below and its contents stagger in |
| **Product detail hero** | Parallax and stretch: pulling down scales the image up, and scrolling the sheet up slides the image up at 0.5× and fades it. The image does a slow 3° rotation idle drift |
| **Size selection** | The ink fill **slides** between circles (one shared animated indicator, not three separate toggles). The hero image scales subtly (S 0.9 / M 1.0 / L 1.08) with the `smooth` spring |
| **Price changes** | A rolling **odometer** on the price digits: each digit rolls vertically to its new value |
| **Required group missing** | Tapping the incomplete bar ("Choose a size") makes the missing group shake (±6px, 3 cycles), highlights its "*Choose one" tag in ember, and auto-scrolls it into view |
| **Add to cart** | The product photo **lifts off and flies along an arc** to the cart icon: the clone starts exactly over the source photo (a 300px hero shrinks as it lifts, a card thumb lifts 8%), the cart badge pops (scale 1 → 1.35 → 1), and the `land` haptic fires on that frame (the bar's press-in already gave `press`). The bar briefly morphs to "Added ✓" |
| **Cart** | Rows have swipe-to-delete (gesture handler) with a red reveal and spring collapse. Qty changes roll their numbers. The summary card total uses the odometer. Rows animate their layout (`LinearTransition`) when one is removed |
| **Mode switch** | The selected-card border and check animate across the cards with a shared layout transition. Mode-specific fields expand with height plus fade |
| **Bottom tab bar** | Floating blurred pill. The active pill **slides and stretches** between tabs (spring width + translate), and its icon and label cross-fade in |
| **Payment** | The pay bar morphs into a loading circle (width collapses to a circle, spinner arc). On success it morphs to a sage check. On failure it shakes and turns into a danger-tinted retry |
| **Order confirmation** | A dark espresso full-screen with the sage check drawn as an SVG stroke, a burst of line-art beans and steam confetti (particles on the UI thread), and the order number counting up |
| **Order tracking** | The current step has a pulsing ring (looping scale/opacity). Advancing a step fills the connector line with a gradient sweep while the next dot stays hidden, then the dot pops 0 → 1; rows reflow with a spring and the step description cross-fades. A live "Preparing your order…" steam animation plays. The ETA, the countdown ring and the simulated status changes share one timeline |
| **Skeletons** | Cream shimmer (moving linear-gradient highlight via `expo-linear-gradient`), never spinners for content |
| **Screen transitions** | Native stack with platform-correct gestures. Modals (mode, address) are gesture-driven bottom sheets with a blurred, dimmed backdrop and rubber-band overscroll |

### Libraries for motion
`react-native-reanimated` (v3+, layout animations, worklets), `react-native-gesture-handler`, `react-native-svg` (line-art, path animation), `expo-haptics`, `expo-blur`, `expo-linear-gradient`, and `@gorhom/bottom-sheet` for the gesture sheets.

### Smoothness checklist (every screen must pass)
1. **No JS-thread animation.** Every animation is Reanimated (shared values, layout animations or CSS transitions), with no `setState` per frame and no `Animated` from react-native.
2. **Scroll is always 60fps.** Use `FlatList`/`FlashList`-style virtualization for long lists (menu, history), plus `getItemLayout` or fixed heights where possible. Use `useAnimatedScrollHandler` (never `onScroll` with setState). No heavy work in render.
3. **Images never pop or jank.** Use `expo-image` with `transition={250}`, `cachePolicy="memory-disk"`, a cream placeholder background, and correctly sized `?w=` URLs. Prefetch hero images on card press.
4. **Taps respond within one frame.** Press-in scale starts immediately. Navigation never waits on data (`getProductSync` gives the first paint), and loading shows skeletons, never blank screens.
5. **Nothing jumps.** Reserve space for async content (skeletons with final dimensions). Layout changes (cart row removal, expanding fields) use `LinearTransition`. No flash of an empty state before data arrives.
6. **Entrances are staggered and short:** 40ms stagger, ≤ 8 items animated (`enterUp`/`enterFade` return an instant entrance past index 8), the rest appear instantly. Cards inside an animating section pass `animateEntrance={false}` so they don't travel twice. On web only the first block of a group rises; later items fade in place (320ms). Re-renders don't replay entrance animations.
7. **Interruptible.** Tapping again mid-animation retargets the spring. Gestures can grab sheets mid-flight.
8. **Haptics match the motion** (`docs/HAPTICS.md`): `select` for choices, `press` then `land` for add-to-cart, `success` as the pay button turns into the check, `error` on failures. Nothing buzzes on a plain navigation tap.
9. **Re-render discipline.** Use zustand selectors that select primitives or stable slices. Memoize list rows. No inline object/array props that defeat memoization in lists. React Compiler is on, so don't fight it.
10. **Reduce Motion** swaps movement for quick fades.

### Performance budget
- No dropped frames on a mid-range Android device (e.g. Pixel 6a/Galaxy A-series).
- Animate only `transform` and `opacity` where possible.
- Images are cached and pre-sized with `expo-image`, using `transition` fade-in on load.

## 8. Screen-by-screen mapping

| Screen | Primary refs |
|---|---|
| Splash | 1 (espresso bg, Fraunces wordmark, line-art) |
| Onboarding: location, notifications | 1 (dark, thin display type, sage capsule, circle arrow, dots) |
| Phone / OTP / profile setup | 1 dark top half with line-art + 2 cream form sheet; 6 rounded OTP boxes |
| Home | 3 header + search + promo, 2 greeting/points + mode cards + product grid, 3 floating nav |
| Menu / Category | 2 uppercase header, store card, outlined chips, 2-col grid |
| Search | 3 search bar, 2 grid results; empty state with line-art |
| Product detail + customization | 1 hero, sheet, size circles, qty, black bar; 2 options list and kcal badge |
| Cart | 1 entire layout |
| Ordering mode / address | 2 store card + mode cards; list of saved addresses as white cards |
| Checkout | 2 cream sections + 1 black "Place order" bar |
| Payment | 1 black bar; simple method cards; failure state in danger tones |
| Confirmation | 1 dark espresso full screen, sage check, line-art confetti |
| Order tracking / history | status timeline; 2 cards |
| Rewards | 2 roast points hero card, reward cards |
| Profile / settings | 2 cream list groups |

## 9. Placeholder brand
- **Name:** Ember Roast Coffee, written in Fraunces Italic.
- **Tagline:** "Small-batch coffee, baked daily."
- **Mark:** a coffee bean drawn in peach line-art.
- All brand values live in `src/theme/brand.ts` and `src/theme/index.ts`, so swapping in the client's brand only means editing those two files (PRD §28).

## 10. Asset notes for the client
- Ref 1's look depends on **cut-out product photos on transparent backgrounds**. The prototype ships 21 bundled cut-outs made from free Unsplash photos (`assets/products/`, 900×900 WebP, works offline; see §R3 A4 and `docs/research/photos/CREDITS.md`). The final build needs the client's own cut-outs, shot from one consistent low angle, at least 1000px, on transparent backgrounds.
- The final brand needs a logo, colors and fonts.
