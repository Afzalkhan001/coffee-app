/**
 * Home header (DESIGN.md §R3.B Home 1–3, §7 "Home scroll"):
 * row 1 pin + "Pickup · ● Open until 9pm" over "Indiranagar ⌄" (the ordering-mode switch) · bell ·
 * cart (always pinned); row 2 "Morning, Ava" + points pill (slides under row 1 and fades); row 3 the
 * search pill (sticks under row 1 with a frosted backdrop).
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PointsPill, storeStatusLabel } from '@/components/domain';
import { exitFade, FrostedLayer, popIn, riseEntrance, withAlpha } from '@/components/motion';
import { CircleButton, Icon, PressableScale, Text } from '@/components/ui';
import { firstName } from '@/lib/format';
import { MODE_META } from '@/lib/orderFlow';
import { durations, fonts, layout, makeStyles, spacing, type as typeScale, useColors } from '@/theme';
import { useModeContext } from './modeContext';

/**
 * Fixed row heights keep the collapse math pure (no measuring).
 * Row 1: 8 + 48 + 4. Row 2: the greeting 16 below row 1's controls. Row 3: the 52px search pill
 * 16 below the greeting, with 8px of frost under it once it pins.
 */
export const HOME_ROW1 = 60;
export const HOME_ROW2 = 54;
export const HOME_ROW3 = 72;
/** Scroll content top padding below the safe area. */
export const HOME_HEADER_HEIGHT = HOME_ROW1 + HOME_ROW2 + HOME_ROW3;
/** Soft edge under the pinned search: content dissolves into the canvas instead of being sliced. */
const STICKY_FADE = 22;

// Location label swap when the ordering mode changes: a short rise + fade (fade only under Reduce Motion).
const labelIn = riseEntrance({ distance: 6, duration: durations.slow, small: true });

/** Status line text: "Open · until 9pm" → "Open until 9pm". */
const statusText = () => storeStatusLabel().replace(' · ', ' ');

/** "Morning" / "Afternoon" / "Evening" by the clock (R3 Home greeting). */
export function dayPart(date = new Date()): string {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'Morning';
  if (h >= 12 && h < 17) return 'Afternoon';
  return 'Evening';
}

// ── Row 1 ────────────────────────────────────────────────────

/** Pin + "Pickup · ● Open until 9pm" over "Indiranagar ⌄": the ordering-mode switch (opens the mode sheet). */
export function LocationButton({ onPress }: { onPress: () => void }) {
  const c = useColors();
  const styles = useStyles();
  const ctx = useModeContext();
  const modeLabel = MODE_META[ctx.mode].label;
  return (
    <PressableScale
      onPress={onPress}
      activeScale={0.97}
      style={styles.location}
      accessibilityLabel={`${ctx.sentence}${ctx.hint ? `, ${ctx.hint.toLowerCase()}` : ''}. Store ${statusText()}`}
      accessibilityHint="Change how and where you order"
    >
      <Icon name="location-outline" size={22} color={c.ink} />
      <View style={styles.locationCopy}>
        <Animated.View key={`${ctx.mode}:${ctx.place}:${ctx.hint ?? ''}`} entering={labelIn}>
          <View style={styles.eyebrowRow}>
            <Text style={styles.eyebrow} color={c.inkSoft} numberOfLines={1}>
              {`${modeLabel} ·`}
            </Text>
            <View style={styles.statusDot} />
            <Text style={styles.eyebrow} color={c.inkSoft} numberOfLines={1}>
              {statusText()}
            </Text>
          </View>
          <View style={styles.placeRow}>
            <Text style={styles.place} numberOfLines={1}>
              {ctx.place}
            </Text>
            {ctx.hint ? (
              <Text style={styles.hint} color={c.roastText} numberOfLines={1}>
                {`· ${ctx.hint}`}
              </Text>
            ) : null}
            <Icon name="chevron-down" size={16} color={c.ink} />
          </View>
        </Animated.View>
      </View>
    </PressableScale>
  );
}

/** 44px white bell circle with a small sage dot while there are unread updates. */
export function BellButton({ unread, onPress }: { unread: boolean; onPress: () => void }) {
  const styles = useStyles();
  return (
    <View>
      <CircleButton
        icon="notifications-outline"
        size={layout.headerButton}
        tone="white"
        onPress={onPress}
        accessibilityLabel={unread ? 'Notifications, new updates' : 'Notifications'}
      />
      {unread ? <Animated.View entering={popIn(3)} exiting={exitFade} style={styles.unreadDot} /> : null}
    </View>
  );
}

// ── Row 2 ────────────────────────────────────────────────────

