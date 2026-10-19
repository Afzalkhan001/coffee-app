import { displayPhone, formatCount, formatDate, formatPhone, isValidPhone, nationalPhone, PHONE_DIAL } from '@/lib/format';
import { brand } from '@/theme/brand';

describe('Indian mobile numbers (+91)', () => {
  it('validates 10 digits starting with 6–9', () => {
    expect(PHONE_DIAL).toBe('+91');
    for (const ok of ['9876543210', '6000000000', '7012345678', '8123456789']) expect(isValidPhone(ok)).toBe(true);
    for (const bad of ['5876543210', '1234567890', '0987654321', '987654321', '98765432101', '', 'abc']) expect(isValidPhone(bad)).toBe(false);
  });

  it('accepts a +91 / 91 / 0 prefix and separators', () => {
    expect(isValidPhone('+91 98765 43210')).toBe(true);
    expect(isValidPhone('919876543210')).toBe(true);
    expect(isValidPhone('098765 43210')).toBe(true);
    expect(isValidPhone('(+91) 98765-43210')).toBe(true);
    expect(nationalPhone('+91 98765 43210')).toBe('9876543210');
    expect(nationalPhone('098765 43210')).toBe('9876543210');
    expect(nationalPhone('98765')).toBe('98765');
  });

  it('accepts the 00 international prefix and +91 followed by a trunk zero', () => {
    for (const pasted of ['0091 98765 43210', '00 91 98765 43210', '+91 098765 43210', '+91 0 98765 43210', '+91-98765-43210']) {
      expect(nationalPhone(pasted)).toBe('9876543210');
      expect(isValidPhone(pasted)).toBe(true);
      expect(displayPhone(pasted)).toBe('+91 98765 43210');
    }
    // A prefix never rescues a number that isn't an Indian mobile.
    expect(isValidPhone('+91 58765 43210')).toBe(false);
    expect(isValidPhone('0091 12345 67890')).toBe(false);
    // A real 10-digit mobile that happens to start with 91 is left alone.
    expect(nationalPhone('9123456789')).toBe('9123456789');
    expect(isValidPhone('91234 56789')).toBe(true);
  });

  it('the support line is a Bengaluru number with a working tel: link', () => {
    expect(brand.supportPhone).toBe('+91 80 4718 2290');
    // help.tsx dials `tel:` + the digits and "+".
    expect(`tel:${brand.supportPhone.replace(/[^\d+]/g, '')}`).toBe('tel:+918047182290');
  });

  it('formats pasted prefixed numbers to the national form', () => {
    expect(formatPhone('+91 98765 43210')).toBe('98765 43210');
    expect(formatPhone('098765 43210')).toBe('98765 43210');
    expect(formatPhone('0091 98765 43210')).toBe('98765 43210');
  });

  it('formats as 5 + 5 while typing', () => {
    expect(formatPhone('')).toBe('');
    expect(formatPhone('987')).toBe('987');
    expect(formatPhone('98765')).toBe('98765');
    expect(formatPhone('987654')).toBe('98765 4');
    expect(formatPhone('9876543210')).toBe('98765 43210');
    expect(formatPhone('98765432109999')).toBe('98765 43210'); // capped at 10 digits
  });

  it('displays stored numbers with the dial code', () => {
    expect(displayPhone('9876543210')).toBe('+91 98765 43210');
    expect(displayPhone('+91 98765 43210')).toBe('+91 98765 43210');
    expect(displayPhone('919876543210')).toBe('+91 98765 43210');
    expect(displayPhone(null)).toBe('');
    expect(displayPhone('')).toBe('');
  });
});

describe('formatCount', () => {
  it('groups counts the Indian way', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(610)).toBe('610');
    expect(formatCount(1000)).toBe('1,000');
    expect(formatCount(125000)).toBe('1,25,000');
    expect(formatCount(-400)).toBe('−400');
  });
});

describe('formatDate', () => {
  it('prints dates day-first, whatever the device locale', () => {
    expect(formatDate(new Date(2026, 8, 28, 20, 8).toISOString())).toBe('28 Sep 2026');
    expect(formatDate(new Date(2026, 9, 7).toISOString())).toBe('7 Oct 2026');
    expect(formatDate('not a date')).toBe('');
  });
});
