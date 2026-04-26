import rateLimit, { type Options } from 'express-rate-limit';

const isDev = process.env.NODE_ENV !== 'production';

const jsonHandler: Options['handler'] = (_req, res, _next, options) => {
  res.status(options.statusCode).json({
    error:       options.message as string,
    retryAfter:  Math.ceil((options.windowMs ?? 0) / 60_000),
  });
};

// Global: 300 req / 15 dk
export const globalLimiter = rateLimit({
  windowMs:       15 * 60 * 1000,
  max:            isDev ? 0 : 300,
  standardHeaders: true,
  legacyHeaders:  false,
  message:        'Çok fazla istek gönderildi, lütfen daha sonra tekrar deneyin.',
  handler:        jsonHandler,
});

// Form / AI submit: 30 / 15 dk
export const formSubmitLimiter = rateLimit({
  windowMs:       15 * 60 * 1000,
  max:            isDev ? 0 : 30,
  standardHeaders: true,
  legacyHeaders:  false,
  message:        'Çok fazla form gönderimi yapıldı, lütfen birkaç dakika bekleyin.',
  handler:        jsonHandler,
});

// Chat: 20 mesaj / 1 dk — Groq maliyet koruması
export const chatLimiter = rateLimit({
  windowMs:       60 * 1000,
  max:            isDev ? 0 : 20,
  standardHeaders: true,
  legacyHeaders:  false,
  message:        'Çok hızlı mesaj gönderiyorsunuz, lütfen bir dakika bekleyin.',
  handler:        jsonHandler,
});

// Admin AI analyze: 30 / 15 dk — Groq maliyet koruması
export const analyzeLimiter = rateLimit({
  windowMs:       15 * 60 * 1000,
  max:            isDev ? 0 : 30,
  standardHeaders: true,
  legacyHeaders:  false,
  message:        'Çok fazla analiz isteği, lütfen bekleyin.',
  handler:        jsonHandler,
});

// Approval / cancel token endpoints: 20 / 15 dk
export const approvalLimiter = rateLimit({
  windowMs:       15 * 60 * 1000,
  max:            isDev ? 0 : 20,
  standardHeaders: true,
  legacyHeaders:  false,
  message:        'Çok fazla istek gönderildi, lütfen birkaç dakika bekleyin.',
  handler:        jsonHandler,
});
