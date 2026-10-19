/** Private components for the G2 browse screens (Home, Menu, Category, Search). */
export { CategoryRail, CategoryRailSkeleton, type CategoryRailProps } from './CategoryRail';
export {
  BellButton,
  CollapsingHomeHeader,
  dayPart,
  GreetingRow,
  HOME_HEADER_HEIGHT,
  HOME_ROW1,
  HOME_ROW2,
  HOME_ROW3,
  LocationButton,
  type CollapsingHomeHeaderProps,
} from './HomeHeader';
export { HomeSection, SectionTitle, type HomeSectionProps, type SectionAction, type SectionTitleProps } from './HomeSection';
export { availableFirst, favoritePicks, freshPicks, popularPicks, promosFor } from './homeData';
export { describeMode, modeNeedsDetails, useModeContext, type ModeContext } from './modeContext';
export { useHasHomeNotifications, useHomeNotifications } from './notifications';
export { HomeInbox, NotificationsPopover, type NotificationItem, type NotificationsPopoverProps } from './NotificationsPopover';
export { gridColumns, ProductGrid, ProductGridSkeletons, useGridCardWidth, type ProductGridProps } from './ProductGrid';
export { PopularRightNow, type PopularRightNowProps } from './PopularRightNow';
export { ProductRail, ProductRailSkeleton, type ProductRailProps } from './ProductRail';
export {
  applyFilter,
  categorySummary,
  expectsFilters,
  PRODUCT_FILTERS,
  usefulFilters,
  type ProductFilter,
  type ProductFilterId,
} from './categoryCopy';
export { MenuChipsSkeleton, MenuSection, MenuSectionSkeleton, type MenuSectionProps } from './MenuSection';
export { useScrollSpy } from './useScrollSpy';
export { CATEGORY_HERO_HEIGHT, CATEGORY_PLANE_GONE, CategoryHero, type CategoryHeroProps } from './CategoryHero';
export { FilterChipsRow, FilterChipsSkeleton, type FilterChipsRowProps } from './FilterChipsRow';
export { FrostedTopBar, type FrostedTopBarProps } from './FrostedTopBar';
export { HighlightText, searchTerms, splitMatches, type HighlightTextProps } from './HighlightText';
export { SearchField, type SearchFieldProps } from './SearchField';
export { SearchResultRow, type SearchResultRowProps } from './SearchResultRow';
export { useKeyboardVisible, useProductSearch } from './searchHooks';
export { VegOnlyToggle, type VegOnlyToggleProps } from './VegOnlyToggle';
export { joinNames, noVegMessage, vegHiddenCategoriesNote, vegHiddenReason } from './vegCopy';
