/**
 * Floating blurred pill tab bar for expo-router js-tabs (DESIGN §5 / §7):
 * the active tab is an ink pill (icon + label) that slides AND stretches between tabs
 * (two edge springs: the leading edge is stiff, the trailing edge soft); inactive tabs are
 * 48px icon circles whose icons turn white exactly as the pill passes under them.
 * Dark (R4): a frosted espresso bar with a faint edge; the pill inverts (cream, espresso glyphs).
 */
import { BlurView } from 'expo-blur';
import { router, type Href } from 'expo-router';
import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from 'expo-router/js-tabs';
import { use, useEffect, useState, type ReactNode } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  clamp,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LineIcon, type LineIconName } from '@/components/ui';
import { withAlpha } from '@/components/motion/color';
import { easeOutQuint } from '@/components/motion/hooks';
import { haptic } from '@/lib/haptics';
import { takePendingHref } from '@/store/session';
import { layout, makeStyles, radii, springs, type as typeScale, useTheme } from '@/theme';

/** Bar height (excluding the gap below it and the safe area). */
export const TAB_BAR_HEIGHT = layout.tabBarHeight;
/** Bottom space tab screens must reserve, excluding the safe-area inset: bar + gap. */
export const TAB_BAR_SPACE = layout.tabBarHeight + layout.tabBarInset;

const INSET = layout.tabBarInset;

/** Distance from the screen bottom to the bar's bottom edge (it never sits closer than 16px). */
export function tabBarBottom(safeAreaBottom: number): number {
  return Math.max(safeAreaBottom, INSET);
}

/**
 * Exact bottom padding for a tab screen's scroll content: the bar's real top edge plus
 * `breathing` px of air (default 16). Prefer this over `TAB_BAR_SPACE + insets.bottom`, which
 * leaves no air above the bar on devices without a home indicator (Android, web).
 * Add `FLOATING_CART_BAR_SPACE` (domain) while the floating cart bar is showing.
 */
export function useTabBarSpace(breathing?: number): number {
  const insets = useSafeAreaInsets();
  return tabBarBottom(insets.bottom) + TAB_BAR_HEIGHT + (breathing ?? layout.tabBarInset);
}
const ITEM = 48;
const PAD_X = 8;
const PAD_Y = (TAB_BAR_HEIGHT - ITEM) / 2;
const ICON = 22;
const ICON_LEFT = (ITEM - ICON) / 2;
const LABEL_GAP = 7;
const PILL_RIGHT = 17;
// Leading edge fast, trailing edge slow → the pill stretches toward the new tab, then catches up.
const EDGE_FAST = { mass: 1, damping: 26, stiffness: 340 } as const;
const EDGE_SLOW = { mass: 1, damping: 22, stiffness: 150 } as const;

const IS_ANDROID = Platform.OS === 'android';
const IS_IOS = Platform.OS === 'ios';

/**
 * Custom line glyphs (LineIcon) per route. Active and inactive use the SAME glyph — white on the ink
 * pill vs inkSoft on the bar — so the cross-fade under the sliding pill is a pure colour change.
 */
const ICONS: Record<string, LineIconName> = {
  index: 'home',
  menu: 'menu',
  orders: 'orders',
  rewards: 'rewards',
  profile: 'profile',
};
const FALLBACK_ICON: LineIconName = 'cup';

interface Slot {
  x: number;
  w: number;
}

interface TabItemProps {
  label: string;
  accessibilityLabel: string;
  focused: boolean;
  slot: Slot;
  icon: LineIconName;
  badge: boolean;
  left: SharedValue<number>;
  right: SharedValue<number>;
  onPress: () => void;
  onLongPress: () => void;
}

