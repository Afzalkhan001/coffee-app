import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { enterFade, enterUp, exitFade, layoutSpring, PulseRing, withAlpha } from '@/components/motion';
import { Icon, Text } from '@/components/ui';
import { formatTime } from '@/lib/format';
import { STATUS_FLOW, statusDescription, statusLabel } from '@/lib/orderFlow';
import { fonts, makeStyles, makeThemed, springs, useColors } from '@/theme';
import type { Order, OrderStatus } from '@/types/models';
import { useValueChange } from './hooks';

const DOT = 26;
const LINE = 2;
const FILL_MS = 520;
const easeOutQuint = Easing.bezier(0.22, 1, 0.36, 1);
/** Sage → deep sage (accents: the same in both schemes). */
const useFillGradient = makeThemed((c) => [c.sage, c.sageDeep] as const);

type StepState = 'done' | 'current' | 'upcoming' | 'cancelled';

interface Step {
  status: OrderStatus;
  state: StepState;
  at?: string;
}

/** Steps for the order's mode; a cancelled order shows what it reached, then "Cancelled". */
function buildSteps(order: Order): Step[] {
  const atOf = (s: OrderStatus) => order.history.find((h) => h.status === s)?.at;
  if (order.status === 'cancelled') {
    const reached = STATUS_FLOW[order.details.mode].filter((s) => order.history.some((h) => h.status === s));
    return [
      ...reached.map((s) => ({ status: s, state: 'done' as const, at: atOf(s) })),
      { status: 'cancelled', state: 'cancelled', at: atOf('cancelled') },
    ];
  }
  const flow = STATUS_FLOW[order.details.mode];
  const current = Math.max(0, flow.indexOf(order.status));
  const finished = order.status === 'completed';
  return flow.map((s, i) => ({
    status: s,
    state: i < current || (finished && i === current) ? 'done' : i === current ? 'current' : 'upcoming',
    at: i <= current ? atOf(s) : undefined,
  }));
}

