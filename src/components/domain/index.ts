/**
 * Domain components (BUILD_CONTRACT.md "src/components/domain/"). Import from '@/components/domain'.
 */
export { Avatar, type AvatarProps } from './Avatar';
export { CartButton, type CartButtonProps } from './CartButton';
export { CategoryChips, type CategoryChipsProps } from './CategoryChips';
export { CATEGORY_TILE, CATEGORY_TILE_PITCH, CategoryTile, type CategoryTileProps } from './CategoryTile';
export { DietaryTags, DIETARY_META, dietaryLine, type DietaryTagsProps } from './DietaryTags';
export { FloatingCartBar, FLOATING_CART_BAR_SPACE, type FloatingCartBarProps } from './FloatingCartBar';
export { MetaChips, metaLine, type MetaChipsProps } from './MetaChips';
export { ModeCards, type ModeCardsProps } from './ModeCards';
export { OrderAgainCard, useLastCompletedOrder, type OrderAgainCardProps } from './OrderAgainCard';
export { ORDER_ROW_TEXT_INSET, OrderHistoryRow, type OrderHistoryRowProps } from './OrderHistoryRow';
export { OrderStatusCard, type OrderStatusCardProps, type OrderStatusCardVariant } from './OrderStatusCard';
export { PointsPill, type PointsPillProps } from './PointsPill';
export { PriceText, type PriceTextProps } from './PriceText';
export {
  COMPACT_SCREEN_HEIGHT,
  ProductCard,
  productArtSize,
  productCardWidth,
  productTileHeight,
  PRODUCT_GRID_GAP,
  PRODUCT_GRID_ROW_GAP,
  type ProductCardProps,
} from './ProductCard';
export { PRODUCT_ROW_TEXT_INSET, ProductRow, type ProductRowProps } from './ProductRow';
export { PROMO_BLEED, PROMO_CARD_HEIGHT, PromoCarousel, type PromoCarouselProps } from './PromoCarousel';
export { QuantityStepper, type QuantityStepperProps } from './QuantityStepper';
export { SearchBarButton, type SearchBarButtonProps } from './SearchBarButton';
export {
  OrderRowSkeleton,
  ProductCardSkeleton,
  ProductGridSkeleton,
  ProductRowSkeleton,
  PromoCarouselSkeleton,
} from './Skeletons';
export { EmptyState, ErrorState, type EmptyArt, type EmptyStateProps, type ErrorStateProps } from './States';
export { StatusTimeline, type StatusTimelineProps } from './StatusTimeline';
export { StoreCard, StoreStatusChip, storeStatusLabel, type StoreCardProps } from './StoreCard';
export { SUMMARY_DOCK_HEIGHT, SummaryCard, type SummaryCardProps } from './SummaryCard';

// Building blocks other screens may reuse.
export { BadgeSticker, LowCalStamp, RatingChip, SoldOutOverlay, visibleSticker } from './ProductBadges';
export {
  ArtCluster,
  ArtStack,
  ArtThumb,
  ArtTile,
  clusterImages,
  ContactShadow,
  ProductArt,
  resolveTileColor,
  tileRadius,
  tintForCategory,
  tintForImage,
  useArtFloat,
  type ArtClusterPiece,
  type ArtClusterProps,
  type ArtFloat,
  type ArtStackProps,
  type ArtTileProps,
  type ContactShadowProps,
  type ContactShadowTone,
  type ProductArtProps,
} from './productArt';
// Legacy (R3 renders these as cut-out tiles / stacks; new code uses the productArt components above).
export { heroPhotoSize, Photo, prefetchHeroPhoto, ThumbStack, sizedPhoto, type PhotoProps, type ThumbStackProps } from './photo';
export { isCutoutPhoto, localPhoto, localPhotoKey, photoSource } from '@/data/mock/photoSource';
export { QuickAddButton, type QuickAddButtonProps } from './QuickAddButton';
export { canQuickAdd, openProduct, quickAddLine, useQuickAdd, useReorder, type QuickAddResult } from './quickAdd';
export { etaLabel, minutesLeft, orderImages, orderItemNames, orderItemsSummary, orderTitle, scheduledReadyLabel } from './orderText';
export { staggerIndex, useFlash, useNow, useValueChange } from './hooks';
