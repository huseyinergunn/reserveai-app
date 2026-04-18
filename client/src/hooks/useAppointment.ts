/**
 * useAppointment — primary facade hook for the 3-step appointment form.
 *
 * This is the ONLY import Step1, Step2, and Step3 components need.
 * It combines:
 *   - State reading  (from AppointmentContext)
 *   - API calls      (from services/api.ts)
 *   - Date utilities (from @shared/dateUtils — weekday filter, formatting)
 *
 * n8n flow reproduced here:
 *   submitStep1  → Enquiry Classifier  → qualified | declined
 *   submitStep2  → Has Accepted?       → advance to step 3
 *   submitStep3  → Get Form Values
 *                → Trigger Approval Process (async, server-side)
 *                → Send Receipt
 *                → Form End (success screen)
 */

import { useCallback } from 'react';
import { useAppointmentContext } from '../context/AppointmentContext';
import type { Step1Data, SuccessSummary } from '../context/AppointmentContext';
import { api } from '../services/api';
import type { StepResult } from '../validators/formSchema';
import {
  getAvailableDateOptions,
  formatDisplayDateTime,
} from '@shared/dateUtils';
import { DEFAULT_BOOKING_WINDOW_DAYS, TIME_SLOTS, TIMEZONE } from '@shared/constants';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type Dispatcher = ReturnType<typeof useAppointmentContext>['dispatch'];

/**
 * Translates an API error response into a StepResult so step components
 * can surface field-level or global errors without knowing about HTTP.
 */
function handleError(err: unknown, dispatch: Dispatcher): StepResult {
  const e = err as { error?: string; errors?: Record<string, string> };

  if (e.errors && Object.keys(e.errors).length > 0) {
    // Field-level validation errors from the server → hand back to the form
    dispatch({ type: 'LOADING_END' });
    return { fieldErrors: e.errors };
  }

  // Everything else → global error banner
  dispatch({
    type: 'SET_ERROR',
    payload: e.error ?? 'Something went wrong. Please try again.',
  });
  return {};
}

// ---------------------------------------------------------------------------
// Public hook
// ---------------------------------------------------------------------------

export function useAppointment() {
  const { state, dispatch } = useAppointmentContext();

  // ── Derived state ─────────────────────────────────────────────────────────

  /** Current form step (1 | 2 | 3), or null when not on a form screen. */
  const currentStep =
    state.screenState.screen === 'form' ? state.screenState.step : null;

  const isDeclined = state.screenState.screen === 'declined';
  const isSuccess  = state.screenState.screen === 'success';
  const successSummary: SuccessSummary | null =
    state.screenState.screen === 'success' ? state.screenState.summary : null;

  // ── Client-side date options (weekday filter via shared/dateUtils) ─────────
  // Pre-computed on the client for instant dropdown render.
  // Step 3 also fetches from the server so the server timezone / window apply.
  // Client-side dates computed in Istanbul timezone — matches the server's booking window
  const clientDates = getAvailableDateOptions(DEFAULT_BOOKING_WINDOW_DAYS, TIMEZONE);

  // ── Date options (server-authoritative, cached in context) ─────────────────

  /**
   * Load date/time options from the API and cache them in context.
   * Safe to call multiple times — skips fetch if already cached.
   */
  const loadDateOptions = useCallback(async (): Promise<void> => {
    if (state.dateOptions) return; // already cached

    try {
      const opts = await api.getDateOptions();
      dispatch({ type: 'DATE_OPTIONS_LOADED', payload: opts });
    } catch {
      // Non-fatal: fall back to client-side computed dates + shared TIME_SLOTS
      dispatch({
        type: 'DATE_OPTIONS_LOADED',
        payload: { dates: clientDates, times: TIME_SLOTS, bookedDateTimes: [] },
      });
    }
  }, [state.dateOptions, dispatch, clientDates]);

  // ── Step handlers ──────────────────────────────────────────────────────────

  /**
   * Step 1 — submit enquiry + AI classification.
   * n8n: Enquiry Classifier → "relevant" | "other"
   */
  async function submitStep1(data: Step1Data): Promise<StepResult> {
    dispatch({ type: 'LOADING_START' });
    try {
      const res = await api.submitEnquiry(data);

      if (res.status === 'declined') {
        dispatch({ type: 'ENQUIRY_DECLINED' });
        return {};
      }

      dispatch({ type: 'ENQUIRY_QUALIFIED', payload: data, extracted: res.extracted });
      return {};
    } catch (err) {
      return handleError(err, dispatch);
    }
  }

  /**
   * Step 2 — T&C acceptance.
   * n8n: Has Accepted? → true branch → "Enter Date & Time"
   */
  async function submitStep2(): Promise<StepResult> {
    dispatch({ type: 'LOADING_START' });
    try {
      await api.acceptTerms();
      dispatch({ type: 'TERMS_ACCEPTED' });
      return {};
    } catch (err) {
      return handleError(err, dispatch);
    }
  }

  /**
   * Step 3 — schedule appointment.
   * n8n: Get Form Values → Trigger Approval Process → Send Receipt → Form End
   *
   * The server:
   *   1. Validates the date (weekday, within booking window, future)
   *   2. Sends receipt email to the user
   *   3. Asynchronously sends approval email to admin
   */
  async function submitStep3(data: {
    date: string;
    time: string;
  }): Promise<StepResult> {
    if (!state.step1Data) {
      dispatch({ type: 'SET_ERROR', payload: 'Session expired. Please start over.' });
      return {};
    }

    dispatch({ type: 'LOADING_START' });
    try {
      const res = await api.scheduleAppointment({
        ...state.step1Data,
        date: data.date,
        time: data.time,
      });

      const summary: SuccessSummary = {
        name:             res.summary.name,
        dateTime:         res.summary.dateTime,
        enquiry:          res.summary.enquiry,
        bookingReference: res.summary.bookingReference,
      };

      dispatch({ type: 'APPOINTMENT_SUBMITTED', payload: summary });
      return {};
    } catch (err) {
      return handleError(err, dispatch);
    }
  }

  /** Resets the entire flow back to Step 1. */
  function reset() {
    dispatch({ type: 'RESET' });
  }

  function clearError() {
    dispatch({ type: 'CLEAR_ERROR' });
  }

  // ── Return surface ─────────────────────────────────────────────────────────

  return {
    // State
    currentStep,
    isDeclined,
    isSuccess,
    successSummary,
    step1Data:     state.step1Data,
    dateOptions:   state.dateOptions,
    extractedData: state.extractedData,
    isLoading:     state.isLoading,
    globalError:   state.globalError,

    // Client-side dates (instant, no API needed)
    clientDates,

    // Formatted display helper — always renders in Istanbul timezone
    formatDateTime: (iso: string) => formatDisplayDateTime(iso, TIMEZONE),

    // Actions
    loadDateOptions,
    submitStep1,
    submitStep2,
    submitStep3,
    reset,
    clearError,
  };
}
