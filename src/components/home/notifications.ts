/** Inbox items for the Home bell, derived from live order, promo and loyalty data. */
import { router } from 'expo-router';
import { useActiveOrders, useLoyalty } from '@/api/hooks';
import { etaLabel, localPhotoKey, useNow } from '@/components/domain';
import { REWARDS } from '@/data/mock/marketing';
import { statusLabel } from '@/lib/orderFlow';
import type { Promotion } from '@/types/models';
import type { NotificationItem } from './NotificationsPopover';
import { formatCount } from '@/lib/format';

/** True when the inbox would have something to show (drives the bell's dot without building the list). */
export function useHasHomeNotifications(promotions: Promotion[] | undefined): boolean {
  const hasOrder = useActiveOrders().length > 0;
  const { balance } = useLoyalty();
  return hasOrder || balance > 0 || !!promotions?.some((p) => p.code);
}

/**
 * The reward whose cut-out fronts the points row: the best one the balance already covers, skipping
 * images the inbox already shows (so three rows never repeat a product); else the cheapest.
 */
function rewardImage(balance: number, shown: (string | undefined)[]): string | undefined {
  const sorted = [...REWARDS].sort((a, b) => b.cost - a.cost);
  const affordable = sorted.filter((r) => r.cost <= balance);
  const seen = new Set(shown.map((img) => localPhotoKey(img) ?? img));
  const pick = affordable.find((r) => !seen.has(localPhotoKey(r.image) ?? r.image)) ?? affordable[0] ?? sorted[sorted.length - 1];
  return pick?.image;
}

export function useHomeNotifications(promotions: Promotion[] | undefined): NotificationItem[] {
  const active = useActiveOrders();
  const { balance } = useLoyalty();
  const now = useNow(30_000);
  const items: NotificationItem[] = [];

  const order = active[0];
  if (order) {
    items.push({
      id: `order-${order.id}`,
      image: order.items[0]?.image,
      title: statusLabel(order.status, order.details.mode),
      body: `${order.number} · ${etaLabel(order, now)}`,
      onPress: () => router.push({ pathname: '/order/[id]', params: { id: order.id } }),
    });
  }

  const promo = promotions?.find((p) => p.code);
  if (promo?.code) {
    items.push({
      id: `promo-${promo.id}`,
      image: promo.image,
      title: promo.title.replace(/\n/g, ' '),
      body: `Use ${promo.code} at checkout`,
      onPress: () => router.navigate('/menu'),
    });
  }

  if (balance > 0) {
    items.push({
      id: 'rewards',
      image: rewardImage(
        balance,
        items.map((i) => i.image),
      ),
      title: `${formatCount(balance)} pts to spend`,
      body: 'Drinks, pastries and more',
      onPress: () => router.navigate('/rewards'),
    });
  }

  return items;
}
