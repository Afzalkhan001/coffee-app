/**
 * Delivery address (DESIGN.md §R3.B "Delivery address"): "Use current location" as a one-row sheet,
 * then "Saved" — ONE white sheet of address rows (radio, label, line 1, "Domlur, Bengaluru 560071 ·
 * 1.2 km"; "Out of range" dims the row; a pencil edits it) ending in "+ Add new address". Picking an
 * address runs the deliverability check; out of range opens the "No delivery to this address yet"
 * panel under that row, offering Pickup instead.
 *
 * Adding or editing opens the structured Indian address form in place: it slides in over the list
 * (in-screen, so it plays on web too) with its own "Save address" bar, and back / Android back
 * return to the list (asking first when something was typed). "Use current location" opens the form
 * pre-filled with the area, PIN, city and state of the nearest known neighbourhood (simulated: no
 * reverse geocoding). Edit has "Remove address", confirmed in a dialog; removing the selected
 * address selects the next one we deliver to.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, View } from 'react-native';
import Animated, {
  FadeInRight,
  FadeOutRight,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { checkDelivery, isNetworkError } from '@/api';
import { ConfirmSheet } from '@/components/account/ConfirmSheet';
import { HeaderScrollEdge, useHeaderScroll } from '@/components/account/HeaderScrollEdge';
import { ADDRESS_TEXT_INSET, AddressRow } from '@/components/checkout/AddressCard';
import { addressFromFields, locateFix, type LocatedFix } from '@/components/checkout/addressFactory';
import { AddressForm, useAddressForm, type AddressInputKey } from '@/components/checkout/AddressForm';
import { BAR_HINT_SPACE, BottomBar, useBottomBarSpace } from '@/components/checkout/BottomBar';
import { InfoNote } from '@/components/checkout/ContextFields';
import { useMounted } from '@/components/checkout/hooks';
import { LayoutBlock } from '@/components/checkout/LayoutBlock';
import { deliveryFeeNote } from '@/components/checkout/modeText';
import { fieldsIn, fieldsOut } from '@/components/checkout/motion';
import { NoDeliveryCard } from '@/components/checkout/NoDeliveryCard';
import { SheetBlock } from '@/components/checkout/SheetRows';
import { easeOutQuint, enterUp, useToast } from '@/components/motion';
import { Icon, KeyboardAvoider, PrimaryBar, PressableScale, Screen, ScreenHeader, SectionLabel, Text } from '@/components/ui';
import { SEED_ADDRESSES } from '@/data/mock/marketing';
import {
  defaultAddressKind,
  emptyAddressFields,
  fieldsFromAddress,
  formatAddress,
  selectionAfterRemove,
  upgradeLegacySeeds,
  type AddressFields,
} from '@/lib/address';
import { uid } from '@/lib/format';
import { isDeliverable } from '@/lib/geo';
import { haptic } from '@/lib/haptics';
import { getCurrentPosition, requestLocationPermission } from '@/lib/location';
import { cartSubtotal } from '@/lib/pricing';
import { useCart } from '@/store/cart';
import { useSession } from '@/store/session';
import { brand } from '@/theme/brand';
import { fonts, makeStyles, radii, spacing, useColors } from '@/theme';
import type { Address } from '@/types/models';

type Note = { text: string; tone: 'default' | 'warn' };
type Editor =
  | { mode: 'new'; key: string; initial: AddressFields; located?: LocatedFix; note?: Note }
  | { mode: 'edit'; key: string; initial: AddressFields; address: Address };

/** The form slides in over the list (in-screen: web has no stack transitions). */
const SLIDE_MS = 320;
const editorIn = FadeInRight.duration(SLIDE_MS).easing(easeOutQuint);
const editorOut = FadeOutRight.duration(220).easing(easeOutQuint);
/** How far the list drifts left while the form covers it. */
const LIST_DRIFT = 28;

/** The line above a form that "Use current location" pre-filled. */
function locatedNote(fix: LocatedFix): string {
  if (fix.snapped) return 'Demo location near the café. Add your flat and building.';
  if (fix.fill.area) return `Location found near ${fix.fill.area}. Add your flat and building.`;
  return 'Location found. Add the area and your flat.';
}

