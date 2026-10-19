# Ember Roast: design references and verified photos

Research date: 2026-10-06 (photo checks finished 18:35 UTC). Companion to `DESIGN.md`. Nothing here overrides `DESIGN.md`. Where a reference conflicts with it (for example a blue or orange accent, or more than one ember element on a screen), `DESIGN.md` wins.

**Method**
- **Design refs.** Shots found through Dribbble and Behance search. Dribbble renders shot pages on the client (curl gets a `202` bot challenge, Behance a `403`), so the details below were read from the shot images and videos. All 17 shot links were re-opened in a real browser on 2026-10-07, and every title and author matches.
- **Photos.** Candidates came from `unsplash.com/s/photos/<subject>?license=free`. Only `images.unsplash.com/photo-*` IDs are used, which are covered by the Unsplash License: free for commercial use, attribution not required. `plus.unsplash.com/premium_photo-*` (Unsplash+, paid) is excluded. Each URL got two checks:
  1. `curl -s -o /dev/null -w "%{http_code} %{content_type}"` must return `200 image/*`. As a control, a bad ID returns `404 text/html`, so the check is meaningful.
  2. A visual check of a circle-cropped contact sheet, to confirm the subject is right and centred.
- **Code.** Snippets were checked against the installed packages: `react-native-reanimated@4.5.1`, `react-native-worklets@0.10.1`, `react-native-svg@15.15.4`, `expo-image@57.0.5`, and the `@/theme` / `@/lib/haptics` / `@/components/ui` exports in this repo. Every snippet (A to F and the `PHOTOS` block) also passes `tsc --noEmit` (TypeScript 6.0.3) under the project's strict `tsconfig.json`. This was re-run in review on 2026-10-07 against the final text of this file, with a negative control to confirm errors are caught. React Compiler is on, so shared values use `.get()` / `.set()` and never `.value`. This is what the Reanimated docs ask for under the compiler.

---

## PART A: Design reference research

### A1. References (10 primary)

Each entry lists 2 to 4 details worth borrowing, mapped to `DESIGN.md` sections.

**1. Afterhours: Late Night Coffee App** (Reza Moradi). https://dribbble.com/shots/27761345-Afterhours-Late-Night-Coffee-App
- **Home → "Order again" row.** Small horizontal cards (icon, drink, price, round `+`) sit above the menu chips. This is the strongest "reorder your usual" pattern found. It maps to §5 Home, between the greeting and the mode cards.
- **Detail: origin breadcrumb.** A caption line, "Pour over · Washed · Light roast", sits above the serif title. Below it are tasting-note chips ("Jasmine", "White peach", "Bergamot") and a **taste profile**: 3 rows (Acidity / Sweetness / Body), each a 5-segment bar.
- **Size control.** A 3-step segmented control with the oz on top and ml underneath ("12 oz / 355 ml"). Keep our circles and borrow the two-line caption.
- **Tracking.** The screen has these parts:
  - a big circular countdown ring with "3:38" and the stage name "Brewing"
  - a barista line, "Nora is on your pour"
  - a 4-dot stepper: Ordered → Grinding → Brewing → Ready
  - a pickup code card ("A27 · Bar pickup · Show QR")
  - a single upsell row ("Add a cardamom bun? +$4.40")

  All of it maps to §5 Status timeline and to Order tracking.

**2. DIAL: Coffee Subscription App UI** (Vikky for Lu-lu-loom). https://dribbble.com/shots/27577238-DIAL-Coffee-Subscription-App-UI
- **"Tune your taste".** A radar chart sits over six sliders (Acidity, Body, Sweet, Bitter, Fruit, Aroma). After you pick, a "94% match" badge appears on the product image.
- **Bean facts.** Three icon tiles: Roast "Med-light", Process "Washed", Altitude "2050 m". Coloured dots mark the flavour notes (Blueberry, Cocoa, Jasmine).
- **Copy.** "Your ritual, your way", with frequency cards (Every 2 weeks / Monthly). Reuse the line for a "Save as my usual" row.

**3. Brew Bliss: a coffee app concept** (Lay). https://dribbble.com/shots/26820829-Brew-Bliss-a-coffee-app-concept (motion shot)
- **Splash.** A monoline cup and portafilter draw themselves while a percentage counts from 1% to 98%. This is our §7 splash with a counter added.
- **Accent word.** A single handwritten word sits inside a sans headline ("…your escape into *Brew Bliss*"). That's our Fraunces Italic accent, used once.
- **Line-art drink cards.** Each card has a rotated price sticker and a "place order >" footer. The category list shows item counts ("coffee (12)").

**4. beCo: CoffeeShop Mobile App** (Toukir Rahman). https://dribbble.com/shots/25181293-beCo-CoffeeShop-Mobile-App
- **Split-weight onboarding headline.** Bold "Expresso" over a thin "Yourself" on a dark photo. This confirms §3 `display` / `splitTitle`.
- **Checkout bar.** "Total 3 items / $334.50" on the left and a pill with a round arrow button on the right. It has the same anatomy as our §5 Primary action bar. Put the item count above the price.
- **Mode tiles on detail.** "14 km · Available for pickup & delivery", each with a round arrow. Show the distance on our mode and store cards.

**5. Brewly: Coffee Shop & Delivery App UI Design** (Ataullah Akram). https://dribbble.com/shots/27743449-Brewly-Coffee-Shop-Delivery-App-UI-Design
- **"Daily Purchases" streak.** Day-1 to Day-5 cup stamps with checks, a 6th slot reading "Free", and "Ends on 12 Apr". It's a compact loyalty row for Home.
- **Size rail.** A vertical S / M / L / XL rail floats on the hero image's edge. We keep circles in the sheet, but this confirms that size can drive the hero image.
- **Sugar chips.** "Normal / Less / No". Short labels like these fit a "Choose one" row.

**6. Coffee Shop Mobile App: Scooter's** (Tanvir Shough). https://dribbble.com/shots/26434980-Coffee-Shop-Mobile-App-Scooter-s
- **Header.** "Find a Location" next to an avatar, then "Hello, Elena" with a brown "120 Points" pill. It's the same as our Home Row 2.
- **Promo copy with a time window.** "Buy one, Get one for Free", a small "8:30am to 5:00pm" line and an "Order Now" button. A promo that names its hours feels honest.
- **Onboarding.** A white sheet sits over a full-bleed photo with dash progress and a square arrow button. We use the dark version, but the sheet-over-photo split matches our phone/OTP screens.

