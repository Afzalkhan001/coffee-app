/**
 * Root overlay (mounted once in src/app/_layout.tsx, above the Stack): toasts and fly-to-cart.
 * Everything here animates on the UI thread; the overlay never blocks touches.
 */
import { useIsFocused } from 'expo-router';
import {
  createContext,
  use,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from 'react';
import { AccessibilityInfo, Dimensions, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { haptic } from '@/lib/haptics';
import { springs } from '@/theme';
import { FlyingThumb, type Flight } from './FlyingThumb';
import { easeOutQuint, reducedMotionAtLaunch } from './hooks';
import { measureInWindowAsync, type WindowRect } from './measure';
import { ToastView, type ToastItem, type ToastTone } from './ToastView';

export { measureInWindowAsync, type WindowRect } from './measure';
export type { ToastTone } from './ToastView';

export interface ToastOptions {
  tone?: ToastTone;
  /** Ionicons name for the icon disc (defaults per tone). */
  icon?: string;
}
export type ToastFn = (message: string, opts?: ToastOptions) => void;
export interface FlyToCartArgs {
  /**
   * The image the source view displays: a stored image string (`local:<key>` cut-out or a URL, as
   * returned by `sizedPhoto`) or a bundled asset module (`require(...)`). Cut-outs fly bare (no
   * circle mask, no tile); remote photos fly as a rounded square.
   */
  image: string | number;
  /** Source rect in window coordinates (use `measureInWindowAsync`). */
  from: WindowRect;
}
export type FlyToCartFn = (args: FlyToCartArgs) => Promise<void>;

interface CartTargetRegistration {
  ref: RefObject<View | null>;
  pop: () => void;
  priority: number;
}

interface OverlayApi {
  toast: ToastFn;
  flyToCart: FlyToCartFn;
  registerTarget: (target: CartTargetRegistration) => () => void;
}

const OverlayContext = createContext<OverlayApi | null>(null);
const MAX_TOASTS = 3;

interface TargetEntry extends CartTargetRegistration {
  id: number;
}

/** Plain closure (not React state): keeps the context value stable for the app's lifetime. */
function createOverlayEngine(
  setToasts: Dispatch<SetStateAction<ToastItem[]>>,
  setFlights: Dispatch<SetStateAction<Flight[]>>,
) {
  let seq = 0;
  let targets: TargetEntry[] = [];
  const pending = new Map<number, { resolve: () => void; pop?: () => void }>();
  const nextId = () => {
    seq += 1;
    return seq;
  };

  const toast: ToastFn = (message, opts) => {
    const item: ToastItem = { id: nextId(), message, tone: opts?.tone ?? 'default', icon: opts?.icon };
    setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), item]);
    if (Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(message);
  };

  const registerTarget = (target: CartTargetRegistration) => {
    const entry: TargetEntry = { ...target, id: nextId() };
    targets = [...targets, entry];
    return () => {
      targets = targets.filter((t) => t.id !== entry.id);
    };
  };

  /** Highest priority first, then the most recently focused; must be on screen. */
  const pickTarget = async () => {
    const win = Dimensions.get('window');
    const ordered = [...targets].sort((a, b) => b.priority - a.priority || b.id - a.id);
    for (const t of ordered) {
      const rect = await measureInWindowAsync(t.ref);
      if (rect && rect.x + rect.width > 0 && rect.x < win.width && rect.y + rect.height > 0 && rect.y < win.height) {
        return { rect, pop: t.pop };
      }
    }
    return null;
  };

  const flyToCart: FlyToCartFn = async ({ image, from }) => {
    const target = await pickTarget();
    if (reducedMotionAtLaunch) {
      // Reduce Motion: no flight — just the landing feedback.
      haptic.land();
      target?.pop();
      return;
    }
    await new Promise<void>((resolve) => {
      const id = nextId();
      pending.set(id, { resolve, pop: target?.pop });
      setFlights((prev) => [...prev, { id, image, from, to: target?.rect ?? null }]);
    });
  };

  const arrive = (id: number) => {
    const flight = pending.get(id);
    pending.delete(id);
    // `land` on the arrival frame, with the target's pop (docs/HAPTICS.md).
    haptic.land();
    flight?.pop?.();
    flight?.resolve();
    setFlights((prev) => prev.filter((f) => f.id !== id));
  };

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const dispose = () => {
    pending.forEach((p) => p.resolve());
    pending.clear();
    targets = [];
  };

  const api: OverlayApi = { toast, flyToCart, registerTarget };
  return { api, arrive, removeToast, dispose };
}

/** Wraps the app: renders children plus a touch-transparent layer for flights and toasts. */
export function OverlayHost({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [engine] = useState(() => createOverlayEngine(setToasts, setFlights));

  useEffect(() => () => engine.dispose(), [engine]);

  return (
    <OverlayContext value={engine.api}>
      <View style={styles.root}>
        {children}
        <View style={styles.layer}>
          {flights.map((f) => (
            <FlyingThumb key={f.id} flight={f} onArrive={engine.arrive} />
          ))}
          {toasts.map((t, i) => (
            <ToastView key={t.id} item={t} superseded={i < toasts.length - 1} onGone={engine.removeToast} />
          ))}
        </View>
      </View>
    </OverlayContext>
  );
}

const noopToast: ToastFn = (message) => {
  if (__DEV__) console.warn(`[motion] useToast() outside <OverlayHost>: "${message}"`);
};
const fallbackFly: FlyToCartFn = async () => {
  haptic.land();
};

/** Show a toast: ink pill under the safe area, auto-dismisses after 2.2s; newer ones replace older. */
export function useToast(): ToastFn {
  return use(OverlayContext)?.toast ?? noopToast;
}

/** Flies the product art from a window rect to the registered cart target along an arc; resolves on arrival (badge pops + haptic.land). */
export function useFlyToCart(): FlyToCartFn {
  return use(OverlayContext)?.flyToCart ?? fallbackFly;
}

export interface CartTargetProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Higher wins when several targets are focused at once (e.g. a header cart icon over the floating cart bar). */
  priority?: number;
  /**
   * Peak scale of the landing pop (1 → popScale → 1). Default 1.35 (DESIGN §7 badge pop). Use a
   * subtler value (~1.12) when the wrapped view is a whole button whose badge pops on its own.
   */
  popScale?: number;
}

/** Wrap the cart icon/badge. Registers its window rect as fly-to-cart target and plays the pop when an item lands. */
export function CartTarget({ children, style, priority = 0, popScale = 1.35 }: CartTargetProps) {
  const api = use(OverlayContext);
  const focused = useIsFocused();
  const ref = useRef<View>(null);
  const scale = useSharedValue(1);

  useEffect(() => {
    // Only the focused screen's cart is a valid target (stack screens below stay mounted).
    if (!api || !focused) return;
    const pop = () => {
      scale.set(
        withSequence(withTiming(popScale, { duration: 110, easing: easeOutQuint }), withSpring(1, springs.bouncy)),
      );
    };
    return api.registerTarget({ ref, pop, priority });
  }, [api, focused, priority, popScale, scale]);

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Animated.View ref={ref} collapsable={false} style={[style, popStyle]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  layer: { ...StyleSheet.absoluteFill, pointerEvents: 'box-none' },
});
