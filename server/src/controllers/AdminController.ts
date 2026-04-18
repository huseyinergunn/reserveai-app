import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import type { CalendarService } from '../services/calendar/CalendarService';
import type { MailService } from '../services/mail/MailService';
import { AppointmentModel } from '../models/Appointment';
import { logger } from '../utils/logger';

interface Deps {
  calendarService:           CalendarService;
  mailService:               MailService;
  n8nApprovalWebhookUrl:     string | undefined;
  n8nCancellationWebhookUrl: string | undefined;
  appBaseUrl:                string;
  adminSecretKey:            string;
}

export class AdminController {
  constructor(private readonly deps: Deps) {}

  private checkAuth(req: Request, res: Response): boolean {
    const key = req.headers['x-admin-key'];
    if (!key || key !== this.deps.adminSecretKey) {
      res.status(401).json({ error: 'Unauthorized.' });
      return false;
    }
    return true;
  }

  getAppointments = async (req: Request, res: Response): Promise<void> => {
    if (!this.checkAuth(req, res)) return;
    const docs = await AppointmentModel.find({}).sort({ submittedAt: -1 }).lean();
    res.status(200).json({ appointments: docs });
  };

  getStats = async (req: Request, res: Response): Promise<void> => {
    if (!this.checkAuth(req, res)) return;
    const [total, approved, pending, rejected, cancelled] = await Promise.all([
      AppointmentModel.countDocuments(),
      AppointmentModel.countDocuments({ status: 'approved' }),
      AppointmentModel.countDocuments({ status: 'pending' }),
      AppointmentModel.countDocuments({ status: 'rejected' }),
      AppointmentModel.countDocuments({ status: 'cancelled' }),
    ]);
    res.status(200).json({ total, approved, pending, rejected, cancelled });
  };

  approveAppointment = async (req: Request, res: Response): Promise<void> => {
    if (!this.checkAuth(req, res)) return;
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid appointment ID.' }); return;
    }
    const doc = await AppointmentModel.findById(id);
    if (!doc) { res.status(404).json({ error: 'Appointment not found.' }); return; }
    if (doc.status !== 'pending') { res.status(409).json({ error: `Already ${doc.status}.` }); return; }

