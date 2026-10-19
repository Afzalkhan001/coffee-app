import { Platform, Share } from 'react-native';
import { attempt } from '@/lib/async';

export type ShareOutcome = 'shared' | 'dismissed' | 'copied' | 'failed';

/** Web without the async Clipboard API (an http:// page): a hidden textarea and the copy command. */
function legacyCopy(text: string): boolean {
  if (typeof document === 'undefined') return false;
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(area);
  return ok;
}

/**
 * Shares the invoice's text version with the system share sheet (React Native `Share`). Browsers
 * without the Web Share API copy it to the clipboard instead.
 */
export async function shareText(title: string, message: string): Promise<ShareOutcome> {
  const res = await attempt(Share.share({ title, message }, { dialogTitle: title, subject: title }));
  if (res.ok) return res.value.action === Share.dismissedAction ? 'dismissed' : 'shared';
  if (Platform.OS !== 'web') return 'failed';
  // The Web Share sheet was there and the customer closed it.
  if (res.error instanceof Error && res.error.name === 'AbortError') return 'dismissed';
  const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
  if (clipboard) {
    const copied = await attempt(clipboard.writeText(message));
    if (copied.ok) return 'copied';
  }
  return legacyCopy(message) ? 'copied' : 'failed';
}
