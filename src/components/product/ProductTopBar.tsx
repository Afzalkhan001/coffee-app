/**
 * Floating top bar over the hero (R3.B): frosted 44px back circle (left; we keep back on the left,
 * the platform convention) and the frosted cart button (right, the fly-to-cart target with its
 * badge), plus a compact header (product name on a frosted strip) that fades in once
 * the sheet slides up beneath it. The strip is the motion kit's `FrostedLayer`: on iOS a cream fill
 * over a real blur whose strength (not opacity) follows the scroll; on web and Android an opaque
 * cream fill — Chrome can leave a backdrop-filter stale after an opacity fade, and the 28px title
 * scrolling under it then ghosts through a translucent fill.
 */
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';
import { enterFade, FrostedLayer } from '@/components/motion';
import { Text } from '@/components/ui';
import { spacing } from '@/theme';
import { FrostCartButton, FrostCircle } from './FrostCircle';
import { TOP_BUTTON, type ProductLayout } from './layout';

const FILL_OPACITY = Platform.OS === 'ios' ? undefined : 1;

export interface ProductTopBarProps {
  title: string;
  scrollY: SharedValue<number>;
  geometry: ProductLayout;
  onBack: () => void;
}

export function ProductTopBar({ title, scrollY, geometry, onBack }: ProductTopBarProps) {
  const reduced = useReducedMotion();
  const { headerHeight, sheetTop, topBarTop, width } = geometry;
  const solidAt = sheetTop - headerHeight;

  // Fully frosted by the time the sheet's edge reaches the strip's bottom.
  const frost = useDerivedValue(() =>
    interpolate(scrollY.get(), [solidAt - 56, solidAt - 8], [0, 1], Extrapolation.CLAMP),
  );
  const titleStyle = useAnimatedStyle(() => {
    const p = interpolate(scrollY.get(), [solidAt - 24, solidAt + 16], [0, 1], Extrapolation.CLAMP);
    return { opacity: p, transform: [{ translateY: reduced ? 0 : 6 * (1 - p) }] };
  });

  return (
    <View style={styles.root}>
      <FrostedLayer progress={frost} height={headerHeight} fillOpacity={FILL_OPACITY} />

      <Animated.View entering={enterFade(1)} style={[styles.row, { top: topBarTop }]}>
        <FrostCircle icon="chevron-back" onPress={onBack} accessibilityLabel="Go back" />
        <Animated.View
          style={[styles.titleSlot, { maxWidth: width - (spacing.gutter + TOP_BUTTON + spacing.sm) * 2 }, titleStyle]}
        >
          <Text variant="h3" numberOfLines={1} align="center">
            {title}
          </Text>
        </Animated.View>
        <FrostCartButton />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, pointerEvents: 'box-none' },
  row: {
    position: 'absolute',
    left: spacing.gutter,
    right: spacing.gutter,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    pointerEvents: 'box-none',
  },
  titleSlot: { flexShrink: 1, pointerEvents: 'none' },
});
