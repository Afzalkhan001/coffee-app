# Build contract: Ember Roast prototype

This is the single coordination document for everyone building in parallel. **Read it fully before writing code.**
Read these alongside it:
- `DESIGN.md`: the visual and motion spec. Follow it exactly. Section 7 (motion) is a hard requirement; §R4 is dark mode.
- **Theming** (below): colours come from the runtime theme (`useColors()` / `makeStyles`), never the static `colors` export.
- `docs/HAPTICS.md`: the haptic vocabulary and call-site map. Use only `haptic.*` from `src/lib/haptics.ts` (see **Haptics** below).
- `docs/research/*.md`: verified API notes for Expo SDK 57, Reanimated 4.5 and motion recipes. Use them; don't rely on memory.
- `C:\Users\hp\Downloads\Coffee_Shop_Mobile_App_PRD.docx` (summary below): the product requirements.

## Stack facts (verified)
- Expo SDK 57, expo-router 57 (routes in `src/app`), RN 0.86, React 19.2, **React Compiler on**, typed routes on, TypeScript strict.
- Reanimated **4.5.1** + react-native-worklets 0.10.1. Gesture Handler 2.32. react-native-svg 15.15.
- With React Compiler on, use **`sv.get()` / `sv.set(v)`** on shared values, not `.value`.
- To call JS from a worklet, use `scheduleOnRN(fn, ...args)` from `react-native-worklets` (check `docs/research/reanimated4.md`).
- Installed: expo-blur, expo-haptics, expo-linear-gradient, expo-image, expo-location, expo-notifications, zustand 5, AsyncStorage, `@expo/vector-icons` (Ionicons), Outfit + Fraunces fonts.
- **Do NOT install new packages** without strong reason. If you must, use `npx expo install <pkg>` and say so in your final report. `@gorhom/bottom-sheet` is not installed; use expo-router `formSheet` or a custom sheet.
- The app must run in **Expo Go (iOS/Android)** and **web** (`npx expo start --web`). Guard platform-only APIs. BlurView on web/Android must look acceptable (fall back to a semi-opaque fill if needed).
- Path alias: `@/` maps to `src/`.

## Gotchas from research (must follow; details in `docs/research/expo-sdk57.md` §0 and `reanimated4.md` §0)
- **Tabs:** `import { Tabs } from 'expo-router/js-tabs'`. `BottomTabBarProps` also comes from `expo-router/js-tabs`. Never import `@react-navigation/*`; it isn't installed.
- Use `sv.get()` / `sv.set()`, never `.value`. Use `scheduleOnRN` and `scheduleOnUI` from `react-native-worklets`; `runOnJS`/`runOnUI` are deprecated. `measure()` / `scrollTo()` only work on the UI runtime.
- Don't use `sharedTransitionTag`. Do the manual measure-and-fly hero (`reanimated4.md` §6).
- On web, `.springify()` is ignored for layout animations, so also chain `.easing(...)`. For `withInitialValues`, use the transform array form.
- On web, `GestureDetector` needs `touchAction="pan-y"` on horizontal-swipe rows.
- Create animated components, builders and keyframes at module scope.
- Never call `router.*` from the root layout. Gate with `<Redirect>` in `index.tsx`.
- Web stack has no screen transitions, and `formSheet` renders as a full page on web. Every in-screen animation must still play on web.
- `web.output` is `"single"` (SPA), so there are no SSR issues.
- BlurView on Android is only a tint by default. Pair it with a semi-opaque background so it looks right everywhere.
- Fonts: use `fontFamily: 'Outfit_700Bold'` etc. **Never set `fontWeight`.**
- Never put files under `src/app/` that aren't routes (no tests, no components).
- Check `expo-image`, `expo-blur`, `expo-linear-gradient`, `expo-location`, `expo-haptics` and formSheet usage against `expo-sdk57.md`.

## Design additions to include (from `docs/research/design-refs.md` §A2; snippets are there)
- **Home:** "Your usual / Order again" card (from order history), store status chip ("Open · until 9pm"), compact stamp-card teaser.
- **Product detail:**
  - cup glyph scaled 0.8/1/1.2 inside the size circles, with the `option.caption` ("12 oz") under each
  - steam wisps above hot drinks
  - for coffee (`product.coffee`): an origin line, tasting-note pills, a roast meter (5 bean dots) and taste bars (acidity/body/sweetness)
- **Cart:** exactly one upsell row ("Often added · ₹180", the butter croissant).
- **Checkout:** pickup time-slot chips (`pickupSlots()`).
- **Order tracking:** live progress ring with an ETA countdown, a barista line ("Maya is on your order"), and a big pickup code (derived from the order number) for pickup/in-car/dine-in.
- **Rewards:** a 10-slot stamp card (stamps = completed orders % 10) and a perforated redeem ticket with a code.
- **Product cards:** a meta caption ("6 min · 245 kcal") plus a rating chip.

## What already exists (use it; don't duplicate)
- `src/theme/index.ts`: `spacing`, `radii`, `fonts`, `type`, `springs` (snappy/smooth/gentle/bouncy), `durations`, `layout`, plus the runtime theme (`useTheme`, `useColors`, `makeStyles`, `makeThemed`, `ThemeProvider`; see **Theming**). Colours, tints and shadows (`boxShadow` styles, not `shadow*`/`elevation`: see the native notes at the end) are per scheme in `src/theme/palette.ts`; the static `colors` / `heroTints` / `tileTints` / `shadows` exports are the deprecated light palette.
- `src/theme/brand.ts`: `brand` (store info, GST, currency, loyalty), `formatMoney()`, `roundMoney()`, `formatAmount()`, `groupIndian()`, `TAX_LINE_LABEL` ("GST (5%)"), `SPEND_PER_POINT` / `EARN_RATE_LABEL` ("1 pt per ₹5"). See **Market: India (INR round)** below.
- `src/types/models.ts`: every domain type.
- `src/data/mock/*`: menu, modifier groups, marketing (promotions, coupons, rewards, seed addresses, payment methods, FAQ), photos.
- `src/lib/`:
  - `modifiers.ts`: customization engine (`defaultSelections`, `toggleOption`, `validateSelections`, `groupRuleLabel`, `buildSnapshots`, `selectionsFromSnapshots`, `summarizeModifiers`, `estimateKcal`, `isOptionSelected`)
  - `pricing.ts`: `unitPrice`, `lineTotal`, `computeTotals` (packaging + tip), `cartCount`, `deliveryFee`, `packagingFee`, `normalizeTip` / `parseTip` (`TIP_PRESETS`, `TIP_MIN`, `TIP_MAX`), `taxableValue`, `totalsBreakdown` + `formatTotalsLine` (the shared Subtotal → tip rows for every summary, receipt and the invoice), `pointsForTotal`, `pointsForTotals` (no points on the tip)
  - `orderFlow.ts`: `STATUS_FLOW`, `MODE_META`, `ORDER_MODES`, `statusLabel`, `statusDescription`, `canCancel`, `isActiveStatus`, `stepIndex`, `statusProgress`
  - `geo.ts`: `isDeliverable`, `distanceFromStoreKm`, `formatKm`
  - `format.ts`: `uid`, `greeting`, `firstName`, `initials`, `formatPhone`, `isValidPhone`, `nationalPhone`, `displayPhone`, `PHONE_DIAL`, `PHONE_LENGTH`, `formatCount`, `formatDate`, `formatTime`, `relativeDay`, `pluralize`, `pickupSlots`, `formatMoney`
  - `haptics.ts`: the semantic haptics `haptic.select/tick/toggle(on)/press/land/threshold/longPress/success/warning/error` (see **Haptics** below)
  - `notify.ts`, `location.ts`: safe permission helpers
- `src/api/index.ts`: **the only data access layer**. It has `sendOtp`, `verifyOtp` (code `123456` works, `000000` gives an invalid error, expiry after 2 min), `saveProfile`, `getMenu`, `getProduct`, `getProductSync`, `getCategorySync`, `searchProducts`, `getPromotions`, `getRewards`, `getRewardSync`, `validateCoupon`, `findCoupon`, `checkDelivery`, `createOrder` (with `paymentMethodId`, `vpa`, `tip`), `payOrder(orderId, {simulateFailure})`, `lastPaymentChoice(phone)`, `cancelOrder`, `markArrived`, the payment-method rules from `src/api/payments.ts` (`availablePaymentMethods(mode)`, `resolvePaymentMethod`, `findPaymentMethod`, `payFlow`, `paysLater`, `isValidVpa` / `vpaIssue` / `normalizeVpa`, `paymentLabel`, `orderPaymentLabel(order)`, `MERCHANT_VPA`), plus the error classes `NetworkError`, `OtpError`, `PaymentError` and `isNetworkError`. Constants: `OTP_TTL_MS`, `OTP_RESEND_MS`, `DEMO_OTP`.
- `src/api/hooks.ts`: `useAsync(fn, deps)` returns `{data, error, loading, reload}`. Also `useMyOrders()`, `useActiveOrders()`, `useOrder(id)`, `useLoyalty()`. These are live and update as the simulator advances statuses.
- `src/store/session.ts`: `useSession` holds onboarding flags, permissions, notificationPrefs, phone/profile, mode/table/pickupTime/car, addresses/selectedAddressId (`addAddress` selects it, `updateAddress` replaces one in place, `removeAddress`; hydration swaps untouched legacy demo seeds for the structured ones with `upgradeLegacySeeds`), recentSearches and the device preferences `hapticsEnabled` and `appearance` (System / Light / Dark), with their actions. Also `selectModeDetails(state)`, `useIsSignedIn()` and `useAppearance()`.
- `src/store/cart.ts`: `useCart` with `items`, `couponCode`, `rewardId`, `add` (merges identical configs and returns the line id), `replace(lineId, line)`, `setQuantity`, `increment`, `decrement`, `remove`, `reorder(orderItems)`, `setCoupon`, `setReward`, `clear`. Also `useCartCount()`.
- `src/store/demo.ts`: `useDemo` with `offline`, `fastStatus`, `latencyMs` and setters.
- `src/components/ui/*` (import from `@/components/ui`):
  - `Text` (variant/color/align)
  - `SplitTitle` (bold first word, light rest)
  - `Icon` (Ionicons)
  - `PressableScale` (spring press; an optional `hapticKind`, silent by default)
  - `CircleButton` (tones white/ink/glass/cream/ghost)
  - `PillButton` (tones ink/white/outline/ember/sage/cream)
  - `PrimaryBar`: the ref-1 black pill with white circle. Props: `label | left`, `icon`, `onPress`, `disabled`, `loading`, `hint`.
  - `Card`, `Chip`, `Badge`, `Divider`, `Spacer`, `SectionHeader`, `ListRow`
  - `Screen` (safe-area cream container)
  - `ScreenHeader` (back circle, UPPERCASE title, right slot)
  - `TextField`
- `src/app/_layout.tsx`: the root Stack. It loads fonts, waits for store hydration, starts the order simulator, and wraps everything in `OverlayHost`.

## Routing and auth gating (already implemented in `src/app/_layout.tsx`; don't change it)
The root Stack uses **`Stack.Protected`** guards from session state, with `unstable_settings.anchor = '(tabs)'`:
- `!onboardingDone` → only `onboarding` is reachable
- `onboardingDone && !signedIn` → `auth/phone`, `auth/otp`, `auth/profile`
- `signedIn` (phone **and** profile) → `(tabs)` and every app screen
- `legal` is outside every guard (declared last, so a guard flip never falls back to it); the sign-in Terms/Privacy caption links to it

