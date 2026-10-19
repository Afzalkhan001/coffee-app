import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FrostedLayer } from '@/components/motion';
import { CircleButton, Text } from '@/components/ui';
import { fonts, layout, makeStyles, spacing } from '@/theme';

export interface FrostedTopBarProps {
  title: string;
  scrollY: SharedValue<number>;
  /** Scroll range over which the frosted backdrop and the small centred title fade in. */
  revealFrom: number;
  revealTo: number;
  /**
   * Scroll range for the opaque canvas backdrop when it should differ from the title's (Category:
   * the backdrop arrives as the hero plane's bottom edge reaches the bar). Default: revealFrom/To.
   */
  backdropFrom?: number;
  backdropTo?: number;
  right?: ReactNode;
  onBack?: () => void;
}

const BAR = 60;

/**
 * Fixed back / title / action bar over a hero: transparent at rest (white circles on the tint), a
 * small centred title once the hero's big title has scrolled away, and an opaque canvas backdrop
 * (soft edge below) once content starts passing under it.
 */
export function FrostedTopBar({ title, scrollY, revealFrom, revealTo, backdropFrom, backdropTo, right, onBack }: FrostedTopBarProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));

  // 0..1 reveal: drives the frosted layer (blur strength + fill) and the small centred title.
  const reveal = useDerivedValue(() => interpolate(scrollY.get(), [revealFrom, revealTo], [0, 1], Extrapolation.CLAMP));
  const bgFrom = backdropFrom ?? revealFrom;
  const bgTo = backdropTo ?? revealTo;
  const backdrop = useDerivedValue(() => interpolate(scrollY.get(), [bgFrom, bgTo], [0, 1], Extrapolation.CLAMP));
  const titleStyle = useAnimatedStyle(() => {
    const p = reveal.get();
    return { opacity: p, transform: [{ translateY: (1 - p) * 6 }] };
  });

  return (
    <View style={[styles.bar, { paddingTop: insets.top, height: insets.top + BAR }]}>
      {/* Opaque canvas once revealed: nothing ghosts through the compact bar. */}
      <FrostedLayer progress={backdrop} fillOpacity={1} />
      <CircleButton icon="chevron-back" size={layout.headerButton} onPress={back} accessibilityLabel="Go back" />
      <Animated.View style={[styles.titleWrap, titleStyle]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={styles.title} numberOfLines={1} align="center">
          {title}
        </Text>
      </Animated.View>
      <View style={styles.right}>{right ?? <View style={styles.placeholder} />}</View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.gutter,
    pointerEvents: 'box-none',
  },
  titleWrap: { flex: 1, pointerEvents: 'none' },
  // R3: sentence case, quiet weight (like Tracking's centred "Track order").
  title: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22, color: c.ink },
  right: { minWidth: 44, flexDirection: 'row', justifyContent: 'flex-end' },
  placeholder: { width: 44 },
}));
