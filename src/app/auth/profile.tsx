/**
 * First-time profile setup (PRD §5 "first-time profile setup").
 *
 * Name (required) + email (optional, validated when present). The avatar on the night top spells
 * the customer's initials as they type, beside "Hi, Maya". "Continue" → `saveProfile` → a short success
 * flourish (drawn sage check + welcome points) → `session.setProfile()`, which flips the
 * Stack.Protected guard and lands on the tabs (no router.replace: it would race the guard).
 */
import { Redirect } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, View, type TextInput } from 'react-native';
import Animated from 'react-native-reanimated';
import { isNetworkError, saveProfile } from '@/api';
import { Avatar } from '@/components/domain';
import { AnimatedCheck, enterFade, enterUp, popIn, usePop, useShake } from '@/components/motion';
import { AuthField } from '@/components/onboarding/AuthField';
import { AuthScaffold } from '@/components/onboarding/AuthScaffold';
import { attempt, displayPhone, isValidEmail } from '@/components/onboarding/authFormat';
import { InlineNotice } from '@/components/onboarding/InlineNotice';
import { PrimaryBar, Text } from '@/components/ui';
import { firstName, initials } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useSession } from '@/store/session';
import { fonts, makeStyles, radii, useColors } from '@/theme';
import { brand } from '@/theme/brand';
import type { Profile } from '@/types/models';

/** Pause on the finished check before moving on. */
const SUCCESS_HOLD_MS = 700;
const AVATAR = 56;

