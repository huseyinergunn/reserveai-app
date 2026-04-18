import type { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { AiService } from '../services/ai/AiService';
import type { MailService } from '../services/mail/MailService';
import type { WebhookService } from '../services/WebhookService';
import { DateValidator } from '../validators/date.validator';
import {
  initialFormSchema,
  dateTimeSchema,
  termsSchema,
  flattenZodErrors,
} from '../validators/form.validator';
import type { FormSubmission, ApprovalPayload } from '@shared/types';
import { logger } from '../utils/logger';
import {
  AppointmentModel,
  generateApprovalToken,
  generateCancellationToken,
  generateBookingReference,
} from '../models/Appointment';

interface Deps {
  aiService:       AiService;
  mailService:     MailService;
  dateValidator:   DateValidator;
  webhookService:  WebhookService;
}

export class FormController {
  constructor(private readonly deps: Deps) {}

  // Step 1 — enquiry submission + AI classification + date extraction
  submitEnquiry = async (req: Request, res: Response): Promise<void> => {
    console.log('[FormController] Form received:', req.body);
    const parsed = initialFormSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ errors: flattenZodErrors(parsed.error) });
      return;
    }

    const { name, email, enquiry } = parsed.data;

    let classification;
    try {
      classification = await this.deps.aiService.classifyEnquiry(enquiry);
    } catch (err) {
      logger.error('[FormController] AI classification error:', err);
      res.status(502).json({ error: 'AI service unavailable. Please try again.' });
      return;
    }

    if (classification.category !== 'relevant') {
      logger.info(`[FormController] Enquiry from ${email} declined by AI`);
      res.status(200).json({
        status: 'declined',
        message:
          "Thanks for your enquiry but it may not need an appointment. Please feel free to email me instead at user@example.com.",
      });
      return;
    }

    // Non-fatal: extract date/time intent for Step 3 pre-fill
    const availableDates = this.deps.dateValidator.getAvailableDates();
    const availableTimes = this.deps.dateValidator.getAvailableTimes();
    let extracted;
    try {
      extracted = await this.deps.aiService.extractDateTime(enquiry, availableDates, availableTimes);
      if (extracted.confidence === 'none') extracted = undefined;
    } catch (err) {
      logger.warn('[FormController] AI date extraction failed (non-fatal):', err);
    }

    res.status(200).json({ status: 'qualified', context: { name, email, enquiry }, extracted });
  };

  // Step 2 — T&C acceptance
  acceptTerms = (req: Request, res: Response): void => {
    const parsed = termsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ errors: flattenZodErrors(parsed.error) });
      return;
    }
    res.status(200).json({ status: 'terms_accepted' });
  };

  // Step 3 — schedule + kick off async approval
  scheduleAppointment = async (req: Request, res: Response): Promise<void> => {
    console.log('[DEBUG] scheduleAppointment Raw Request Body:', req.body);
    const parsed = dateTimeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ errors: flattenZodErrors(parsed.error) });
      return;
    }

    const { name, email, enquiry, date, time } = parsed.data;

    const dateResult = this.deps.dateValidator.validate(date, time);
    if (!dateResult.valid) {
      res.status(422).json({ errors: { dateTime: dateResult.error } });
      return;
    }

    // ── Double-booking check ──────────────────────────────────────────────────
    const conflict = await AppointmentModel.findOne({
      dateTime: dateResult.iso!,
      status: { $in: ['pending', 'approved'] },
    });
    if (conflict) {
      res.status(409).json({
        errors: {
          dateTime: '🔴 Bu saat zaten rezerve edilmiş. Lütfen başka bir tarih veya saat seçin.',
        },
      });
      return;
    }

    const submission: FormSubmission = {
      name,
      email,
      enquiry,
      dateTime: dateResult.iso!,
      submittedAt: new Date().toISOString(),
    };

    // Generate tokens before responding so we can include bookingReference
    const approvalToken      = generateApprovalToken();
    const cancellationToken  = generateCancellationToken();
    const bookingReference   = generateBookingReference();

    // Fire-and-forget the approval workflow
    this.runApprovalWorkflow(submission, approvalToken, cancellationToken, bookingReference);

    try {
      await this.deps.mailService.sendReceipt(submission);
    } catch (err) {
      logger.error('[FormController] Receipt email failed (non-fatal):', err);
    }

    res.status(200).json({
      status: 'submitted',
      message:
        'Thank you! A confirmation has been sent to your inbox. We will get back to you shortly.',
      summary: { name, dateTime: submission.dateTime, enquiry, bookingReference },
    });
  };

  // Utility — date/time dropdown options (includes booked slots for UI feedback)
  getDateOptions = async (_req: Request, res: Response): Promise<void> => {
    const availableDates = this.deps.dateValidator.getAvailableDates();

    // ISO datetime strings of all pending/approved appointments within the booking window
    const [windowStart, windowEnd] = this.deps.dateValidator.getWindowBounds();
    const booked = await AppointmentModel.find(
      {
        dateTime:    { $gte: windowStart, $lte: windowEnd },
        status:      { $in: ['pending', 'approved'] },
      },
      { dateTime: 1, _id: 0 },
    ).lean();
    const bookedDateTimes = booked.map((b) => (b as { dateTime: string }).dateTime);

    res.status(200).json({
      dates:           availableDates,
      times:           this.deps.dateValidator.getAvailableTimes(),
      bookedDateTimes,
    });
  };

  getStatusByEmail = async (req: Request, res: Response): Promise<void> => {
    const raw = (req.query.email as string | undefined)?.trim();
    if (!raw || !raw.includes('@')) {
      res.status(400).json({ error: 'Geçerli bir e-posta adresi girin.' });
      return;
    }
    // Escape special regex chars to prevent ReDoS
    const safe = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const docs  = await AppointmentModel.find(
      { email: { $regex: new RegExp(`^${safe}$`, 'i') } },
      'name dateTime status bookingReference submittedAt',
    ).sort({ submittedAt: -1 }).lean();
    res.status(200).json({ appointments: docs });
  };

  // ---------------------------------------------------------------------------
  // Async approval workflow (runs independently of the HTTP response)
  // ---------------------------------------------------------------------------

  private runApprovalWorkflow(
    submission: FormSubmission,
    approvalToken: string,
    cancellationToken: string,
    bookingReference: string,
  ): void {
    const submissionId = uuidv4();
    const appBaseUrl   = process.env.APP_BASE_URL ?? 'http://localhost:3000';

    // ── Phase 1: Persist to MongoDB ───────────────────────────────────────────
    AppointmentModel.create({
      name:              submission.name,
      email:             submission.email,
      enquiry:           submission.enquiry,
      enquirySummary:    '',
      dateTime:          submission.dateTime,
      submittedAt:       submission.submittedAt,
      status:            'pending',
      approvalToken,
      cancellationToken,
      bookingReference,
    })
      .then(async (doc) => {
        const docId      = (doc._id as { toString(): string }).toString();
        const approveUrl = `${appBaseUrl}/api/approval/a/${docId}`;
        const rejectUrl  = `${appBaseUrl}/api/approval/r/${docId}`;

        // ── Phase 2: n8n webhook — fires right after DB save ─────────────────
        await this.deps.webhookService.notify({
          id:         docId,
          name:       submission.name,
          email:      submission.email,
          enquiry:    submission.enquiry,
          dateTime:   submission.dateTime,
          status:     'pending',
          approveUrl,
          rejectUrl,
        });

        // ── Phase 3: AI summarization + admin approval email ─────────────────
        let enquirySummary = '';
        try {
          enquirySummary = await this.deps.aiService.summariseEnquiry(submission.enquiry);
          doc.enquirySummary = enquirySummary;
          await doc.save();
        } catch (aiErr) {
          logger.error('[FormController] AI summarisation failed (non-fatal):', aiErr);
        }

        const payload: ApprovalPayload = {
          submissionId,
          name:          submission.name,
          email:         submission.email,
          enquiry:       submission.enquiry,
          enquirySummary,
          dateTime:      submission.dateTime,
          submittedAt:   submission.submittedAt,
          approvalToken,
          bookingReference,
        };

        await this.deps.mailService.sendApprovalRequest(payload);
        logger.info(`[FormController] Approval workflow done: ${submissionId} (ref=${bookingReference})`);
      })
      .catch((err) => logger.error('[FormController] Approval workflow error:', err));
  }
}
