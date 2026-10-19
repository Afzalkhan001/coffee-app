import { useRef } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArtThumb,
  canQuickAdd,
  prefetchHeroPhoto,
  PRODUCT_ROW_TEXT_INSET,
  PriceText,
  QuickAddButton,
  staggerIndex,
  tintForCategory,
  useFlash,
  useQuickAdd,
} from '@/components/domain';
import { enterUp, exitFade, layoutSpring, measureInWindowAsync, setHeroOrigin } from '@/components/motion';
import { dietLabel, VegMark } from '@/components/domain/VegMark';
import { PressableScale, Text } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { fonts, makeStyles, spacing, useColors } from '@/theme';
import type { Product } from '@/types/models';
import { HighlightText } from './HighlightText';

const THUMB = 64;

export interface SearchResultRowProps {
  product: Product;
  /** Lower-cased search terms to highlight in the name and description. */
  terms: string[];
  index: number;
  /** Opens the product; the art box's window rect is already stored as the hero origin. */
  onOpen: (product: Product) => void;
  /** Inset hairline above the row (every row but the first in the sheet). */
  divider?: boolean;
}

/**
 * R3 search result: a bare row for the results sheet — 64 tinted thumbnail with the cut-out, the
 * diet mark + name (16/600) and the curated tagline with the matched words on a `peachSoft` highlight, price
 * 15/700 and a 36px `bg` "+" with an ink plus (the ink check stays for the added state). No eyebrow, meta or stickers. Keyed by product, so between
 * queries rows that stay put spring to their new slot, new ones rise in and dropped ones fade out.
 */
export function SearchResultRow({ product, terms, index, onOpen, divider = false }: SearchResultRowProps) {
  const c = useColors();
  const styles = useStyles();
  const artRef = useRef<View>(null);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const quickAdd = useQuickAdd();
  const [added, flashAdded] = useFlash();
  const soldOut = !product.isAvailable;
  const label = [product.name, dietLabel(product.diet), formatMoney(product.price), soldOut ? 'sold out' : null].filter(Boolean).join(', ');

  const open = async () => {
    const rect = await measureInWindowAsync(artRef);
    if (rect) setHeroOrigin(product.id, rect);
    onOpen(product);
  };

  const add = async () => {
    if (!canQuickAdd(product)) {
      void open();
      return;
    }
    flashAdded();
    const rect = await measureInWindowAsync(artRef);
    await quickAdd(product, rect);
  };

  return (
    <Animated.View entering={enterUp(staggerIndex(index))} exiting={exitFade} layout={layoutSpring}>
      {divider ? <View style={styles.divider} /> : null}
      <PressableScale
        onPress={open}
        onPressIn={() => prefetchHeroPhoto(product.image, screenWidth, screenHeight, insets.top)}
        activeScale={0.98}
        style={styles.row}
        accessibilityLabel={label}
        accessibilityHint="Opens product details"
      >
        <ArtThumb
          image={product.image}
          size={THUMB}
          tint={tintForCategory(product.categoryId)}
          artRef={artRef}
          artOpacity={soldOut ? 0.45 : 1}
          recyclingKey={product.id}
        />

        <View style={styles.body}>
          <View style={styles.nameRow}>
            {product.diet ? <VegMark diet={product.diet} size={12} decorative /> : null}
            <HighlightText text={product.name} terms={terms} style={styles.name} numberOfLines={1} />
          </View>
          {/* The curated short line, never a clipped description. */}
          {product.tagline ? (
            <HighlightText text={product.tagline} terms={terms} color={c.inkSoft} style={styles.blurb} numberOfLines={1} />
          ) : null}
          <PriceText price={product.price} compareAt={product.compareAtPrice} size={15} style={styles.price} />
        </View>

        {soldOut ? (
          <Text style={styles.soldOut} color={c.inkSoft}>
            Sold out
          </Text>
        ) : (
          <QuickAddButton onPress={add} added={added} size={36} tone="canvas" accessibilityLabel={`Add ${product.name} to cart`} />
        )}
      </PressableScale>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 88,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  divider: {
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: c.line,
    marginLeft: PRODUCT_ROW_TEXT_INSET,
    marginRight: spacing.md,
  },
  body: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  blurb: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  price: { marginTop: 4 },
  soldOut: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
}));