/** Night-top hero: the initials avatar pops as the name is typed, beside a light "Hi, Maya". */
function ProfileHero({ name }: { name: string }) {
  const c = useColors();
  const styles = useStyles();
  const { style: popStyle, pop } = usePop(1.08);
  const letters = initials(name);
  const first = firstName(name);
  const lastLetters = useRef(letters);

  useEffect(() => {
    if (lastLetters.current === letters) return;
    lastLetters.current = letters;
    pop();
  }, [letters, pop]);

  return (
    <View style={styles.hero}>
      {/* Entering on the wrapper, the initials pop on the inner view (both animate transform). */}
      <Animated.View entering={popIn(1)}>
        <Animated.View style={popStyle}>
          <Avatar name={name.trim() || undefined} size={AVATAR} />
        </Animated.View>
      </Animated.View>
      <Text style={styles.heroGreeting} color={c.white} numberOfLines={1}>
        {first ? `Hi, ${first}` : 'Hi there'}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const c = useColors();
  const styles = useStyles();
  const phone = useSession((s) => s.phone);
  const setProfile = useSession((s) => s.setProfile);
  const signOut = useSession((s) => s.signOut);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState({ name: false, email: false });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<'network' | 'unknown' | null>(null);
  const [saved, setSaved] = useState<Profile | null>(null);

  const nameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finished = useRef(false);
  const { style: shakeStyle, shake } = useShake();

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const nameInvalid = trimmedName.length === 0;
  const emailInvalid = trimmedEmail.length > 0 && !isValidEmail(trimmedEmail);
  const nameError = (submitted || touched.name) && nameInvalid ? 'Please tell us your name' : undefined;
  const emailError = (submitted || touched.email) && emailInvalid ? 'That email doesn’t look quite right' : undefined;

  const enterApp = () => {
    if (!saved || finished.current) return;
    finished.current = true;
    if (timer.current) clearTimeout(timer.current);
    setProfile(saved);
  };

  const submit = async () => {
    if (saving || saved || !phone) return;
    setSubmitted(true);
    if (nameInvalid || emailInvalid) {
      // A missing / malformed field: a nudge, with the shake (the bar leaves the haptic to us).
      haptic.warning();
      shake();
      (nameInvalid ? nameRef : emailRef).current?.focus();
      return;
    }
    setSaving(true);
    setFailure(null);
    const input = {
      name: trimmedName,
      email: trimmedEmail.length > 0 ? trimmedEmail : undefined,
    };
    const result = await attempt(saveProfile(phone, input));
    setSaving(false);
    if (!result.ok) {
      haptic.error();
      setFailure(isNetworkError(result.error) ? 'network' : 'unknown');
      return;
    }
    Keyboard.dismiss();
    haptic.success();
    setSaved(result.value);
  };

  const onCheckDrawn = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(enterApp, SUCCESS_HOLD_MS);
  };

  // Reached without a verified number (e.g. a web refresh after sign-out): start over.
  if (!phone) return <Redirect href="/auth/phone" />;

  const welcome = saved ? (
    <Animated.View entering={enterFade(0)} style={styles.success} accessibilityLiveRegion="polite">
      <AnimatedCheck size={76} play filled onDone={onCheckDrawn} />
      <Text style={styles.successTitle} align="center" accessibilityRole="header">
        {`You’re all set, ${firstName(saved.name)}`}
      </Text>
      <Text style={styles.caption} color={c.inkSoft} align="center">
        Your welcome points are in Rewards.
      </Text>
      <Animated.View entering={popIn(6)} style={styles.points}>
        <Text style={styles.pointsText} color={c.white}>
          {`+${brand.loyalty.welcomeBonus} pts`}
        </Text>
      </Animated.View>
    </Animated.View>
  ) : null;

  return (
    <AuthScaffold
      hero={<ProfileHero name={saved?.name ?? name} />}
      footer={
        <PrimaryBar
          label={saved ? 'Start ordering' : 'Continue'}
          icon={saved ? 'cafe' : 'arrow-forward'}
          loading={saving}
          disabled={!saved && nameInvalid}
          disabledHapticKind={null}
          onPress={saved ? enterApp : () => void submit()}
          accessibilityLabel={saved ? 'Start ordering' : 'Save profile and continue'}
        />
      }
    >
      {welcome ?? (
        <>
          <Animated.View entering={enterUp(0)}>
            <Text style={styles.title} accessibilityRole="header">
              What should we call you?
            </Text>
          </Animated.View>
          <Animated.View entering={enterUp(1)}>
            <Text style={styles.caption} color={c.inkSoft}>
              We write it on your cup.
            </Text>
          </Animated.View>

          <Animated.View entering={enterUp(2)} style={styles.fields}>
            <Animated.View style={shakeStyle}>
              <AuthField
                ref={nameRef}
                label="Name"
                value={name}
                onChangeText={setName}
                onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                placeholder="Maya Torres"
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                enterKeyHint="next"
                submitBehavior="submit"
                onSubmitEditing={() => emailRef.current?.focus()}
                autoFocus
                error={nameError}
                accessibilityLabel="Your name"
              />
              <AuthField
                ref={emailRef}
                label="Email (optional)"
                value={email}
                onChangeText={setEmail}
                onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                placeholder="you@example.com"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                enterKeyHint="done"
                onSubmitEditing={() => void submit()}
                error={emailError}
                hint="For receipts only."
                accessibilityLabel="Email, optional"
                containerStyle={styles.emailField}
              />
            </Animated.View>
          </Animated.View>

          <Animated.View entering={enterUp(3)} style={styles.verified}>
            <Text style={styles.meta} color={c.inkSoft}>
              {`${displayPhone(phone)} · `}
            </Text>
            <Pressable
              onPress={() => {
                // Clearing the number sends this screen back to /auth/phone (see the Redirect above).
                signOut();
              }}
              accessibilityRole="button"
              accessibilityLabel="Use a different phone number"
              hitSlop={12}
            >
              <Text style={[styles.meta, styles.notYou]} color={c.ink}>
                Not you?
              </Text>
            </Pressable>
          </Animated.View>

          {failure ? (
            <InlineNotice
              tone="error"
              icon={failure === 'network' ? 'cloud-offline' : undefined}
              message={
                failure === 'network' ? 'You’re offline. Check your connection.' : 'We couldn’t save your details just now.'
              }
              action={{ label: 'Try again', onPress: () => void submit() }}
              style={styles.notice}
            />
          ) : null}
        </>
      )}
    </AuthScaffold>
  );
}

const useStyles = makeStyles((c) => ({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroGreeting: {
    flexShrink: 1,
    fontFamily: fonts.light,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.6,
  },
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
  fields: { marginTop: 24 },
  emailField: { marginTop: 16 },
  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 20,
  },
  meta: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  notYou: { fontFamily: fonts.semibold, textDecorationLine: 'underline' },
  notice: { marginTop: 16 },
  success: { alignItems: 'center', paddingTop: 8, paddingBottom: 12 },
  successTitle: {
    marginTop: 16,
    fontFamily: fonts.bold,
    fontSize: 22,
    lineHeight: 28,
    color: c.ink,
  },
  points: {
    marginTop: 16,
    height: 34,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    backgroundColor: c.roast,
    justifyContent: 'center',
  },
  pointsText: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18 },
}));
