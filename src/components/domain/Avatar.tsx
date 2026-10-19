import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon, Text } from '@/components/ui';
import { initials } from '@/lib/format';
import { fonts, makeStyles, makeThemed, useColors } from '@/theme';

/** Roast → espresso: a dark fill with white initials in both schemes. */
const useGradient = makeThemed((c) => [c.roast, c.espresso] as const);

export interface AvatarProps {
  name?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * R3 avatar: initials on the roast gradient (no photo, no peach ring, no line-art). Before there's
 * a name it shows the profile glyph.
 */
export function Avatar({ name, size = 44, style }: AvatarProps) {
  const c = useColors();
  const styles = useStyles();
  const gradient = useGradient();
  const letters = initials(name);
  return (
    <View
      style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={name ? `${name}'s avatar` : 'Avatar'}
    >
      <LinearGradient colors={gradient} start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }} style={StyleSheet.absoluteFill} />
      {letters ? (
        <Text
          style={{ fontFamily: fonts.semibold, fontSize: Math.round(size * 0.36), lineHeight: Math.round(size * 0.46) }}
          color={c.white}
        >
          {letters}
        </Text>
      ) : (
        <Icon name="profile" size={Math.round(size * 0.46)} color={c.white} />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: c.roast },
}));
