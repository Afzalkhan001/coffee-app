/**
 * The product cut-out standing on its plate in the hero (DESIGN.md §R3.B product detail, R3.C).
 *  - Card → hero hand-off: the landing rect (`target`, the art box) is known synchronously from the
 *    layout, so the very first painted frame already shows the bare cut-out sitting on the card's
 *    stored art-box rect; it then springs home (`gentle`, no overshoot). A UI-thread measure of an
 *    untransformed anchor only corrects the start if the real rect differs by more than 1px. No
 *    stored rect (deep link, edit from cart) → a soft scale/fade in.
 *  - The plate (a thin ink ellipse) and the contact shadow settle in as the cut-out lands.
 *  - Size scale (S 0.9 / M 1 / L 1.08) scales art, plate, shadow and kcal badge as one group about
 *    the art box's bottom centre, so the plate stays seated in the sheet's notch; `pulse` dips it as
 *    the cut-out lifts off to the cart.
 *  - Idle float (R3.C1, `useArtFloat`): the cut-out lifts 5px and sways ±1.2° while its shadow
 *    tightens; paused while the screen is covered and under Reduce Motion.
 *  - Tilt-to-move (`useTilt`): tipping the phone shifts the cut-out up to 10px toward the edge that
 *    moved away and turns it up to 3° back toward the eye (a perspective counter-rotation), while the
 *    contact shadow slides the other way, so the art reads as lifted off its plate. The plate stays
 *    put. It recentres on the holding angle within a few seconds; web follows the mouse instead.
 *    The shift sits OUTSIDE the measured art box (fly-to-cart starts exactly where the art is drawn)
 *    and the 3D turn inside it (a perspective transform never distorts the measured rect).
 *  - Kcal badge: the screen's one ember element, hugging the subject's top-right (see BADGE_*).
 *  - Sold out: the cut-out at 45% with an ink "Sold out today" pill.
 */
import { Image } from 'expo-image';
import { useIsFocused } from 'expo-router';
import { useEffect, useRef, type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  measure,
  ReduceMotion,
  useAnimatedRef,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Ellipse } from 'react-native-svg';
import { scheduleOnUI } from 'react-native-worklets';
import { easeOutQuint, withAlpha, type WindowRect } from '@/components/motion';
import { Text } from '@/components/ui';
import { ContactShadow, useArtFloat } from '@/components/domain/productArt';
import { isCutoutPhoto, photoSource } from '@/data/mock/photoSource';
import { fonts, makeStyles, radii, springs, useColors } from '@/theme';
import { artPlacementTransform, subjectRight, subjectTop } from './artMetrics';
import { KcalBadge, KCAL_BADGE_SIZE } from './KcalBadge';
import { useTilt } from './useTilt';

/** Tilt-to-move: art shift (px) and turn (deg) at full tilt, the shadow's counter-shift (px). */
const TILT_SHIFT = 10;
const TILT_TURN = 3;
const TILT_SHADOW_SHIFT = 4;
/** The badge sits a touch nearer the eye than the cup, so it travels a little further. */
const TILT_BADGE_DEPTH = 1.25;
const TILT_PERSPECTIVE = 700;

/**
 * Kcal badge centre: anchored to the subject, not the empty corner of its art box — at most 26 in
 * from the box's right edge (R3), at most 22 past the subject's right edge (tall glasses), and 34
 * below the subject's top (a croissant's top sits far below its box top).
 */
const BADGE_FROM_RIGHT = 26;
const BADGE_PAST_SUBJECT = 22;
const BADGE_BELOW_TOP = 34;
const BADGE_TILT = '-10deg';
/** Plate: rx = art × 0.45, ry = art × 0.078, centred at the box bottom − art × 0.05. */
const PLATE_RX = 0.45;
const PLATE_RY = 0.078;
const PLATE_LIFT = 0.05;
const PLATE_STROKE = 1.5;

interface FlightDelta {
  dx: number;
  dy: number;
  scale: number;
}

/** Transform that puts a `to`-sized box (centred on `to`) over the `from` rect. */
function deltaFor(from: WindowRect, to: WindowRect): FlightDelta {
  return {
    dx: from.x + from.width / 2 - (to.x + to.width / 2),
    dy: from.y + from.height / 2 - (to.y + to.height / 2),
    scale: Math.min(from.width, from.height) / Math.max(1, to.width),
  };
}

const IDENTITY: FlightDelta = { dx: 0, dy: 0, scale: 1 };

