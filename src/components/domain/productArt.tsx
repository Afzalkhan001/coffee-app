/**
 * R3 product art (DESIGN.md §R3.A4): every product image is a transparent cut-out floating on a
 * tinted plane with a soft contact shadow. No circular crops, no rings.
 *
 *  - `ContactShadow`: the SVG radial-gradient pool a cut-out stands on.
 *  - `ProductArt`: a `size × size` art box — contact shadow + `contentFit="contain"` cut-out.
 *    Non-cut-outs (remote URLs, scenes) fall back to a `cover` image in a rounded square
 *    (radius = size × 0.22), never a circle.
 *  - `ArtTile`: the tinted rounded square holding a `ProductArt` (grid cards, category tiles, list
 *    thumbnails). `ArtThumb` is the 64px list-thumbnail preset.
 *  - `ArtCluster` / `ArtStack`: overlapping cut-outs, at most 3, no rings, no "+N" bubble.
 *  - `useArtFloat`: the idle float (translateY 0 → −5 → 0 over 3.6s + ±1.2°) whose same clock
 *    tightens the contact shadow as the art lifts. Off under Reduce Motion.
 *
 * Image strings resolve through `photoSource()` (`local:<key>` bundled cut-outs, legacy Unsplash
 * URLs mapped onto them, any other http(s) URL) and render the same on iOS, Android and web.
 */
import { Image, type ImageProps } from 'expo-image';
import { useEffect, useId, type ReactNode, type Ref } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type AnimatedStyle,
  type EntryExitAnimationFunction,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { CATEGORIES, PRODUCTS } from '@/data/mock/menu';
import { artPlacementTransform } from '@/data/mock/photoMetrics';
import { isCutoutPhoto, localPhotoKey, photoSource } from '@/data/mock/photoSource';
import { lightTileTints, radii, useTheme, type HeroTint } from '@/theme';
import type { EntryAnimation, ExitAnimation } from '@/components/motion';

// ── Tints ────────────────────────────────────────────────────────────────────

const CATEGORY_TINT: Readonly<Record<string, HeroTint>> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.tint]));

/** Bundled photo key → its product's category tint (so a bare image string knows its plane). */
let imageTints: Map<string, HeroTint> | null = null;
function imageTintMap(): Map<string, HeroTint> {
  if (!imageTints) {
    imageTints = new Map();
    for (const p of PRODUCTS) {
      const key = localPhotoKey(p.image);
      const tint = CATEGORY_TINT[p.categoryId];
      if (key && tint && !imageTints.has(key)) imageTints.set(key, tint);
    }
  }
  return imageTints;
}

/** Tint key for a category id (`'bakery'` → `'snacks'`); `'coffee'` when unknown. */
export function tintForCategory(categoryId: string | null | undefined): HeroTint {
  return (categoryId ? CATEGORY_TINT[categoryId] : undefined) ?? 'coffee';
}

/** Tint key for an image string, from the product that uses it; `'coffee'` when unknown. */
export function tintForImage(image: string | null | undefined): HeroTint {
  const key = localPhotoKey(image);
  return (key ? imageTintMap().get(key) : undefined) ?? 'coffee';
}

/**
 * A tile colour: a tint key (`'cold'`) resolves through `tints` (pass `useTheme().tileTints`; the
 * light set by default); anything else is used as a colour.
 */
export function resolveTileColor(tint: HeroTint | string, tints: Readonly<Record<HeroTint, string>> = lightTileTints): string {
  return tint in tints ? tints[tint as HeroTint] : tint;
}

// ── Contact shadow ───────────────────────────────────────────────────────────

/**
 * `light`: tiles (centre alpha 0.26) · `hero`: hero planes (0.30) · `dark`: a black pool on `night`
 * (0.55) · a number: custom espresso alpha. In the dark scheme the pool is black and deeper
 * (`theme.contact`: 0.50 / 0.55, numbers ×1.9), because an espresso pool vanishes on a dark tile.
 */
