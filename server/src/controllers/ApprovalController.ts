import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import type { CalendarService } from '../services/calendar/CalendarService';
import type { MailService } from '../services/mail/MailService';
import type { SheetsService } from '../services/sheets/SheetsService';
import { AppointmentModel, type IAppointmentDoc } from '../models/Appointment';
import { logger } from '../utils/logger';

interface Deps {
  calendarService:           CalendarService;
  mailService:               MailService;
  sheetsService?:            SheetsService;
  /** n8n randevu-onayla webhook base URL */
  n8nApprovalWebhookUrl:     string | undefined;
  /** n8n randevu-iptal webhook URL — called when user cancels */
  n8nCancellationWebhookUrl: string | undefined;
  /** Server base URL — used to construct cancelUrl */
  appBaseUrl:                string;
  /** Frontend base URL — used for post-action redirects */
  clientUrl:                 string;
}

/**
 * Handles admin approve/reject decisions and appointment cancellation.
 *
 * Routes:
 *   GET  /details/:token    — frontend fetches appointment details
 *   POST /confirm           — frontend approval page submits decision
 *   POST /decline           — frontend approval page submits decision
 *   GET  /approve/:id       — n8n calls this after processing (creates calendar + updates DB)
 *   GET  /reject/:id        — n8n calls this after processing (updates DB)
 *   GET  /a/:id             — short approve link in admin email → fires n8n → returns HTML
 *   GET  /r/:id             — short reject  link in admin email → fires n8n → returns HTML
 *   GET  /cancel/:token     — user cancellation link → updates DB → returns HTML
 */
export class ApprovalController {
  constructor(private readonly deps: Deps) {}

  // ---------------------------------------------------------------------------
  // Frontend approval page
  // ---------------------------------------------------------------------------

  getDetails = async (req: Request, res: Response): Promise<void> => {
    const token = req.params.token?.trim();
    if (!token) {
      res.status(400).json({ error: 'token is required.' });
      return;
    }

    const doc = await AppointmentModel.findOne({ approvalToken: token });
    if (!doc) {
      res.status(404).json({ error: 'Approval link is invalid or has expired.' });
      return;
    }

    res.status(200).json({
      name:             doc.name,
      email:            doc.email,
      dateTime:         doc.dateTime,
      enquiry:          doc.enquiry,
      bookingReference: doc.bookingReference,
      status:           doc.status,
    });
  };

  confirm = async (req: Request, res: Response): Promise<void> => {
    const token = req.body?.token as string | undefined;
    const doc   = await this.resolveByToken(token, res);
    if (!doc) return;

    if (doc.status !== 'pending') {
      res.status(409).json({ error: `This request has already been ${doc.status}.` });
      return;
    }

    await this.doApprove(doc, res);
  };

  decline = async (req: Request, res: Response): Promise<void> => {
    const token = req.body?.token as string | undefined;
    const doc   = await this.resolveByToken(token, res);
    if (!doc) return;

    if (doc.status !== 'pending') {
      res.status(409).json({ error: `This request has already been ${doc.status}.` });
      return;
    }

    await this.doReject(doc, res);
  };

  // ---------------------------------------------------------------------------
  // n8n callback endpoints — called by n8n HTTP Request nodes after processing
  // ---------------------------------------------------------------------------

  approveById = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    logger.info(`[ApprovalController] approveById called — id=${id}`);

    const doc = await this.resolveById(id, res);
    if (!doc) return;

    if (doc.status !== 'pending') {
      logger.warn(`[ApprovalController] approveById — already ${doc.status} (ref=${doc.bookingReference})`);
      res.status(409).json({ error: `This request has already been ${doc.status}.` });
      return;
    }

    // When called from n8n, the calendar event was already created by the "Takvime Ekle" node.
    // n8n passes the event ID as a query param so we skip duplicate creation.
    const n8nCalendarEventId = (req.query.calendarEventId as string | undefined)?.trim();
    if (n8nCalendarEventId) {
      doc.status          = 'approved';
      doc.calendarEventId = n8nCalendarEventId;
      await doc.save();
      logger.info(`[ApprovalController] Approved (n8n calendar) ${doc.bookingReference} — event ${n8nCalendarEventId}`);
      res.status(200).json({ status: 'approved', calendarEventId: n8nCalendarEventId });
      return;
    }

