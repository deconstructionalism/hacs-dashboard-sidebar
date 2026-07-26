import { describe, expect, it } from 'vitest';

import {
  DATE_TOKENS,
  TIME_TOKENS,
  formatClock,
  formatCollapsedClock,
  formatCollapsedDate,
  formatDate,
  initials,
  invalidToken,
  strftime,
} from './format';

// A fixed reference moment, built from local components so assertions are
// independent of the machine time zone: Saturday, 25 July 2026, 19:07:05.
const REF = new Date(2026, 6, 25, 19, 7, 5);

describe('strftime', () => {
  it('formats an ISO-like date and time', () => {
    expect(strftime(REF, '%Y-%m-%d', 'en-US')).toBe('2026-07-25');
    expect(strftime(REF, '%H:%M:%S', 'en-US')).toBe('19:07:05');
  });

  it('honors the no-pad flag and 12-hour tokens', () => {
    expect(strftime(REF, '%-I:%M %p', 'en-US')).toBe('7:07 PM');
    expect(strftime(REF, '%I', 'en-US')).toBe('07');
    expect(strftime(REF, '%P', 'en-US')).toBe('pm');
  });

  it('localizes month and weekday names', () => {
    expect(strftime(REF, '%A, %B %-d', 'en-US')).toBe('Saturday, July 25');
    expect(strftime(REF, '%a %b', 'en-US')).toBe('Sat Jul');
  });

  it('pads and space-pads the day of month', () => {
    const early = new Date(2026, 6, 5, 0, 0, 0);
    expect(strftime(early, '%d', 'en-US')).toBe('05');
    expect(strftime(early, '%-d', 'en-US')).toBe('5');
    expect(strftime(early, '%e', 'en-US')).toBe(' 5');
  });

  it('computes the day of year and escapes percent', () => {
    expect(strftime(REF, '%j', 'en-US')).toBe('206');
    expect(strftime(REF, '100%%', 'en-US')).toBe('100%');
  });

  it('passes unknown tokens through and shapes the tz offset', () => {
    expect(strftime(REF, '%Q', 'en-US')).toBe('%Q');
    expect(strftime(REF, '%z', 'en-US')).toMatch(/^[+-]\d{4}$/);
  });
});

describe('formatClock', () => {
  it('expands aliases', () => {
    expect(formatClock(REF, 'iso', 'en-US')).toBe('19:07:05');
    expect(formatClock(REF, '24h', 'en-US')).toBe('19:07');
    expect(formatClock(REF, '12h', 'en-US')).toBe('7:07 PM');
  });

  it('accepts a raw strftime pattern and falls back to locale', () => {
    expect(formatClock(REF, '%H:%M', 'en-US')).toBe('19:07');
    expect(formatClock(REF, 'locale', 'en-US')).toBe(REF.toLocaleTimeString('en-US'));
    expect(formatClock(REF, '', 'en-US')).toBe(REF.toLocaleTimeString('en-US'));
  });
});

describe('formatDate', () => {
  it('expands the iso alias and raw patterns', () => {
    expect(formatDate(REF, 'iso', 'en-US')).toBe('2026-07-25');
    expect(formatDate(REF, '%A', 'en-US')).toBe('Saturday');
  });

  it('falls back to the locale date', () => {
    expect(formatDate(REF, 'locale', 'en-US')).toBe(REF.toLocaleDateString('en-US'));
  });
});

describe('formatCollapsedClock', () => {
  it('renders 24-hour and 12-hour without a meridiem label', () => {
    expect(formatCollapsedClock(REF, false)).toBe('19:07');
    expect(formatCollapsedClock(REF, true)).toBe('7:07');
  });

  it('handles midnight and single-digit hours', () => {
    const midnight = new Date(2026, 6, 25, 0, 15, 0);
    expect(formatCollapsedClock(midnight, false)).toBe('00:15');
    expect(formatCollapsedClock(midnight, true)).toBe('12:15');
  });
});

describe('formatCollapsedDate', () => {
  it('drops leading zeros from month and day', () => {
    expect(formatCollapsedDate(new Date(2026, 6, 5))).toBe('7-5');
    expect(formatCollapsedDate(new Date(2026, 0, 1))).toBe('1-1');
  });
});

describe('initials', () => {
  it('derives one or two letters, preserving the title casing', () => {
    expect(initials('Home')).toBe('Ho');
    expect(initials('Living Room')).toBe('LR');
    expect(initials('EV Charger Station')).toBe('EC');
    expect(initials('iPhone Hub')).toBe('iH');
    expect(initials('  spaced  out ')).toBe('so');
    expect(initials('')).toBe('');
  });
});

describe('invalidToken', () => {
  it('accepts patterns whose tokens are all allowed', () => {
    expect(invalidToken('%H:%M', TIME_TOKENS)).toBeNull();
    expect(invalidToken('%A, %B %-d', DATE_TOKENS)).toBeNull();
  });

  it('returns the first offending token, preserving the no-pad flag', () => {
    expect(invalidToken('%Y', TIME_TOKENS)).toBe('%Y');
    expect(invalidToken('%H', DATE_TOKENS)).toBe('%H');
    expect(invalidToken('%-H', DATE_TOKENS)).toBe('%-H');
  });
});
