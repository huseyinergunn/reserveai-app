import crypto from 'crypto';
import type { Request, Response } from 'express';
import mongoose from 'mongoose';

const AI_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(Object.assign(new Error('AI_TIMEOUT'), { code: 'AI_TIMEOUT' })), ms),
    ),
  ]);
}
import { DateTime } from 'luxon';
import type { CalendarService } from '../services/calendar/CalendarService';
import type { MailService } from '../services/mail/MailService';
import type { SheetsService } from '../services/sheets/SheetsService';
import type { AiService } from '../services/ai/AiService';
import { AppointmentModel } from '../models/Appointment';
import { logger } from '../utils/logger';
import { signAdminToken, setAuthCookie, clearAuthCookie } from '../middleware/auth.middleware';

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

// ---------------------------------------------------------------------------
// Timing-safe string comparison — immune to timing attacks regardless of length
// ---------------------------------------------------------------------------

function safeStringEqual(a: string, b: string): boolean {
  const key     = crypto.randomBytes(32);
  const hmacA   = crypto.createHmac('sha256', key).update(a).digest();
  const hmacB   = crypto.createHmac('sha256', key).update(b).digest();
  return crypto.timingSafeEqual(hmacA, hmacB);
}

export class AdminController {
  constructor(private readonly deps: Deps) {}

  // ---------------------------------------------------------------------------
  // Auth — POST /api/admin/login
  // ---------------------------------------------------------------------------

  login = (req: Request, res: Response): void => {
    const { password } = req.body as { password?: string };
    if (!password?.trim()) {
      res.status(400).json({ error: 'Şifre boş olamaz.' });
      return;
    }
    if (!safeStringEqual(password.trim(), this.deps.adminSecretKey)) {
      res.status(401).json({ error: 'Şifre hatalı. Lütfen tekrar deneyin.' });
      return;
    }
    const token = signAdminToken();
    setAuthCookie(res, token);
    logger.info('[AdminController] Admin login successful');
    res.status(200).json({ success: true });
  };

  // ---------------------------------------------------------------------------
  // Auth — POST /api/admin/logout
  // ---------------------------------------------------------------------------

  logout = (_req: Request, res: Response): void => {
    clearAuthCookie(res);
    res.status(200).json({ success: true });
  };

  // ---------------------------------------------------------------------------
  // Appointments — GET /api/admin/appointments
  // ---------------------------------------------------------------------------

  getAppointments = async (req: Request, res: Response): Promise<void> => {
    const {
      archiveMode = 'active',
      status,
      urgency,
      dateRange,
      search,
      page  = '1',
      limit = '50',
    } = req.query as Record<string, string | undefined>;

    const ACTIVE_STATUSES  = ['pending', 'approved'];
    const ARCHIVE_STATUSES = ['rejected', 'cancelled', 'completed'];
    const tz               = process.env.TIMEZONE ?? 'Europe/Istanbul';

    // Build MongoDB query
    const query: Record<string, unknown> = {};

    // Archive mode — base status set
    query.status = {
      $in: archiveMode === 'active' ? ACTIVE_STATUSES : ARCHIVE_STATUSES,
    };

    // Narrow by specific status (tab filter)
    if (status && status !== 'all') {
      query.status = status;
    }

    // Urgency filter — supports comma-separated values, e.g. "CRITICAL,HIGH"
    if (urgency && urgency !== 'all') {
      const urgencyList = urgency.split(',').map((s) => s.trim()).filter(Boolean);
      query['triage.urgency'] = urgencyList.length === 1
        ? urgencyList[0]
        : { $in: urgencyList };
    }

    // Date range filter
    if (dateRange && dateRange !== 'all') {
      const now = DateTime.now().setZone(tz);
      let rangeStart: string | undefined;
      let rangeEnd:   string | undefined;
      if (dateRange === 'today') {
        rangeStart = now.startOf('day').toISO()!;
        rangeEnd   = now.endOf('day').toISO()!;
      } else if (dateRange === 'tomorrow') {
        rangeStart = now.plus({ days: 1 }).startOf('day').toISO()!;
        rangeEnd   = now.plus({ days: 1 }).endOf('day').toISO()!;
      } else if (dateRange === 'week') {
        rangeStart = now.startOf('day').toISO()!;
        rangeEnd   = now.endOf('week').toISO()!;
      }
      if (rangeStart && rangeEnd) {
        query.dateTime = { $gte: rangeStart, $lte: rangeEnd };
      }
    }

    // Text search on name or email
    if (search?.trim()) {
      const safe  = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(safe, 'i');
      query.$or   = [{ name: regex }, { email: regex }];
    }

    const pageNum  = Math.max(1, parseInt(page  ?? '1',  10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? '50', 10) || 50));
    const skip     = (pageNum - 1) * limitNum;

