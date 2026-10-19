/** Motion kit — DESIGN.md §7. Import from '@/components/motion'. */
export {
  OverlayHost,
  useToast,
  useFlyToCart,
  CartTarget,
  type CartTargetProps,
  type ToastOptions,
  type ToastFn,
  type ToastTone,
  type FlyToCartArgs,
  type FlyToCartFn,
} from './OverlayHost';
export { measureInWindowAsync, type WindowRect } from './measure';
export { RollingNumber, type RollingNumberProps } from './RollingNumber';
export {
  LineArt,
  LineArtField,
  type LineArtName,
  type LineArtProps,
  type LineArtFieldProps,
  type LineArtFieldVariant,
} from './LineArt';
export { WavyCapsule, type WavyCapsuleProps } from './WavyCapsule';
export { ArcArrowButton, type ArcArrowButtonProps } from './ArcArrowButton';
export { PageDots, type PageDotsProps } from './PageDots';
export { Skeleton, type SkeletonProps } from './Skeleton';
export { ConfettiBurst, type ConfettiBurstProps } from './Confetti';
export { PulseRing, type PulseRingProps } from './PulseRing';
export { AnimatedCheck, type AnimatedCheckProps } from './AnimatedCheck';
export { MorphPayButton, type MorphPayButtonProps, type MorphPayButtonState } from './MorphPayButton';
export { setHeroOrigin, takeHeroOrigin } from './heroTransition';
export {
  useShake,
  usePop,
  shakeValue,
  enterUp,
  riseEntrance,
  enterFade,
  popIn,
  exitFade,
  layoutSpring,
  easeOutQuint,
  easeInOutCubic,
  fadeTiming,
  reducedMotionAtLaunch,
  MAX_STAGGERED,
  type EntryAnimation,
  type ExitAnimation,
  type LayoutTransition,
} from './hooks';
export { withAlpha, boxShadows } from './color';
export { AnimatedBlurView, FrostedLayer, FROSTED_EDGE, type FrostedLayerProps } from './FrostedLayer';