export type ContactShadowTone = 'light' | 'hero' | 'dark' | number;


export interface ContactShadowProps {
  /** The art box size the shadow belongs to. */
  box: number;
  tone?: ContactShadowTone;
  /** Ellipse width as a fraction of the box (spec 0.62; the product hero uses 0.66). */
  widthRatio?: number;
  /** Float coupling (scaleX / opacity) from `useArtFloat().shadowStyle`. */
  animatedStyle?: AnimatedStyle<ViewStyle>;
  style?: StyleProp<ViewStyle>;
}

/**
 * Soft elliptical pool under a cut-out (R3.A3 "contact"): an SVG radial gradient, width 62% of the
 * art box, height max(8, 7.5%), centred at 95.5% of the box height. Absolutely positioned inside
 * the art box; render it before the image.
 */
export function ContactShadow({ box, tone = 'light', widthRatio = 0.62, animatedStyle, style }: ContactShadowProps) {
  const rawId = useId();
  const { colors: c, contact } = useTheme();
  const id = `cs${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const w = Math.round(box * widthRatio);
  const h = Math.max(8, Math.round(box * 0.075));
  const alpha = typeof tone === 'number' ? Math.min(0.6, tone * contact.scale) : contact[tone];
  const color = tone === 'dark' ? c.black : contact.color;
  return (
    <Animated.View
      style={[
        styles.shadow,
        { width: w, height: h, left: (box - w) / 2, top: Math.round(box * 0.955 - h / 2) },
        animatedStyle,
        style,
      ]}
    >
      <Svg width={w} height={h}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%" fx="50%" fy="50%">
            <Stop offset="0" stopColor={color} stopOpacity={alpha} />
            <Stop offset="0.45" stopColor={color} stopOpacity={alpha * 0.62} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

// ── Float ────────────────────────────────────────────────────────────────────

const FLOAT_MS = 3600;
const FLOAT_LIFT = 5;
const FLOAT_TILT = 1.2;

export interface ArtFloat {
  /** translateY + rotate for the art. */
  artStyle: AnimatedStyle<ViewStyle>;
  /** scaleX 1 → 0.92, opacity 1 → 0.75 for the contact shadow, in step with the lift. */
  shadowStyle: AnimatedStyle<ViewStyle>;
}

/**
 * Cut-out idle float (R3.C1): translateY 0 → −5 → 0 over 3.6s as a sine loop, plus ±1.2° rotation;
 * the same clock tightens the contact shadow. `phase` offsets the loop in seconds (the confirmation
 * cluster uses 0 / 0.4 / 0.8). `active=false` (screen covered, slide off-centre) eases back to rest.
 * Off under Reduce Motion. Not for grid cards.
 */
export function useArtFloat(phase = 0, active = true): ArtFloat {
  const reduced = useReducedMotion();
  const clock = useSharedValue(0);
  const amp = useSharedValue(0);
  const on = active && !reduced;
  const offset = (phase * 1000) / FLOAT_MS;

  useEffect(() => {
    amp.set(withTiming(on ? 1 : 0, { duration: on ? 900 : 420, easing: Easing.inOut(Easing.sin) }));
    if (!on) return;
    clock.set(0);
    clock.set(withRepeat(withTiming(1, { duration: FLOAT_MS, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(clock);
  }, [on, clock, amp]);

  const artStyle = useAnimatedStyle(() => {
    const a = 2 * Math.PI * (clock.get() + offset);
    const k = amp.get();
    const l = ((1 - Math.cos(a)) / 2) * k;
    return { transform: [{ translateY: -FLOAT_LIFT * l }, { rotate: `${FLOAT_TILT * Math.sin(a) * k}deg` }] };
  });

  const shadowStyle = useAnimatedStyle(() => {
    const a = 2 * Math.PI * (clock.get() + offset);
    const l = ((1 - Math.cos(a)) / 2) * amp.get();
    return { opacity: 1 - 0.25 * l, transform: [{ scaleX: 1 - 0.08 * l }] };
  });

  return { artStyle, shadowStyle };
}

// ── ProductArt ───────────────────────────────────────────────────────────────

export interface ProductArtProps {
  image: string | null | undefined;
  /** The art box (square). */
  size: number;
  /** Contact shadow tone; false for none (the shadow is skipped for non-cut-outs anyway). */
  shadow?: ContactShadowTone | false;
  /** Contact shadow width ratio (0.62; product hero 0.66). */
  shadowWidth?: number;
  /** Idle float (hero, category hero, active promo, confirmation). Never on grid cards. */
  float?: boolean;
  /** Float phase offset in seconds. */
  floatPhase?: number;
  /** Pause the float (eases back to rest). Default true. */
  floatActive?: boolean;
  /** Opacity of the cut-out only (sold out = 0.45); the shadow fades with it. */
  artOpacity?: number;
  /** expo-image cross-fade (ms). Default 250; pass 0 for clones that must match their source. */
  transition?: number;
  priority?: ImageProps['priority'];
  recyclingKey?: string;
  /** Web: load immediately instead of lazily (above-the-fold art). */
  eager?: boolean;
  onLoad?: () => void;
  /** Attached to the art box: measure it for the hero hand-off and fly-to-cart. */
  ref?: Ref<View>;
  style?: StyleProp<ViewStyle>;
}

/**
 * A `size × size` art box: `ContactShadow`, then the cut-out with `contentFit="contain"`. The box is
 * what screens measure (hero origin, fly-to-cart source). Remote or scene images fall back to a
 * `cover` image in a rounded square (radius = size × 0.22).
 */
export function ProductArt(props: ProductArtProps) {
  if (props.float) return <FloatingArt {...props} />;
  return <ArtBox {...props} />;
}

function FloatingArt(props: ProductArtProps) {
  const { artStyle, shadowStyle } = useArtFloat(props.floatPhase ?? 0, props.floatActive ?? true);
  return <ArtBox {...props} artStyle={artStyle} shadowStyle={shadowStyle} />;
}

function ArtBox({
  image,
  size,
  shadow = 'light',
  shadowWidth,
  artOpacity = 1,
  transition = 250,
  priority = 'normal',
  recyclingKey,
  eager,
  onLoad,
  ref,
  style,
  artStyle,
  shadowStyle,
}: ProductArtProps & { artStyle?: AnimatedStyle<ViewStyle>; shadowStyle?: AnimatedStyle<ViewStyle> }) {
  const c = useTheme().colors;
  const cutout = isCutoutPhoto(image);
  const source = photoSource(image);
  if (!cutout) {
    const radius = Math.round(size * 0.22);
    return (
      <View ref={ref} collapsable={false} style={[{ width: size, height: size }, style]}>
        <Image
          source={source}
          contentFit="cover"
          transition={transition}
          cachePolicy="memory-disk"
          recyclingKey={recyclingKey}
          priority={priority}
          loading={eager ? 'eager' : 'lazy'}
          onLoad={onLoad}
          style={{ width: size, height: size, borderRadius: radius, backgroundColor: c.surfaceAlt, opacity: artOpacity }}
          accessibilityIgnoresInvertColors
        />
      </View>
    );
  }
  return (
    <View ref={ref} collapsable={false} style={[{ width: size, height: size }, style]}>
      {shadow !== false ? (
        <ContactShadow
          box={size}
          tone={shadow}
          widthRatio={shadowWidth}
          animatedStyle={shadowStyle}
          style={artOpacity < 1 ? { opacity: Math.max(0.3, artOpacity) } : undefined}
        />
      ) : null}
      <Animated.View style={[StyleSheet.absoluteFill, artStyle]}>
        {/* Seats the subject's footprint on the shadow and evens the set's scale (photoMetrics). */}
        <Image
          source={source}
          contentFit="contain"
          transition={transition}
          cachePolicy="memory-disk"
          recyclingKey={recyclingKey}
          priority={priority}
          loading={eager ? 'eager' : 'lazy'}
          onLoad={onLoad}
          style={[StyleSheet.absoluteFill, artPlacementTransform(image, size), artOpacity < 1 ? { opacity: artOpacity } : null]}
          accessibilityIgnoresInvertColors
        />
      </Animated.View>
    </View>
  );
}

// ── ArtTile ──────────────────────────────────────────────────────────────────

export interface ArtTileProps {
  image: string | null | undefined;
  /** Tint key (`'coffee'`, `'cold'`…) or a colour. Default: the image's product category tint. */
  tint?: HeroTint | string;
  width: number;
  /** Default = width (square). */
  height?: number;
  /** Corner radius. Default `radii.tile` (28) for ≥140px tiles, 22 / 20 / 16 for smaller ones. */
  radius?: number;
  /** Art box size. Default 0.81 × width for big tiles, 0.906 × width for thumbnails. */
  artSize?: number;
  /** Distance from the tile bottom to the art box bottom. Default: centred. */
  artBottom?: number;
  shadow?: ContactShadowTone | false;
  artOpacity?: number;
  priority?: ImageProps['priority'];
  recyclingKey?: string;
  eager?: boolean;
  /** Attached to the art box (not the tile): the hero origin / fly-to-cart source. */
  artRef?: Ref<View>;
  /** Overlays inside the tile (stickers, quick add, sold-out pill). */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Default radius for a tile of a given width (R3.A2). */
export function tileRadius(width: number): number {
  if (width >= 140) return radii.tile;
  if (width >= 64) return width >= 72 ? radii.category : radii.thumb;
  return width > 56 ? radii.thumb : radii.thumbSmall;
}

/** A tinted rounded square with a cut-out standing in it (no white card, no boxShadow). */
export function ArtTile({
  image,
  tint,
  width,
  height: heightProp,
  radius: radiusProp,
  artSize: artProp,
  artBottom,
  shadow = 'light',
  artOpacity,
  priority,
  recyclingKey,
  eager,
  artRef,
  children,
  style,
}: ArtTileProps) {
  const height = heightProp ?? width;
  const radius = radiusProp ?? tileRadius(width);
  const art = artProp ?? Math.round(width >= 120 ? width * 0.81 : width * 0.906);
  const bottom = artBottom ?? (height - art) / 2;
  const { tileTints } = useTheme();
  const bg = resolveTileColor(tint ?? tintForImage(image), tileTints);
  return (
    <View style={[{ width, height, borderRadius: radius, backgroundColor: bg }, style]}>
      <ProductArt
        ref={artRef}
        image={image}
        size={art}
        shadow={shadow}
        artOpacity={artOpacity}
        priority={priority}
        recyclingKey={recyclingKey}
        eager={eager}
        style={[styles.tileArt, { left: (width - art) / 2, top: height - bottom - art }]}
      />
      {children}
    </View>
  );
}

/** List thumbnail preset (cart, search results, past orders, rewards, checkout lines): 64 / r20 / art 58. */
export function ArtThumb({
  image,
  size = 64,
  tint,
  artRef,
  artOpacity,
  recyclingKey,
  style,
}: {
  image: string | null | undefined;
  size?: number;
  tint?: HeroTint | string;
  artRef?: Ref<View>;
  artOpacity?: number;
  recyclingKey?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <ArtTile
      image={image}
      tint={tint}
      width={size}
      artSize={Math.round(size * 0.906)}
      artRef={artRef}
      artOpacity={artOpacity}
      recyclingKey={recyclingKey}
      style={style}
    />
  );
}

// ── Clusters ─────────────────────────────────────────────────────────────────

/** Unique images, first occurrence kept, at most `max` (a cluster never shows a "+N" bubble). */
export function clusterImages(images: readonly (string | null | undefined)[], max = 3): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const img of images) {
    if (!img) continue;
    const key = localPhotoKey(img) ?? img;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(img);
    if (out.length >= max) break;
  }
  return out;
}

export interface ArtClusterPiece {
  /** Art box size. */
  size: number;
  /** Left / top of the art box inside the cluster (negative / past the edge to bleed). */
  x: number;
  y: number;
  /** Degrees. */
  rotate?: number;
  /** Stacking order (higher is in front). Default: earlier pieces in front. */
  z?: number;
}

export interface ArtClusterProps {
  images: readonly (string | null | undefined)[];
  /** Placement of piece 0, 1, 2 (pieces beyond the layout are dropped). */
  layout: readonly ArtClusterPiece[];
  shadow?: ContactShadowTone | false;
  /** Idle float with 0.4s phase offsets (confirmation). */
  float?: boolean;
  floatActive?: boolean;
  /** Per-piece entering (e.g. `popIn(i)`, staggered). */
  entering?: (index: number) => EntryAnimation | EntryExitAnimationFunction;
  exiting?: ExitAnimation | EntryExitAnimationFunction;
  style?: StyleProp<ViewStyle>;
  /** Measure the cluster (fly-to-cart source for reorders). */
  ref?: Ref<View>;
}

/**
 * Overlapping cut-outs (peach total card, order cards, checkout, confirmation): absolutely placed
 * art boxes with no rings and no "+N" bubble. Pieces are keyed by image, so removing a line exits
 * its piece while the others keep their identity.
 */
export function ArtCluster({ images, layout, shadow = 'light', float, floatActive, entering, exiting, style, ref }: ArtClusterProps) {
  const shown = clusterImages(images, Math.min(3, layout.length));
  return (
    <View ref={ref} collapsable={false} style={[styles.noTouch, style]} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {shown.map((img, i) => {
        const piece = layout[i];
        if (!piece) return null;
        return (
          <Animated.View
            key={localPhotoKey(img) ?? img}
            entering={entering?.(i)}
            exiting={exiting}
            style={[
              styles.piece,
              { left: piece.x, top: piece.y, width: piece.size, height: piece.size, zIndex: piece.z ?? shown.length - i },
            ]}
          >
            {/* Rotation on an inner view: entering/exiting animate the outer transform. */}
            <View style={piece.rotate ? { transform: [{ rotate: `${piece.rotate}deg` }] } : null}>
              <ProductArt image={img} size={piece.size} shadow={shadow} float={float} floatPhase={i * 0.4} floatActive={floatActive} />
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

export interface ArtStackProps {
  images: readonly (string | null | undefined)[];
  /** Art box per piece. Default 44. */
  size?: number;
  /** Maximum pieces (≤ 3). Default 2. */
  max?: number;
  /** Horizontal overlap in px. Default 36% of `size`. */
  overlap?: number;
  shadow?: ContactShadowTone | false;
  ref?: Ref<View>;
  style?: StyleProp<ViewStyle>;
}

/** A row of overlapping cut-outs (order cards "2 × 64, overlap 22", checkout "2 × 36"): the first is in front. */
export function ArtStack({ images, size = 44, max = 2, overlap: overlapProp, shadow = 'light', ref, style }: ArtStackProps) {
  const shown = clusterImages(images, Math.min(3, max));
  const overlap = overlapProp ?? Math.round(size * 0.36);
  const step = size - overlap;
  const width = shown.length === 0 ? 0 : size + step * (shown.length - 1);
  return (
    <View
      ref={ref}
      collapsable={false}
      style={[{ width, height: size }, style]}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {shown.map((img, i) => (
        <ProductArt
          key={localPhotoKey(img) ?? img}
          image={img}
          size={size}
          shadow={shadow}
          style={[styles.piece, { left: i * step, top: 0, zIndex: shown.length - i }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { position: 'absolute', pointerEvents: 'none' },
  noTouch: { pointerEvents: 'none' },
  tileArt: { position: 'absolute' },
  piece: { position: 'absolute' },
});