    const timezone = process.env.TIMEZONE ?? 'Europe/Istanbul';
    const dateTimeDisplay = new Intl.DateTimeFormat('tr-TR', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone,
    }).format(new Date(doc.dateTime));

    if (this.deps.n8nApprovalWebhookUrl) {
      const docId     = (doc._id as { toString(): string }).toString();
      const cancelUrl = `${this.deps.appBaseUrl}/api/approval/cancel/${doc.cancellationToken}`;
      const n8nBase   = this.deps.n8nApprovalWebhookUrl.replace(/\/$/, '');
      const params    = new URLSearchParams({
        action: 'approve', id: docId, name: doc.name, email: doc.email,
        dateTime: doc.dateTime, dateTimeDisplay, cancelUrl,
      });
      fetch(`${n8nBase}?${params.toString()}`, { method: 'GET' })
        .catch((err) => logger.error('[AdminController] n8n approve webhook failed:', err));
      res.status(200).json({ status: 'processing' });
    } else {
      try {
        const appointment = await this.deps.calendarService.createAppointment({
          name: doc.name, email: doc.email, startTime: doc.dateTime,
          enquirySummary: doc.enquirySummary, originalEnquiry: doc.enquiry,
        });
        doc.status          = 'approved';
        doc.calendarEventId = appointment.id;
        await doc.save();
        logger.info(`[AdminController] Approved ${doc.bookingReference}`);
        res.status(200).json({ status: 'approved' });
      } catch (err) {
        logger.error('[AdminController] Direct approve failed:', err);
        res.status(502).json({ error: 'Failed to create calendar event.' });
      }
    }
  };

  rejectAppointment = async (req: Request, res: Response): Promise<void> => {
    if (!this.checkAuth(req, res)) return;
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid appointment ID.' }); return;
    }
    const doc = await AppointmentModel.findById(id);
    if (!doc) { res.status(404).json({ error: 'Appointment not found.' }); return; }
    if (doc.status !== 'pending') { res.status(409).json({ error: `Already ${doc.status}.` }); return; }

    const timezone = process.env.TIMEZONE ?? 'Europe/Istanbul';
    const dateTimeDisplay = new Intl.DateTimeFormat('tr-TR', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone,
    }).format(new Date(doc.dateTime));

    if (this.deps.n8nApprovalWebhookUrl) {
      const docId   = (doc._id as { toString(): string }).toString();
      const n8nBase = this.deps.n8nApprovalWebhookUrl.replace(/\/$/, '');
      const params  = new URLSearchParams({
        action: 'reject', id: docId, name: doc.name, email: doc.email,
        dateTime: doc.dateTime, dateTimeDisplay,
      });
      fetch(`${n8nBase}?${params.toString()}`, { method: 'GET' })
        .catch((err) => logger.error('[AdminController] n8n reject webhook failed:', err));
      res.status(200).json({ status: 'processing' });
    } else {
      try {
        await this.deps.mailService.sendRejection({ name: doc.name, email: doc.email, dateTime: doc.dateTime });
        doc.status = 'rejected';
        await doc.save();
        logger.info(`[AdminController] Rejected ${doc.bookingReference}`);
        res.status(200).json({ status: 'rejected' });
      } catch (err) {
        logger.error('[AdminController] Direct reject failed:', err);
        res.status(502).json({ error: 'Failed to send rejection email.' });
      }
    }
  };

  completeAppointment = async (req: Request, res: Response): Promise<void> => {
    if (!this.checkAuth(req, res)) return;
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid appointment ID.' }); return;
    }
    const doc = await AppointmentModel.findById(id);
    if (!doc) { res.status(404).json({ error: 'Appointment not found.' }); return; }
    if (doc.status === 'completed') { res.status(409).json({ error: 'Already completed.' }); return; }
    // @ts-expect-error — 'completed' extends the base union
    doc.status = 'completed';
    await doc.save();
    logger.info(`[AdminController] Completed ${doc.bookingReference}`);
    res.status(200).json({ status: 'completed' });
  };

  bulkAction = async (req: Request, res: Response): Promise<void> => {
    if (!this.checkAuth(req, res)) return;
    const { ids, action } = req.body as { ids?: unknown; action?: unknown };
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'ids array is required.' }); return;
    }
    if (action !== 'cancel' && action !== 'complete') {
      res.status(400).json({ error: 'action must be cancel or complete.' }); return;
    }
    const results: { id: string; ok: boolean; message?: string }[] = [];
    for (const id of ids as string[]) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        results.push({ id, ok: false, message: 'Invalid ID.' }); continue;
      }
      const doc = await AppointmentModel.findById(id);
      if (!doc) { results.push({ id, ok: false, message: 'Not found.' }); continue; }
      try {
        if (action === 'cancel') {
          if (doc.status === 'cancelled') { results.push({ id, ok: true }); continue; }
          const prevEventId = doc.calendarEventId;
          doc.status = 'cancelled';
          await doc.save();
          if (prevEventId) {
            this.deps.calendarService.deleteEvent(prevEventId)
              .catch((e) => logger.error('[AdminController] bulk cancel event delete failed:', e));
          }
        } else {
          // @ts-expect-error — 'completed' extends the base union
          doc.status = 'completed';
          await doc.save();
        }
        results.push({ id, ok: true });
      } catch (err) {
        logger.error(`[AdminController] bulk ${action} failed for ${id}:`, err);
        results.push({ id, ok: false, message: 'Internal error.' });
      }
    }
    const failed = results.filter((r) => !r.ok).length;
    res.status(200).json({ processed: results.length, failed, results });
  };

  cancelAppointment = async (req: Request, res: Response): Promise<void> => {
    if (!this.checkAuth(req, res)) return;
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid appointment ID.' }); return;
    }
    const doc = await AppointmentModel.findById(id);
    if (!doc) { res.status(404).json({ error: 'Appointment not found.' }); return; }
    if (doc.status === 'cancelled') { res.status(409).json({ error: 'Already cancelled.' }); return; }

    const prevCalendarEventId = doc.calendarEventId;
    doc.status = 'cancelled';
    await doc.save();
    logger.info(`[AdminController] Cancelled ${doc.bookingReference}`);
    res.status(200).json({ status: 'cancelled' });

    (async () => {
      if (prevCalendarEventId) {
        try { await this.deps.calendarService.deleteEvent(prevCalendarEventId); }
        catch (err) { logger.error('[AdminController] Calendar delete failed:', err); }
      }
      const emailParams = {
        name: doc.name, email: doc.email,
        dateTime: doc.dateTime, bookingReference: doc.bookingReference,
      };
      await Promise.allSettled([
        this.deps.mailService.sendCancellationToUser(emailParams),
        this.deps.mailService.sendCancellationToAdmin(emailParams),
      ]);
      if (this.deps.n8nCancellationWebhookUrl) {
        const params = new URLSearchParams({
          id:               (doc._id as { toString(): string }).toString(),
          bookingReference: doc.bookingReference,
          status:           'cancelled',
        });
        fetch(`${this.deps.n8nCancellationWebhookUrl.replace(/\/$/, '')}?${params.toString()}`, { method: 'GET' })
          .catch((err) => logger.error('[AdminController] n8n cancel webhook failed:', err));
      }
    })().catch((err) => logger.error('[AdminController] Cancel cleanup error:', err));
  };
}
