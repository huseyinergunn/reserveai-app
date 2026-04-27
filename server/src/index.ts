import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';

import { logger } from './utils/logger';
import { globalLimiter, formSubmitLimiter, chatLimiter, approvalLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';

import { createAiService } from './services/ai/AiServiceFactory';
import { MailService } from './services/mail/MailService';
import { CalendarService } from './services/calendar/CalendarService';
import { SheetsService } from './services/sheets/SheetsService';
import { WebhookService } from './services/WebhookService';

import { DateValidator } from './validators/date.validator';

import { FormController } from './controllers/FormController';
import { ApprovalController } from './controllers/ApprovalController';
import { AdminController } from './controllers/AdminController';
import { ChatController } from './controllers/ChatController';

import { createFormRouter } from './routes/form.routes';
import { createApprovalRouter } from './routes/approval.routes';
import { createAdminRouter } from './routes/admin.routes';
import { createChatRouter } from './routes/chat.routes';

// ---------------------------------------------------------------------------
// Fail-fast env validation
// ---------------------------------------------------------------------------

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) {
    // throw Error yapmadan önce senkron bir şekilde hata basıyoruz
    process.stderr.write(`\n\n❌ EKSİK DEĞİŞKEN: ${key}\n\n`); 
    process.exit(1); 
    return ''; 
  }
  return v;
}

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/smart-app';

if (!process.env.JWT_SECRET) {
  process.stderr.write('\n\n❌ EKSİK DEĞİŞKEN: JWT_SECRET\n\n');
  process.exit(1);
}

const allowedOrigins = (process.env.CLIENT_URL ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

if (process.env.NODE_ENV === 'production' && !process.env.CLIENT_URL) {
  process.stderr.write(
    '\n⚠️  CLIENT_URL env değişkeni ayarlı değil! ' +
    'Production CORS çalışmaz ve çerezler bloke edilir.\n\n',
  );
}

// ---------------------------------------------------------------------------
// Dependency wiring
// ---------------------------------------------------------------------------

const aiService = createAiService();

const mailService = new MailService({
  clientId:     requireEnv('GMAIL_CLIENT_ID'),
  clientSecret: requireEnv('GMAIL_CLIENT_SECRET'),
  refreshToken: requireEnv('GMAIL_REFRESH_TOKEN'),
  user:         requireEnv('GMAIL_USER'),
  adminEmail:   requireEnv('ADMIN_EMAIL'),
  appBaseUrl:   process.env.APP_BASE_URL ?? `http://localhost:${PORT}`,
  clientUrl:    allowedOrigins[0],
});

const calendarService = new CalendarService({
  clientId:                   requireEnv('GOOGLE_CALENDAR_CLIENT_ID'),
  clientSecret:               requireEnv('GOOGLE_CALENDAR_CLIENT_SECRET'),
  refreshToken:               requireEnv('GOOGLE_CALENDAR_REFRESH_TOKEN'),
  calendarId:                 requireEnv('GOOGLE_CALENDAR_ID'),
  appointmentDurationMinutes: parseInt(process.env.APPOINTMENT_DURATION_MINUTES ?? '30', 10),
});

const dateValidator = new DateValidator(
  parseInt(process.env.BOOKING_WINDOW_DAYS ?? '5', 10),
  process.env.TIMEZONE ?? 'Europe/Istanbul',
);

const webhookService = new WebhookService(process.env.N8N_WEBHOOK_URL);

// SheetsService is optional — only created when GOOGLE_SHEETS_SPREADSHEET_ID is set
const sheetsService = process.env.GOOGLE_SHEETS_SPREADSHEET_ID
  ? new SheetsService({
      clientId:      process.env.GOOGLE_CALENDAR_CLIENT_ID  ?? '',
      clientSecret:  process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? '',
      refreshToken:  process.env.GOOGLE_CALENDAR_REFRESH_TOKEN ?? '',
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
      sheetName:     process.env.GOOGLE_SHEETS_NAME       ?? 'Sayfa1',
      tableName:     process.env.GOOGLE_SHEETS_TABLE_NAME,          // e.g. "Randevular"
      idColumn:      process.env.GOOGLE_SHEETS_ID_COLUMN  ?? 'id',  // e.g. "q" if header differs
    })
  : undefined;

const formController = new FormController({
  aiService,
  mailService,
  dateValidator,
  webhookService,
  sheetsService,
});

const approvalController = new ApprovalController({
  calendarService,
  mailService,
  sheetsService,
  n8nApprovalWebhookUrl:     process.env.N8N_APPROVAL_WEBHOOK_URL,
  n8nCancellationWebhookUrl: process.env.N8N_CANCELLATION_WEBHOOK_URL,
  appBaseUrl:                process.env.APP_BASE_URL ?? `http://localhost:${PORT}`,
  clientUrl:                 allowedOrigins[0],
});

const adminController = new AdminController({
  aiService,
  calendarService,
  mailService,
  sheetsService,
  n8nApprovalWebhookUrl:     process.env.N8N_APPROVAL_WEBHOOK_URL,
  n8nCancellationWebhookUrl: process.env.N8N_CANCELLATION_WEBHOOK_URL,
  appBaseUrl:                process.env.APP_BASE_URL ?? `http://localhost:${PORT}`,
  adminSecretKey:            process.env.ADMIN_SECRET_KEY ?? 'changeme',
});

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = express();

// ngrok / Render / Heroku gibi reverse proxy'lerin arkasında çalışırken
// gerçek istemci IP'sini X-Forwarded-For header'ından okur.
// Sayı (1) yalnızca ilk proxy katmanına güvenir — üretimde güvenli.
app.set('trust proxy', 1);

app.use(helmet());

// Cross-Origin Resource Sharing
// credentials:true + specific origin is REQUIRED for httpOnly cookie auth.
// When frontend and backend live on different TLD+1s (e.g. Vercel vs Render)
// the browser treats requests as cross-site; the origin must be exact — never '*'.
const corsOptions = {
  origin(
    requestOrigin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) {
    // Server-to-server or same-origin requests have no Origin header → allow.
    if (!requestOrigin) return callback(null, true);
    if (allowedOrigins.includes(requestOrigin)) return callback(null, true);
    callback(new Error(`CORS: origin '${requestOrigin}' is not allowed`));
  },
  credentials:    true,
  methods:        ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // preflight — tüm route'lara OPTIONS izni
app.use(express.json());           // JSON body parser — ROUTE'LARDAN ÖNCE
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(globalLimiter);

const chatController = new ChatController({ aiService });

// Routes — specific limiters protect expensive AI endpoints
app.use('/api/form',     formSubmitLimiter, createFormRouter(formController));
app.use('/api/approval', approvalLimiter,  createApprovalRouter(approvalController));
app.use('/api/admin',                      createAdminRouter(adminController));
app.use('/api/chat',     chatLimiter,      createChatRouter(chatController));

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() }),
);

// Must be last
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Start — connect DB then listen
// ---------------------------------------------------------------------------

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    logger.info(`[DB] Connected to MongoDB`);
    app.listen(PORT, () => {
      logger.info(`🚀 Server ready on http://localhost:${PORT}`);
      logger.info(`   AI provider : ${process.env.AI_PROVIDER ?? 'openai'}`);
      logger.info(`   CORS origins: ${allowedOrigins.join(', ')}`);
    });
  })
  .catch((err) => {
    logger.error('[DB] MongoDB connection failed:', err);
    process.exit(1);
  });

export { app };
