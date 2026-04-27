/**
 * Typed HTTP client for the appointment API.
 * All request/response shapes come from @shared/types.
 * Error shape normalised to: { error: string; errors?: Record<string,string> }
 */

import axios from 'axios';
import type {
  SubmitEnquiryResponse,
  ScheduleResponse,
  DateOptionsResponse,
  ApprovalDetailsResponse,
} from '@shared/types';

const BASE_URL   = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
const ADMIN_BASE = `${BASE_URL}/api/admin`;

/** SessionStorage flag — set to '1' when admin is logged in. The actual JWT travels as an httpOnly cookie. */
export const ADMIN_SESSION_KEY = 'admin_session';

const http = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 40_000,
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    const data = err.response?.data;
    return Promise.reject(
      data && typeof data === 'object'
        ? data
        : { error: 'Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.' },
    );
  },
);

export interface SubmitEnquiryPayload {
  name:    string;
  email:   string;
  enquiry: string;
}

export interface SchedulePayload extends SubmitEnquiryPayload {
  date: string; // ISO date: YYYY-MM-DD  (e.g. "2025-06-02")
  time: string; // 24-hour slot: HH:MM   (e.g. "09:00")
}

export const api = {
  submitEnquiry(payload: SubmitEnquiryPayload): Promise<SubmitEnquiryResponse> {
    return http.post<SubmitEnquiryResponse>('/form/submit', payload).then((r) => r.data);
  },

  acceptTerms(): Promise<{ status: string }> {
    return http
      .post<{ status: string }>('/form/terms', { accepted: 'I accept the terms and conditions' })
      .then((r) => r.data);
  },

  scheduleAppointment(payload: SchedulePayload): Promise<ScheduleResponse> {
    return http.post<ScheduleResponse>('/form/schedule', payload).then((r) => r.data);
  },

  getDateOptions(): Promise<DateOptionsResponse> {
    return http.get<DateOptionsResponse>('/form/date-options').then((r) => r.data);
  },

  getAppointmentStatus(email: string): Promise<{ appointments: AppointmentStatusItem[] }> {
    return http
      .get<{ appointments: AppointmentStatusItem[] }>('/form/status', { params: { email } })
      .then((r) => r.data);
  },

  requestCancellation(email: string, bookingReference: string): Promise<{ status: string }> {
    return http
      .post<{ status: string }>('/form/cancel-request', { email, bookingReference })
      .then((r) => r.data);
  },

  getApprovalDetails(token: string): Promise<ApprovalDetailsResponse> {
    return http.get<ApprovalDetailsResponse>(`/approval/details/${token}`).then((r) => r.data);
  },

  confirmApproval(token: string): Promise<{ status: string }> {
    return http.post<{ status: string }>('/approval/confirm', { token }).then((r) => r.data);
  },

  declineApproval(token: string): Promise<{ status: string }> {
    return http.post<{ status: string }>('/approval/decline', { token }).then((r) => r.data);
  },
};

export interface AppointmentStatusItem {
  _id:              string;
  name:             string;
  dateTime:         string;
  status:           string;
  bookingReference: string;
  submittedAt:      string;
}

export interface AppointmentTriage {
  urgency:      'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  sentiment:    'POSITIVE' | 'NEUTRAL' | 'ANXIOUS' | 'FRUSTRATED';
  clarity:      number;
  adminSummary: string;
  processedAt:  string;
}

export interface AdminAppointment {
  _id:              string;
  name:             string;
  email:            string;
  enquiry:          string;
  enquirySummary:   string;
  dateTime:         string;
  submittedAt:      string;
  status:           'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed';
  bookingReference: string;
  calendarEventId?: string;
  triage?:          AppointmentTriage;
}

export interface AdminStats {
  total:     number;
  approved:  number;
  pending:   number;
  rejected:  number;
  cancelled: number;
  completed: number;
}

export interface GetAppointmentsParams {
  archiveMode?: 'active' | 'archive';
  status?:      string;
  urgency?:     string;
  dateRange?:   string;
  search?:      string;
  page?:        number;
  limit?:       number;
}

export interface GetAppointmentsResult {
  appointments: AdminAppointment[];
  total:        number;
  page:         number;
  totalPages:   number;
}

function adminHttp() {
  const instance = axios.create({
    baseURL:         ADMIN_BASE,
    headers:         { 'Content-Type': 'application/json' },
    withCredentials: true,
    timeout:         15_000,
  });
  instance.interceptors.response.use(
    (res) => res,
    (err) => {
      const data   = err.response?.data;
      const status = err.response?.status as number | undefined;
      if (status === 401 || status === 403) {
        sessionStorage.removeItem(ADMIN_SESSION_KEY);
        return Promise.reject({ error: data?.error ?? 'Oturum süresi doldu. Lütfen tekrar giriş yapın.' });
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
  login(password: string): Promise<{ success: boolean }> {
    return axios
      .post<{ success: boolean }>(`${ADMIN_BASE}/login`, { password }, { withCredentials: true })
      .then((r) => {
        sessionStorage.setItem(ADMIN_SESSION_KEY, '1');
        return r.data;
      });
  },

  logout(): Promise<{ success: boolean }> {
    return axios
      .post<{ success: boolean }>(`${ADMIN_BASE}/logout`, {}, { withCredentials: true })
      .then((r) => {
        sessionStorage.removeItem(ADMIN_SESSION_KEY);
        return r.data;
      });
  },

  getAppointments(params?: GetAppointmentsParams): Promise<GetAppointmentsResult> {
    return adminHttp().get<GetAppointmentsResult>('/appointments', { params }).then((r) => r.data);
  },

  getStats(): Promise<AdminStats> {
    return adminHttp().get<AdminStats>('/stats').then((r) => r.data);
  },

  approve(id: string): Promise<{ status: string }> {
    return adminHttp().post<{ status: string }>(`/appointments/${id}/approve`).then((r) => r.data);
  },

  reject(id: string): Promise<{ status: string }> {
    return adminHttp().post<{ status: string }>(`/appointments/${id}/reject`).then((r) => r.data);
  },

  cancel(id: string): Promise<{ status: string }> {
    return adminHttp().post<{ status: string }>(`/appointments/${id}/cancel`).then((r) => r.data);
  },

  complete(id: string): Promise<{ status: string }> {
    return adminHttp().post<{ status: string }>(`/appointments/${id}/complete`).then((r) => r.data);
  },

  bulkAction(ids: string[], action: 'cancel' | 'complete' | 'delete'): Promise<{ processed: number; failed: number }> {
    return adminHttp()
      .post<{ processed: number; failed: number }>('/appointments/bulk', { ids, action })
      .then((r) => r.data);
  },

  analyze(question: string): Promise<{ answer: string }> {
    return adminHttp().post<{ answer: string }>('/analyze', { question }).then((r) => r.data);
  },
};

export interface ChatMessage {
  role:    'user' | 'assistant';
  content: string;
}

export const chatApi = {
  message(messages: ChatMessage[]): Promise<{ response: string }> {
    return http.post<{ response: string }>('/chat/message', { messages }).then((r) => r.data);
  },
};
