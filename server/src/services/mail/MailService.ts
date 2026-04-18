import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import type { FormSubmission, ApprovalPayload } from '@shared/types';
import { formatDisplayDateTime } from '@shared/dateUtils';
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
    const transporter = await this.buildTransporter();
    try {
      await transporter.sendMail({ from: this.cfg.user, ...opts });
    } catch (err) {
      logger.error('[MailService] Send failed:', err);
      throw new Error(`Email delivery failed: ${(err as Error).message}`);
    }
  }

  private async buildTransporter(): Promise<nodemailer.Transporter> {
    const oauth2 = new google.auth.OAuth2(this.cfg.clientId, this.cfg.clientSecret);
    oauth2.setCredentials({ refresh_token: this.cfg.refreshToken });
    const { token } = await oauth2.getAccessToken();
    if (!token) throw new Error('Failed to obtain Gmail access token.');

    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: this.cfg.user,
        clientId: this.cfg.clientId,
        clientSecret: this.cfg.clientSecret,
        refreshToken: this.cfg.refreshToken,
        accessToken: token,
      },
    } as nodemailer.TransportOptions);
  }
}
