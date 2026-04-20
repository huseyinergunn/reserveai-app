import Groq from 'groq-sdk';
import { DateTime } from 'luxon';
import type { AiService } from './AiService';
import type { ClassificationResult, ExtractedAppointmentData } from '../../../../shared/types';
import { logger } from '../../utils/logger';

export class GroqService implements AiService {
  private readonly client: Groq;
  private static readonly MAX_CHARS = 500;

  constructor(
    apiKey: string,
    private readonly model = 'llama3-8b-8192',
  ) {
    if (!apiKey) throw new Error('Groq API key is required.');
    this.client = new Groq({ apiKey });
  }

  async classifyEnquiry(enquiry: string): Promise<ClassificationResult> {
    const safe = enquiry.slice(0, GroqService.MAX_CHARS);

    try {
      const res = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are an appointment booking classifier. Your job is to decide whether the user's message is a request to book, schedule, or inquire about an appointment or meeting.

Classify as "relevant" if the message contains ANY of the following (in any language, including Turkish):
- A request to meet, talk, schedule, book, or arrange an appointment
- Words like: randevu, görüşme, toplantı, meet, schedule, book, appointment, call, consultation
- Time or date references in the context of scheduling (e.g. "Monday", "next week", "saat 10", "Pazartesi")
- A service inquiry that implies wanting to discuss or meet
- Any question about availability or booking

Classify as "other" ONLY if the message is clearly NOT about scheduling — for example: spam, generic greetings with no intent, or completely unrelated topics.

When in doubt, choose "relevant". It is better to accept a borderline request than to reject a genuine one.

Reply ONLY with valid JSON: {"category":"relevant"} or {"category":"other"}.`,
          },
          { role: 'user', content: safe },
        ],
      });

      const raw = res.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw) as { category?: string };
      const category = parsed.category === 'relevant' ? 'relevant' : 'other';

      logger.debug(`[GroqService] Classification: ${category}`);
      return { category };
    } catch (err) {
      logger.error('[GroqService] classifyEnquiry failed:', err);
      throw new Error(`Groq classification failed: ${(err as Error).message}`);
    }
  }

  async summariseEnquiry(enquiry: string): Promise<string> {
    const safe = enquiry.slice(0, GroqService.MAX_CHARS);

    try {
      const res = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: 'Summarise the given enquiry in 1–2 sentences. Be concise and professional.',
          },
          { role: 'user', content: `The enquiry is as follows:\n${safe}` },
        ],
      });

      return res.choices[0]?.message?.content?.trim() ?? enquiry;
    } catch (err) {
      logger.error('[GroqService] summariseEnquiry failed:', err);
      throw new Error(`Groq summarisation failed: ${(err as Error).message}`);
    }
  }

  async extractDateTime(
    enquiry: string,
    availableDates: string[],
    availableTimes: readonly string[],
  ): Promise<ExtractedAppointmentData> {
    const safe = enquiry.slice(0, GroqService.MAX_CHARS);
    const today = DateTime.now().setZone('Europe/Istanbul').toFormat('yyyy-MM-dd');

    // Build human-readable date labels for the AI
    const dateList = availableDates.map((iso) => {
      const label = new Intl.DateTimeFormat('tr-TR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        timeZone: 'Europe/Istanbul',
      }).format(new Date(iso + 'T12:00:00'));
      return `${iso} (${label})`;
    }).join('\n');

    const timeList = availableTimes.join(', ');

    try {
      const res = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Today is ${today}. The user is booking an appointment and may have mentioned a preferred date or time in their message.

Available dates (ISO — Turkish label):
${dateList}

Available time slots (24-hour format): ${timeList}

From the user's message, extract their intended appointment date and time.

Rules:
- date: must be one of the ISO dates above, or null
- time: must be one of the time slots above (exact match like "16:00"), or null
  - "saat 16", "16'da", "öğleden sonra 4", "4 pm" → "16:00"
  - "öğle" / "öğlen" → "12:00", "sabah 9" → "09:00"
  - Normalise to the nearest available slot listed above
- confidence: "high" = explicitly and clearly stated; "low" = inferred from context; "none" = no date/time mentioned
- suggestionMessage: a brief Turkish sentence if confidence is "low", null otherwise

Common Turkish mappings: Pazartesi=Monday, Salı=Tuesday, Çarşamba=Wednesday, Perşembe=Thursday, Cuma=Friday.

Reply ONLY with valid JSON: {"date":"YYYY-MM-DD or null","time":"HH:MM or null","confidence":"high|low|none","suggestionMessage":"string or null"}`,
          },
          { role: 'user', content: safe },
        ],
      });

      const raw = res.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw) as Partial<ExtractedAppointmentData>;

      // Validate returned values are actually in the allowed lists
      const date = parsed.date && availableDates.includes(parsed.date) ? parsed.date : null;
      const time = parsed.time && (availableTimes as readonly string[]).includes(parsed.time) ? parsed.time : null;
      const confidence = (['high', 'low', 'none'] as const).includes(parsed.confidence as 'high' | 'low' | 'none')
        ? (parsed.confidence as ExtractedAppointmentData['confidence'])
        : 'none';
      const suggestionMessage = typeof parsed.suggestionMessage === 'string' ? parsed.suggestionMessage : null;

      logger.debug(`[GroqService] Extracted: date=${date}, time=${time}, confidence=${confidence}`);
      return { date, time, confidence, suggestionMessage };
    } catch (err) {
      logger.warn('[GroqService] extractDateTime failed (non-fatal):', err);
      return { date: null, time: null, confidence: 'none', suggestionMessage: null };
    }
  }
}
