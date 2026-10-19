# Client reference shots (visual target)

The client shared three reference shots. Agents cannot see the images, so this file keeps the precise written description that every design round works from. The two sections below are verbatim. The art direction built on them is `DESIGN.md` §R3.

Related files:
- `docs/references/r3-mocks/*.png`: the R3 art-direction mocks at 390×844 (onboarding, home, menu, product, cart, confirmation). These are static HTML renders, not app screenshots. They set composition, scale and tone; where a mock and the written spec differ, the spec in `DESIGN.md` §R3 wins.
- `docs/references/r3-mocks/cutouts-contact-sheet.png`: the earlier cut-out set on tinted tiles with a contact shadow (out of date: 20 of the 21 photos were replaced since).
- `assets/products/*.webp`: transparent product cut-outs (900×900 WebP, bundled, so the app works offline), one per `PHOTOS` key in `src/data/mock/photos.ts`. They were made with BiRefNet matting plus edge-colour decontamination; sources and the method are in `docs/research/photos/CREDITS.md`.
- `docs/references/tools/cutout.py`: the earlier ISNet feasibility test (not the final pipeline). See its docstring; it needs `onnxruntime`, `numpy`, `Pillow` and `isnet-general-use.onnx` from the rembg GitHub releases.

---

## The client's 3 reference shots (verbatim)

REF 1 "Everyday a new pizza" (3 phone screens floating on a soft warm-grey backdrop):
 • Onboarding: near-black full screen. Top half: LOOSE hand-drawn food doodles in copper/peach (some white) — mushroom, cheese, olives, onion rings, pepperoni — BIG (60-110px), sketchy single-weight strokes, several CROPPED by the screen edges, airy, not a tidy grid and not inside any circle. Middle: a BOLD sage-green (#8BB580) rounded capsule, ~70% screen width and ~150px tall, BLEEDING OFF THE RIGHT EDGE, containing a thin white wavy line and a glowing orange dot with a translucent halo ring. Bottom: headline "Everyday a new pizza for you" in VERY LARGE (~52px) LIGHT geometric sans, white, left-aligned, 3 lines. Bottom-left: 3 page dots (two small grey, active = white pill). Bottom-right: a LARGE (~95px) glossy dark-grey circle button with a thin white arrow, partly bleeding off the bottom-right, with a thin peach arc hugging it. Almost nothing else on screen — very restrained.
 • Product: top ~55% is a flat soft lavender-grey hero. Title INSIDE the hero top-left: "Veggie" bold + "Pizza" light, white, ~28px. Frosted round back button top-right. A huge CUT-OUT pizza (no photo background), ~85% of screen width, centred, sitting on a thin elliptical plate outline/shadow. Bottom: a pale sheet whose top edge has a concave curved notch + grabber; centred small grey ingredients line; S/M/L circles (selected = black fill, white letter; others white); quantity row where "+" and "−" sit in semicircle bumps cut into the sheet's left/right edges and "1" in a small pill in the middle; then a black pill bar: "$ 9.30" bold white on the left, white circle with a basket icon on the right. Very few elements.
 • Cart: light grey screen. "Cart" bold black top-left; green circle badge with "4" and a green ring top-right. Notched list sheet: ~70px round CUT-OUT pizza thumbnails, bold name, grey "Size: S", price in a white pill on the right. An ORANGE-PEACH card (#F7A86A) with a concave notch at top: small white "Delivery Amount" + "$3.00" in a translucent pill; small "Total Amount"; huge bold white "USD 38.00"; a cluster of 3 cut-out pizzas overlapping, bleeding off the card's bottom-right. Black pill "Make Payment" + white circle arrow. Clean, few words.

REF 2 "Java Café / Emura Studio — Coffee & Pastries" (warm cream #F4EFE9 with a soft orange glow, huge faint serif-italic "Java Café" watermark in the background):
 • Pick-up/menu: back circle + search circle; "PICK UP" bold uppercase dark-brown; one grey subtitle line; a cream gradient store card "Plaza Indonesia · 3.2 km | Nearest" with a dark "View On Maps" pill; outlined pill chips (selected = thicker dark outline); 2-column grid of white cards whose inner image area is light cream with a CUT-OUT iced cup standing in it (no photo background), small "+" top-right, name + price at the bottom; a red rotated "BEST DEAL" sticker; strike-through sale price; a green circular "LOW CALORIE" stamp.
 • Home: full-bleed hero poster image on top (~40%) with carousel dots; greeting row with avatar, "Good Afternoon, JAVAs!" + bold "Jenny", brown "2300 Points" pill right; two white outlined mode cards ("Pick Up — Take it at the store, no queue", "Delivery — Deliver it to your place") with a soft icon disc; a product section; white bottom bar (Home / My Orders / Vouchers).
 • Detail: "DETAIL" uppercase centred; a large light-grey rounded card with a CUT-OUT cup centred; an orange OUTLINED circle "245 Kcal" badge overlapping the card's top-right edge; white sheet: bold "Caramel Macchiato", two grey lines of copy, divider, "Options Available" bold + "*Choose One" grey right, radio rows "Iced"/"Hot". Elegant, sparse.

REF 3 "Food delivery — delivo" (only ~20% weight): orange pin + "Albuquerque, NM ⌄", bell with orange dot; white pill search with an orange mic circle; vivid orange promo banner with a white code chip "FIRST50", bold white "Get 50% Off Your First Order!", 3D fries art, black "Order Now" pill; category tiles = rounded squares with 3D food art (selected orange, others black) + labels; food cards with full-bleed photo, time chip, heart, bold name, rating, black price pill; floating dark pill bottom nav with an orange expanded "Explore" tab.

---

## Why round 2 looked "AI-ish" (verbatim critique, client's words summarised by the director)

- Scattered small line-art icon "stickers" used as filler decoration (onboarding inside a dim circle, auth hero, confirmation, empty states, category header) — reads as clip-art. Replace with ONE bold, intentional composition per screen (big, cropped off-edge, loose strokes like ref 1) or nothing.
- Stock photos cropped into circles with a ring → "round photo stickers". Products must be CUT-OUTS floating with a soft contact shadow on tinted tiles/heroes (refs 1+2).
- Everything is a circle and every block is the same rounded white card with the same shadow → monotony, no hierarchy. Vary shape/scale; fewer containers; let content sit on the background.
- Too many chips, pills, badges, eyebrow labels (COFFEE, YOUR USUAL · MONDAY, PAIRS WELL), sparkle ✨ icons, helper captions ("Swipe left to remove · tap an item to edit it", "Prototype: any number works"), meta rows. Cut at least 40%. Premium = restraint, one focal point per screen.
- Chatty, cutesy microcopy on every section ("What Market Street is ordering today", "Pulled to order on our house blend", "Every sip earns you something", "ready to brew"). Use short, confident, human copy; many sections need no subtitle at all.
- Shouty heavy UPPERCASE titles everywhere. Keep uppercase only where refs use it (e.g. menu/detail headers per ref 2) — and consider an editorial serif-italic accent (Fraunces) used sparingly (ref 2 watermark vibe).
- Home is a template showing every component (8+ sections). Trim to a confident, scannable flow.
- Low tonal contrast (cream bg vs white cards vs beige tiles all similar) → muddy. Create clear planes and real focal points.
- Generic success screen; peach total card hidden below the fold in cart; small lost green capsule in onboarding.

The client likes the overall vibe, the palette family, the animation system and every signature motion. Keep them.