    // Fallback: called directly (e.g. frontend approval page) — create calendar event ourselves
    await this.doApprove(doc, res);
  };

  rejectById = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    logger.info(`[ApprovalController] rejectById called — id=${id}`);

    const doc = await this.resolveById(id, res);
    if (!doc) return;

    if (doc.status !== 'pending') {
      logger.warn(`[ApprovalController] rejectById — already ${doc.status} (ref=${doc.bookingReference})`);
      res.status(409).json({ error: `This request has already been ${doc.status}.` });
      return;
    }

    await this.doReject(doc, res);
  };

  // ---------------------------------------------------------------------------
  // Short URL handlers — embedded in admin email buttons
  // Admin clicks → server fires n8n → server returns success HTML immediately
  // ---------------------------------------------------------------------------

  shortApprove = async (req: Request, res: Response): Promise<void> => {
    const doc = await this.resolveById(req.params.id, res);
    if (!doc) return;

    if (doc.status !== 'pending') {
      res.redirect(`${this.deps.clientUrl}?result=already-${doc.status}`);
      return;
    }

    const docId     = (doc._id as { toString(): string }).toString();
    const cancelUrl = `${this.deps.appBaseUrl}/api/approval/cancel/${doc.cancellationToken}`;

    // Always process directly — calendar + DB + confirmation email
    // n8n is only notified afterwards for optional Sheets sync (fire-and-forget)
    try {
      const appointment = await this.deps.calendarService.createAppointment({
        name:            doc.name,
        email:           doc.email,
        startTime:       doc.dateTime,
        enquirySummary:  doc.enquirySummary,
        originalEnquiry: doc.enquiry,
      });
      doc.status          = 'approved';
      doc.calendarEventId = appointment.id;
      await doc.save();
      logger.info(`[ApprovalController] Approved ${doc.bookingReference} — event ${appointment.id}`);

      // Confirmation email to user (pure HTML, no ICS)
      this.deps.mailService.sendApprovalConfirmation({
        name:          doc.name,
        email:         doc.email,
        dateTime:      doc.dateTime,
        cancelUrl,
        conferenceLink: appointment.conferenceLink,
      }).catch((err) => logger.error('[ApprovalController] Confirmation email failed:', err));

      // Optional: update Sheets status
      this.deps.sheetsService?.updateRow(docId, {
        status:          'approved',
        calendarEventId: appointment.id,
      }).catch((err) => logger.warn('[ApprovalController] Sheets update failed (non-fatal):', err));

    } catch (err) {
      logger.error('[ApprovalController] shortApprove processing failed:', err);
      res.redirect(`${this.deps.clientUrl}?result=error`);
      return;
    }

    // Optional: notify n8n for additional Sheets/audit trail (fire-and-forget)
    if (this.deps.n8nApprovalWebhookUrl && doc.status === 'approved') {
      const timezone = process.env.TIMEZONE ?? 'Europe/Istanbul';
      const dateTimeDisplay = new Intl.DateTimeFormat('tr-TR', {
        day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone,
      }).format(new Date(doc.dateTime));
      const n8nBase = this.deps.n8nApprovalWebhookUrl.replace(/\/$/, '');
      const params  = new URLSearchParams({
        action: 'approve', id: docId, name: doc.name, email: doc.email,
        dateTime: doc.dateTime, dateTimeDisplay, cancelUrl,
        calendarEventId: doc.calendarEventId ?? '',
      });
      fetch(`${n8nBase}?${params.toString()}`, { method: 'GET' })
        .catch((err) => logger.warn('[ApprovalController] n8n notify failed (non-fatal):', err));
    }

    res.redirect(`${this.deps.clientUrl}?result=approved`);
  };

  shortReject = async (req: Request, res: Response): Promise<void> => {
    const doc = await this.resolveById(req.params.id, res);
    if (!doc) return;

    if (doc.status !== 'pending') {
      res.redirect(`${this.deps.clientUrl}?result=already-${doc.status}`);
      return;
    }

    const docId = (doc._id as { toString(): string }).toString();

    // Always process directly — rejection email + DB update
    try {
      await this.deps.mailService.sendRejection({
        name: doc.name, email: doc.email, dateTime: doc.dateTime,
      });
      doc.status = 'rejected';
      await doc.save();
      logger.info(`[ApprovalController] Rejected ${doc.bookingReference}`);

      // Optional: update Sheets status
      this.deps.sheetsService?.updateRow(docId, { status: 'rejected' })
        .catch((err) => logger.warn('[ApprovalController] Sheets update failed (non-fatal):', err));
    } catch (err) {
      logger.error('[ApprovalController] shortReject processing failed:', err);
      res.redirect(`${this.deps.clientUrl}?result=error`);
      return;
    }

    // Optional: notify n8n (fire-and-forget)
    if (this.deps.n8nApprovalWebhookUrl && doc.status === 'rejected') {
      const timezone = process.env.TIMEZONE ?? 'Europe/Istanbul';
      const dateTimeDisplay = new Intl.DateTimeFormat('tr-TR', {
        day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone,
      }).format(new Date(doc.dateTime));
      const n8nBase = this.deps.n8nApprovalWebhookUrl.replace(/\/$/, '');
      const params  = new URLSearchParams({
        action: 'reject', id: docId, name: doc.name, email: doc.email,
        dateTime: doc.dateTime, dateTimeDisplay,
      });
      fetch(`${n8nBase}?${params.toString()}`, { method: 'GET' })
        .catch((err) => logger.warn('[ApprovalController] n8n notify failed (non-fatal):', err));
    }

    res.redirect(`${this.deps.clientUrl}?result=rejected`);
  };

  // ---------------------------------------------------------------------------
  // Cancellation — user clicks cancel link in confirmation email
  // ---------------------------------------------------------------------------

  cancelAppointment = async (req: Request, res: Response): Promise<void> => {
    const token = req.params.token?.trim();
    if (!token) {
      res.redirect(`${this.deps.clientUrl}?result=cancel-invalid`);
      return;
    }

    const doc = await AppointmentModel.findOne({ cancellationToken: token });
    if (!doc) {
      res.redirect(`${this.deps.clientUrl}?result=cancel-invalid`);
      return;
    }

    if (doc.status === 'cancelled') {
      res.redirect(`${this.deps.clientUrl}?result=already-cancelled`);
      return;
    }

    // Mark cancelled in DB first so the slot is freed immediately
    doc.status = 'cancelled';
    await doc.save();
    logger.info(`[ApprovalController] Cancelled: ${doc.bookingReference}`);

    // Redirect immediately; remaining cleanup is fire-and-forget
    res.redirect(`${this.deps.clientUrl}?result=cancelled`);

    // ── Async cleanup ─────────────────────────────────────────────────────────
    const cleanup = async () => {
      // 1. Delete Google Calendar event (only if appointment was approved and event exists)
      if (doc.calendarEventId) {
        try {
          await this.deps.calendarService.deleteEvent(doc.calendarEventId);
        } catch (err) {
          logger.error('[ApprovalController] Calendar delete failed (non-fatal):', err);
        }
      }

      // 2. Send cancellation emails to user and admin
      const emailParams = {
        name:             doc.name,
        email:            doc.email,
        dateTime:         doc.dateTime,
        bookingReference: doc.bookingReference,
      };
      await Promise.allSettled([
        this.deps.mailService.sendCancellationToUser(emailParams),
        this.deps.mailService.sendCancellationToAdmin(emailParams),
      ]);

      // 3. Update Sheets directly (awaited so it completes before cleanup exits)
      try {
        await this.deps.sheetsService?.updateRow(
          (doc._id as { toString(): string }).toString(),
          { status: 'cancelled' },
        );
      } catch (err) {
        logger.warn('[ApprovalController] Sheets cancel update failed (non-fatal):', err);
      }

      // 4. Notify n8n (optional audit trail)
      if (this.deps.n8nCancellationWebhookUrl) {
        const params = new URLSearchParams({
          id:               (doc._id as { toString(): string }).toString(),
          bookingReference: doc.bookingReference,
          status:           'cancelled',
        });
        fetch(`${this.deps.n8nCancellationWebhookUrl.replace(/\/$/, '')}?${params.toString()}`, { method: 'GET' })
          .catch((err) => logger.error('[ApprovalController] n8n cancel notify failed:', err));
      }
    };

    cleanup().catch((err) => logger.error('[ApprovalController] Cancel cleanup error:', err));
  };

  // ---------------------------------------------------------------------------
  // Shared action implementations (called by confirm/decline & approveById/rejectById)
  // ---------------------------------------------------------------------------

  private async doApprove(doc: IAppointmentDoc, res: Response): Promise<void> {
    try {
      const appointment = await this.deps.calendarService.createAppointment({
        name:            doc.name,
        email:           doc.email,
        startTime:       doc.dateTime,
        enquirySummary:  doc.enquirySummary,
        originalEnquiry: doc.enquiry,
      });

      doc.status          = 'approved';
      doc.calendarEventId = appointment.id;
      await doc.save();

      const docId     = (doc._id as { toString(): string }).toString();
      const cancelUrl = `${this.deps.appBaseUrl}/api/approval/cancel/${doc.cancellationToken}`;

      logger.info(`[ApprovalController] Approved ${doc.bookingReference} — event ${appointment.id}`);

      // Confirmation email (pure HTML, no ICS)
      this.deps.mailService.sendApprovalConfirmation({
        name:          doc.name,
        email:         doc.email,
        dateTime:      doc.dateTime,
        cancelUrl,
        conferenceLink: appointment.conferenceLink,
      }).catch((err) => logger.error('[ApprovalController] Confirmation email failed:', err));

      // Optional Sheets update
      this.deps.sheetsService?.updateRow(docId, {
        status:          'approved',
        calendarEventId: appointment.id,
      }).catch((err) => logger.warn('[ApprovalController] Sheets update failed (non-fatal):', err));

      res.status(200).json({
        status: 'approved',
        appointment: {
          id:             appointment.id,
          startTime:      appointment.startTime,
          endTime:        appointment.endTime,
          conferenceLink: appointment.conferenceLink,
        },
      });
    } catch (err) {
      logger.error('[ApprovalController] Approve failed:', err);
      res.status(502).json({ error: 'Failed to create calendar event. Please try again.' });
    }
  }

  private async doReject(doc: IAppointmentDoc, res: Response): Promise<void> {
    try {
      await this.deps.mailService.sendRejection({
        name:     doc.name,
        email:    doc.email,
        dateTime: doc.dateTime,
      });

      doc.status = 'rejected';
      await doc.save();

      logger.info(`[ApprovalController] Declined ${doc.bookingReference}`);
      res.status(200).json({ status: 'rejected' });
    } catch (err) {
      logger.error('[ApprovalController] Reject failed:', err);
      res.status(502).json({ error: 'Failed to send rejection email. Please try again.' });
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers — DB resolution
  // ---------------------------------------------------------------------------

  private async resolveByToken(token: string | undefined, res: Response) {
    if (!token?.trim()) {
      res.status(400).json({ error: 'token is required.' });
      return null;
    }
    const doc = await AppointmentModel.findOne({ approvalToken: token });
    if (!doc) {
      res.status(404).json({ error: 'Approval link is invalid or has expired.' });
      return null;
    }
    return doc;
  }

  private async resolveById(id: string | undefined, res: Response) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid appointment ID.' });
      return null;
    }
    const doc = await AppointmentModel.findById(id);
    if (!doc) {
      res.status(404).json({ error: 'Appointment not found.' });
      return null;
    }
    return doc;
  }

}
