/**
 * The three onboarding pages (presentational; state lives in src/app/onboarding.tsx).
 *
 * R3 (DESIGN.md §R3.B): each page is just its own doodles plus a big light headline on the night
 * canvas, 34px under the shared sage capsule. Page 2 adds one body line, page 3 one switch row for
 * the separate marketing consent (PRD §7); permission results replace them with a short note. The forward button, capsule, dots and the
 * croissant/portafilter pair are screen-level and live in the route.
 *
 * Every layer moves at its own speed relative to its page (DESIGN.md §7): doodles at 1.2×,
 * headline line 1 at ~0.58×, line 2 ~0.65×, line 3 ~0.72×, body / row ~0.8×. The first page also
 * plays a staggered entrance as the launch splash lifts.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, type SharedValue } from 'react-native-reanimated';
import { easeOutQuint, enterUp, withAlpha } from '@/components/motion';
import { Text } from '@/components/ui';
import { formatKm } from '@/lib/geo';
import { canUseNotifications } from '@/lib/notify';
import { fonts, useColors } from '@/theme';
import { brand } from '@/theme/brand';
import type { NotificationPrefs, PermissionState } from '@/types/models';
import { DoodleField, type DoodleSet } from './OnboardingArt';
import { GUTTER, type OnboardingMetrics } from './onboardingLayout';
import { Parallax } from './pagerParts';
import { ToggleSwitch } from './ToggleSwitch';

/** Body copy on night: white 58%. */
const BODY_ALPHA = 0.58;
const swapIn = FadeIn.duration(260).easing(easeOutQuint);

interface PagerContext {
  index: number;
  scrollX: SharedValue<number>;
  m: OnboardingMetrics;
  /** Play entrance animations (only the first page is on screen when the splash lifts). */
  enter: boolean;
}

// ── Building blocks ──────────────────────────────────────────────────────────

function Headline({ lines, ctx, enterFrom = 0 }: { lines: string[]; ctx: PagerContext; enterFrom?: number }) {
  const c = useColors();
  const { index, scrollX, m, enter } = ctx;
  return (
    <View accessible accessibilityRole="header" accessibilityLabel={lines.join(' ')}>
      {lines.map((line, i) => (
        <Animated.View key={i} entering={enter ? enterUp(enterFrom + i) : undefined}>
          <Parallax scrollX={scrollX} index={index} width={m.frame} factor={0.42 - i * 0.07}>
            <Text style={[styles.headline, m.headline]} color={c.white} numberOfLines={1}>
              {line}
            </Text>
          </Parallax>
        </Animated.View>
      ))}
    </View>
  );
}

function Layer({ ctx, factor, children }: { ctx: PagerContext; factor: number; children: ReactNode }) {
  return (
    <Parallax scrollX={ctx.scrollX} index={ctx.index} width={ctx.m.frame} factor={factor}>
      {children}
    </Parallax>
  );
}

function Page({ ctx, art, children }: { ctx: PagerContext; art: DoodleSet | null; children: ReactNode }) {
  const { m, scrollX, index } = ctx;
  return (
    <View style={{ width: m.frame, height: m.height }}>
      {art ? (
        <Parallax
          scrollX={scrollX}
          index={index}
          width={m.frame}
          factor={-0.2}
          fade={false}
          style={[styles.band, { height: m.band + 40 }]}
        >
          <DoodleField set={art} width={m.frame} band={m.band} safeTop={m.fieldSafeTop} delay={index === 0 ? 200 : 60} />
        </Parallax>
      ) : null}
      <View style={[styles.text, { top: m.headTop }]}>{children}</View>
    </View>
  );
}

// ── 1 · Welcome ──────────────────────────────────────────────────────────────

export function WelcomePage({ scrollX, m }: { scrollX: SharedValue<number>; m: OnboardingMetrics }) {
  const ctx: PagerContext = { index: 0, scrollX, m, enter: true };
  return (
    <Page ctx={ctx} art="page1">
      <Headline ctx={ctx} enterFrom={3} lines={['Good coffee,', 'ready when', 'you are']} />
    </Page>
  );
}