/** "Morning, Ava" (Outfit 300 + the name in the Fraunces italic) with the points pill on the right. */
export function GreetingRow({ name, points, onPointsPress }: { name?: string; points: number; onPointsPress: () => void }) {
  const styles = useStyles();
  const first = firstName(name);
  const part = dayPart();
  return (
    <View style={styles.greetingRow}>
      <Text
        style={styles.greeting}
        numberOfLines={1}
        accessibilityRole="header"
        accessibilityLabel={first ? `Good ${part.toLowerCase()}, ${first}` : `Good ${part.toLowerCase()}`}
      >
        {first ? `${part}, ` : part}
        {first ? <Text style={styles.greetingName}>{first}</Text> : null}
      </Text>
      <PointsPill points={points} onPress={onPointsPress} />
    </View>
  );
}

// ── Collapsing shell ─────────────────────────────────────────

export interface CollapsingHomeHeaderProps {
  scrollY: SharedValue<number>;
  row1: ReactNode;
  row2: ReactNode;
  row3: ReactNode;
}

/**
 * Overlay above the Home scroll view. Rows 2+3 translate up with the content by up to ROW2
 * (row 2 slides *under* row 1 via a clip), then row 3 pins. The frosted backdrop fades in only
 * once content starts passing underneath. Transform + opacity only, all on the UI thread.
 */
export function CollapsingHomeHeader({ scrollY, row1, row2, row3 }: CollapsingHomeHeaderProps) {
  const c = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -Math.min(Math.max(scrollY.get(), 0), HOME_ROW2) }],
  }));
  const greetingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [0, HOME_ROW2 * 0.6], [1, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(scrollY.get(), [0, HOME_ROW2], [1, 0.96], Extrapolation.CLAMP) }],
  }));
  // Frost is fully in by the time row 3 pins (scroll = ROW2), as the greeting finishes fading out.
  const backdropProgress = useDerivedValue(() =>
    interpolate(scrollY.get(), [HOME_ROW2 * 0.5, HOME_ROW2], [0, 1], Extrapolation.CLAMP),
  );
  const fadeStyle = useAnimatedStyle(() => ({ opacity: backdropProgress.get() }));
  const stickyHeight = insets.top + HOME_ROW1 + HOME_ROW3;

  return (
    <>
      {/* Opaque canvas behind the pinned rows (nothing ghosts through), then a soft canvas fade. */}
      <FrostedLayer progress={backdropProgress} height={stickyHeight} fillOpacity={1} edge={false} />
      <Animated.View style={[styles.stickyFade, { top: stickyHeight }, fadeStyle]}>
        {/* Eased: nearly opaque for the first third, so a passing banner edge reads as dissolving, not as a sliver. */}
        <LinearGradient
          colors={[c.bg, withAlpha(c.bg, 0.82), withAlpha(c.bg, 0)]}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <View style={[styles.clip, { top: insets.top + HOME_ROW1, height: HOME_ROW2 + HOME_ROW3 }]}>
        <Animated.View style={[styles.passThrough, slideStyle]}>
          <Animated.View style={[styles.row2, greetingStyle]}>{row2}</Animated.View>
          <View style={styles.row3}>{row3}</View>
        </Animated.View>
      </View>
      <View style={[styles.row1, { paddingTop: insets.top + 8, height: insets.top + HOME_ROW1 }]}>{row1}</View>
    </>
  );
}

const useStyles = makeStyles((c) => ({
  // Row 1
  row1: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.gutter,
    pointerEvents: 'box-none',
  },
  location: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingLeft: 2 },
  locationCopy: { flex: 1, minWidth: 0 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  eyebrow: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, flexShrink: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.sageText },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  place: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22, color: c.ink, flexShrink: 1 },
  hint: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, flexShrink: 0 },
  unreadDot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: c.sage,
    borderWidth: 1.5,
    borderColor: c.surface,
    pointerEvents: 'none',
  },
  // Row 2: the greeting sits 16 below row 1's 48px controls (row 1 ends 4 below them).
  greetingRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.gutter,
    paddingTop: 12,
  },
  greeting: { ...typeScale.greeting, flex: 1, minWidth: 0, color: c.ink },
  greetingName: { ...typeScale.greetingName, color: c.ink },
  // Shell
  stickyFade: { position: 'absolute', left: 0, right: 0, height: STICKY_FADE, pointerEvents: 'none' },
  clip: { position: 'absolute', left: 0, right: 0, overflow: 'hidden', pointerEvents: 'box-none' },
  passThrough: { pointerEvents: 'box-none' },
  row2: { height: HOME_ROW2 },
  // 16 above the pill, 4 below it (the frost fades out over its 10px edge below that).
  row3: { height: HOME_ROW3, justifyContent: 'flex-start', paddingTop: 16, paddingHorizontal: spacing.gutter },
}));
