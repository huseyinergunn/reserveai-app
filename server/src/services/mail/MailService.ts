import { google } from 'googleapis';
import type { FormSubmission, ApprovalPayload, TriageUrgency } from '../../../../shared/types';
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
      subject: `Randevu Talebiniz Alındı — ${display}`,
      html: `
        <p>Merhaba ${escapeHtml(submission.name)},</p>
        <p>Randevu talebinizi aldık. En kısa sürede değerlendirip size geri döneceğiz.</p>
        <table style="border-collapse:collapse">
          <tr><td><strong>Ad Soyad</strong></td><td>${escapeHtml(submission.name)}</td></tr>
          <tr><td><strong>E-posta</strong></td><td>${escapeHtml(submission.email)}</td></tr>
          <tr><td><strong>Tarih &amp; Saat</strong></td><td>${escapeHtml(display)}</td></tr>
          <tr><td><strong>Konu</strong></td><td>${escapeHtml(submission.enquiry)}</td></tr>
          <tr><td><strong>Gönderilme Zamanı</strong></td><td>${escapeHtml(submission.submittedAt)}</td></tr>
        </table>`,
    });
    logger.info(`[MailService] Receipt → ${submission.email}`);
  }

  /** Sends an approve/decline email to the admin with a frontend approval link. */
  async sendApprovalRequest(payload: ApprovalPayload): Promise<void> {
    const display = formatDisplayDateTime(payload.dateTime);
    const approvalPageUrl = `${this.cfg.clientUrl}/approve/${payload.approvalToken}`;
    const urgency = payload.triage?.urgency ?? 'NORMAL';

    const URGENCY_META: Record<TriageUrgency, { prefix: string; color: string; label: string; emoji: string }> = {
      CRITICAL: { prefix: '🚨 ACİL — ',    color: '#dc2626', label: 'ACİL',   emoji: '🚨' },
      HIGH:     { prefix: '⚠️ Önemli — ',  color: '#d97706', label: 'ÖNEMLİ', emoji: '⚠️' },
      NORMAL:   { prefix: '',               color: '#3b82f6', label: 'NORMAL', emoji: '📋' },
      LOW:      { prefix: '',               color: '#64748b', label: 'DÜŞÜK',  emoji: '📋' },
    };
    const meta = URGENCY_META[urgency];

    const urgencyBanner = urgency === 'CRITICAL' || urgency === 'HIGH' ? `
      <div style="background:${meta.color};color:#fff;padding:12px 20px;border-radius:8px;margin-bottom:16px;font-weight:700;font-size:15px">
        ${meta.emoji} ${meta.label} ÖNCELIK — Bu randevu talebini öncelikli inceleyin.
      </div>` : '';

    const triageRow = payload.triage?.adminSummary ? `
      <tr style="background:#f0f9ff">
        <td style="padding:8px 12px;font-weight:600;color:#0369a1">🤖 AI Özeti</td>
        <td style="padding:8px 12px;color:#0c4a6e;font-style:italic">${escapeHtml(payload.triage.adminSummary)}</td>
      </tr>` : '';

    const sentimentRow = payload.triage ? `
      <tr>
        <td style="padding:8px 12px;font-weight:600">Duygu Tonu</td>
        <td style="padding:8px 12px">${escapeHtml(payload.triage.sentiment)} · Netlik: ${payload.triage.clarity}/100</td>
      </tr>` : '';

    await this.send({
      to:      this.cfg.adminEmail,
      subject: `${meta.prefix}Yeni Randevu Talebi — ${payload.bookingReference}`,
      html: `
        ${urgencyBanner}
        <h2>Yeni Randevu Talebi</h2>
        <p>Talep edilen tarih: <strong>${escapeHtml(display)}</strong></p>
        <table style="border-collapse:collapse;margin-bottom:16px;width:100%">
          <tr><td style="padding:8px 12px;font-weight:600">Ad Soyad</td><td style="padding:8px 12px">${escapeHtml(payload.name)}</td></tr>
          <tr><td style="padding:8px 12px;font-weight:600">E-posta</td><td style="padding:8px 12px">${escapeHtml(payload.email)}</td></tr>
          <tr><td style="padding:8px 12px;font-weight:600">Rezervasyon Ref</td><td style="padding:8px 12px">${escapeHtml(payload.bookingReference)}</td></tr>
          <tr><td style="padding:8px 12px;font-weight:600">Talep Özeti</td><td style="padding:8px 12px">${escapeHtml(payload.enquirySummary)}</td></tr>
          ${triageRow}
          ${sentimentRow}
          <tr><td style="padding:8px 12px;font-weight:600">Gönderilme</td><td style="padding:8px 12px">${escapeHtml(payload.submittedAt)}</td></tr>
        </table>
        <a href="${approvalPageUrl}" style="padding:10px 20px;background:${meta.color};color:#fff;border-radius:4px;text-decoration:none">
          ${meta.emoji} İncele &amp; Karar Ver
        </a>`,
    });
    logger.info(`[MailService] Approval request → ${this.cfg.adminEmail} (ref=${payload.bookingReference}, urgency=${urgency})`);
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
      subject: `Randevu Talebiniz Reddedildi — ${display}`,
      html: `
        <p>Merhaba ${escapeHtml(submission.name)},</p>
        <p>Maalesef talep ettiğiniz tarih ve saatte randevu oluşturamıyoruz.</p>
        <p>Farklı bir tarih için yeniden talepte bulunabilirsiniz.</p>
        <p>İyi günler dileriz.</p>`,
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
      subject: `Randevunuz İptal Edildi — ${params.bookingReference}`,
      html: `
        <p>Merhaba ${escapeHtml(params.name)},</p>
        <p><strong>${escapeHtml(display)}</strong> tarihli randevunuz başarıyla iptal edildi.</p>
        <p>Rezervasyon referansı: <strong>${escapeHtml(params.bookingReference)}</strong></p>
        <p>Yeni bir randevu almak isterseniz randevu sayfamızı ziyaret edebilirsiniz.</p>
        <p>İyi günler dileriz.</p>`,
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
      subject: `Randevu İptal Edildi — ${params.bookingReference}`,
      html: `
        <h2>Randevu İptal Edildi</h2>
        <p>Aşağıdaki randevu kullanıcı tarafından iptal edildi:</p>
        <table style="border-collapse:collapse;margin-bottom:16px">
          <tr><td><strong>Ad Soyad</strong></td><td>${escapeHtml(params.name)}</td></tr>
          <tr><td><strong>E-posta</strong></td><td>${escapeHtml(params.email)}</td></tr>
          <tr><td><strong>Tarih &amp; Saat</strong></td><td>${escapeHtml(display)}</td></tr>
          <tr><td><strong>Rezervasyon Ref</strong></td><td>${escapeHtml(params.bookingReference)}</td></tr>
        </table>
        <p>Takvim etkinliği silindi ve saat dilimi tekrar müsait hale geldi.</p>`,
    });
    logger.info(`[MailService] Cancellation (admin) → ${this.cfg.adminEmail} (ref=${params.bookingReference})`);
  }

  /** Sends the cancellation link to the user on request from the status page. */
  async sendCancelLinkEmail(params: {
    name: string;
    email: string;
    dateTime: string;
    bookingReference: string;
    cancelUrl: string;
  }): Promise<void> {
    const display = formatDisplayDateTime(params.dateTime);
    await this.send({
      to: params.email,
      subject: `Randevu İptal Bağlantınız — ${params.bookingReference}`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Inter,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
<tr><td style="background:linear-gradient(135deg,#ef4444,#dc2626);padding:32px 40px;text-align:center">
  <h1 style="color:white;margin:0;font-size:22px;font-weight:700">🚫 Randevu İptal Talebi</h1>
</td></tr>
<tr><td style="padding:32px 40px">
  <p style="color:#374151;font-size:16px;margin:0 0 16px">Merhaba <strong>${escapeHtml(params.name)}</strong>,</p>
  <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px">
    <strong>${escapeHtml(display)}</strong> tarihli randevunuz için iptal bağlantınız aşağıdadır.
    Bu bağlantıya tıklayarak randevunuzu iptal edebilirsiniz.
  </p>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border-radius:10px;border:1px solid #fecaca;overflow:hidden;margin:0 0 24px">
    <tr><td style="padding:12px 16px;font-weight:600;color:#dc2626;width:160px">📅 Tarih &amp; Saat</td>
        <td style="padding:12px 16px;color:#1e293b">${escapeHtml(display)}</td></tr>
    <tr><td style="padding:12px 16px;font-weight:600;color:#dc2626">🔖 Referans</td>
        <td style="padding:12px 16px;color:#1e293b;font-family:monospace">${escapeHtml(params.bookingReference)}</td></tr>
  </table>
  <a href="${params.cancelUrl}" style="display:inline-block;background:#ef4444;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">
    🚫 Randevuyu İptal Et
  </a>
  <p style="color:#94a3b8;font-size:12px;margin:20px 0 0">Bu bağlantıyı siz talep etmediyseniz bu e-postayı görmezden gelebilirsiniz.</p>
</td></tr>
</table></td></tr></table></body></html>`,
    });
    logger.info(`[MailService] Cancel link → ${params.email} (ref=${params.bookingReference})`);
  }

  // ---------------------------------------------------------------------------

  private async send(opts: { to: string; subject: string; html: string }): Promise<void> {
    const auth = new google.auth.OAuth2(this.cfg.clientId, this.cfg.clientSecret);
    auth.setCredentials({ refresh_token: this.cfg.refreshToken });
    const gmail = google.gmail({ version: 'v1', auth });

    // RFC 2047 — encode subject so Turkish/non-ASCII chars survive SMTP transit
    const encodedSubject = `=?UTF-8?B?${Buffer.from(opts.subject, 'utf8').toString('base64')}?=`;
    // Encode body as base64 so multi-byte chars aren't mangled by line-ending transforms
    const encodedBody = Buffer.from(opts.html, 'utf8').toString('base64');

    const raw = Buffer.from(
      [
        `From: ${this.cfg.user}`,
        `To: ${opts.to}`,
        `Subject: ${encodedSubject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        '',
        encodedBody,
      ].join('\r\n'),
      'utf8',
    ).toString('base64url');

    try {
      await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
    } catch (err) {
      logger.error('[MailService] Gmail API send failed:', err);
      throw new Error(`Email delivery failed: ${(err as Error).message}`);
    }
  }
}
