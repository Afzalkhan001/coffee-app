import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { enterFade } from '@/components/motion';
import { Text } from '@/components/ui';
import { fonts, useColors } from '@/theme';
import { brand } from '@/theme/brand';
import { APP_VERSION } from './appInfo';

/** Profile sign-off (R3): the Fraunces wordmark in `inkMuted` over the version. No bean, no tagline. */
export function BrandFooter({ index = 0, style }: { index?: number; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <Animated.View
      entering={enterFade(index)}
      style={[styles.wrap, style]}
      accessible
      accessibilityLabel={`${brand.fullName}, version ${APP_VERSION}`}
    >
      <Text style={styles.wordmark} color={c.inkMuted}>
        {brand.name}
      </Text>
      <Text style={styles.version} color={c.inkMuted}>{`Version ${APP_VERSION}`}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 2, paddingTop: 8 },
  wordmark: { fontFamily: fonts.brand, fontSize: 20, lineHeight: 26 },
  version: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
});
