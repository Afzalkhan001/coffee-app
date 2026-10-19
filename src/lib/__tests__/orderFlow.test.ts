import { canCancel, isActiveStatus, isOrderOutcome, nextStatus, STATUS_FLOW, statusLabel, statusProgress } from '@/lib/orderFlow';
import type { OrderMode } from '@/types/models';

const modes: OrderMode[] = ['dine_in', 'pickup', 'in_car', 'delivery'];

describe('status flows', () => {
  it('only delivery uses out_for_delivery', () => {
    for (const m of modes) {
      expect(STATUS_FLOW[m].includes('out_for_delivery')).toBe(m === 'delivery');
      expect(STATUS_FLOW[m].includes('ready')).toBe(m !== 'delivery');
    }
  });

  it('walks each flow to completion', () => {
    for (const m of modes) {
      let s = STATUS_FLOW[m][0];
      const seen = [s];
      for (let n = nextStatus(m, s); n; n = nextStatus(m, s)) {
        s = n;
        seen.push(s);
      }
      expect(seen).toEqual(STATUS_FLOW[m]);
      expect(s).toBe('completed');
    }
  });

  it('terminal states have no next', () => {
    expect(nextStatus('pickup', 'completed')).toBeNull();
    expect(nextStatus('pickup', 'cancelled')).toBeNull();
  });

  it('progress goes 0 → 1', () => {
    expect(statusProgress('delivery', 'placed')).toBe(0);
    expect(statusProgress('delivery', 'out_for_delivery')).toBe(0.75);
    expect(statusProgress('delivery', 'completed')).toBe(1);
    expect(statusProgress('pickup', 'cancelled')).toBe(0);
  });

  it('cancel rules and activity', () => {
    expect(canCancel('placed')).toBe(true);
    expect(canCancel('accepted')).toBe(true);
    expect(canCancel('preparing')).toBe(false);
    expect(isActiveStatus('ready')).toBe(true);
    expect(isActiveStatus('completed')).toBe(false);
  });

  it('labels adapt to the mode', () => {
    expect(statusLabel('ready', 'pickup')).toBe('Ready for pickup');
    expect(statusLabel('completed', 'delivery')).toBe('Delivered');
  });

  it('only ready (or delivered, for delivery) is a success-haptic outcome', () => {
    const outcomes = (m: OrderMode) => STATUS_FLOW[m].filter((s) => isOrderOutcome(s, m));
    expect(outcomes('pickup')).toEqual(['ready']);
    expect(outcomes('dine_in')).toEqual(['ready']);
    expect(outcomes('in_car')).toEqual(['ready']);
    expect(outcomes('delivery')).toEqual(['completed']);
    expect(isOrderOutcome('cancelled', 'pickup')).toBe(false);
    expect(isOrderOutcome('completed', 'pickup')).toBe(false);
    expect(isOrderOutcome('out_for_delivery', 'delivery')).toBe(false);
  });
});
