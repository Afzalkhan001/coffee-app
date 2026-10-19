import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet } from 'react-native';
import { useLoyalty, useMyOrders } from '@/api/hooks';
import { BrandFooter } from '@/components/account/BrandFooter';
import { ConfirmSheet } from '@/components/account/ConfirmSheet';
import { EditNameSheet } from '@/components/account/EditNameSheet';
import { ListGroup } from '@/components/account/ListGroup';
import { ProfileCard } from '@/components/account/ProfileCard';
import { TabHeader } from '@/components/account/TabHeader';
import { useToast } from '@/components/motion';
import { useTabBarSpace } from '@/components/navigation/TabBar';
import { useLivePillSpace } from '@/components/order/livePillSpace';
import { CircleButton, ListRow, Screen } from '@/components/ui';
import { useFavorites } from '@/store/favorites';
import { useSession } from '@/store/session';
import { brand } from '@/theme/brand';
import { formatCount } from '@/lib/format';

/**
 * Profile tab (DESIGN.md §R3.B "Profile"; PRD §18): identity and a stats row on the canvas, then
 * three sentence-case groups of 56px rows with their value on the right; log out is the Support
 * sheet's last (danger) row, so the screen is three white sheets, not five.
 * The full notification switches live in Settings; Profile shows a one-word summary that links there.
 */
export default function ProfileScreen() {
  const profile = useSession((s) => s.profile);
  const phone = useSession((s) => s.phone);
  const addresses = useSession((s) => s.addresses);
  const favoriteCount = useFavorites((s) => s.ids.length);
  const signOut = useSession((s) => s.signOut);
  const orderUpdates = useSession((s) => s.notificationPrefs.orderUpdates);
  const orders = useMyOrders();
  const loyalty = useLoyalty();
  // The live order pill floats above the tab bar here: let the last row scroll clear of it.
  const bottom = useTabBarSpace() + useLivePillSpace();
  const toast = useToast();

  const [editOpen, setEditOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const leaving = useRef(false);

  const latest = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  const reportIssue = () => {
    const subject = latest ? `Issue with order ${latest.number}` : 'Issue with an order';
    Linking.openURL(`mailto:${brand.supportEmail}?subject=${encodeURIComponent(subject)}`).catch(() =>
      toast(`Email us at ${brand.supportEmail}`),
    );
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom }]} showsVerticalScrollIndicator={false}>
        <TabHeader
          title="Profile"
          style={styles.header}
          right={
            <CircleButton icon="settings-outline" size={44} onPress={() => router.push('/settings')} accessibilityLabel="Settings" />
          }
        />

        <ProfileCard
          profile={profile}
          phone={phone}
          orders={orders.length}
          points={loyalty.balance}
          onEdit={() => setEditOpen(true)}
          index={0}
          style={styles.identity}
        />

        <ListGroup title="Account" index={2} style={styles.group}>
          <ListRow title="Order history" value={String(orders.length)} onPress={() => router.navigate('/orders')} />
          <ListRow title="Favourites" value={String(favoriteCount)} onPress={() => router.push('/favorites')} />
          <ListRow title="Rewards" value={`${formatCount(loyalty.balance)} pts`} onPress={() => router.navigate('/rewards')} />
          <ListRow title="Saved addresses" value={String(addresses.length)} onPress={() => router.push('/address')} />
        </ListGroup>

        <ListGroup title="Preferences" index={3} style={styles.group}>
          <ListRow title="Notifications" value={orderUpdates ? 'Orders on' : 'Orders off'} onPress={() => router.push('/settings')} />
          <ListRow title="Settings" onPress={() => router.push('/settings')} />
        </ListGroup>

        {/* Log out closes the Support sheet (a danger row, no chevron) instead of a sheet of its own. */}
        <ListGroup title="Support" index={4} style={styles.group}>
          <ListRow title="Help & FAQ" onPress={() => router.push('/help')} />
          <ListRow title="Report an issue" onPress={reportIssue} />
          <ListRow title="Terms & privacy" onPress={() => router.push({ pathname: '/legal', params: { doc: 'terms' } })} />
          <ListRow title="Log out" danger showChevron={false} onPress={() => setLogoutOpen(true)} />
        </ListGroup>

        <BrandFooter index={5} style={styles.footer} />
      </ScrollView>

      <EditNameSheet visible={editOpen} onClose={() => setEditOpen(false)} />

      <ConfirmSheet
        visible={logoutOpen}
        title="Log out?"
        message="Your orders and points stay with your number."
        confirmLabel="Log out"
        cancelLabel="Stay signed in"
        destructive
        onConfirm={() => {
          leaving.current = true;
          setLogoutOpen(false);
        }}
        onCancel={() => setLogoutOpen(false)}
        onClosed={() => {
          if (!leaving.current) return;
          leaving.current = false;
          // Silent: the dialog's Confirm already clicked.
          // The root Stack.Protected guard redirects to /auth/phone on its own (BUILD_CONTRACT routing).
          signOut();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20 },
  header: { paddingHorizontal: 0 },
  identity: { marginTop: 4 },
  group: { marginTop: 24 },
  footer: { marginTop: 28 },
});
