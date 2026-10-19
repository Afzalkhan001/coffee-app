/**
 * OTP verification (DESIGN.md §R3.B; PRD §5, §24 "invalid / expired OTP").
 *
 * Six boxes fed by one hidden input; auto-submits on the 6th digit. Resend unlocks after
 * OTP_RESEND_MS with a live countdown; the code's expiry (OTP_TTL_MS) ticks quietly beside it.
 * Invalid → boxes shake red + error haptic, then clear; expired / no longer valid → one notice with
 * the single "Send new code" action (the resend row, countdown and demo link step aside, so there's
 * no second resend link and no demo link that can only shake); offline → retry. Success → a sage wave across the boxes, then:
 *   returning customer → `signIn(phone, profile)` and the guard lands on the tabs;
 *   new customer → `signIn(phone, null)` + `router.replace('/auth/profile')` (the one allowed replace).
 */
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View, type TextInput } from 'react-native';
import Animated from 'react-native-reanimated';
import { DEMO_OTP, isNetworkError, OTP_RESEND_MS, OTP_TTL_MS, OtpError, sendOtp, verifyOtp } from '@/api';
import { db } from '@/api/mockDb';
import { useNow } from '@/components/domain';
import { enterUp, useShake } from '@/components/motion';
import { AuthScaffold } from '@/components/onboarding/AuthScaffold';
import { attempt, displayPhone, formatCountdown, phoneDigits } from '@/components/onboarding/authFormat';
import type { Attempt } from '@/lib/async';
import { InlineNotice, type NoticeTone } from '@/components/onboarding/InlineNotice';
import { OtpCodeInput, type OtpStatus } from '@/components/onboarding/OtpCodeInput';
import { PrimaryBar, Text, useKeyboardAfterTransition } from '@/components/ui';
import { isValidPhone } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useSession } from '@/store/session';
import { fonts, makeStyles, useColors } from '@/theme';
import type { Profile } from '@/types/models';

const CODE_LENGTH = 6;
/** Let the success wave land before moving on. */
const SUCCESS_HOLD_MS = 650;
/** Let the shake finish before clearing a wrong code. */
const CLEAR_AFTER_SHAKE_MS = 520;

type OtpFailure = 'invalid' | 'expired' | 'no_session' | 'network-verify' | 'network-resend' | 'unknown';
interface CodeWindow {
  expiresAt: number;
  resendAt: number;
}

const OFFLINE = 'You’re offline. Check your connection.';

function failureKind(error: unknown, network: OtpFailure): OtpFailure {
  if (error instanceof OtpError) return error.reason;
  return isNetworkError(error) ? network : 'unknown';
}

/**
 * The code window to show on arrival. The (persisted) code session is the source of truth, not the
 * `expiresAt` / `resendAt` URL params: after a web refresh or a stale deep link the URL can still
 * carry a window for a code that no longer exists, which showed live timers beside a code that could
 * only fail. No session for this number → null, and the screen sends a fresh code on mount.
 */
function initialWindow(phone: string): CodeWindow | null {
  const live = db.get().otp;
  return live && live.phone === phone ? { expiresAt: live.expiresAt, resendAt: live.resendAt } : null;
}

