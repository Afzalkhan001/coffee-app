/**
 * Phone sign-in (DESIGN.md §R3.B "Phone / OTP / profile"; PRD §5).
 *
 * The canvas sheet springs up under the night doodle top; the Indian mobile number (+91, 10 digits
 * starting 6–9) formats as you type ("98765 43210"); "Send code" stays dimmed until the number is valid (tapping it early shakes the
 * field); offline → an inline error with a retry. Success pushes /auth/otp with the number and the
 * code's resend/expiry window.
 */
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { View, type TextInput } from 'react-native';
import Animated from 'react-native-reanimated';
import { isNetworkError, sendOtp } from '@/api';
import { enterUp, exitFade, popIn, useShake } from '@/components/motion';
import { AUTH_FIELD_HEIGHT, AuthField } from '@/components/onboarding/AuthField';
import { AuthScaffold, authPlanes } from '@/components/onboarding/AuthScaffold';
import { attempt, COUNTRY, formatPhoneInput, PHONE_DIGITS, phoneDigits, phoneInput } from '@/components/onboarding/authFormat';
import { InlineNotice } from '@/components/onboarding/InlineNotice';
import { Icon, PrimaryBar, Text } from '@/components/ui';
import { isValidPhone } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useSession } from '@/store/session';
import { fonts, makeStyles, useColors } from '@/theme';

type SendError = 'network' | 'unknown';

const openLegal = (doc: 'terms' | 'privacy') => router.push({ pathname: '/legal', params: { doc } });

export default function PhoneScreen() {
  const c = useColors();
  const styles = useStyles();
  const storedPhone = useSession((s) => s.phone);
  const [digits, setDigits] = useState(() => (storedPhone ? phoneDigits(storedPhone) : ''));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<SendError | null>(null);
  const [attempted, setAttempted] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const { style: shakeStyle, shake } = useShake();

  const valid = isValidPhone(digits);
  const fieldError =
    attempted && !valid
      ? digits.length === PHONE_DIGITS
        ? 'Indian mobile numbers start with 6, 7, 8 or 9'
        : `Enter your ${PHONE_DIGITS}-digit mobile number`
      : undefined;

  const send = async () => {
    if (sending) return;
    if (!valid) {
      setAttempted(true);
      shake();
      inputRef.current?.focus();
      return;
    }
    setSending(true);
    setError(null);
    // `valid` means the field holds exactly the 10-digit national number (a typed +91 / 0 has collapsed).
    const result = await attempt(sendOtp(digits));
    setSending(false);
    if (!result.ok) {
      haptic.error();
      setError(isNetworkError(result.error) ? 'network' : 'unknown');
      return;
    }
    const { expiresAt, resendAt } = result.value;
    router.push({
      pathname: '/auth/otp',
      params: {
        phone: digits,
        expiresAt: String(expiresAt),
        resendAt: String(resendAt),
      },
    });
  };

  const onChangeText = (text: string) => {
    setDigits(phoneInput(text));
    if (error) setError(null);
  };

  return (
    <AuthScaffold
      entrance="rise"
      onEntered={() => inputRef.current?.focus()}
      footer={
        <>
          <PrimaryBar
            label="Send code"
            icon="arrow-forward"
            onPress={send}
            disabled={!valid}
            loading={sending}
            accessibilityLabel="Send verification code"
          />
          <Text style={styles.terms} color={c.inkSoft} align="center">
            {'By continuing you agree to our '}
            <Text
              style={[styles.terms, styles.link]}
              onPress={() => openLegal('terms')}
              accessibilityRole="link"
              suppressHighlighting
            >
              Terms
            </Text>
            {' and '}
            <Text
              style={[styles.terms, styles.link]}
              onPress={() => openLegal('privacy')}
              accessibilityRole="link"
              suppressHighlighting
            >
              Privacy Policy
            </Text>
            .
          </Text>
        </>
      }
    >
      <Animated.View entering={enterUp(0)}>
        <Text style={styles.title} accessibilityRole="header">
          What’s your number?
        </Text>
      </Animated.View>
      <Animated.View entering={enterUp(1)}>
        <Text style={styles.caption} color={c.inkSoft}>
          We’ll text you a 6-digit code.
        </Text>
      </Animated.View>

      <Animated.View entering={enterUp(2)}>
        <Animated.View style={[styles.row, shakeStyle]}>
          <View style={styles.country} accessible accessibilityLabel={`Country code ${COUNTRY.dial}, India`}>
            <Text style={styles.countryIso} color={c.inkMuted}>
              {COUNTRY.iso}
            </Text>
            <Text style={styles.countryDial}>{COUNTRY.dial}</Text>
          </View>
          <AuthField
            ref={inputRef}
            value={formatPhoneInput(digits)}
            onChangeText={onChangeText}
            placeholder="98765 43210"
            inputMode="tel"
            autoComplete="tel-national"
            textContentType="telephoneNumber"
            enterKeyHint="send"
            onSubmitEditing={send}
            accessibilityLabel="Mobile number"
            error={fieldError}
            style={styles.input}
            containerStyle={styles.field}
            right={
              valid ? (
                <Animated.View entering={popIn(0)} exiting={exitFade} style={styles.tick}>
                  <Icon name="checkmark-circle" size={22} color={c.sageText} />
                </Animated.View>
              ) : null
            }
          />
        </Animated.View>
      </Animated.View>

      {error ? (
        <InlineNotice
          tone="error"
          icon={error === 'network' ? 'cloud-offline' : undefined}
          message={error === 'network' ? 'You’re offline. Check your connection.' : 'We couldn’t send a code just now.'}
          action={{ label: 'Try again', onPress: send }}
          style={styles.notice}
        />
      ) : null}
    </AuthScaffold>
  );
}

const useStyles = makeStyles((c, t) => ({
  title: {
    fontFamily: fonts.bold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.4,
    color: c.ink,
  },
  caption: {
    marginTop: 6,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  row: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  country: {
    height: AUTH_FIELD_HEIGHT,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: authPlanes(c, t).field,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countryIso: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.4,
  },
  countryDial: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 20,
    color: c.ink,
  },
  field: { flex: 1, minWidth: 0 },
  input: { fontFamily: fonts.medium, fontSize: 17, letterSpacing: 0.6 },
  tick: { pointerEvents: 'none' },
  notice: { marginTop: 16 },
  terms: {
    marginTop: 12,
    paddingHorizontal: 12,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  link: {
    marginTop: 0,
    paddingHorizontal: 0,
    fontFamily: fonts.medium,
    color: c.ink,
    textDecorationLine: 'underline',
  },
}));
