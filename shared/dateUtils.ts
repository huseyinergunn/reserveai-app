/**
 * Shared date utilities using luxon.
 * Imported by BOTH api/ (Node) and client/ (browser via Vite).
 *
 * Mirrors the exact n8n logic:
 *   Array(5).fill(0).map((_,idx) => $now.plus(idx+1,'day')).filter(d => !d.isWeekend)
 */

import { DateTime } from 'luxon';
import { TIME_SLOTS, DEFAULT_BOOKING_WINDOW_DAYS, TURKISH_HOLIDAYS } from './constants';

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

/** Returns true when the given DateTime falls on Saturday (6) or Sunday (7). */
export function isWeekend(dt: DateTime): boolean {
  return dt.weekday === 6 || dt.weekday === 7; // Luxon: Mon=1 … Sun=7
}

/** Returns true when the given DateTime falls on a Turkish public holiday (fixed-date). */
export function isHoliday(dt: DateTime): boolean {
  const mmdd = dt.toFormat('MM-dd');
  return (TURKISH_HOLIDAYS as ReadonlyArray<string>).includes(mmdd);
}

/**
 * Returns the next `count` bookable days (non-weekend, non-holiday) starting
 * from tomorrow, in the given zone.
 */
export function getAvailableWeekdays(
  count: number = DEFAULT_BOOKING_WINDOW_DAYS,
  timezone: string = 'UTC',
  from: DateTime = DateTime.now().setZone(timezone),
): DateTime[] {
  const results: DateTime[] = [];
  let offset = 1;

  while (results.length < count) {
    const candidate = from.startOf('day').plus({ days: offset });
    if (!isWeekend(candidate) && !isHoliday(candidate)) results.push(candidate);
    offset++;
  }

  return results;
}

/**
 * Returns date strings as ISO dates (YYYY-MM-DD).
 * Client displays them using Intl.DateTimeFormat; API validates against them.
 */
export function getAvailableDateOptions(
  count: number = DEFAULT_BOOKING_WINDOW_DAYS,
  timezone: string = 'UTC',
): string[] {
  return getAvailableWeekdays(count, timezone).map((d) => d.toFormat('yyyy-MM-dd'));
}

// ---------------------------------------------------------------------------
// Parsing & formatting
// ---------------------------------------------------------------------------

/**
 * Converts an ISO date (YYYY-MM-DD) + time slot ("9:00 am")
 * into a full ISO 8601 string with timezone offset.
 *
 * @throws {Error} if the resulting DateTime is invalid.
 */
export function parseDateTimeFromForm(
  dateStr: string,  // YYYY-MM-DD
  timeSlot: string, // e.g. "16:00"
  timezone: string = 'Europe/Istanbul',
): string {
  const raw = `${dateStr} ${timeSlot}`;
  const dt = DateTime.fromFormat(raw, "yyyy-MM-dd HH:mm", { zone: timezone });

  if (!dt.isValid) {
    throw new Error(
      `Cannot parse date/time — input: "${raw}", reason: ${dt.invalidReason}`,
    );
  }

  return dt.toISO() as string;
}

/**
 * Formats an ISO 8601 string for display in emails / UI.
 * Output: "24 Nisan Cuma, 16:00"
 */
export function formatDisplayDateTime(iso: string, timezone: string = 'Europe/Istanbul'): string {
  const dt = DateTime.fromISO(iso, { zone: timezone });
  if (!dt.isValid) throw new Error(`Invalid ISO string: "${iso}"`);
  return dt.setLocale('tr').toFormat("d MMMM cccc, HH:mm");
}

/**
 * Adds minutes to an ISO string and returns the new ISO string.
 * Used to compute appointment end time.
 */
export function addMinutesToIso(iso: string, minutes: number): string {
  const dt = DateTime.fromISO(iso);
  if (!dt.isValid) throw new Error(`Invalid ISO string: "${iso}"`);
  return dt.plus({ minutes }).toISO() as string;
}

/** Re-export for convenience */
export { TIME_SLOTS };
