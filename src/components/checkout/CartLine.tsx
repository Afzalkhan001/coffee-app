import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { getProductSync } from '@/api';
import { measureInWindowAsync, RollingNumber, type WindowRect } from '@/components/motion';
import { ArtThumb, QuantityStepper } from '@/components/domain';
import { dietLabel, VegMark } from '@/components/domain/VegMark';
import { PressableScale, Text } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { summarizeModifiers } from '@/lib/modifiers';
import { lineTotal } from '@/lib/pricing';
import { MAX_LINE_QTY } from '@/store/cart';
import { fonts, makeStyles, radii, spacing, useColors } from '@/theme';
import type { CartItem } from '@/types/models';

/** Thumbnail tile (R3: 64 / r20 / 58 art) and the sheet's side padding: text starts at 20 + 64 + 16. */
export const LINE_THUMB = 64;
export const LINE_PAD = 20;
export const LINE_GAP = 16;
/** Where the row text (and the hairline) starts inside the sheet. */
export const LINE_TEXT_INSET = LINE_PAD + LINE_THUMB + LINE_GAP;

/** "M · Oat · Vanilla": short option names where the menu defines them. */
export function lineModifiers(item: Pick<CartItem, 'modifiers'>): string {
  return summarizeModifiers(item.modifiers.map((m) => ({ ...m, optionName: m.shortName ?? m.optionName })));
}

/** "Caffè Latte is sold out today" → "Sold out today" (the name is right above it). */
function shortIssue(issue: string, name: string): string {
  const prefix = `${name} is `;
  if (!issue.startsWith(prefix)) return issue;
  const rest = issue.slice(prefix.length);
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

export interface CartLineProps {
  item: CartItem;
  /** `from`: the thumbnail's art-box rect, for the product screen's hero flight. */
  onEdit: (from: WindowRect | null) => void;
  onLongPress: () => void;
  onQuantity: (quantity: number) => void;
  /** Draw a hairline under the row, inset to the text column (all but the last). */
  divider: boolean;
  /** Why the line can't be ordered today ("… is sold out today", PRD §24), from `cartLineIssue`. */
  issue?: string | null;
  /** Reveal the remove action (sold-out lines offer it instead of the stepper). */
  onRemove?: () => void;
}

/**
 * Ref-1 cart row (R3, 88h): a 64px tinted tile with the cut-out, name 16/600, the modifiers on one
 * 13 `inkSoft` line, a 28px canvas stepper, and the line price in a canvas pill (34h, 15/700,
 * rolling digits) vertically centred on the right. Tap edits, long-press reveals delete. The note
 * lives on the edit screen and the checkout lines, not here.
 */
export function CartLine({ item, onEdit, onLongPress, onQuantity, divider, issue, onRemove }: CartLineProps) {
  const c = useColors();
  const styles = useStyles();
  const mods = lineModifiers(item);
  const total = lineTotal(item);
  // The FSSAI veg / egg / non-veg mark from the menu (lines don't store it; an unknown product has none).
  const diet = getProductSync(item.productId)?.diet;
  const artRef = useRef<View>(null);
  const edit = async () => onEdit(await measureInWindowAsync(artRef));
  return (
    <PressableScale
      onPress={() => void edit()}
      onLongPress={onLongPress}
      delayLongPress={380}
      activeScale={0.985}
      accessibilityLabel={`${item.quantity} ${item.name}${diet ? `, ${dietLabel(diet)}` : ''}${mods ? `, ${mods}` : ''}, ${formatMoney(total)}${issue ? `. ${issue}` : ''}`}
      accessibilityHint="Opens the item to edit it. Swipe left or long-press to remove."
      style={styles.row}
    >
      <ArtThumb image={item.image} size={LINE_THUMB} artRef={artRef} artOpacity={issue ? 0.45 : 1} recyclingKey={item.id} />

      <View style={styles.body}>
        {/* Two lines: a 4–5 digit ₹ pill ("₹2,560") leaves ~140px on a 375pt phone. */}
        <View style={styles.nameRow}>
          {diet ? <VegMark diet={diet} size={12} decorative style={styles.mark} /> : null}
          <Text style={styles.name} numberOfLines={2}>
            {item.name}
          </Text>
        </View>
        {mods ? (
          <Text variant="caption" color={c.inkSoft} numberOfLines={1}>
            {mods}
          </Text>
        ) : null}
        {issue ? (
          <View style={styles.issueRow}>
            <Text style={styles.issue} color={c.danger} numberOfLines={1}>
              {shortIssue(issue, item.name)}
            </Text>
            {onRemove ? (
              <PressableScale onPress={onRemove} activeScale={0.94} hitSlop={10} accessibilityLabel={`Remove ${item.name} (unavailable)`}>
                <Text style={styles.remove} color={c.ink}>
                  Remove
                </Text>
              </PressableScale>
            ) : null}
          </View>
        ) : (
          <QuantityStepper value={item.quantity} onChange={onQuantity} min={1} max={MAX_LINE_QTY} style={styles.stepper} />
        )}
      </View>

      <View style={[styles.pricePill, issue ? styles.priceOut : null]}>
        <RollingNumber value={total} money fontSize={15} fontFamily={fonts.bold} color={c.ink} />
      </View>
      {divider ? <View style={styles.divider} /> : null}
    </PressableScale>
  );
}

const useStyles = makeStyles((c) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LINE_GAP,
    minHeight: 88,
    paddingVertical: spacing.sm,
    paddingHorizontal: LINE_PAD,
  },
  body: { flex: 1, minWidth: 0 },
  // The mark sits on the first line of a name that may wrap to two.
  nameRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  mark: { marginTop: 5 },
  name: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  stepper: { marginTop: 6, alignSelf: 'flex-start' },
  issueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 6, minHeight: 28 },
  issue: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  remove: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, textDecorationLine: 'underline' },
  pricePill: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    backgroundColor: c.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceOut: { opacity: 0.45 },
  // The one divider style in the sheet: a solid hairline from the text column to the edge.
  divider: {
    position: 'absolute',
    left: LINE_TEXT_INSET,
    right: LINE_PAD,
    bottom: 0,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: c.line,
  },
}));
