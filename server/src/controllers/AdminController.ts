import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import type { CalendarService } from '../services/calendar/CalendarService';
import type { MailService } from '../services/mail/MailService';
import type { SheetsService } from '../services/sheets/SheetsService';
import type { AiService } from '../services/ai/AiService';
import { AppointmentModel } from '../models/Appointment';
import { logger } from '../utils/logger';
import { signAdminToken } from '../middleware/auth.middleware';

interface Deps {
  aiService:                 AiService;
  calendarService:           CalendarService;
  mailService:               MailService;
  sheetsService?:            SheetsService;
  n8nApprovalWebhookUrl:     string | undefined;
  n8nCancellationWebhookUrl: string | undefined;
  appBaseUrl:                string;
  adminSecretKey:            string;
}

export class AdminController {
  constructor(private readonly deps: Deps) {}

  // ---------------------------------------------------------------------------
  // Auth — POST /api/admin/login
  // ---------------------------------------------------------------------------

  /**
   * Validates the admin password and returns a short-lived JWT.
   * The client stores the JWT in sessionStorage and sends it as Bearer token.
   * Plain-text password never leaves this handler — no `x-admin-key` pattern.
   */
  login = (req: Request, res: Response): void => {
    const { password } = req.body as { password?: string };
    if (!password?.trim()) {
      res.status(400).json({ error: 'Şifre boş olamaz.' });
      return;
    }
    if (password.trim() !== this.deps.adminSecretKey) {
      // Generic message — don't reveal whether the key exists
      res.status(401).json({ error: 'Şifre hatalı. Lütfen tekrar deneyin.' });
      return;
    }
    const token = signAdminToken();
    logger.info('[AdminController] Admin login successful');
    res.status(200).json({ token });
  };

  // ---------------------------------------------------------------------------
  // Appointments
  // ---------------------------------------------------------------------------

  getAppointments = async (_req: Request, res: Response): Promise<void> => {
    const docs = await AppointmentModel.find({}).sort({ submittedAt: -1 }).lean();
    res.status(200).json({ appointments: docs });
  };

  getStats = async (_req: Request, res: Response): Promise<void> => {
    const [total, approved, pending, rejected, cancelled] = await Promise.all([
      AppointmentModel.countDocuments(),
      AppointmentModel.countDocuments({ status: 'approved' }),
      AppointmentModel.countDocuments({ status: 'pending' }),
      AppointmentModel.countDocuments({ status: 'rejected' }),
      AppointmentModel.countDocuments({ status: 'cancelled' }),
    ]);
    res.status(200).json({ total, approved, pending, rejected, cancelled });
  };

  // ---------------------------------------------------------------------------
  // AI analytics
  // ---------------------------------------------------------------------------

  analyzeData = async (req: Request, res: Response): Promise<void> => {
    const { question } = req.body as { question?: string };
    if (!question?.trim()) {
      res.status(400).json({ error: 'Soru boş olamaz.' });
      return;
    }

    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [totalAll, totalLast7, statusDist, triageStats, hourGroups, recentDocs] = await Promise.all([
        AppointmentModel.countDocuments(),
        AppointmentModel.countDocuments({ submittedAt: { $gte: sevenDaysAgo } }),
        AppointmentModel.aggregate<{ _id: string; count: number }>([
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        AppointmentModel.aggregate<{ _id: string; count: number }>([
          { $match: { 'triage.urgency': { $exists: true } } },
          { $group: { _id: '$triage.urgency', count: { $sum: 1 } } },
        ]),
        AppointmentModel.aggregate<{ _id: number; count: number }>([
          { $match: { status: { $in: ['pending', 'approved', 'completed'] } } },
          { $addFields: { hour: { $hour: { $dateFromString: { dateString: '$dateTime' } } } } },
          { $group: { _id: '$hour', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 5 },
        ]),
        AppointmentModel.find({})
          .sort({ submittedAt: -1 })
          .limit(100)
          .select('name email dateTime status bookingReference triage.adminSummary enquirySummary')
          .lean(),
      ]);

      const context = JSON.stringify({
        toplamRandevu:    totalAll,
        son7GundeGelen:   totalLast7,
        durumDagilimi:    Object.fromEntries(statusDist.map((s) => [s._id, s.count])),
        aciliyetDagilimi: Object.fromEntries(triageStats.map((t) => [t._id, t.count])),
        enYogunSaatler:   hourGroups.map((h) => ({ saat: `${h._id}:00`, randevu: h.count })),
        sonRandevular:    recentDocs.map((a) => ({
          isim:     a.name,
          email:    a.email,
          tarih:    a.dateTime,
          durum:    a.status,
          referans: a.bookingReference,
          ozet:     a.enquirySummary || '',
        })),
      }, null, 2);

      const answer = await this.deps.aiService.analyzeAppointments(context, question.trim());
      res.status(200).json({ answer });
    } catch (err) {
      logger.error('[AdminController] analyzeData failed:', err);
      res.status(500).json({ error: 'Analiz sırasında bir hata oluştu.' });
    }
  };

  // ---------------------------------------------------------------------------
  // Status mutations
  // ---------------------------------------------------------------------------

  approveAppointment = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid appointment ID.' }); return;
    }
    const doc = await AppointmentModel.findById(id);
    if (!doc) { res.status(404).json({ error: 'Appointment not found.' }); return; }
    if (doc.status !== 'pending') { res.status(409).json({ error: `Already ${doc.status}.` }); return; }

    try {
      const appointment = await this.deps.calendarService.createAppointment({
        name: doc.name, email: doc.email, startTime: doc.dateTime,
        enquirySummary: doc.enquirySummary, originalEnquiry: doc.enquiry,
      });

      doc.status          = 'approved';
      doc.calendarEventId = appointment.id;
      await doc.save();

      const docId     = (doc._id as { toString(): string }).toString();
      const cancelUrl = `${this.deps.appBaseUrl}/api/approval/cancel/${doc.cancellationToken}`;

      this.deps.mailService.sendApprovalConfirmation({
        name: doc.name, email: doc.email, dateTime: doc.dateTime,
        cancelUrl, conferenceLink: appointment.conferenceLink,
      }).catch((err) => logger.error('[AdminController] Confirmation email failed:', err));

      this.deps.sheetsService?.updateRow(docId, {
        status: 'approved', calendarEventId: appointment.id ?? '',
      }).catch((err) => logger.warn('[AdminController] Sheets approve failed (non-fatal):', err));

      this.notifyN8nApproval(docId, doc.name, doc.email, doc.dateTime, cancelUrl, appointment.id ?? '');

      logger.info(`[AdminController] Approved ${doc.bookingReference}`);
      res.status(200).json({ status: 'approved', calendarEventId: appointment.id });
    } catch (err) {
      logger.error('[AdminController] Approve failed:', err);
      res.status(502).json({ error: 'Takvim etkinliği oluşturulamadı. Lütfen Google Calendar bağlantısını kontrol edin.' });
    }
  };

