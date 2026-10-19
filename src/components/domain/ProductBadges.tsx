/**
 * Product tile stickers (DESIGN.md §R3.A7, "Product card"): at most ONE sticker per card, priority
 * Sold out > BEST SELLER > NEW. A sale shows only in the price row, never as a sticker. The
 * rating chip, LOW CAL stamp and SEASONAL sticker no longer render on cards (the exports remain
 * for older call sites and return nothing / a plain pill).
 */
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/ui';
import { fonts, makeStyles, makeThemed, radii, type as typeScale, useColors } from '@/theme';
import type { Product, ProductBadge } from '@/types/models';

/** Badges that still render (R3 data: only caramel-macchiato is BEST SELLER, spanish-latte NEW). */
const STICKERS: Partial<Record<ProductBadge, { label: string; rotate?: string }>> = {
  best_seller: { label: 'Best seller', rotate: '-6deg' },
  new: { label: 'New' },
};

/**
 * Sticker colours. BEST SELLER is ink + peach in light (ember is reserved for one element per
 * screen); in dark an ink-black sticker would vanish on the dark tile, so it turns peach + ink.
 */
const useStickerColors = makeThemed((c, t): Partial<Record<ProductBadge, { bg: string; fg: string }>> => ({
  best_seller: t.isDark ? { bg: c.peach, fg: c.inkFixed } : { bg: c.ink, fg: c.peach },
  new: { bg: c.sageDeep, fg: c.white },
}));

/** The one sticker a product card shows: 'sold_out', a renderable badge, or null. */
export function visibleSticker(product: Pick<Product, 'isAvailable' | 'badge'>): 'sold_out' | ProductBadge | null {
  if (!product.isAvailable) return 'sold_out';
  if (product.badge && STICKERS[product.badge]) return product.badge;
  return null;
}

/** 22px sticker in `micro` type (uppercase by the type token). Renders nothing for SEASONAL. */
export function BadgeSticker({ badge, style }: { badge: ProductBadge; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  const tone = useStickerColors()[badge];
  const meta = STICKERS[badge];
  if (!meta || !tone) return null;
  return (
    <View
      style={[styles.sticker, { backgroundColor: tone.bg }, meta.rotate ? { transform: [{ rotate: meta.rotate }] } : null, style]}
      accessible
      accessibilityLabel={meta.label}
    >
      <Text style={typeScale.micro} color={tone.fg}>
        {meta.label}
      </Text>
    </View>
  );
}

/** @deprecated R3: low-cal lives in search filters and the detail kcal badge, not on cards. Renders nothing. */
export function LowCalStamp(_props: { size?: number; style?: StyleProp<ViewStyle> }) {
  return null;
}

/** @deprecated R3 deleted the rating chip from cards (the rating is a "★ 4.5" text glyph in detail). Renders nothing. */
export function RatingChip(_props: { rating: number; style?: StyleProp<ViewStyle> }) {
  return null;
}

/**
 * Ink "Sold out" pill (24h) for the bottom-left corner of a product tile (inverted in dark). Pair
 * it with `artOpacity={0.45}` on the art and hide the quick add. (R3: no veil over the tile.)
 */
export function SoldOutOverlay({ style }: { radius?: number; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={[styles.soldOut, style]} accessible accessibilityLabel="Sold out">
      <Text style={styles.soldOutText} color={c.onInk}>
        Sold out
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  sticker: {
    height: 22,
    paddingHorizontal: 9,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  soldOut: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    height: 24,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    backgroundColor: c.ink,
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  soldOutText: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 15 },
}));
