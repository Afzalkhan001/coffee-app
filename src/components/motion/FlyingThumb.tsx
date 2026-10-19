import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { artPlacementTransform } from '@/data/mock/photoMetrics';
import { isCutoutPhoto, photoSource } from '@/data/mock/photoSource';
import { makeStyles } from '@/theme';
import { easeInOutCubic } from './hooks';
import { flightPoint, planFlight } from './math';
import type { WindowRect } from './measure';

export interface Flight {
  id: number;
  /** Stored image string (`local:<key>` / URL) or a bundled asset module. */
  image: string | number;
  from: WindowRect;
  /** Cart target rect; null → fly toward the top-right corner and fade. */
  to: WindowRect | null;
}

interface FlyingThumbProps {
  flight: Flight;
  /** Stable callback fired on the JS thread when the thumb lands. */
  onArrive: (id: number) => void;
}

/**
 * The product art travelling along an arc into the cart while shrinking (UI thread). R3: a
 * transparent cut-out flies bare — exactly the art box the customer tapped, no circle mask, no tile,
 * no ring; a remote/scene photo flies as a rounded square.
 */
export function FlyingThumb({ flight, onArrive }: FlyingThumbProps) {
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Frozen at launch: rotation or inset changes mid-flight must not re-plan the path.
  const [plan] = useState(() => planFlight(flight.from, flight.to, width, insets.top));
  const progress = useSharedValue(0);
  const id = flight.id;
  const liftScale = plan.startScale >= 1.2 ? Math.max(1, plan.startScale * 0.62) : plan.startScale * 1.08;
  const bare = typeof flight.image === 'number' || isCutoutPhoto(flight.image);
  const source = typeof flight.image === 'number' ? flight.image : photoSource(flight.image);

  useEffect(() => {
    // Timing (not a spring) on purpose: a spring would overshoot past the cart (t > 1).
    progress.set(
      withTiming(1, { duration: plan.duration, easing: easeInOutCubic }, (finished) => {
        if (finished) scheduleOnRN(onArrive, id);
      }),
    );
    return () => cancelAnimation(progress);
  }, [progress, plan.duration, onArrive, id]);

  const animatedStyle = useAnimatedStyle(() => {
    const t = progress.get();
    const { x, y } = flightPoint(plan, t);
    return {
      opacity: plan.hasTarget
        ? interpolate(t, [0, 0.8, 1], [1, 1, 0.25])
        : interpolate(t, [0, 0.4, 1], [1, 0.95, 0]),
      transform: [
        { translateX: x - plan.size / 2 },
        { translateY: y - plan.size / 2 },
        // Starts exactly over the source art box (a big hero shrinks as it lifts off; a card's
        // cut-out gives a small 8% lift), then shrinks into the cart.
        { scale: interpolate(t, [0, 0.18, 1], [plan.startScale, liftScale, plan.endScale]) },
        { rotate: `${-16 * t}deg` },
      ],
    };
  });

  const box = { width: plan.size, height: plan.size };

  if (bare) {
    return (
      <Animated.View style={[styles.thumb, box, animatedStyle]}>
        {/* Same seat as the source art (ProductArt / the hero), so lift-off doesn't jump. */}
        <Image
          source={source}
          style={[StyleSheet.absoluteFill, typeof flight.image === 'string' ? artPlacementTransform(flight.image, plan.size) : undefined]}
          contentFit="contain"
          transition={0}
          cachePolicy="memory-disk"
        />
      </Animated.View>
    );
  }

  const radius = Math.round(plan.size * 0.22);
  return (
    <Animated.View style={[styles.thumb, styles.lifted, box, { borderRadius: radius }, animatedStyle]}>
      <View style={[styles.clip, { borderRadius: radius }]}>
        <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} cachePolicy="memory-disk" />
      </View>
    </Animated.View>
  );
}

const useStyles = makeStyles((c, t) => ({
  thumb: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  lifted: { boxShadow: t.boxShadows.strong },
  clip: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    backgroundColor: c.surfaceAlt,
  },
}));