export default function AddressScreen() {
  const c = useColors();
  const styles = useStyles();
  const params = useLocalSearchParams<{ next?: string }>();
  const continueToCheckout = params.next === 'checkout';
  const addresses = useSession((s) => s.addresses);
  const selectedId = useSession((s) => s.selectedAddressId);
  const addAddress = useSession((s) => s.addAddress);
  const updateAddress = useSession((s) => s.updateAddress);
  const removeAddress = useSession((s) => s.removeAddress);
  const selectAddress = useSession((s) => s.selectAddress);
  const setMode = useSession((s) => s.setMode);
  const setLocationPermission = useSession((s) => s.setLocationPermission);
  const subtotal = useCart((s) => cartSubtotal(s.items));
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const mounted = useMounted();
  const reduced = useReducedMotion();
  const barSpace = useBottomBarSpace(true);
  const { scrollY, onScroll } = useHeaderScroll();

  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ id: string; message: string } | null>(null);
  const [outOfRange, setOutOfRange] = useState<{ address: Address; km: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);

  const selected = addresses.find((a) => a.id === selectedId);
  const deliverableSelectedId = selected && isDeliverable(selected) ? selected.id : undefined;
  const busy = checkingId !== null || locating;
  const showHint = !deliverableSelectedId;
  const editing = editor !== null;
  // Everything that can change a height above a block (see LayoutBlock): blocks glide on web too.
  const layoutKey = [outOfRange?.address.id, failed?.id, checkingId, addresses.map((a) => `${a.id}:${a.line1}:${a.label}`).join(',')].join('|');

  // A device that ran an earlier v2 build still has the unstructured demo seeds: swap in today's.
  useEffect(() => {
    const upgraded = upgradeLegacySeeds(addresses, SEED_ADDRESSES);
    if (upgraded !== addresses) useSession.setState({ addresses: upgraded });
  }, [addresses]);

  // Arrive with a usable default: no deliverable address chosen yet → the first saved one we deliver
  // to is preselected, so "Deliver here" starts live instead of as a disabled bar with a hint.
  useEffect(() => {
    if (deliverableSelectedId) return;
    const fallback = addresses.find(isDeliverable);
    if (fallback) selectAddress(fallback.id);
  }, [deliverableSelectedId, addresses, selectAddress]);

  // The list drifts left and fades while the form covers it (UI thread).
  const cover = useSharedValue(0);
  useEffect(() => {
    cover.set(reduced ? (editing ? 1 : 0) : withTiming(editing ? 1 : 0, { duration: SLIDE_MS, easing: easeOutQuint, reduceMotion: ReduceMotion.Never }));
  }, [editing, reduced, cover]);
  const listStyle = useAnimatedStyle(() => ({
    opacity: 1 - cover.get(),
    transform: [{ translateX: -LIST_DRIFT * cover.get() }],
  }));

  const leave = () => {
    if (continueToCheckout) router.replace('/checkout');
    else if (router.canGoBack()) router.back();
    else router.replace('/cart');
  };

  /** Runs the deliverability check; out-of-range keeps (or restores) the last good selection. */
  const check = async (address: Address, fallbackId: string | undefined) => {
    setCheckingId(address.id);
    setFailed(null);
    setOutOfRange(null);
    try {
      const res = await checkDelivery(address);
      if (res.deliverable) {
        selectAddress(address.id);
        // The radio moves now (after the check), so the choice clicks now; re-picking the same one is silent.
        if (address.id !== fallbackId) haptic.select();
      } else {
        selectAddress(fallbackId);
        setOutOfRange({ address, km: res.distanceKm });
        haptic.warning();
      }
    } catch (e) {
      selectAddress(fallbackId);
      setFailed({
        id: address.id,
        message: isNetworkError(e) ? 'You’re offline, so we couldn’t check this one. Tap to retry.' : 'We couldn’t check this address. Tap to retry.',
      });
      haptic.error();
    }
    // (No `finally`: React Compiler can't lower try/finally and would skip this component.)
    setCheckingId(null);
  };

  const openNew = (opts: { located?: LocatedFix; note?: Note } = {}) => {
    const blank = emptyAddressFields(defaultAddressKind(addresses));
    const initial = opts.located ? { ...blank, ...opts.located.fill } : blank;
    setOutOfRange(null);
    setEditor({ mode: 'new', key: uid('form'), initial, located: opts.located, note: opts.note });
  };

  const openEdit = (address: Address) => {
    if (busy) return;
    setOutOfRange(null);
    setEditor({ mode: 'edit', key: uid('form'), initial: fieldsFromAddress(address), address });
  };

  const save = async (fields: AddressFields) => {
    if (!editor) return;
    if (editor.mode === 'new') {
      const address = addressFromFields(fields, { located: editor.located });
      const fallback = deliverableSelectedId;
      setEditor(null);
      addAddress(address); // also selects it; `check` restores the fallback if it's out of range
      await check(address, fallback);
      return;
    }
    const next = addressFromFields(fields, { previous: editor.address });
    updateAddress(next);
    setEditor(null);
    // The chosen address moved out of range: say so and fall back to another one we deliver to.
    if (next.id === deliverableSelectedId && !isDeliverable(next)) {
      await check(next, addresses.find((a) => a.id !== next.id && isDeliverable(a))?.id);
    }
  };

  const remove = (address: Address) => {
    const nextSelected = selectionAfterRemove(addresses, address.id, deliverableSelectedId, isDeliverable);
    removeAddress(address.id);
    selectAddress(nextSelected);
    setOutOfRange(null);
    setFailed(null);
    setEditor(null);
    toast(`${address.label} removed`);
  };

  const locateMe = async () => {
    if (busy) return;
    setLocating(true);
    setOutOfRange(null);
    // Both helpers time out on their own (web prompts can hang; GPS fixes give up after 12s).
    const permission = await requestLocationPermission();
    setLocationPermission(permission);
    if (permission !== 'granted') {
      // Silent: the system prompt (or the note in the form) is the feedback.
      setLocating(false);
      openNew({ note: { tone: 'warn', text: 'Location is off for Ember Roast. Type your address below.' } });
      return;
    }
    const position = await getCurrentPosition();
    setLocating(false);
    if (!position) {
      openNew({ note: { tone: 'warn', text: 'We couldn’t get a GPS fix. Type your address below.' } });
      return;
    }
    const fix = locateFix(position);
    openNew({ located: fix, note: { tone: 'default', text: locatedNote(fix) } });
  };

  const switchToPickup = () => {
    setMode('pickup');
    haptic.select();
    leave();
  };

  const deliverHere = () => {
    if (!deliverableSelectedId) return;
    setMode('delivery');
    leave();
  };

  /** What removing `address` does to the selection, for the confirm dialog. */
  const removeMessage = (address: Address): string => {
    if (address.id !== deliverableSelectedId) return formatAddress(address, 'short');
    const next = addresses.find((a) => a.id === selectionAfterRemove(addresses, address.id, deliverableSelectedId, isDeliverable));
    return next ? `It’s your delivery address. We’ll switch to ${next.label}.` : 'It’s your delivery address. You’ll choose another next.';
  };

  return (
    // Both layers start at the window top and pad the safe area themselves: the form's
    // KeyboardAvoider (Android) measures itself against its parent, which must sit at the top.
    <Screen edges={[]}>
      <View style={styles.stage}>
        <Animated.View style={[StyleSheet.absoluteFill, listStyle]}>
          <View
            style={[styles.fill, { paddingTop: insets.top, pointerEvents: editing ? 'none' : 'auto' }]}
            aria-hidden={editing}
            accessibilityElementsHidden={editing}
            importantForAccessibility={editing ? 'no-hide-descendants' : 'auto'}
          >
            <ScreenHeader title="Delivery address" subtitle={`We deliver within ${brand.store.deliveryRadiusKm} km of ${brand.store.shortName}.`} />
            <View style={styles.fill}>
              <Animated.ScrollView
                onScroll={onScroll}
                // The hint pill above a disabled bar needs its own room (useBottomBarSpace(true)) so the last
                // row can scroll clear of it (D-34); the bar's solid floor keeps them from colliding.
                contentContainerStyle={[styles.content, { paddingBottom: showHint ? barSpace : barSpace - BAR_HINT_SPACE }]}
                showsVerticalScrollIndicator={false}
              >
                <LayoutBlock layoutKey={layoutKey} entering={enterUp(mounted ? 0 : 1)}>
                  <LocateRow locating={locating} onPress={locateMe} />
                </LayoutBlock>

                <LayoutBlock layoutKey={layoutKey} entering={enterUp(mounted ? 0 : 2)}>
                  <SectionLabel>Saved</SectionLabel>
                </LayoutBlock>

                {addresses.map((a, i) => (
                  <Fragment key={a.id}>
                    <SheetBlock first={i === 0} dividerInset={ADDRESS_TEXT_INSET} layoutKey={layoutKey} entering={enterUp(mounted ? 0 : i + 3)}>
                      <AddressRow
                        address={a}
                        selected={a.id === deliverableSelectedId}
                        checking={checkingId === a.id}
                        error={failed?.id === a.id ? failed.message : undefined}
                        onPress={() => {
                          if (!busy) void check(a, deliverableSelectedId);
                        }}
                        onEdit={() => openEdit(a)}
                      />
                      {outOfRange?.address.id === a.id ? (
                        <NoDeliveryCard
                          address={outOfRange.address}
                          distanceKm={outOfRange.km}
                          onSwitchToPickup={switchToPickup}
                          onDismiss={() => setOutOfRange(null)}
                        />
                      ) : null}
                    </SheetBlock>
                  </Fragment>
                ))}

                <SheetBlock
                  first={addresses.length === 0}
                  last
                  dividerInset={ADDRESS_TEXT_INSET}
                  layoutKey={layoutKey}
                  entering={enterUp(mounted ? 0 : addresses.length + 3)}
                >
                  <PressableScale onPress={() => openNew()} activeScale={0.985} accessibilityLabel="Add new address" style={styles.addRow}>
                    <View style={styles.addGlyph}>
                      <Icon name="add" size={20} color={c.ink} />
                    </View>
                    <Text style={styles.addText}>Add new address</Text>
                  </PressableScale>
                </SheetBlock>

                <LayoutBlock layoutKey={layoutKey} entering={enterUp(mounted ? 0 : addresses.length + 4)}>
                  <InfoNote text={deliveryFeeNote(subtotal)} style={styles.feeNote} />
                </LayoutBlock>
              </Animated.ScrollView>
              <HeaderScrollEdge scrollY={scrollY} />
            </View>

            <BottomBar hidden={outOfRange !== null || editing}>
              <PrimaryBar
                label="Deliver here"
                onPress={deliverHere}
                disabled={!deliverableSelectedId}
                hint={showHint ? 'Choose an address we deliver to' : undefined}
                accessibilityLabel={selected && deliverableSelectedId ? `Deliver here: ${selected.label}` : 'Deliver here'}
              />
            </BottomBar>
          </View>
        </Animated.View>

        {editor ? (
          <Animated.View
            key={editor.key}
            entering={editorIn}
            exiting={editorOut}
            style={[StyleSheet.absoluteFill, styles.editor, { paddingTop: insets.top }]}
          >
            <AddressEditor
              editor={editor}
              onSave={(fields) => void save(fields)}
              onClose={() => setEditor(null)}
              onRemove={remove}
              removeMessage={removeMessage}
            />
          </Animated.View>
        ) : null}
      </View>
    </Screen>
  );
}

