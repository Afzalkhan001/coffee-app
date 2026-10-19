/**
 * Delivery partner tip choice (checkout, delivery only). Pure: the chips and the "Other" field
 * map to one rupee amount and, for a bad "Other" entry, one message.
 */
import { parseTip, TIP_MAX, TIP_MIN, TIP_PRESETS } from '@/lib/pricing';
import { formatMoney } from '@/lib/format';

/** "No tip" (the default), a preset amount, or "Other" (typed). */
export type TipChoice = 'none' | (typeof TIP_PRESETS)[number] | 'other';

export const TIP_CHOICES: readonly TipChoice[] = ['none', ...TIP_PRESETS, 'other'];

export function tipChoiceLabel(choice: TipChoice): string {
  if (choice === 'none') return 'No tip';
  if (choice === 'other') return 'Other';
  return formatMoney(choice);
}

/** The tip in ₹ for a choice ("Other" with a bad amount tips nothing until it's fixed). */
export function tipAmount(choice: TipChoice, otherText: string): number {
  if (choice === 'none') return 0;
  if (choice === 'other') return parseTip(otherText) ?? 0;
  return choice;
}

/** Why the "Other" amount can't be used, or null. */
export function tipIssue(choice: TipChoice, otherText: string): string | null {
  if (choice !== 'other' || parseTip(otherText) !== null) return null;
  return `Enter a tip from ${formatMoney(TIP_MIN)} to ${formatMoney(TIP_MAX)}, or choose No tip.`;
}
