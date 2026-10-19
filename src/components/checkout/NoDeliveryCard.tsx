import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { PillButton, PressableScale, Text } from '@/components/ui';
import { formatKm } from '@/lib/geo';
import { brand } from '@/theme/brand';
import { fonts, makeStyles, radii, spacing, useColors } from '@/theme';
import type { Address } from '@/types/models';
import { riseIn } from './motion';

export interface NoDeliveryCardProps {
  address: Pick<Address, 'label' | 'line1' | 'city'>;
  distanceKm: number;
  onSwitchToPickup: () => void;
  onDismiss: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * "No delivery to this address yet" (PRD §24): a canvas panel that opens under the out-of-range row
 * inside the address sheet — the distance, then Pickup as the way forward. R3: no pin doodle, no
 * icon disc.
 */
export function NoDeliveryCard({ address, distanceKm, onSwitchToPickup, onDismiss, style }: NoDeliveryCardProps) {
  const c = useColors();
  const styles = useStyles();
  const { deliveryRadiusKm, shortName } = brand.store;
  return (
    <Animated.View entering={riseIn(0, 10)} style={[styles.panel, style]} accessibilityLiveRegion="polite">
      <Text style={styles.title}>No delivery to this address yet</Text>
      <Text variant="caption" color={c.inkSoft} style={styles.body}>
        {/* The street, not just the label: several saved addresses can share "Home" (Q-23). */}
        {`${address.line1}${address.city ? `, ${address.city}` : ''} is ${formatKm(distanceKm)} away. We deliver within ${deliveryRadiusKm} km of ${shortName}.`}
      </Text>
      <View style={styles.actions}>
        <PillButton label="Switch to Pickup" tone="ink" size="sm" onPress={onSwitchToPickup} />
        <PressableScale onPress={onDismiss} activeScale={0.96} hitSlop={10} accessibilityLabel="Choose another address">
          <Text style={styles.link}>Choose another</Text>
        </PressableScale>
      </View>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  panel: { backgroundColor: c.bg, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.md },
  title: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  body: { marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.md },
  link: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18, textDecorationLine: 'underline' },
}));
