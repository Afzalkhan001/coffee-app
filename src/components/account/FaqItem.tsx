import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Icon, PressableScale, Text } from '@/components/ui';
import { fonts, makeStyles, springs, useColors } from '@/theme';

export interface FaqItemProps {
  question: string;
  answer: string;
  open: boolean;
  onToggle: () => void;
}

/**
 * Accordion row (R3: no circle behind the chevron): the answer's height springs open on the UI
 * thread (measured off-flow, so no layout jump) while the chevron rotates 180°.
 */
export function FaqItem({ question, answer, open, onToggle }: FaqItemProps) {
  const c = useColors();
  const styles = useStyles();
  const progress = useSharedValue(open ? 1 : 0);
  const contentHeight = useSharedValue(0);

  useEffect(() => {
    progress.set(withSpring(open ? 1 : 0, springs.smooth));
  }, [open, progress]);

  const bodyStyle = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      height: contentHeight.get() * Math.min(1, Math.max(0, p)),
      opacity: interpolate(p, [0, 0.5, 1], [0, 0.35, 1], Extrapolation.CLAMP),
    };
  });
  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${progress.get() * 180}deg` }] }));

  return (
    <View>
      <PressableScale
        onPress={onToggle}
        activeScale={0.985}
        style={styles.row}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={question}
      >
        <Text style={[styles.question, open ? styles.questionOpen : null]}>{question}</Text>
        <Animated.View style={chevronStyle}>
          <Icon name="chevron-down" size={18} color={c.inkMuted} />
        </Animated.View>
      </PressableScale>
      <Animated.View
        style={[styles.body, bodyStyle]}
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
      >
        <View style={styles.measure} onLayout={(e) => contentHeight.set(e.nativeEvent.layout.height)}>
          <Text style={styles.answer} color={c.inkSoft}>
            {answer}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  question: { flex: 1, fontFamily: fonts.medium, fontSize: 16, lineHeight: 22, color: c.ink },
  questionOpen: { fontFamily: fonts.semibold },
  body: { overflow: 'hidden' },
  measure: { position: 'absolute', left: 0, right: 0, top: 0 },
  answer: { paddingLeft: 16, paddingRight: 46, paddingBottom: 16, fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
}));
