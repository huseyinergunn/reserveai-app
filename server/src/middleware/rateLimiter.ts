import rateLimit, { Options } from 'express-rate-limit';

const isDev = process.env.NODE_ENV !== 'production';

const jsonHandler: Options['handler'] = (_req, res, _next, options) => {
  res.status(options.statusCode).json({
    status: 'error',
    message: options.message as string,
    retryAfter: Math.ceil((options.windowMs ?? 0) / 60_000),
  });
};

// Global: 300 req / 15 dk (dev'de devre dışı — limit=0 skip eder)
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 0 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Çok fazla istek gönderildi, lütfen daha sonra tekrar deneyin.',
  handler: jsonHandler,
});

// Form / AI: 30 gönderim / 15 dk — gerçek bot'u durdurur, normal kullanıcıyı değil
export const formSubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 0 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Çok fazla form gönderimi yapıldı, lütfen birkaç dakika bekleyin.',
  handler: jsonHandler,
});
