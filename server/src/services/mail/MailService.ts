import { google } from 'googleapis';
import type { FormSubmission, ApprovalPayload } from '../../../../shared/types';
import { formatDisplayDateTime } from '../../../../shared/dateUtils';
import { logger } from '../../utils/logger';

interface MailConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  user: string;
  adminEmail: string;
  appBaseUrl: string;
  clientUrl: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export class MailService {
  constructor(private readonly cfg: MailConfig) {
    const required: (keyof MailConfig)[] = [
      'clientId', 'clientSecret', 'refreshToken', 'user', 'adminEmail',
    ];
    for (const k of required) {
      if (!cfg[k]) throw new Error(`MailService: missing config "${k}"`);
    }
  }

  /** Sends an immediate acknowledgement to the user. */
  async sendReceipt(submission: FormSubmission): Promise<void> {
    const display = formatDisplayDateTime(submission.dateTime);
    await this.send({
      to: submission.email,
      subject: `Appointment Request Received for ${display}`,
      html: `
        <p>Dear ${escapeHtml(submission.name)},</p>
        <p>Thanks for requesting an appointment. We will review and get back to you shortly.</p>
        <table style="border-collapse:collapse">
          <tr><td><strong>Name</strong></td><td>${escapeHtml(submission.name)}</td></tr>
          <tr><td><strong>Email</strong></td><td>${escapeHtml(submission.email)}</td></tr>
          <tr><td><strong>Date & Time</strong></td><td>${escapeHtml(display)}</td></tr>
          <tr><td><strong>Enquiry</strong></td><td>${escapeHtml(submission.enquiry)}</td></tr>
          <tr><td><strong>Submitted at</strong></td><td>${escapeHtml(submission.submittedAt)}</td></tr>
        </table>`,
    });
    logger.info(`[MailService] Receipt → ${submission.email}`);
  }

  /** Sends an approve/decline email to the admin with a frontend approval link. */
  async sendApprovalRequest(payload: ApprovalPayload): Promise<void> {
    const display = formatDisplayDateTime(payload.dateTime);
    // Frontend approval page — admin reviews details and clicks Confirm/Decline there
    const approvalPageUrl = `${this.cfg.clientUrl}/approve/${payload.approvalToken}`;

    await this.send({
      to: this.cfg.adminEmail,
      subject: 'New Appointment Request!',
      html: `
        <h2>New Appointment Request</h2>
        <p>Requested date: <strong>${escapeHtml(display)}</strong></p>
        <table style="border-collapse:collapse;margin-bottom:16px">
          <tr><td><strong>Name</strong></td><td>${escapeHtml(payload.name)}</td></tr>
          <tr><td><strong>Email</strong></td><td>${escapeHtml(payload.email)}</td></tr>
          <tr><td><strong>Booking Ref</strong></td><td>${escapeHtml(payload.bookingReference)}</td></tr>
          <tr><td><strong>Summary</strong></td><td>${escapeHtml(payload.enquirySummary)}</td></tr>
          <tr><td><strong>Submitted at</strong></td><td>${escapeHtml(payload.submittedAt)}</td></tr>
        </table>
        <a href="${approvalPageUrl}" style="padding:10px 20px;background:#3b82f6;color:#fff;border-radius:4px;text-decoration:none">
          📋 Review &amp; Decide
        </a>`,
    });
    logger.info(`[MailService] Approval request → ${this.cfg.adminEmail} (ref=${payload.bookingReference})`);
  }

  /** Sends a confirmation to the user after admin approval. No ICS — pure HTML. */
  async sendApprovalConfirmation(params: {
    name: string;
    email: string;
    dateTime: string;
    cancelUrl: string;
    conferenceLink?: string;
  }): Promise<void> {
    const display = formatDisplayDateTime(params.dateTime);
    const meetRow = params.conferenceLink
      ? `<tr><td style="padding:12px 16px;font-weight:600;color:#15803d">🎥 Google Meet</td>
         <td style="padding:12px 16px"><a href="${params.conferenceLink}" style="color:#2563eb">${params.conferenceLink}</a></td></tr>`
      : '';
    await this.send({
      to: params.email,
      subject: `✅ Randevunuz Onaylandı — ${escapeHtml(display)}`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Inter,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
<tr><td style="background:linear-gradient(135deg,#16a34a,#15803d);padding:32px 40px;text-align:center">
  <h1 style="color:white;margin:0;font-size:24px;font-weight:700">✅ Randevunuz Onaylandı!</h1>
</td></tr>
<tr><td style="padding:32px 40px">
  <p style="color:#374151;font-size:16px;margin:0 0 20px">Merhaba <strong>${escapeHtml(params.name)}</strong>,</p>
  <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px">Randevu talebiniz onaylandı. Sizi bekliyoruz!</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0;overflow:hidden;margin:0 0 24px">
    <tr><td style="padding:12px 16px;font-weight:600;color:#15803d;width:140px">📅 Tarih &amp; Saat</td>
        <td style="padding:12px 16px;color:#1e293b;font-weight:500">${escapeHtml(display)}</td></tr>
    ${meetRow}
  </table>
  <p style="color:#94a3b8;font-size:13px;margin:0 0 12px">Randevunuzu iptal etmek isterseniz:</p>
  <a href="${params.cancelUrl}" style="display:inline-block;background:#f1f5f9;color:#64748b;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:13px;border:1px solid #cbd5e1">🚫 Randevuyu İptal Et</a>
</td></tr>
</table></td></tr></table></body></html>`,
    });
    logger.info(`[MailService] Approval confirmation → ${params.email}`);
  }

  /** Notifies the user that their request was declined. */
  async sendRejection(
    submission: Pick<FormSubmission, 'name' | 'email' | 'dateTime'>,
  ): Promise<void> {
    const display = formatDisplayDateTime(submission.dateTime);
    await this.send({
      to: submission.email,
      subject: `Appointment Request Rejected for ${display}`,
      html: `
        <p>Dear ${escapeHtml(submission.name)},</p>
        <p>Unfortunately, we cannot schedule the requested appointment at the requested time.</p>
        <p>Kind regards</p>`,
    });
    logger.info(`[MailService] Rejection → ${submission.email}`);
  }

  /** Notifies the user that their appointment has been cancelled. */
  async sendCancellationToUser(params: {
    name: string;
    email: string;
    dateTime: string;
    bookingReference: string;
  }): Promise<void> {
    const display = formatDisplayDateTime(params.dateTime);
    await this.send({
      to: params.email,
      subject: `Appointment Cancelled — ${params.bookingReference}`,
      html: `
        <p>Dear ${escapeHtml(params.name)},</p>
        <p>Your appointment scheduled for <strong>${escapeHtml(display)}</strong> has been successfully cancelled.</p>
        <p>Booking reference: <strong>${escapeHtml(params.bookingReference)}</strong></p>
        <p>If you wish to book a new appointment, please visit our scheduling page.</p>
        <p>Kind regards</p>`,
    });
    logger.info(`[MailService] Cancellation (user) → ${params.email} (ref=${params.bookingReference})`);
  }

  /** Notifies the admin that an appointment has been cancelled by the user. */
  async sendCancellationToAdmin(params: {
    name: string;
    email: string;
    dateTime: string;
    bookingReference: string;
  }): Promise<void> {
    const display = formatDisplayDateTime(params.dateTime);
    await this.send({
      to: this.cfg.adminEmail,
      subject: `Appointment Cancelled — ${params.bookingReference}`,
      html: `
        <h2>Appointment Cancelled</h2>
        <p>The following appointment has been cancelled by the user:</p>
        <table style="border-collapse:collapse;margin-bottom:16px">
          <tr><td><strong>Name</strong></td><td>${escapeHtml(params.name)}</td></tr>
          <tr><td><strong>Email</strong></td><td>${escapeHtml(params.email)}</td></tr>
          <tr><td><strong>Date & Time</strong></td><td>${escapeHtml(display)}</td></tr>
          <tr><td><strong>Booking Ref</strong></td><td>${escapeHtml(params.bookingReference)}</td></tr>
        </table>
        <p>The calendar event has been removed and the time slot is now available again.</p>`,
    });
    logger.info(`[MailService] Cancellation (admin) → ${this.cfg.adminEmail} (ref=${params.bookingReference})`);
  }

  // ---------------------------------------------------------------------------

  private async send(opts: { to: string; subject: string; html: string }): Promise<void> {
    const auth = new google.auth.OAuth2(this.cfg.clientId, this.cfg.clientSecret);
    auth.setCredentials({ refresh_token: this.cfg.refreshToken });
    const gmail = google.gmail({ version: 'v1', auth });

    const raw = Buffer.from(
      [
        `From: ${this.cfg.user}`,
        `To: ${opts.to}`,
        `Subject: ${opts.subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
        '',
        opts.html,
      ].join('\r\n'),
    ).toString('base64url');

    try {
      await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
    } catch (err) {
      logger.error('[MailService] Gmail API send failed:', err);
      throw new Error(`Email delivery failed: ${(err as Error).message}`);
    }
  }
}
