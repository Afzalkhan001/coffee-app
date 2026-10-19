import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { ArtThumb, staggerIndex } from '@/components/domain';
import { enterUp, layoutSpring, Skeleton } from '@/components/motion';
import { PillButton, Text } from '@/components/ui';
import { fonts, makeStyles, useColors } from '@/theme';
import type { Reward } from '@/types/models';
import { formatCount } from '@/lib/format';

const THUMB = 64;
const PAD = 16;
/** Where the row text starts: hairlines between rows are inset to here (R3.A10). */
export const REWARD_ROW_TEXT_INSET = PAD + THUMB + 12;

export interface RewardRowProps {
  reward: Reward;
  balance: number;
  /** This reward is applied to the cart right now. */
  applied: boolean;
  onRedeem: (reward: Reward) => void;
  /** Re-open the ticket for an applied reward. */
  onView: (reward: Reward) => void;
  index?: number;
  /** Draw the inset hairline above this row (every row but the first in the sheet). */
  divider?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * One reward in the Redeem sheet (DESIGN.md §R3.B "Rewards"), 80h: a 64 thumbnail tile with the
 * reward's cut-out, the name and one quiet line. On the right, the cost IS the button: an ink
 * "150 pts" pill when you can afford it, a muted outline when it's locked (the line then says how
 * far off it is), and a sage "Applied" pill that re-opens the ticket.
 */
export function RewardRow({ reward, balance, applied, onRedeem, onView, index = 0, divider = false, style }: RewardRowProps) {
  const c = useColors();
  const styles = useStyles();
  const affordable = balance >= reward.cost;
  const need = Math.max(0, reward.cost - balance);
  const cost = `${formatCount(reward.cost)} pts`;

  return (
    <Animated.View entering={enterUp(staggerIndex(index))} layout={layoutSpring} style={style}>
      {divider ? <View style={styles.divider} /> : null}
      <View style={styles.row}>
        <ArtThumb image={reward.image} size={THUMB} artOpacity={affordable || applied ? 1 : 0.55} />
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={2}>
            {reward.name}
          </Text>
          <Text style={styles.line} color={c.inkSoft} numberOfLines={1}>
            {affordable || applied ? reward.description : `${formatCount(need)} pts to go`}
          </Text>
        </View>
        {applied ? (
          <PillButton
            label="Applied"
            tone="sage"
            size="sm"
            onPress={() => onView(reward)}
            accessibilityLabel={`${reward.name} is applied. Show the code`}
            style={styles.pill}
          />
        ) : affordable ? (
          <PillButton
            label={cost}
            tone="ink"
            size="sm"
            // Silent press: the screen fires `success` as the reward is redeemed.
            onPress={() => onRedeem(reward)}
            accessibilityLabel={`Redeem ${reward.name} for ${reward.cost} points`}
            style={styles.pill}
          />
        ) : (
          <PillButton
            label={cost}
            tone="muted"
            size="sm"
            accessibilityLabel={`${reward.name}: need ${need} more points`}
            style={styles.pill}
          />
        )}
      </View>
    </Animated.View>
  );
}

export function RewardRowSkeleton({ divider = false }: { divider?: boolean }) {
  const styles = useStyles();
  return (
    <View accessible accessibilityLabel="Loading rewards">
      {divider ? <View style={styles.divider} /> : null}
      <View style={styles.row}>
        <Skeleton width={THUMB} height={THUMB} radius={20} />
        <View style={[styles.body, styles.skeletonBody]}>
          <Skeleton width="58%" height={15} radius={7} />
          <Skeleton width="84%" height={11} radius={6} />
        </View>
        <Skeleton width={78} height={36} radius={18} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 80, paddingHorizontal: PAD, paddingVertical: 8 },
  divider: { height: StyleSheet.hairlineWidth * 2, backgroundColor: c.line, marginLeft: REWARD_ROW_TEXT_INSET, marginRight: PAD },
  body: { flex: 1, minWidth: 0, gap: 2 },
  skeletonBody: { gap: 8 },
  name: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: c.ink },
  line: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  // Centred on the row like the cart's price pills (PillButton defaults to flex-start).
  pill: { paddingHorizontal: 14, alignSelf: 'center' },
}));
