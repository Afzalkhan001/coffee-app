/**
 * One-tap "+" add from product cards and rows. A product can be quick-added
 * when every required modifier group already has a valid default; otherwise
 * the caller opens product detail so the customer can choose.
 */
import { router } from 'expo-router';
import { AccessibilityInfo, Platform } from 'react-native';
import { getProductSync, reorderableLines } from '@/api';
import { useFlyToCart, useToast, type WindowRect } from '@/components/motion';
import { haptic } from '@/lib/haptics';
import { buildSnapshots, defaultSelections, validateSelections } from '@/lib/modifiers';
import { useCart, type NewCartLine } from '@/store/cart';
import type { OrderItem, Product } from '@/types/models';
import { sizedPhoto } from './photo';

export type QuickAddResult = 'added' | 'needs_options';

/** The cart line a quick-add would create (defaults applied), or null if the customer must choose. */
export function quickAddLine(product: Product): NewCartLine | null {
  if (!product.isAvailable) return null;
  const full = getProductSync(product.id);
  if (!full) return null;
  const selections = defaultSelections(full.modifierGroups);
  if (!validateSelections(full.modifierGroups, selections).valid) return null;
  return {
    productId: product.id,
    name: product.name,
    image: product.image,
    basePrice: product.price,
    quantity: 1,
    modifiers: buildSnapshots(full.modifierGroups, selections),
  };
}

export function canQuickAdd(product: Product): boolean {
  return quickAddLine(product) !== null;
}

/** Opens product detail (typed-route object form). */
export function openProduct(productId: string) {
  router.push({ pathname: '/product/[id]', params: { id: productId } });
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
/** Safety net: never hold the add back longer than this if no cart target is mounted. */
const FLY_TIMEOUT_MS = 1500;

/**
 * Fly the thumbnail, resolving on landing (or after the safety timeout). The flight uses the
 * same width-bucketed URL `<Photo size={…}>` rendered at the source, so expo-image serves it from
 * memory and the clone never flashes an empty circle. `imageSize` defaults to the source rect's
 * shorter side (equal to the photo size for cards/rows, same bucket for thumbnail stacks).
 */
async function flyThen(
  fly: ReturnType<typeof useFlyToCart>,
  image: string,
  from: WindowRect | null,
  imageSize?: number,
) {
  if (!from) {
    haptic.land(); // no flight → no landing to fire it, so the add lands here
    return;
  }
  const uri = sizedPhoto(image, imageSize ?? Math.min(from.width, from.height));
  await Promise.race([fly({ image: uri, from }).catch(() => undefined), wait(FLY_TIMEOUT_MS)]);
}

/**
 * Returns `quickAdd(product, fromRect, imageSize?)`. The thumbnail flies from `fromRect` to the
 * cart and the line is added as it lands, so the badge pops on arrival. The flight, badge pop,
 * haptic and the "+" → check morph are the confirmation; a toast would slide over the header cart
 * right as it pops, so it is only shown when there was no flight (screen readers get an
 * announcement either way). Pass `imageSize` = the source `<Photo>` size when the rect is not
 * the photo itself.
 */
export function useQuickAdd() {
  const add = useCart((s) => s.add);
  const fly = useFlyToCart();
  const toast = useToast();

  return async (product: Product, from: WindowRect | null, imageSize?: number): Promise<QuickAddResult> => {
    const line = quickAddLine(product);
    if (!line) return 'needs_options';
    await flyThen(fly, product.image, from, imageSize);
    add(line);
    const message = `Added ${product.name}`;
    if (!from) toast(message, { tone: 'success', icon: 'checkmark-circle' });
    else if (Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(message);
    return 'added';
  };
}

/**
 * Returns `reorder(orderItems, fromRect, imageSize?)`: one flight, every still-available line re-added
 * at today's prices, one toast. Sold-out products and lines with an unavailable option are skipped
 * and named in the toast ("Iced Peach Tea is sold out today, so we skipped it").
 */
export function useReorder() {
  const add = useCart((s) => s.add);
  const fly = useFlyToCart();
  const toast = useToast();

  return async (items: OrderItem[], from: WindowRect | null, imageSize?: number): Promise<void> => {
    const { lines, skipped } = reorderableLines(items);
    const first = lines[0];
    if (!first) {
      haptic.error();
      toast(
        skipped.length === 1 ? `${skipped[0]} is sold out today` : 'Those items are sold out today',
        { tone: 'error', icon: 'alert-circle' },
      );
      return;
    }
    await flyThen(fly, first.image, from, imageSize);
    for (const line of lines) add(line);
    const count = lines.reduce((n, i) => n + i.quantity, 0);
    const added = count === 1 ? `Added ${first.name}` : `Added ${count} items to your cart`;
    const note =
      skipped.length === 0
        ? ''
        : skipped.length === 1
          ? ` · ${skipped[0]} is sold out today, so we skipped it`
          : ` · ${skipped.length} sold-out items skipped`;
    toast(`${added}${note}`, { tone: 'success', icon: 'bag-check' });
  };
}
