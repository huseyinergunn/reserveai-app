/**
 * Google Gemini implementation of AiService (stub).
 *
 * Install: npm install @google/generative-ai
 * Set: AI_PROVIDER=gemini, GEMINI_API_KEY=..., GEMINI_MODEL=gemini-1.5-flash
 *
 * Fill in the TODO sections below to activate.
 */

import type { AiService } from './AiService';
import type { ClassificationResult, ExtractedAppointmentData } from '@shared/types';
import { logger } from '../../utils/logger';

export class GeminiService implements AiService {
  // private readonly client: GoogleGenerativeAI; // uncomment after install

  constructor(
    _apiKey: string,
    private readonly model = 'gemini-1.5-flash',
  ) {
    // TODO: this.client = new GoogleGenerativeAI(_apiKey);
    logger.warn(`[GeminiService] Stub — model: ${this.model}. Implement before use.`);
  }

  async classifyEnquiry(_enquiry: string): Promise<ClassificationResult> {
    // TODO: call Gemini API, parse JSON response
    logger.warn('[GeminiService] classifyEnquiry not implemented — returning "other"');
    return { category: 'other' };
  }

  async summariseEnquiry(enquiry: string): Promise<string> {
    // TODO: call Gemini API and return text response
    logger.warn('[GeminiService] summariseEnquiry not implemented — returning raw enquiry');
    return enquiry;
  }

  async extractDateTime(
    _enquiry: string,
    _availableDates: string[],
    _availableTimes: readonly string[],
  ): Promise<ExtractedAppointmentData> {
    logger.warn('[GeminiService] extractDateTime not implemented — returning nulls');
    return { date: null, time: null, confidence: 'none', suggestionMessage: null };
  }
}
