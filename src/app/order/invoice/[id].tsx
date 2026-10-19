/**
 * GST tax invoice for an order (prototype): "Invoice" with a share circle, then the invoice as one
 * paper-white sheet on the cream canvas (`InvoiceSheet`). Share sends a plain-text version through
 * the system share sheet (web without Web Share: copied to the clipboard). Opened from "View GST
 * invoice" on a paid or completed order; anything else gets a calm empty state.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { Platform, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOrder } from '@/api/hooks';
import { HeaderScrollEdge, useHeaderScroll } from '@/components/account/HeaderScrollEdge';
import { riseIn } from '@/components/checkout/motion';
import { EmptyState } from '@/components/domain';
import { buildInvoice, hasInvoice, invoiceText } from '@/components/invoice/invoice';
import { InvoiceSheet } from '@/components/invoice/InvoiceSheet';
import { shareText } from '@/components/invoice/share';
import { useToast } from '@/components/motion';
import { CircleButton, Screen, ScreenHeader } from '@/components/ui';
import { makeStyles, spacing } from '@/theme';

export default function InvoiceScreen() {
  const styles = useStyles();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const order = useOrder(id);
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { scrollY, onScroll } = useHeaderScroll();

  if (!order || !hasInvoice(order)) {
    return (
      <Screen>
        <ScreenHeader title="Invoice" />
        <View style={styles.empty}>
          <EmptyState
            art="plate"
            title={order ? 'No invoice yet' : 'We couldn’t find that order'}
            message={order ? 'It’s issued once the order is paid.' : 'It may have been cleared by a demo reset.'}
            action={{ label: order ? 'Back to the order' : 'View my orders', onPress: () => (order ? router.back() : router.navigate('/orders')) }}
          />
        </View>
      </Screen>
    );
  }

  const invoice = buildInvoice(order);
  const share = async () => {
    const outcome = await shareText(`Tax invoice ${invoice.number}`, invoiceText(invoice));
    if (outcome === 'copied') toast('Invoice copied', { icon: 'copy-outline' });
    else if (outcome === 'failed') toast('Couldn’t share the invoice. Try again.', { tone: 'error' });
  };

  return (
    <Screen>
      <ScreenHeader
        title="Invoice"
        right={
          <CircleButton
            icon={Platform.OS === 'android' ? 'share-social-outline' : 'share-outline'}
            size={44}
            tone="white"
            onPress={() => void share()}
            accessibilityLabel="Share invoice"
          />
        }
      />
      <View style={styles.flex}>
        <Animated.ScrollView
          onScroll={onScroll}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={riseIn(60)}>
            <InvoiceSheet invoice={invoice} />
          </Animated.View>
        </Animated.ScrollView>
        <HeaderScrollEdge scrollY={scrollY} />
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1, backgroundColor: c.bg },
  empty: { flex: 1, justifyContent: 'center', paddingBottom: spacing.xxxl },
  content: { paddingHorizontal: spacing.gutter, paddingTop: spacing.sm },
}));