export interface HeroImageProps {
  /** Product image (a `local:` cut-out, or a remote photo shown as a rounded square). */
  uri: string;
  /** The card's (already cached) image, shown until the hero one arrives (remote photos only). */
  placeholderUri?: string;
  /** The art box (square). */
  size: number;
  /** Where the art box rests, in window coordinates (from the product layout). */
  target: WindowRect;
  /** The card's art-box rect in window coordinates (from `takeHeroOrigin`). */
  origin?: WindowRect;
  /** Spring-driven size scale (S/M/L). */
  sizeScale: SharedValue<number>;
  /** Brief press-down multiplier (1 at rest), e.g. as the cut-out lifts off to the cart. */
  pulse: SharedValue<number>;
  /** Live kcal estimate for the badge; omitted → no badge. */
  kcal?: number;
  soldOut?: boolean;
  /** Attached to the art box: the fly-to-cart source. */
  photoRef: RefObject<View | null>;
  onLoad?: () => void;
}

export function HeroImage({
  uri,
  placeholderUri,
  size,
  target,
  origin,
  sizeScale,
  pulse,
  kcal,
  soldOut = false,
  photoRef,
  onLoad,
}: HeroImageProps) {
  const c = useColors();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const focused = useIsFocused();
  const flying = !!origin && !reduced;
  const anchorRef = useAnimatedRef<Animated.View>();
  const corrected = useRef(false);
  const cutout = isCutoutPhoto(uri);
  const { artStyle: floatStyle, shadowStyle: floatShadow } = useArtFloat(0, focused && !soldOut);
  const tilt = useTilt(focused && !soldOut, photoRef);

  // Seeded synchronously: frame 0 already paints the cut-out on the card rect (no blank first frame).
  const progress = useSharedValue(flying ? 0 : 1); // 0 = sitting on the card rect, 1 = home
  const delta = useSharedValue<FlightDelta>(flying && origin ? deltaFor(origin, target) : IDENTITY);
  const visible = useSharedValue(flying ? 1 : 0);
  const intro = useSharedValue(flying ? 1 : 0); // no-origin entrance: scale 0.9 → 1

  useEffect(() => {
    if (flying) {
      progress.set(withSpring(1, springs.gentle));
      return;
    }
    visible.set(withTiming(1, { duration: reduced ? 160 : 280, easing: easeOutQuint, reduceMotion: ReduceMotion.Never }));
    intro.set(withSpring(1, springs.gentle));
    // Runs once: `flying` comes from the first render's origin and never changes for this screen.
  }, [flying, reduced, progress, visible, intro]);

  /** Correction only: if the real resting rect differs from the layout's, re-aim the start. */
  const handleLayout = () => {
    if (corrected.current || !flying || !origin) return;
    corrected.current = true;
    const from = origin;
    const expected = target;
    scheduleOnUI(() => {
      'worklet';
      const to = measure(anchorRef);
      if (to === null || to.width === 0) return;
      const off =
        Math.abs(to.pageX - expected.x) > 1 ||
        Math.abs(to.pageY - expected.y) > 1 ||
        Math.abs(to.width - expected.width) > 1;
      if (!off) return;
      delta.set({
        dx: from.x + from.width / 2 - (to.pageX + to.width / 2),
        dy: from.y + from.height / 2 - (to.pageY + to.height / 2),
        scale: Math.min(from.width, from.height) / Math.max(1, to.width),
      });
    });
  };

  const frameStyle = useAnimatedStyle(() => {
    const p = progress.get();
    const d = delta.get();
    const flightScale = d.scale + (1 - d.scale) * p;
    return {
      opacity: visible.get(),
      transform: [
        { translateX: d.dx * (1 - p) },
        { translateY: d.dy * (1 - p) },
        { scale: flightScale * (0.9 + 0.1 * intro.get()) },
      ],
    };
  });

  // R3.C2: art, plate, shadow and badge scale as one group about the art box's bottom centre.
  const seatStyle = useAnimatedStyle(() => {
    const s = sizeScale.get() * pulse.get();
    return { transform: [{ translateY: ((1 - s) * size) / 2 }, { scale: s }] };
  });

  // The plate and the shadow settle in under the cut-out as it lands (the flying clone is bare).
  const groundStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0.55, 1], [0, 1], Extrapolation.CLAMP),
  }));
  const badgeStyle = useAnimatedStyle(() => {
    const landed = interpolate(progress.get(), [0.75, 1], [0, 1], Extrapolation.CLAMP);
    const shift = TILT_SHIFT * TILT_BADGE_DEPTH;
    return {
      opacity: landed,
      transform: [
        { translateX: tilt.x.get() * shift },
        { translateY: -tilt.y.get() * shift },
        { rotate: BADGE_TILT },
        { scale: 0.7 + 0.3 * landed },
      ],
    };
  });

  // Tilt-to-move: the shift (outside the measured box), the turn (inside it) and the shadow's counter-shift.
  const tiltShiftStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tilt.x.get() * TILT_SHIFT }, { translateY: -tilt.y.get() * TILT_SHIFT }],
  }));
  const tiltTurnStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: TILT_PERSPECTIVE },
      // Negative = the edge on the side the art moved toward comes nearer the eye.
      { rotateY: `${-tilt.x.get() * TILT_TURN}deg` },
      { rotateX: `${-tilt.y.get() * TILT_TURN}deg` },
    ],
  }));
  const tiltShadowStyle = useAnimatedStyle(() => {
    const x = tilt.x.get();
    const y = tilt.y.get();
    const amount = Math.min(1, Math.hypot(x, y));
    return {
      opacity: 1 - 0.16 * amount,
      transform: [{ translateX: -x * TILT_SHADOW_SHIFT }, { translateY: y * 1.5 }, { scaleX: 1 + 0.05 * amount }],
    };
  });

  const plateW = Math.round(size * PLATE_RX * 2 + PLATE_STROKE * 2);
  const plateH = Math.round(size * PLATE_RY * 2 + PLATE_STROKE * 2);
  const plateCenterY = size * (1 - PLATE_LIFT);
  const artOpacity = soldOut ? 0.45 : 1;
  const badgeX = Math.min(size - BADGE_FROM_RIGHT, subjectRight(uri) * size + BADGE_PAST_SUBJECT);
  const badgeY = subjectTop(uri) * size + BADGE_BELOW_TOP;

  return (
    <Animated.View ref={anchorRef} collapsable={false} onLayout={handleLayout} style={{ width: size, height: size }}>
      <Animated.View style={[StyleSheet.absoluteFill, frameStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, seatStyle]}>
          {cutout ? (
            <Animated.View style={[StyleSheet.absoluteFill, groundStyle]}>
              <Svg
                width={plateW}
                height={plateH}
                style={[styles.plate, { left: (size - plateW) / 2, top: plateCenterY - plateH / 2 }]}
              >
                <Ellipse
                  cx={plateW / 2}
                  cy={plateH / 2}
                  rx={size * PLATE_RX}
                  ry={size * PLATE_RY}
                  stroke={withAlpha(c.ink, 0.12)}
                  strokeWidth={PLATE_STROKE}
                  fill={withAlpha(c.white, 0.08)}
                />
              </Svg>
              <Animated.View style={[styles.layer, tiltShadowStyle]}>
                <ContactShadow box={size} tone="hero" widthRatio={0.66} animatedStyle={floatShadow} style={soldOut ? styles.dim : null} />
              </Animated.View>
            </Animated.View>
          ) : null}

          <Animated.View style={[styles.layer, tiltShiftStyle]}>
            <Animated.View style={[StyleSheet.absoluteFill, cutout ? floatStyle : null]}>
              <View ref={photoRef} collapsable={false} style={cutout ? styles.box : [styles.box, styles.cover, { borderRadius: Math.round(size * 0.22) }]}>
                <Animated.View style={[StyleSheet.absoluteFill, tiltTurnStyle]}>
                  <Image
                    source={photoSource(uri)}
                    placeholder={placeholderUri ? photoSource(placeholderUri) : undefined}
                    placeholderContentFit={cutout ? 'contain' : 'cover'}
                    contentFit={cutout ? 'contain' : 'cover'}
                    transition={placeholderUri ? 220 : 250}
                    cachePolicy="memory-disk"
                    priority="high"
                    loading="eager"
                    onLoad={onLoad}
                    style={[StyleSheet.absoluteFill, cutout ? artPlacementTransform(uri, size) : null, { opacity: artOpacity }]}
                    accessibilityIgnoresInvertColors
                  />
                </Animated.View>
              </View>
            </Animated.View>
          </Animated.View>

          {!soldOut && kcal != null ? (
            <Animated.View
              style={[
                styles.badge,
                { left: badgeX - KCAL_BADGE_SIZE / 2, top: badgeY - KCAL_BADGE_SIZE / 2 },
                badgeStyle,
              ]}
            >
              <KcalBadge kcal={kcal} />
            </Animated.View>
          ) : null}
        </Animated.View>

        {soldOut ? (
          <View style={styles.soldOutSlot}>
            <View style={styles.soldOutPill}>
              <Text style={styles.soldOutText} color={c.onInk}>
                Sold out today
              </Text>
            </View>
          </View>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  box: { ...StyleSheet.absoluteFill },
  layer: { ...StyleSheet.absoluteFill, pointerEvents: 'none' },
  cover: { overflow: 'hidden', backgroundColor: c.surfaceAlt },
  plate: { position: 'absolute' },
  dim: { opacity: 0.45 },
  badge: { position: 'absolute', width: KCAL_BADGE_SIZE, height: KCAL_BADGE_SIZE },
  soldOutSlot: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', paddingTop: '18%' },
  soldOutPill: {
    height: 32,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    backgroundColor: c.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldOutText: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18 },
}));
