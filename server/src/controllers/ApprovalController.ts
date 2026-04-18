import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import type { CalendarService } from '../services/calendar/CalendarService';
import type { MailService } from '../services/mail/MailService';
import { AppointmentModel, type IAppointmentDoc } from '../models/Appointment';
import { logger } from '../utils/logger';

interface Deps {
  calendarService:           CalendarService;
  mailService:               MailService;
  /** n8n randevu-onayla webhook base URL */
  n8nApprovalWebhookUrl:     string | undefined;
  /** n8n randevu-iptal webhook URL — called when user cancels */
  n8nCancellationWebhookUrl: string | undefined;
  /** Server base URL — used to construct cancelUrl */
  appBaseUrl:                string;
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
      res.status(200).type('html').send(this.buildAlreadyProcessedHtml(doc.status));
      return;
    }

    const docId      = (doc._id as { toString(): string }).toString();
    const cancelUrl  = `${this.deps.appBaseUrl}/api/approval/cancel/${doc.cancellationToken}`;
    const timezone   = process.env.TIMEZONE ?? 'Europe/Istanbul';
    const dateTimeDisplay = new Intl.DateTimeFormat('tr-TR', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
      timeZone: timezone,
    }).format(new Date(doc.dateTime));

    if (this.deps.n8nApprovalWebhookUrl) {
      const n8nBase = this.deps.n8nApprovalWebhookUrl.replace(/\/$/, '');
      const params  = new URLSearchParams({
        action:          'approve',
        id:              docId,
        name:            doc.name,
        email:           doc.email,
        dateTime:        doc.dateTime,
        dateTimeDisplay,
        cancelUrl,
      });
      // Fire-and-forget — admin gets success page immediately; n8n processes async
      fetch(`${n8nBase}?${params.toString()}`, { method: 'GET' })
        .catch((err) => logger.error('[ApprovalController] n8n approve notify failed:', err));
    } else {
      // Fallback: no n8n — process directly
      try {
        await this.deps.calendarService.createAppointment({
          name:            doc.name,
          email:           doc.email,
          startTime:       doc.dateTime,
          enquirySummary:  doc.enquirySummary,
          originalEnquiry: doc.enquiry,
        });
        doc.status = 'approved';
        await doc.save();
        logger.info(`[ApprovalController] Direct approve (no n8n): ${doc.bookingReference}`);
      } catch (err) {
        logger.error('[ApprovalController] Direct approve failed:', err);
      }
    }

    res.status(200).type('html').send(this.buildApproveSuccessHtml());
  };

  shortReject = async (req: Request, res: Response): Promise<void> => {
    const doc = await this.resolveById(req.params.id, res);
    if (!doc) return;

    if (doc.status !== 'pending') {
      res.status(200).type('html').send(this.buildAlreadyProcessedHtml(doc.status));
      return;
    }

    const docId      = (doc._id as { toString(): string }).toString();
    const timezone   = process.env.TIMEZONE ?? 'Europe/Istanbul';
    const dateTimeDisplay = new Intl.DateTimeFormat('tr-TR', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
      timeZone: timezone,
    }).format(new Date(doc.dateTime));

    if (this.deps.n8nApprovalWebhookUrl) {
      const n8nBase = this.deps.n8nApprovalWebhookUrl.replace(/\/$/, '');
      const params  = new URLSearchParams({
        action:          'reject',
        id:              docId,
        name:            doc.name,
        email:           doc.email,
        dateTime:        doc.dateTime,
        dateTimeDisplay,
      });
      fetch(`${n8nBase}?${params.toString()}`, { method: 'GET' })
        .catch((err) => logger.error('[ApprovalController] n8n reject notify failed:', err));
    } else {
      // Fallback: send rejection email directly
      try {
        await this.deps.mailService.sendRejection({
          name:     doc.name,
          email:    doc.email,
          dateTime: doc.dateTime,
        });
        doc.status = 'rejected';
        await doc.save();
        logger.info(`[ApprovalController] Direct reject (no n8n): ${doc.bookingReference}`);
      } catch (err) {
        logger.error('[ApprovalController] Direct reject failed:', err);
      }
    }

    res.status(200).type('html').send(this.buildRejectSuccessHtml());
  };

  // ---------------------------------------------------------------------------
  // Cancellation — user clicks cancel link in confirmation email
  // ---------------------------------------------------------------------------

  cancelAppointment = async (req: Request, res: Response): Promise<void> => {
    const token = req.params.token?.trim();
    if (!token) {
      res.status(400).type('html').send('<p>Geçersiz iptal bağlantısı.</p>');
      return;
    }

    const doc = await AppointmentModel.findOne({ cancellationToken: token });
    if (!doc) {
      res.status(404).type('html').send(this.buildCancelInvalidHtml());
      return;
    }

    if (doc.status === 'cancelled') {
      res.status(200).type('html').send(this.buildAlreadyCancelledHtml());
      return;
    }

    // Mark cancelled in DB first so the slot is freed immediately
    doc.status = 'cancelled';
    await doc.save();
    logger.info(`[ApprovalController] Cancelled: ${doc.bookingReference}`);

    // Return success page right away; remaining cleanup is fire-and-forget
    res.status(200).type('html').send(this.buildCancelSuccessHtml());

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

      // 3. Notify n8n to update Google Sheets status
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

      logger.info(`[ApprovalController] Approved ${doc.bookingReference} — event ${appointment.id}`);

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

  // ---------------------------------------------------------------------------
  // HTML response builders
  // ---------------------------------------------------------------------------

  private buildApproveSuccessHtml(): string {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Randevu Onaylandı</title>
<style>body{font-family:Inter,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f0fdf4}
.card{background:white;border-radius:16px;padding:48px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.1);max-width:480px}
h1{color:#16a34a;margin:0 0 12px;font-size:28px}p{color:#374151;font-size:16px;line-height:1.6}</style>
</head><body><div class="card"><div style="font-size:64px;margin-bottom:16px">✅</div>
<h1>Randevu Onaylandı</h1>
<p>İşlem alındı. Kullanıcıya onay e-postası gönderilecek ve takvim etkinliği oluşturulacak.</p>
</div></body></html>`;
  }

  private buildRejectSuccessHtml(): string {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Randevu Reddedildi</title>
<style>body{font-family:Inter,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fef2f2}
.card{background:white;border-radius:16px;padding:48px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.1);max-width:480px}
h1{color:#dc2626;margin:0 0 12px;font-size:28px}p{color:#374151;font-size:16px;line-height:1.6}</style>
</head><body><div class="card"><div style="font-size:64px;margin-bottom:16px">❌</div>
<h1>Randevu Reddedildi</h1>
<p>İşlem alındı. Kullanıcıya bilgilendirme e-postası gönderilecek.</p>
</div></body></html>`;
  }

  private buildAlreadyProcessedHtml(status: string): string {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Zaten İşlendi</title>
<style>body{font-family:Inter,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc}
.card{background:white;border-radius:16px;padding:48px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.1);max-width:480px}
h1{color:#64748b;margin:0 0 12px;font-size:24px}p{color:#374151;font-size:15px;line-height:1.6}</style>
</head><body><div class="card"><div style="font-size:64px;margin-bottom:16px">ℹ️</div>
<h1>Zaten İşlendi</h1>
<p>Bu randevu daha önce <strong>${status}</strong> durumuna getirilmiş.</p>
</div></body></html>`;
  }

  private buildCancelSuccessHtml(): string {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Randevu İptal Edildi</title>
<style>body{font-family:Inter,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fefce8}
.card{background:white;border-radius:16px;padding:48px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.1);max-width:480px}
h1{color:#ca8a04;margin:0 0 12px;font-size:28px}p{color:#374151;font-size:16px;line-height:1.6}</style>
</head><body><div class="card"><div style="font-size:64px;margin-bottom:16px">🚫</div>
<h1>Randevu İptal Edildi</h1>
<p>Randevunuz başarıyla iptal edildi. Yeni bir randevu almak isterseniz formu tekrar doldurabilirsiniz.</p>
</div></body></html>`;
  }

  private buildAlreadyCancelledHtml(): string {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Zaten İptal Edildi</title>
<style>body{font-family:Inter,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc}
.card{background:white;border-radius:16px;padding:48px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.1);max-width:480px}
h1{color:#64748b;margin:0 0 12px;font-size:24px}p{color:#374151;font-size:15px;line-height:1.6}</style>
</head><body><div class="card"><div style="font-size:64px;margin-bottom:16px">ℹ️</div>
<h1>Zaten İptal Edildi</h1>
<p>Bu randevu daha önce iptal edilmiş.</p>
</div></body></html>`;
  }

  private buildCancelInvalidHtml(): string {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Geçersiz Bağlantı</title>
<style>body{font-family:Inter,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc}
.card{background:white;border-radius:16px;padding:48px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.1);max-width:480px}
h1{color:#dc2626;margin:0 0 12px;font-size:24px}p{color:#374151;font-size:15px;line-height:1.6}</style>
</head><body><div class="card"><div style="font-size:64px;margin-bottom:16px">⚠️</div>
<h1>Geçersiz Bağlantı</h1>
<p>İptal bağlantısı geçersiz veya süresi dolmuş.</p>
</div></body></html>`;
  }
}
