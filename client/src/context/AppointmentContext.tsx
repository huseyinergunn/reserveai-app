/**
 * AppointmentContext — single source of truth for the 3-step form flow.
 *
 * n8n node mapping:
 *   step 1  → "n8n Form Trigger" + "Enquiry Classifier"
 *   step 2  → "Terms & Conditions" + "Has Accepted?"
 *   step 3  → "Enter Date & Time" + "Get Form Values"
 *   decline → "Decline" form completion node
 *   success → "Form End" completion node
 */

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  type Dispatch,
  type ReactNode,
} from 'react';
import type { ExtractedAppointmentData } from '@shared/types';

// ---------------------------------------------------------------------------
// Domain sub-types
// ---------------------------------------------------------------------------

/** Data collected in Step 1. */
export interface Step1Data {
  name: string;
  email: string;
  enquiry: string;
}

/** Data collected in Step 3 (date/time selection). */
export interface Step3Data extends Step1Data {
  date: string;     // e.g. "Mon, 2 Jun"
  time: string;     // e.g. "9:00 am"
  dateTime: string; // ISO 8601 — returned by the API after validation
}

/** Final success summary shown on the confirmation screen. */
export interface SuccessSummary {
  name: string;
  dateTime: string; // ISO 8601
  enquiry: string;
  bookingReference: string; // RSV-XXXXXX — real reference from the server
}

/** Date/time dropdown options fetched from the API (cached in state). */
export interface DateOptions {
  dates: string[];
  times: readonly string[];
  /** ISO datetimes of pending/approved appointments — used to disable booked slots in UI */
  bookedDateTimes: string[];
}

// ---------------------------------------------------------------------------
// Screen union — exhaustive, no boolean flags needed
// ---------------------------------------------------------------------------

export type FormStep = 1 | 2 | 3;

export type ScreenState =
  | { screen: 'form'; step: FormStep }
  | { screen: 'declined' }
  | { screen: 'success'; summary: SuccessSummary };

// ---------------------------------------------------------------------------
// Top-level app state
// ---------------------------------------------------------------------------

export interface AppState {
  screenState: ScreenState;
  /** Carries Step 1 data forward to Step 3 and the API. */
  step1Data: Step1Data | null;
  /** Cached dropdown options — populated on Step 3 mount. */
  dateOptions: DateOptions | null;
  /** AI'nın Step 1 mesajından çıkardığı tarih/saat niyeti — Step 3'te ön doldurmak için */
  extractedData: ExtractedAppointmentData | null;
  isLoading: boolean;
  globalError: string | null;
}

const INITIAL_STATE: AppState = {
  screenState: { screen: 'form', step: 1 },
  step1Data: null,
  dateOptions: null,
  extractedData: null,
  isLoading: false,
  globalError: null,
};

// ---------------------------------------------------------------------------
// Actions — one per intent, no generic "SET_STATE"
// ---------------------------------------------------------------------------

export type AppAction =
  | { type: 'LOADING_START' }
  | { type: 'LOADING_END' }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  /** Step 1 qualified → advance to T&C (extracted: AI'nın anladığı tarih/saat) */
  | { type: 'ENQUIRY_QUALIFIED'; payload: Step1Data; extracted?: ExtractedAppointmentData }
  /** Step 1 rejected by AI → show decline screen */
  | { type: 'ENQUIRY_DECLINED' }
  /** Step 2 accepted → advance to date/time picker */
  | { type: 'TERMS_ACCEPTED' }
  /** Date/time options loaded → cache them */
  | { type: 'DATE_OPTIONS_LOADED'; payload: DateOptions }
  /** Step 3 submitted successfully */
  | { type: 'APPOINTMENT_SUBMITTED'; payload: SuccessSummary }
  /** Reset everything back to Step 1 */
  | { type: 'RESET' };

// ---------------------------------------------------------------------------
// Reducer — pure, no side-effects
// ---------------------------------------------------------------------------

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'LOADING_START':
      return { ...state, isLoading: true, globalError: null };

    case 'LOADING_END':
      return { ...state, isLoading: false };

    case 'SET_ERROR':
      return { ...state, isLoading: false, globalError: action.payload };

    case 'CLEAR_ERROR':
      return { ...state, globalError: null };

    case 'ENQUIRY_QUALIFIED':
      return {
        ...state,
        isLoading: false,
        globalError: null,
        step1Data: action.payload,
        extractedData: action.extracted ?? null,
        screenState: { screen: 'form', step: 2 },
      };

    case 'ENQUIRY_DECLINED':
      return { ...state, isLoading: false, screenState: { screen: 'declined' } };

    case 'TERMS_ACCEPTED':
      return {
        ...state,
        isLoading: false,
        globalError: null,
        screenState: { screen: 'form', step: 3 },
      };

    case 'DATE_OPTIONS_LOADED':
      return { ...state, dateOptions: action.payload };

    case 'APPOINTMENT_SUBMITTED':
      return {
        ...state,
        isLoading: false,
        globalError: null,
        screenState: { screen: 'success', summary: action.payload },
      };

    case 'RESET':
      return INITIAL_STATE;

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// sessionStorage draft persistence
// ---------------------------------------------------------------------------

const DRAFT_KEY = 'reserveai_form_draft';

type DraftState = Pick<AppState, 'screenState' | 'step1Data' | 'extractedData'>;

function loadDraft(): AppState | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as DraftState;
    if (draft.screenState?.screen !== 'form') return null;
    return { ...INITIAL_STATE, ...draft };
  } catch {
    return null;
  }
}

function saveDraft(state: AppState): void {
  try {
    if (state.screenState.screen !== 'form') {
      sessionStorage.removeItem(DRAFT_KEY);
      return;
    }
    const draft: DraftState = {
      screenState:   state.screenState,
      step1Data:     state.step1Data,
      extractedData: state.extractedData,
    };
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // storage full or unavailable — silently ignore
  }
}

// ---------------------------------------------------------------------------
// Context + Provider
// ---------------------------------------------------------------------------

const AppointmentCtx = createContext<{
  state: AppState;
  dispatch: Dispatch<AppAction>;
} | null>(null);

export function AppointmentProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => loadDraft() ?? INITIAL_STATE);

  useEffect(() => {
    saveDraft(state);
  }, [state]);

  return (
    <AppointmentCtx.Provider value={{ state, dispatch }}>
      {children}
    </AppointmentCtx.Provider>
  );
}

/** Low-level hook — prefer `useAppointment` from hooks/ for components. */
export function useAppointmentContext() {
  const ctx = useContext(AppointmentCtx);
  if (!ctx) throw new Error('useAppointmentContext must be inside AppointmentProvider');
  return ctx;
}

/**
 * Re-exported under the legacy name so older files that imported
 * `useAppointment` from this module continue to compile.
 * New code should use `useAppointmentContext` or the facade in hooks/.
 */
export { useAppointmentContext as useAppointment };
