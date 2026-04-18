/**
 * IANA timezone used across the entire application (server + client).
 * The server parses / validates dates in this zone; the client displays them
 * in the same zone so the time shown always matches the local business hours.
 */
export const TIMEZONE = 'Europe/Istanbul';

/** Time slots mirroring the n8n form dropdown */
export const TIME_SLOTS = [
  '9:00 am',
  '10:00 am',
  '11:00 am',
  '12:00 pm',
  '1:00 pm',
  '2:00 pm',
  '3:00 pm',
  '4:00 pm',
  '5:00 pm',
  '6:00 pm',
] as const;

export type TimeSlot = (typeof TIME_SLOTS)[number];

/** How many working days ahead to offer for booking (n8n: Array(5)) */
export const DEFAULT_BOOKING_WINDOW_DAYS = 5;

/** Default appointment length in minutes */
export const DEFAULT_APPOINTMENT_DURATION_MINUTES = 30;

/** Enquiry character limits (match Zod schemas) */
export const ENQUIRY_MIN_LENGTH = 10;
export const ENQUIRY_MAX_LENGTH = 2000;
