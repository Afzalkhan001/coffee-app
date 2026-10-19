import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { isNetworkError, saveProfile } from '@/api';
import { useShake, useToast } from '@/components/motion';
import { PrimaryBar, Text, TextField } from '@/components/ui';
import { firstName } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useSession } from '@/store/session';
import { spacing, useTheme } from '@/theme';
import { ModalSheet } from './ModalSheet';

const MIN_NAME = 2;

function saveErrorMessage(e: unknown): string {
  if (isNetworkError(e)) return 'You’re offline. Your name will save once you’re connected.';
  return 'Couldn’t save that just now. Please try again.';
}

export interface EditNameSheetProps {
  visible: boolean;
  onClose: () => void;
}

/** Bottom sheet to change the name we call out at the bar (saves through the API, then the session). */
export function EditNameSheet({ visible, onClose }: EditNameSheetProps) {
  const { colors: c, keyboardAppearance } = useTheme();
  const profile = useSession((s) => s.profile);
  const phone = useSession((s) => s.phone);
  const setProfile = useSession((s) => s.setProfile);
  const toast = useToast();
  const { style: shakeStyle, shake } = useShake();

  const [name, setName] = useState(profile?.name ?? '');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  // Fresh field every time the sheet opens (derived state, no effect).
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setName(profile?.name ?? '');
      setError(undefined);
    }
  }

  /** Shake + haptic: `warning` for a missing name (a missing step), `error` when the save fails. */
  const fail = (message: string, kind: 'warning' | 'error' = 'error') => {
    setError(message);
    if (kind === 'warning') haptic.warning();
    else haptic.error();
    shake();
  };

  const save = async () => {
    const trimmed = name.trim().replace(/\s+/g, ' ');
    if (trimmed.length < MIN_NAME) {
      fail('Please enter your name, at least 2 letters.', 'warning');
      return;
    }
    if (!phone || !profile) return;
    if (trimmed === profile.name) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      const updated = await saveProfile(phone, { name: trimmed, email: profile.email });
      setProfile(updated);
      // Silent: the toast is the outcome (success is kept for orders, payment and rewards).
      onClose();
      toast(`Got it, ${firstName(trimmed)}. We’ll call that at the bar.`, { tone: 'success', icon: 'profile' });
    } catch (e) {
      fail(saveErrorMessage(e));
    }
    setSaving(false);
  };

  return (
    <ModalSheet visible={visible} onClose={onClose} dismissable={!saving} accessibilityLabel="Edit your name" withInput>
      <Text variant="h2" accessibilityRole="header">
        Edit your name
      </Text>
      <Text variant="body" color={c.inkSoft} style={styles.sub}>
        We write it on your cup.
      </Text>
      <Animated.View style={[styles.field, shakeStyle]}>
        <TextField
          label="Name"
          value={name}
          onChangeText={(t) => {
            setName(t);
            if (error) setError(undefined);
          }}
          placeholder="Your name"
          autoFocus
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          maxLength={40}
          returnKeyType="done"
          onSubmitEditing={() => void save()}
          error={error}
          accessibilityLabel="Your name"
          keyboardAppearance={keyboardAppearance}
        />
      </Animated.View>
      <View style={styles.actions}>
        <PrimaryBar label="Save name" icon="checkmark" loading={saving} onPress={() => void save()} />
      </View>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  sub: { marginTop: 4 },
  field: { marginTop: spacing.lg },
  actions: { marginTop: spacing.lg },
});
