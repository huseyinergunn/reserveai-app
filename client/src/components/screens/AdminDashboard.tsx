import { useEffect, useRef, useState, useCallback } from 'react';
import {
  LayoutDashboard, LogOut, RefreshCw, Bell, CheckCircle2, XCircle, Ban,
  Clock, Users, CalendarCheck, Loader2, Eye, AlertTriangle,
  Calendar, List, Archive, ChevronLeft, ChevronRight, CheckSquare,
  Square, Trash2, Award,
} from 'lucide-react';
import { adminApi, type AdminAppointment, type AdminStats } from '../../services/api';
import { formatDisplayDateTime } from '@shared/dateUtils';
import { TIMEZONE } from '@shared/constants';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'admin_key';
const POLL_MS     = 30_000;

const STATUS_LABEL: Record<string, string> = {
  pending:   'Bekliyor',
  approved:  'Onaylandı',
  rejected:  'Reddedildi',
  cancelled: 'İptal',
  completed: 'Tamamlandı',
};

const STATUS_BADGE: Record<string, string> = {
  pending:   'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30',
  approved:  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30',
  rejected:  'bg-red-500/15 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-500/30',
  cancelled: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-600',
  completed: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-500/30',
};

type ViewMode   = 'list' | 'calendar';
type ArchiveMode = 'active' | 'archive';
type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed';
type ActionState  = { ids: string[]; action: string } | null;

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[status] ?? STATUS_BADGE.cancelled}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Action button
// ---------------------------------------------------------------------------

