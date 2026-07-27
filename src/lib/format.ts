/**
 * Pads a number to two digits with a leading zero.
 */
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Formats a single localized name part (month or weekday) for a date.
 */
function localName(date: Date, locale: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, opts).format(date);
}

/**
 * Returns the short localized time-zone name (e.g. `EST`) for a date.
 */
function tzName(date: Date, locale: string): string {
  const parts = new Intl.DateTimeFormat(locale, { timeZoneName: 'short' }).formatToParts(date);
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
}

/**
 * Returns the numeric UTC offset for a date in `+HHMM` / `-HHMM` form.
 */
function tzOffset(date: Date): string {
  const minutesEast = -date.getTimezoneOffset();
  const sign = minutesEast >= 0 ? '+' : '-';
  const abs = Math.abs(minutesEast);
  return `${sign}${pad(Math.floor(abs / 60))}${pad(abs % 60)}`;
}

/**
 * Returns the 1-based day of the year for a date.
 */
function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}

/**
 * Returns a Date whose local fields equal the wall-clock time in `timeZone`, so
 * the existing local-field formatters render that zone. Falls back to the input
 * date if the zone is unknown. Time-zone name/offset tokens still reflect the
 * system zone.
 */
export function zonedDate(date: Date, timeZone: string): Date {
  if (!timeZone) {
    return date;
  }
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(date);
    const get = (t: string): number => Number(parts.find((p) => p.type === t)?.value);
    return new Date(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour'),
      get('minute'),
      get('second'),
    );
  } catch {
    return date;
  }
}

/**
 * Formats a date with a strftime pattern, as used by Home Assistant's
 * `now().strftime`. A leading `-` on a numeric token drops zero padding
 * (`%-d`). Month and weekday names localize; unknown tokens pass through.
 */
export function strftime(date: Date, pattern: string, locale: string): string {
  const h12 = ((date.getHours() + 11) % 12) + 1;
  return pattern.replace(/%(-?)([A-Za-z%])/g, (match: string, dash: string, ch: string): string => {
    /**
     * Renders a numeric field, honoring the token's zero-padding flag.
     */
    const num = (n: number): string => (dash === '-' ? String(n) : pad(n));
    switch (ch) {
      case 'Y':
        return String(date.getFullYear());
      case 'y':
        return pad(date.getFullYear() % 100);
      case 'm':
        return num(date.getMonth() + 1);
      case 'B':
        return localName(date, locale, { month: 'long' });
      case 'b':
      case 'h':
        return localName(date, locale, { month: 'short' });
      case 'd':
        return num(date.getDate());
      case 'e':
        return String(date.getDate()).padStart(2, ' ');
      case 'A':
        return localName(date, locale, { weekday: 'long' });
      case 'a':
        return localName(date, locale, { weekday: 'short' });
      case 'j':
        return String(dayOfYear(date)).padStart(3, '0');
      case 'H':
        return num(date.getHours());
      case 'I':
        return num(h12);
      case 'M':
        return num(date.getMinutes());
      case 'S':
        return num(date.getSeconds());
      case 'p':
        return date.getHours() < 12 ? 'AM' : 'PM';
      case 'P':
        return date.getHours() < 12 ? 'am' : 'pm';
      case 'z':
        return tzOffset(date);
      case 'Z':
        return tzName(date, locale);
      case '%':
        return '%';
      default:
        return match;
    }
  });
}

/** strftime letters permitted in a time (clock) pattern. */
export const TIME_TOKENS = new Set(['H', 'I', 'M', 'S', 'p', 'P', 'z', 'Z', '%']);

/** strftime letters permitted in a date pattern. */
export const DATE_TOKENS = new Set(['Y', 'y', 'm', 'B', 'b', 'h', 'd', 'e', 'A', 'a', 'j', '%']);

/**
 * Returns the first strftime token in `pattern` that is not in `allowed`, or
 * null when every token is permitted.
 */
export function invalidToken(pattern: string, allowed: Set<string>): string | null {
  const re = /%(-?)([A-Za-z%])/g;
  for (let m = re.exec(pattern); m !== null; m = re.exec(pattern)) {
    if (!allowed.has(m[2])) {
      return `%${m[1]}${m[2]}`;
    }
  }
  return null;
}

/** Named aliases expanded to strftime patterns for the expanded clock. */
const CLOCK_ALIASES: Record<string, string> = {
  iso: '%H:%M:%S',
  '24h': '%H:%M',
  '12h': '%-I:%M %p',
};

/** Named aliases expanded to strftime patterns for the expanded date. */
const DATE_ALIASES: Record<string, string> = {
  iso: '%Y-%m-%d',
};

/**
 * Formats the expanded-header clock. `locale` (or empty) uses the locale time;
 * any other value is treated as an alias or strftime pattern.
 */
export function formatClock(date: Date, format: string, locale: string): string {
  if (!format || format === 'locale') {
    return date.toLocaleTimeString(locale);
  }
  return strftime(date, CLOCK_ALIASES[format] ?? format, locale);
}

/**
 * Formats the expanded-header date. `locale` (or empty) uses the locale date;
 * any other value is treated as an alias or strftime pattern.
 */
export function formatDate(date: Date, format: string, locale: string): string {
  if (!format || format === 'locale') {
    return date.toLocaleDateString(locale);
  }
  return strftime(date, DATE_ALIASES[format] ?? format, locale);
}

/**
 * Formats the collapsed clock: `HH:MM` in 24-hour form, or `h:MM` in 12-hour
 * form with no AM/PM label.
 */
export function formatCollapsedClock(date: Date, twelveHour: boolean): string {
  if (twelveHour) {
    const h12 = ((date.getHours() + 11) % 12) + 1;
    return `${h12}:${pad(date.getMinutes())}`;
  }
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Formats the collapsed date, fixed at `M-D` with no leading zeros so it fits
 * the narrow strip.
 */
export function formatCollapsedDate(date: Date): string {
  return `${date.getMonth() + 1}-${date.getDate()}`;
}

/**
 * Derives 1-to-2-letter initials from a title, used when a collapsed entry has
 * no icon and no explicit abbreviation. The title's own casing is preserved so
 * that otherwise-identical initials keep some differentiation.
 */
export function initials(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return '';
  }
  if (words.length === 1) {
    return words[0].slice(0, 2);
  }
  return words[0][0] + words[1][0];
}
