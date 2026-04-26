import { useReducer, useEffect, useRef, useCallback } from 'react';
import { adminApi, ADMIN_TOKEN_KEY } from '../services/api';
import { adminReducer, initialAdminState } from '../store/adminReducer';
import type { AdminState, FilterStatus, ViewMode, ArchiveMode } from '../store/adminReducer';

const POLL_MS     = 30_000;
const STORAGE_KEY = ADMIN_TOKEN_KEY;

// ---------------------------------------------------------------------------
// Derived data helpers (pure — no side effects)
// ---------------------------------------------------------------------------

const ACTIVE_STATUSES  = new Set(['pending', 'approved']);
const ARCHIVE_STATUSES = new Set(['rejected', 'cancelled', 'completed']);

function deriveFiltered(state: AdminState) {
  const modeFiltered =
    state.archiveMode === 'all'
      ? state.appointments
      : state.appointments.filter((a) =>
          state.archiveMode === 'active'
            ? ACTIVE_STATUSES.has(a.status)
            : ARCHIVE_STATUSES.has(a.status),
        );

  const filtered = state.filter === 'all'
    ? modeFiltered
    : modeFiltered.filter((a) => a.status === state.filter);

  const filterTabs =
    state.archiveMode === 'active'
      ? [
          { key: 'all' as FilterStatus,      label: 'Tümü',     count: modeFiltered.length },
          { key: 'pending' as FilterStatus,  label: 'Bekleyen', count: modeFiltered.filter((a) => a.status === 'pending').length },
          { key: 'approved' as FilterStatus, label: 'Onaylı',   count: modeFiltered.filter((a) => a.status === 'approved').length },
        ]
      : state.archiveMode === 'archive'
        ? [
            { key: 'all' as FilterStatus,       label: 'Tümü',       count: modeFiltered.length },
            { key: 'rejected' as FilterStatus,  label: 'Reddedildi', count: modeFiltered.filter((a) => a.status === 'rejected').length },
            { key: 'cancelled' as FilterStatus, label: 'İptal',      count: modeFiltered.filter((a) => a.status === 'cancelled').length },
            { key: 'completed' as FilterStatus, label: 'Tamamlandı', count: modeFiltered.filter((a) => a.status === 'completed').length },
          ]
        : [
            { key: 'all' as FilterStatus,       label: 'Tümü',       count: modeFiltered.length },
            { key: 'pending' as FilterStatus,   label: 'Bekleyen',   count: modeFiltered.filter((a) => a.status === 'pending').length },
            { key: 'approved' as FilterStatus,  label: 'Onaylı',     count: modeFiltered.filter((a) => a.status === 'approved').length },
            { key: 'rejected' as FilterStatus,  label: 'Reddedildi', count: modeFiltered.filter((a) => a.status === 'rejected').length },
            { key: 'cancelled' as FilterStatus, label: 'İptal',      count: modeFiltered.filter((a) => a.status === 'cancelled').length },
            { key: 'completed' as FilterStatus, label: 'Tamamlandı', count: modeFiltered.filter((a) => a.status === 'completed').length },
          ];

  return { modeFiltered, filtered, filterTabs };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAppointments() {
  const [state, dispatch] = useReducer(adminReducer, initialAdminState);
  const prevPendingRef    = useRef<number | null>(null);
  const pollRef           = useRef<ReturnType<typeof setInterval> | null>(null);

  const isAuthenticated = !!sessionStorage.getItem(STORAGE_KEY);

  // ── Data loading ────────────────────────────────────────────────────────

  const loadData = useCallback(async (silent = false) => {
    if (!sessionStorage.getItem(STORAGE_KEY)) return;
    if (!silent) dispatch({ type: 'LOAD_START' });
    try {
      const [aptsRes, statsData] = await Promise.all([
        adminApi.getAppointments(),
        adminApi.getStats(),
      ]);
      dispatch({
        type:         'LOAD_SUCCESS',
        appointments: aptsRes?.appointments ?? [],
        stats:        statsData,
        prevPending:  prevPendingRef.current,
      });
      prevPendingRef.current = statsData?.pending ?? 0;
    } catch (err: unknown) {
      const e   = err as { error?: string; message?: string };
      const msg = e?.error ?? e?.message ?? 'Sunucuya bağlanılamadı.';
      if (msg.toLowerCase().includes('oturum') || msg.toLowerCase().includes('token')) {
        sessionStorage.removeItem(STORAGE_KEY);
        window.location.href = '/admin/login';
      } else if (!silent) {
        dispatch({ type: 'LOAD_ERROR', error: msg });
      }
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      window.location.href = '/admin/login';
      return;
    }
    loadData();
    pollRef.current = setInterval(() => loadData(true), POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isAuthenticated, loadData]);

  // ── Reload helper (after mutation) ──────────────────────────────────────

  const reloadSilent = useCallback(async (): Promise<{ appointments: typeof state.appointments; stats: NonNullable<typeof state.stats> } | null> => {
    try {
      const [aptsRes, statsData] = await Promise.all([
        adminApi.getAppointments(),
        adminApi.getStats(),
      ]);
      return { appointments: aptsRes?.appointments ?? [], stats: statsData };
    } catch {
      return null;
    }
  }, []);

  // ── Single action ────────────────────────────────────────────────────────

  const handleAction = useCallback(async (
    id: string,
    action: 'approve' | 'reject' | 'cancel' | 'complete',
  ) => {
    dispatch({ type: 'ACTION_START', ids: [id], action });
    try {
      if (action === 'approve')     await adminApi.approve(id);
      else if (action === 'reject') await adminApi.reject(id);
      else if (action === 'cancel') await adminApi.cancel(id);
      else                          await adminApi.complete(id);

      const fresh = await reloadSilent();
      if (fresh) {
        dispatch({ type: 'ACTION_SUCCESS', appointments: fresh.appointments, stats: fresh.stats, prevPending: prevPendingRef.current });
        prevPendingRef.current = fresh.stats.pending;
      }
    } catch (err: unknown) {
      const e = err as { error?: string };
      dispatch({ type: 'ACTION_ERROR', error: e.error ?? 'İşlem başarısız oldu.' });
    }
  }, [reloadSilent]);

  // ── Bulk action ──────────────────────────────────────────────────────────

  const handleBulkAction = useCallback(async (action: 'cancel' | 'complete' | 'delete') => {
    if (state.selected.size === 0) return;
    dispatch({ type: 'BULK_START' });
    try {
      const res = await adminApi.bulkAction(Array.from(state.selected), action);
      const fresh = await reloadSilent();
      if (fresh) {
        dispatch({
          type:         'BULK_SUCCESS',
          appointments: fresh.appointments,
          stats:        fresh.stats,
          prevPending:  prevPendingRef.current,
          failedCount:  res.failed,
        });
        prevPendingRef.current = fresh.stats.pending;
      }
    } catch (err: unknown) {
      const e = err as { error?: string };
      dispatch({ type: 'BULK_ERROR', error: e.error ?? 'Toplu işlem başarısız oldu.' });
    }
  }, [state.selected, reloadSilent]);

  // ── Dispatch wrappers ────────────────────────────────────────────────────

  const setViewMode    = (viewMode: ViewMode)       => dispatch({ type: 'SET_VIEW_MODE',    viewMode });
  const setArchiveMode = (archiveMode: ArchiveMode) => dispatch({ type: 'SET_ARCHIVE_MODE', archiveMode });
  const setFilter      = (filter: FilterStatus)     => dispatch({ type: 'SET_FILTER',       filter });
  const setCalendarDay = (day: string | null)        => dispatch({ type: 'SET_CALENDAR_DAY', day });
  const toggleSelect   = (id: string)               => dispatch({ type: 'TOGGLE_SELECT',    id });
  const clearSelected  = ()                          => dispatch({ type: 'CLEAR_SELECTED' });
  const clearNewCount  = ()                          => dispatch({ type: 'CLEAR_NEW_COUNT' });
  const clearActionError = ()                        => dispatch({ type: 'ACTION_CLEAR_ERROR' });

  const toggleSelectAll = (filteredIds: string[]) =>
    dispatch({ type: 'TOGGLE_SELECT_ALL', ids: filteredIds });

  const derived = deriveFiltered(state);

  return {
    // State
    ...state,
    // Derived
    ...derived,
    // Actions
    loadData,
    handleAction,
    handleBulkAction,
    setViewMode,
    setArchiveMode,
    setFilter,
    setCalendarDay,
    toggleSelect,
    toggleSelectAll,
    clearSelected,
    clearNewCount,
    clearActionError,
  };
}

export type UseAppointmentsReturn = ReturnType<typeof useAppointments>;