**7. Mobile app, loyalty program: Coffee shop (cafe')** (Anton Slinko). https://dribbble.com/shots/26403384-Mobile-app-loyalty-program-Coffee-shop-cafe
- **Single-colour line art on cream.** A rust-coloured line drawing of a woman sipping, with sparkles. It's very close to §6, our empty and success illustrations.
- **Redeem screen.** The balance sits at the top ("146 points"). Below it is a big QR code with a short fallback code ("1758") and the line "scan the QR code or dictate the code".
- **Success copy.** "DONE!" over "You've been successfully redeemed. You saved $15." Name the saving.

**8. Coffee Shop Mobile App UI: Dark Theme** (Koushik Sarkar). https://dribbble.com/shots/27161482-Coffee-Shop-Mobile-App-UI-Dark-Theme
- **Size as growing cup icons.** Small, Medium and Large cups are drawn at increasing sizes, and the selected one sits on an accent tile. It's the clearest cup-size visual feedback found.
- **Ingredient orbit.** The detail screen has a circular top-down cup photo with small labelled ingredient circles (Milk, Coffee, Espresso) around it.
- **Cart summary.** A panel with a concave top curve lists Subtotal, Shipping, Taxes and Total above a "Proceed checkout" bar. This confirms our §4 notched sheet and the peach summary.

**9. Mobile Loyalty App Design: Stampy** (Phenomenon Studio). https://dribbble.com/shots/26814462-Mobile-Loyalty-App-Design-Stampy (motion)
- **Stamp grid.** A 10-slot cup stamp grid where filled stamps pop in.
- **"Select your treat".** You drag a reward into a ring to redeem it, so the confirmation is a gesture rather than a button. Use RNGH `Gesture.Pan`; it's optional polish.
- **Ticket coupon.** Perforated edges, a barcode, "Congratulation!" and "Show this screen to the staff to claim your free treat".

**10. MaZaj Coffee App: A Personalized Coffee Experience** (shahd zeiada / ANORIX, Behance). https://www.behance.net/gallery/253849315/MaZaj-Coffee-App-A-Personalized-Coffee-Experience
- **Survey in the case study.** 90% of respondents prefer to customise drinks, 60% say discounts affect their decision, and 67% order through apps. This supports investing in the customisation sheet and the promo banner.
- **Size selector.** Cup icons grow from S to L, with "250 ml"-style captions under each. Milk type appears as pill chips.
- **Positioning.** Signature cup customisation plus detailed bean info. It matches our "specialty café menu, not a marketplace" goal (§1).

**Also worth a glance** (one idea each):
- **Nodus Labs, "Product & Details UI"** (https://dribbble.com/shots/27143763-Coffee-Shop-Mobile-App-Product-Details-UI). A card meta row, "5-7 min · 120 kcal", plus a "Customize your drink" heading above the option rows.
- **Nur Alam, "Light & Dark Mode"** (https://dribbble.com/shots/26568125-Coffee-Shop-Mobile-App-Light-Dark-Mode). The headline "Start Your Day with the *Right* Coffee", with one italic word. Secondary options sit in a 2×2 grid (Size / Milk / Sweetness / Temperature).
- **Digital Product Lab, "Coffee shop loyalty app"** (https://dribbble.com/shots/26101598-Coffee-shop-loyalty-app). Onboarding copy "Free Coffee, Every Time You Earn It". The store finder is a map with pins and a card list.
- **Dani Akbar, "Minimal Coffee: UI Glass Card"** (https://dribbble.com/shots/26198625-Minimal-Coffee-UI-Glass-Card). The cut-out drink breaks out of the card's top-right corner. Use it later, once the cut-out PNGs exist (§10).
- **Bogdan Falin, "Dezzerts" prototype** (https://dribbble.com/shots/19326622-Dezzerts-Cookies-and-Coffee-App-Prototype). Circular product cut-outs travel along an arc, and the focused one scales up.
- **Halo Lab, "Lazy Daisy"** (https://dribbble.com/shots/10760240-Lazy-Daisy-Coffeeshop-App). A member strip (avatar, "15 points", QR button) and a "Bring a friend · Bonus cup of coffee today!" card with a date chip.
- **Real-world pattern.** The Philz order-ahead app opens on a carousel that leads with your most recent order (PYMNTS, https://www.pymnts.com/mobile-applications/2018/philz-coffee-mobile-order-app/).

### A2. Distilled additions (14)

All of these fit `DESIGN.md`. Ink stays the one primary action, ember is used at most once per screen, peach and sage keep their roles, and motion uses transform and opacity with springs.

| # | Addition | Where | From | Rule-fit notes |
|---|---|---|---|---|
| 1 | **"Your usual" card.** 56px round thumbnail, caption "Your usual", name plus modifiers ("Oat flat white · M · +1 shot"), and an **outlined** pill "Reorder · $5.40". | Home, under greeting | Afterhours, Philz | Outlined pill, because the promo already owns the ink "Order now". Hidden when there's no history. |
| 2 | **Steam wisps.** 3 strokes rise about 18px and fade, staggered 600ms. Hot drinks only. | Detail hero (above the cup), tracking "Preparing" | DESIGN §7 tracking, Brew Bliss | White and peach strokes. Static when Reduce Motion is on. Snippet A. |
| 3 | **Cup-size glyph and volume caption.** A cup icon inside each size circle, scaled 0.8 / 1 / 1.2, with a caption under each: "8 oz · 240 ml", "12 oz · 355 ml", "16 oz · 475 ml". | Detail, size circles | Dark Theme, MaZaj, Afterhours | Adds to the sliding ink fill and hero scale already in §7. Snippet B. |
| 4 | **Roast meter and taste bars.** Roast as 5 bean dots; Acidity, Body and Sweetness as 5-segment bars (ink filled, `line` empty). | Detail, coffee only, under the description | Afterhours, DIAL | No new colours. Snippet C. |
| 5 | **Tasting-note chips and origin line.** A caption ("Ethiopia Guji · Washed · Light roast") plus outlined note pills. | Detail, under the split title | Afterhours, DIAL | Reuses the dietary-tag pill style. |
| 6 | **Pickup time-slot chips.** "ASAP · ~6 min", then 15-minute slots for the next 90 minutes. Full slots are disabled with the label "Full". | Checkout (mode = Pickup / In-Car) | Generic pattern; Afterhours pickup card | Selected chip gets an ink border, as on the Menu chips. Snippet D. |
| 7 | **Live order ring.** Ring progress plus an mm:ss countdown and the stage label, a barista line ("Maya is on your order"), and a big pickup code ("A27") with "Show code". | Order tracking | Afterhours | Ink ring on a `line` track; spring-driven. Snippet E. |
| 8 | **One upsell row.** "Pairs well: Butter croissant +$3.75" with a white `+` circle. Never more than one. | Cart or checkout, above the summary | Afterhours | Not ember; keeps the ember budget free. |
| 9 | **Stamp card.** 10 cup slots; filled ones use `roast`, and the newest stamp pops (snappy spring, light haptic). Copy: "3 more to a free drink". | Rewards hero; compact version on Home | Brewly, Stampy | Snippet F. |
| 10 | **Redeem ticket.** A perforated-edge white ticket with QR and a short code ("ER-7Q4K"), "Show this to your barista", then a line-art success screen: "Enjoy! You saved $5.50". | Rewards → redeem | Anton Slinko, Stampy | Line art in `roast` on cream (§6). |
| 11 | **Store status chip.** A sage dot with "Open · until 9pm", "Closes in 25 min" or "Closed · opens 7am". | Home header Row 1, Store card | Afterhours ("Open till 2am") | `inkSoft` text; no ember. |
| 12 | **Card meta caption.** "4-6 min · 120 kcal" under the product name. | Product cards | Nodus Labs | Replaces extra badges; the kcal badge stays on the detail screen. |
| 13 | **Sweetness, ice and temperature as "Choose one" rows.** None / Less / Regular; Light / Regular / Extra ice; Warm / Regular / Extra hot. | Detail options list | Brewly, Nur Alam | Reuses the existing radio rows (§5). |
| 14 | **"Save as my usual" checkbox row.** Feeds addition 1. | Detail, above special instructions | DIAL ("Your ritual, your way") | Optional group, rounded checkbox. |

#### Snippet A: `SteamWisps` (Reanimated 4.5.1 + react-native-svg 15.15.4)
Ambient loops use `withRepeat(withTiming(...))` with a sine ease, like the §7 idle drift and pulse. Only `transform` and `opacity` animate. On web, Reanimated drives this through react-native-web styles. `useReducedMotion()` (4.5.1) returns the setting **as it was when the app started** and does not re-render when it changes. That's fine here. Every `withTiming` / `withSpring` / `withRepeat` also defaults to `ReduceMotion.System`, so one-shot animations jump to their end value automatically when the OS setting is on.
```tsx
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, interpolate, useAnimatedStyle, useReducedMotion,
  useSharedValue, withDelay, withRepeat, withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/theme';

const WISP_D = 'M6 46 C 0 36, 12 30, 6 20 S 2 6, 6 0';

function Wisp({ delay, color }: { delay: number; color: string }) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    t.set(withDelay(delay, withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, false)));
    return () => cancelAnimation(t);
  }, [delay, reduceMotion, t]);

  const style = useAnimatedStyle(() => {
    const p = t.get();
    return {
      opacity: reduceMotion ? 0.35 : interpolate(p, [0, 0.25, 1], [0, 0.85, 0]),
      transform: [{ translateY: -18 * p }, { scaleY: 0.9 + 0.25 * p }],
    };
  });

  return (
    <Animated.View style={style}>
      <Svg width={12} height={46} viewBox="0 0 12 46">
        <Path d={WISP_D} stroke={color} strokeWidth={2} strokeLinecap="round" fill="none" />
      </Svg>
    </Animated.View>
  );
}

export function SteamWisps({ color = colors.white }: { color?: string }) {
  return (
    <View style={styles.row}>
      <Wisp delay={0} color={color} />
      <Wisp delay={600} color={colors.peach} />
      <Wisp delay={1200} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  // style.pointerEvents, not the prop: react-native-web warns about the prop.
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, pointerEvents: 'none' },
});
```

#### Snippet B: cup glyph inside the size circles
`Icon` is the repo's Ionicons wrapper, and `cafe-outline` exists in the installed glyph map.
```tsx
import { View } from 'react-native';
import { Icon, Text } from '@/components/ui';
import { colors } from '@/theme';

export const SIZES = [
  { id: 'S', oz: 8, ml: 240, glyph: 0.8 },
  { id: 'M', oz: 12, ml: 355, glyph: 1 },
  { id: 'L', oz: 16, ml: 475, glyph: 1.2 },
] as const;

export function SizeCircleContent({ size, selected }: { size: (typeof SIZES)[number]; selected: boolean }) {
  const fg = selected ? colors.white : colors.ink;
  return (
    <View style={{ alignItems: 'center' }}>
      <Icon name="cafe-outline" size={Math.round(18 * size.glyph)} color={fg} />
      <Text variant="label" color={fg}>{size.id}</Text>
    </View>
  );
}
// Caption under each circle: `${size.oz} oz · ${size.ml} ml`, plus the price delta (§5).
```

#### Snippet C: roast meter and taste bars (static views, no animation)
```tsx
import { View } from 'react-native';
import { Text } from '@/components/ui';
import { colors } from '@/theme';

export function SegmentBar({ label, value, max = 5 }: { label: string; value: number; max?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Text variant="caption" color={colors.inkSoft} style={{ width: 76 }}>{label}</Text>
      <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
        {Array.from({ length: max }, (_, i) => (
          <View key={i} style={{ flex: 1, height: 6, borderRadius: 3,
            backgroundColor: i < value ? colors.ink : colors.line }} />
        ))}
      </View>
    </View>
  );
}
// <SegmentBar label="Roast" value={2} />  // 1 = light ... 5 = dark
// <SegmentBar label="Acidity" value={4} /> <SegmentBar label="Body" value={2} /> <SegmentBar label="Sweetness" value={3} />
```

#### Snippet D: pickup slots (pure TypeScript)
```ts
export type PickupSlot = { id: string; label: string; sub?: string; at: Date | null; full: boolean };

/** "ASAP" first, then six 15-minute slots starting after prep time plus a 5-minute buffer. */
export function pickupSlots(now = new Date(), prepMin = 6, fullIds: readonly string[] = []): PickupSlot[] {
  const slots: PickupSlot[] = [{ id: 'asap', label: 'ASAP', sub: `~${prepMin} min`, at: null, full: false }];
  const start = new Date(now.getTime() + (prepMin + 5) * 60_000);
  start.setSeconds(0, 0);
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15); // 60 rolls over to the next hour
  for (let i = 0; i < 6; i++) {
    const at = new Date(start.getTime() + i * 15 * 60_000);
    const id = at.toISOString();
    slots.push({ id, label: at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), at, full: fullIds.includes(id) });
  }
  return slots;
}
```

#### Snippet E: `OrderRing` (`useAnimatedProps` on an SVG `Circle`)
The web code path was checked in the installed source. Reanimated's web updater (`react-native-reanimated/src/ReanimatedModule/js-reanimated/index.ts`, `_updatePropsJS`) calls `setNativeProps({ style: {...} })` on any component that has `setNativeProps`. react-native-svg's `WebShape.setNativeProps` (`react-native-svg/src/web/WebShape.ts`) merges that `style` object into props and writes each key as a DOM attribute (`strokeDashoffset` → `stroke-dashoffset`). The `rotate(-90 cx cy)` transform string parses on native (`lib/extract/transform.peg`) and passes straight through on web. Springs follow §7 (`springs.smooth`, damping ratio about 0.82, so it overshoots). That's why the value is clamped.
```tsx
import { useEffect } from 'react';
import Animated, { useAnimatedProps, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { colors, springs } from '@/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const SIZE = 132;
const STROKE = 8;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

export function OrderRing({ progress }: { progress: number /* 0..1 */ }) {
  const p = useSharedValue(0);
  useEffect(() => { p.set(withSpring(progress, springs.smooth)); }, [progress, p]);
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: C * (1 - Math.min(1, Math.max(0, p.get()))),
  }));
  return (
    <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={colors.line} strokeWidth={STROKE} fill="none" />
      <AnimatedCircle
        cx={SIZE / 2} cy={SIZE / 2} r={R}
        stroke={colors.ink} strokeWidth={STROKE} strokeLinecap="round" fill="none"
        strokeDasharray={[C, C]}
        transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        animatedProps={animatedProps}
      />
    </Svg>
  );
}
// Overlay the "3:38" countdown and "Brewing" label with absolutely positioned Text.
// The 1 Hz clock text is a data update, not animation, so it's fine on the JS thread.
```

#### Snippet F: stamp pop
Every slot rests at scale 1. Only a stamp that flips to `justEarned` snaps to 0.6 and springs through 1.2 back to 1. (An earlier draft started unfilled slots at 0.6, which left a slot stuck small if it became `filled` without `justEarned`.)
```tsx
import { useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Icon } from '@/components/ui';
import { colors, springs } from '@/theme';
import { haptic } from '@/lib/haptics';

export function Stamp({ filled, justEarned }: { filled: boolean; justEarned: boolean }) {
  const s = useSharedValue(1);
  useEffect(() => {
    if (!justEarned) return;
    s.set(withSequence(
      withTiming(0.6, { duration: 0 }),
      withSpring(1.2, springs.snappy),
      withSpring(1, springs.snappy),
    ));
    haptic.light();
  }, [justEarned, s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.get() }] }));
  return (
    <Animated.View style={[{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
      backgroundColor: filled ? colors.roast : colors.surfaceAlt }, style]}>
      <Icon name="cafe" size={14} color={filled ? colors.white : colors.inkMuted} />
    </Animated.View>
  );
}
```

### A3. Menu micro-copy (specialty café)

Prices are USD. Default kcal values are for size M with whole milk.

| Item | Line under the name (max ~70 chars) | Price | kcal | Badge idea |
|---|---|---|---|---|
| Espresso | Double ristretto of our house blend. Cocoa, orange peel, syrupy. | $3.25 | 5 | |
| Americano | Two shots over hot water. Clean, cocoa-forward, long finish. | $3.50 | 10 | |
| Cappuccino | Equal parts espresso, steamed milk and dense foam. | $4.50 | 130 | |
| Caffè Latte | Double shot, silky microfoam, a little latte art. | $4.75 | 190 | BEST SELLER |
| Flat White | Ristretto shots, thin velvet milk. Stronger and smaller than a latte. | $4.50 | 120 | One size · 8 oz |
| Caramel Macchiato | Vanilla milk marked with espresso and our house caramel. | $5.40 | 250 | |
| Mocha | Espresso, 70% dark chocolate ganache, steamed milk. | $5.25 | 290 | |
| Cold Brew | Steeped 18 hours in small batches. Smooth, low acid, cacao nib. | $4.95 | 5 | |
| Iced Latte | Double shot over ice with cold milk of your choice. | $5.00 | 140 | |
| Spanish Latte | Espresso and sweetened condensed milk. Rich, creamy, best iced. | $5.50 | 260 | |
| Matcha Latte | Ceremonial-grade Uji matcha, whisked to order. | $5.25 | 160 | |
| Chai Latte | House-brewed masala chai: cardamom, clove, ginger, black pepper. | $4.95 | 180 | |
| Iced Peach Tea | Black tea shaken with white-peach purée and lemon. | $4.25 | 90 | Low cal |
| Butter Croissant | Laminated over three days with cultured butter. Baked at 6am. | $3.75 | 270 | |
| Avocado Toast | Sourdough, smashed avocado, lemon, chilli flakes, soft herbs. | $9.50 | 380 | + Jammy egg $1.50 |
| Egg & Cheese Bagel | Soft-scrambled eggs, aged cheddar, chives, toasted sesame bagel. | $7.95 | 460 | |
| Chocolate Chip Cookie | Brown butter, crisp edges, gooey middle, flaky sea salt. | $2.95 | 310 | |
| Banana Bread | Very ripe bananas, toasted walnuts. Ask us to warm it. | $3.95 | 330 | |
| Granola Parfait | Greek yogurt, honey-oat granola, seasonal berries. | $6.50 | 290 | Low cal |
| NY Cheesecake | Creamy New York-style on a graham crust, berry compote. | $6.25 | 420 | |
| Fudge Brownie | Dense, dark and a little underbaked. On purpose. | $3.75 | 360 | |
| Tiramisu | Espresso-soaked savoiardi, mascarpone cream, cocoa. Made daily. | $6.75 | 380 | |

**Bean lines** (for the origin breadcrumb and tasting chips):
- *Ember House Blend*: Brazil & Colombia · Medium-dark · Milk chocolate, toasted hazelnut, orange.
- *Ethiopia Guji*: Washed · Light · Jasmine, white peach, bergamot.
- *Decaf Colombia*: Sugarcane process · Medium · Caramel, red apple.

**Option groups** (titles and tags follow §5):

| Group | Tag | Options |
|---|---|---|
| Size | *Choose one | Small · 8 oz; Regular · 12 oz +$0.50; Large · 16 oz +$0.90 |
| Milk | *Choose one | Whole; Skim; Oat +$0.60; Almond +$0.60; Coconut +$0.60 |
| Espresso | Optional | Extra shot +$0.90; Decaf; Ristretto |
| Sweetness | *Choose one | None; Less; Regular |
| Syrup | Optional | Vanilla +$0.60; Caramel +$0.60; Hazelnut +$0.60; Brown sugar +$0.60 |
| Ice (cold drinks) | *Choose one | Light; Regular; Extra |
| Temperature (hot drinks) | *Choose one | Warm; Regular; Extra hot |

**UI strings**

Ordering:
- **Disabled-bar hint:** "Choose a milk to continue"
- **Special instructions placeholder:** "Anything else? e.g. room for milk, no lid"
- **Save-as-usual row:** "Save as my usual · Reorder it in one tap from Home"

Home:
- **Greeting:** "Good morning," / "Good afternoon," / "Good evening," followed by the first name
- **Your usual:** "Your usual" / "Oat flat white · M · +1 shot" / "Reorder · $5.40"

Cart, search and checkout:
- **Empty cart:** "Your cart is empty. Let's fix that." with the button "Browse the menu"
- **No search results:** "Nothing matches 'xyz'. Try 'oat' or 'iced'."
- **Pickup slots:** "When should it be ready?" with options "ASAP · ~6 min", "10:15 AM", "10:30 AM" and "Full"

Promos:
- "First order? 20% off with code **FIRST20**"
- "2-5pm: $1 off any iced drink"
- "Fresh out of the oven: croissants until they're gone"

Store status:
- "Open · until 9pm"
- "Closes in 25 min"
- "Closed · opens 7am"

Order tracking, pickup:
- **Stages:** "Order received" → "Pulling your shots" → "Ready at the bar" → "Picked up"
- **Barista line:** "Maya is on your order"

Order tracking, delivery:
- **Stages:** "Order received" → "Brewing" → "On the way" → "Delivered"

Rewards:
- "Stamp earned. 3 more to a free drink."
- "120 pts to your next reward"
- "Show this to your barista"
- "Enjoy! You saved $5.50."

Push notifications:
- "Your oat flat white is ready at the pickup bar."
- "Out of beans? Your usual is one tap away."

Errors:
- "Card declined. Try another card or pay at pickup."
- "That code didn't match. Check the SMS and try again."

---

## PART B: Verified photo URLs

All URLs use the requested form `https://images.unsplash.com/photo-<id>?w=800&q=80&auto=format&fit=crop`. **Status is the actual curl output.** On a review re-run (2026-10-07), all 57 unique URLs returned `200 image/jpeg` without redirects (no `-L`). A bad ID used as a control returned `404 text/html`. All 29 `PHOTOS` picks and all 29 alternates were checked again on contact sheets, and six descriptions were corrected. Earlier rounds checked 171 candidates plus every URL already in `src/data/mock/photos.ts`, and all returned `200 image/jpeg`. Each subject has one **best** pick, which goes into `PHOTOS` below, plus alternates. Every subject has at least 2 verified URLs. "Chocolate cake / brownie" is split into two keys, `brownie` and `chocolateCake`.

| Category | Subject | Key | Pick | URL | Verified | Description |
|---|---|---|---|---|---|---|
| Coffee | Espresso | `espresso` | **best** | https://images.unsplash.com/photo-1610889556528-9a770e32642f?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Espresso in a short glass on a slate saucer, plain light background |
| Coffee | Espresso | `espresso` | alt | https://images.unsplash.com/photo-1572286258217-40142c1c6a70?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Top-down demitasse on navy saucer, plain white background (cleanest circle crop) |
| Coffee | Espresso | `espresso` | alt | https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Espresso in a black cup, dark moody background (already in photos.ts) |
| Coffee | Cappuccino | `cappuccino` | **best** | https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Top-down cappuccino with rosetta art, white cup on dark wood |
| Coffee | Cappuccino | `cappuccino` | alt | https://images.unsplash.com/photo-1534778101976-62847782c213?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Latte-art cappuccino in white cup on a desk, warm light |
| Coffee | Caffe latte | `latte` | **best** | https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Latte in a clear glass with tulip art on warm wood |
| Coffee | Caffe latte | `latte` | alt | https://images.unsplash.com/photo-1503481766315-7a586b20f66d?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Latte art in white cup, low side angle, dark background |
| Coffee | Flat white | `flatWhite` | **best** | https://images.unsplash.com/photo-1587982704600-e5f79d652fe5?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Top-down flat white on white saucer, plain light background |
| Coffee | Flat white | `flatWhite` | alt | https://images.unsplash.com/photo-1566876494550-2e8ad7a4c6b8?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Top-down flat white with heart art, dark-rimmed cup on warm wood |
| Coffee | Caramel macchiato | `caramelMacchiato` | **best** | https://images.unsplash.com/photo-1662047102608-a6f2e492411f?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Layered iced caramel latte in a glass jar with a metal straw, on a wooden coaster, soft café background |
| Coffee | Caramel macchiato | `caramelMacchiato` | alt | https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Layered iced espresso and milk in clear glass on wood |
| Coffee | Mocha | `mocha` | **best** | https://images.unsplash.com/photo-1618576230663-9714aecfb99a?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Chocolate-dark mocha in a glass mug on dark wood |
| Coffee | Mocha | `mocha` | alt | https://images.unsplash.com/photo-1596078841242-12f73dc697c6?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Cocoa-brown latte art in white cup and saucer on white table |
| Coffee | Americano | `americano` | **best** | https://images.unsplash.com/photo-1599659236990-34cc97c7e363?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Black coffee in a white mug, plain white background |
| Coffee | Americano | `americano` | alt | https://images.unsplash.com/photo-1551030173-122aabc4489c?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Black coffee in white cup on wooden table |
| Coffee | Cold brew | `coldBrew` | **best** | https://images.unsplash.com/photo-1561641377-f7456d23aa9b?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Cold brew over ice in a rocks glass on a solid amber background |
| Coffee | Cold brew | `coldBrew` | alt | https://images.unsplash.com/photo-1549652127-2e5e59e86a7a?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Iced coffee with ice in a clear cup |
| Coffee | Iced latte | `icedLatte` | **best** | https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Iced latte with milk clouding into espresso in a glass tumbler, warm brown background |
| Coffee | Iced latte | `icedLatte` | alt | https://images.unsplash.com/photo-1562447457-579fc34967fb?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Milk pouring into iced coffee on a wooden coaster, light background |
| Coffee | Spanish latte | `spanishLatte` | **best** | https://images.unsplash.com/photo-1592663527359-cf6642f54cff?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Sweet cream (condensed-milk look) poured into iced coffee on a wooden board |
| Coffee | Spanish latte | `spanishLatte` | alt | https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Layered iced latte in a glass (already in photos.ts) |
| Coffee | Spanish latte | `spanishLatte` | alt | https://images.unsplash.com/photo-1609595428024-d5eec1a1af06?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Hot latte in a black ceramic mug (use if served hot) |
| Tea | Matcha latte | `matchaLatte` | **best** | https://images.unsplash.com/photo-1515823064-d6e0c04616a7?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Matcha latte with rosetta art in white cup |
| Tea | Matcha latte | `matchaLatte` | alt | https://images.unsplash.com/photo-1749280447307-31a68eb38673?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Layered iced matcha latte with a black straw |
| Tea | Matcha latte | `matchaLatte` | alt | https://images.unsplash.com/photo-1717398804885-a6c22b3e5c2f?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Iced matcha in a clear glass, plain light background |
| Tea | Chai latte | `chaiLatte` | **best** | https://images.unsplash.com/photo-1636920272028-c27f1ae474c3?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Top-down chai latte dusted with cinnamon and star anise, dark background |
| Tea | Chai latte | `chaiLatte` | alt | https://images.unsplash.com/photo-1555251415-4716d9d0b8af?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Milky chai in white mug with a star anise, light background |
| Tea | Iced peach tea | `icedPeachTea` | **best** | https://images.unsplash.com/photo-1676693420436-7fa448f054eb?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Top-down iced tea with peach slices and ice |
| Tea | Iced peach tea | `icedPeachTea` | alt | https://images.unsplash.com/photo-1601390395693-364c0e22031a?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Red iced tea in a tall glass, light grey background (reads as hibiscus more than peach) |
| Breakfast | Croissant | `croissant` | **best** | https://images.unsplash.com/photo-1691480162735-9b91238080f6?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Single butter croissant on plain white (best circle crop in the set) |
| Breakfast | Croissant | `croissant` | alt | https://images.unsplash.com/photo-1599940778173-e276d4acb2bb?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Croissant on a round white plate, top-down |
| Breakfast | Avocado toast | `avocadoToast` | **best** | https://images.unsplash.com/photo-1588137378633-dea1336ce1e2?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Two avocado toasts with lemon on a white plate, top-down |
| Breakfast | Avocado toast | `avocadoToast` | alt | https://images.unsplash.com/photo-1623691752358-0be1e4235183?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Smashed avocado toast with feta and tomatoes |
| Breakfast | Breakfast sandwich / egg bagel | `breakfastSandwich` | **best** | https://images.unsplash.com/photo-1747479465303-9e4c6ad1e4dd?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Egg-and-cheese bagel sandwich on a plate |
| Breakfast | Breakfast sandwich / egg bagel | `breakfastSandwich` | alt | https://images.unsplash.com/photo-1727245243403-b177f3670c2e?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Stacked bagel sandwich on a plate |
| Snacks | Cookie | `cookie` | **best** | https://images.unsplash.com/photo-1611082191524-1c049443f288?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Single chocolate-chip cookie centred on plain light grey |
| Snacks | Cookie | `cookie` | alt | https://images.unsplash.com/photo-1597733153203-a54d0fbc47de?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Chocolate-chip cookie with crumbs on white |
| Snacks | Banana bread | `bananaBread` | **best** | https://images.unsplash.com/photo-1675712841671-cbcbe2c84103?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Glazed banana-bread loaf on a white plate |
| Snacks | Banana bread | `bananaBread` | alt | https://images.unsplash.com/photo-1675712843856-ba2cb7d33f3c?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Glazed banana-bread loaf on a white napkin |
| Snacks | Granola bowl / yogurt parfait | `granolaBowl` | **best** | https://images.unsplash.com/photo-1641494587136-eec74f1944ae?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Granola and yogurt in a white bowl, light background |
| Snacks | Granola bowl / yogurt parfait | `yogurtParfait` | alt | https://images.unsplash.com/photo-1654584240523-6b8d3f6c33b4?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Two strawberry-granola parfait jars |
| Desserts | Cheesecake | `cheesecake` | **best** | https://images.unsplash.com/photo-1567171466295-4afa63d45416?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | NY cheesecake slice topped with blueberries on a white plate, blurred café background |
| Desserts | Cheesecake | `cheesecake` | alt | https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Blueberry cheesecake slice on a white plate |
| Desserts | Chocolate cake / brownie | `brownie` | **best** | https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Stack of fudgy brownies with chocolate pouring over |
| Desserts | Chocolate cake / brownie | `chocolateCake` | **best** | https://images.unsplash.com/photo-1700448293876-07dca826c161?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Layered chocolate cake slice on a white plate, light background |
| Desserts | Tiramisu | `tiramisu` | **best** | https://images.unsplash.com/photo-1724116379273-ba32b70d112c?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Square tiramisu slice dusted with cocoa on a white plate |
| Desserts | Tiramisu | `tiramisu` | alt | https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Tiramisu slice with cocoa and a berry on a wooden café table, bright |
| Banners | Coffee beans close-up | `beans` | **best** | https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Full-frame roasted coffee beans |
| Banners | Coffee beans close-up | `beans` | alt | https://images.unsplash.com/photo-1513530176992-0cf39c4cbed4?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Scattered beans on white (works on light banners) |
| Banners | Barista pouring latte art | `latteArt` | **best** | https://images.unsplash.com/photo-1541167760496-1628856ab772?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Close-up of milk pouring a rosetta into a white cup |
| Banners | Barista pouring latte art | `latteArt` | alt | https://images.unsplash.com/photo-1547240089-0b75465f8e80?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Milk being poured into a cappuccino |
| Banners | Cafe interior | `cafeInterior` | **best** | https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Bright café interior with plants and window seating |
| Banners | Cafe interior | `cafeInterior` | alt | https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Warm café counter with a neon CAFE sign (already in photos.ts) |
| Banners | Pastry spread | `pastries` | **best** | https://images.unsplash.com/photo-1483695028939-5bb13f8648b0?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Tray of croissants and laminated pastries |
| Banners | Pastry spread | `pastries` | alt | https://images.unsplash.com/photo-1597528662465-55ece5734101?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Croissants and chocolate pastries on a board with rolling pin |
| Avatar | Demo profile portrait | `avatar` | **best** | https://images.unsplash.com/photo-1580489944761-15a19d654956?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Smiling woman, white tee, plain light background |
| Avatar | Demo profile portrait | `avatar` | alt | https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80&auto=format&fit=crop | `200 image/jpeg` | Smiling man, neutral grey background |

**Avatar.** The two portraits above are fine for a demo. For a client-facing build, prefer an **initials avatar**: a 40px `roast` circle with white Outfit 700 initials. It avoids putting a stranger's face on someone's profile.

**Audit of the current `src/data/mock/photos.ts`.** I left the file unchanged. Every URL in it returns `200 image/jpeg`, but some are the wrong subject:

| Key | Current ID | What the photo actually is | Action |
|---|---|---|---|
| `caramelMacchiato` | 1485808191679-5f86510681a2 | Hot latte on a blue saucer | Replace (best above) |
| `mocha` | 1578314675249-a6910f80cc4e | Iced coffee in a plastic cup with straw | Replace |
| `coldBrew` | 1517701604599-bb29b565090c | Layered milk and espresso (reads as macchiato) | Replace; reused as the `caramelMacchiato` alt |
| `chaiLatte` | 1557006021-b85faa2bc5e2 | Cappuccino with chocolate flakes | Replace |
| `icedPeachTea` | 1556679343-c7306c1976bc | Iced tea with lime, dark background | Replace (peach slices) |
| `breakfastSandwich` | 1525351484163-7529414344d8 | Open-faced egg toast, not a sandwich | Replace |
| `latteArt` | 1442512595331-e89e73853f31 | Pour-over bar with kettle and dripper, no latte art | Replace |
| `pastries` | 1509440159596-0249088772ff | Rustic bread loaves, not pastries | Replace |
| `latte`, `cappuccino`, `matchaLatte`, `icedLatte`, `brownie`, `beans` | (same as best) | Correct | Keep |
| `espresso`, `americano`, `spanishLatte`, `croissant`, `cookie`, `bananaBread`, `avocadoToast`, `flatWhite`, `cheesecake`, `tiramisu`, `cafeInterior` | various | Correct, but a plainer-background pick exists | Optional swap |

**Usage notes**
- **Size per slot.** Rewrite `w` for each slot and keep `q=80&auto=format&fit=crop`:
  - 56px cart thumbnails: `w=168`
  - grid cards: `w=480`
  - hero: `w=1080`
- **Square crops.** Add `&h=<w>&crop=entropy` for a server-side square crop (verified 200).
- **Format negotiation.** `auto=format` picks the format from the `Accept` header. curl gets JPEG, and a browser that sends `image/avif` gets AVIF (verified 200). That's fine for web and for expo-image.
- **Rendering.** Use `expo-image`'s `Image` with `contentFit="cover"`, `transition={200}`, `cachePolicy="memory-disk"`, and `recyclingKey={item.id}` in lists.
- **Prefetching.** Warm the hero images with `Image.prefetch(urls, 'memory-disk')`. expo-image 57.0.5 has two overloads: `prefetch(urls: string | string[], cachePolicy?: 'disk' | 'memory-disk' | 'memory')` and `prefetch(urls, options?: { cachePolicy?; headers? })`. Both return `Promise<boolean>`, which resolves `false` as soon as one URL fails. On web (`ImageModule.web.ts`), the cache policy is ignored and it just loads each URL with `new Image()`, which leaves caching to the browser's HTTP cache.

```ts
// src/data/mock/photos.ts: the same keys the app already imports, plus granolaBowl, yogurtParfait, chocolateCake, avatar.
// Unsplash License (free commercial use; attribution appreciated, not required). Replace with the client's cut-out PNGs (DESIGN.md §10).
export const PHOTOS = {
  espresso: 'https://images.unsplash.com/photo-1610889556528-9a770e32642f?w=800&q=80&auto=format&fit=crop',
  cappuccino: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=800&q=80&auto=format&fit=crop',
  latte: 'https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?w=800&q=80&auto=format&fit=crop',
  flatWhite: 'https://images.unsplash.com/photo-1587982704600-e5f79d652fe5?w=800&q=80&auto=format&fit=crop',
  caramelMacchiato: 'https://images.unsplash.com/photo-1662047102608-a6f2e492411f?w=800&q=80&auto=format&fit=crop',
  mocha: 'https://images.unsplash.com/photo-1618576230663-9714aecfb99a?w=800&q=80&auto=format&fit=crop',
  americano: 'https://images.unsplash.com/photo-1599659236990-34cc97c7e363?w=800&q=80&auto=format&fit=crop',
  coldBrew: 'https://images.unsplash.com/photo-1561641377-f7456d23aa9b?w=800&q=80&auto=format&fit=crop',
  icedLatte: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=800&q=80&auto=format&fit=crop',
  spanishLatte: 'https://images.unsplash.com/photo-1592663527359-cf6642f54cff?w=800&q=80&auto=format&fit=crop',
  matchaLatte: 'https://images.unsplash.com/photo-1515823064-d6e0c04616a7?w=800&q=80&auto=format&fit=crop',
  chaiLatte: 'https://images.unsplash.com/photo-1636920272028-c27f1ae474c3?w=800&q=80&auto=format&fit=crop',
  icedPeachTea: 'https://images.unsplash.com/photo-1676693420436-7fa448f054eb?w=800&q=80&auto=format&fit=crop',
  croissant: 'https://images.unsplash.com/photo-1691480162735-9b91238080f6?w=800&q=80&auto=format&fit=crop',
  avocadoToast: 'https://images.unsplash.com/photo-1588137378633-dea1336ce1e2?w=800&q=80&auto=format&fit=crop',
  breakfastSandwich: 'https://images.unsplash.com/photo-1747479465303-9e4c6ad1e4dd?w=800&q=80&auto=format&fit=crop',
  cookie: 'https://images.unsplash.com/photo-1611082191524-1c049443f288?w=800&q=80&auto=format&fit=crop',
  bananaBread: 'https://images.unsplash.com/photo-1675712841671-cbcbe2c84103?w=800&q=80&auto=format&fit=crop',
  granolaBowl: 'https://images.unsplash.com/photo-1641494587136-eec74f1944ae?w=800&q=80&auto=format&fit=crop',
  cheesecake: 'https://images.unsplash.com/photo-1567171466295-4afa63d45416?w=800&q=80&auto=format&fit=crop',
  brownie: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800&q=80&auto=format&fit=crop',
  chocolateCake: 'https://images.unsplash.com/photo-1700448293876-07dca826c161?w=800&q=80&auto=format&fit=crop',
  tiramisu: 'https://images.unsplash.com/photo-1724116379273-ba32b70d112c?w=800&q=80&auto=format&fit=crop',
  beans: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800&q=80&auto=format&fit=crop',
  latteArt: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=800&q=80&auto=format&fit=crop',
  cafeInterior: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&q=80&auto=format&fit=crop',
  pastries: 'https://images.unsplash.com/photo-1483695028939-5bb13f8648b0?w=800&q=80&auto=format&fit=crop',
  avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=800&q=80&auto=format&fit=crop',
  yogurtParfait: 'https://images.unsplash.com/photo-1654584240523-6b8d3f6c33b4?w=800&q=80&auto=format&fit=crop',
} as const;

export type PhotoKey = keyof typeof PHOTOS;

/** Resize a PHOTOS URL for a slot (keeps q/auto/fit). Example: sized(PHOTOS.croissant, 168). */
export const sized = (url: string, w: number) => url.replace(/([?&])w=\d+/, `$1w=${w}`);
```

### Sources
- Dribbble search pages used: https://dribbble.com/search/coffee-shop-app and https://dribbble.com/search/coffee-app-animation. The shot links are listed in A1.
- Behance search: https://www.behance.net/search/projects/coffee%20shop%20app%20ui
- Philz order-ahead carousel: https://www.pymnts.com/mobile-applications/2018/philz-coffee-mobile-order-app/
- Reanimated docs (React Compiler: use `get`/`set`): https://docs.swmansion.com/react-native-reanimated/docs/core/useSharedValue
- Reanimated compatibility: https://docs.swmansion.com/react-native-reanimated/docs/guides/compatibility. The live table lists 4.5.x with RN 0.83 to 0.86 and worklets 0.10.x/0.11.x. However, the **installed 4.5.1** `package.json` peer range and its `compatibility.json` say `react-native-worklets: 0.10.x` only, and Expo SDK 57's `bundledNativeModules.json` (what Expo Go ships) pins `react-native-worklets 0.10.1`. Don't bump worklets.
- Unsplash photo searches: `https://unsplash.com/s/photos/<subject>?license=free`, one per subject.

## Verification notes

Review pass on 2026-10-07. Each claim was checked against the installed sources under `node_modules` and the official docs.

**Corrected in this file**
- **Snippet F.** Fixed a scale bug. The draft started unfilled stamps at `0.6`, so a slot that became `filled` without `justEarned` stayed small forever. Now it uses `useSharedValue(1)` and the sequence starts with `withTiming(0.6, { duration: 0 })`. The `withTiming` import was added.
- **Reanimated compatibility line.** The live docs list worklets 0.10.x and 0.11.x for 4.5.x. The installed 4.5.1 (peer range plus `compatibility.json`) and Expo SDK 57's `bundledNativeModules.json` allow **0.10.x only**. Expo Go ships 0.10.1 native code.
- **`Image.prefetch`.** Added the second overload, `(urls, { cachePolicy, headers })`, and the web behaviour: `cachePolicy` is ignored and the URLs load through `new Image()`.
- **Snippet E.** Replaced "verified to work on web" with the exact source files and how the web path works. This was checked by reading the code. It was not run in a browser.
- **Snippet A.** Added two caveats. `useReducedMotion()` reads the setting only at app start. Animations default to `ReduceMotion.System`.
- **A2 #9.** Removed "CoffeeDream", which was cited as a source but is not one of the references.
- **Photo descriptions.** Six were wrong about the background or subject: `caramelMacchiato` (best), `icedLatte` (best), `cheesecake` (best), and the `flatWhite`, `icedPeachTea` and `tiramisu` alternates. No URL needed replacing.

**Confirmed as written**
- **Versions installed.** expo 57.0.27, expo-router 57.0.25, react-native 0.86.3, react-native-web 0.21.3, reanimated 4.5.1, worklets 0.10.1, svg 15.15.4, expo-image 57.0.5, RNGH 2.32.0, @expo/vector-icons 15.1.1, TypeScript 6.0.3. All match `expo/bundledNativeModules.json`.
- **Reanimated 4.5.1 signatures:**
  - `withRepeat(anim, numberOfReps = 2, reverse = false, callback?, reduceMotion?)`. A value `<= 0` repeats forever. Without `reverse`, each repeat restarts from the start value.
  - `withDelay(ms, anim, reduceMotion?)`
  - `withSequence(...anims)` or `withSequence(reduceMotion, ...anims)`
  - `withSpring(to, config?, cb?)`
  - `SharedValue.get()` and `.set(v | updater)`
  - Also exported: `useReducedMotion(): boolean`, `useAnimatedProps`, `createAnimatedComponent`, `Easing.inOut(Easing.sin)`, `interpolate` and `cancelAnimation`.
- **react-native-svg 15.15.4.** `strokeDasharray` is typed `ReadonlyArray<NumberProp> | NumberProp`. `transform` accepts a string.
- **pointerEvents.** RN 0.86 `ViewStyle.pointerEvents` exists. RNW 0.21.3 warns "props.pointerEvents is deprecated. Use style.pointerEvents".
- **Ionicons.** The `cafe` and `cafe-outline` glyphs exist.
- **expo-image props.** `contentFit`, `transition` (number), `cachePolicy="memory-disk"` and `recyclingKey` all exist.
- **RNGH 2.32.** `Gesture.Pan()` exists. This is the v2 builder API.
- **Repo exports.** `colors.*`, `springs.snappy/smooth`, `haptic.light()`, the `Text` variants `label`/`caption` and `Icon` all match `src/`. All 23 `PHOTOS.*` keys the app references exist in the `PHOTOS` block.
- **Unsplash.** All 57 URLs return `200 image/jpeg`. `&h=480&crop=entropy` returns a 480×480 image. `auto=format` returns `image/avif` or `image/webp` when the `Accept` header asks for them.
- **No `babel.config.js` needed.** `babel-preset-expo` adds `react-native-worklets/plugin` automatically.

**Gotchas**
- **Reanimated 4 changed the `withSpring` defaults** to `{ damping: 120, mass: 4, stiffness: 900 }` (`GentleSpringConfig`).
  - A config that sets `damping`/`stiffness` but **omits `mass` gets mass 4**, which is heavy and slow. `springs.*` in `@/theme` sets `mass: 1` explicitly. Keep it.
  - `restDisplacementThreshold` and `restSpeedThreshold` are gone; use `energyThreshold` instead.
  - `duration`/`dampingRatio` cannot be combined with `stiffness`/`damping`. The type is a mutually exclusive union.
- **Use `.get()`/`.set()` under the React Compiler.** Never read or write `.value` in component bodies.

**Still uncertain**
- **SVG animation on web.** `useAnimatedProps` on SVG under web was checked by tracing the source, not by running it in a browser.
- **A1 detail bullets.** Only titles and authors were re-verified. The shot details were not re-checked frame by frame.
- **`pickupSlots()` labels.** They come from `Intl` and may format differently on Hermes and in browsers, so never use them as IDs. The snippet uses ISO strings for that.
- **Peach tea alternate.** The `icedPeachTea` alternate reads as hibiscus. Use the best pick.
