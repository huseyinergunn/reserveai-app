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
  approvalToken:      string;
  cancellationToken:  string;
  bookingReference:   string;
  calendarEventId?:   string;
  /** Set when the async approval workflow encounters a fatal error */
  workflowError?:     string;
  triage?: {
    urgency:      'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
    sentiment:    'POSITIVE' | 'NEUTRAL' | 'ANXIOUS' | 'FRUSTRATED';
    clarity:      number;
    adminSummary: string;
    processedAt:  string;
  };
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
    status:           { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled', 'completed'], default: 'pending' },
    approvalToken:    { type: String, required: true, unique: true, index: true },
    cancellationToken:{ type: String, required: true, unique: true, index: true },
    bookingReference: { type: String, required: true, unique: true },
    calendarEventId:  { type: String, default: null },
    workflowError:    { type: String, default: null },
    triage: {
      urgency:      { type: String, enum: ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] },
      sentiment:    { type: String, enum: ['POSITIVE', 'NEUTRAL', 'ANXIOUS', 'FRUSTRATED'] },
      clarity:      { type: Number },
      adminSummary: { type: String },
      processedAt:  { type: String },
    },
  },
  { timestamps: true },
);

// Compound index for the most common admin query: status + date sort
schema.index({ status: 1, submittedAt: -1 });
// Compound index for date-range filter queries
schema.index({ dateTime: 1, status: 1 });

export const AppointmentModel = mongoose.model<IAppointmentDoc>('Appointment', schema);

// ---------------------------------------------------------------------------
// Token + reference generators
// ---------------------------------------------------------------------------

export function generateApprovalToken(): string {
  return randomBytes(32).toString('hex');
}

export function generateCancellationToken(): string {
  return randomBytes(32).toString('hex');
}

export function generateBookingReference(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return 'RSV-' + Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)],
  ).join('');
}
