import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { ListRow } from '@/components/ui';
import { makeStyles, spacing } from '@/theme';
import type { Order } from '@/types/models';
import { hasInvoice } from './invoice';

/**
 * "View GST invoice" (order details): the first row of the order's closing sheet, with a hairline
 * under it. Renders nothing until the order has an invoice (paid, or completed and collected).
 */
export function InvoiceLinkRow({ order }: { order: Order }) {
  const styles = useStyles();
  if (!hasInvoice(order)) return null;
  return (
    <View>
      <ListRow
        title="View GST invoice"
        onPress={() => router.push({ pathname: '/order/invoice/[id]', params: { id: order.id } })}
        accessibilityLabel="View GST invoice"
      />
      <View style={styles.hairline} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  hairline: { height: StyleSheet.hairlineWidth * 2, backgroundColor: c.line, marginLeft: spacing.md, marginRight: spacing.md },
}));