export default function OtpScreen() {
  const c = useColors();
  const styles = useStyles();
  const params = useLocalSearchParams<{ phone?: string; expiresAt?: string; resendAt?: string }>();
  const phone = phoneDigits(typeof params.phone === 'string' ? params.phone : '');
  const validPhone = isValidPhone(phone);
  const signIn = useSession((s) => s.signIn);

  const inputRef = useRef<TextInput>(null);
  const busy = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const { style: shakeStyle, shake } = useShake();

  const [code, setCode] = useState('');
  const [phase, setPhase] = useState<'idle' | 'verifying' | 'success'>('idle');
  const [failure, setFailure] = useState<OtpFailure | null>(null);
  const [codeWindow, setCodeWindow] = useState<CodeWindow | null>(() => initialWindow(phone));
  // Arrived without a live code for this number (refresh after it was used, a stale link): the
  // screen opens already sending one (see the mount effect below).
  const [resending, setResending] = useState(() => validPhone && !codeWindow);
  const [resent, setResent] = useState(false);
  const now = useNow(1000);
  // Android: the code field auto-focuses mid-push; make sure its keyboard is up once the push ends.
  useKeyboardAfterTransition(inputRef, phase === 'idle');

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  const expired = !!codeWindow && now >= codeWindow.expiresAt && phase !== 'success';
  // `now` ticks once a second, so clamp: a fresh code never shows "0:31".
  const resendIn = codeWindow ? Math.min(OTP_RESEND_MS, Math.max(0, codeWindow.resendAt - now)) : 0;
  const expiresIn = codeWindow ? Math.min(OTP_TTL_MS, codeWindow.expiresAt - now) : 0;
  const canResend = !resending && phase === 'idle' && resendIn <= 0;
  // The code on screen can't be used any more: the notice below carries the only way forward.
  const stale = phase === 'idle' && !resending && (expired || failure === 'expired' || failure === 'no_session');

  const complete = (profile: Profile | null) => {
    if (profile) {
      // Returning customer: the Stack.Protected guard flips and lands on the tabs.
      signIn(phone, profile);
      return;
    }
    signIn(phone, null);
    router.replace('/auth/profile');
  };

  const verify = async (value: string) => {
    if (busy.current || value.length < CODE_LENGTH) return;
    if (expired) {
      setFailure('expired');
      haptic.error();
      shake();
      return;
    }
    busy.current = true;
    setPhase('verifying');
    setFailure(null);
    setResent(false);
    const result = await attempt(verifyOtp(phone, value));
    if (result.ok) {
      // Keep the keyboard up: the profile screen focuses its name field straight away, and the
      // tabs unmount this input anyway, so dismissing here would only bounce the layout.
      setPhase('success');
      haptic.success();
      later(() => complete(result.value.profile), SUCCESS_HOLD_MS);
      return;
    }
    busy.current = false;
    setPhase('idle');
    const kind = failureKind(result.error, 'network-verify');
    setFailure(kind);
    haptic.error();
    if (kind !== 'network-verify') shake();
    if (kind === 'invalid') {
      later(() => {
        setCode('');
        inputRef.current?.focus();
      }, CLEAR_AFTER_SHAKE_MS);
    }
  };

  /** Applies the outcome of a code request (the caller set `resending` when it sent it). */
  const onCodeSent = (result: Attempt<CodeWindow>) => {
    setResending(false);
    if (!result.ok) {
      haptic.error();
      setFailure(isNetworkError(result.error) ? 'network-resend' : 'unknown');
      return;
    }
    setCodeWindow(result.value);
    setCode('');
    setResent(true);
    // Silent: the "New code sent" notice is the feedback.
    inputRef.current?.focus();
  };

  const resend = () => {
    if (resending || busy.current) return;
    setResending(true);
    setFailure(null);
    void attempt(sendOtp(phone)).then(onCodeSent);
  };

  // No live code on arrival: `resending` started true, so send it now.
  useEffect(() => {
    if (resending) void attempt(sendOtp(phone)).then(onCodeSent);
    // Mount only.
  }, []);

  const onChange = (value: string) => {
    if (phase !== 'idle') return;
    // A digit entered: `tick` (the last one then verifies, ending in `success` or `error`). A code that
    // completes after expiry skips it: verify fires `error` on this same frame.
    if (value.length > code.length && !(value.length === CODE_LENGTH && expired)) haptic.tick();
    setCode(value);
    if (failure && failure !== 'expired') setFailure(null);
    setResent(false);
    if (value.length === CODE_LENGTH) void verify(value);
  };

  const fillDemo = () => {
    if (phase !== 'idle') return;
    setCode(DEMO_OTP);
    setFailure(null);
    void verify(DEMO_OTP);
  };

  const editNumber = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/auth/phone');
  };

  if (!validPhone) return <Redirect href="/auth/phone" />;

  const boxStatus: OtpStatus =
    phase === 'success'
      ? 'success'
      : phase === 'verifying'
        ? 'busy'
        : failure === 'invalid' || failure === 'expired' || (expired && !resending)
          ? 'error'
          : 'idle';

  const notice = noticeFor({ failure, expired, resent, resending, phase, phone });

  return (
    <AuthScaffold
      onBack={editNumber}
      footer={
        <PrimaryBar
          label={phase === 'success' ? 'Verified' : 'Verify'}
          icon={phase === 'success' ? 'checkmark' : 'arrow-forward'}
          loading={phase === 'verifying'}
          disabled={code.length < CODE_LENGTH || expired}
          // The screen picks the haptic: `warning` for a short code (below), `error` for an expired one (verify).
          disabledHapticKind={null}
          onPress={() => {
            if (phase !== 'idle') return;
            if (code.length < CODE_LENGTH) {
              haptic.warning();
              shake();
              inputRef.current?.focus();
              return;
            }
            void verify(code);
          }}
          accessibilityLabel="Verify code"
        />
      }
    >
      <Animated.View entering={enterUp(0)}>
        <Text style={styles.title} accessibilityRole="header">
          Enter the code
        </Text>
      </Animated.View>
      <Animated.View entering={enterUp(1)}>
        <Text style={styles.caption} color={c.inkSoft}>
          {`Sent to ${displayPhone(phone)} · `}
          <Text
            style={[styles.caption, styles.edit]}
            onPress={editNumber}
            accessibilityRole="button"
            accessibilityLabel="Edit phone number"
            suppressHighlighting
          >
            Edit
          </Text>
        </Text>
      </Animated.View>

      <Animated.View entering={enterUp(2)} style={styles.boxes}>
        <Animated.View style={shakeStyle}>
          <OtpCodeInput
            ref={inputRef}
            value={code}
            onChange={onChange}
            length={CODE_LENGTH}
            status={boxStatus}
            autoFocus
            editable={phase === 'idle'}
          />
        </Animated.View>
      </Animated.View>

      {stale ? null : (
        <Animated.View entering={enterUp(3)} style={styles.metaRow}>
          {canResend ? (
            <Pressable
              onPress={() => void resend()}
              accessibilityRole="button"
              accessibilityLabel="Resend code"
              hitSlop={12}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={[styles.meta, styles.resendLink]} color={c.ink}>
                Resend code
              </Text>
            </Pressable>
          ) : (
            <View accessible accessibilityLiveRegion="polite">
              <Text style={[styles.meta, styles.mono]} color={c.inkSoft}>
                {resending ? 'Sending a new code…' : `Resend in ${formatCountdown(resendIn)}`}
              </Text>
            </View>
          )}
          {codeWindow && !expired && phase !== 'success' ? (
            <Text style={[styles.meta, styles.mono]} color={c.inkMuted}>
              {`Expires ${formatCountdown(expiresIn)}`}
            </Text>
          ) : null}
        </Animated.View>
      )}

      {stale ? null : (
        <Animated.View entering={enterUp(4)} style={styles.demoRow}>
          <Pressable
            onPress={fillDemo}
            accessibilityRole="button"
            accessibilityLabel={`Use demo code ${DEMO_OTP.split('').join(' ')}`}
            hitSlop={12}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Text style={styles.demo} color={c.roastText}>
              {`Use demo code ${DEMO_OTP}`}
            </Text>
          </Pressable>
        </Animated.View>
      )}

      {notice ? (
        <InlineNotice
          key={notice.message}
          tone={notice.tone}
          icon={notice.icon}
          message={notice.message}
          action={
            notice.action
              ? {
                  label: notice.action.label,
                  onPress: notice.action.kind === 'retry' ? () => void verify(code) : () => void resend(),
                }
              : undefined
          }
          style={styles.notice}
        />
      ) : null}
    </AuthScaffold>
  );
}

