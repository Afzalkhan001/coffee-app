import { View } from 'react-native';
import { RollingNumber } from '@/components/motion';
import { PressableScale, Text } from '@/components/ui';
import { fonts, makeStyles, radii, useColors } from '@/theme';

export interface PointsPillProps {
  points: number;
  onPress?: () => void;
}

/** R3 roast loyalty pill: "610 pts" (14/600 white, 36h, no sparkle); digits roll when the balance changes. */
export function PointsPill({ points, onPress }: PointsPillProps) {
  const c = useColors();
  const styles = useStyles();
  const content = (
    <>
      <RollingNumber value={points} decimals={0} fontSize={14} fontFamily={fonts.semibold} color={c.white} />
      <Text style={styles.unit} color={c.white}>
        pts
      </Text>
    </>
  );
  const label = `${points} loyalty points`;

  if (onPress) {
    return (
      <PressableScale
        onPress={onPress}
        style={styles.pill}
        accessibilityLabel={label}
        accessibilityHint="Opens rewards"
      >
        {content}
      </PressableScale>
    );
  }
  return (
    <View style={styles.pill} accessible accessibilityLabel={label}>
      {content}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  pill: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: c.roast,
  },
  unit: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18 },
}));
