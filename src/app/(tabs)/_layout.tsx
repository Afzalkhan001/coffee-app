import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { useActiveOrderCount } from '@/api/hooks';
import { TabBar } from '@/components/navigation/TabBar';
import { makeThemed } from '@/theme';

/** Module-level render prop: a stable identity, so a layout re-render never rebuilds the bar. */
const renderTabBar = (props: BottomTabBarProps) => <TabBar {...props} />;

/** One stable options object per scheme (the scene background follows the canvas). */
const useScreenOptions = makeThemed(
  (c) =>
    ({
      headerShown: false,
      animation: 'fade',
      sceneStyle: { backgroundColor: c.bg },
    }) as const,
);

/**
 * Bottom tabs with the custom floating pill bar (DESIGN.md §5 "Bottom navigation").
 * Labels come from each screen's `title`; icons are mapped by route name inside TabBar.
 * The Orders tab carries a small sage dot while an order is in progress.
 */
export default function TabsLayout() {
  // A primitive count: simulator status ticks don't re-render the layout (only a count change does).
  const activeOrders = useActiveOrderCount();
  const screenOptions = useScreenOptions();

  return (
    <Tabs tabBar={renderTabBar} screenOptions={screenOptions}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="menu" options={{ title: 'Menu' }} />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarBadge: activeOrders > 0 ? activeOrders : undefined,
          tabBarAccessibilityLabel: activeOrders > 0 ? `Orders, ${activeOrders} in progress` : 'Orders',
        }}
      />
      <Tabs.Screen name="rewards" options={{ title: 'Rewards' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
