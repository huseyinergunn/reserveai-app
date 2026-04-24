import type { AiService } from './AiService';
import { OpenAiService } from './OpenAiService';
import { GeminiService } from './GeminiService';
import { GroqService } from './GroqService';

type Provider = 'openai' | 'gemini' | 'groq';

/**
 * Reads AI_PROVIDER from env and returns the correct AiService implementation.
 * All consumers depend only on the AiService interface, never on this factory.
 */
export function createAiService(): AiService {
  const provider = (process.env.AI_PROVIDER ?? 'openai').toLowerCase() as Provider;

  switch (provider) {
    case 'openai':
      return new OpenAiService(
        process.env.OPENAI_API_KEY ?? '',
        process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      );
    case 'gemini':
      return new GeminiService(
        process.env.GEMINI_API_KEY ?? '',
        process.env.GEMINI_MODEL ?? 'gemini-1.5-flash',
      );
    case 'groq':
      return new GroqService(
        process.env.GROQ_API_KEY ?? '',
        process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
      );
    default:
      throw new Error(
        `Unknown AI_PROVIDER: "${provider}". Valid options: openai | gemini | groq`,
      );
  }
}
