/**
 * Copy for "where / how am I ordering" (Home location row, Menu mode strip).
 * Pure helpers + one hook over the session store.
 */
import { useShallow } from 'zustand/react/shallow';
import { MODE_META } from '@/lib/orderFlow';
import { useSession } from '@/store/session';
import { brand } from '@/theme/brand';
import type { Address, CarDetails, OrderMode } from '@/types/models';

export interface ModeContext {
  mode: OrderMode;
  /** Small line above the place: "Pickup from", "Deliver to"… */
  eyebrow: string;
  /** The place: store short name, table or address label. */
  place: string;
  /** One-line sentence: "Pickup from Indiranagar". */
  sentence: string;
  /** Ionicons glyph for the mode. */
  icon: string;
  /** True when the mode still needs details (table, car, address) before checkout. */
  incomplete: boolean;
  /** Short nudge for the missing detail ("Add table"), when there is one. */
  hint?: string;
}

interface ModeInputs {
  mode: OrderMode;
  table?: string;
  car?: CarDetails;
  address?: Address;
}

/** True when choosing `mode` should open the /mode sheet to collect its details. */
export function modeNeedsDetails({ mode, table, car, address }: ModeInputs): boolean {
  switch (mode) {
    case 'dine_in':
      return !table;
    case 'in_car':
      return !car;
    case 'delivery':
      return !address;
    case 'pickup':
      return false;
  }
}

export function describeMode(inputs: ModeInputs): ModeContext {
  const store = brand.store.shortName;
  const { mode, table, address } = inputs;
  const icon = MODE_META[mode].icon;
  const incomplete = modeNeedsDetails(inputs);
  switch (mode) {
    case 'pickup':
      return { mode, icon, incomplete, eyebrow: 'Pickup from', place: store, sentence: `Pickup from ${store}` };
    case 'dine_in': {
      const place = table ? `${store} · ${table}` : store;
      const hint = table ? undefined : 'Add table';
      return { mode, icon, incomplete, hint, eyebrow: 'Dine-in at', place, sentence: `Dine-in at ${place}` };
    }
    case 'in_car': {
      const hint = inputs.car ? undefined : 'Add car';
      return { mode, icon, incomplete, hint, eyebrow: 'Curbside at', place: store, sentence: `Curbside pickup at ${store}` };
    }
    case 'delivery': {
      const place = address ? address.label : 'Choose an address';
      return {
        mode,
        icon,
        incomplete,
        eyebrow: 'Deliver to',
        place,
        sentence: address ? `Delivery to ${address.label}` : 'Delivery · choose an address',
      };
    }
  }
}

/** Live ordering context from the session (re-renders only when the relevant fields change). */
export function useModeContext(): ModeContext {
  const inputs = useSession(
    useShallow((s) => ({
      mode: s.mode,
      table: s.table,
      car: s.car,
      address: s.addresses.find((a) => a.id === s.selectedAddressId),
    })),
  );
  return describeMode(inputs);
}
