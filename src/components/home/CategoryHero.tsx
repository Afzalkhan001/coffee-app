import { useIsFocused } from 'expo-router';
import { useRef } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';
import { categoryImage } from '@/api';
import { ProductArt } from '@/components/domain';
import { enterFade, enterUp, Skeleton } from '@/components/motion';
import { useTilt } from '@/components/product/useTilt';
import { Text } from '@/components/ui';
import { fonts, makeStyles, radii, useColors, useTheme } from '@/theme';
import type { Category, Product } from '@/types/models';
import { categorySummary } from './categoryCopy';

/** Hero plane height below the safe area (R3: safeTop + 236). */
export const CATEGORY_HERO_HEIGHT = 236;
const OVERSCROLL_FILL = 800;
/** Signature cut-out: 190px, right −36 (bleeds off the screen edge), bottom −8 (stands on the plane's edge). */
const ART = 190;
const ART_RIGHT = -36;
const ART_BOTTOM = -8;
/** Tilt-to-move: a quieter echo of the product hero (px at full tilt; no turn, the shadow rides along). */
const TILT_X = 6;
const TILT_Y = 3;
const TITLE_TOP = 76;
const TITLE_LEFT = 24;
/** The compact top bar's height below the safe area (FrostedTopBar). */
const TOP_BAR = 60;
/** Scroll offset at which the plane's bottom edge reaches the top bar. */
export const CATEGORY_PLANE_GONE = CATEGORY_HERO_HEIGHT - TOP_BAR;

export interface CategoryHeroProps {
  category: Category;
  /** Undefined while the menu loads. */
  products: Product[] | undefined;
  scrollY: SharedValue<number>;
  topInset: number;
  /** Cut-out override (Category passes a veg item's while "Veg only" hides the signature item). */
  image?: string;
  /** Caption override ("1 veg item · from ₹420" while "Veg only" narrows the list). */
  caption?: string;
}

/**
 * R3 category hero: a flat `heroTints` plane (bottom radius 32) with the sentence-case title
 * (700 34/40), "8 drinks · from ₹160", and the category's signature cut-out (190px, floating)
 * bleeding off the right edge and breaking the plane's bottom edge by 8pt. The art is a sibling of
 * the clipped plane (only the screen clips it), so its saucer is never sliced by the rounded corner.
 * Scrolling slides the copy at a slower rate and fades it, the art fades out by 96pt, and the
 * emptied plane dissolves into the canvas before it reaches the top bar (no tinted sliver under
 * the compact header). Pulling down on iOS reveals more tint (never cream) and scales the art up.
 * Tipping the phone drifts the cut-out a few px (`useTilt`; the mouse on web). Parallax and tilt are
 * off under Reduce Motion.
 */
export function CategoryHero({ category, products, scrollY, topInset, image: imageOverride, caption }: CategoryHeroProps) {
  const theme = useTheme();
  const c = useColors();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const focused = useIsFocused();
  const { width } = useWindowDimensions();
  const tint = theme.heroTints[category.tint];
  const image = imageOverride ?? categoryImage(category.id);
  const height = topInset + CATEGORY_HERO_HEIGHT;
  const artRef = useRef<View>(null);
  const tilt = useTilt(focused && !!image, artRef);
  // The title keeps clear of the art's left edge.
  const titleWidth = width - TITLE_LEFT - (ART + ART_RIGHT) - 8;

  const contentStyle = useAnimatedStyle(() => {
    const y = scrollY.get();
    return {
      // Gone before it slides under the top bar, where the small centred title takes over (70 → 130).
      opacity: interpolate(y, [0, 70], [1, 0], Extrapolation.CLAMP),
      transform: [{ translateY: reduced ? 0 : Math.max(0, y) * 0.4 }],
    };
  });
  const artStyle = useAnimatedStyle(() => {
    const y = scrollY.get();
    return {
      // Gone by 96, riding with the plane (it overhangs the chips, so it never lags down over them,
      // and it's faded before it reaches the top bar's circles).
      opacity: interpolate(y, [8, 96], [1, 0], Extrapolation.CLAMP),
      transform: [{ scale: reduced ? 1 : interpolate(y, [-140, 0, 96], [1.1, 1, 0.94], Extrapolation.CLAMP) }],
    };
  });
  const tiltStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tilt.x.get() * TILT_X }, { translateY: -tilt.y.get() * TILT_Y }],
  }));
  // The emptied plane dissolves into the canvas before its bottom edge reaches the top bar.
  const dissolveStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [CATEGORY_PLANE_GONE - 86, CATEGORY_PLANE_GONE - 26], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={{ height }}>
      <View style={[styles.overscroll, { backgroundColor: tint }]} />
      <View style={[styles.band, { backgroundColor: tint, height }]}>
        <Animated.View style={[styles.copy, { top: topInset + TITLE_TOP, width: titleWidth }, contentStyle]}>
          <Animated.View entering={enterUp(0)}>
            <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
              {category.name}
            </Text>
          </Animated.View>
          <Animated.View entering={enterUp(1)} style={styles.captionWrap}>
            {products ? (
              <Text style={styles.caption} color={c.inkSoft} numberOfLines={1}>
                {caption ?? categorySummary(category, products)}
              </Text>
            ) : (
              <Skeleton width={150} height={14} radius={7} style={styles.captionSkeleton} />
            )}
          </Animated.View>
        </Animated.View>
        <Animated.View style={[styles.dissolve, dissolveStyle]} />
      </View>
      {/*
        Outside the clipped plane: the cut-out stands on the plane's bottom edge and overhangs it by
        8pt (its contact shadow straddles the edge); only the screen clips its right bleed.
      */}
      {image ? (
        <Animated.View
          entering={enterFade(1)}
          style={styles.art}
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Animated.View style={artStyle}>
            <Animated.View style={tiltStyle}>
              <ProductArt ref={artRef} image={image} size={ART} shadow="hero" float floatActive={focused} priority="high" eager />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  overscroll: { position: 'absolute', left: 0, right: 0, top: -OVERSCROLL_FILL, height: OVERSCROLL_FILL },
  band: {
    borderBottomLeftRadius: radii.sheet,
    borderBottomRightRadius: radii.sheet,
    // Clips the parallaxing copy so it never slides out over the content below.
    overflow: 'hidden',
  },
  copy: { position: 'absolute', left: TITLE_LEFT },
  dissolve: { ...StyleSheet.absoluteFill, backgroundColor: c.bg, pointerEvents: 'none' },
  title: { fontFamily: fonts.bold, fontSize: 34, lineHeight: 40, letterSpacing: -0.4, color: c.ink },
  captionWrap: { marginTop: 6 },
  caption: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  captionSkeleton: { marginTop: 3 },
  art: { position: 'absolute', right: ART_RIGHT, bottom: ART_BOTTOM, width: ART, height: ART, pointerEvents: 'none' },
}));
