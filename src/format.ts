const pad = (n: number): string => String(n).padStart(2, '0');

const localName = (date: Date, locale: string, opts: Intl.DateTimeFormatOptions): string =>
  new Intl.DateTimeFormat(locale, opts).format(date);

const tzName = (date: Date, locale: string): string => {
  const parts = new Intl.DateTimeFormat(locale, { timeZoneName: 'short' }).formatToParts(date);
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
};

const tzOffset = (date: Date): string => {
  const minutesEast = -date.getTimezoneOffset();
  const sign = minutesEast >= 0 ? '+' : '-';
  const abs = Math.abs(minutesEast);
  return `${sign}${pad(Math.floor(abs / 60))}${pad(abs % 60)}`;
};

const dayOfYear = (date: Date): number => {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
};

/**
 * Formats a date with a strftime pattern (as used by Home Assistant's
 * `now().strftime`). A leading `-` on a numeric token drops zero padding
 * (`%-d`). Month and weekday names localize; unknown tokens pass through.
 */
export function strftime(date: Date, pattern: string, locale: string): string {
  const h12 = ((date.getHours() + 11) % 12) + 1;
  return pattern.replace(/%(-?)([A-Za-z%])/g, (match: string, dash: string, ch: string): string => {
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

/** strftime letters allowed in a time (clock) pattern. */
export const TIME_TOKENS = new Set(['H', 'I', 'M', 'S', 'p', 'P', 'z', 'Z', '%']);

/** strftime letters allowed in a date pattern. */
export const DATE_TOKENS = new Set(['Y', 'y', 'm', 'B', 'b', 'h', 'd', 'e', 'A', 'a', 'j', '%']);

/** Returns the first token in `pattern` not in `allowed`, or null if all pass. */
export function invalidToken(pattern: string, allowed: Set<string>): string | null {
  const re = /%(-?)([A-Za-z%])/g;
  for (let m = re.exec(pattern); m !== null; m = re.exec(pattern)) {
    if (!allowed.has(m[2])) {
      return `%${m[1]}${m[2]}`;
    }
  }
  return null;
}

const CLOCK_ALIASES: Record<string, string> = {
  iso: '%H:%M:%S',
  '24h': '%H:%M',
  '12h': '%-I:%M %p',
};

const DATE_ALIASES: Record<string, string> = {
  iso: '%Y-%m-%d',
};

/** Expanded clock. `locale` uses the locale time; otherwise a strftime pattern. */
export function formatClock(date: Date, format: string, locale: string): string {
  if (!format || format === 'locale') {
    return date.toLocaleTimeString(locale);
  }
  return strftime(date, CLOCK_ALIASES[format] ?? format, locale);
}

/** Expanded date. `locale` uses the locale date; otherwise a strftime pattern. */
export function formatDate(date: Date, format: string, locale: string): string {
  if (!format || format === 'locale') {
    return date.toLocaleDateString(locale);
  }
  return strftime(date, DATE_ALIASES[format] ?? format, locale);
}

/** Collapsed clock: 24h HH:MM, or 12h h:MM with no AM/PM label. */
export function formatCollapsedClock(date: Date, twelveHour: boolean): string {
  if (twelveHour) {
    const h12 = ((date.getHours() + 11) % 12) + 1;
    return `${h12}:${pad(date.getMinutes())}`;
  }
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Collapsed date is fixed at M-D (no leading zeros) to fit the strip. */
export function formatCollapsedDate(date: Date): string {
  return `${date.getMonth() + 1}-${date.getDate()}`;
}

/** 1 to 2 letter initials used when a collapsed entry has no icon. */
export function initials(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return '';
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}
