/**
 * Typed HTTP client for the appointment API.
 *
 * All request/response shapes come from @shared/types — the same types
 * used by the server, so any breaking change in the contract is caught
 * at compile time on both ends.
 *
 * Error shape normalised to: { error: string; errors?: Record<string,string> }
 */

import axios from 'axios';
import type {
  SubmitEnquiryResponse,
  ScheduleResponse,
  DateOptionsResponse,
  ApprovalDetailsResponse,
} from '@shared/types';

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

const http = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

/**
 * Normalise every non-2xx response to a plain object so callers only need
 * one error shape:  { error: string; errors?: Record<string,string> }
 */
http.interceptors.response.use(
  (res) => res,
  (err) => {
    const data = err.response?.data;
    return Promise.reject(
      data && typeof data === 'object'
        ? data
        : { error: 'Network error. Please check your connection and try again.' },
    );
  },
);

// ---------------------------------------------------------------------------
// Request payload types
// ---------------------------------------------------------------------------

export interface SubmitEnquiryPayload {
  name: string;
  email: string;
  enquiry: string;
}

export interface SchedulePayload extends SubmitEnquiryPayload {
  date: string; // dropdown label e.g. "Mon, 2 Jun"
  time: string; // e.g. "9:00 am"
}

// ---------------------------------------------------------------------------
// API methods
// ---------------------------------------------------------------------------

export const api = {
  /**
   * Step 1 — submit the enquiry for AI classification.
   * n8n: Form Trigger → Enquiry Classifier
   *
   * Returns status "qualified" (advance to T&C) or "declined" (show decline screen).
   */
  submitEnquiry(payload: SubmitEnquiryPayload): Promise<SubmitEnquiryResponse> {
    return http
      .post<SubmitEnquiryResponse>('/form/submit', payload)
      .then((r) => r.data);
  },

  /**
   * Step 2 — confirm T&C acceptance.
   * n8n: Terms & Conditions → Has Accepted?
   */
  acceptTerms(): Promise<{ status: string }> {
    return http
      .post<{ status: string }>('/form/terms', {
        accepted: 'I accept the terms and conditions',
      })
      .then((r) => r.data);
  },

  /**
   * Step 3 — submit date/time, trigger receipt email + async approval flow.
   * n8n: Get Form Values → Trigger Approval Process → Send Receipt
   */
  scheduleAppointment(payload: SchedulePayload): Promise<ScheduleResponse> {
    return http
      .post<ScheduleResponse>('/form/schedule', payload)
      .then((r) => r.data);
  },

  /**
   * Fetch available date/time dropdown options from the server.
   * The server applies the same weekday-filter logic as shared/dateUtils,
   * respecting its configured timezone and booking window.
   */
  getDateOptions(): Promise<DateOptionsResponse> {
    return http
      .get<DateOptionsResponse>('/form/date-options')
      .then((r) => r.data);
  },

  // ---------------------------------------------------------------------------
  // Approval page — used by /approve/:token frontend route
  // ---------------------------------------------------------------------------

  /** Public — customer looks up their appointments by email. */
  getAppointmentStatus(email: string): Promise<{ appointments: AppointmentStatusItem[] }> {
    return http
      .get<{ appointments: AppointmentStatusItem[] }>('/form/status', { params: { email } })
      .then((r) => r.data);
  },

  /** Fetch appointment details for the approval page (admin review). */
  getApprovalDetails(token: string): Promise<ApprovalDetailsResponse> {
    return http
      .get<ApprovalDetailsResponse>(`/approval/details/${token}`)
      .then((r) => r.data);
  },

  /** Admin confirms the appointment. Token sent in body (CSRF-safe POST). */
  confirmApproval(token: string): Promise<{ status: string }> {
    return http
      .post<{ status: string }>('/approval/confirm', { token })
      .then((r) => r.data);
  },

  /** Admin declines the appointment. Token sent in body (CSRF-safe POST). */
  declineApproval(token: string): Promise<{ status: string }> {
    return http
      .post<{ status: string }>('/approval/decline', { token })
      .then((r) => r.data);
  },
};

// ---------------------------------------------------------------------------
// Admin API — requires x-admin-key header
// ---------------------------------------------------------------------------

export interface AppointmentStatusItem {
  _id: string;
  name: string;
  dateTime: string;
  status: string;
  bookingReference: string;
  submittedAt: string;
}

export interface AdminAppointment {
  _id: string;
  name: string;
  email: string;
  enquiry: string;
  enquirySummary: string;
  dateTime: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed';
  bookingReference: string;
  calendarEventId?: string;
}

export interface AdminStats {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  cancelled: number;
}

const ADMIN_BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/admin`;

function adminHttp(adminKey: string) {
  const instance = axios.create({
    baseURL: ADMIN_BASE,
    headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
    timeout: 15_000,
  });
  // Normalize errors to { error: string } — same shape as the main http instance
  instance.interceptors.response.use(
    (res) => res,
    (err) => {
      const data   = err.response?.data;
      const status = err.response?.status as number | undefined;
      if (status === 401 || status === 403) {
        return Promise.reject({ error: 'Yetkisiz erişim. Şifre hatalı.' });
      }
      return Promise.reject(
        data && typeof data === 'object'
          ? data
          : { error: 'Sunucuya bağlanılamadı. Lütfen bağlantınızı kontrol edin.' },
      );
    },
  );
  return instance;
}

export const adminApi = {
  getAppointments(adminKey: string): Promise<{ appointments: AdminAppointment[] }> {
    return adminHttp(adminKey)
      .get<{ appointments: AdminAppointment[] }>('/appointments')
      .then((r) => r.data);
  },

  getStats(adminKey: string): Promise<AdminStats> {
    return adminHttp(adminKey)
      .get<AdminStats>('/stats')
      .then((r) => r.data);
  },

  approve(adminKey: string, id: string): Promise<{ status: string }> {
    return adminHttp(adminKey)
      .post<{ status: string }>(`/appointments/${id}/approve`)
      .then((r) => r.data);
  },

  reject(adminKey: string, id: string): Promise<{ status: string }> {
    return adminHttp(adminKey)
      .post<{ status: string }>(`/appointments/${id}/reject`)
      .then((r) => r.data);
  },

  cancel(adminKey: string, id: string): Promise<{ status: string }> {
    return adminHttp(adminKey)
      .post<{ status: string }>(`/appointments/${id}/cancel`)
      .then((r) => r.data);
  },

  complete(adminKey: string, id: string): Promise<{ status: string }> {
    return adminHttp(adminKey)
      .post<{ status: string }>(`/appointments/${id}/complete`)
      .then((r) => r.data);
  },

  bulkAction(adminKey: string, ids: string[], action: 'cancel' | 'complete'): Promise<{ processed: number; failed: number }> {
    return adminHttp(adminKey)
      .post<{ processed: number; failed: number }>('/appointments/bulk', { ids, action })
      .then((r) => r.data);
  },
};