  rejectAppointment = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid appointment ID.' }); return;
    }
    const doc = await AppointmentModel.findById(id);
    if (!doc) { res.status(404).json({ error: 'Appointment not found.' }); return; }
    if (doc.status !== 'pending') { res.status(409).json({ error: `Already ${doc.status}.` }); return; }

    try {
      await this.deps.mailService.sendRejection({
        name: doc.name, email: doc.email, dateTime: doc.dateTime,
      });

      doc.status = 'rejected';
      await doc.save();

      const docId = (doc._id as { toString(): string }).toString();
      this.deps.sheetsService?.updateRow(docId, { status: 'rejected' })
        .catch((err) => logger.warn('[AdminController] Sheets reject failed (non-fatal):', err));

      this.notifyN8nApproval(docId, doc.name, doc.email, doc.dateTime, '', '', 'reject');

      logger.info(`[AdminController] Rejected ${doc.bookingReference}`);
      res.status(200).json({ status: 'rejected' });
    } catch (err) {
      logger.error('[AdminController] Reject failed:', err);
      res.status(502).json({ error: 'Ret emaili gönderilemedi. Lütfen Gmail bağlantısını kontrol edin.' });
    }
  };

  completeAppointment = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid appointment ID.' }); return;
    }
    const doc = await AppointmentModel.findById(id);
    if (!doc) { res.status(404).json({ error: 'Appointment not found.' }); return; }
    if (doc.status === 'completed') { res.status(409).json({ error: 'Already completed.' }); return; }

    doc.status = 'completed';
    await doc.save();
    logger.info(`[AdminController] Completed ${doc.bookingReference}`);
    res.status(200).json({ status: 'completed' });
  };

  cancelAppointment = async (req: Request, res: Response): Promise<void> => {
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

    // Fire-and-forget cleanup
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
          id: (doc._id as { toString(): string }).toString(),
          bookingReference: doc.bookingReference,
          status: 'cancelled',
        });
        fetch(`${this.deps.n8nCancellationWebhookUrl.replace(/\/$/, '')}?${params.toString()}`, { method: 'GET' })
          .catch((err) => logger.error('[AdminController] n8n cancel webhook failed:', err));
      }
    })().catch((err) => logger.error('[AdminController] Cancel cleanup error:', err));
  };

  bulkAction = async (req: Request, res: Response): Promise<void> => {
    const { ids, action } = req.body as { ids?: unknown; action?: unknown };
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'ids array is required.' }); return;
    }
    if (action !== 'cancel' && action !== 'complete' && action !== 'delete') {
      res.status(400).json({ error: 'action must be cancel, complete or delete.' }); return;
    }

    // Hard delete: only archive statuses allowed
    if (action === 'delete') {
      const ARCHIVE_STATUSES = ['rejected', 'cancelled', 'completed'];
      const validIds = (ids as string[]).filter((id) => mongoose.Types.ObjectId.isValid(id));
      const docs = await AppointmentModel.find({
        _id:    { $in: validIds },
        status: { $in: ARCHIVE_STATUSES },
      }).lean();
      const deletableIds = docs.map((d) => (d._id as { toString(): string }).toString());
      const skipped = validIds.length - deletableIds.length;
      if (deletableIds.length > 0) {
        await AppointmentModel.deleteMany({ _id: { $in: deletableIds } });
      }
      logger.info(`[AdminController] bulk delete: ${deletableIds.length} deleted, ${skipped} skipped (wrong status)`);
      res.status(200).json({ processed: deletableIds.length, failed: skipped, results: [] });
      return;
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

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private notifyN8nApproval(
    id: string, name: string, email: string, dateTime: string,
    cancelUrl: string, calendarEventId: string, action = 'approve',
  ): void {
    if (!this.deps.n8nApprovalWebhookUrl) return;
    const tz = process.env.TIMEZONE ?? 'Europe/Istanbul';
    const dateTimeDisplay = new Intl.DateTimeFormat('tr-TR', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz,
    }).format(new Date(dateTime));
    const params = new URLSearchParams({ action, id, name, email, dateTime, dateTimeDisplay, cancelUrl, calendarEventId });
    const base   = this.deps.n8nApprovalWebhookUrl.replace(/\/$/, '');
    fetch(`${base}?${params.toString()}`, { method: 'GET' })
      .catch((err) => logger.warn('[AdminController] n8n notify failed (non-fatal):', err));
  }
}