function ActionBtn({ label, icon: Icon, loading, disabled, onClick, colorClass, title }: {
  label: string; icon: React.ElementType; loading: boolean; disabled: boolean;
  onClick: () => void; colorClass: string; title?: string;
}) {
  return (
    <button
      onClick={onClick} disabled={disabled} title={title ?? label}
      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border
                  transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${colorClass}`}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

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
        <div className="rounded-xl inset-surface border border-slate-200 dark:border-slate-700/50 px-4 py-4 space-y-3 text-sm">
          {([
            { label: 'İsim',    value: apt.name },
            { label: 'E-posta', value: apt.email },
            { label: 'Ref',     value: apt.bookingReference, mono: true },
            { label: 'Tarih',   value: formatDisplayDateTime(apt.dateTime, TIMEZONE) },
          ] as { label: string; value: string; mono?: boolean }[]).map(({ label, value, mono }) => (
            <div key={label} className="flex items-start gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 w-16 flex-shrink-0 pt-0.5">{label}</span>
              <span className={`text-slate-700 dark:text-slate-300 ${mono ? 'font-mono text-xs' : 'text-sm'}`}>{value}</span>
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
  );
}

// ---------------------------------------------------------------------------
// Calendar view
// ---------------------------------------------------------------------------

function CalendarView({ appointments, onSelectDay, selectedDay }: {
  appointments: AdminAppointment[];
  onSelectDay:  (day: string | null) => void;
  selectedDay:  string | null;
}) {
  const [cal, setCal] = useState<{ year: number; month: number }>(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });

  // Build appointment map: 'YYYY-MM-DD' → status counts
  const dayMap: Record<string, { pending: number; approved: number; other: number }> = {};
  appointments.forEach((apt) => {
    const d   = new Date(apt.dateTime);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!dayMap[key]) dayMap[key] = { pending: 0, approved: 0, other: 0 };
    if (apt.status === 'pending')        dayMap[key].pending++;
    else if (apt.status === 'approved')  dayMap[key].approved++;
    else                                 dayMap[key].other++;
  });

  const firstDay = new Date(cal.year, cal.month, 1);
  const lastDay  = new Date(cal.year, cal.month + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7; // Mon = 0
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const monthName = firstDay.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  function navMonth(delta: number) {
    setCal((c) => {
      const d = new Date(c.year, c.month + delta);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  function getDayStr(day: number) {
    return `${cal.year}-${String(cal.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const selectedDayAppointments = selectedDay
    ? appointments.filter((apt) => {
        const d = new Date(apt.dateTime);
        return getDayStr(d.getDate()) === selectedDay
          && d.getMonth() === (parseInt(selectedDay.split('-')[1]) - 1)
          && d.getFullYear() === parseInt(selectedDay.split('-')[0]);
      })
    : [];

  return (
    <div className="grid lg:grid-cols-[320px_1fr] gap-6">
      {/* Calendar grid */}
      <div className="form-card p-5 space-y-4">
        {/* Month nav */}
        <div className="flex items-center justify-between">
          <button onClick={() => navMonth(-1)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold capitalize text-slate-900 dark:text-white">{monthName}</span>
          <button onClick={() => navMonth(1)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 text-[11px] font-semibold text-center text-slate-400 uppercase tracking-wide">
          {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((d) => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>

        {/* Cells */}
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} className="aspect-square" />;
            const dayStr = getDayStr(day);
            const counts = dayMap[dayStr];
            const isToday    = dayStr === todayStr;
            const isSelected = dayStr === selectedDay;
            return (
              <button
                key={dayStr}
                onClick={() => onSelectDay(isSelected ? null : dayStr)}
                className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs font-medium transition-all
                  ${isSelected
                    ? 'bg-brand-500 text-white shadow-sm'
                    : isToday
                      ? 'bg-brand-500/15 text-brand-700 dark:text-brand-300'
                      : counts
                        ? 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                        : 'text-slate-400 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
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

        {/* Legend */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-700/50 flex flex-wrap gap-3 text-[11px] text-slate-500">
          {[['bg-amber-400', 'Bekliyor'], ['bg-emerald-400', 'Onaylı'], ['bg-slate-400', 'Diğer']].map(([cls, label]) => (
            <div key={label} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${cls}`} />
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
                {new Date(selectedDay + 'T12:00:00').toLocaleDateString('tr-TR', {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                })}
              </h3>
              <button onClick={() => onSelectDay(null)} className="text-xs text-brand-500 hover:underline">
                Temizle
              </button>
            </div>
            {selectedDayAppointments.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">Bu gün için randevu yok.</p>
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
// Stat card
// ---------------------------------------------------------------------------

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <div className="form-card flex items-center gap-4 p-5">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{value}</p>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main AdminDashboard
// ---------------------------------------------------------------------------

export function AdminDashboard() {
  const adminKey = sessionStorage.getItem(STORAGE_KEY);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!adminKey) window.location.href = '/admin/login';
  }, [adminKey]);

  const [appointments, setAppointments] = useState<AdminAppointment[]>([]);
  const [stats, setStats]               = useState<AdminStats | null>(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [actionError, setActionError]   = useState('');

  // View modes
  const [viewMode,    setViewMode]    = useState<ViewMode>('list');
  const [archiveMode, setArchiveMode] = useState<ArchiveMode>('active');
  const [filter, setFilter]           = useState<FilterStatus>('all');
  const [calendarDay, setCalendarDay] = useState<string | null>(null);

  // Bulk operations
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Single-item actions
  const [actionState, setActionState] = useState<ActionState>(null);

  // Drawer
  const [drawerApt, setDrawerApt]   = useState<AdminAppointment | null>(null);

  // New-appointment notification
  const [newCount, setNewCount]     = useState(0);
  const prevPendingRef              = useRef<number | null>(null);
  const pollRef                     = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadData = useCallback(async (key: string, silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [{ appointments: apts }, statsData] = await Promise.all([
        adminApi.getAppointments(key),
        adminApi.getStats(key),
      ]);
      setAppointments(apts);
      setStats(statsData);
      const pendingNow = statsData.pending;
      if (prevPendingRef.current !== null && pendingNow > prevPendingRef.current) {
        setNewCount((c) => c + (pendingNow - (prevPendingRef.current ?? 0)));
      }
      prevPendingRef.current = pendingNow;
    } catch (err: unknown) {
      const e   = err as { error?: string };
      const msg = e.error ?? 'Sunucuya bağlanılamadı.';
      if (msg.includes('Yetkisiz') || msg.includes('Unauthorized')) {
        sessionStorage.removeItem(STORAGE_KEY);
        window.location.href = '/admin/login';
      } else {
        setError(msg);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!adminKey) return;
    loadData(adminKey);
    pollRef.current = setInterval(() => loadData(adminKey, true), POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [adminKey, loadData]);

  // ── Single action ─────────────────────────────────────────────────────────

  async function handleAction(id: string, action: 'approve' | 'reject' | 'cancel' | 'complete') {
    if (!adminKey) return;
    setActionState({ ids: [id], action });
    setActionError('');
    try {
      if (action === 'approve')       await adminApi.approve(adminKey, id);
      else if (action === 'reject')   await adminApi.reject(adminKey, id);
      else if (action === 'cancel')   await adminApi.cancel(adminKey, id);
      else                            await adminApi.complete(adminKey, id);
      setTimeout(() => loadData(adminKey, true), 1800);
    } catch (err: unknown) {
      const e = err as { error?: string };
      setActionError(e.error ?? 'İşlem başarısız oldu.');
    } finally {
      setActionState(null);
    }
  }

  // ── Bulk action ───────────────────────────────────────────────────────────

  async function handleBulkAction(action: 'cancel' | 'complete') {
    if (!adminKey || selected.size === 0) return;
    setBulkLoading(true);
    setActionError('');
    try {
      const res = await adminApi.bulkAction(adminKey, Array.from(selected), action);
      if (res.failed > 0) setActionError(`${res.failed} randevu işlenemedi.`);
      setSelected(new Set());
      await loadData(adminKey, true);
    } catch (err: unknown) {
      const e = err as { error?: string };
      setActionError(e.error ?? 'Toplu işlem başarısız oldu.');
    } finally {
      setBulkLoading(false);
    }
  }

  // ── Filtering ─────────────────────────────────────────────────────────────

  const ACTIVE_STATUSES  = new Set(['pending', 'approved']);
  const ARCHIVE_STATUSES = new Set(['rejected', 'cancelled', 'completed']);

  const modeFiltered = appointments.filter((a) =>
    archiveMode === 'active' ? ACTIVE_STATUSES.has(a.status) : ARCHIVE_STATUSES.has(a.status),
  );

  const filtered = filter === 'all'
    ? modeFiltered
    : modeFiltered.filter((a) => a.status === filter);

  const activeFilterTabs = archiveMode === 'active'
    ? [
        { key: 'all' as FilterStatus,      label: 'Tümü',    count: modeFiltered.length },
        { key: 'pending' as FilterStatus,  label: 'Bekleyen', count: modeFiltered.filter((a) => a.status === 'pending').length },
        { key: 'approved' as FilterStatus, label: 'Onaylı',   count: modeFiltered.filter((a) => a.status === 'approved').length },
      ]
    : [
        { key: 'all' as FilterStatus,       label: 'Tümü',         count: modeFiltered.length },
        { key: 'rejected' as FilterStatus,  label: 'Reddedildi',   count: modeFiltered.filter((a) => a.status === 'rejected').length },
        { key: 'cancelled' as FilterStatus, label: 'İptal',        count: modeFiltered.filter((a) => a.status === 'cancelled').length },
        { key: 'completed' as FilterStatus, label: 'Tamamlandı',   count: modeFiltered.filter((a) => a.status === 'completed').length },
      ];

  // ── Bulk checkbox helpers ─────────────────────────────────────────────────

  const allSelected    = filtered.length > 0 && filtered.every((a) => selected.has(a._id));
  const someSelected   = filtered.some((a) => selected.has(a._id));

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((a) => a._id)));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (!adminKey) return null; // redirecting

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen page-bg">
      {drawerApt && <EnquiryDrawer apt={drawerApt} onClose={() => setDrawerApt(null)} />}

      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <LayoutDashboard className="w-5 h-5 text-brand-500" />
            <span className="font-bold text-slate-900 dark:text-white text-sm">Admin Paneli</span>
            <a href="/" className="ml-2 text-xs text-slate-400 hover:text-brand-500 transition-colors hidden sm:inline">
              ← Ana Sayfa
            </a>
          </div>
          <div className="flex items-center gap-2">
            {newCount > 0 && (
              <button
                onClick={() => { setNewCount(0); setArchiveMode('active'); setFilter('pending'); }}
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
              onClick={() => adminKey && loadData(adminKey)}
              disabled={loading}
              title="Yenile"
              className="p-2 rounded-lg text-slate-500 hover:text-brand-500 hover:bg-brand-500/10 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => { sessionStorage.removeItem(STORAGE_KEY); window.location.href = '/admin/login'; }}
              title="Çıkış"
              className="p-2 rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Errors */}
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
            <button onClick={() => setActionError('')} className="ml-auto text-red-400 hover:text-red-600">
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard icon={Users}        label="Toplam"    value={stats.total}     color="bg-blue-500/15 text-blue-600 dark:text-blue-400" />
            <StatCard icon={Clock}        label="Bekleyen"  value={stats.pending}   color="bg-amber-500/15 text-amber-600 dark:text-amber-400" />
            <StatCard icon={CalendarCheck}label="Onaylanan" value={stats.approved}  color="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" />
            <StatCard icon={Ban}          label="İptal/Red" value={stats.rejected + stats.cancelled} color="bg-red-500/15 text-red-600 dark:text-red-400" />
          </div>
        )}

        {/* Archive mode toggle + View mode toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Archive / Active toggle */}
          <div className="inline-flex rounded-xl p-1 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50">
            {([
              { key: 'active',  label: 'Aktif',  icon: List    },
              { key: 'archive', label: 'Arşiv',  icon: Archive },
            ] as { key: ArchiveMode; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => { setArchiveMode(key); setFilter('all'); setSelected(new Set()); }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all
                  ${archiveMode === key
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* List / Calendar view toggle */}
          <div className="inline-flex rounded-xl p-1 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50">
            {([
              { key: 'list',     label: 'Liste',   icon: List     },
              { key: 'calendar', label: 'Takvim',  icon: Calendar },
            ] as { key: ViewMode; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setViewMode(key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all
                  ${viewMode === key
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content area */}
        {viewMode === 'calendar' ? (
          <CalendarView
            appointments={modeFiltered}
            onSelectDay={setCalendarDay}
            selectedDay={calendarDay}
          />
        ) : (
          <div className="form-card p-0 overflow-hidden">
            {/* Status filter tabs */}
            <div className="flex items-center gap-1 px-5 pt-4 pb-3 border-b border-slate-200 dark:border-slate-700/50 overflow-x-auto">
              {activeFilterTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => { setFilter(tab.key); setSelected(new Set()); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors
                    ${filter === tab.key
                      ? 'bg-brand-500 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  {tab.label}
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold
                    ${filter === tab.key ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Table */}
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-slate-400 dark:text-slate-500 text-sm">
                Bu filtre için randevu bulunamadı.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="inset-deep border-b border-slate-200 dark:border-slate-700/50">
                      {/* Select all */}
                      <th className="w-10 pl-5 py-3">
                        <button
                          onClick={toggleAll}
                          className="text-slate-400 hover:text-brand-500 transition-colors"
                          title={allSelected ? 'Tümünü kaldır' : 'Tümünü seç'}
                        >
                          {allSelected ? (
                            <CheckSquare className="w-4 h-4 text-brand-500" />
                          ) : someSelected ? (
                            <CheckSquare className="w-4 h-4 text-slate-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      {['Müşteri', 'Tarih & Saat', 'E-posta', 'Durum', 'İşlemler'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                    {filtered.map((apt) => {
                      const isActing   = actionState?.ids.includes(apt._id);
                      const isSelected = selected.has(apt._id);
                      return (
                        <tr
                          key={apt._id}
                          className={`transition-colors ${isSelected ? 'bg-brand-500/5 dark:bg-brand-500/8' : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'}`}
                        >
                          {/* Checkbox */}
                          <td className="w-10 pl-5 py-3.5">
                            <button onClick={() => toggleOne(apt._id)} className="text-slate-400 hover:text-brand-500 transition-colors">
                              {isSelected
                                ? <CheckSquare className="w-4 h-4 text-brand-500" />
                                : <Square className="w-4 h-4" />}
                            </button>
                          </td>

                          {/* Name */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <p className="font-semibold text-slate-800 dark:text-slate-100">{apt.name}</p>
                            <p className="text-[10px] font-mono text-slate-400 mt-0.5">{apt.bookingReference}</p>
                          </td>

                          {/* DateTime */}
                          <td className="px-4 py-3.5 whitespace-nowrap text-slate-600 dark:text-slate-300 text-xs">
                            {formatDisplayDateTime(apt.dateTime, TIMEZONE)}
                          </td>

                          {/* Email */}
                          <td className="px-4 py-3.5 whitespace-nowrap text-slate-600 dark:text-slate-300 text-xs max-w-[180px] truncate">
                            {apt.email}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <StatusBadge status={apt.status} />
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setDrawerApt(apt)}
                                title="Detay"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-brand-500 hover:bg-brand-500/10 transition-colors"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {apt.status === 'pending' && (
                                <>
                                  <ActionBtn label="Onayla"  icon={CheckCircle2} loading={!!(isActing && actionState?.action === 'approve')} disabled={!!actionState || bulkLoading} onClick={() => handleAction(apt._id, 'approve')} colorClass="text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 hover:bg-emerald-500/20" />
                                  <ActionBtn label="Reddet"  icon={XCircle}      loading={!!(isActing && actionState?.action === 'reject')}  disabled={!!actionState || bulkLoading} onClick={() => handleAction(apt._id, 'reject')}  colorClass="text-red-700 dark:text-red-400 bg-red-500/10 border-red-300 dark:border-red-500/30 hover:bg-red-500/20" />
                                </>
                              )}

                              {apt.status === 'approved' && (
                                <ActionBtn label="Tamamlandı" icon={Award} loading={!!(isActing && actionState?.action === 'complete')} disabled={!!actionState || bulkLoading} onClick={() => handleAction(apt._id, 'complete')} colorClass="text-blue-700 dark:text-blue-400 bg-blue-500/10 border-blue-300 dark:border-blue-500/30 hover:bg-blue-500/20" />
                              )}

                              {(apt.status === 'pending' || apt.status === 'approved') && (
                                <ActionBtn label="İptal" icon={Ban} loading={!!(isActing && actionState?.action === 'cancel')} disabled={!!actionState || bulkLoading} onClick={() => handleAction(apt._id, 'cancel')} colorClass="text-slate-600 dark:text-slate-400 bg-slate-500/10 border-slate-300 dark:border-slate-600 hover:bg-slate-500/20" />
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Table footer */}
            <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700/40 flex items-center justify-between inset-deep">
              <p className="text-xs text-slate-400">{filtered.length} randevu</p>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />
                {POLL_MS / 1000}s'de otomatik yenilenir
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Bulk action floating bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
          <div className="flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl
                          bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {selected.size} randevu seçildi
            </span>
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
            <button
              onClick={() => handleBulkAction('cancel')}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                         text-red-700 dark:text-red-400 bg-red-500/10 border border-red-300 dark:border-red-500/30
                         hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              {bulkLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Toplu İptal
            </button>
            <button
              onClick={() => handleBulkAction('complete')}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                         text-blue-700 dark:text-blue-400 bg-blue-500/10 border border-blue-300 dark:border-blue-500/30
                         hover:bg-blue-500/20 transition-colors disabled:opacity-50"
            >
              {bulkLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Award className="w-3.5 h-3.5" />}
              Tamamlandı İşaretle
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="text-slate-400 hover:text-slate-600 transition-colors"
              title="Seçimi temizle"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
