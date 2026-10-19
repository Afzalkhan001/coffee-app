import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { ArtThumb } from '@/components/domain';
import { ConfettiBurst, withAlpha } from '@/components/motion';
import { Icon, PillButton, PressableScale, Text } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { fonts, makeStyles, makeThemed, spacing, springs, useColors } from '@/theme';
import type { Reward } from '@/types/models';
import { pseudoQrPath, ticketPath } from './format';
import { ModalSheet } from './ModalSheet';

/** The reward's cut-out on its tinted tile (R3: no circle, no ring). */
const PHOTO = 88;
const QR = 132;
const PERFORATION = 30;
/** Accent fills (identical in both schemes). */
const useConfetti = makeThemed((c) => [c.peach, c.sage, c.roast, c.peachSoft]);
/**
 * Dark (R4): the surface ticket gets a faint white edge to lift it off the scrim, and "Done" is the
 * cream ink pill (the brightest thing on screen, like every primary action in dark). Light keeps R3.
 */
const useTicketLook = makeThemed((c, t) => ({
  edge: t.isDark ? withAlpha(c.white, 0.1) : undefined,
  doneTone: t.isDark ? ('ink' as const) : ('white' as const),
}));

export interface RedeemTicketProps {
  visible: boolean;
  /** Kept by the caller after closing so the exit animation still has content. */
  reward: Reward | undefined;
  code: string;
  /** Celebrate (confetti) — true right after redeeming, false when re-opening an applied reward. */
  fresh: boolean;
  onClose: () => void;
  /** Take the reward back off the next order. */
  onRemove: () => void;
}

/**
 * Perforated redeem ticket (design-refs addition 10): a real cut-out shape (SVG path with two
 * notches), a QR-style code block and a short code — springs in with a little tilt and confetti.
 * "Remove from my next order" lives on the ticket itself (ink on white), never on the dimmed
 * backdrop where it collided with the list behind.
 */
export function RedeemTicket({ visible, reward, code, fresh, onClose, onRemove }: RedeemTicketProps) {
  const c = useColors();
  const styles = useStyles();
  const confetti = useConfetti();
  const look = useTicketLook();
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.min(340, windowWidth - spacing.xl * 2);
  const [ticketH, setTicketH] = useState(0);
  const [topH, setTopH] = useState(0);
  const measured = ticketH > 0 && topH > 0;
  const tilt = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    tilt.set(withSequence(withTiming(-5, { duration: 0 }), withSpring(0, springs.bouncy)));
  }, [visible, tilt]);

  const tiltStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${tilt.get()}deg` }] }));

  return (
    <ModalSheet visible={visible} onClose={onClose} placement="center" bare accessibilityLabel="Reward ticket" contentStyle={styles.modal}>
      {reward ? (
        <>
          <Animated.View style={[{ width }, tiltStyle]}>
            {measured ? (
              <Svg width={width} height={ticketH} style={StyleSheet.absoluteFill}>
                <Path
                  d={ticketPath(width, ticketH, topH + PERFORATION / 2)}
                  fill={c.surface}
                  stroke={look.edge}
                  strokeWidth={look.edge ? 1 : 0}
                />
              </Svg>
            ) : null}

            <View
              style={[styles.ticket, measured ? null : styles.measuring]}
              onLayout={(e) => setTicketH(e.nativeEvent.layout.height)}
            >
              <View style={styles.top} onLayout={(e) => setTopH(e.nativeEvent.layout.height)}>
                <ArtThumb image={reward.image} size={PHOTO} />
                <Text style={styles.eyebrow} color={c.sageText}>
                  Reward unlocked
                </Text>
                <Text style={styles.name} align="center">
                  {reward.name}
                </Text>
                <View style={styles.appliedRow}>
                  <Icon name="checkmark-circle" size={16} color={c.sageText} />
                  <Text variant="caption" color={c.inkSoft} style={styles.appliedText}>
                    {`Applied to your next order · up to ${formatMoney(reward.value)} off`}
                  </Text>
                </View>
              </View>

              <View style={styles.perforation}>
                <View style={styles.dashes} />
              </View>

              <View style={styles.bottom} accessible accessibilityLabel={`Redeem code ${code.split('').join(' ')}. Show this to your barista.`}>
                <Svg width={QR} height={QR} viewBox={`0 0 ${QR} ${QR}`}>
                  <Path d={pseudoQrPath(code, QR)} fill={c.ink} />
                </Svg>
                <Text style={styles.code}>{code}</Text>
                <Text variant="caption" color={c.inkSoft}>
                  Show this to your barista
                </Text>
                <PressableScale
                  onPress={onRemove}
                  style={styles.remove}
                  accessibilityLabel="Remove reward from my next order"
                >
                  <Text style={styles.removeText} color={c.inkSoft}>
                    Remove from my next order
                  </Text>
                </PressableScale>
              </View>
            </View>
            {fresh ? <ConfettiBurst play={visible} colors={confetti} originY={PHOTO} count={24} seed={7} /> : null}
          </Animated.View>

          <View style={[styles.actions, { width }]}>
            <PillButton label="Done" tone={look.doneTone} fullWidth onPress={onClose} />
          </View>
        </>
      ) : null}
    </ModalSheet>
  );
}

const useStyles = makeStyles((c) => ({
  modal: { alignItems: 'center' },
  ticket: { paddingHorizontal: spacing.xl },
  measuring: { opacity: 0 },
  top: { alignItems: 'center', paddingTop: spacing.xl },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18, marginTop: spacing.md },
  name: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, color: c.ink, marginTop: 4 },
  appliedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.xs },
  appliedText: { flexShrink: 1, fontFamily: fonts.medium },
  perforation: { height: PERFORATION, justifyContent: 'center' },
  dashes: { borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: c.line, marginHorizontal: spacing.xxs },
  bottom: { alignItems: 'center', paddingBottom: spacing.md, gap: spacing.xs },
  code: { fontFamily: fonts.extrabold, fontSize: 26, lineHeight: 32, letterSpacing: 4, color: c.ink, marginTop: spacing.sm },
  actions: { marginTop: spacing.lg, alignItems: 'center' },
  remove: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xxs,
  },
  removeText: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 19, textDecorationLine: 'underline' },
}));
