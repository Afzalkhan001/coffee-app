/**
 * Outlined ember kcal badge (ref 2 "245 Kcal"), placed on the hero art's upper-right by `HeroImage`
 * and tilted −10°. The number rolls as options change the estimate (oat milk, syrups, size). R3:
 * the product screen's one ember element — 66px, 1.5px ember outline on white 70%, no shadow.
 */
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { RollingNumber, withAlpha } from '@/components/motion';
import { Text } from '@/components/ui';
import { fonts, makeStyles, useColors } from '@/theme';

export const KCAL_BADGE_SIZE = 66;

export interface KcalBadgeProps {
  kcal: number;
  style?: StyleProp<ViewStyle>;
}

export function KcalBadge({ kcal, style }: KcalBadgeProps) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={[styles.badge, style]} accessible accessibilityLabel={`About ${kcal} calories`}>
      <RollingNumber
        value={kcal}
        decimals={0}
        grouping={false}
        fontSize={18}
        lineHeight={20}
        fontFamily={fonts.bold}
        color={c.ember}
        stagger={24}
      />
      <Text style={styles.unit} color={c.ember}>
        kcal
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  badge: {
    width: KCAL_BADGE_SIZE,
    height: KCAL_BADGE_SIZE,
    borderRadius: KCAL_BADGE_SIZE / 2,
    borderWidth: 1.5,
    borderColor: c.ember,
    // A 70% veil of the sheet colour: white on the light hero, the dark sheet on the dark hero.
    backgroundColor: withAlpha(c.surface, 0.7),
    alignItems: 'center',
    justifyContent: 'center',
  },
  unit: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 13, marginTop: -1, letterSpacing: 0.2 },
}));
