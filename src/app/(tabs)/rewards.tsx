import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { getRewards } from '@/api';
import { useAsync, useLoyalty, useMyOrders } from '@/api/hooks';
import { ticketCode } from '@/components/account/format';
import { PointsHero } from '@/components/account/PointsHero';
import { PointsHistory } from '@/components/account/PointsHistory';
import { RedeemTicket } from '@/components/account/RedeemTicket';
import { RewardRow, RewardRowSkeleton } from '@/components/account/RewardRow';
import { StampCard } from '@/components/account/StampCard';
import { TabHeader } from '@/components/account/TabHeader';
import { ErrorState } from '@/components/domain';
import { enterUp, useToast } from '@/components/motion';
import { useTabBarSpace } from '@/components/navigation/TabBar';
import { useLivePillSpace } from '@/components/order/livePillSpace';
import { Screen, Text } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { useCart } from '@/store/cart';
import { useSession } from '@/store/session';
import { fonts, makeStyles, radii, useColors } from '@/theme';
import type { Reward } from '@/types/models';

/**
 * Rewards tab (DESIGN.md §R3.B "Rewards"): the roast points hero, the stamp row, the Redeem sheet
 * (the cost is the button) and the points ledger. "How to earn" lives in the Help FAQ.
 */
export default function RewardsScreen() {
  const styles = useStyles();
  const loyalty = useLoyalty();
  const orders = useMyOrders();
  const phone = useSession((s) => s.phone);
  const appliedId = useCart((s) => s.rewardId);
  const setReward = useCart((s) => s.setReward);
  const rewards = useAsync(getRewards, []);
  const toast = useToast();
  // The live order pill floats above the tab bar here: let the last row scroll clear of it.
  const bottom = useTabBarSpace() + useLivePillSpace();

  // The ticket keeps its reward after closing so the exit animation still has content.
  const [ticket, setTicket] = useState<{ reward: Reward; fresh: boolean }>();
  const [ticketOpen, setTicketOpen] = useState(false);

  const completed = orders.filter((o) => o.status === 'completed').length;
  const applied = rewards.data?.find((r) => r.id === appliedId);

  const redeem = (reward: Reward) => {
    if (loyalty.balance < reward.cost) return;
    setReward(reward.id);
    haptic.success();
    setTicket({ reward, fresh: true });
    setTicketOpen(true);
  };

  const view = (reward: Reward) => {
    setTicket({ reward, fresh: false });
    setTicketOpen(true);
  };

  const remove = () => {
    setReward(undefined);
    setTicketOpen(false);
    toast('Reward removed from your next order');
  };

  const available = rewards.data?.filter((r) => r.cost <= loyalty.balance).length ?? 0;

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom }]} showsVerticalScrollIndicator={false}>
        <TabHeader title="Rewards" style={styles.header} />

        <PointsHero
          balance={loyalty.balance}
          lifetime={loyalty.lifetime}
          rewards={rewards.data}
          rewardsError={!!rewards.error && !rewards.data}
          applied={applied}
          index={0}
        />

        <StampCard completedOrders={completed} index={1} style={styles.stamps} />

        <View style={styles.section}>
          <SectionTitle title="Redeem" caption={rewards.data && available > 0 ? `${available} ready` : undefined} index={2} />
          {rewards.loading && !rewards.data ? (
            <View style={styles.sheet}>
              <RewardRowSkeleton />
              <RewardRowSkeleton divider />
              <RewardRowSkeleton divider />
            </View>
          ) : rewards.error && !rewards.data ? (
            <ErrorState error={rewards.error} onRetry={rewards.reload} compact style={styles.error} />
          ) : (
            <View style={styles.sheet}>
              {(rewards.data ?? []).map((reward, i) => (
                <RewardRow
                  key={reward.id}
                  reward={reward}
                  balance={loyalty.balance}
                  applied={reward.id === appliedId}
                  onRedeem={redeem}
                  onView={view}
                  index={i + 3}
                  divider={i > 0}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <SectionTitle title="Points history" index={6} />
          <PointsHistory transactions={loyalty.transactions} index={6} />
        </View>
      </ScrollView>

      <RedeemTicket
        visible={ticketOpen}
        reward={ticket?.reward}
        code={ticket ? ticketCode(ticket.reward.id, phone) : ''}
        fresh={ticket?.fresh ?? false}
        onClose={() => setTicketOpen(false)}
        onRemove={remove}
      />
    </Screen>
  );
}

function SectionTitle({ title, caption, index }: { title: string; caption?: string; index: number }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <Animated.View entering={enterUp(index)} style={styles.sectionHead}>
      <Text variant="h2" accessibilityRole="header">
        {title}
      </Text>
      {caption ? (
        <Text style={styles.sectionCaption} color={c.inkSoft}>
          {caption}
        </Text>
      ) : null}
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  content: { paddingHorizontal: 20 },
  header: { paddingHorizontal: 0 },
  stamps: { marginTop: 16 },
  section: { marginTop: 28 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionCaption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  sheet: { backgroundColor: c.surface, borderRadius: radii.lg, overflow: 'hidden' },
  error: { paddingVertical: 20 },
}));
