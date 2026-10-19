import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { enterFade, enterUp, layoutSpring } from '@/components/motion';
import { Icon, PressableScale, Text } from '@/components/ui';
import { formatTime, relativeDay } from '@/lib/format';
import { fonts, makeStyles, radii, useColors } from '@/theme';
import type { LoyaltyTransaction, LoyaltyTxnType } from '@/types/models';
import { brand } from '@/theme/brand';
import { SPEND_PER_POINT, signedPoints, sortTransactions } from './format';

const COLLAPSED = 5;
const PAD = 16;

const TYPE_LABEL: Record<LoyaltyTxnType, string> = { earn: 'Earned', redeem: 'Redeemed', bonus: 'Bonus' };

export interface PointsHistoryProps {
  transactions: readonly LoyaltyTransaction[];
  index?: number;
  style?: StyleProp<ViewStyle>;
}

/** Points ledger (PRD §17): earn +, redeem −, bonus, newest first, in one white sheet; long lists expand in place. */
export function PointsHistory({ transactions, index = 0, style }: PointsHistoryProps) {
  const c = useColors();
  const styles = useStyles();
  const [expanded, setExpanded] = useState(false);
  const sorted = sortTransactions(transactions);
  const shown = expanded ? sorted : sorted.slice(0, COLLAPSED);
  const hidden = sorted.length - shown.length;

  if (sorted.length === 0) {
    return (
      <Animated.View entering={enterUp(index)} style={[styles.sheet, styles.empty, style]}>
        <Text style={styles.caption} color={c.inkSoft} align="center">
          {`No points yet. Every ${brand.currency.symbol}${SPEND_PER_POINT} earns 1 pt.`}
        </Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={enterUp(index)} layout={layoutSpring} style={[styles.sheet, style]}>
      {shown.map((txn, i) => (
        <Animated.View key={txn.id} entering={i >= COLLAPSED ? enterFade(i - COLLAPSED) : undefined}>
          {i > 0 ? <View style={styles.divider} /> : null}
          <TxnRow txn={txn} />
        </Animated.View>
      ))}
      {hidden > 0 || expanded ? (
        <PressableScale
          onPress={() => setExpanded((v) => !v)}
          activeScale={0.98}
          style={styles.more}
          accessibilityLabel={expanded ? 'Show less' : `Show all ${sorted.length} transactions`}
        >
          <Text style={styles.moreText} color={c.ink}>
            {expanded ? 'Show less' : `Show all ${sorted.length}`}
          </Text>
          <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={c.ink} />
        </PressableScale>
      ) : null}
    </Animated.View>
  );
}

function TxnRow({ txn }: { txn: LoyaltyTransaction }) {
  const c = useColors();
  const styles = useStyles();
  const positive = txn.points >= 0;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${TYPE_LABEL[txn.type]}: ${txn.description}, ${signedPoints(txn.points)} points, ${relativeDay(txn.createdAt)}`}
    >
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={1}>
          {txn.description}
        </Text>
        <Text style={styles.caption} color={c.inkSoft}>
          {`${relativeDay(txn.createdAt)} · ${formatTime(txn.createdAt)}`}
        </Text>
      </View>
      <Text style={styles.points} color={positive ? c.sageText : c.ink}>
        {signedPoints(txn.points)}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  sheet: { backgroundColor: c.surface, borderRadius: radii.lg, overflow: 'hidden' },
  empty: { padding: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: PAD, paddingVertical: 10 },
  divider: { height: StyleSheet.hairlineWidth * 2, backgroundColor: c.line, marginHorizontal: PAD },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: c.ink },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  points: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20 },
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 52,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: c.line,
  },
  moreText: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 19 },
}));