When a guard flips, the router redirects **automatically** to the first available screen. So:
- `session.completeOnboarding()` lands on `auth/phone`
- `session.signIn(phone, profile)` with an existing profile lands on `(tabs)`
- `session.setProfile()` lands on `(tabs)`
- `session.signOut()` lands on `auth/phone`

**Don't call `router.replace` for those transitions**; it can race the redirect. The one exception: after OTP for a NEW user (`signIn(phone, null)`), call `router.replace('/auth/profile')`. Home is `/` (the `(tabs)/index.tsx` route). Use `router.navigate('/')` or `router.dismissTo('/')` to go home.

## Routes (all under `src/app/`)
| Route file | Screen | Owner |
|---|---|---|
| ~~`index.tsx`~~ → **`src/components/onboarding/AnimatedSplash.tsx`** | **There is NO `src/app/index.tsx`** (it would conflict with `(tabs)/index.tsx`, which owns `/`). The splash is an overlay component: `export function AnimatedSplash({ onFinish }: { onFinish: () => void })`. It renders absolutely positioned over the whole app (espresso background, Fraunces wordmark fading in while its letter-spacing tightens, line-art drawing on, tagline). After about 1.4s (or right away with reduced motion) it fades out and calls `onFinish`. The root layout already renders it. **A working version already exists** (the integrator wrote it); G1 may refine it. | G1 |
| `onboarding.tsx` | Swipe pager with 3 pages: Welcome (brand), Location permission, Notifications (order updates and a separate marketing toggle). Dark espresso, line-art, wavy capsule, arc arrow button, page dots, Skip | G1 |
| `auth/phone.tsx`, `auth/otp.tsx`, `auth/profile.tsx` | Phone login, 6-box OTP (resend timer, expiry, invalid/expired errors, demo hint "Use 123456"), profile setup (name required, email optional) | G1 |
| `(tabs)/_layout.tsx` | Tabs with the custom floating `TabBar` (Home · Menu · Orders · Rewards · Profile) | G2 |
| `(tabs)/index.tsx` | Home | G2 |
| `(tabs)/menu.tsx` | Menu | G2 |
| `category/[id].tsx` | Category list | G2 |
| `search.tsx` | Search | G2 |
| `product/[id].tsx` | Product detail + customization. Params: `id`, optional `lineId` (edit an existing cart line) | G3 |
| `cart.tsx` | Cart | G4 |
| `mode.tsx` | Ordering-mode sheet (formSheet): 4 mode cards + mode-specific fields (table, pickup slot chips, car make/color/plate, delivery address → `/address`) | G4 |
| `address.tsx` | Saved addresses (pencil = edit), use current location (pre-fills the form), add / edit the structured Indian address in a form that slides over the list, remove (confirmed), deliverability check with the "No delivery to this address" state | G4 |
| `checkout.tsx` | Checkout | G4 |
| `payment.tsx` | Simulated payment. Param `orderId` | G4 |
| `order/confirmation/[id].tsx` | Order confirmation celebration | G4 |
| `(tabs)/orders.tsx` | Active + past orders | G5 |
| `order/[id].tsx` | Order tracking/details/receipt/reorder/cancel/I'm here | G5 |
| `(tabs)/rewards.tsx` | Rewards | G5 |
| `(tabs)/profile.tsx` | Profile | G5 |
| `settings.tsx` | Settings: notification prefs, Preferences → Appearance (System / Light / Dark, `AppearanceRow`) and the Haptics switch, demo tools (offline toggle, fast statuses, reset demo), app version | G5 |
| `help.tsx` | Help & FAQ | G5 |
| `legal.tsx` | Terms & privacy (param `doc=terms|privacy`) | G5 |

## Shared components and interfaces (phase A built these; phase B consumes them)
**Status:** built, integrated and verified. `npx tsc --noEmit` is clean, React Compiler optimizes every component with no bail-outs, and Jest smoke tests mount every motion and domain component (`src/components/{motion,domain}/__tests__`). None of it has been watched running on a device or in a browser yet. The blocks below are the **exact exported signatures**. Where they differ from the original phase-A brief, the code is the source of truth. `style?: StyleProp<ViewStyle>` is accepted almost everywhere and is marked `style?` below.

