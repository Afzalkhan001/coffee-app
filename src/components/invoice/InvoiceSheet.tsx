/**
 * The GST tax invoice as one paper sheet (`surface`: white in light, lifted espresso in dark) on the canvas (R3: typographic, hairline
 * rules, no icons, no fills). Top to bottom: title + status, number and date; the seller with its
 * GSTIN and FSSAI numbers; billed-to and place of supply; the item table (qty, rate, amount) with
 * the SAC; the tax summary (taxable value, CGST + SGST, delivery fee, tip); the grand total with
 * the amount in words; the payment references; the prototype footnote.
 */
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/ui';
import { brand } from '@/theme/brand';
import { fonts, makeStyles, radii, spacing, useColors } from '@/theme';
import { formatInvoiceAmount, INVOICE_FOOTNOTE, RESTAURANT_SAC, SELLER, type Invoice } from './invoice';

const PAD = 22;
const QTY_W = 26;
const RATE_W = 60;
const AMOUNT_W = 70;

function Rule({ strong = false }: { strong?: boolean }) {
  const styles = useStyles();
  return <View style={[styles.rule, strong ? styles.ruleStrong : null]} />;
}

function Label({ children, align }: { children: string; align?: 'left' | 'center' | 'right' }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <Text style={styles.label} color={c.inkMuted} align={align}>
      {children}
    </Text>
  );
}

