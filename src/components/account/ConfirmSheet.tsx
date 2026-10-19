import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useValueChange } from '@/components/domain';
import { easeOutQuint, useShake } from '@/components/motion';
import { Icon, PillButton, Text } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { fonts, makeStyles, radii, spacing, useColors } from '@/theme';
import { ModalSheet } from './ModalSheet';

const errorEnter = FadeIn.duration(180).easing(easeOutQuint);

export interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  message?: string;
  /** @deprecated R3 deletes icon discs; kept so older call sites compile. */
  icon?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Danger-tinted disc and confirm button (cancel order, log out, reset). */
  destructive?: boolean;
  /** May be async: the button spins and the dialog stays open (and undismissable) until it settles. */
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  /** Inline error under the message (the dialog shakes when it appears). */
  error?: string;
  /** Fires once the dialog has fully animated out (e.g. sign out only after it's gone). */
  onClosed?: () => void;
}

/** Centered confirm dialog (works on web, where `Alert.alert` is a no-op). R3: title, one line, two pills; no icon disc. */
export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Not now',
  destructive = false,
  onConfirm,
  onCancel,
  error,
  onClosed,
}: ConfirmSheetProps) {
  const [busy, setBusy] = useState(false);
  const c = useColors();
  const styles = useStyles();
  const { style: shakeStyle, shake } = useShake();

  useValueChange(error, (next) => {
    if (next) {
      haptic.error();
      shake();
    }
  });

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } catch {
      // The caller reports failures through `error`.
    }
    setBusy(false);
  };

  return (
    <ModalSheet
      visible={visible}
      onClose={onCancel}
      onClosed={onClosed}
      placement="center"
      dismissable={!busy}
      accessibilityLabel={title}
    >
      <Animated.View style={shakeStyle}>
        <Text style={styles.title} align="center" accessibilityRole="header">
          {title}
        </Text>
        {message ? (
          <Text variant="body" color={c.inkSoft} align="center" style={styles.message}>
            {message}
          </Text>
        ) : null}
        {error ? (
          <Animated.View entering={errorEnter} style={styles.error}>
            <Icon name="alert-circle" size={16} color={c.danger} />
            <Text variant="caption" color={c.danger} style={styles.errorText}>
              {error}
            </Text>
          </Animated.View>
        ) : null}
        <View style={styles.actions}>
          <PillButton
            label={confirmLabel}
            onPress={confirm}
            loading={busy}
            fullWidth
            // A committing Confirm: `press` on press-in; the caller's outcome stays quiet (the toast says it).
            hapticKind="press"
            tone={destructive ? 'danger' : 'ink'}
          />
          <PillButton label={cancelLabel} tone="cream" onPress={onCancel} disabled={busy} fullWidth />
        </View>
      </Animated.View>
    </ModalSheet>
  );
}

const useStyles = makeStyles((c) => ({
  title: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, color: c.ink },
  message: { marginTop: spacing.xs },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: c.dangerSoft,
  },
  errorText: { flexShrink: 1, fontFamily: fonts.medium },
  actions: { gap: spacing.xs, marginTop: spacing.xl },
}));
