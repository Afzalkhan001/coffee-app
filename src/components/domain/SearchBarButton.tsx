import { useEffect, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, FadeOutUp } from 'react-native-reanimated';
import { riseEntrance } from '@/components/motion';
import { Icon, PressableScale, Text } from '@/components/ui';
import { durations, fonts, makeStyles, useColors } from '@/theme';

const SUGGESTIONS = ['lattes', 'croissants', 'cold brew', 'matcha', 'cheesecake'] as const;
const ROTATE_MS = 2800;
const easeOutQuint = Easing.bezier(0.22, 1, 0.36, 1);
// Web-safe rise (custom initial values would pin the word with position:absolute on web).
const wordIn = riseEntrance({ distance: 8, duration: durations.slow, small: true });
const wordOut = FadeOutUp.duration(durations.base).easing(easeOutQuint);

export interface SearchBarButtonProps {
  onPress: () => void;
  /** Fixed placeholder. When omitted, "Search lattes…" cycles through menu suggestions. */
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
}

/** R3 white search pill (52h, r26, no shadow). Not editable: it opens the Search screen. */
export function SearchBarButton({ onPress, placeholder, style }: SearchBarButtonProps) {
  const [i, setI] = useState(0);
  const c = useColors();
  const styles = useStyles();

  useEffect(() => {
    if (placeholder) return;
    const t = setInterval(() => setI((n) => (n + 1) % SUGGESTIONS.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [placeholder]);

  return (
    <PressableScale
      onPress={onPress}
      activeScale={0.98}
      accessibilityRole="search"
      accessibilityLabel={placeholder ?? 'Search lattes, croissants and more'}
      style={[styles.bar, style]}
    >
      <Icon name="search" size={20} color={c.inkSoft} />
      {placeholder ? (
        <Text style={styles.text} color={c.inkMuted} numberOfLines={1}>
          {placeholder}
        </Text>
      ) : (
        <View style={styles.rotator}>
          <Text style={styles.text} color={c.inkMuted}>
            {'Search '}
          </Text>
          <View style={styles.wordBox}>
            <Animated.View key={SUGGESTIONS[i]} entering={wordIn} exiting={wordOut} style={styles.word}>
              <Text style={styles.text} color={c.inkMuted} numberOfLines={1}>
                {`${SUGGESTIONS[i]}…`}
              </Text>
            </Animated.View>
          </View>
        </View>
      )}
    </PressableScale>
  );
}

const useStyles = makeStyles((c) => ({
  bar: {
    height: 52,
    borderRadius: 26,
    backgroundColor: c.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
  },
  rotator: { flex: 1, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  wordBox: { flex: 1, height: 22, justifyContent: 'center' },
  word: { position: 'absolute', left: 0, right: 0 },
  text: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 20 },
}));