/**
 * The form view: header ("New address" / "Edit address"), the form in a keyboard-safe scroll view,
 * and the "Save address" bar. Back (header or Android) closes it, after a "Discard" confirm when
 * something changed; "Remove address" (edit) asks first.
 */
function AddressEditor({
  editor,
  onSave,
  onClose,
  onRemove,
  removeMessage,
}: {
  editor: Editor;
  onSave: (fields: AddressFields) => void;
  onClose: () => void;
  onRemove: (address: Address) => void;
  removeMessage: (address: Address) => string;
}) {
  const styles = useStyles();
  const form = useAddressForm(editor.initial);
  const { scrollY, onScroll } = useHeaderScroll();
  const [confirm, setConfirm] = useState<'discard' | 'remove' | null>(null);
  /** Set when the remove dialog was confirmed: the address goes once the dialog has animated out. */
  const [removing, setRemoving] = useState(false);
  const showHint = !form.valid;
  const barSpace = useBottomBarSpace(showHint);
  const editAddress = editor.mode === 'edit' ? editor.address : undefined;
  const note = editor.mode === 'new' ? editor.note : undefined;

  const requestClose = () => {
    if (form.dirty) setConfirm('discard');
    else onClose();
  };

  // Android back steps out of the form, not the screen.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      requestClose();
      return true;
    });
    return () => sub.remove();
  });

  // A new address starts typing at its first line, once the form has slid in (edits don't jump to the keyboard).
  const [firstFocus] = useState<AddressInputKey | null>(() => (editor.mode === 'new' ? 'flatNo' : null));
  const { refs } = form;
  useEffect(() => {
    if (!firstFocus) return;
    const t = setTimeout(() => refs[firstFocus].current?.focus(), SLIDE_MS + 40);
    return () => clearTimeout(t);
  }, [firstFocus, refs]);

  const save = () => {
    const fields = form.attempt();
    if (fields) onSave(fields);
  };

  return (
    <>
      <ScreenHeader title={editAddress ? 'Edit address' : 'New address'} onBack={requestClose} />
      {/* Android edge-to-edge: shrink above the keyboard so the lower fields stay reachable. */}
      <KeyboardAvoider>
        <Animated.ScrollView
          onScroll={onScroll}
          contentContainerStyle={[styles.content, { paddingBottom: barSpace }]}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          {note ? (
            <Animated.View entering={fieldsIn} exiting={fieldsOut}>
              <InfoNote tone={note.tone} text={note.text} style={styles.formNote} />
            </Animated.View>
          ) : null}
          <AddressForm form={form} onRemove={editAddress ? () => setConfirm('remove') : undefined} />
        </Animated.ScrollView>
        <HeaderScrollEdge scrollY={scrollY} />
      </KeyboardAvoider>

      <BottomBar>
        <PrimaryBar
          label="Save address"
          icon="check"
          onPress={save}
          disabled={!form.valid}
          hint={showHint ? form.hint : undefined}
          accessibilityLabel="Save address"
        />
      </BottomBar>

      <ConfirmSheet
        visible={confirm === 'discard'}
        title={editAddress ? 'Discard changes?' : 'Discard this address?'}
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => {
          setConfirm(null);
          onClose();
        }}
        onCancel={() => setConfirm(null)}
      />
      {editAddress ? (
        <ConfirmSheet
          visible={confirm === 'remove'}
          title={`Remove ${editAddress.label}?`}
          message={removeMessage(editAddress)}
          confirmLabel="Remove"
          cancelLabel="Keep it"
          destructive
          onConfirm={() => {
            setRemoving(true);
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
          onClosed={() => {
            if (removing) onRemove(editAddress);
          }}
        />
      ) : null}
    </>
  );
}

