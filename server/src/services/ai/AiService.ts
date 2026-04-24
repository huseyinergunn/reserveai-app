import type { ClassificationResult, ExtractedAppointmentData, TriageResult } from '../../../../shared/types';

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

  /**
   * Triages the enquiry: urgency level, sentiment, clarity score, and
   * a one-sentence Turkish admin summary. Used to route notifications
   * and surface priority signals in the admin dashboard.
   */
  triageEnquiry(enquiry: string): Promise<TriageResult>;

  /**
   * Business analytics chat: answers a Turkish admin question using
   * aggregated appointment data as context.
   *
   * @param context  JSON string with aggregated DB stats.
   * @param question Free-text Turkish question from the admin.
   */
  analyzeAppointments(context: string, question: string): Promise<string>;

  /**
   * Customer-facing chat: answers FAQ and guides appointment booking.
   * Uses a fixed business knowledge system prompt; stateless per call.
   */
  customerChat(messages: { role: 'user' | 'assistant'; content: string }[]): Promise<string>;
}
