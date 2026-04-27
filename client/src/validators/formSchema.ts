/**
 * Zod schemas for the 3-step appointment form.
 *
 * TIME_SLOTS is imported from @shared/constants so the allowed values are
 * identical on both client and server — a single source of truth.
 *
 * These schemas are used with react-hook-form's zodResolver in each step
 * component and can also be used for standalone validation.
 */

import { z } from 'zod';
import { TIME_SLOTS } from '@shared/constants';

// ---------------------------------------------------------------------------
// Step 1 — "n8n Form Trigger" fields
// (Your Name, Email, Enquiry)
// ---------------------------------------------------------------------------

export const step1Schema = z.object({
  name: z
    .string({ required_error: 'Your name is required.' })
    .min(2, 'Name must be at least 2 characters.')
    .max(100, 'Name must be at most 100 characters.')
    .transform((v) => v.trim().replace(/\s+/g, ' ')),

  email: z
    .string({ required_error: 'Email address is required.' })
    .email('Please enter a valid email address.')
    .max(254, 'Email address is too long.')
    .transform((v) => v.toLowerCase().trim()),

  enquiry: z
    .string({ required_error: 'Enquiry is required.' })
    .min(10, 'Please describe your enquiry in at least 10 characters.')
    .max(2000, 'Enquiry must be at most 2000 characters.')
    .transform((v) => v.trim().replace(/\s+/g, ' ')),
});

// ---------------------------------------------------------------------------
// Step 2 — "Terms & Conditions" node
// (n8n checks: $json["Please select"].startsWith("I accept"))
// ---------------------------------------------------------------------------

export const step2Schema = z.object({
  accepted: z
    .boolean({ required_error: 'You must accept the terms.' })
    .refine((v) => v === true, {
      message: 'You must accept the terms and conditions to continue.',
    }),
});

// ---------------------------------------------------------------------------
// Step 3 — "Enter Date & Time" node
// Date options are generated client-side via shared/dateUtils (weekday filter).
// Time options are validated against TIME_SLOTS from @shared/constants.
// ---------------------------------------------------------------------------

export const step3Schema = z.object({
  date: z
    .string({ required_error: 'Please select a date.' })
    .min(1, 'Please select a date.'),

  time: z
    .string({ required_error: 'Please select a time.' })
    .refine(
      (v): v is (typeof TIME_SLOTS)[number] =>
        (TIME_SLOTS as readonly string[]).includes(v),
      { message: 'Please select a valid time slot.' },
    ),
});

// ---------------------------------------------------------------------------
// Inferred types — used in components and hook signatures
// ---------------------------------------------------------------------------

/** Parsed (output) types — use for data after successful parse. */
export type Step1Values  = z.output<typeof step1Schema>;
export type Step2Values  = z.output<typeof step2Schema>;
export type Step3Values  = z.output<typeof step3Schema>;

/**
 * Input types — the raw form field values before Zod parses them.
 * Use as the generic for useForm<T> so react-hook-form's generic
 * doesn't clash with Zod's narrowed output types (e.g. TimeSlot union).
 */
export type Step1Input = z.input<typeof step1Schema>;
export type Step2Input = z.input<typeof step2Schema>;
export type Step3Input = z.input<typeof step3Schema>;

// ---------------------------------------------------------------------------
// Shared result type returned by every step handler
// ---------------------------------------------------------------------------

export interface StepResult {
  /** Field-keyed error map returned by the API (422 responses). */
  fieldErrors?: Record<string, string>;
  /** ISO string of the next available slot — set on 409 double-booking conflicts. */
  nextAvailable?: string | null;
}
