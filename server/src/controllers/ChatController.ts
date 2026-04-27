import type { Request, Response } from 'express';
import type { AiService } from '../services/ai/AiService';
import { logger } from '../utils/logger';

const AI_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(Object.assign(new Error('AI_TIMEOUT'), { code: 'AI_TIMEOUT' })), ms),
    ),
  ]);
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Deps {
  aiService: AiService;
}

export class ChatController {
  constructor(private readonly deps: Deps) {}

  message = async (req: Request, res: Response): Promise<void> => {
    const { messages } = req.body as { messages?: unknown };

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages array is required.' });
      return;
    }

    // Validate shape and sanitise
    const sanitised: ChatMessage[] = [];
    for (const m of messages) {
      if (
        typeof m !== 'object' || m === null ||
        !('role' in m) || !('content' in m) ||
        (m.role !== 'user' && m.role !== 'assistant') ||
        typeof m.content !== 'string'
      ) {
        res.status(400).json({ error: 'Invalid message format.' });
        return;
      }
      sanitised.push({
        role:    m.role as 'user' | 'assistant',
        content: (m.content as string).slice(0, 1000),
      });
    }

    // Keep last 20 turns to stay within token limits
    const trimmed = sanitised.slice(-20);

    try {
      const response = await withTimeout(
        this.deps.aiService.customerChat(trimmed),
        AI_TIMEOUT_MS,
      );
      res.status(200).json({ response });
    } catch (err) {
      const isTimeout = (err as { code?: string }).code === 'AI_TIMEOUT';
      if (isTimeout) {
        logger.warn('[ChatController] customerChat timed out');
        res.status(504).json({ error: 'Şu an yoğunluk var, lütfen tekrar deneyin.' });
      } else {
        logger.error('[ChatController] customerChat failed:', err);
        res.status(500).json({ error: 'AI servisi şu an yanıt veremiyor. Lütfen tekrar deneyin.' });
      }
    }
  };
}
