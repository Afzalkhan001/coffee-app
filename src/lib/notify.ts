/**
 * Local notification wrapper. Never throws: notifications are a nice-to-have
 * in the prototype. Push notifications (Phase 5) will replace the order-status ones.
 *
 * IMPORTANT: on web and on Android Expo Go, merely evaluating `expo-notifications`
 * is a fatal error that try/catch cannot intercept — so we must short-circuit
 * BEFORE calling import() (docs/research/expo-sdk57.md §8).
 */
import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import type { PermissionState } from '@/types/models';

type NotificationsModule = typeof import('expo-notifications');
let modPromise: Promise<NotificationsModule | null> | null = null;

export const canUseNotifications = Platform.OS !== 'web' && !(Platform.OS === 'android' && isRunningInExpoGo());

function load(): Promise<NotificationsModule | null> {
  if (!canUseNotifications) return Promise.resolve(null);
  modPromise ??= import('expo-notifications')
    .then(async (N) => {
      N.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true, // Android: false would suppress the heads-up banner
          shouldSetBadge: false,
        }),
      });
      if (Platform.OS === 'android') {
        await N.setNotificationChannelAsync('orders', {
          name: 'Order updates',
          importance: N.AndroidImportance.HIGH,
        }).catch(() => {});
      }
      return N;
    })
    .catch(() => null);
  return modPromise;
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  const N = await load();
  if (!N) return 'denied';
  try {
    const current = await N.getPermissionsAsync();
    if (current.granted) return 'granted';
    const res = await N.requestPermissionsAsync();
    return res.granted ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

export async function notifyNow(title: string, body: string): Promise<void> {
  const N = await load();
  if (!N) return;
  try {
    await N.scheduleNotificationAsync({ content: { title, body }, trigger: null });
  } catch {
    // unsupported in this runtime
  }
}
