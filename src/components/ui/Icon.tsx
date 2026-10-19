import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { useColors } from '@/theme';
import { LineIcon } from './LineIcon';
import { resolveLineIcon, type LineIconName } from './lineIconPaths';

export type IconName = ComponentProps<typeof Ionicons>['name'] | LineIconName;

/**
 * App icon. Names in the custom line set (`LineIcon`) — and the Ionicons names mapped onto it
 * (home, cafe, bag-handle, location, time, chevrons…) — render as Ember Roast line icons; anything
 * else falls back to Ionicons, so every screen gets the cohesive set without edits.
 */
export function Icon({
  name,
  size = 22,
  color: colorProp,
  strokeWidth,
}: {
  name: IconName | string;
  size?: number;
  color?: string;
  /** LineIcon stroke in 24-grid units (ignored for Ionicons fallbacks). */
  strokeWidth?: number;
}) {
  const c = useColors();
  const color = colorProp ?? c.ink;
  const line = resolveLineIcon(name);
  if (line) return <LineIcon name={line.name} filled={line.filled} size={size} color={color} strokeWidth={strokeWidth} />;
  return <Ionicons name={name as ComponentProps<typeof Ionicons>['name']} size={size} color={color} />;
}
