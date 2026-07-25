import type { DateFormat, TimeFormat } from './types';

const pad = (n: number): string => String(n).padStart(2, '0');

/** Expanded clock: iso is HH:MM:SS, otherwise the locale time. */
export function formatClock(date: Date, format: TimeFormat, locale: string): string {
  if (format === 'iso') {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }
  return date.toLocaleTimeString(locale);
}

/** Expanded date: iso is YYYY-MM-DD, otherwise the locale date. */
export function formatDate(date: Date, format: DateFormat, locale: string): string {
  if (format === 'iso') {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
  return date.toLocaleDateString(locale);
}

/** Collapsed clock is fixed at HH:MM to fit the strip. */
export function formatCollapsedClock(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Collapsed date is fixed at MM-DD to fit the strip. */
export function formatCollapsedDate(date: Date): string {
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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