// ── 2 · Location ─────────────────────────────────────────────────────────────

export interface LocationPageProps {
  scrollX: SharedValue<number>;
  m: OnboardingMetrics;
  /** The page has started sliding into view (mounts its doodles so they draw on as it arrives). */
  revealed: boolean;
  permission: PermissionState;
}

function locationCopy(permission: PermissionState): string {
  if (permission === 'granted') return `Location on. ${brand.store.shortName} is ${formatKm(brand.store.distanceKm)} away.`;
  if (permission === 'denied') return 'Location is off. You can still pick your café by hand.';
  return 'We’ll show what’s open near you and where we deliver.';
}

export function LocationPage({ scrollX, m, revealed, permission }: LocationPageProps) {
  const c = useColors();
  const ctx: PagerContext = { index: 1, scrollX, m, enter: false };
  const copy = locationCopy(permission);
  return (
    <Page ctx={ctx} art={revealed ? 'page2' : null}>
      <Headline ctx={ctx} lines={['Find your', 'nearest café']} />
      <Layer ctx={ctx} factor={0.2}>
        <Animated.View key={copy} entering={permission === 'undetermined' ? undefined : swapIn} accessibilityLiveRegion="polite">
          <Text style={[styles.body, { maxWidth: m.bodyWidth }]} color={withAlpha(c.white, BODY_ALPHA)} numberOfLines={2}>
            {copy}
          </Text>
        </Animated.View>
      </Layer>
    </Page>
  );
}

// ── 3 · Order alerts ─────────────────────────────────────────────────────────

export interface AlertsPageProps {
  scrollX: SharedValue<number>;
  m: OnboardingMetrics;
  revealed: boolean;
  permission: PermissionState;
  prefs: NotificationPrefs;
  onPrefsChange: (patch: Partial<NotificationPrefs>) => void;
}

function alertsNote(permission: PermissionState): string | null {
  if (permission === 'granted') return 'You’re all set. We’ll tell you when it’s ready.';
  if (permission === 'denied') {
    return canUseNotifications ? 'Alerts are off. Order status still shows in the app.' : 'This preview can’t send alerts. Order status shows in the app.';
  }
  return null;
}

export function AlertsPage({ scrollX, m, revealed, permission, prefs, onPrefsChange }: AlertsPageProps) {
  const c = useColors();
  const ctx: PagerContext = { index: 2, scrollX, m, enter: false };
  const note = alertsNote(permission);
  return (
    <Page ctx={ctx} art={revealed ? 'page3' : null}>
      <Headline ctx={ctx} lines={['Know when', 'it’s ready']} />
      <Layer ctx={ctx} factor={0.2}>
        {note ? (
          <Animated.View key={note} entering={swapIn} accessibilityLiveRegion="polite">
            <Text style={[styles.body, { maxWidth: m.bodyWidth }]} color={withAlpha(c.white, BODY_ALPHA)} numberOfLines={2}>
              {note}
            </Text>
          </Animated.View>
        ) : (
          // Order-status alerts come with the button; marketing is its own opt-in (PRD §7).
          <View style={[styles.row, { maxWidth: m.bodyWidth }]}>
            <Text style={styles.rowTitle} color={c.white} numberOfLines={1}>
              Also send offers
            </Text>
            <ToggleSwitch value={prefs.marketing} onValueChange={(v) => onPrefsChange({ marketing: v })} accessibilityLabel="Also send offers" />
          </View>
        )}
      </Layer>
    </Page>
  );
}

const styles = StyleSheet.create({
  band: { position: 'absolute', left: 0, right: 0, top: 0 },
  text: { position: 'absolute', left: GUTTER, right: GUTTER },
  headline: { fontFamily: fonts.light },
  body: { marginTop: 12, fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  row: { marginTop: 16, height: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  rowTitle: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 16, lineHeight: 22 },
});
