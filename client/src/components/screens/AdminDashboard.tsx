import { useState, useCallback } from 'react';
import { DateTime } from 'luxon';
import {
  LogOut, RefreshCw, Bell, XCircle, Loader2,
  AlertTriangle, Calendar, List, Archive,
  ChevronLeft, ChevronRight, CalendarCheck,
} from 'lucide-react';
import { Logo } from '../ui/Logo';
import { AIChat } from '../admin/AIChat';
import { StatCards } from '../admin/StatCards';
import { BulkActionBar } from '../admin/BulkActionBar';
import { AppointmentTable, StatusBadge, UrgencyBadge, URGENCY_CONFIG } from '../admin/AppointmentTable';
import { useAppointments } from '../../hooks/useAppointments';
import { cn } from '../../lib/cn';
import { ADMIN_TOKEN_KEY, type AdminAppointment } from '../../services/api';
import { formatDisplayDateTime } from '@shared/dateUtils';
import { TIMEZONE } from '@shared/constants';

// ---------------------------------------------------------------------------
// Enquiry detail drawer
// ---------------------------------------------------------------------------

function EnquiryDrawer({ apt, onClose }: { apt: AdminAppointment; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0 bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div className="form-card w-full max-w-lg space-y-4 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white">Talep Detayı</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-3">
          {/* Triage — only HIGH/CRITICAL */}
          {apt.triage && URGENCY_CONFIG[apt.triage.urgency] && (
            <div className={cn('rounded-xl px-4 py-3 space-y-1.5', URGENCY_CONFIG[apt.triage.urgency]!.row, 'bg-current/5')}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide opacity-70">AI Triaj</span>
                <UrgencyBadge triage={apt.triage} />
              </div>
              {apt.triage.adminSummary && (
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{apt.triage.adminSummary}</p>
              )}
              <p className="text-[11px] text-slate-500">
                Duygu: <strong>{apt.triage.sentiment}</strong> · Netlik: <strong>{apt.triage.clarity}/100</strong>
              </p>
            </div>
          )}

          <div className="rounded-xl inset-surface border border-slate-200 dark:border-slate-700/50 px-4 py-4 space-y-3 text-sm">
            {([
              { label: 'İsim',    value: apt.name },
              { label: 'E-posta', value: apt.email },
              { label: 'Ref',     value: apt.bookingReference, mono: true },
              { label: 'Tarih',   value: formatDisplayDateTime(apt.dateTime, TIMEZONE) },
            ] as { label: string; value: string; mono?: boolean }[]).map(({ label, value, mono }) => (
              <div key={label} className="flex items-start gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 w-16 flex-shrink-0 pt-0.5">{label}</span>
                <span className={cn('text-slate-700 dark:text-slate-300', mono ? 'font-mono text-xs' : 'text-sm')}>{value}</span>
              </div>
            ))}
            <div className="flex items-start gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 w-16 flex-shrink-0 pt-0.5">Durum</span>
              <StatusBadge status={apt.status} />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Talep</span>
              <p className="mt-1 text-slate-700 dark:text-slate-300 leading-relaxed">{apt.enquiry}</p>
            </div>
            {apt.enquirySummary && (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">AI Özeti</span>
                <p className="mt-1 text-slate-600 dark:text-slate-400 leading-relaxed italic">{apt.enquirySummary}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Calendar view — timezone-correct via Luxon
// ---------------------------------------------------------------------------

function CalendarView({ appointments, selectedDay, onSelectDay }: {
  appointments: AdminAppointment[];
  selectedDay:  string | null;
  onSelectDay:  (day: string | null) => void;
}) {
  const [cal, setCal] = useState(() => {
    const now = DateTime.now().setZone(TIMEZONE);
    return { year: now.year, month: now.month }; // Luxon months are 1-based
  });

  // Build a map of day → status counts using Luxon for timezone-safe parsing
  const dayMap: Record<string, { pending: number; approved: number; other: number }> = {};
  appointments.forEach((apt) => {
    const dt  = DateTime.fromISO(apt.dateTime, { zone: TIMEZONE });
    const key = dt.toFormat('yyyy-MM-dd');
    if (!dayMap[key]) dayMap[key] = { pending: 0, approved: 0, other: 0 };
    if (apt.status === 'pending')       dayMap[key].pending++;
    else if (apt.status === 'approved') dayMap[key].approved++;
    else                                dayMap[key].other++;
  });

  const firstDay = DateTime.fromObject({ year: cal.year, month: cal.month, day: 1 }, { zone: TIMEZONE });
  const lastDay  = firstDay.endOf('month');
  const startDow = (firstDay.weekday - 1 + 7) % 7; // Monday = 0 (Luxon: Mon=1)
  const daysInMonth = lastDay.day;

  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr = DateTime.now().setZone(TIMEZONE).toFormat('yyyy-MM-dd');
  const monthName = firstDay.setLocale('tr').toFormat('LLLL yyyy');

  function getDayStr(day: number) {
    return DateTime.fromObject({ year: cal.year, month: cal.month, day }, { zone: TIMEZONE }).toFormat('yyyy-MM-dd');
  }

  function navMonth(delta: number) {
    setCal((c) => {
      const next = DateTime.fromObject({ year: c.year, month: c.month }, { zone: TIMEZONE }).plus({ months: delta });
      return { year: next.year, month: next.month };
    });
  }

  const selectedDayAppointments = selectedDay
    ? appointments.filter((apt) => {
        const dt = DateTime.fromISO(apt.dateTime, { zone: TIMEZONE });
        return dt.toFormat('yyyy-MM-dd') === selectedDay;
      })
    : [];

  return (
    <div className="grid lg:grid-cols-[320px_1fr] gap-6">
      {/* Calendar grid */}
      <div className="form-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => navMonth(-1)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold capitalize text-slate-900 dark:text-white">{monthName}</span>
          <button onClick={() => navMonth(1)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 text-[11px] font-semibold text-center text-slate-400 uppercase tracking-wide">
          {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((d) => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((day, i) => {
            if (!day) return <div key={`e-${i}`} className="aspect-square" />;
            const dayStr    = getDayStr(day);
            const counts    = dayMap[dayStr];
            const isToday   = dayStr === todayStr;
            const isSelected = dayStr === selectedDay;
            return (
              <button
                key={dayStr}
                onClick={() => onSelectDay(isSelected ? null : dayStr)}
                className={cn(
                  'aspect-square flex flex-col items-center justify-center rounded-lg text-xs font-medium transition-all',
                  isSelected
                    ? 'bg-brand-500 text-white shadow-sm'
                    : isToday
                      ? 'bg-brand-500/15 text-brand-700 dark:text-brand-300'
                      : counts
                        ? 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                        : 'text-slate-400 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50',
                )}
              >
                {day}
                {counts && (
                  <div className="flex gap-0.5 mt-0.5">
                    {counts.pending  > 0 && <div className="w-1 h-1 rounded-full bg-amber-400" />}
                    {counts.approved > 0 && <div className="w-1 h-1 rounded-full bg-emerald-400" />}
                    {counts.other    > 0 && <div className="w-1 h-1 rounded-full bg-slate-400" />}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="pt-2 border-t border-slate-200 dark:border-slate-700/50 flex flex-wrap gap-3 text-[11px] text-slate-500">
          {[['bg-amber-400', 'Bekliyor'], ['bg-emerald-400', 'Onaylı'], ['bg-slate-400', 'Diğer']].map(([cls, label]) => (
            <div key={label} className="flex items-center gap-1">
              <div className={cn('w-2 h-2 rounded-full', cls)} />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Day detail */}
      <div className="form-card p-5 space-y-4">
        {selectedDay ? (
          <>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 dark:text-white">
                {DateTime.fromISO(selectedDay, { zone: TIMEZONE }).setLocale('tr')
                  .toFormat("cccc, d LLLL yyyy")}
              </h3>
              <button onClick={() => onSelectDay(null)} className="text-xs text-brand-500 hover:underline">
                Temizle
              </button>
            </div>
            {selectedDayAppointments.length === 0 ? (
              <div className="flex flex-col items-center py-10 space-y-2 text-center">
                <CalendarCheck className="w-8 h-8 text-slate-300 dark:text-slate-700" />
                <p className="text-sm text-slate-400">Bu gün için randevu yok.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDayAppointments.map((apt) => (
                  <div key={apt._id} className="rounded-xl inset-surface border border-slate-200 dark:border-slate-700/50 px-4 py-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{apt.name}</p>
                      <p className="text-xs text-slate-500">{formatDisplayDateTime(apt.dateTime, TIMEZONE)}</p>
                    </div>
                    <StatusBadge status={apt.status} />
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center space-y-2">
            <CalendarCheck className="w-10 h-10 text-slate-300 dark:text-slate-700" />
            <p className="text-sm font-medium text-slate-500">Bir gün seçin</p>
            <p className="text-xs text-slate-400">Takvimden bir güne tıklayarak randevuları görün.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main — AdminDashboard (orchestrator only)
// ---------------------------------------------------------------------------

export function AdminDashboard() {
  const {
    stats, loading, error, actionError,
    viewMode, archiveMode, filter,
    calendarDay, selected, bulkLoading,
    actingIds, actingAction, newCount,
    filtered, modeFiltered, filterTabs,
    loadData,
    handleAction, handleBulkAction,
    setViewMode, setArchiveMode, setFilter,
    setCalendarDay, toggleSelect, toggleSelectAll,
    clearSelected, clearNewCount, clearActionError,
  } = useAppointments();

  const [drawerApt, setDrawerApt] = useState<AdminAppointment | null>(null);

  const handleNotificationClick = useCallback(() => {
    clearNewCount();
    setArchiveMode('active');
    setFilter('pending');
  }, [clearNewCount, setArchiveMode, setFilter]);

  return (
    <div className="min-h-screen page-bg">
      {drawerApt && <EnquiryDrawer apt={drawerApt} onClose={() => setDrawerApt(null)} />}

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700/60">
        <div className="w-full px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo className="w-7 h-7 flex-shrink-0" />
            <span className="font-bold text-slate-900 dark:text-white text-sm">Admin Paneli</span>
            <a href="/" className="ml-2 text-xs text-slate-400 hover:text-brand-500 transition-colors hidden sm:inline">
              ← Ana Sayfa
            </a>
          </div>
          <div className="flex items-center gap-2">
            {newCount > 0 && (
              <button
                onClick={handleNotificationClick}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
                           bg-amber-500/15 text-amber-700 dark:text-amber-300
                           border border-amber-300 dark:border-amber-500/30
                           hover:bg-amber-500/25 transition-colors animate-pulse"
              >
                <Bell className="w-3.5 h-3.5" />
                {newCount} Yeni
              </button>
            )}
            <button
              onClick={() => loadData()}
              disabled={loading}
              title="Yenile"
              className="p-2 rounded-lg text-slate-500 hover:text-brand-500 hover:bg-brand-500/10 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </button>
            <button
              onClick={() => { sessionStorage.removeItem(ADMIN_TOKEN_KEY); window.location.href = '/admin/login'; }}
              title="Çıkış"
              className="p-2 rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="w-full px-4 sm:px-6 pt-6 pb-6 space-y-4">

        {/* Error banners */}
        {error && (
          <div className="rounded-xl border border-red-300 dark:border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
        {actionError && (
          <div className="rounded-xl border border-red-300 dark:border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {actionError}
            <button onClick={clearActionError} className="ml-auto text-red-400 hover:text-red-600">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Stat cards */}
        {loading && !stats ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
          </div>
        ) : stats && (
          <StatCards stats={stats} />
        )}

        {/* View mode toggles */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Active / Archive */}
          <div className="inline-flex rounded-xl p-1 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50">
            {([
              { key: 'active',  label: 'Aktif', icon: List    },
              { key: 'archive', label: 'Arşiv', icon: Archive },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setArchiveMode(key)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                  archiveMode === key
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* List / Calendar */}
          <div className="inline-flex rounded-xl p-1 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50">
            {([
              { key: 'list',     label: 'Liste',  icon: List     },
              { key: 'calendar', label: 'Takvim', icon: Calendar },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setViewMode(key)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                  viewMode === key
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {viewMode === 'calendar' ? (
          <CalendarView
            appointments={modeFiltered}
            selectedDay={calendarDay}
            onSelectDay={setCalendarDay}
          />
        ) : (
          <AppointmentTable
            appointments={filtered}
            selected={selected}
            actingIds={actingIds}
            actingAction={actingAction}
            bulkLoading={bulkLoading}
            filterTabs={filterTabs}
            activeFilter={filter}
            onFilterChange={(f) => setFilter(f as typeof filter)}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            onAction={handleAction}
            onDrawer={setDrawerApt}
          />
        )}
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="w-full px-4 sm:px-6 py-3 border-t border-slate-200/60 dark:border-slate-700/40 text-center">
        <p className="text-xs text-slate-400">ReserveAI v1.0 © 2026 — Tüm Hakları Saklıdır</p>
      </footer>

      {/* Chat widget — bottom-right (z-50 stays above bulk bar z-40) */}
      <AIChat adminKey={sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? ''} />

      {/* Bulk action bar — bottom-center (z-40) */}
      <BulkActionBar
        count={selected.size}
        loading={bulkLoading}
        archiveMode={archiveMode}
        onCancel={() => handleBulkAction('cancel')}
        onComplete={() => handleBulkAction('complete')}
        onDelete={() => handleBulkAction('delete')}
        onClear={clearSelected}
      />
    </div>
  );
}
