import mongoose, { Schema, type Document } from 'mongoose';
import { randomBytes } from 'crypto';

// ---------------------------------------------------------------------------
// Document interface
// ---------------------------------------------------------------------------

export interface IAppointmentDoc extends Document {
  name:               string;
  email:              string;
  enquiry:            string;
  enquirySummary:     string;
  dateTime:           string;   // ISO 8601
  submittedAt:        string;   // ISO 8601
  status:             'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed';
  approvalToken:      string;   // 64-char hex, unique — used in approval email link
  cancellationToken:  string;   // 64-char hex, unique — used in cancel link
  bookingReference:   string;   // RSV-XXXXXX, unique — shown to user
  calendarEventId?:   string;   // Google Calendar event ID — stored after approval, used for deletion on cancel
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = new Schema<IAppointmentDoc>(
  {
    name:             { type: String, required: true },
    email:            { type: String, required: true },
    enquiry:          { type: String, required: true },
    enquirySummary:   { type: String, default: '' },
    dateTime:         { type: String, required: true },
    submittedAt:      { type: String, required: true },
    status:              { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled', 'completed'], default: 'pending' },
    approvalToken:       { type: String, required: true, unique: true, index: true },
    cancellationToken:   { type: String, required: true, unique: true, index: true },
    bookingReference:    { type: String, required: true, unique: true },
    calendarEventId:     { type: String, default: null },
  },
  { timestamps: true },
);

export const AppointmentModel = mongoose.model<IAppointmentDoc>('Appointment', schema);

// ---------------------------------------------------------------------------
// Token + reference generators
// ---------------------------------------------------------------------------

/** 64-char cryptographically secure hex token for email links. */
export function generateApprovalToken(): string {
  return randomBytes(32).toString('hex');
}

/** 64-char cryptographically secure hex token for cancellation links. */
export function generateCancellationToken(): string {
  return randomBytes(32).toString('hex');
}

/** Human-readable booking reference shown on the success screen. */
export function generateBookingReference(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return 'RSV-' + Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)],
  ).join('');
}
