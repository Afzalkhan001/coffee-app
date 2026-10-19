# Photo credits

All product and banner images in the Ember Roast prototype come from [Unsplash](https://unsplash.com) and are used under the free [Unsplash License](https://unsplash.com/license). Each one was checked against the Unsplash API (`premium: false`, `plus: false`), so none is an Unsplash+ image. The licence doesn't require attribution, but we credit each photographer as a courtesy.

Every image is bundled with the app, so the demo works offline:

- **Products:** `assets/products/<key>.webp` holds 21 transparent cut-outs, one per product. Each is 900×900 WebP with alpha at quality 88, about 1.2 MB for the set. The subject is centred horizontally, with its base 3% above the bottom edge and at least 6% clear space on the other sides. Scale is matched across the set: cups with saucers and plates fill the width, and tall glasses are sized by height. A coverage cap stops squat, solid items (the brownie stack, the rocks glass) from looking bigger than the cups. Per-item display fixes (where a food item's footprint really rests, and a display scale for the cheesecake, croissant and tiramisu) live in `src/data/mock/photoMetrics.ts`.
- **Scenes:** `assets/scenes/<key>.webp` holds 4 opaque banners, 1200px wide, about 470 KB in total.

In code, images are `local:<key>` strings (see `src/data/mock/photos.ts`). They resolve to the bundled files through `src/data/mock/photoSource.ts`. The production app should use the client's own cut-out product photography (see DESIGN.md section 10).

## Product cut-outs

Most cut-outs replace the earlier circle-cropped photos. Each new source was picked because it cuts out cleanly: a plain backdrop, a clear silhouette, a side or three-quarter view, and nothing touching the frame edge. The set is shot from a consistent three-quarter or side angle, so it reads as one shoot.

| Key | Photographer | Unsplash page | Note |
|---|---|---|---|
| `espresso` | Gabi Miranda | [white-ceramic-teacup-filled-with-brown-coffee-niAkR1H24tE](https://unsplash.com/photos/white-ceramic-teacup-filled-with-brown-coffee-niAkR1H24tE) | Replaced |
| `cappuccino` | Dan Smedley | [latte-in-cup-765Ogj6zVuI](https://unsplash.com/photos/latte-in-cup-765Ogj6zVuI) | Replaced |
| `latte` | Abolfazl eslami | [white-ceramic-cup-with-saucer-on-brown-wooden-table-c8gSQkwWoRA](https://unsplash.com/photos/white-ceramic-cup-with-saucer-on-brown-wooden-table-c8gSQkwWoRA) | Replaced |
| `flatWhite` | Lex Sirikiat | [cafe-latte-art-work-VkUP6wWqSvw](https://unsplash.com/photos/cafe-latte-art-work-VkUP6wWqSvw) | Replaced |
| `caramelMacchiato` | Aneta Voborilova | [a-glass-filled-with-ice-cream-and-a-drink-AM5WbYLL3E4](https://unsplash.com/photos/a-glass-filled-with-ice-cream-and-a-drink-AM5WbYLL3E4) | Replaced |
| `mocha` | Aditya Saxena | [a-cup-of-hot-chocolate-with-whipped-cream-and-chocolate-shavings-thRVSm2aUFk](https://unsplash.com/photos/a-cup-of-hot-chocolate-with-whipped-cream-and-chocolate-shavings-thRVSm2aUFk) | Replaced |
| `americano` | Olena Bohovyk | [a-cup-of-coffee-sitting-on-top-of-a-wooden-table-QFZgElMutbk](https://unsplash.com/photos/a-cup-of-coffee-sitting-on-top-of-a-wooden-table-QFZgElMutbk) | Replaced |
| `spanishLatte` | Kenny Kennethh | [cafe-latte-in-glass-Fq2i-hGJwNc](https://unsplash.com/photos/cafe-latte-in-glass-Fq2i-hGJwNc) | Replaced |
| `matchaLatte` | Daniel Stiel | [a-green-liquid-in-a-glass-with-a-wooden-coaster-_zwATV2KGTg](https://unsplash.com/photos/a-green-liquid-in-a-glass-with-a-wooden-coaster-_zwATV2KGTg) | Replaced (coaster retouched out) |
| `chaiLatte` | Korie Cull | [blue-ceramic-teacup-on-table-aCOc0321Ask](https://unsplash.com/photos/blue-ceramic-teacup-on-table-aCOc0321Ask) | Replaced |
| `coldBrew` | Monaz Nazary | [a-glass-filled-with-liquid-sitting-on-top-of-a-table-USdAfJdfPtk](https://unsplash.com/photos/a-glass-filled-with-liquid-sitting-on-top-of-a-table-USdAfJdfPtk) | Same photo as before |
| `icedLatte` | Nathan Dumlao | [clear-glass-filled-ice-coffee-vZOZJH_xkUk](https://unsplash.com/photos/clear-glass-filled-ice-coffee-vZOZJH_xkUk) | Replaced |
| `icedPeachTea` | Youwoon Park | [a-drink-with-a-slice-of-lemon-on-the-rim-ZuS3gahdbRw](https://unsplash.com/photos/a-drink-with-a-slice-of-lemon-on-the-rim-ZuS3gahdbRw) | Replaced |
| `croissant` | personalgraphic.com | [a-croissant-sitting-on-top-of-a-white-surface-VzUE5RtCuBA](https://unsplash.com/photos/a-croissant-sitting-on-top-of-a-white-surface-VzUE5RtCuBA) | Replaced |
| `avocadoToast` | Dima Solomin | [a-plate-of-food-RhySFXb0Wa0](https://unsplash.com/photos/a-plate-of-food-RhySFXb0Wa0) | Replaced |
| `breakfastSandwich` | Seb Reivers | [breakfast-sandwich-with-fried-egg-em-5ukX8PYE](https://unsplash.com/photos/breakfast-sandwich-with-fried-egg-em-5ukX8PYE) | Replaced |
| `bananaBread` | Wouter Supardi Salari | [a-loaf-of-banana-bread-sitting-on-top-of-a-white-napkin-7RzeewJzFUI](https://unsplash.com/photos/a-loaf-of-banana-bread-sitting-on-top-of-a-white-napkin-7RzeewJzFUI) | Replaced |
| `cookie` | Swiss Educational College | [a-cookie-with-a-face-on-it-1KxonbluOpo](https://unsplash.com/photos/a-cookie-with-a-face-on-it-1KxonbluOpo) | Replaced |
| `cheesecake` | kimia kazemi | [slice-of-burnt-basque-cheesecake-on-wooden-tray-KoYk0JGAk3E](https://unsplash.com/photos/slice-of-burnt-basque-cheesecake-on-wooden-tray-KoYk0JGAk3E) | Replaced; retouched: the crushed-black burnt top lifted to a caramel brown, the hard bottom-left corner rounded |
| `brownie` | Larissa Uemura | [brown-cookies-on-white-table-S2KGqxh-10E](https://unsplash.com/photos/brown-cookies-on-white-table-S2KGqxh-10E) | Replaced |
| `tiramisu` | Aleksandra Tanasiienko | [sliced-chocolate-cake-on-white-ceramic-plate-xPBUzVMKKTw](https://unsplash.com/photos/sliced-chocolate-cake-on-white-ceramic-plate-xPBUzVMKKTw) | Replaced |

## Scenes (opaque banners)

| Key | Photographer | Unsplash page |
|---|---|---|
| `latteArt` | Fahmi Fakhrudin | [person-making-latte-art-nzyzAUsbV0M](https://unsplash.com/photos/person-making-latte-art-nzyzAUsbV0M) |
| `beans` | Immo Wegmann | [brown-coffee-beans-REqK8jIAtv8](https://unsplash.com/photos/brown-coffee-beans-REqK8jIAtv8) |
| `pastries` | Conor Brown | [a-bunch-of-croissants-that-are-on-a-table-sqkXyyj4WdE](https://unsplash.com/photos/a-bunch-of-croissants-that-are-on-a-table-sqkXyyj4WdE) |
| `cafeInterior` | Jacob Baltierra | [a-restaurant-with-a-long-counter-and-wooden-chairs-eGa-akClgIw](https://unsplash.com/photos/a-restaurant-with-a-long-counter-and-wooden-chairs-eGa-akClgIw) |

## How the cut-outs were made

1. **Download:** each source photo at 1600px.
2. **Segmentation:** BiRefNet (`birefnet-general.onnx`, from the rembg model set). It runs directly through onnxruntime, because rembg's pymatting/numba path is blocked by Windows Application Control on the build machine.
3. **Alpha clean-up:** only significant components are kept, and the alpha levels are tightened to remove haze.
4. **Edge colour decontamination:** the local backdrop colour is estimated by normalised convolution, then the foreground colour is solved on the soft edge band. This removes white and wood halos on dark and tinted planes.
5. **Grading:** a light warm grade is applied across the set so every item sits in the same palette.
6. **Placement:** each subject is trimmed and placed on the 900×900 canvas as described above.

Every cut-out was checked on cream `#F6F1EA`, the tinted hero `#E9DCCB`, white and espresso `#2A1E17`.