function TabItem({ label, accessibilityLabel, focused, slot, icon, badge, left, right, onPress, onLongPress }: TabItemProps) {
  const reduced = useReducedMotion();
  const { colors: c } = useTheme();
  const styles = useStyles();
  const x = useSharedValue(slot.x);
  const w = useSharedValue(slot.w);
  const focus = useSharedValue(focused ? 1 : 0);
  const pressed = useSharedValue(0);

  useEffect(() => {
    x.set(withSpring(slot.x, springs.smooth));
    w.set(withSpring(slot.w, springs.smooth));
  }, [slot.x, slot.w, x, w]);

  useEffect(() => {
    focus.set(withSpring(focused ? 1 : 0, springs.smooth));
  }, [focused, focus]);

  // How much of this tab's icon the ink pill currently covers (0..1).
  const cover = useDerivedValue(() => {
    const iconL = x.get() + ICON_LEFT;
    const overlap = Math.min(right.get(), iconL + ICON) - Math.max(left.get(), iconL);
    return clamp(overlap / ICON, 0, 1);
  });

  const boxStyle = useAnimatedStyle(() => ({
    width: w.get(),
    transform: [{ translateX: x.get() }],
  }));
  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reduced ? 1 : 1 - 0.08 * pressed.get() }],
  }));
  const outlineStyle = useAnimatedStyle(() => ({ opacity: 1 - cover.get() }));
  const filledStyle = useAnimatedStyle(() => ({ opacity: cover.get() }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(focus.get(), [0.45, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateX: interpolate(focus.get(), [0, 1], [-6, 0]) }],
  }));

  return (
    <Animated.View style={[styles.item, boxStyle]}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={() => pressed.set(withSpring(1, springs.snappy))}
        onPressOut={() => pressed.set(withSpring(0, springs.snappy))}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={accessibilityLabel}
        style={styles.press}
      >
        <Animated.View style={[styles.content, contentStyle]}>
          <View style={styles.iconBox}>
            <Animated.View style={[styles.iconLayer, outlineStyle]}>
              <LineIcon name={icon} size={ICON} color={c.inkSoft} />
            </Animated.View>
            <Animated.View style={[styles.iconLayer, filledStyle]}>
              <LineIcon name={icon} size={ICON} color={c.onInk} strokeWidth={1.9} />
            </Animated.View>
            {badge ? <View style={styles.badge} /> : null}
          </View>
          <Animated.View style={labelStyle}>
            <Text style={styles.label} numberOfLines={1} allowFontScaling={false}>
              {label}
            </Text>
          </Animated.View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/** Ink pill under the active tab: translate + width driven by the two edge springs. */
function ActivePill({ left, right }: { left: SharedValue<number>; right: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    width: Math.max(right.get() - left.get(), ITEM),
    transform: [{ translateX: left.get() }],
  }));
  const styles = useStyles();
  return <Animated.View style={[styles.pill, style]} />;
}

interface PillLayerProps {
  activeSlot: Slot;
  showPill: boolean;
  /** The tab items, which read the edges to cross-fade their icons as the pill passes. */
  children: (left: SharedValue<number>, right: SharedValue<number>) => ReactNode;
}

/**
 * Owns the two pill edges. It mounts only once the row and labels are measured, so both edges start
 * exactly on the active slot (no slide in from x 0); every later slot change springs them, the
 * leading edge stiff and the trailing edge soft, so the pill stretches toward the new tab.
 */
function PillLayer({ activeSlot, showPill, children }: PillLayerProps) {
  const left = useSharedValue(activeSlot.x);
  const right = useSharedValue(activeSlot.x + activeSlot.w);

  useEffect(() => {
    const targetL = activeSlot.x;
    const targetR = activeSlot.x + activeSlot.w;
    const movingRight = targetL + activeSlot.w / 2 >= (left.get() + right.get()) / 2;
    left.set(withSpring(targetL, movingRight ? EDGE_SLOW : EDGE_FAST));
    right.set(withSpring(targetR, movingRight ? EDGE_FAST : EDGE_SLOW));
  }, [activeSlot.x, activeSlot.w, left, right]);

  return (
    <>
      {showPill ? <ActivePill left={left} right={right} /> : null}
      {children(left, right)}
    </>
  );
}

