import { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { easeOutQuint, enterUp, RollingNumber, withAlpha } from '@/components/motion';
import { Text } from '@/components/ui';
import { fonts, makeStyles, radii, springs, useColors } from '@/theme';
import type { Reward } from '@/types/models';
import { nextRewardProgress, tierFor } from './format';
import { formatCount } from '@/lib/format';

const swapIn = FadeIn.duration(240).easing(easeOutQuint);

export interface PointsHeroProps {
  balance: number;
  lifetime: number;
  /** Undefined while the reward catalogue loads. */
  rewards: readonly Reward[] | undefined;
  /** The catalogue failed to load (offline): show a calm note instead of "checking…". */
  rewardsError?: boolean;
  /** Reward currently applied to the cart (its points are spent at checkout). */
  applied?: Reward;
  index?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Roast loyalty hero (DESIGN.md §R3.B "Rewards"): the balance rolls up big (64/68) with a quiet
 * "pts", the tier in Fraunces italic peach (the screen's one serif moment), and a 6px bar to the
 * next reward. The faint "Ember" watermark stays; no eyebrow, no pill, no doodles.
 */
export function PointsHero({ balance, lifetime, rewards, rewardsError, applied, index = 0, style }: PointsHeroProps) {
  const c = useColors();
  const styles = useStyles();
  const { tier } = tierFor(lifetime);
  const progress = rewards ? nextRewardProgress(balance, rewards) : undefined;

  return (
    <Animated.View entering={enterUp(index)} style={[styles.card, style]}>
      <Text style={styles.watermark} color={withAlpha(c.white, 0.06)} aria-hidden accessibilityElementsHidden>
        Ember
      </Text>

      <View style={styles.balanceRow} accessible accessibilityLabel={`${formatCount(balance)} points`}>
        <RollingNumber
          value={balance}
          decimals={0}
          fontSize={64}
          lineHeight={68}
          fontFamily={fonts.bold}
          color={c.white}
          animateOnMount
          stagger={28}
        />
        <Text style={styles.unit} color={withAlpha(c.white, 0.7)}>
          pts
        </Text>
      </View>

      <Text style={styles.tier} color={c.peach} accessibilityLabel={`Tier: ${tier.name}`}>
        {tier.name}
      </Text>

      <View style={styles.progressBlock}>
        {progress === undefined ? (
          <Text style={styles.progressText} color={withAlpha(c.white, 0.7)}>
            {rewardsError ? 'Rewards show up once you’re back online.' : 'Checking what you can unlock…'}
          </Text>
        ) : progress.next ? (
          <Animated.View key={progress.next.id} entering={swapIn} style={styles.progressCopy}>
            <Text style={styles.progressText} color={withAlpha(c.white, 0.85)} numberOfLines={1}>
              {`${formatCount(progress.remaining)} pts to ${progress.next.name}`}
            </Text>
            <Text style={styles.progressGoal} color={withAlpha(c.white, 0.55)}>
              {formatCount(progress.next.cost)}
            </Text>
          </Animated.View>
        ) : (
          <Animated.View entering={swapIn} style={styles.progressCopy}>
            <Text style={styles.progressText} color={withAlpha(c.white, 0.85)}>
              Every reward is unlocked.
            </Text>
          </Animated.View>
        )}
        <ProgressBar ratio={progress?.ratio ?? 0} />
      </View>

      {applied ? (
        <Animated.View entering={swapIn}>
          <Text style={styles.applied} color={withAlpha(c.white, 0.7)} numberOfLines={2}>
            {`${applied.name} is applied · ${formatCount(applied.cost)} pts at checkout`}
          </Text>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

function ProgressBar({ ratio }: { ratio: number }) {
  const styles = useStyles();
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.set(withDelay(fill.get() === 0 ? 380 : 0, withSpring(ratio, springs.gentle)));
  }, [ratio, fill]);
  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.max(0, Math.min(1, fill.get())) }] }));
  return (
    <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}>
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    backgroundColor: c.roast,
    borderRadius: radii.sheet,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
    overflow: 'hidden',
  },
  watermark: {
    position: 'absolute',
    right: -18,
    bottom: -44,
    fontFamily: fonts.brand,
    fontSize: 132,
    lineHeight: 160,
  },
  balanceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  unit: { fontFamily: fonts.medium, fontSize: 20, lineHeight: 26, marginBottom: 9 },
  tier: { fontFamily: fonts.serif, fontSize: 20, lineHeight: 26, marginTop: 2 },
  progressBlock: { marginTop: 24, gap: 8 },
  progressCopy: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  progressText: { flexShrink: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  progressGoal: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  track: { height: 6, borderRadius: 3, backgroundColor: withAlpha(c.white, 0.2), overflow: 'hidden' },
  fill: { flex: 1, borderRadius: 3, backgroundColor: c.peach, transformOrigin: 'left' },
  applied: { marginTop: 14, fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
}));
