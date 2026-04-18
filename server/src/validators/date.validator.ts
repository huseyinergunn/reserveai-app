import {
  getAvailableDateOptions,
  parseDateTimeFromForm,
  isWeekend,
} from '@shared/dateUtils';
import { TIME_SLOTS, TIMEZONE } from '@shared/constants';
import type { TimeSlot } from '@shared/constants';
import { DateTime } from 'luxon';

export interface DateValidationResult {
  valid: boolean;
  iso?: string;
  error?: string;
}

/**
 * Server-side date validator.
 *
 * All date/time operations are performed in the configured timezone
 * (default: Europe/Istanbul / UTC+3) so the times stored in ISO format
 * reflect the user's local time — no UTC-shift surprises.
 *
 * Matches the client-side options exactly so server and client never diverge.
 */
export class DateValidator {
  constructor(
    private readonly bookingWindowDays: number,
    private readonly timezone: string = TIMEZONE,
  ) {}

  getAvailableDates(): string[] {
    return getAvailableDateOptions(this.bookingWindowDays, this.timezone);
  }

  getAvailableTimes(): readonly string[] {
    return TIME_SLOTS;
  }

  /**
   * Returns [windowStart, windowEnd] as ISO strings for MongoDB range queries.
   * windowStart = beginning of today, windowEnd = end of last available date.
   */
  getWindowBounds(): [string, string] {
    const now   = DateTime.now().setZone(this.timezone);
    const start = now.startOf('day').toISO()!;
    const end   = now.plus({ days: this.bookingWindowDays + 1 }).endOf('day').toISO()!;
    return [start, end];
  }

  /**
   * Fail-fast validation — checks rules in order:
   * 1. Both values present
   * 2. Time is in the allowed list
   * 3. Date is in the current booking window (computed in the configured TZ)
   * 4. Result is not a weekend (belt-and-braces)
   * 5. Result is in the future (compared in the configured TZ)
   */
  validate(dateStr: string, timeSlot: string): DateValidationResult {
    if (!dateStr?.trim()) return { valid: false, error: 'Date is required.' };
    if (!timeSlot?.trim()) return { valid: false, error: 'Time is required.' };

    const allowedTimes: readonly string[] = TIME_SLOTS;
    if (!allowedTimes.includes(timeSlot as TimeSlot)) {
      return {
        valid: false,
        error: `"${timeSlot}" is not a valid time slot.`,
      };
    }

    const allowedDates = this.getAvailableDates();
    if (!allowedDates.includes(dateStr)) {
      return {
        valid: false,
        error: `"${dateStr}" is not an available date. Choose from: ${allowedDates.join(', ')}.`,
      };
    }

    let iso: string;
    try {
      // Parse in the configured timezone — produces an ISO string with the
      // correct UTC offset (e.g. "+03:00" for Istanbul), preserving local time.
      iso = parseDateTimeFromForm(dateStr, timeSlot, this.timezone);
    } catch (err) {
      return { valid: false, error: (err as Error).message };
    }

    // All further checks in the same timezone
    const dt = DateTime.fromISO(iso, { zone: this.timezone });

    if (isWeekend(dt)) {
      return { valid: false, error: 'Appointments cannot be scheduled on weekends.' };
    }

    if (dt <= DateTime.now().setZone(this.timezone)) {
      return { valid: false, error: 'Appointment must be scheduled in the future.' };
    }

    return { valid: true, iso };
  }
}
