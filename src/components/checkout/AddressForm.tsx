/**
 * The structured Indian address form (house → building → street → landmark → area → PIN | City |
 * State), the "Save as" label chips, and the rider's details (instructions, someone else receiving).
 * R3: one white sheet for the address, a second for the rider, chips on the canvas between them,
 * no boxed inputs, no icon discs. The screen owns the header and the "Save address" bar and drives
 * the form through `useAddressForm()`.
 */
import { createRef, useState, type RefObject } from 'react';
import { StyleSheet, View, type TextInput, type ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import { ToggleRow } from '@/components/account/Toggle';
import { useShake } from '@/components/motion';
import { formatPhoneInput, phoneInput } from '@/components/onboarding/authFormat';
import { Chip, PressableScale, SectionLabel, Text } from '@/components/ui';
import {
  ADDRESS_KINDS,
  addressLabel,
  defaultAddressKind,
  firstAddressError,
  firstInvalidField,
  isValidPin as isValidPinCode,
  OUT_OF_RANGE_DEMO as OUT_OF_RANGE,
  sameFields,
  validateAddressFields,
  withPin,
  type AddressFieldErrors,
  type AddressFieldKey,
  type AddressFields,
} from '@/lib/address';
import { fonts, spacing, useColors } from '@/theme';
import { CellDivider, FieldRow, FormSheet, RowSeparator, SplitRow } from './AddressFormFields';
import { LayoutBlock } from './LayoutBlock';
import { fieldsIn, fieldsOut } from './motion';

/** Every text input in the form, top to bottom (the "next" key walks this order). */
const INPUT_ORDER = [
  'otherName',
  'flatNo',
  'building',
  'street',
  'landmark',
  'area',
  'pin',
  'city',
  'state',
  'notes',
  'contactName',
  'contactPhone',
] as const;
export type AddressInputKey = (typeof INPUT_ORDER)[number];
type InputRefs = Record<AddressInputKey, RefObject<TextInput | null>>;

function createInputRefs(): InputRefs {
  const refs = {} as InputRefs;
  for (const key of INPUT_ORDER) refs[key] = createRef<TextInput>();
  return refs;
}

/** After the receiver rows have faded in (`fieldsIn`: 90ms delay + 320ms). */
const RECEIVER_FOCUS_MS = 260;

/** Fields that live in the rider sheet (a failed save shakes that sheet instead of the address). */
const RIDER_FIELDS: readonly AddressFieldKey[] = ['contactName', 'contactPhone'];

/** Errors to show before the first save attempt: only fields left with something wrong in them. */
function blurredErrors(errors: AddressFieldErrors, blurred: readonly AddressFieldKey[], fields: AddressFields): AddressFieldErrors {
  const shown: AddressFieldErrors = {};
  for (const key of blurred) {
    if (errors[key] && fields[key].trim()) shown[key] = errors[key];
  }
  return shown;
}

export interface AddressFormState {
  fields: AddressFields;
  set: (patch: Partial<AddressFields>) => void;
  /** PIN as typed: digits only, and a Bengaluru PIN fills in the city and state. */
  setPin: (typed: string) => void;
  /** Errors on screen: after a save attempt all of them, before it only fields left half-filled. */
  shown: AddressFieldErrors;
  valid: boolean;
  /** The first problem, for the hint above the disabled bar. */
  hint: string | undefined;
  /** Something changed since the form opened. */
  dirty: boolean;
  markBlurred: (key: AddressFieldKey) => void;
  refs: InputRefs;
  focus: (key: AddressInputKey) => void;
  /** The input after `key` that is on screen, focused (the keyboard's "next"). */
  focusNext: (key: AddressInputKey) => void;
  addressShake: AnimatedStyle<ViewStyle>;
  riderShake: AnimatedStyle<ViewStyle>;
  /**
   * "Save address": the fields when they're valid. Otherwise every error shows, the sheet with the
   * first one shakes and that field takes focus (the disabled bar plays the `warning` haptic).
   */
  attempt: () => AddressFields | null;
}

export function useAddressForm(initial: AddressFields): AddressFormState {
  const [start] = useState(initial);
  const [fields, setFields] = useState(initial);
  const [tried, setTried] = useState(false);
  const [blurred, setBlurred] = useState<readonly AddressFieldKey[]>([]);
  const [refs] = useState(createInputRefs);
  const { style: addressShake, shake: shakeAddress } = useShake();
  const { style: riderShake, shake: shakeRider } = useShake();

  const errors = validateAddressFields(fields);
  const firstInvalid = firstInvalidField(errors);

  const focus = (key: AddressInputKey) => refs[key].current?.focus();
  const visible = (key: AddressInputKey) =>
    key === 'otherName' ? fields.kind === 'other' : key === 'contactName' || key === 'contactPhone' ? fields.forSomeoneElse : true;

  return {
    fields,
    set: (patch) => setFields((f) => ({ ...f, ...patch })),
    setPin: (typed) => setFields((f) => withPin(f, typed)),
    shown: tried ? errors : blurredErrors(errors, blurred, fields),
    valid: firstInvalid === undefined,
    hint: firstAddressError(errors),
    dirty: !sameFields(start, fields),
    markBlurred: (key) => setBlurred((b) => (b.includes(key) ? b : [...b, key])),
    refs,
    focus,
    focusNext: (key) => {
      const next = INPUT_ORDER.slice(INPUT_ORDER.indexOf(key) + 1).find(visible);
      if (next) focus(next);
      else refs[key].current?.blur();
    },
    addressShake,
    riderShake,
    attempt: () => {
      if (firstInvalid === undefined) return fields;
      setTried(true);
      if (RIDER_FIELDS.includes(firstInvalid)) shakeRider();
      else shakeAddress();
      focus(firstInvalid);
      return null;
    },
  };
}

export interface AddressFormProps {
  form: AddressFormState;
  /** Edit mode: a quiet "Remove address" under the form. */
  onRemove?: () => void;
}

/**
 * The form body (scroll content). The address sheet holds every line of the address; "Save as"
 * sits on the canvas; the rider sheet holds instructions and, when someone else receives the order,
 * their name and +91 mobile.
 */
export function AddressForm({ form, onRemove }: AddressFormProps) {
  const c = useColors();
  const { fields: f, set, shown, refs, markBlurred, focusNext } = form;
  const other = f.kind === 'other';
  // Everything that can change a height above a block (see LayoutBlock): blocks glide on web too.
  const layoutKey = [other, f.forSomeoneElse, Object.keys(shown).join(',')].join('|');
  const pinCityError = shown.pin ?? shown.city ?? shown.state;

  return (
    <>
      <LayoutBlock layoutKey={layoutKey}>
        <Animated.View style={form.addressShake}>
          <FormSheet>
            <FieldRow
              separator
              label="House / flat / floor no."
              inputRef={refs.flatNo}
              value={f.flatNo}
              onChangeText={(flatNo) => set({ flatNo })}
              onBlur={() => markBlurred('flatNo')}
              onSubmitEditing={() => focusNext('flatNo')}
              error={shown.flatNo}
              placeholder="Flat 12A, 3rd floor"
              autoCapitalize="words"
              textContentType="streetAddressLine2"
              enterKeyHint="next"
              submitBehavior="submit"
            />
            <FieldRow
              separator
              label="Building / apartment name"
              inputRef={refs.building}
              value={f.building}
              onChangeText={(building) => set({ building })}
              onBlur={() => markBlurred('building')}
              onSubmitEditing={() => focusNext('building')}
              error={shown.building}
              placeholder="Palm Grove Apartments"
              autoCapitalize="words"
              enterKeyHint="next"
              submitBehavior="submit"
            />
            <FieldRow
              separator
              label="Street / road"
              inputRef={refs.street}
              value={f.street}
              onChangeText={(street) => set({ street })}
              onSubmitEditing={() => focusNext('street')}
              placeholder="2nd Main Rd"
              autoCapitalize="words"
              textContentType="streetAddressLine1"
              enterKeyHint="next"
              submitBehavior="submit"
            />
            <FieldRow
              separator
              optional
              label="Nearby landmark"
              inputRef={refs.landmark}
              value={f.landmark}
              onChangeText={(landmark) => set({ landmark })}
              onSubmitEditing={() => focusNext('landmark')}
              placeholder="Opp. Indiranagar Metro"
              autoCapitalize="words"
              enterKeyHint="next"
              submitBehavior="submit"
            />
            <FieldRow
              separator
              label="Area / locality"
              inputRef={refs.area}
              value={f.area}
              onChangeText={(area) => set({ area })}
              onBlur={() => markBlurred('area')}
              onSubmitEditing={() => focusNext('area')}
              error={shown.area}
              placeholder="Indiranagar"
              autoCapitalize="words"
              textContentType="sublocality"
              enterKeyHint="next"
              submitBehavior="submit"
            />
            <SplitRow error={pinCityError}>
              <FieldRow
                cell="first"
                label="PIN code"
                inputRef={refs.pin}
                value={f.pin}
                onChangeText={form.setPin}
                onBlur={() => markBlurred('pin')}
                onSubmitEditing={() => focusNext('pin')}
                error={shown.pin}
                showError={false}
                placeholder="560038"
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={6}
                autoComplete="postal-code"
                textContentType="postalCode"
                enterKeyHint="next"
                submitBehavior="submit"
                style={styles.pinCell}
              />
              <CellDivider />
              <FieldRow
                cell="middle"
                label="City"
                inputRef={refs.city}
                value={f.city}
                onChangeText={(city) => set({ city })}
                onBlur={() => markBlurred('city')}
                onSubmitEditing={() => focusNext('city')}
                error={shown.city}
                showError={false}
                placeholder="City"
                autoCapitalize="words"
                textContentType="addressCity"
                enterKeyHint="next"
                submitBehavior="submit"
                style={styles.placeCell}
              />
              <CellDivider />
              <FieldRow
                cell="last"
                label="State"
                inputRef={refs.state}
                value={f.state}
                onChangeText={(state) => set({ state })}
                onBlur={() => markBlurred('state')}
                onSubmitEditing={() => focusNext('state')}
                error={shown.state}
                showError={false}
                placeholder="State"
                autoCapitalize="words"
                textContentType="addressState"
                enterKeyHint="next"
                submitBehavior="submit"
                style={styles.placeCell}
              />
            </SplitRow>
          </FormSheet>
        </Animated.View>
      </LayoutBlock>

      <LayoutBlock layoutKey={layoutKey}>
        <SectionLabel>Save as</SectionLabel>
        <View style={styles.kinds} accessibilityRole="radiogroup" accessibilityLabel="Save as">
          {ADDRESS_KINDS.map((k) => (
            <Chip key={k.kind} tone="filled" label={k.label} selected={f.kind === k.kind} onPress={() => set({ kind: k.kind })} />
          ))}
        </View>
      </LayoutBlock>

      {other ? (
        <LayoutBlock layoutKey={layoutKey} entering={fieldsIn} exiting={fieldsOut}>
          <FormSheet style={styles.otherName}>
            <FieldRow
              label="Name this place"
              inputRef={refs.otherName}
              value={f.otherName}
              onChangeText={(otherName) => set({ otherName })}
              placeholder="Parents’ place"
              autoCapitalize="sentences"
              maxLength={24}
              enterKeyHint="done"
            />
          </FormSheet>
        </LayoutBlock>
      ) : null}

      <LayoutBlock layoutKey={layoutKey}>
        <SectionLabel>For the rider</SectionLabel>
        <Animated.View style={form.riderShake}>
          <FormSheet>
            <FieldRow
              optional
              separator
              label="Delivery instructions"
              inputRef={refs.notes}
              value={f.notes}
              onChangeText={(notes) => set({ notes })}
              onSubmitEditing={() => focusNext('notes')}
              placeholder="Ring the bell, leave with security"
              autoCapitalize="sentences"
              maxLength={120}
              enterKeyHint={f.forSomeoneElse ? 'next' : 'done'}
              submitBehavior={f.forSomeoneElse ? 'submit' : 'blurAndSubmit'}
            />
            <View>
              <ToggleRow
                title="Ordering for someone else"
                value={f.forSomeoneElse}
                onValueChange={(forSomeoneElse) => {
                  set({ forSomeoneElse });
                  // Their rows appear under the fold: start on the name (focus scrolls it into view).
                  if (forSomeoneElse) setTimeout(() => form.focus('contactName'), RECEIVER_FOCUS_MS);
                }}
              />
              {f.forSomeoneElse ? <RowSeparator /> : null}
            </View>
            {f.forSomeoneElse ? (
              <Animated.View entering={fieldsIn} exiting={fieldsOut}>
                <FieldRow
                  separator
                  label="Receiver’s name"
                  inputRef={refs.contactName}
                  value={f.contactName}
                  onChangeText={(contactName) => set({ contactName })}
                  onBlur={() => markBlurred('contactName')}
                  onSubmitEditing={() => focusNext('contactName')}
                  error={shown.contactName}
                  placeholder="Their name"
                  autoCapitalize="words"
                  autoComplete="off"
                  enterKeyHint="next"
                  submitBehavior="submit"
                />
                <FieldRow
                  label="Receiver’s mobile"
                  prefix="+91"
                  inputRef={refs.contactPhone}
                  value={formatPhoneInput(f.contactPhone)}
                  onChangeText={(typed) => set({ contactPhone: phoneInput(typed) })}
                  onBlur={() => markBlurred('contactPhone')}
                  error={shown.contactPhone}
                  placeholder="98765 43210"
                  keyboardType="phone-pad"
                  inputMode="tel"
                  autoComplete="off"
                  enterKeyHint="done"
                />
              </Animated.View>
            ) : null}
          </FormSheet>
        </Animated.View>
      </LayoutBlock>

      {onRemove ? (
        <LayoutBlock layoutKey={layoutKey}>
          <PressableScale onPress={onRemove} activeScale={0.96} accessibilityLabel="Remove address" style={styles.remove}>
            <Text style={styles.removeText} color={c.danger}>
              Remove address
            </Text>
          </PressableScale>
        </LayoutBlock>
      ) : null}
    </>
  );
}

// ── Older call sites ─────────────────────────────────────────────────────────

/** @deprecated Use `isValidPin` from `@/lib/address`. */
export const isValidPin = isValidPinCode;
/** @deprecated Use `OUT_OF_RANGE_DEMO` from `@/lib/address`. */
export const OUT_OF_RANGE_DEMO = OUT_OF_RANGE;

/** @deprecated First of Home / Work not used yet, else Other. Use `defaultAddressKind` from `@/lib/address`. */
export function defaultAddressLabel(existing: string[]): string {
  return addressLabel(defaultAddressKind(existing.map((label) => ({ label }))), '');
}

const styles = StyleSheet.create({
  pinCell: { flex: 0.9 },
  placeCell: { flex: 1.15 },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  otherName: { marginTop: spacing.sm },
  remove: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, marginTop: spacing.lg },
  removeText: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
});