/** "Use current location" as a one-row white sheet: the navigate glyph inline (no disc), a chevron. */
function LocateRow({ locating, onPress }: { locating: boolean; onPress: () => void }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <PressableScale
      onPress={onPress}
      disabled={locating}
      activeScale={0.985}
      accessibilityLabel="Use current location"
      accessibilityState={{ busy: locating }}
      style={styles.locate}
    >
      <View style={styles.locateGlyph}>
        {locating ? <ActivityIndicator size="small" color={c.ink} /> : <Icon name="navigate" size={20} color={c.ink} />}
      </View>
      <Text style={styles.locateTitle}>{locating ? 'Finding you…' : 'Use current location'}</Text>
      <Icon name="chevron-forward" size={18} color={c.inkMuted} />
    </PressableScale>
  );
}

const useStyles = makeStyles((c) => ({
  stage: { flex: 1 },
  fill: { flex: 1 },
  editor: { backgroundColor: c.bg },
  content: { paddingHorizontal: spacing.gutter, paddingTop: spacing.sm },
  locate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    minHeight: 56,
  },
  locateGlyph: { width: 22, alignItems: 'center' },
  locateTitle: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 56 },
  // Same column as the radios above, so the label lines up with the address names.
  addGlyph: { width: 22, alignItems: 'center' },
  addText: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  feeNote: { marginTop: spacing.md, paddingHorizontal: spacing.xxs },
  formNote: { marginBottom: spacing.sm, paddingHorizontal: spacing.xxs },
}));