/** A two-up block: a quiet label over its value. */
function Field({ label, value, sub, align }: { label: string; value: string; sub?: string; align?: 'left' | 'right' }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={[styles.field, align === 'right' ? styles.fieldRight : null]}>
      <Label align={align}>{label}</Label>
      <Text style={styles.fieldValue} align={align}>
        {value}
      </Text>
      {sub ? (
        <Text style={styles.small} color={c.inkSoft} align={align}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

export function InvoiceSheet({ invoice, style }: { invoice: Invoice; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const styles = useStyles();
  const money = (n: number) => `${brand.currency.symbol}${formatInvoiceAmount(n)}`;
  return (
    <View style={[styles.paper, style]}>
      {/* Title */}
      <View style={styles.titleRow}>
        <Text style={styles.title} accessibilityRole="header">
          Tax invoice
        </Text>
        <Text style={styles.status} color={invoice.status === 'Paid' ? c.sageText : c.inkSoft}>
          {invoice.status}
        </Text>
      </View>
      <Text style={styles.number} selectable>
        {invoice.number}
      </Text>
      <Text style={styles.small} color={c.inkSoft}>
        {invoice.issuedAt}
      </Text>

      <Rule />
      {/* Seller */}
      <Text style={styles.seller}>{SELLER.legalName}</Text>
      <Text style={styles.small} color={c.inkSoft}>
        {brand.store.address}
      </Text>
      <View style={styles.ids}>
        <Text style={styles.small} color={c.inkSoft}>
          {'GSTIN '}
          <Text style={styles.idValue}>{SELLER.gstin}</Text>
        </Text>
        <Text style={styles.small} color={c.inkSoft}>
          {'FSSAI Lic. No. '}
          <Text style={styles.idValue}>{SELLER.fssai}</Text>
        </Text>
      </View>

      <Rule />
      {/* Buyer */}
      <View style={styles.twoUp}>
        <Field label="Billed to" value={invoice.customer.name} sub={invoice.customer.phone} />
        <Field label="Place of supply" value={invoice.placeOfSupply} align="right" />
      </View>
      {invoice.customer.address ? (
        <Text style={[styles.small, styles.address]} color={c.inkSoft}>
          {`Delivered to ${invoice.customer.address}`}
        </Text>
      ) : null}

      <Rule />
      {/* Items */}
      <View style={styles.tableHead} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.flex}>
          <Label>Item</Label>
        </View>
        <View style={styles.qty}>
          <Label align="center">Qty</Label>
        </View>
        <View style={styles.rate}>
          <Label align="right">Rate</Label>
        </View>
        <View style={styles.amount}>
          <Label align="right">Amount</Label>
        </View>
      </View>
      {invoice.lines.map((line) => (
        <View
          key={line.id}
          style={styles.line}
          accessible
          accessibilityLabel={`${line.qty} × ${line.name}${line.detail ? `, ${line.detail}` : ''}, at ${money(line.rate)}, ${money(line.amount)}`}
        >
          <View style={styles.flex}>
            <Text style={styles.lineName}>{line.name}</Text>
            {line.detail ? (
              <Text style={styles.lineDetail} color={c.inkSoft}>
                {line.detail}
              </Text>
            ) : null}
          </View>
          <Text style={[styles.cell, styles.qty]} align="center">
            {String(line.qty)}
          </Text>
          <Text style={[styles.cell, styles.rate]} align="right" color={c.inkSoft}>
            {formatInvoiceAmount(line.rate)}
          </Text>
          <Text style={[styles.cell, styles.amount]} align="right">
            {formatInvoiceAmount(line.amount)}
          </Text>
        </View>
      ))}
      <Text style={[styles.small, styles.sac]} color={c.inkMuted}>
        {`SAC ${RESTAURANT_SAC} · Restaurant services · amounts in ${brand.currency.symbol}`}
      </Text>

      <Rule />
      {/* Summary */}
      {invoice.rows.map((row) => (
        <View
          key={row.key}
          style={[styles.sumRow, row.emphasis ? styles.sumRowEmphasis : null]}
          accessible
          accessibilityLabel={`${row.label} ${money(row.amount)}`}
        >
          <Text style={[styles.sumLabel, row.emphasis ? styles.sumStrong : null]} color={row.emphasis ? c.ink : c.inkSoft}>
            {row.label}
          </Text>
          <Text style={[styles.sumValue, row.emphasis ? styles.sumStrong : null]} color={row.key === 'discount' ? c.sageText : c.ink}>
            {formatInvoiceAmount(row.amount)}
          </Text>
        </View>
      ))}

      <Rule strong />
      <View style={styles.totalRow} accessible accessibilityLabel={`Grand total ${money(invoice.grandTotal)}. ${invoice.grandTotalWords}`}>
        <Text style={styles.totalLabel}>Grand total</Text>
        <Text style={styles.total}>{money(invoice.grandTotal)}</Text>
      </View>
      <Text style={styles.words} color={c.inkSoft}>
        {invoice.grandTotalWords}
      </Text>

      <Rule />
      {/* Payment */}
      {invoice.payment.map((p) => (
        <View key={p.label} style={styles.payRow}>
          <Text style={styles.small} color={c.inkSoft}>
            {p.label}
          </Text>
          <Text style={styles.payValue} align="right" selectable>
            {p.value}
          </Text>
        </View>
      ))}

      <Text style={styles.footnote} color={c.inkMuted} align="center">
        {INVOICE_FOOTNOTE}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1, minWidth: 0 },
  paper: { backgroundColor: c.surface, borderRadius: radii.md, paddingHorizontal: PAD, paddingTop: PAD + 2, paddingBottom: PAD },
  rule: { height: StyleSheet.hairlineWidth * 2, backgroundColor: c.line, marginVertical: spacing.md },
  ruleStrong: { height: 1.5, backgroundColor: c.ink, opacity: 0.85 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  title: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, color: c.ink, letterSpacing: -0.3 },
  status: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  number: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: c.ink, letterSpacing: 0.2, marginTop: 6 },
  small: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18 },
  seller: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: c.ink, marginBottom: 2 },
  ids: { marginTop: 6 },
  idValue: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 18, color: c.ink, letterSpacing: 0.3 },
  label: { fontFamily: fonts.semibold, fontSize: 11.5, lineHeight: 16 },
  twoUp: { flexDirection: 'row', gap: spacing.md },
  field: { flex: 1, minWidth: 0, gap: 2 },
  fieldRight: { alignItems: 'flex-end' },
  fieldValue: { fontFamily: fonts.medium, fontSize: 14.5, lineHeight: 20, color: c.ink },
  address: { marginTop: spacing.xs },
  tableHead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 6 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingVertical: 7 },
  lineName: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 19, color: c.ink },
  lineDetail: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, marginTop: 1 },
  cell: { fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 19 },
  qty: { width: QTY_W },
  rate: { width: RATE_W },
  amount: { width: AMOUNT_W },
  sac: { marginTop: spacing.xs },
  sumRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingVertical: 3 },
  sumRowEmphasis: { marginTop: 6, paddingTop: 9, borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: c.line, marginBottom: 3 },
  sumLabel: { flex: 1, minWidth: 0, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  sumValue: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
  sumStrong: { fontFamily: fonts.semibold },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  totalLabel: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: c.ink },
  total: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 32, color: c.ink, letterSpacing: -0.4 },
  words: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, marginTop: 4 },
  payRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 2 },
  payValue: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: c.ink },
  footnote: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, marginTop: spacing.lg },
}));