/** Custom `tabBar` for `<Tabs>` from 'expo-router/js-tabs'. */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { blurTint } = useTheme();
  const styles = useStyles();
  const reportHeight = use(BottomTabBarHeightCallbackContext);
  const [rowWidth, setRowWidth] = useState(0);
  const [labelWidths, setLabelWidths] = useState<Record<string, number>>({});
  const [keyboardShown, setKeyboardShown] = useState(false);
  const hidden = useSharedValue(0);

  const bottom = tabBarBottom(insets.bottom);

  useEffect(() => {
    reportHeight?.(TAB_BAR_HEIGHT + bottom);
  }, [reportHeight, bottom]);

  // The tab bar is the first app chrome to mount once signed in: restore a deep link that was opened
  // while signed out (e.g. a shared /product/latte), exactly once. (The root layout must not call router.*)
  useEffect(() => {
    const href = takePendingHref();
    if (href) router.push(href as Href);
  }, []);

  // Hide on keyboard (iOS "will" events feel instant; Android only has "did").
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => setKeyboardShown(true));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardShown(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    hidden.set(withTiming(keyboardShown ? 1 : 0, { duration: 220, easing: easeOutQuint }));
  }, [keyboardShown, hidden]);

  // `href: null` screens get tabBarItemStyle { display: 'none' } — skip them.
  const routes = state.routes.filter(
    (r) => StyleSheet.flatten(descriptors[r.key]?.options.tabBarItemStyle)?.display !== 'none',
  );
  const activeKey = state.routes[state.index]?.key;
  const activeIndex = routes.findIndex((r) => r.key === activeKey);

  const labelFor = (key: string, name: string) => {
    const options = descriptors[key]?.options;
    if (options?.title) return options.title;
    return typeof options?.tabBarLabel === 'string' ? options.tabBarLabel : name;
  };

  // Deterministic layout: active pill + 48px circles, remaining space spread evenly.
  const count = routes.length;
  const measured = rowWidth > 0 && routes.every((r) => labelWidths[r.key] !== undefined);
  const activeKeyVisible = activeIndex >= 0 ? routes[activeIndex]?.key : undefined;
  const naturalPill =
    activeKeyVisible !== undefined
      ? Math.ceil(ICON_LEFT + ICON + LABEL_GAP + (labelWidths[activeKeyVisible] ?? 0) + PILL_RIGHT)
      : ITEM;
  const pillW = Math.max(ITEM, Math.min(naturalPill, rowWidth - (count - 1) * ITEM));
  const widths = routes.map((_, i) => (i === activeIndex ? pillW : ITEM));
  const used = widths.reduce((a, b) => a + b, 0);
  const gap = count > 1 ? Math.max(0, (rowWidth - used) / (count - 1)) : 0;
  const slots: Slot[] = [];
  widths.reduce((x, w) => {
    slots.push({ x, w });
    return x + w + gap;
  }, 0);
  const activeSlot = slots[activeIndex] ?? { x: 0, w: ITEM };

  // iOS slides only: the bar holds a BlurView, and UIVisualEffectView under a parent at 0 < alpha < 1
  // renders as a flat tint whose frost snaps back in at the end of the fade. The slide alone takes the
  // bar fully off screen; elsewhere it also fades.
  const wrapStyle = useAnimatedStyle(() => ({
    opacity: IS_IOS ? 1 : 1 - hidden.get(),
    transform: [{ translateY: hidden.get() * (TAB_BAR_HEIGHT + bottom + 24) }],
  }));

  return (
    // pointerEvents lives on a plain View: on web, an inline `pointer-events: none` written into an
    // Animated.View's style is never cleared when it flips back to 'box-none' (RNW applies box-none as
    // a class), which left the bar untappable after the keyboard closed.
    <Animated.View style={[styles.wrap, { bottom }, wrapStyle]}>
      <View style={[styles.bar, { pointerEvents: keyboardShown ? 'none' : 'auto' }]}>
        {IS_ANDROID ? null : <BlurView intensity={40} tint={blurTint} style={StyleSheet.absoluteFill} />}
        <View style={[StyleSheet.absoluteFill, styles.fill]} />

        {/* Hidden label measurements (natural widths) for the pill layout. */}
        <View style={styles.measure} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {routes.map((r) => (
            <Text
              key={r.key}
              style={styles.label}
              allowFontScaling={false}
              onLayout={(e) => {
                const width = Math.ceil(e.nativeEvent.layout.width);
                setLabelWidths((prev) => (prev[r.key] === width ? prev : { ...prev, [r.key]: width }));
              }}
            >
              {labelFor(r.key, r.name)}
            </Text>
          ))}
        </View>

        <View
          role="tablist"
          style={styles.row}
          onLayout={(e) => {
            const width = Math.floor(e.nativeEvent.layout.width);
            if (width !== rowWidth) setRowWidth(width);
          }}
        >
          {measured ? (
            <PillLayer activeSlot={activeSlot} showPill={activeIndex >= 0}>
              {(left, right) =>
                routes.map((route, i) => {
                  const options = descriptors[route.key]?.options;
                  const focused = i === activeIndex;
                  const label = labelFor(route.key, route.name);
                  const badge = options?.tabBarBadge !== undefined && options.tabBarBadge !== '';
                  const onPress = () => {
                    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                    if (!focused && !event.defaultPrevented) {
                      haptic.select();
                      navigation.navigate(route.name, route.params);
                    }
                  };
                  return (
                    <TabItem
                      key={route.key}
                      label={label}
                      accessibilityLabel={options?.tabBarAccessibilityLabel ?? (badge ? `${label}, new` : label)}
                      focused={focused}
                      slot={slots[i] ?? { x: 0, w: ITEM }}
                      icon={ICONS[route.name] ?? FALLBACK_ICON}
                      badge={badge}
                      left={left}
                      right={right}
                      onPress={onPress}
                      onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
                    />
                  );
                })
              }
            </PillLayer>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

const useStyles = makeStyles((c, t) => ({
  wrap: {
    position: 'absolute',
    left: INSET,
    right: INSET,
    borderRadius: radii.pill,
    boxShadow: t.boxShadows.float,
  },
  bar: {
    height: TAB_BAR_HEIGHT,
    borderRadius: radii.pill,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth * 2,
    // Light: a frosted white rim. Dark: a faint edge (the bar is lifted espresso on the dark canvas).
    borderColor: withAlpha(c.white, t.isDark ? 0.08 : 0.7),
  },
  // expo-blur on web overrides the BlurView's own backgroundColor, so the fill is a sibling layer.
  fill: { backgroundColor: withAlpha(c.surface, IS_ANDROID ? 0.97 : t.isDark ? 0.82 : 0.78) },
  measure: { position: 'absolute', left: 0, top: 0, flexDirection: 'row', opacity: 0, pointerEvents: 'none' },
  row: {
    flex: 1,
    marginHorizontal: PAD_X,
    marginVertical: PAD_Y,
  },
  pill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: ITEM,
    borderRadius: ITEM / 2,
    backgroundColor: c.ink,
  },
  item: { position: 'absolute', left: 0, top: 0, height: ITEM, borderRadius: ITEM / 2, overflow: 'hidden' },
  press: { flex: 1 },
  content: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: ICON_LEFT, gap: LABEL_GAP },
  iconBox: { width: ICON, height: ICON },
  iconLayer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -1,
    right: -2,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: c.sage,
    borderWidth: 1.5,
    borderColor: c.surface,
  },
  label: { ...typeScale.label, color: c.onInk },
}));
