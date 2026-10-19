import { useState } from 'react';
import { Linking, Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { enterFade, exitFade, useToast } from '@/components/motion';
import { Text } from '@/components/ui';
import { canUseNotifications, requestNotificationPermission } from '@/lib/notify';
import { useSession } from '@/store/session';
import { fonts, useColors } from '@/theme';
import type { NotificationPrefs } from '@/types/models';
import { ListGroup } from './ListGroup';
import { ToggleRow } from './Toggle';

export interface NotificationPrefsCardProps {
  index?: number;
  title?: string;
}

/**
 * "Order updates" / "Offers & new drinks" switches (R3: label + a caption of six words or fewer, no
 * discs). When the OS permission is off (PRD §24 "Notifications denied") a quiet caption under the
 * sheet says so, with a text link to ask again or open the system settings.
 */
export function NotificationPrefsCard({ index = 0, title = 'Notifications' }: NotificationPrefsCardProps) {
  const prefs = useSession((s) => s.notificationPrefs);
  const permission = useSession((s) => s.notificationPermission);
  const setPrefs = useSession((s) => s.setNotificationPrefs);
  const setPermission = useSession((s) => s.setNotificationPermission);
  const toast = useToast();
  const [asking, setAsking] = useState(false);

  const granted = permission === 'granted';

  const ask = async () => {
    setAsking(true);
    const result = await requestNotificationPermission();
    setAsking(false);
    setPermission(result);
    // Silent: the system prompt was the feedback (docs/HAPTICS.md).
    if (result === 'granted') toast('Notifications are on.', { tone: 'success' });
    else toast('Notifications are still off.');
  };

  const update = (key: keyof NotificationPrefs) => (next: boolean) => {
    setPrefs({ [key]: next });
    // Switching something on while the OS hasn't been asked yet: ask right away.
    if (next && !granted && canUseNotifications && permission !== 'denied' && !asking) void ask();
  };

  const below = !canUseNotifications ? (
    <Note text="Updates show in the app." />
  ) : !granted ? (
    <Note
      text="Notifications are off in system settings."
      action={
        permission === 'denied'
          ? {
              label: 'Open settings',
              onPress: () => {
                Linking.openSettings().catch(() => toast('Open Settings → Ember Roast → Notifications.'));
              },
            }
          : { label: asking ? 'Asking…' : 'Turn on', onPress: () => void ask() }
      }
    />
  ) : null;

  return (
    <ListGroup title={title} index={index} below={below}>
      <ToggleRow
        title="Order updates"
        subtitle="Accepted, ready and on its way"
        value={prefs.orderUpdates}
        onValueChange={update('orderUpdates')}
      />
      <ToggleRow title="Offers & new drinks" subtitle="Seasonal drinks and deals" value={prefs.marketing} onValueChange={update('marketing')} />
    </ListGroup>
  );
}

function Note({ text, action }: { text: string; action?: { label: string; onPress: () => void } }) {
  const c = useColors();
  return (
    <Animated.View entering={enterFade(0)} exiting={exitFade} style={styles.note}>
      <Text style={styles.noteText} color={c.inkMuted}>
        {text}
      </Text>
      {action ? (
        <Pressable onPress={action.onPress} accessibilityRole="button" accessibilityLabel={action.label} hitSlop={12}>
          <Text style={[styles.noteText, styles.noteAction]} color={c.ink}>
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  note: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 6, marginTop: 10, paddingHorizontal: 4 },
  noteText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  noteAction: { fontFamily: fonts.semibold, textDecorationLine: 'underline' },
});