### R3 shared kit (round 3 — supersedes the signatures below where they differ; spec: `DESIGN.md` §R3)
**Tokens** (`@/theme`): `colors.bg #F3ECE3`, `line #E6DCCF`, new `night`, `glow`, `storeFrom/storeTo`; `tileTints` (new, same keys as `heroTints`, which are now one step deeper); `radii.tile 28 / category 22 / thumb 20 / thumbSmall 16 / sheet 32 / banner 30`; `fonts.serif` (Fraunces 400 Italic, loaded in `_layout.tsx`); `type.display 52/56`, `title 30/36` (every sentence-case screen title), `screenTitle 28/34` ("MENU" only), `titleBold/titleLight 30/36`, `greeting` + `greetingName`, `h2 19/24`, `cardName`, `caption 13/18`, `sectionLabel`, `micro`, `priceHero 44/48`, `code`, `watermark`; `shadows.float` / `shadows.cta` (`soft`/`card` are retired on cards, rows, tiles and sheets — don't add uses); `layout.headerButton 44`, `layout.ctaCircle 52`.

**Product art** (`@/components/domain`, file `domain/productArt.tsx`) — every product image is a cut-out; never `Photo`/`ThumbStack` for products:
```ts
ProductArt({ image, size, shadow?: 'light' | 'hero' | 'dark' | number | false /* 'light' */, shadowWidth?: number /* 0.62; hero 0.66 */,
  float?, floatPhase?: number /* s */, floatActive?, artOpacity?, transition? /* 250 */, priority?, recyclingKey?, eager?, onLoad?, ref?, style? })
ArtTile({ image, tint?: HeroTint | string /* default: the image's category */, width, height?, radius?, artSize?, artBottom?, shadow?, artOpacity?, artRef?, children?, style? })
ArtThumb({ image, size? /* 64 → r20, art 58 */, tint?, artRef?, artOpacity?, style? })
ArtCluster({ images, layout: { size, x, y, rotate?, z? }[], shadow?, float?, floatActive?, entering?: (i) => builder, exiting?, ref?, style? })  // ≤ 3 unique, keyed by image
ArtStack({ images, size? /* 44 */, max? /* 2 */, overlap? /* px */, shadow?, ref?, style? })   // a row of overlapping cut-outs
ContactShadow({ box, tone?, widthRatio?, animatedStyle?, style? });  useArtFloat(phase?: number /* s */, active?: boolean) → { artStyle, shadowStyle }
tintForImage(image), tintForCategory(categoryId), resolveTileColor(tint), tileRadius(width), clusterImages(images, max?)
```
Measure the **art box** (`ref` / `artRef`) for `setHeroOrigin` and fly-to-cart. `FlyToCartArgs.image` is now `string | number`; a cut-out flies bare (no circle, no tile). `Photo` and `ThumbStack` still compile but render an R3 tile / `ArtStack` (deprecated). `HeroImage` renders cut-outs bare on a `ContactShadow` (no circular crop); remote photos keep the plate.

**Changed domain APIs**
- `ProductCard`: tile `w × 1.05w` (0.9w under 720pt), r28, tint by category, art 0.81w at bottom −6, ≤ 1 sticker (`visibleSticker()`), white 34px "+", name 2-line block + price. `PRODUCT_GRID_GAP = 14`, new `PRODUCT_GRID_ROW_GAP = 22`, `productTileHeight()`, `productArtSize()`.
- `ProductRow`: a transparent 88h row for ONE white sheet (64 tile, name, 1-line description, price 15/700, ink 36px "+"); new `divider` prop + `PRODUCT_ROW_TEXT_INSET`.
- `CategoryTile`: 64 tinted tile + 56 cut-out + one-word label, 74 pitch (`CATEGORY_TILE`, `CATEGORY_TILE_PITCH`). `CategoryChips`: text only (`showIcons` ignored; `counts` only feed the a11y label).
- `PromoCarousel`: 178h r30 banners, code chip, 200px cut-out bleeding 40px above (the carousel already pads 40px on top: `PROMO_BLEED`, `PROMO_CARD_HEIGHT`); the centred slide floats.
- `SummaryCard`: new `variant?: 'full' | 'dock'` (+ `notchColor`). `dock` = the cart's fixed 140px card (≤ 2 breakdown pills, 44px total, top notch, rises 24px, cluster pops in / scales out). `full` = checkout rows + 44px total. Both bleed ≤ 3 cut-outs off the bottom-right. `SUMMARY_DOCK_HEIGHT`.
- `QuantityStepper`: default `size 28`, `tone 'canvas'` (`bg` fill), 15/600 digit, presses to 0.9.
- `MetaChips` → one text line "★ 4.5 · 6 min" (`metaLine()` helper; `compact`/`chipColor` ignored). `DietaryTags` → text "Vegetarian · Dairy-free" (`dietaryLine()`; low-cal omitted).
- `EmptyState`: `art?: 'plate' | 'none'` (default plate; legacy line-art names render the plate), no disc, no sparkle, action pill without icon. `ErrorState`: 28px cloud-off, "You’re offline", "Check your connection and try again.", "Try again".
- `OrderStatusCard`: `hero` = night card (status 24/30, segments, 2×64 `ArtStack`, pickup-code block), `light` = white card, `compact` = Home ink strip (54 cut-out overflowing the top, 3px bar) with new `more?: number` ("+2"). No arrow buttons.
- `OrderHistoryRow`: transparent 76h row for a group sheet (56 tile, title, "Pickup · ER-3310" or danger "Cancelled", total over a 32px "Reorder"); new `divider` + `ORDER_ROW_TEXT_INSET`. The date is no longer in the row (group labels carry it).
- `OrderAgainCard`: white r28 row with an 80px coffee tile of 2 cut-outs, items, "₹550 · 2 items", ink "Reorder".
- `CartButton` default 44 flat; `PointsPill` "610 pts" (no sparkle); `Avatar` initials on roast gradient; `SearchBarButton` flat r26; `StoreCard` gradient (no photo/eyebrow/doodle; compact = 60h Menu row with ink "Pickup ⌄"); `ModeCards` outlined → ink-filled selected card, no check badge; `FloatingCartBar`/toasts use `float`.

**R3 refinement additions (all optional, backwards compatible)**
- `Product.tagline?` (≤ 26 chars): the one-liner list rows show instead of a truncated `description` (`ProductRow`, `SearchResultRow`; no line without one).
- `ProductCard` / `ProductRail` / `PriceText` `saleTone?: 'ember' | 'ink'` (Home passes `ink`: its promo is the one ember element). `ProductCard` no longer reserves a second name line.
- `QuickAddButton` `tone: 'canvas'` (`bg` fill, ink plus) for repeated rows in white sheets; `FloatingCartBar` `suppressed?` (Home holds it until 220pt of scroll); `StatusTimeline` `descriptions?` (tracking passes false); `PulseRing` `variant?: 'wide' | 'soft'`; `orderItemNames(items)` ("Caramel Macchiato + Butter Croissant").
- `PrimaryBar` disabled = ink fill, no `cta` shadow, dimmed label and circle. `PressableScale`: a control that is `accessibilityState.disabled` but not `disabled` (PrimaryBar's nudge) now gets `aria-disabled` on its DOM node instead of RN-web's `<button disabled>`, so web taps still reach `onPress`.
- Home: `PopularRightNow` (`@/components/home`, pass `products` or let it fetch); `FilterChipsSkeleton` + `expectsFilters(categoryId)`; `FrostedTopBar` `backdropFrom/To` (opaque canvas backdrop range); `SlotChips` / `TableChips` `fadeColor?` (right-edge fade).

**R4 diet marks, Veg only and favourites** (all additive)
- **Data.** `Product.diet?: Diet` (`'veg' | 'egg' | 'nonveg'`, `src/types/models.ts`); every mock product sets it (assumptions in `docs/CLIENT_DECISIONS.md` → Other decisions). Egg / non-veg items never carry the `vegetarian` dietary word (Indian usage). A product without `diet` shows no mark and never counts as veg. Tokens `veg #1B8A3B`, `egg #B5780A`, `nonVeg #8B3A1E` (each ≥ 3:1 on `bg` and white; re-tuned for dark in DESIGN.md §R4: `#3DAA5A` / `#D99A2B` / `#DB6A45`).
- **`@/components/domain/VegMark`** (import the file directly; not re-exported from the domain index): `VegMark({ diet, size? /* 14 */, decorative?, style? })` (FSSAI square + dot / triangle, 24-grid SVG, `surface`-filled; a11y "Vegetarian" / "Contains egg" / "Non-vegetarian"), `DIET_META` (label, `tone` token key, symbol), `dietColor(diet, colors)`, `dietLabel(diet)`, `isVegProduct(p)`, `vegFilter(products, vegOnly)`. Shown on `ProductCard` (13px before the name, hanging indent), `ProductRow` / `SearchResultRow` (12px) and the product hero's meta line (14px: "▣ ★ 4.5 · 6 min"). Cart lines show it too (12px before the name, from `getProductSync(line.productId)?.diet`; `CartLine`'s label adds "Contains egg" etc.); checkout and tracking item lines don't.
- **`@/components/domain/FavoriteButton`**: `FavoriteButton({ productId, productName, variant: 'frost' | 'tile', style? })`. `frost` = 44px frosted header circle (product detail, beside the cart; it fades out as the compact title arrives, `[id].tsx`). `tile` = 30px white circle at a tile's top-left, rendered only while favourited (it takes the sticker's corner: one marker per card). Pops 1.28 and plays `haptic.toggle(next)`. `ProductCard` / `ProductRail` take `showFavorite?: boolean` (default true; Home's favourites rail passes false).
- **`src/store/favorites.ts`** (`ember.favorites.v2`, in `STORAGE_KEYS` and `useStoresHydrated`): `useFavorites` with `ids` (newest first, ≤ `MAX_FAVORITES` 60), `vegOnly`, `owner`; `toggle(id) → boolean`, `remove`, `setVegOnly`, `claim(phone)`, `reset`; hooks `useIsFavorite(id)`, `useFavoriteIds()`, `useVegOnly()`; pure `toggleFavoriteId`, `sanitizeFavorites` (hydration goes through it). It follows the session: a different number signing in starts empty, the same number keeps them, Reset demo (onboarding flag drops) clears ids and Veg only.
- **`@/components/home`**: `VegOnlyToggle({ value, onValueChange, size?: 'md' | 'sm' })` (white pill "Veg" + switch with the veg mark in its thumb, `toggle` haptic; Menu header, Category top bar, Search results row), `favoritePicks(products, ids)`, `vegCopy.ts` (`joinNames`, `vegHiddenCategoriesNote`, `noVegMessage`, `vegHiddenReason`), `categorySummary(category, products, { veg })` ("1 veg item · from ₹420"), `CategoryHero` `image?` / `caption?` overrides.
- **Screens.** Menu filters its sections (keys change with the filter so the scroll-spy re-measures) and ends with "No veg items in Bakery & Snacks and Desserts · Show all items". Category: veg-narrowed hero caption + a veg cut-out, "No veg items here" empty state. Search: "No veg results" + "The one match contains egg." + "Show all results"; idle and no-match rails are filtered. Home: "Your favourites" replaces "Popular now" once there's one (R3 ≤ 5 sections). New route `favorites.tsx` (grid with hearts; un-favouriting re-flows it) from Profile → Favourites and Home → See all. It is **not declared** in the root Stack, so expo-router appends it outside the `Stack.Protected` groups (reachable, but not guarded).

**UI kit** (`@/components/ui`): `CircleButton` flat by default (`shadow` opt-in), new tones `canvas` and `frost` (white 55% + blur; Android fill), 44px → 20px glyph, `activeScale`. `PillButton` sizes `xs 32 | sm 36 | md 48 | lg 56`, new tone `muted`. `PrimaryBar` label 18/700, 52px circle, `cta` shadow, new `tone?: 'ink' | 'white'` (white bar + ink circle on night). `ScreenHeader` sentence case: `layout 'inline'` (default; title at x 76 beside the back circle), `'center'` (`centerTitle`, 20/600), `'stacked'`, and `showBack={false}` for tab headers. New `Sheet` (white r28 list with inset hairlines), `SectionLabel` (600 15 `inkSoft`), `NotchBite` (concave notch shape), and `ListRow` R3 (title 16/500, `value`, inline 20px `icon` without disc, `center`). `Card` has no shadow.

**Motion** (`@/components/motion`): `LineArtField` variants `onboarding` (page 1, R3.A9 px composition), `onboarding2`, `onboarding3`, `auth` (page 1 at 0.9), with `pieces?: 'all' | 'shared' | 'page'` and `safeTop?`; `confirmation`/`empty` render nothing. Strokes 2.2px. Parent should span the screen top → capsule top − 16.

### `src/components/motion/` (import from `@/components/motion`)
```ts
// ── Overlay (OverlayHost.tsx): mounted once by src/app/_layout.tsx, above the Stack ──
export function OverlayHost(props: { children: ReactNode }): JSX.Element;
export type ToastTone = 'default' | 'success' | 'error';
export interface ToastOptions { tone?: ToastTone; icon?: string /* Ionicons name; defaults per tone */ }
export type ToastFn = (message: string, opts?: ToastOptions) => void;
export function useToast(): ToastFn;          // ink pill under the safe area; 2.2s; tap to dismiss; a newer toast replaces the older
export interface FlyToCartArgs { image: string; from: WindowRect }
export type FlyToCartFn = (args: FlyToCartArgs) => Promise<void>;
export function useFlyToCart(): FlyToCartFn;  // arc flight; resolves on landing (target pops + haptic.land)
export interface CartTargetProps {
  children: ReactNode; style?;
  priority?: number;   // default 0. Highest visible target wins, then the most recently focused one
  popScale?: number;   // landing pop peak, default 1.35. CartButton passes 1.12 (its badge pops on its own)
}
export function CartTarget(props: CartTargetProps): JSX.Element;

// ── Measuring + hero hand-off ──
export interface WindowRect { x: number; y: number; width: number; height: number }
export function measureInWindowAsync(ref: RefObject<Pick<View, 'measureInWindow'> | null>): Promise<WindowRect | null>;
export function setHeroOrigin(productId: string, rect: WindowRect): void;
export function takeHeroOrigin(productId: string): WindowRect | undefined;   // read-once: call it in a useState initializer

// ── Components ──
export function RollingNumber(props: {
  value: number; prefix?: string; suffix?: string;
  money?: boolean;            // a ₹ amount: prefix + decimals from brand.currency ("₹1,250"); use it for every price
  decimals?: number;          // default: brand.currency.decimals (0) for money, else 0
  fontSize?: number;          // 16
  fontFamily?: string;        // fonts.bold
  color?: string;             // colors.ink
  lineHeight?: number;        // round(fontSize * 1.2): the digit cell height
  grouping?: boolean;         // thousands separator, default true ("2,300")
  animateOnMount?: boolean;   // roll every digit up from 0 (confirmation count-up)
  stagger?: number;           // ms per column, default 18
  style?;
}): JSX.Element;
export type LineArtName = 'cup' | 'latte' | 'bean' | 'beans' | 'croissant' | 'steam' | 'leaf' | 'portafilter' | 'pin' | 'bell' | 'car' | 'bag' | 'sparkle' | 'cookie' | 'check';
export function LineArt(props: {
  name: LineArtName; size?: number /* 64 */; color?: string /* peach */; accentColor?: string /* detail strokes */;
  strokeWidth?: number; draw?: boolean; delay?: number; duration?: number; float?: boolean; style?;
}): JSX.Element;
export type LineArtFieldVariant = 'onboarding' | 'auth' | 'confirmation' | 'empty';
export function LineArtField(props: { variant?: LineArtFieldVariant; draw?: boolean /* true */; delay?: number; style? }): JSX.Element; // absolute-fills its parent
// Onboarding pieces: `progress` is ONE 0..1 value across ALL pages (scrollX / (pageWidth * (pages - 1))), not a page index
export function WavyCapsule(props: { progress: SharedValue<number>; width?: number /* 220 */; height?: number /* 60 */; style? }): JSX.Element;
export function ArcArrowButton(props: {
  progress: SharedValue<number>; onPress: () => void; accessibilityLabel: string;
  icon?: string; size?: number /* 64 */; minArc?: number /* 0.34 */; disabled?: boolean; style?;
}): JSX.Element;
export function PageDots(props: { count: number; progress: SharedValue<number>; color?: string; activeColor?: string; style? }): JSX.Element;
export function Skeleton(props: { width?: DimensionValue /* '100%' */; height: number; radius?: number; style? }): JSX.Element;
export function ConfettiBurst(props: {
  play: boolean; originY?: number; originX?: number; colors?: string[]; count?: number /* 28 */; seed?: number; style?;
}): JSX.Element; // absolute-fills its parent; renders nothing under Reduce Motion
export function PulseRing(props: { size: number; color: string; active?: boolean; duration?: number; children?: ReactNode; style? }): JSX.Element;
export function AnimatedCheck(props: {
  size: number; color?: string /* sage */; play: boolean; delay?: number; strokeWidth?: number;
  ring?: boolean /* true */; filled?: boolean; onDone?: () => void; style?;
}): JSX.Element;
export type MorphPayButtonState = 'idle' | 'loading' | 'success' | 'error';
export function MorphPayButton(props: {
  state: MorphPayButtonState; label: string; onPress: () => void; disabled?: boolean;
  icon?: string /* 'lock-closed' */; haptics?: boolean /* true: press on press-in, success as the check pops, error itself */; style?;
}): JSX.Element;

// ── hooks.ts / color.ts ──
export function useShake(): { style: AnimatedStyle<ViewStyle>; shake: () => void };   // ±6px x3; no haptic (add your own)
export function usePop(peak?: number /* 1.35 */): { style: AnimatedStyle<ViewStyle>; pop: () => void };
export function shakeValue(offset: SharedValue<number>, amplitude?: number, cycles?: number, delay?: number): void; // worklet-safe
export function enterUp(index?: number): EntryAnimation;   // fade + rise 12px, 40ms stagger capped at 10; quick fade under Reduce Motion
export function riseEntrance(opts?: { delay?: number; distance?: number /* 12, native */; duration?: number /* 420, web */;
  small?: boolean /* web: fade only */; spring?: { damping: number; stiffness: number } }): EntryAnimation; // the web-safe fade+rise builder
export function enterFade(index?: number): EntryAnimation;
export function popIn(index?: number): EntryAnimation;     // zoom pop for badges/stickers
export const exitFade: ExitAnimation;
export const layoutSpring: LayoutTransition;               // spring on native, eased timing on web
export const easeOutQuint: EasingFunctionFactory; export const easeInOutCubic: EasingFunctionFactory;
export const fadeTiming: WithTimingConfig;
export const reducedMotionAtLaunch: boolean;
export function withAlpha(hex: string, alpha: number): string;   // token + alpha → rgba() (worklet-safe)
export const boxShadows: { soft: string; float: string; strong: string };  // boxShadow strings for new arch + web
```
Behaviour that screens rely on:
- **Fly-to-cart.** Pass the **same image URL the source view displays**. Domain photos are width-bucketed by `sizedPhoto(url, size)`, so use `sizedPhoto(product.image, photoSize)`; otherwise the clone flies as an empty circle while a new image downloads. `useQuickAdd`/`useReorder` already do this for you.
- **Targets.** `CartTarget` uses `useIsFocused`, so it only works inside a screen, and only the focused screen's targets count. A target must be within the window bounds to be picked. If there is none, the thumbnail flies to the top-right corner and fades out.
- **iOS sheets.** `formSheet`/modal screens are separate native windows on iOS, so toasts and flights render underneath them. Don't toast from inside `mode`.
- **Reduce Motion.** Fly-to-cart skips the flight but keeps the haptic and the pop. Confetti renders nothing. Entrances become quick fades. The toast still stays 2.2s. The pay spinner keeps turning.
- **Money.** For `RollingNumber`, pass `money` (never a hand-typed symbol or decimals). Grouping follows `brand.currency.locale` (en-IN: "1,25,000"), and the "₹" prefix is drawn in the system face at the digits' weight because Outfit has no ₹.

### `src/components/navigation/TabBar.tsx` (import from `@/components/navigation/TabBar`)
```ts
export function TabBar(props: BottomTabBarProps): JSX.Element;   // BottomTabBarProps from 'expo-router/js-tabs'
export const TAB_BAR_HEIGHT = 68;   // the pill itself
export const TAB_BAR_SPACE = 84;    // pill + 16px gap, excluding the safe area
export function tabBarBottom(safeAreaBottom: number): number;   // the bar rests at max(safe area, 16)
export function useTabBarSpace(breathing?: number /* 16 */): number;  // exact bottom padding for tab-screen scroll content
```
- Wire it in `(tabs)/_layout.tsx` (G2): `<Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false }}>`.
  - Route names must be `index` / `menu` / `orders` / `rewards` / `profile`, because icons are mapped by route name.
  - Set `options={{ title: 'Home' }}` and so on for each tab, because the labels come from `title`.
- The bar is absolutely positioned and floats over the content. Tab screens pad their scroll content with **`useTabBarSpace()`**, which is preferred over `TAB_BAR_SPACE + insets.bottom` because that leaves 0px of air above the bar on Android and web. While the floating cart bar is showing, add `FLOATING_CART_BAR_SPACE` from domain.
- The bar hides on keyboard. Android uses a 97% white fill (no real blur). iOS and web use blur plus a translucent fill.

### `src/components/domain/` (import from `@/components/domain`)
```ts
// ── Product surfaces ──
ProductCard({ product: Product; index?: number; width?: number /* half the screen, max 230 */;
  onQuickAdd?: (p: Product) => void;   // REPLACES the built-in quick-add (default: fly-to-cart, or open detail when options are required)
  onPress?: (p: Product) => void;      // REPLACES the built-in open (default: setHeroOrigin + router.push('/product/[id]'))
  style? })
ProductRow({ product: Product; onPress: (p: Product) => void /* the hero origin is already stored when this runs */;
  index?: number; onQuickAdd?: (p: Product) => void; style? })
PriceText({ price: number; compareAt?: number; size?: number /* 16 */; color?: string; style? })
MetaChips({ product: Pick<Product, 'prepMinutes' | 'kcal' | 'rating' | 'ratingCount'>; compact?: boolean;
  kcal?: number /* live estimate override */; withRating?: boolean /* compact only */; chipColor?: string; style? })
DietaryTags({ tags: DietaryTag[]; max?: number; style? })
QuantityStepper({ value: number; onChange: (n: number) => void; min?: number /* 1 */; max?: number /* 20 */;
  size?: number /* 44; use 52 on product detail */; tone?: CircleTone /* 'cream' */; style? })
// ── Browsing ──
CategoryTile({ category: Category; selected?: boolean; onPress: (c: Category) => void; accent?: 'ink' | 'ember' /* default ink */ })
CategoryChips({ categories: Pick<Category, 'id' | 'name' | 'icon'>[]; selectedId?: string; onSelect: (id: string) => void;
  showIcons?: boolean /* true */; counts?: Record<string, number>; contentContainerStyle?; style? })  // auto-scrolls the selection to centre
PromoCarousel({ promotions: Promotion[]; onPress: (p: Promotion) => void })   // renders null when the list is empty
SearchBarButton({ onPress: () => void; placeholder?: string /* omitted: "Search lattes…" rotates through suggestions */; style? })
ModeCards({ value: OrderMode; onChange: (m: OrderMode) => void; compact?: boolean; style? })
StoreCard({ onViewMap?: () => void /* default: openInMaps() from @/lib/maps (Apple Maps / geo: intent / Google Maps web) */; style? })
StoreStatusChip({ tone?: 'surface' | 'clear'; style? });  storeStatusLabel(): string   // "Open · until 9pm"
// ── Header / account ──
CartButton({ tone?: CircleTone /* 'white' */; size?: number /* 48 */; onPress?: () => void /* default push('/cart') */; style? })
  // a CartTarget: the whole button bumps (1.12) when a thumbnail lands, and the sage badge pops 1 → 1.35 → 1 as the count grows
Avatar({ name?: string; size?: number /* 44 */; style? })
PointsPill({ points: number; onPress?: () => void })
FloatingCartBar({ bottomOffset?: number /* default: 12px above the tab bar */; style? })
  // render as the LAST child of the screen root (absolute). Self-hides when the cart is empty.
  // While visible, its arrow circle is a fallback fly target (priority -1) for when the header cart has scrolled off screen.
// ── Cart / checkout ──
SummaryCard({ totals: OrderTotals; itemImages?: string[]; mode?: OrderMode /* 'delivery' always shows the fee row */; style? })
// ── Orders ──
OrderStatusCard({ order: Order; onPress?: () => void /* default push('/order/[id]') */; index?: number; style? })
OrderHistoryRow({ order: Order; onPress?: () => void /* default push('/order/[id]') */; onReorder: () => void; index?: number; style? })
StatusTimeline({ order: Order; style? })
OrderAgainCard({ order?: Order /* default: most recent completed order; renders null when there is none */; index?: number; style? })
// ── States ──
EmptyState({ art: LineArtName; title: string; message?: string; action?: { label: string; onPress: () => void; icon?: string }; compact?: boolean; style? })
ErrorState({ error: unknown; onRetry: () => void; compact?: boolean; style? })   // NetworkError → "You're offline"
ProductCardSkeleton({ width?; style? }); ProductGridSkeleton({ count?: number /* 4 */; style? }); ProductRowSkeleton({ style? });
PromoCarouselSkeleton({ style? }); OrderRowSkeleton({ style? })

// ── Building blocks + logic ──
PRODUCT_GRID_GAP = 16;  productCardWidth(screenWidth: number, columns?: number /* 2 */, gap?: number): number
FLOATING_CART_BAR_SPACE = 72;   // extra scroll padding (on top of useTabBarSpace()) while the cart bar shows
Photo({ uri: string; size: number; radius?: number /* circle */; recyclingKey?: string; priority?: 'low' | 'normal' | 'high'; eager?: boolean; style? })
ThumbStack({ images: string[]; size?: number /* 44 */; max?: number /* 3 */; ringColor?: string; overlap?: number; style? })
sizedPhoto(url: string, displaySize: number): string
QuickAddButton({ onPress: () => void; added?: boolean; size?: number /* 34; hit area padded to 44 */; accessibilityLabel: string; style? })
BadgeSticker({ badge: ProductBadge; style? }); LowCalStamp({ size?: number; style? }); RatingChip({ rating: number; style? }); SoldOutOverlay({ radius?: number })
DIETARY_META: Record<DietaryTag, { label: string; icon: string }>
useQuickAdd(): (product: Product, from: WindowRect | null, imageSize?: number) => Promise<'added' | 'needs_options'>
useReorder(): (items: OrderItem[], from: WindowRect | null, imageSize?: number) => Promise<void>   // one flight, every line re-added, one toast
quickAddLine(product: Product): NewCartLine | null;  canQuickAdd(product: Product): boolean;  openProduct(productId: string): void
useLastCompletedOrder(): Order | undefined
orderTitle(order): string; orderItemsSummary(items: OrderItem[]): string; orderImages(order): string[];
minutesLeft(order, now: number): number; etaLabel(order: Order, now: number): string   // "Ready in ~8 min"
useFlash(durationMs?: number): [on: boolean, trigger: () => void]; useNow(intervalMs?: number, resetKey?: string): number; // a new key re-reads the clock at once
useValueChange<T>(value: T, onChange: (next: T, prev: T) => void): void; staggerIndex(index: number, firstScreen?: number): number
```
Behaviour that screens rely on:
- **Quick-add.** The line is added **when the thumbnail lands**, so the badge pops on arrival. A 1.5s safety timeout adds it anyway. The confirmation is the flight, the badge pop, the haptic and the "+" turning into a ✓. A toast only appears if there was no flight, because it would slide over the header cart right as it pops. `useReorder` always toasts.
- **Drinks.** Every drink in the mock menu has a required Size group with no default, so "+" on a drink opens product detail. Food items add in one tap.
- **Reorder pill.** The "Reorder" pill on `OrderHistoryRow` is 36px tall (`PillButton size="sm"`), with a smaller hit area than the 44px rule.
- **Contrast choices.** `SummaryCard` uses ink text on peach and a `peachSoft` fee pill, for contrast. NEW stickers and sage promo cards use `sageDeep` behind white text.
- **Zustand in tests.** Persisted zustand setters return a Promise. In tests, write `act(() => { store.add(x); })` with braces, never `act(() => store.add(x))`, or `act` treats it as async and silently breaks later renders.

### Notes for screen owners (phase B)
- **G1, splash.** `src/components/onboarding/AnimatedSplash.tsx` already exists, written by the integrator so the root layout compiles. It's a complete implementation of the spec above: a bean mark that draws itself, the wordmark tracking in, the tagline, a lift-and-fade after about 1.4s, and an immediate cross-fade under Reduce Motion. G1 owns it and may refine or replace it, but must keep `export function AnimatedSplash({ onFinish }: { onFinish: () => void })` and `export function useSplashLifted(): boolean`.
- **G1 + G2, first screen.** The first screen mounts *under* the splash, so its entrance would finish unseen. `useSplashLifted()` (from `@/components/onboarding/AnimatedSplash`) flips to `true` about 120ms before the splash fades, and stays true afterwards. There's a 2.6s safety fallback, so it can never deadlock. Onboarding (line-art draw-on) and Home (staggered entrance) should start their entrance on it by mounting the animated content once it's true, e.g. `{lifted ? <LineArtField variant="onboarding" /> : null}`. Don't toggle `draw={lifted}`: `draw={false}` renders the art fully drawn, so flipping it would flash the finished art before it redraws.
- **G3, product detail.** `product/[id]` currently uses `animation: 'fade'` in the root layout. That native fade also fades your measured hero flight, which still reads as a soft zoom-fade. If you want the solid FLIP from `reanimated4.md` §6 (with an in-screen backdrop fade), ask in your report for `animation: 'none'`.
- **Tab screens.** Pad scroll content with `useTabBarSpace()`, plus `FLOATING_CART_BAR_SPACE` on Home, Menu, Category and Search while `useCartCount() > 0`. Render `<FloatingCartBar />` last in the screen root.

**DESIGN.md §0 is a hard rule:** the app must read instantly as a food-ordering app. Show photos, prices, quick-add, rating/prep chips, a visible cart and the floating View-cart bar.
Phase B screen owners may add **private** components inside their own route files or in `src/components/<group>/` (`onboarding/`, `home/`, `product/`, `checkout/`, `account/`). Never edit files you don't own. If you need a change to a shared file, describe it in your final report.

## Global rules
1. **Design fidelity.** Every screen must follow DESIGN.md §R3 (and §R4 in dark; colours from the runtime theme, see **Theming**): warm cream canvas, tinted tiles, white only for lists/forms/sheets, ink-black primary pill bars with a white circle button, sentence-case titles (uppercase only for "MENU", stickers and codes), peach summary card, sage badges, ember used sparingly. Use theme tokens, never raw hex. Product images are transparent cut-outs on tinted planes with a contact shadow (`ProductArt` / `ArtTile` / `ArtThumb`, `contentFit="contain"`); never circular crops.
2. **Motion everywhere** per DESIGN.md §7: springs from `theme.springs`, UI-thread only, staggered entrances, press feedback via `PressableScale`, haptics, `useReducedMotion` respected. No `Animated` from 'react-native' and no setTimeout-driven animation.
3. **Every PRD §24 UI state** relevant to your screens must be reachable: loading skeletons, empty, error (`isNetworkError` → `ErrorState` with retry), disabled/invalid states.
4. Bottom padding: tab screens pad their scroll content by `useTabBarSpace()` from `@/components/navigation/TabBar` (the same as `TAB_BAR_SPACE` + safe-area bottom on iPhone, with real air on Android and web). Add `FLOATING_CART_BAR_SPACE` while the cart bar shows. Sticky bottom bars sit above the safe-area inset.
5. **Navigation** uses `router` / `Link` from expo-router. Typed routes are on: hrefs must match real files. Use `router.push({ pathname: '/product/[id]', params: { id } })` style when TS complains.
6. Copy: warm, concise, specialty-café tone. Money via `formatMoney`.
7. Accessibility: `accessibilityLabel` on icon-only buttons, tap targets of at least 44px.
8. Quality bar: `npx tsc --noEmit` must pass for your files. No `any` unless unavoidable. Keep components small and readable.
9. Don't run `expo start` or long-lived servers. Integration testing is done in a later phase.

## Integration notes (phase C — read before changing anything)
Verified after integration: `npx tsc --noEmit` clean (also with generated typed routes), Jest green, `npx expo lint` 0 errors (React Compiler rules included: no synchronous setState in effect bodies, no refs or `Date.now()` reached during render), React Compiler optimizes every component except `useAsync` (intentional eslint-disable), `expo export` builds web, iOS and Android, and every route was screenshotted and driven in headless Chrome at 390×844.

**Web rules learned the hard way**
- **Never build an `entering` animation with `withInitialValues` or a `Keyframe` for web.** Reanimated 4.5.1 web turns it into a custom CSS keyframe whose cleanup timer (≈5× duration) pins the element with `position: absolute` (`layoutReanimation/web/componentUtils.ts` → `scheduleAnimationCleanup` → `setElementPosition`); the element drops out of flow and later content slides under it. Use `enterUp()` or `riseEntrance()` from `@/components/motion`: web gets the plain `FadeInDown` preset (or a fade with `small: true`), native keeps the custom distance + spring.
- **`pagingEnabled` ScrollView on web:** react-native-web wraps each *direct child* in its own snap `View`. Pass pages as separate children or a keyed array, never inside a Fragment (a Fragment stacks every page into one column and the pager can't move).
- **Web `TextInput` focus ring:** Chrome's ring is `outline-style: auto`, which ignores `outlineWidth: 0`. Use `outlineStyle: 'none'` (RN types lack it; cast as `TextStyle`).
- **Product route on web is a `transparentModal`** (`PRODUCT_OPTIONS` in `_layout.tsx`): the web stack hides every non-focused screen unless the one above it is transparent, so the tapped screen stays painted under the product's fading tint during the hero flight. Native keeps the short fade. Any probe/test that scrolls "the" scroll view on web must pick the one on top (the screen below is still in the DOM and displayed).
- **Browsers scroll `overflow: hidden` containers to reveal a focused input.** A root whose child hangs below the screen (AuthScaffold's sheet overdraw) gets scrolled when an autofocused field mounts off-screen; use `overflow: 'clip'` on web there.
- **Short phones (`COMPACT_SCREEN_HEIGHT`, 720pt):** product cards use a slightly landscape tile (skeletons match) and Menu tightens the gaps above the first section, so the first row's price clears the floating View cart bar at 375×667.
- **Unsplash photos (remote URLs only):** bundled `local:<key>` art passes through `sizedPhoto()` untouched; for a remote Unsplash URL it scales `h=` with `w=`. With `fit=crop`, a lone `w=120&h=800` returns a 120×800 strip that `contentFit="cover"` magnifies into a blurry close-up.

**React Compiler** (bail-outs are silent; the component just isn't memoized)
- No `try…finally`, and no `?.` / `??` / ternaries inside `try`/`catch` blocks. Use `attempt(promise)` from `@/lib/async`, which returns `{ ok: true, value } | { ok: false, error }`.
- No computed default parameters (`shadow = tone === 'white'`, `radius = size / 2`): compute them in the body.
- Check with Babel + `babel-preset-expo` and the compiler logger (see the integrator's `rc-check.cjs` in the scratchpad).

**Shared helpers added during integration**
- `src/lib/async.ts`: `withTimeout(promise, ms, fallback)` and `attempt(promise)` (`authFormat.ts` re-exports both).
- `src/lib/pickupCode.ts`: `pickupCode(orderNumber)` ("ER-4827" → "N27"), `usesPickupCode(mode)`, `hashString`. Confirmation, payment and tracking all use it (`account/format.ts` wraps it as `pickupCode(order)`).
- `src/lib/location.ts`: `requestLocationPermission()` resolves `'undetermined'` after 20s on web (ignored prompt); `getCurrentPosition()` resolves `null` after 12s without a fix.
- `statusDescription(status, mode, arrived?)`: the in-car "ready" copy switches once the customer taps "I'm here".
- `api.searchProducts` indexes dietary tags as "dairy-free" (so "dairy-free" and "dairy free" both match); `createOrder` only stores a coupon that applies.

**Data formats**
- `session.phone`, `profile.phone`, `order.customer.phone` and the OTP calls use the bare 10-digit Indian mobile number (`"9876543210"`). `nationalPhone()` normalises typed input (drops `+91` / `91` / a leading `0`). Display with `displayPhone()` ("+91 98765 43210") everywhere; `formatPhone()` ("98765 43210") is for input fields. The sign-in field uses `phoneInput()` / `formatPhoneInput()` (`authFormat.ts`): a plain number caps at 10 digits, but a number typed with its `91` / `0091` / trunk `0` keeps those digits until it is complete and then collapses to the national number (capping at 10 straight away left "919876543210" stuck at the valid but wrong "91987 65432").

**Market: India (INR round)**
- **Money is whole rupees end to end.** `brand.currency = { code: 'INR', symbol: '₹', locale: 'en-IN', decimals: 0 }`. Every money computation goes through `roundMoney()` (half up to `currency.decimals`; it replaced `round2`), including pricing, coupons, rewards and the seeded demo history. `formatMoney()` prints "₹250", "₹1,250", "₹1,25,000", and "−₹40" for negatives. Never hand-write "$", "₹", `toFixed(2)` or `toLocaleString()` for money or counts: use `formatMoney`, `formatCount` ("1,25,000" for points) or `RollingNumber money`.
- **GST.** `brand.taxRate = 0.05`, labelled `TAX_LINE_LABEL` ("GST (5%)") on every summary and receipt; computed on the discounted subtotal **plus packaging** (`taxableValue`); the delivery fee and the tip sit outside it.
- **Packaging and tip (round 4).** `OrderTotals.packaging` (₹15 for pickup, in-car and delivery; 0 for dine-in and an empty basket) and `OrderTotals.tip` (delivery only, ₹1–₹500, not taxed, not discountable, no points) are **optional** on the type: totals saved before them have neither, so read them as `?? 0` (or render with `totalsBreakdown`, which already does). `total = subtotal − discount + packaging + tax + deliveryFee + tip`.
- **Payments (round 4, UPI first).** `PAYMENT_METHODS` (`marketing.ts`): Google Pay, PhonePe, Paytm, BHIM (`type: 'upi'`, `upiApp`), "Pay with UPI ID" (`pm-upi-id`), Visa •••• 4242 (`pm-card`), RuPay •••• 6011, "Add new card" (simulated, no entry), cash on delivery (`cod`, delivery only) and pay at the counter (pickup, dine-in, in-car). No Apple Pay; `apple_pay` / `google_pay` stay in `PaymentMethodType` only for old saved orders. `Order.payment` (optional, `OrderPayment`) freezes the exact method, its label ("PhonePe", "UPI · ava@okicici") and, once paid, a simulated 12-digit `upiRef` and `txnId`; use `orderPaymentLabel(order)` for display (older orders fall back to their type); `account/format.ts` `paymentMethodLabel(order)` / `refundCopy` wrap it, `paymentMethodIcon` has `upi` / `cod` glyphs and `paymentStatusMeta` says "Pay on delivery" for unpaid cash-on-delivery orders. The tracking receipt (`OrderDetails` → `ReceiptCard`) renders `totalsBreakdown` rows (packaging and the tip included) and the checkout `MethodMark` for the payment line. Checkout defaults to `lastPaymentChoice(phone)` (seeded history doesn't count → Google Pay). The UPI hand-off (opening → approve with a 5:00 countdown → approved) lives in `payment.tsx` + `components/checkout/UpiApproval.tsx`; `payOrder` is the bank's answer.
- **GST invoice.** `order/invoice/[id]` (`components/invoice/`): `buildInvoice(order)` / `invoiceText` / `hasInvoice` (paid, or completed with cash collected), invoice number `ER/<FY>/<6-digit serial from the order number>`, exact CGST + SGST halves of the stored GST, amounts in words (Indian system), placeholder GSTIN/FSSAI, "Prototype — not a valid tax invoice". Order details links to it ("View GST invoice").
- **Prices** (₹): see `src/data/mock/menu.ts` / `modifiers.ts`. Delivery ₹40, free from ₹499. Coupons FIRST20 (20%, max ₹150, first order), EMBER100 (₹100 off from ₹500), WELCOME10 (10%), SUMMER25 (expired). Loyalty: 1 pt per ₹5 (`pointsPerUnit: 0.2`), welcome bonus 150; reward values ₹50 / ₹180 / ₹300 / ₹500 (`rw-500off`).
- **Phone (+91).** Stored everywhere (OTP, session, profile, `ownerPhone`, `customer.phone`) as the bare 10-digit national number; `nationalPhone()` strips a pasted `+91`, `0091` or trunk `0`. Valid = 10 digits starting 6–9 (`isValidPhone`); the sign-in chip reads "IN +91"; the field formats "98765 43210". Support line `brand.supportPhone` "+91 80 4718 2290" (`tel:+918047182290`).
- **Place.** Store "Ember Roast — Indiranagar", 12th Main Rd, HAL 2nd Stage, Indiranagar, Bengaluru 560038 (12.9716, 77.6412). Seed addresses: Home (Domlur, 1.2 km, landmark "Domlur Flyover"), Work (Residency Rd, Ashok Nagar, 3.8 km), Nandi Hills cottage (out of range).
- **Addresses are structured** (`Address.parts`: `flatNo`, `building?`, `street?`, `landmark?`, `area`, `city`, `state`, `pin`; plus `kind` home / work / other and `contactName?` / `contactPhone?` for someone else receiving). `line1` / `line2` / `city` stay as the derived display lines every screen reads ("Flat 4B, Sunrise Residency, 6th Cross" / "Near Domlur Flyover" / "Domlur, Bengaluru 560071"); helpers live in `src/lib/address.ts` (`formatAddress(a, 'short' | 'full')`, `addressCityLine`, `landmarkLine`, `receiverLine`, validation, `composeAddress`, `fieldsFromAddress`). Addresses saved before `parts` existed keep their lines and are split back into fields when edited; the untouched old demo seeds are swapped for the structured ones when the session store hydrates (and again, harmlessly, when the address screen opens) (`upgradeLegacySeeds`). The form requires house / flat, a building or street, area, a 6-digit PIN (`isValidPin`, `^[1-9][0-9]{5}$`), city and state; a Bengaluru PIN (560001–560103) fills in Bengaluru, Karnataka. An area/city containing "nandi", "mysuru" or "mysore" (`OUT_OF_RANGE_DEMO`) lands out of range; a known area or PIN (`LOCALITIES`, `findLocality` in `src/lib/geo.ts`) lands in that neighbourhood. "Use current location" pre-fills the nearest known neighbourhood (`locateFix`, no reverse geocoding).
- **Persisted keys are v2** (`STORAGE_KEYS` in `src/lib/storage.ts`), so a device that ran the USD build starts fresh; `useStoresHydrated()` then deletes the v1 keys once (`purgeLegacyStorage()`, best effort). Bump again whenever persisted money, phone or address shapes change meaning (and add the old keys to `LEGACY_STORAGE_KEYS`).
- **Dates.** `formatDate()` prints day-first ("28 Sep 2026") by hand, not with the device locale. Times still follow the device ("8:08 PM").
- **Long amounts.** Anything that shows a ₹ amount next to a name must survive "₹13,083" at 375pt: cart line names wrap to two lines, reward names stay short ("₹500 off").
- **₹ glyph.** Outfit has no U+20B9. On web, `src/theme/currencyGlyph.web.ts` (installed by the root layout) adds per-family `@font-face` rules with `unicode-range: U+20B9` pointing at a local system font of the same weight; native falls back to the system font by itself (check the weight on device). `RollingNumber` draws its "₹" in the system face with an explicit weight on every platform.

**Typed routes without a dev server**
`expo start` normally writes `.expo/types/router.d.ts`. To check hrefs without it, set `EXPO_ROUTER_APP_ROOT=<project>/src/app` and call `regenerateDeclarations('<project>/.expo/types', {})` from `node_modules/expo/node_modules/@expo/cli/node_modules/@expo/router-server/build/typed-routes`, then run `npx tsc --noEmit` (the tsconfig already includes `.expo/types/**/*.ts`).

## Theming (R4 dark mode) — read before writing any colour
Spec: `DESIGN.md` §R4 (the light → dark token table). Code: `src/theme/palette.ts` (both palettes), `src/theme/theming.tsx` (provider, hooks, `makeStyles`), `src/theme/appearance.ts` (the preference and how it resolves). **Colours are read at render time. The static `colors` / `heroTints` / `tileTints` / `shadows` exports (and `boxShadows` from the motion kit) are the LIGHT palette, kept only so unconverted screens compile.**

**API** (everything from `@/theme` unless noted):
```ts
useTheme(): Theme   // { scheme: 'light' | 'dark', isDark, colors, tileTints, heroTints, shadows, boxShadows, contact, blurTint, statusBarStyle, keyboardAppearance }
useColors(): ColorTokens                        // = useTheme().colors
makeStyles((c, t) => ({ ... }))  → useStyles()  // module scope; both schemes' StyleSheets are built once at import
makeThemed((c, t) => value)      → useValue()   // the same for tone tables, gradient stops, palettes
<ThemeProvider preference={appearance}>          // root layout only (it already wraps the app)
<ThemeScope scheme="light">                      // pin a subtree to one scheme (rare)
themeFor(scheme), lightTheme, darkTheme, lightColors, darkColors, lightTileTints, darkTileTints, lightHeroTints, darkHeroTints
AppearancePreference ('system' | 'light' | 'dark'), APPEARANCE_PREFERENCES, APPEARANCE_LABEL, resolveScheme(pref, os, follow?), sanitizeAppearance, FOLLOW_SYSTEM_SCHEME
// session store: appearance (default 'system', survives sign-out + Reset demo), setAppearance(pref), useAppearance()
// @/components/account/AppearanceRow: the Settings → Preferences selector
```
- **How it resolves.** An explicit Light / Dark wins. **System** follows `useColorScheme()` while `FOLLOW_SYSTEM_SCHEME` (`src/theme/appearance.ts`) is `true`. It was `false` during the conversion (a phone in dark mode kept opening the light app); every screen is now converted (`npm run theme:check -- --strict` passes) and was checked in both schemes, so it is **`true`** (QA pass, round 4). Setting it back to `false` makes System resolve to light again. On iOS the session store mirrors the choice into `Appearance.setColorScheme` (keyboard, alerts and the sheet grabber follow); Android and web are not overridden (`setDefaultNightMode` can recreate the activity in Expo Go).
- **What already follows the scheme.** The root `StatusBar` style (`LightStatusBar` screens are unchanged), the Stack `contentStyle` (and the mode sheet's), the tabs `sceneStyle`, the root view, the web document background + `color-scheme`, and the native root background (`expo-system-ui`). `app.json` has `userInterfaceStyle: "automatic"`.
- **Converted** (no static palette; ESLint enforces it): `src/theme`, `src/components/{ui,domain,motion,navigation,order,invoice}`, `src/app/_layout.tsx`, `src/app/(tabs)/_layout.tsx`, and Settings as the reference screen (`src/app/settings.tsx` + `components/account/{AppearanceRow,ConfirmSheet,HeaderScrollEdge,ListGroup,ModalSheet,NotificationPrefsCard,Toggle}`). Everything else started R4 on the static palette (88 files / 666 `colors.*` uses) and is converted in the bullets below; `npm run theme:check` lists anything left (it reports nothing after the commerce pass).
- **Converted (R4 browse + account + sign-in):** every tab screen (`src/app/(tabs)/*`), `category/[id]`, `search`, `onboarding`, `auth/*`, `help`, `legal`, and all of `src/components/{home,onboarding,account}` (incl. `OrderHero` / `OrderDetails` / `OrderRing` used by tracking). Art-direction choices beyond the token table (DESIGN.md §R4 component notes): `authPlanes(c, t)` in `components/onboarding/AuthScaffold.tsx` gives the sign-in sheet and its fields (`AuthField`, the "+91" pill, the OTP boxes) — light: canvas sheet + white fields; dark: `surface` sheet + canvas fields; the Veg only switch pins its thumb's mark to light with `<ThemeScope scheme="light">`; the Home notifications popover and the redeem ticket get a white hairline edge in dark (the popover dims with black, the ticket's "Done" turns `ink`); `SegmentedControl` labels cross-fade to `onInk`; every text input passes `useTheme().keyboardAppearance`. Night pieces (splash, onboarding art, the glossy button, the toggles on night) read only fixed tokens, so they are identical in both schemes.
- **Converted (R4 commerce):** `product/[id]`, `cart`, `checkout`, `mode`, `address`, `payment`, `favorites`, `order/[id]` (tracking), `order/confirmation/[id]`, `order/invoice/[id]` and all of `src/components/{product,checkout}`; the light theme is pixel-identical (only clock-driven slot labels and animation frames differ in a before/after diff). Choices beyond the token table: the add bar, the "Place order" label, the size circles, option radios / checkboxes, tip pills and address radios are ink fills with `onInk` content (cream + espresso in dark); the add bar's circle morphs `onInk` → `sage`; the kcal badge sits on a 70% veil of `surface` (white in light, the dark sheet in dark); the hero steam is white 78% in dark (95% in light); bean dots, the counter near its limit and the payment glyphs use `roastText`, and the UPI ring's approved arc / check and the valid-UPI-ID tick use `sageText` (graphics on the canvas, not fills under white); the "View cart" nudge pill and the payment card faces get a hairline edge in dark (the card's drop shadow is a black pool); UPI monogram plates take `tileTints` from the theme; the tracking reorder tile passes `tileTints` to `resolveTileColor`. Every `TextInput` / `TextField` in these folders passes `useTheme().keyboardAppearance`. `src/components/checkout/__tests__/darkCommerce.test.tsx` mounts every commerce screen in dark (no light-only value) and in light (R3 values).

**Recipe (convert a file).** Before:
```tsx
import { StyleSheet, View } from 'react-native';
import { colors, fonts, shadows } from '@/theme';

const TONES = { on: colors.sageDeep, off: colors.line };

export function Row({ title, price, on }: Props) {
  return (
    <View style={[styles.row, shadows.float]}>
      <Text style={styles.title}>{title}</Text>
      <Text color={colors.inkSoft}>{price}</Text>
      <View style={[styles.dot, { backgroundColor: on ? TONES.on : TONES.off }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { backgroundColor: colors.surface, borderColor: colors.line },
  title: { fontFamily: fonts.semibold, color: colors.ink },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
```
After:
```tsx
import { View } from 'react-native';
import { fonts, makeStyles, makeThemed, useTheme } from '@/theme';

const useTones = makeThemed((c) => ({ on: c.sageDeep, off: c.line }));

export function Row({ title, price, on }: Props) {
  const { colors: c, shadows } = useTheme();   // or: const c = useColors();
  const styles = useStyles();
  const tones = useTones();
  return (
    <View style={[styles.row, shadows.float]}>
      <Text style={styles.title}>{title}</Text>
      <Text color={c.inkSoft}>{price}</Text>
      <View style={[styles.dot, { backgroundColor: on ? tones.on : tones.off }]} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: { backgroundColor: c.surface, borderColor: c.line },
  title: { fontFamily: fonts.semibold, color: c.ink },
  dot: { width: 8, height: 8, borderRadius: 4 },
}));
```
1. Swap the `colors` / `heroTints` / `tileTints` / `shadows` import for `makeStyles` / `makeThemed` / `useTheme` / `useColors`. A `StyleSheet.create` with no colours can stay as it is.
2. `const styles = StyleSheet.create({…colors…})` → `const useStyles = makeStyles((c, t) => ({…}))` at module scope, and `const styles = useStyles()` at the top of **every** component in the file that uses `styles` (sub-components too), before any early `return`.
3. Inline colours → `c.*`. Module-level colour constants (tone tables, gradients, confetti palettes) → `makeThemed`. Shadows → `t.shadows.*` (style objects) / `t.boxShadows.*` (strings, incl. `pressCard` / `pressStrong`). Tints → `t.tileTints` / `t.heroTints`; `resolveTileColor(tint, tileTints)` (it defaults to the light set).
4. Colour default props (`color = colors.ink`) → `color: colorProp` + `const color = colorProp ?? c.ink` in the body (React Compiler forbids computed defaults anyway).
5. **Worklets.** Read the tokens into consts in the component body and close over them; the closure change re-creates the worklet on a scheme flip:
   `const idle = c.line; const active = c.ink; useAnimatedStyle(() => ({ backgroundColor: interpolateColor(p.get(), [0, 1], [idle, active]) }))`. Never call hooks or read the theme inside a worklet; don't park colours in shared values.
6. Drop `color: colors.ink` from text styles where it's the default: `Text`, `SplitTitle`, `Icon`, `LineIcon`, `RollingNumber`, `PriceText` default to `c.ink`.
7. Pick tokens by **role** (table below), not by the light hex. Branch on `t.isDark` only for art direction a token pair can't express, and keep that branch inside `makeThemed` / `makeStyles` (examples: the BEST SELLER sticker, the quick-add ✓, the Orders lead card, the modal scrim).
8. Add the file (or folder) to `THEMED_FILES` in `eslint.config.js`, run `npm run theme:check`, and screenshot it in both schemes (`APPEARANCE=dark` seeds the setting in the screenshot tool; `SCHEME=dark` emulates the OS).

**Which token?**
| You're drawing… | R3 (light) code | Use |
|---|---|---|
| Screen background | `colors.bg` | `c.bg` (`Screen` already does) |
| A list sheet, form, card, header circle, search bar | `colors.surface` / `colors.white` as a surface | `c.surface` |
| Body / secondary / muted text | `ink` / `inkSoft` / `inkMuted` | same names |
| An ink-filled bar, pill, chip, indicator, "+" | `colors.ink` fill + `colors.white` content | `c.ink` + `c.onInk` (inverts to cream + espresso in dark) |
| Soft text on that ink fill | `colors.inkMuted` / white 60% | `c.onInkSoft` / `withAlpha(c.onInk, 0.6)` |
| A white "+" / heart circle standing on a tile or hero | `colors.surface` + ink glyph | `c.control` + `c.onControl` |
| Frosted circle over a hero | `rgba(255,255,255,0.55)` + `tint="light"` | `c.frost` + `t.blurTint` (`CircleButton tone="frost"`) |
| A dark capsule that stays dark (toast-like) | `colors.ink` + white | `c.capsule` + `c.white` |
| Copy on the peach card, a white chip / CTA on night, the promo banner's ink pill | `colors.ink` | `c.inkFixed` |
| White text / glyphs on an accent fill or on night (ember, sageDeep, roast, espresso, danger, night) | `colors.white` | `c.white` |
| Sage text (Open, savings, Paid, discount) | `colors.sageDeep` | `c.sageText` (keep `c.sageDeep` as a FILL under white) |
| Roast text, the ★, counters, small links | `colors.roast` | `c.roastText` (keep `c.roast` as a fill) |
| Errors (text, ring, delete fill) | `colors.danger` / `dangerSoft` | same names (re-tuned) |
| A peach fill behind ink text (search highlight) | `colors.peachSoft` | `c.peachTint` |
| Night screens (onboarding, auth top, confirmation, payment reveal) | `night`, `white`, `glass`, `peach`… | the same names from `c` (fixed tokens: identical in both schemes) |
| Diet mark colour | `DIET_META[d].color` (removed) | `dietColor(d, c)` (`DIET_META[d].tone` is the key) |
| Scrim | `withAlpha(colors.ink, x)` / `colors.overlay` | `c.overlay`, or black in dark (see `ModalSheet`) |

Rule of thumb: a light `colors.white` that is a **surface** → `c.surface`; that is **content on ink** → `c.onInk`; that is **content on an accent or night** → `c.white`. A light `colors.ink` that is a **fill** → `c.ink` (with `onInk` content), one that must **stay dark** → `c.capsule` / `c.inkFixed`.

**Checks.**
- ESLint (`npx expo lint`): `no-restricted-imports` fails a themed file that imports the static palette (`THEMED_FILES` in `eslint.config.js`).
- `npm run theme:check` lists every file still on the static palette with its `colors.*` count; `-- --strict` exits 1 while anything is left (use it as the "dark mode done" gate before flipping `FOLLOW_SYSTEM_SCHEME`).
- Tests: `src/theme/__tests__/theming.test.tsx` (palettes, AA contrast, resolution, provider / `makeStyles` / scope / no-remount, the persisted setting, the iOS native sync), `src/components/domain/__tests__/darkTheme.test.tsx` (the whole shared kit mounts under `<ThemeProvider preference="dark">` and no light-only value reaches the rendered tree; copy the pattern for screen groups), `src/components/account/__tests__/appearanceRow.test.tsx`, `src/components/account/__tests__/darkScreens.test.tsx` (the browse, account and sign-in screens in dark and light, the popover, the redeem ticket, the edit-name sheet and the tracking components; its leak check also reads SVG fills, which react-native-svg renders as ARGB integers, and skips React elements held in props, whose fibers reach every context's light default). Without a provider every component renders light, so existing tests are unchanged.

**Gotchas.**
- **Convert a screen's canvas and its text together.** `Text` now defaults to the scheme's ink, so a screen that still paints a static cream background shows cream-on-cream text in dark (that is why System stays light until the rollout switch flips).
- RN `Modal` content is inside the provider (context crosses the native modal); nothing special to do.
- `FrostedLayer` takes its blur tint and fill from the scheme: don't pass `tint="light"` / `fill={colors.bg}`.
- `ContactShadow` / `ProductArt` shadows are themed (black pools in dark; numeric alphas × 1.9, max 0.6).
- Don't build styles per render (`StyleSheet.create` or `useMemo` in a component): `makeStyles` already holds both schemes. Keep factories pure (tokens in, styles out).
- Changed shared APIs: `DIET_META[d].color` → `.tone` + `dietColor(d, colors)`; `FAVORITE_COLOR` removed (the heart is `ink` on the frost circle, `onControl` on the tile circle); `resolveTileColor(tint, tints?)`; `PillButton` gained `tone="danger"` (white on `danger`; `ConfirmSheet` uses it); `motion/boxShadows` is deprecated (light only).

## Haptics (spec: `docs/HAPTICS.md`, read it before adding any feedback)
- **Only the semantic API.** `import { haptic } from '@/lib/haptics'`: `select`, `tick`, `toggle(on)`, `press`, `land`, `threshold`, `longPress`, `success`, `warning`, `error`. Never import `expo-haptics` in a screen. The old `light` / `medium` / `heavy` / `selection` names are gone. HAPTICS.md's call-site map says which kind goes where; a tap that only navigates or opens something is silent.
- **Engine.**
  - iOS: `selectionAsync`, `impactAsync(Rigid | Soft | Medium)`, `notificationAsync`.
  - Android: `performAndroidHapticsAsync(AndroidHaptics.*)`, the same tuned effects as the keyboard and system switches. A constant the device lacks throws once (`Segment_*` and `Toggle_*` need Android 14; `Confirm`, `Reject` and `Gesture_End` need Android 11), and that kind plays `impactAsync(Light)` from then on.
  - Web: a no-op.
- **Throttle.** The same kind can't repeat within 60 ms, and nothing fires within 30 ms of another haptic (`HAPTIC_SAME_KIND_GAP_MS`, `HAPTIC_ANY_KIND_GAP_MS`). It's a safety net: one action still fires one haptic.
- **The switch.** `session.hapticsEnabled` is persisted and defaults to true (v2 data saved before it existed hydrates as true). It survives sign-out and Reset demo, and the session store mirrors it into the wrapper with `configureHaptics()`. The UI is Settings → Preferences → Haptics. `ToggleRow` fires `toggle(on)` after applying the change, so turning Haptics on clicks and turning it off stays quiet.
- **Pressables.**
  - `PressableScale`'s `hapticKind` defaults to `null`. `press` fires with the press dip (touch-down plus the 55 ms scroll-safe delay, or at release for a faster tap). Every other kind fires when the tap lands.
  - `CircleButton`, `PillButton`, `PrimaryBar`, `Card`, `ListRow` and `SectionHeader` are silent by default.
  - `Chip`, `CategoryChips`, `ModeCards`, `PaymentMethods` and `SegmentedControl` click `select` only when the choice changes.
  - A component that fires its own haptic keeps `hapticKind={null}` on its pressables (steppers, size and option rows, toggles).
- **PrimaryBar.** Committing CTAs pass `hapticKind="press"` (Place order, the mode sheet's Confirm). A disabled bar fires `disabledHapticKind` (default `warning`) on tap, in the same tick as the screen's shake. Pass `disabledHapticKind={null}` when the screen picks the haptic itself (OTP: `warning` for a short code, `error` for an expired one; profile setup).
- **Where the haptics sync to the motion.**
  - Fly-to-cart: `land` in `OverlayHost`'s arrival handler, on the target's pop frame (also under Reduce Motion and when there's no flight).
  - Pay: `MorphPayButton` fires `press` on press-in, `success` on the frame its check pops in (a reaction on the ripple) and `error` with the retry morph.
  - Swipe-to-delete: `threshold` when the drag crosses `DELETE_AT`; the commit is silent. A fling that never crossed it clicks at commit instead.
  - Product detail: `warning` on the missing group's first shake frame (after the reveal scroll).
  - Menu scroll-spy: `tick` only while a finger drives the scroll; never on chip jumps or scroll-to-top, and off under Reduce Motion.
  - Order simulator (root layout): `success` only when `isOrderOutcome(status, mode)` (ready; delivered for delivery orders), on every screen.
  - Live order pill: `threshold` when a swipe crosses its hide point (a fling that never crossed it clicks at commit); its tap only navigates (silent), and it never plays `success` itself (the simulator line above owns it).
- **Worklets.** From the UI thread use `scheduleOnRN(haptic.threshold)` or `scheduleOnRN(haptic.toggle, true)`.
- **Tests.** A screen test that mocks `@/lib/haptics` must provide `haptic` (all ten kinds), `playHaptic`, `configureHaptics` and `hapticsEnabled`, because the session store calls `configureHaptics` when it's imported. `src/lib/__tests__/haptics.test.ts` covers the routing, the Android fallback, the throttle and the switch. Screen suites mount whole screens (3–8 s each while Metro runs), so the Jest `testTimeout` is 30 s.

## R4 · Tilt-to-move and the live order pill (spec: `DESIGN.md` §R3.C 11–12)
**Tilt-to-move** (`src/components/product/useTilt.ts`, math in `tiltMath.ts`, unit-tested):
```ts
useTilt(active: boolean, anchor?: RefObject<unknown>): { x: SharedValue<number>; y: SharedValue<number> }  // −1…1 each
```
- Native reads expo-sensors `DeviceMotion` at 16 ms: gravity = `accelerationIncludingGravity − acceleration` (the same convention on iOS and Android), turned into roll `asin(g.x)` and pitch `atan2(−g.z, −g.y)` (no gimbal lock when the phone is held upright). The first sample is the neutral angle; it then follows the phone (τ 2.6 s, 0.6 s after a big change of posture), so the art recentres on however the phone is held. Output is `tanh(Δ / 12°)`; each sample retargets a soft spring.
- **No permission call.** CoreMotion device motion needs none; expo-sensors' `getPermissionsAsync`/`requestPermissionsAsync` are the iOS pedometer's and abort the app without `NSMotionUsageDescription`. `isAvailableAsync()` false (no gyroscope, simulator) → the art stays centred.
- Off under Reduce Motion, while `active` is false and while the app isn't `active` (AppState); it eases back to 0 and re-takes the neutral angle on resume. Web: mouse / pen pointer parallax around `anchor` (a plain View ref = its DOM node) on fine-pointer devices only.
- `HeroImage` layers, outermost first: flight (`frameStyle`) → size scale + pulse (`seatStyle`) → **tilt shift** (±10 px, outside the measured art box, so fly-to-cart and `measureInWindow` see where the art is drawn) → idle float → `photoRef` box → **tilt turn** (perspective 700, `rotateY/rotateX` ±3°, inside the box so a 3D transform never skews the measured rect) → image. The contact shadow slides ±4 px the other way and fades 16%; the plate stays; the kcal badge travels 1.25×. The steam wisps (owned by `product/[id].tsx`) don't follow the shift yet: pass them `useTilt` values if the 10 px drift ever reads as detached on a device.
- `CategoryHero`: the same hook, translate only (±6 / ±3 px), the shadow riding along.

**Live order pill** (`src/components/order/LiveOrderPill.tsx`, mounted once by `src/app/_layout.tsx` after the Stack while signed in and after the splash; rules and copy in `liveOrder.ts`, unit- and render-tested):
- Ink 48 px capsule, centred at the bottom: `CupGlyph` (a white line cup that fills with peach to `cupLevel(order)`: 0.16 placed → 0.84 ready / on the way, with a travelling wave), `pillTitle` ("Preparing", "Ready for pickup", "On the way"), " · ~4 min" (`RollingNumber`, `useNow(15 s)`) or the scheduled slot, " · 2 orders", and a chevron. Leads with `soonestFirst(active)[0]` (ready first, then the earliest `orderDueAt`).
- Where it floats: `pillRoute(pathname)` + `livePillBottom(route, insetBottom, cartCount)`: 12 px above the tab bar on Menu / Rewards / Profile, 12 px above `FloatingCartBar` on screens that show it (Menu, Category, Search, Favourites) while the cart has items, else `max(inset, 16) + 8`. Hidden on `/`, `/orders` (they already show the orders live), every `/order/…` route (tracking, confirmation, invoice), `/product/…`, `/cart`, `/checkout`, `/mode`, `/address`, `/payment` (their bottom is the primary action), onboarding / auth, and while the keyboard is open. **A new screen with a bottom primary action must be added to `HIDDEN_EXACT`/`HIDDEN_PREFIX`; one that renders `FloatingCartBar` to `CART_BAR_*`.**
- Motion: in / out on `springs.smooth` (28 px rise + scale 0.92 → 1; a fade under Reduce Motion), re-seats with a spring when the cart bar comes or goes, presses to 1.04, and pops 1.06 with a fading peach ring when the lead order's status changes. Swipe sideways or down past 90 / 34 px (or fling) to hide it until `pillSignature` (every active order's id:status) changes; VoiceOver / TalkBack get "Track order" and "Hide" actions.
- **Room under it.** Every screen the pill floats over (Menu, Rewards, Profile, Settings, Help, Legal, Search, Category, Favourites) adds `useLivePillSpace()` (`src/components/order/livePillSpace.ts`: `LIVE_PILL_HEIGHT + 12` while `pillRoute(pathname).show` and an active order exist, else 0) to its scroll content's bottom padding, so the last row scrolls clear of it. A new screen the pill can float over should do the same.
- **Overlays.** `ModalSheet` calls `useHideLivePill(visible)`, so the pill steps away while the redeem ticket, Edit name or a confirm dialog is open (on web an RN `Modal` is a portal in the same document and the pill was painted over its dim). Any other full-screen overlay should do the same.
- **Clipping.** The pill renders inside a full-screen `overflow: hidden` host (`pointerEvents: 'box-none'`): parked below the screen edge (hidden, or with its resting peach ring scaled 1.4×) it used to make the web document 11 px taller than the window, so focusing a field (the product note) scrolled the whole page.

## Native notes (iOS / Android in Expo Go) — read before touching layout, shadows, inputs or the status bar
Earlier rounds were tested on web only. These rules come from a native audit against the installed sources (RN 0.86, react-native-screens 4.26, Reanimated 4.5). `expo export` builds both native bundles, but none of this has run on a phone yet.
- **Shadows are `boxShadow`.** `theme.shadows` (and `boxShadows` in the motion kit) are `boxShadow` strings. Never reintroduce `shadow*` + `elevation`: Android sorts siblings by elevation, so an elevated photo plate was painted over the stickers, rating chip and quick-add "+" that come after it in JSX; elevation (and iOS pixel shadows) also show through translucent fills. `boxShadow` needs Android 9+ (no shadow below that).
- **No web-only style values on native.** `outlineStyle: 'none'` is not a native value (Fabric logs a parse error per input): use `WEB_NO_FOCUS_RING` from `@/components/ui`. Scroll-snap, `cursor` etc. stay behind `Platform.OS === 'web'`.
- **Keyboard.** SDK 57 is edge-to-edge, so Android no longer resizes the window for the keyboard and iOS-only `automaticallyAdjustKeyboardInsets` does nothing there.
  - Wrap a form ScrollView in `<KeyboardAvoider>` (`@/components/ui`): a `padding` KeyboardAvoidingView on Android, a plain View elsewhere. Keep its parent at the top of the window. Used by cart, checkout, address and search; the auth screens already use their own KeyboardAvoidingView.
  - Android `keyboardDidShow` heights leave out the navigation bar; `useKeyboardHeight()` (product) adds the bottom inset back.
  - An RN `Modal` is a separate Android window whose keyboard RN never reports: `<ModalSheet withInput>` docks a bottom sheet with a text field under the status bar on Android (Edit name).
  - `useKeyboardAfterTransition(ref)`: Android `autoFocus` fires at the start of a native-stack transition and the keyboard can fail to open; after the transition it re-focuses if the keyboard is still down (search, OTP).
- **Status bar.** `<LightStatusBar />` (`@/components/ui`) on dark screens (onboarding, sign-in, confirmation, the payment reveal): focus-aware and declarative. Don't call `setStatusBarStyle()` (Android re-applies the merged `<StatusBar>` stack on any update) and don't mount an unconditional `<StatusBar style="light">` in a screen (a cream screen pushed over it inherited white icons). `ModalSheet` turns the icons light while open (iOS).
- **Android navigation details.** Hardware back closes the Home notifications popover (it isn't a Modal). The confirmation uses `animation: 'none'` on Android, because Android's native `fade` also fades the outgoing screen and the cream root flashed between payment's espresso reveal and the espresso confirmation.
- **Native form sheet (`mode`).** It's an Android BottomSheetBehavior: inner ScrollViews need `nestedScrollEnabled`. iOS 26 needs `contentStyle.backgroundColor` (already set). No RNGH gestures live in it; add a `GestureHandlerRootView` inside if one ever does.
- **Font scaling.** The themed `Text` (and `TextField`, `SearchField`, the coupon field) cap system font scaling at `MAX_FONT_SCALE` (1.2): fixed-height pills, bars, chips and odometer cells clipped at larger settings, which web never shows.
- **Maps.** `openInMaps()` (`@/lib/maps`) opens Apple Maps on iOS and a `geo:` intent on Android, with the Google Maps web page as the fallback.
- **expo-notifications** is still only ever `import()`ed behind `canUseNotifications`. In the Android export bundle the package is referenced by that lazy import alone, so Android Expo Go never evaluates it.

### Device checklist (not yet run on hardware)
Run on a real iPhone (Expo Go, signed in to the same Expo account as the dev machine) and a mid-range Android phone (try gesture and 3-button navigation).
- **iPhone:** white status-bar icons on splash, onboarding and sign-in, dark icons on Terms opened from sign-in; the Order type sheet resizes smoothly between Pickup, In-Car and Delivery and keeps the plate field above the keyboard; the Edit name sheet and the product instructions field clear the keyboard; the product photo flight starts exactly over the card photo; no flash from payment to confirmation; haptics are crisp and sparse (no buzz on navigation taps, `success` only when an order is ready, the Settings → Haptics switch silences them); a "ready" banner appears with the app open (Fast order statuses on); View on Maps opens Apple Maps; layouts hold at the largest Text Size.
- **Android:** card badges and "+" sit above the photo and shadows are soft (Android 9+); cart promo, checkout fields, the address form and the end of search results stay above the keyboard; the Edit name card sits near the top with the keyboard open; Search and OTP open the keyboard by themselves; the Order type sheet scrolls inside, drags down to dismiss and rises with the keyboard; hardware back steps through onboarding, closes the Home notifications popover and the Order type sheet, and is blocked while paying; Notifications shows the "This preview can’t show system alerts" note with no red screen; haptics feel like the system keyboard (crisp ticks on chips, steppers and OTP digits, a toggle click on switches; on Android 11–13 the tick kinds fall back to a light vibration); onboarding drawing, the confirmation burst, Home scroll, Menu sticky chips, cart swipe and the Orders pager stay smooth (if the line drawings stutter, pass `draw={Platform.OS !== 'android'}` to the background line art).
- **Tilt and live pill (both):** on product detail, tipping the phone a little moves the cut-out smoothly (no jitter, no lag over ~0.2 s), it settles back to centre within a few seconds of holding still at any angle (also lying flat), it stops while another screen covers it and after backgrounding, and nothing moves with Reduce Motion on; Add to cart still flies from exactly where the cut-out is drawn; no motion-permission prompt appears. The live pill sits clear of the tab bar and the View cart bar with the home indicator below it, disappears with the keyboard, its cup wave is smooth, a swipe hides it (one `threshold` click) and a status change brings it back with a pop.
- **Dark mode (both):** Settings → Appearance → Dark repaints the app in place (no reload; the scroll position stays), the status-bar icons turn light on the dark canvas and stay light on night screens, the tab bar is a dark frosted pill with a cream active tab, and Light / System bring it back. iOS: the keyboard and alerts turn dark with the app, and System follows the phone's setting (Control Centre → Dark Mode re-themes the open app). Android: no flash or activity restart on the switch or when the phone's dark theme changes; the 3-button navigation band is legible.
- **Tilt feel (both, judge by hand):** the drift should read as "lifted off the plate", not as a wobble. Check that a 5–10° tip gives a visible but small move (±10 px, ±3° turn), with no jitter while you hold the phone still in your hand. Check that walking or a bumpy ride doesn't make it busy, and that the steam wisps don't look detached from the cup when the cut-out has moved its full 10 px (they don't follow the tilt yet). The category hero's drift should be quieter than product detail's. If it feels too strong, too twitchy or too slow to recentre, tune `TILT.range`, `smoothMs` and `recentreMs` in `tiltMath.ts`.
- **Haptics (iPhone and Android side by side):** go down the [HAPTICS.md](HAPTICS.md) call-site map, one row at a time. Size, temperature and milk choices click `select` once per change, and re-tapping the chosen option is silent. The quantity stepper and the OTP digits `tick`. Switches click (turning Haptics off stays silent). Fly-to-cart lands on the badge pop, not at the tap. The cart swipe clicks once at the delete threshold. Paying gives `press` at touch-down and `success` on the check, or `error` on a decline. A wrong OTP gives `error`. Changing tab clicks `select`, but re-tapping the active tab, back buttons, cards, links and opening sheets are silent. One action never buzzes twice. Settings → Haptics off silences everything. Android 14+ should feel like the system keyboard and switches. On Android 11–13 the tick and toggle kinds fall back to a light impact.
- **Dark mode on the device (both):** set the phone itself to dark, then cold-start the app. It opens dark with no light flash after the splash, and the splash, onboarding and night screens look the same as in light. Switch the phone between light and dark while the app is open: System follows, Light / Dark override it, and the choice survives a reload and Reset demo. Check readability outdoors at full brightness: the cream primary bar, the peach total card and the veg marks (the green and amber squares on espresso). Toasts, the live pill, the reward ticket, the Edit name sheet, the Order type sheet and the GST invoice sheet are all dark. iOS: the keyboard turns dark in the checkout, address and search fields.
- **UPI and payments (both):** checkout opens on Google Pay for a new account. **Change** lists the UPI apps first (as text with a monogram, no logos), then the cards, then cash / pay at the counter. **Pay with UPI ID** opens the email-style keyboard without capitalising or autocorrecting `ava@okicici`. With `ava` alone, **Place order** shakes and scrolls the field into view above the keyboard. The field shows "Add your bank handle after @…" and the bar says "Enter a valid UPI ID to continue". On the payment screen, "Opening Google Pay…" gives way to the 5:00 approval ring, which runs smoothly (no stutter at 60 / 120 Hz) and stays readable with the café's UPI ID `emberroast@icici`. It turns sage, the pay button morphs into the check, and the confirmation follows with no flash. **Cancel** says "Payment cancelled", and **Simulate a failed payment** shakes into **Retry**. Back is blocked while paying (Android hardware back too). The delivery tip's **Other** field opens a number pad and stays above the keyboard. The receipt (Order details) and **View GST invoice** add up to the paid total, and the invoice's share button opens the system share sheet with the text invoice. "₹" renders at the same weight as the digits everywhere, including the rolling totals.
- **Expo Go limits:** the custom launch splash only appears in a development build, and order statuses only advance while the app is open.
