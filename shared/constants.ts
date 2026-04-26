/**
 * IANA timezone used across the entire application (server + client).
 * The server parses / validates dates in this zone; the client displays them
 * in the same zone so the time shown always matches the local business hours.
 */
export const TIMEZONE = 'Europe/Istanbul';

/** Time slots — 24-hour format, Europe/Istanbul business hours */
export const TIME_SLOTS = [
  '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
] as const;

export type TimeSlot = (typeof TIME_SLOTS)[number];

/** How many working days ahead to offer for booking (n8n: Array(5)) */
export const DEFAULT_BOOKING_WINDOW_DAYS = 5;

/** Default appointment length in minutes */
export const DEFAULT_APPOINTMENT_DURATION_MINUTES = 30;

/** Enquiry character limits (match Zod schemas) */
export const ENQUIRY_MIN_LENGTH = 10;
export const ENQUIRY_MAX_LENGTH = 2000;

/**
 * Turkish public holidays — fixed-date only (MM-DD format).
 * Variable religious holidays (Ramazan/Kurban Bayramı) shift each year
 * and must be managed via environment config or a separate calendar.
 */
export const TURKISH_HOLIDAYS: ReadonlyArray<string> = [
  '01-01', // Yılbaşı
  '04-23', // Ulusal Egemenlik ve Çocuk Bayramı
  '05-01', // Emek ve Dayanışma Bayramı
  '05-19', // Atatürk'ü Anma, Gençlik ve Spor Bayramı
  '07-15', // Demokrasi ve Millî Birlik Günü
  '08-30', // Zafer Bayramı
  '10-29', // Cumhuriyet Bayramı
];
