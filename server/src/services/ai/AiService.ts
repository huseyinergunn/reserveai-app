import type { ClassificationResult, ExtractedAppointmentData } from '@shared/types';

/**
 * Abstract AI service contract.
 *
 * Any LLM provider (OpenAI, Gemini, Groq …) must implement this interface.
 * The rest of the codebase depends only on this interface, never on a
 * concrete SDK — swapping models is a single env-var change.
 */
export interface AiService {
  /**
   * Classifies a free-text enquiry.
   * "relevant" → booking / scheduling related
   * "other"    → everything else
   */
  classifyEnquiry(enquiry: string): Promise<ClassificationResult>;

  /**
   * Produces a concise 1–2 sentence summary of the enquiry.
   * Used in approval emails and Google Calendar event descriptions.
   */
  summariseEnquiry(enquiry: string): Promise<string>;

  /**
   * Extracts the intended date and time from the user's free-text enquiry.
   * Returns null fields when the information cannot be determined.
   * Used to pre-fill the Step 3 date/time picker.
   *
   * @param enquiry       The user's raw enquiry text.
   * @param availableDates ISO date strings (YYYY-MM-DD) that can be booked.
   * @param availableTimes Time slot strings (e.g. "10:00 am") that can be booked.
   */
  extractDateTime(
    enquiry: string,
    availableDates: string[],
    availableTimes: readonly string[],
  ): Promise<ExtractedAppointmentData>;
}