export interface StatusTimelineProps {
  order: Order;
  /**
   * The current (or cancelled) step's one-line description under its label. Default true; the
   * tracking screen turns it off because its hero already says the same line right above.
   */
  descriptions?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Vertical order stepper (DESIGN.md §5): sage done dots with checks, an ink current dot
 * with a pulsing ring, hollow upcoming dots. When the status advances, the connector
 * fills top-down with a sage sweep and the next dot pops in.
 */
export function StatusTimeline({ order, descriptions = true, style }: StatusTimelineProps) {
  const steps = buildSteps(order);
  const mode = order.details.mode;
  return (
    <View style={style} accessibilityRole="list">
      {steps.map((step, i) => {
        const next = steps[i + 1];
        return (
          // layout: when a status advances the description moves to the next row, so row heights
          // swap — the spring reflow keeps that from snapping.
          <Animated.View key={step.status} entering={enterUp(i)} layout={layoutSpring}>
            <StepRow
              step={step}
              label={statusLabel(step.status, mode)}
              description={
                descriptions && (step.state === 'current' || step.state === 'cancelled')
                  ? statusDescription(step.status, mode, !!order.arrived)
                  : undefined
              }
              connector={next ? (next.state === 'upcoming' ? 'empty' : 'filled') : 'none'}
            />
          </Animated.View>
        );
      })}
    </View>
  );
}

function StepRow({
  step,
  label,
  description,
  connector,
}: {
  step: Step;
  label: string;
  description?: string;
  connector: 'filled' | 'empty' | 'none';
}) {
  const upcoming = step.state === 'upcoming';
  const c = useColors();
  const styles = useStyles();
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${label}${step.at ? `, ${formatTime(step.at)}` : ''}${upcoming ? ', upcoming' : step.state === 'current' ? ', in progress' : ''}`}
    >
      <View style={styles.rail}>
        <StepDot state={step.state} />
        {connector !== 'none' ? <Connector filled={connector === 'filled'} /> : null}
      </View>
      <View style={[styles.body, connector === 'none' ? null : styles.bodySpaced]}>
        <View style={styles.titleRow}>
          <Text
            style={[styles.label, { fontFamily: upcoming ? fonts.medium : fonts.semibold }]}
            color={upcoming ? c.inkSoft : step.state === 'cancelled' ? c.danger : c.ink}
            numberOfLines={2}
          >
            {label}
          </Text>
          {step.at ? (
            <Text variant="caption" color={c.inkSoft}>
              {formatTime(step.at)}
            </Text>
          ) : null}
        </View>
        {description ? (
          <Animated.View key={description} entering={enterFade(2)} exiting={exitFade}>
            <Text variant="caption" color={c.inkSoft} style={styles.description}>
              {description}
            </Text>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

function StepDot({ state }: { state: StepState }) {
  const scale = useSharedValue(1);

  // A step that just became current/done pops in after the connector above it has filled.
  useValueChange(state, (next, prev) => {
    if (prev === 'upcoming' && next !== 'upcoming') {
      // Hidden while the connector above fills, then pops 0 → 1 (DESIGN §7: fill first, then the dot).
      scale.set(withSequence(withTiming(0, { duration: 0 }), withDelay(FILL_MS - 120, withSpring(1, springs.bouncy))));
    } else if (prev === 'current' && next === 'done') {
      scale.set(withSequence(withSpring(1.18, springs.snappy), withSpring(1, springs.snappy)));
    }
  });

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const c = useColors();
  const styles = useStyles();
  const dotStyles = useDotStyles();

  return (
    <View style={styles.dotBox}>
      {state === 'current' ? (
        <View style={styles.pulse}>
          {/* A faint ink halo that stays inside the row (1.3×), not a grey disc bleeding into the sheet. */}
          <PulseRing size={DOT} color={withAlpha(c.ink, 0.14)} variant="soft" active />
        </View>
      ) : null}
      <Animated.View style={[styles.dot, dotStyles[state], popStyle]}>
        {state === 'done' ? <Icon name="checkmark" size={15} color={c.white} /> : null}
        {state === 'cancelled' ? <Icon name="close" size={15} color={c.white} /> : null}
        {state === 'current' ? <View style={styles.core} /> : null}
      </Animated.View>
    </View>
  );
}

function Connector({ filled }: { filled: boolean }) {
  const fill = useSharedValue(filled ? 1 : 0);

  useValueChange(filled, (next) => {
    fill.set(withTiming(next ? 1 : 0, { duration: next ? FILL_MS : 200, easing: easeOutQuint }));
  });

  // Clamped: the spring's first frame can dip below 0, which flips the gradient above the dot.
  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: Math.max(0, fill.get()) }] }));
  const styles = useStyles();
  const gradient = useFillGradient();

  return (
    <View style={styles.track}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.fill, fillStyle]}>
        <LinearGradient colors={gradient} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

/** The current dot is the ink fill (cream in dark) with an `onInk` core. */
const useDotStyles = makeStyles((c) => ({
  done: { backgroundColor: c.sage },
  current: { backgroundColor: c.ink },
  upcoming: { backgroundColor: c.surface, borderWidth: 2, borderColor: c.line },
  cancelled: { backgroundColor: c.danger },
}));

const useStyles = makeStyles((c) => ({
  row: { flexDirection: 'row', gap: 14 },
  rail: { width: DOT, alignItems: 'center' },
  dotBox: { width: DOT, height: DOT, alignItems: 'center', justifyContent: 'center' },
  pulse: { position: 'absolute', width: DOT, height: DOT, alignItems: 'center', justifyContent: 'center' },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, alignItems: 'center', justifyContent: 'center' },
  core: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.onInk },
  track: {
    flex: 1,
    width: LINE,
    minHeight: 18,
    marginVertical: 4,
    borderRadius: LINE / 2,
    backgroundColor: c.line,
    overflow: 'hidden',
  },
  fill: { transformOrigin: 'top', borderRadius: LINE / 2 },
  body: { flex: 1, paddingTop: 2 },
  bodySpaced: { paddingBottom: 22 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  label: { flexShrink: 1, fontSize: 15, lineHeight: 21 },
  description: { marginTop: 3, maxWidth: 280 },
}));
