/**
 * Render smoke test: every motion component mounts, updates and unmounts without throwing
 * (catches runtime-only mistakes the type checker can't see). Reanimated runs its JS
 * implementation (worklets mocked); fake timers drive animation frames deterministically.
 */
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text, View } from 'react-native';
import { makeMutable } from 'react-native-reanimated';

jest.useFakeTimers();

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-router', () => ({ useIsFocused: () => true }));
jest.mock('@expo/vector-icons/Ionicons', () => {
  const { Text: RNText } = require('react-native');
  return function MockIonicon({ name }: { name: string }) {
    return <RNText>{name}</RNText>;
  };
});

// eslint-disable-next-line import/first
import {
  AnimatedCheck,
  ArcArrowButton,
  CartTarget,
  ConfettiBurst,
  LineArt,
  LineArtField,
  MorphPayButton,
  OverlayHost,
  PageDots,
  PulseRing,
  RollingNumber,
  Skeleton,
  WavyCapsule,
  useFlyToCart,
  useShake,
  useToast,
  type MorphPayButtonState,
} from '../index';
// eslint-disable-next-line import/first
import { LINE_ART, type LineArtName } from '../lineArtPaths';

const progress = makeMutable(0.5);

/** Let pending animations and their completion callbacks run inside act(). */
function flush(ms = 4000) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

function mount(node: React.ReactElement): ReactTestRenderer {
  let r: ReactTestRenderer | undefined;
  act(() => {
    r = create(node);
  });
  if (!r) throw new Error('not mounted');
  return r;
}

describe('motion components render', () => {
  it('RollingNumber grows, shrinks and formats', () => {
    const r = mount(<RollingNumber value={999} money fontSize={34} />);
    expect(JSON.stringify(r.toJSON())).toContain('₹');
    expect(JSON.stringify(r.toJSON())).toContain('"accessibilityLabel":"₹999"');
    act(() => r.update(<RollingNumber value={1250} money fontSize={34} />));
    expect(JSON.stringify(r.toJSON())).toContain('"accessibilityLabel":"₹1,250"');
    act(() => r.update(<RollingNumber value={125000} money fontSize={34} />));
    expect(JSON.stringify(r.toJSON())).toContain('"accessibilityLabel":"₹1,25,000"');
    act(() => r.update(<RollingNumber value={2300} decimals={0} suffix=" pts" />));
    act(() => r.update(<RollingNumber value={-3.5} decimals={2} animateOnMount />));
    act(() => r.unmount());
  });

  it('LineArt renders every illustration, drawn and static', () => {
    for (const name of Object.keys(LINE_ART) as LineArtName[]) {
      const r = mount(<LineArt name={name} size={48} draw float accentColor="#fff" />);
      act(() => r.update(<LineArt name={name} size={120} />));
      act(() => r.unmount());
    }
  });

  it('LineArtField renders all variants', () => {
    for (const variant of ['onboarding', 'auth', 'confirmation', 'empty'] as const) {
      const r = mount(<LineArtField variant={variant} />);
      act(() => r.unmount());
    }
  });

  it('onboarding pieces render', () => {
    const r = mount(
      <View>
        <WavyCapsule progress={progress} />
        <ArcArrowButton progress={progress} onPress={() => {}} accessibilityLabel="Next" />
        <ArcArrowButton progress={progress} onPress={() => {}} accessibilityLabel="Done" icon="checkmark" />
        <PageDots count={3} progress={progress} />
      </View>,
    );
    act(() => r.unmount());
  });

  it('feedback pieces render', () => {
    const r = mount(
      <View>
        <Skeleton height={14} width="60%" />
        <PulseRing size={12} color="#000">
          <View />
        </PulseRing>
        <PulseRing size={12} color="#000" active={false} />
        <AnimatedCheck size={96} play />
        <AnimatedCheck size={30} play={false} ring={false} filled />
        <ConfettiBurst play />
      </View>,
    );
    act(() => r.unmount());
  });

  it('MorphPayButton walks every state', () => {
    const states: MorphPayButtonState[] = ['idle', 'loading', 'error', 'loading', 'success', 'idle'];
    const r = mount(<MorphPayButton state="idle" label="Pay ₹620" onPress={() => {}} />);
    for (const s of states) {
      act(() => r.update(<MorphPayButton state={s} label={s === 'error' ? 'Try again' : 'Pay ₹620'} onPress={() => {}} haptics={false} />));
    }
    act(() => r.update(<MorphPayButton state="idle" label="Pay" onPress={() => {}} disabled />));
    act(() => r.unmount());
    const mountedLoading = mount(<MorphPayButton state="loading" label="Pay" onPress={() => {}} />);
    act(() => mountedLoading.unmount());
  });

  it('OverlayHost provides toast, fly-to-cart and cart targets', async () => {
    let api: { toast: ReturnType<typeof useToast>; fly: ReturnType<typeof useFlyToCart> } | null = null;
    function Probe() {
      const toast = useToast();
      const fly = useFlyToCart();
      const { style, shake } = useShake();
      api = { toast, fly };
      return (
        <View style={style as object} onTouchEnd={shake}>
          <CartTarget>
            <Text>cart</Text>
          </CartTarget>
        </View>
      );
    }
    const r = mount(
      <OverlayHost>
        <Probe />
      </OverlayHost>,
    );
    expect(api).not.toBeNull();
    act(() => {
      api?.toast('Added to cart', { tone: 'success' });
      api?.toast('Second message');
      api?.toast('Card declined', { tone: 'error', icon: 'card' });
    });
    const texts = r.root.findAllByType(Text).map((t) => String(t.props.children));
    expect(texts).toContain('Card declined');
    flush(); // toast lifetime → slide away → removed
    expect(r.root.findAllByType(Text).map((t) => String(t.props.children))).not.toContain('Card declined');

    let landed = false;
    await act(async () => {
      // No measurable target in the test renderer → flies to the top-right fallback.
      void api
        ?.fly({ image: 'https://example.com/latte.jpg', from: { x: 10, y: 400, width: 120, height: 120 } })
        .then(() => {
          landed = true;
        });
      await jest.advanceTimersByTimeAsync(600); // measure guard
    });
    flush(2000); // flight duration
    await act(async () => {
      await Promise.resolve();
    });
    expect(landed).toBe(true);
    act(() => r.unmount());
  });

  it('hooks work outside the host (safe fallbacks)', async () => {
    let fly: ReturnType<typeof useFlyToCart> | null = null;
    function Probe() {
      fly = useFlyToCart();
      return null;
    }
    const r = mount(<Probe />);
    await expect(fly!({ image: 'x', from: { x: 0, y: 0, width: 10, height: 10 } })).resolves.toBeUndefined();
    act(() => r.unmount());
  });
});
