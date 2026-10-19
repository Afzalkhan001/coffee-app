import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { Avatar } from '@/components/domain';
import { enterUp, RollingNumber, withAlpha } from '@/components/motion';
import { CircleButton, Text } from '@/components/ui';
import { fonts, makeStyles, useColors } from '@/theme';
import type { Profile } from '@/types/models';
import { displayPhone, memberSince } from './format';

export interface ProfileCardProps {
  profile: Profile | null;
  phone: string | null;
  orders: number;
  points: number;
  onEdit: () => void;
  index?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Profile identity (DESIGN.md §R3.B "Profile"): no card — the 72px initials avatar, name and phone
 * sit on the canvas with a 40px white edit circle, over one stats row on the canvas too (20/700
 * over 13 `inkSoft`, hairline dividers, no sheet).
 */
export function ProfileCard({ profile, phone, orders, points, onEdit, index = 0, style }: ProfileCardProps) {
  const c = useColors();
  const styles = useStyles();
  const name = profile?.name ?? 'Coffee lover';
  return (
    <View style={style}>
      <Animated.View entering={enterUp(index)} style={styles.identity}>
        <Avatar name={profile?.name} size={72} />
        <View style={styles.copy}>
          <Text style={styles.name} numberOfLines={1} accessibilityRole="header">
            {name}
          </Text>
          {phone ? (
            <Text style={styles.phone} color={c.inkSoft} numberOfLines={1}>
              {displayPhone(phone)}
            </Text>
          ) : null}
        </View>
        <CircleButton icon="create-outline" size={40} tone="white" onPress={onEdit} accessibilityLabel="Edit your name" />
      </Animated.View>

      <Animated.View entering={enterUp(index + 1)} style={styles.stats}>
        <Stat label="Orders" accessibilityLabel={`${orders} orders`}>
          <RollingNumber value={orders} decimals={0} fontSize={20} fontFamily={fonts.bold} color={c.ink} />
        </Stat>
        <View style={styles.statDivider} />
        <Stat label="Points" accessibilityLabel={`${points} points`}>
          <RollingNumber value={points} decimals={0} fontSize={20} fontFamily={fonts.bold} color={c.ink} animateOnMount />
        </Stat>
        <View style={styles.statDivider} />
        <Stat label="Member since" accessibilityLabel={`Member since ${memberSince(profile?.createdAt)}`}>
          <Text style={styles.statText} numberOfLines={1} adjustsFontSizeToFit>
            {memberSince(profile?.createdAt)}
          </Text>
        </Stat>
      </Animated.View>
    </View>
  );
}

function Stat({ label, accessibilityLabel, children }: { label: string; accessibilityLabel: string; children: ReactNode }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={styles.stat} accessible accessibilityLabel={accessibilityLabel}>
      <View style={styles.statValue}>{children}</View>
      <Text style={styles.statLabel} color={c.inkSoft} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, color: c.ink },
  phone: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 20 },
  // On the canvas: a hairline above and below frames the row instead of a white sheet.
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderColor: withAlpha(c.ink, 0.1),
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { minHeight: 26, justifyContent: 'center' },
  statText: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, color: c.ink },
  statLabel: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  statDivider: { width: StyleSheet.hairlineWidth * 2, height: 32, backgroundColor: withAlpha(c.ink, 0.1) },
}));
