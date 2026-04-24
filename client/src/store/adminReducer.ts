import type { AdminAppointment, AdminStats } from '../services/api';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export type ViewMode    = 'list' | 'calendar';
export type ArchiveMode = 'active' | 'archive';
export type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed';

export interface AdminState {
  appointments:  AdminAppointment[];
  stats:         AdminStats | null;
  /** Full-page loading (first load) */
  loading:       boolean;
  /** Error shown to the user */
  error:         string;
  /** Error from a single action (approve/reject/…) */
  actionError:   string;
  viewMode:      ViewMode;
  archiveMode:   ArchiveMode;
  filter:        FilterStatus;
  calendarDay:   string | null;
  /** IDs currently being mutated (single or bulk) */
  actingIds:     Set<string>;
  /** Which action is in-flight for actingIds */
  actingAction:  string;
  bulkLoading:   boolean;
  selected:      Set<string>;
  newCount:      number;
}

export const initialAdminState: AdminState = {
  appointments:  [],
  stats:         null,
  loading:       false,
  error:         '',
  actionError:   '',
  viewMode:      'list',
  archiveMode:   'active',
  filter:        'all',
  calendarDay:   null,
  actingIds:     new Set(),
  actingAction:  '',
  bulkLoading:   false,
  selected:      new Set(),
  newCount:      0,
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type AdminAction =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_SUCCESS'; appointments: AdminAppointment[]; stats: AdminStats; prevPending: number | null }
  | { type: 'LOAD_ERROR'; error: string }
  | { type: 'ACTION_START'; ids: string[]; action: string }
  | { type: 'ACTION_SUCCESS'; appointments: AdminAppointment[]; stats: AdminStats; prevPending: number | null }
  | { type: 'ACTION_ERROR'; error: string }
  | { type: 'ACTION_CLEAR_ERROR' }
  | { type: 'BULK_START' }
  | { type: 'BULK_SUCCESS'; appointments: AdminAppointment[]; stats: AdminStats; prevPending: number | null; failedCount: number }
  | { type: 'BULK_ERROR'; error: string }
  | { type: 'SET_VIEW_MODE'; viewMode: ViewMode }
  | { type: 'SET_ARCHIVE_MODE'; archiveMode: ArchiveMode }
  | { type: 'SET_FILTER'; filter: FilterStatus }
  | { type: 'SET_CALENDAR_DAY'; day: string | null }
  | { type: 'TOGGLE_SELECT'; id: string }
  | { type: 'TOGGLE_SELECT_ALL'; ids: string[] }
  | { type: 'CLEAR_SELECTED' }
  | { type: 'CLEAR_NEW_COUNT' }
  | { type: 'SESSION_EXPIRED' };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function adminReducer(state: AdminState, action: AdminAction): AdminState {
  switch (action.type) {

    case 'LOAD_START':
      return { ...state, loading: true, error: '' };

    case 'LOAD_SUCCESS': {
      const pendingNow = action.stats.pending;
      const newCount   = action.prevPending !== null && pendingNow > action.prevPending
        ? state.newCount + (pendingNow - action.prevPending)
        : state.newCount;
      return {
        ...state,
        loading:      false,
        appointments: action.appointments,
        stats:        action.stats,
        newCount,
      };
    }

    case 'LOAD_ERROR':
      return { ...state, loading: false, error: action.error };

    case 'ACTION_START':
      return { ...state, actingIds: new Set(action.ids), actingAction: action.action, actionError: '' };

    case 'ACTION_SUCCESS': {
      const pendingNow = action.stats.pending;
      const newCount   = action.prevPending !== null && pendingNow > action.prevPending
        ? state.newCount + (pendingNow - action.prevPending)
        : state.newCount;
      return {
        ...state,
        actingIds:    new Set(),
        actingAction: '',
        appointments: action.appointments,
        stats:        action.stats,
        newCount,
      };
    }

    case 'ACTION_ERROR':
      return { ...state, actingIds: new Set(), actingAction: '', actionError: action.error };

    case 'ACTION_CLEAR_ERROR':
      return { ...state, actionError: '' };

    case 'BULK_START':
      return { ...state, bulkLoading: true, actionError: '' };

    case 'BULK_SUCCESS': {
      const pendingNow = action.stats.pending;
      const newCount   = action.prevPending !== null && pendingNow > action.prevPending
        ? state.newCount + (pendingNow - action.prevPending)
        : state.newCount;
      return {
        ...state,
        bulkLoading:  false,
        selected:     new Set(),
        appointments: action.appointments,
        stats:        action.stats,
        actionError:  action.failedCount > 0 ? `${action.failedCount} randevu işlenemedi.` : '',
        newCount,
      };
    }

    case 'BULK_ERROR':
      return { ...state, bulkLoading: false, actionError: action.error };

    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.viewMode };

    case 'SET_ARCHIVE_MODE':
      return { ...state, archiveMode: action.archiveMode, filter: 'all', selected: new Set() };

    case 'SET_FILTER':
      return { ...state, filter: action.filter, selected: new Set() };

    case 'SET_CALENDAR_DAY':
      return { ...state, calendarDay: action.day };

    case 'TOGGLE_SELECT': {
      const next = new Set(state.selected);
      next.has(action.id) ? next.delete(action.id) : next.add(action.id);
      return { ...state, selected: next };
    }

    case 'TOGGLE_SELECT_ALL':
      if (action.ids.every((id) => state.selected.has(id))) {
        return { ...state, selected: new Set() };
      }
      return { ...state, selected: new Set(action.ids) };

    case 'CLEAR_SELECTED':
      return { ...state, selected: new Set() };

    case 'CLEAR_NEW_COUNT':
      return { ...state, newCount: 0 };

    case 'SESSION_EXPIRED':
      return { ...initialAdminState };

    default:
      return state;
  }
}
