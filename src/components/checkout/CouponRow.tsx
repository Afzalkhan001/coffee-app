import { useState } from 'react';
import { ActivityIndicator, Keyboard, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { couponAllowedFor, findCoupon, isNetworkError, validateCoupon } from '@/api';
import { popIn, useShake } from '@/components/motion';
import { MAX_FONT_SCALE, PressableScale, Text, WEB_NO_FOCUS_RING } from '@/components/ui';
import { formatCount, formatMoney } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import type { CouponCheck } from '@/lib/pricing';
import { useCart } from '@/store/cart';
import { useSession } from '@/store/session';
import { fonts, makeStyles, spacing, useColors, useTheme } from '@/theme';
import type { Reward } from '@/types/models';
import { fieldsIn, fieldsOut } from './motion';
import { nestedLayout } from './LayoutBlock';

export interface CouponRowProps {
  subtotal: number;
  /** Applied code (from the cart store). */
  couponCode?: string;
  /** Live evaluation of the applied code against the current subtotal. */
  couponCheck?: CouponCheck;
}

/**
 * Inline promo field for a white sheet (R3 checkout): "Promo code" typed straight into the row,
 * an "Apply" text button (15/600 ink) and one caption under it ("Try WELCOME10"). An applied code
 * becomes "WELCOME10 · −₹58" with "Remove"; an invalid one shakes the row with the reason.
 */
export function CouponRow({ subtotal, couponCode, couponCheck }: CouponRowProps) {
  const { colors: c, keyboardAppearance } = useTheme();
  const styles = useStyles();
  const setCoupon = useCart((s) => s.setCoupon);
  const phone = useSession((s) => s.phone);
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { style: shakeStyle, shake } = useShake();

  /** Shake + haptic: `warning` for an empty field (a missing step), `error` for a rejected code. */
  const fail = (message: string, kind: 'warning' | 'error' = 'error') => {
    setError(message);
    shake();
    if (kind === 'warning') haptic.warning();
    else haptic.error();
  };

  const apply = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      fail('Enter a promo code first.', 'warning');
      return;
    }
    Keyboard.dismiss();
    setChecking(true);
    setError(null);
    try {
      const res = await validateCoupon(trimmed, subtotal, phone);
      if (res.ok) {
        setCoupon(res.coupon.code);
        setCode('');
        haptic.success();
      } else {
        fail(res.message);
      }
    } catch (e) {
      fail(isNetworkError(e) ? 'You’re offline. Try the code again once you’re connected.' : 'We couldn’t check that code. Try again.');
    }
    // (No `finally`: React Compiler can't lower try/finally and would skip this component.)
    setChecking(false);
  };

  // Only suggest FIRST20 to someone it works for; regulars get a code they can actually use.
  const first = findCoupon('FIRST20');
  const suggestion = !first || !phone || couponAllowedFor(first, phone) ? 'Try FIRST20' : 'Try WELCOME10';

  if (couponCode) {
    const ok = couponCheck?.ok === true;
    return (
      <Animated.View key="applied" entering={popIn()} exiting={fieldsOut} layout={nestedLayout}>
        <View style={styles.row}>
          <Text style={styles.code} numberOfLines={1}>
            {couponCode}
          </Text>
          {ok ? (
            <Text style={styles.saved} color={c.sageText}>
              {`−${formatMoney(couponCheck.discount)}`}
            </Text>
          ) : null}
          <PressableScale onPress={() => setCoupon(undefined)} activeScale={0.94} hitSlop={12} accessibilityLabel={`Remove code ${couponCode}`}>
            <Text style={styles.action} color={c.inkSoft}>
              Remove
            </Text>
          </PressableScale>
        </View>
        <Text variant="caption" color={ok ? c.inkSoft : c.danger} style={styles.caption}>
          {couponCheck && !couponCheck.ok ? couponCheck.message : 'Promo applied'}
        </Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View key="input" entering={fieldsIn} exiting={fieldsOut} layout={nestedLayout}>
      <Animated.View style={[styles.row, shakeStyle]}>
        <TextInput
          value={code}
          onChangeText={(t) => {
            setCode(t.toUpperCase());
            if (error) setError(null);
          }}
          onSubmitEditing={apply}
          placeholder="Promo code"
          placeholderTextColor={c.inkMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          enterKeyHint="done"
          selectionColor={c.ember}
          keyboardAppearance={keyboardAppearance}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          accessibilityLabel="Promo code"
          style={[styles.input, WEB_NO_FOCUS_RING, code ? styles.inputFilled : null]}
        />
        <PressableScale
          onPress={apply}
          disabled={checking}
          activeScale={0.94}
          hitSlop={12}
          accessibilityLabel="Apply promo code"
          style={styles.applyHit}
        >
          {checking ? (
            <ActivityIndicator size="small" color={c.ink} />
          ) : (
            <Text style={styles.apply} color={code.trim() ? c.ink : c.inkSoft}>
              Apply
            </Text>
          )}
        </PressableScale>
      </Animated.View>
      <Text variant="caption" color={error ? c.danger : c.inkMuted} style={styles.caption}>
        {error ?? suggestion}
      </Text>
    </Animated.View>
  );
}

/**
 * Redeemed loyalty reward (set from Rewards) as a sheet row, removable. With a `warning` (not
 * enough points, or nothing in the basket it applies to) the caption says why it takes ₹0 off.
 */
export function RewardChip({
  reward,
  discount,
  warning,
  onRemove,
}: {
  reward: Reward;
  /** What it actually takes off this basket (item rewards are capped at the item). */
  discount?: number;
  warning?: string | null;
  onRemove: () => void;
}) {
  const c = useColors();
  const styles = useStyles();
  const off = discount ?? reward.value;
  return (
    <Animated.View entering={popIn()} exiting={fieldsOut} layout={nestedLayout}>
      <View style={styles.row}>
        <Text style={styles.rewardName} numberOfLines={1}>
          {reward.name}
        </Text>
        {!warning && off > 0 ? (
          <Text style={styles.saved} color={c.sageText}>
            {`−${formatMoney(off)}`}
          </Text>
        ) : null}
        <PressableScale onPress={onRemove} activeScale={0.94} hitSlop={12} accessibilityLabel={`Remove reward ${reward.name}`}>
          <Text style={styles.action} color={c.inkSoft}>
            Remove
          </Text>
        </PressableScale>
      </View>
      <Text variant="caption" color={warning ? c.danger : c.inkSoft} style={styles.caption}>
        {warning ?? `Reward · ${formatCount(reward.cost)} pts`}
      </Text>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 56 },
  input: {
    flex: 1,
    minWidth: 0, // web: let the <input> shrink below its intrinsic width
    height: 56,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: c.ink,
  },
  inputFilled: { fontFamily: fonts.semibold, letterSpacing: 1 },
  applyHit: { minWidth: 48, height: 44, alignItems: 'flex-end', justifyContent: 'center' },
  apply: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
  caption: { marginTop: -8, paddingBottom: spacing.sm },
  code: { flex: 1, fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, letterSpacing: 0.8 },
  rewardName: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  saved: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
  action: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 18, textDecorationLine: 'underline' },
}));