    const [docs, total] = await Promise.all([
      AppointmentModel.find(query).sort({ submittedAt: -1 }).skip(skip).limit(limitNum).lean(),
      AppointmentModel.countDocuments(query),
    ]);

    res.status(200).json({
      appointments: docs,
      total,
      page:         pageNum,
      totalPages:   Math.ceil(total / limitNum),
    });
  };

  // ---------------------------------------------------------------------------
  // Stats — GET /api/admin/stats
  // ---------------------------------------------------------------------------

  getStats = async (_req: Request, res: Response): Promise<void> => {
    const [total, approved, pending, rejected, cancelled, completed] = await Promise.all([
      AppointmentModel.countDocuments(),
      AppointmentModel.countDocuments({ status: 'approved' }),
      AppointmentModel.countDocuments({ status: 'pending' }),
      AppointmentModel.countDocuments({ status: 'rejected' }),
      AppointmentModel.countDocuments({ status: 'cancelled' }),
      AppointmentModel.countDocuments({ status: 'completed' }),
    ]);
    res.status(200).json({ total, approved, pending, rejected, cancelled, completed });
  };

  // ---------------------------------------------------------------------------
  // AI analytics — POST /api/admin/analyze
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

      const answer = await withTimeout(
        this.deps.aiService.analyzeAppointments(context, question.trim()),
        AI_TIMEOUT_MS,
      );
      res.status(200).json({ answer });
    } catch (err) {
      const isTimeout = (err as { code?: string }).code === 'AI_TIMEOUT';
      if (isTimeout) {
        logger.warn('[AdminController] analyzeData timed out');
        res.status(504).json({ error: 'Şu an yoğunluk var, lütfen tekrar deneyin.' });
      } else {
        logger.error('[AdminController] analyzeData failed:', err);
        res.status(500).json({ error: 'Analiz sırasında bir hata oluştu.' });
      }
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

  // ---------------------------------------------------------------------------
  // Bulk action — POST /api/admin/appointments/bulk
  // ---------------------------------------------------------------------------

  bulkAction = async (req: Request, res: Response): Promise<void> => {
    const { ids, action } = req.body as { ids?: unknown; action?: unknown };
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'ids array is required.' }); return;
    }
    if (action !== 'cancel' && action !== 'complete' && action !== 'delete') {
      res.status(400).json({ error: 'action must be cancel, complete or delete.' }); return;
    }

    const validIds = (ids as string[]).filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length === 0) {
      res.status(400).json({ error: 'No valid IDs provided.' }); return;
    }

    // Hard delete — only archived statuses
    if (action === 'delete') {
      const ARCHIVE_STATUSES = ['rejected', 'cancelled', 'completed'];
      const docs = await AppointmentModel.find({
        _id: { $in: validIds }, status: { $in: ARCHIVE_STATUSES },
      }).lean();
      const deletableIds = docs.map((d) => (d._id as { toString(): string }).toString());
      const skipped = validIds.length - deletableIds.length;
      if (deletableIds.length > 0) {
        await AppointmentModel.deleteMany({ _id: { $in: deletableIds } });
      }
      logger.info(`[AdminController] bulk delete: ${deletableIds.length} deleted, ${skipped} skipped`);
      res.status(200).json({ processed: deletableIds.length, failed: skipped, results: [] });
      return;
    }

    // Cancel / Complete — single updateMany instead of N individual saves
    const newStatus     = action === 'cancel' ? 'cancelled' : 'completed';
    const allowedFrom   = action === 'cancel'
      ? ['pending', 'approved']
      : ['pending', 'approved', 'cancelled'];

    const result = await AppointmentModel.updateMany(
      { _id: { $in: validIds }, status: { $in: allowedFrom } },
      { $set: { status: newStatus } },
    );

    const processed = result.modifiedCount;
    const skipped   = validIds.length - processed;
    logger.info(`[AdminController] bulk ${action}: ${processed} updated, ${skipped} skipped`);

    // Fire-and-forget: delete calendar events for bulk-cancelled approved appointments
    if (action === 'cancel') {
      AppointmentModel.find({ _id: { $in: validIds }, calendarEventId: { $ne: null } })
        .lean()
        .then((docs) => {
          for (const doc of docs) {
            const evtId = (doc as { calendarEventId?: string }).calendarEventId;
            if (evtId) {
              this.deps.calendarService.deleteEvent(evtId)
                .catch((e) => logger.error('[AdminController] bulk cancel event delete failed:', e));
            }
          }
        })
        .catch((e) => logger.error('[AdminController] bulk cancel calendar lookup failed:', e));
    }

    res.status(200).json({ processed, failed: skipped, results: [] });
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
