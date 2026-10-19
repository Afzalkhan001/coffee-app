/**
 * Right-aligned tag on an expanded (required) modifier group (ref 2 "*Choose One"):
 *  - required + unmet → "*Choose one" 13/500 `inkMuted`. After a failed add (`attempted`) it turns
 *    ember, and `alert` flashes it into a filled ember pill with a quick pop.
 *  - met → the chosen value ("Hot"), `inkSoft`
 *  - muted → `inkMuted`, never ember (a sold-out product's groups can't be "required" of anyone)
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { easeOutQuint, withAlpha } from '@/components/motion';
import { Text } from '@/components/ui';
import { fonts, radii, springs, useColors } from '@/theme';

export type GroupTagTone = 'required' | 'met' | 'muted';

export interface GroupTagProps {
  label: string;
  tone: GroupTagTone;
  /** Flash (a failed add just pointed here). */
  alert: boolean;
  /** A failed add has pointed here before: the required tag stays ember until met. */
  attempted?: boolean;
}

export function GroupTag({ label, tone, alert, attempted = false }: GroupTagProps) {
  const c = useColors();
  const fill = useSharedValue(0);
  const scale = useSharedValue(1);
  const filled = alert && tone === 'required';

  useEffect(() => {
    fill.set(withTiming(filled ? 1 : 0, { duration: filled ? 140 : 320, easing: easeOutQuint }));
    if (filled) {
      scale.set(withSequence(withTiming(1.12, { duration: 120, easing: easeOutQuint }), withSpring(1, springs.bouncy)));
    }
  }, [filled, fill, scale]);

  const emberClear = withAlpha(c.ember, 0);
  const ember = c.ember;
  const pillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(fill.get(), [0, 1], [emberClear, ember]),
    transform: [{ scale: scale.get() }],
  }));
  const baseText = useAnimatedStyle(() => ({ opacity: 1 - fill.get() }));
  const alertText = useAnimatedStyle(() => ({ opacity: fill.get() }));

  if (tone !== 'required') {
    return (
      <View style={styles.quiet}>
        <Text style={styles.text} color={tone === 'muted' ? c.inkMuted : c.inkSoft} numberOfLines={1}>
          {label}
        </Text>
      </View>
    );
  }

  const text = `*${label}`;
  return (
    <Animated.View style={[styles.pill, pillStyle]} accessibilityLabel={`Required: ${label}`}>
      <Animated.View style={baseText}>
        <Text style={styles.text} color={attempted ? c.ember : c.inkMuted}>
          {text}
        </Text>
      </Animated.View>
      <Animated.View style={[styles.overlay, alertText]}>
        <Text style={styles.text} color={c.white}>
          {text}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  quiet: { height: 26, justifyContent: 'center', flexShrink: 1 },
  text: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  pill: {
    height: 26,
    paddingHorizontal: 10,
    marginRight: -10,
    borderRadius: radii.pill,
    justifyContent: 'center',
  },
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
