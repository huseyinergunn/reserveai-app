/**
 * useAppointmentForm — legacy facade kept for backward compatibility.
 * New code should use useAppointment from hooks/useAppointment.ts instead.
 *
 * Updated to use the new AppAction types from AppointmentContext.
 */

import { useAppointmentContext } from '../context/AppointmentContext';
import { api } from '../services/api';
import type { StepResult } from '../validators/formSchema';

type Dispatcher = ReturnType<typeof useAppointmentContext>['dispatch'];

function handleApiError(err: unknown, dispatch: Dispatcher): StepResult {
  const e = err as { error?: string; errors?: Record<string, string> };
  if (e.errors && Object.keys(e.errors).length > 0) {
    dispatch({ type: 'LOADING_END' });
    return { fieldErrors: e.errors };
  }
  dispatch({ type: 'SET_ERROR', payload: e.error ?? 'Something went wrong.' });
  return {};
}

export function useAppointmentForm() {
  const { dispatch } = useAppointmentContext();

  async function submitEnquiry(data: {
    name: string; email: string; enquiry: string;
  }): Promise<StepResult> {
    dispatch({ type: 'LOADING_START' });
    try {
      const res = await api.submitEnquiry(data);
      if (res.status === 'declined') {
        dispatch({ type: 'ENQUIRY_DECLINED' });
        return {};
      }
      dispatch({ type: 'ENQUIRY_QUALIFIED', payload: data });
      return {};
    } catch (err) { return handleApiError(err, dispatch); }
  }

  async function acceptTerms(): Promise<StepResult> {
    dispatch({ type: 'LOADING_START' });
    try {
      await api.acceptTerms();
      dispatch({ type: 'TERMS_ACCEPTED' });
      return {};
    } catch (err) { return handleApiError(err, dispatch); }
  }

  async function scheduleAppointment(data: {
    name: string; email: string; enquiry: string; date: string; time: string;
  }): Promise<StepResult> {
    dispatch({ type: 'LOADING_START' });
    try {
      const res = await api.scheduleAppointment(data);
      dispatch({
        type: 'APPOINTMENT_SUBMITTED',
        payload: {
          name:             res.summary.name,
          dateTime:         res.summary.dateTime,
          enquiry:          res.summary.enquiry,
          bookingReference: res.summary.bookingReference,
        },
      });
      return {};
    } catch (err) { return handleApiError(err, dispatch); }
  }

  function reset() { dispatch({ type: 'RESET' }); }

  return { submitEnquiry, acceptTerms, scheduleAppointment, reset };
}
