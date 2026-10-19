import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cubicBezier, Easing, LayoutAnimationConfig, ZoomIn } from 'react-native-reanimated';
import { Icon, PressableScale } from '@/components/ui';
import { makeThemed, springs } from '@/theme';

// Spring on native; web ignores springify(), so it gets an overshooting bezier instead of linear.
const iconIn = ZoomIn.springify()
  .damping(springs.snappy.damping)
  .stiffness(springs.snappy.stiffness)
  .mass(1)
  .easing(Easing.bezier(0.34, 1.56, 0.64, 1));
const easeOutQuint = cubicBezier(0.22, 1, 0.36, 1);

export interface QuickAddButtonProps {
  onPress: () => void;
  /** Briefly true after a successful add: the "+" morphs into a check on an ink circle. */
  added?: boolean;
  size?: number;
  /**
   * Resting fill: white on tinted tiles (default), `canvas` (bg fill, ink plus) in white list sheets
   * where several rows repeat (search), ink for a single primary row (cart upsell).
   */
  tone?: 'white' | 'ink' | 'canvas';
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

type QuickAddTone = NonNullable<QuickAddButtonProps['tone']> | 'added';

/**
 * Fill + glyph per state. `white` is the tile `control` (white + ink in light, cream + espresso in
 * dark). `added` is the ink circle in light; in dark (where the control is already cream) it turns
 * deep sage with a white check, so the confirmation still reads as a change.
 */
const useQuickAddTones = makeThemed(
  (c, t): Record<QuickAddTone, { bg: string; fg: string }> => ({
    white: { bg: c.control, fg: c.onControl },
    ink: { bg: c.ink, fg: c.onInk },
    canvas: { bg: c.bg, fg: c.ink },
    added: t.isDark ? { bg: c.sageDeep, fg: c.white } : { bg: c.ink, fg: c.onInk },
  }),
);

/** "+" circle (R3: 34px white on tiles, 16px ink plus, no shadow). Hit area is padded to 44px. */
export function QuickAddButton({ onPress, added = false, size = 34, tone = 'white', accessibilityLabel, style }: QuickAddButtonProps) {
  const t = useQuickAddTones()[added ? 'added' : tone];
  return (
    <PressableScale
      onPress={onPress}
      activeScale={0.88}
      // A committing CTA: clicks on press-in; the flight's arrival plays `land` (docs/HAPTICS.md).
      hapticKind="press"
      hitSlop={Math.max(0, (44 - size) / 2)}
      accessibilityLabel={accessibilityLabel}
      style={style}
    >
      <Animated.View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: t.bg,
            transitionProperty: 'backgroundColor',
            transitionDuration: 220,
            transitionTimingFunction: easeOutQuint,
          },
        ]}
      >
        {/* Skip the zoom on first mount (grids mount many cards); animate only the +/✓ swap. */}
        <LayoutAnimationConfig skipEntering>
          <Animated.View key={added ? 'added' : 'add'} entering={iconIn}>
            <Icon name={added ? 'checkmark' : 'add'} size={Math.round(size * 0.47)} color={t.fg} />
          </Animated.View>
        </LayoutAnimationConfig>
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
});
