import { logger } from '../utils/logger';

export interface WebhookPayload {
  id:         string;   // MongoDB _id
  name:       string;
  email:      string;
  enquiry:    string;   // form'daki talep metni
  dateTime:   string;   // ISO 8601 tam datetime — takvim için
  status:     string;   // "pending"
  approveUrl: string;   // kısa URL: {appBaseUrl}/api/approval/a/:id
  rejectUrl:  string;   // kısa URL: {appBaseUrl}/api/approval/r/:id
}

/**
 * Fires a fire-and-forget POST to the configured n8n webhook URL.
 *
 * Never throws — errors are logged and swallowed so they never
 * interrupt the main appointment flow.
 *
 * Env: N8N_WEBHOOK_URL — if not set, calls are silently skipped.
 */
export class WebhookService {
  constructor(private readonly webhookUrl: string | undefined) {}

  async notify(payload: WebhookPayload): Promise<void> {
    if (!this.webhookUrl) {
      logger.debug('[WebhookService] N8N_WEBHOOK_URL not configured — skipping');
      return;
    }

    logger.info(`[WebhookService] Notifying n8n → ${this.webhookUrl}`);

    try {
      const res = await fetch(this.webhookUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      logger.info(`[WebhookService] n8n responded → HTTP ${res.status}`);
    } catch (err) {
      const error = err as Error;
      logger.error('[WebhookService] Failed to notify n8n (non-fatal):', error.message);
    }
  }
}
