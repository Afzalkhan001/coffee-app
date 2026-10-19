/**
 * Where "home" is for the current auth state, without importing the session store (keeps ui/ and
 * lib/ free of persisted stores). store/session registers the reader when it loads.
 */
export interface AuthRouteState {
  onboardingDone: boolean;
  signedIn: boolean;
}

let read: () => AuthRouteState = () => ({ onboardingDone: true, signedIn: true });

export function registerAuthRouteReader(reader: () => AuthRouteState) {
  read = reader;
}

/** First screen the current guards allow: Home, sign-in, or onboarding. */
export function homeRouteForAuth(): '/' | '/auth/phone' | '/onboarding' {
  const { onboardingDone, signedIn } = read();
  return signedIn ? '/' : onboardingDone ? '/auth/phone' : '/onboarding';
}
