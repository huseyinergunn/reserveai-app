// =============================================================================
// Domain types — shared by server/ and client/
// =============================================================================

export interface FormSubmission {
  name: string;
  email: string;
  enquiry: string;
  dateTime: string;    // ISO 8601
  submittedAt: string; // ISO 8601
}

export type EnquiryCategory = 'relevant' | 'other';

export interface ClassificationResult {
  category: EnquiryCategory;
}

export interface Appointment {
  id: string;
  summary: string;
  description: string;
  startTime: string;
  endTime: string;
  attendeeEmail: string;
  attendeeName: string;
  conferenceLink?: string;
  createdAt: string;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

/** Stored in DB; used by FormController → MailService → ApprovalController. */
// ---------------------------------------------------------------------------
// Triage & Sentiment Engine
// ---------------------------------------------------------------------------

export type TriageUrgency  = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
export type TriageSentiment = 'POSITIVE' | 'NEUTRAL' | 'ANXIOUS' | 'FRUSTRATED';

export interface TriageResult {
  urgency:      TriageUrgency;
  sentiment:    TriageSentiment;
  clarity:      number;       // 0–100
  adminSummary: string;       // single Turkish sentence for admin
  processedAt:  string;       // ISO 8601
}

export interface ApprovalPayload {
  submissionId:     string;
  name:             string;
  email:            string;
  enquiry:          string;
  enquirySummary:   string;
  dateTime:         string;
  submittedAt:      string;
  approvalToken:    string;   // 64-char hex → goes into email link
  bookingReference: string;   // RSV-XXXXXX → shown to user
  triage?:          TriageResult;
}

// ---------------------------------------------------------------------------
// HTTP response contracts
// ---------------------------------------------------------------------------

export interface ApiErrorResponse {
  error: string;
  errors?: Record<string, string>;
}

/** AI'nın kullanıcı mesajından çıkardığı randevu niyeti. */
export interface ExtractedAppointmentData {
  /** Mevcut tarih seçeneklerinden eşleşen label — ör. "Mon, 9 Jun" */
  date: string | null;
  /** Mevcut saat seçeneklerinden eşleşen slot — ör. "10:00 am" */
  time: string | null;
  /** high: açıkça belirtilmiş | low: çıkarım yapıldı | none: belirsiz */
  confidence: 'high' | 'low' | 'none';
  /** Tam eşleşme sağlanamadığında gösterilecek öneri mesajı */
  suggestionMessage: string | null;
}

export interface SubmitEnquiryResponse {
  status: 'qualified' | 'declined';
  message?: string;
  context?: Pick<FormSubmission, 'name' | 'email' | 'enquiry'>;
  /** Kullanıcının mesajından AI'nın çıkardığı tarih/saat niyeti */
  extracted?: ExtractedAppointmentData;
}

export interface ScheduleResponse {
  status: 'submitted';
  message: string;
  summary: Pick<FormSubmission, 'name' | 'dateTime' | 'enquiry'> & {
    bookingReference: string;
  };
}

export interface DateOptionsResponse {
  dates: string[];
  times: readonly string[];
  /** ISO datetimes of pending/approved appointments — used to mark booked slots in the UI */
  bookedDateTimes: string[];
}

/** Frontend approval page fetches this to display appointment details. */
export interface ApprovalDetailsResponse {
  name:             string;
  email:            string;
  dateTime:         string;
  enquiry:          string;
  bookingReference: string;
  status:           ApprovalStatus;
}
