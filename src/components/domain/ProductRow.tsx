import { useRef } from 'react';
import { StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { enterUp, measureInWindowAsync, setHeroOrigin } from '@/components/motion';
import { PressableScale, Text } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { fonts, makeStyles, spacing, useColors } from '@/theme';
import type { Product } from '@/types/models';
import { staggerIndex, useFlash } from './hooks';
import { prefetchHeroPhoto } from './photo';
import { PriceText } from './PriceText';
import { ArtThumb, tintForCategory } from './productArt';
import { canQuickAdd, useQuickAdd } from './quickAdd';
import { QuickAddButton } from './QuickAddButton';
import { dietLabel, VegMark } from './VegMark';

const THUMB = 64;
const PAD_X = spacing.md;
/** Where a row's text starts: hairlines between rows are inset to here (R3.A10). */
export const PRODUCT_ROW_TEXT_INSET = PAD_X + THUMB + spacing.sm;

export interface ProductRowProps {
  product: Product;
  /** Opens the product. The art box's window rect is registered as hero origin before this runs. */
  onPress: (product: Product) => void;
  /** Position in the list; drives the staggered entrance. */
  index?: number;
  /** Replaces the built-in quick-add when provided. */
  onQuickAdd?: (product: Product) => void;
  /** Draw the inset hairline above this row (every row but the first in a sheet). */
  divider?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * R3 list row for a white sheet (search results, popular lists): 64 tinted thumbnail tile with the
 * cut-out, the diet mark + name 16/600, the curated tagline 13 `inkSoft` (no line without one), price 15/700 and a
 * 36px `bg` "+" with an ink plus (a column of ink dots would break "one ink primary"). No card, no
 * shadow, no stickers or meta; the screen provides the one white sheet around the rows.
 */
export function ProductRow({ product, onPress, index = 0, onQuickAdd, divider = false, style }: ProductRowProps) {
  const artRef = useRef<View>(null);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const quickAdd = useQuickAdd();
  const [added, flashAdded] = useFlash();
  const c = useColors();
  const styles = useStyles();
  const soldOut = !product.isAvailable;
  const label = [product.name, dietLabel(product.diet), formatMoney(product.price), soldOut ? 'sold out' : null].filter(Boolean).join(', ');

  const open = async () => {
    const rect = await measureInWindowAsync(artRef);
    if (rect) setHeroOrigin(product.id, rect);
    onPress(product);
  };

  const add = async () => {
    if (onQuickAdd) {
      onQuickAdd(product);
      return;
    }
    if (!canQuickAdd(product)) {
      void open();
      return;
    }
    flashAdded();
    const rect = await measureInWindowAsync(artRef);
    await quickAdd(product, rect);
  };

  return (
    <Animated.View entering={enterUp(staggerIndex(index))} style={style}>
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
            <Text numberOfLines={1} style={styles.name}>
              {product.name}
            </Text>
          </View>
          {/* A curated short line (never truncated); no line rather than a clipped description. */}
          {product.tagline ? (
            <Text numberOfLines={1} variant="caption" color={c.inkSoft}>
              {product.tagline}
            </Text>
          ) : null}
          <PriceText price={product.price} compareAt={product.compareAtPrice} size={15} style={styles.price} />
        </View>

        {soldOut ? (
          <Text style={styles.soldOut} color={c.inkSoft}>
            Sold out
          </Text>
        ) : (
          <QuickAddButton
            onPress={add}
            added={added}
            size={36}
            tone="canvas"
            accessibilityLabel={`Add ${product.name} to cart`}
          />
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
    paddingHorizontal: PAD_X,
    paddingVertical: spacing.sm,
  },
  divider: { height: StyleSheet.hairlineWidth * 2, backgroundColor: c.line, marginLeft: PRODUCT_ROW_TEXT_INSET, marginRight: PAD_X },
  body: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: c.ink },
  price: { marginTop: 4 },
  soldOut: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
}));
