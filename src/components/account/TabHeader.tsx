import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { enterFade } from '@/components/motion';
import { Text } from '@/components/ui';

export interface TabHeaderProps {
  /** Sentence case (R3.A5 `title`: "Orders", "Rewards", "Profile"). */
  title: string;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Tab-screen header (no back button): the 30/36 sentence-case title on the left, an optional right slot. No subtitle (R3.A6). */
export function TabHeader({ title, right, style }: TabHeaderProps) {
  return (
    <Animated.View entering={enterFade(0)} style={[styles.wrap, style]}>
      <Text variant="title" accessibilityRole="header" numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      {right ? <View style={styles.right}>{right}</View> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: 48,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: { flex: 1, minWidth: 0 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
