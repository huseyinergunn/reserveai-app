import { z } from 'zod';
import { TIME_SLOTS } from '@shared/constants';

// ---------------------------------------------------------------------------
// Step 1 — Initial enquiry
// ---------------------------------------------------------------------------

export const initialFormSchema = z.object({
  name: z
    .string({ required_error: 'Name is required.' })
    .min(2, 'Name must be at least 2 characters.')
    .max(100, 'Name must be at most 100 characters.')
    .transform((v) => v.trim().replace(/\s+/g, ' ')),

  email: z
    .string({ required_error: 'Email is required.' })
    .email('A valid email address is required.')
    .max(254)
    .transform((v) => v.toLowerCase().trim()),

  enquiry: z
    .string({ required_error: 'Enquiry is required.' })
    .min(10, 'Enquiry must be at least 10 characters.')
    .max(2000, 'Enquiry must be at most 2000 characters.')
    .transform((v) => v.trim().replace(/\s+/g, ' ')),
});

// ---------------------------------------------------------------------------
// Step 2 — Terms & Conditions
// ---------------------------------------------------------------------------

export const termsSchema = z.object({
  accepted: z
    .string({ required_error: 'You must accept the terms.' })
    .refine((v) => v.startsWith('I accept'), {
      message: 'You must accept the terms and conditions to continue.',
    }),
});

// ---------------------------------------------------------------------------
// Step 3 — Date/time selection
// ---------------------------------------------------------------------------

export const dateTimeSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  enquiry: z.string().min(10),
  date: z.string().min(1, 'Date is required.'),
  time: z
    .string()
    .refine((v): v is (typeof TIME_SLOTS)[number] => (TIME_SLOTS as readonly string[]).includes(v), {
      message: `Time must be one of: ${TIME_SLOTS.join(', ')}`,
    }),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type InitialFormData = z.output<typeof initialFormSchema>;
export type DateTimeFormData = z.output<typeof dateTimeSchema>;

// ---------------------------------------------------------------------------
// Helper — flatten ZodError into { field: message } map
// ---------------------------------------------------------------------------

import type { ZodError } from 'zod';

export function flattenZodErrors(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
