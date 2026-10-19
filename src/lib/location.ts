import * as Location from 'expo-location';
import { Platform } from 'react-native';
import type { PermissionState } from '@/types/models';
import { withTimeout } from './async';

/** A web prompt the user ignores never settles; after this we treat it as "no answer yet". */
const WEB_PROMPT_TIMEOUT_MS = 20_000;
/** GPS fixes can hang (web) or take very long indoors (native). */
const FIX_TIMEOUT_MS = 12_000;

/**
 * Ask for foreground location (precise or approximate — the OS decides). Never throws.
 * On web an ignored prompt resolves to `'undetermined'` after 20s; native prompts are modal and
 * always get an answer.
 */
export async function requestLocationPermission(): Promise<PermissionState> {
  const ask = Location.requestForegroundPermissionsAsync().then(
    (res): PermissionState => (res.granted ? 'granted' : 'denied'),
    (): PermissionState => 'denied',
  );
  return Platform.OS === 'web' ? withTimeout(ask, WEB_PROMPT_TIMEOUT_MS, 'undetermined') : ask;
}

/** Current position, or `null` without permission, on error, or after 12s without a fix. */
export async function getCurrentPosition(): Promise<{ lat: number; lng: number } | null> {
  const perm = await withTimeout(Location.getForegroundPermissionsAsync(), FIX_TIMEOUT_MS, null);
  if (!perm?.granted) return null;
  const pos = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), FIX_TIMEOUT_MS, null);
  return pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : null;
}