interface NoticeContent {
  tone: NoticeTone;
  message: string;
  icon?: string;
  /** `retry` re-submits the current code; `resend` requests a new one. */
  action?: { label: string; kind: 'retry' | 'resend' };
}

function noticeFor({
  failure,
  expired,
  resent,
  resending,
  phase,
  phone,
}: {
  failure: OtpFailure | null;
  expired: boolean;
  resent: boolean;
  /** A new code is on its way: the resend row says so, the old notice steps aside. */
  resending: boolean;
  phase: 'idle' | 'verifying' | 'success';
  phone: string;
}): NoticeContent | null {
  if (phase === 'success' || resending) return null;
  switch (failure) {
    case 'network-verify':
      return { tone: 'error', icon: 'cloud-offline', message: OFFLINE, action: { label: 'Try again', kind: 'retry' } };
    case 'network-resend':
      return { tone: 'error', icon: 'cloud-offline', message: OFFLINE, action: { label: 'Try again', kind: 'resend' } };
    case 'invalid':
      return { tone: 'error', message: 'That code isn’t right. Try again.' };
    case 'no_session':
      return {
        tone: 'error',
        message: 'That code is no longer valid.',
        action: { label: 'Send new code', kind: 'resend' },
      };
    case 'unknown':
      return { tone: 'error', message: 'Something went wrong. Please try again.' };
    default:
      break;
  }
  if (failure === 'expired' || expired) {
    return {
      tone: 'error',
      message: 'This code has expired.',
      action: { label: 'Send new code', kind: 'resend' },
    };
  }
  if (resent) return { tone: 'success', message: 'New code sent.' };
  return null;
}

const useStyles = makeStyles((c) => ({
  title: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.4, color: c.ink },
  caption: { marginTop: 6, fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  edit: { marginTop: 0, fontFamily: fonts.semibold, color: c.ink, textDecorationLine: 'underline' },
  boxes: { marginTop: 28 },
  metaRow: {
    marginTop: 14,
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  meta: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  resendLink: { fontFamily: fonts.semibold, textDecorationLine: 'underline' },
  mono: { fontVariant: ['tabular-nums'] },
  demoRow: { marginTop: 18, flexDirection: 'row' },
  demo: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
  notice: { marginTop: 16 },
}));
