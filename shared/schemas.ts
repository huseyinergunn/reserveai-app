/**
 * Zod validation schemas — single source of truth for BOTH api and client.
 *
 * api/   uses these in express request validators (fail-fast).
 * client/ uses these with react-hook-form + @hookform/resolvers/zod.
 */

import { z } from 'zod';
import { TIME_SLOTS, ENQUIRY_MIN_LENGTH, ENQUIRY_MAX_LENGTH } from './constants';

// ---------------------------------------------------------------------------
// Step 1 — Initial enquiry
// ---------------------------------------------------------------------------

export const step1Schema = z.object({
  name: z
    .string({ required_error: 'Name is required.' })
    .min(2, 'Name must be at least 2 characters.')
    .max(100, 'Name is too long.')
    .transform((v) => v.trim().replace(/\s+/g, ' ')),

  email: z
    .string({ required_error: 'Email is required.' })
    .email('Please enter a valid email address.')
    .max(254, 'Email is too long.')
    .transform((v) => v.toLowerCase().trim()),

  enquiry: z
    .string({ required_error: 'Enquiry is required.' })
    .min(ENQUIRY_MIN_LENGTH, `Enquiry must be at least ${ENQUIRY_MIN_LENGTH} characters.`)
    .max(ENQUIRY_MAX_LENGTH, `Enquiry must be at most ${ENQUIRY_MAX_LENGTH} characters.`)
    .transform((v) => v.trim().replace(/\s+/g, ' ')),
});

// ---------------------------------------------------------------------------
// Step 2 — Terms & Conditions
// ---------------------------------------------------------------------------

export const step2Schema = z.object({
  accepted: z
    .string({ required_error: 'You must accept the terms.' })
    .refine((v) => v.startsWith('I accept'), {
      message: 'You must accept the terms and conditions to continue.',
    }),
});

// ---------------------------------------------------------------------------
// Step 3 — Date / time selection
// ---------------------------------------------------------------------------

export const step3Schema = z.object({
  // Carry forward from step 1
  name: z.string().min(2),
  email: z.string().email(),
  enquiry: z.string().min(ENQUIRY_MIN_LENGTH),

  date: z.string().min(1, 'Please select a date.'),

  time: z
    .string()
    .refine(
      (v): v is (typeof TIME_SLOTS)[number] =>
        (TIME_SLOTS as readonly string[]).includes(v),
      { message: `Please select a valid time slot.` },
    ),
});

// ---------------------------------------------------------------------------
// Client-only checkbox variant for Step 2
// ---------------------------------------------------------------------------

export const step2CheckboxSchema = z.object({
  accepted: z
    .boolean()
    .refine((v) => v === true, { message: 'You must accept the terms to continue.' }),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type Step1Input  = z.input<typeof step1Schema>;
export type Step1Data   = z.output<typeof step1Schema>;
export type Step2Data   = z.output<typeof step2Schema>;
export type Step3Input  = z.input<typeof step3Schema>;
export type Step3Data   = z.output<typeof step3Schema>;

// ---------------------------------------------------------------------------
// Helper
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
