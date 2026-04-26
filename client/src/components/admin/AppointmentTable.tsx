import { useState } from 'react';
import {
  CheckCircle2, XCircle, Ban, Award, Eye,
  CheckSquare, Square, Loader2, CalendarDays, CalendarCheck,
  Search, X, AlertTriangle,
} from 'lucide-react';
import { DateTime } from 'luxon';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/cn';
import type { AdminAppointment, AppointmentTriage } from '../../services/api';
import { formatDisplayDateTime } from '@shared/dateUtils';
import { TIMEZONE } from '@shared/constants';

// ---------------------------------------------------------------------------
// Status config — single source of truth for labels + colors
// ---------------------------------------------------------------------------

export const STATUS_CONFIG = {
  pending:   { label: 'Bekliyor',    badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30' },
  approved:  { label: 'Onaylandı',   badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30' },
  rejected:  { label: 'Reddedildi',  badge: 'bg-red-500/15 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-500/30' },
  cancelled: { label: 'İptal',       badge: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-600' },
  completed: { label: 'Tamamlandı',  badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-500/30' },
} as const;

export const URGENCY_CONFIG = {
  CRITICAL: { label: 'ACİL',    badge: 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-400/50 animate-pulse', row: 'border-l-2 border-l-red-500', dot: 'bg-red-500' },
  HIGH:     { label: 'ÖNEMLİ', badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-400/50',        row: 'border-l-2 border-l-amber-400', dot: 'bg-amber-500' },
  NORMAL:   null,
  LOW:      null,
} as const;

// ---------------------------------------------------------------------------
// Shared atoms
// ---------------------------------------------------------------------------

export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.cancelled;
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold', cfg.badge)}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {cfg.label}
    </span>
  );
}

export function UrgencyBadge({ triage }: { triage: AppointmentTriage | undefined }) {
  if (!triage) return null;
  const cfg = URGENCY_CONFIG[triage.urgency];
  if (!cfg) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold', cfg.badge)}>
      <span className={cn('w-1 h-1 rounded-full flex-shrink-0', cfg.dot)} />
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Action button — cva variant system
// ---------------------------------------------------------------------------

const actionBtn = cva(
  'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all duration-150 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95',
  {
    variants: {
      variant: {
        emerald: 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 hover:bg-emerald-500/25',
        sky:     'text-sky-700 dark:text-sky-300 bg-sky-500/10 border-sky-300 dark:border-sky-500/30 hover:bg-sky-500/25',
        danger:  'text-red-700 dark:text-red-400 bg-red-500/10 border-red-300 dark:border-red-500/30 hover:bg-red-500/25',
        slate:   'text-slate-600 dark:text-slate-400 bg-slate-500/10 border-slate-300 dark:border-slate-600 hover:bg-slate-500/20',
      },
    },
    defaultVariants: { variant: 'slate' },
  },
);

interface ActionBtnProps {
  label:    string;
  icon:     React.ElementType;
  loading:  boolean;
  disabled: boolean;
  onClick:  () => void;
  variant?: 'emerald' | 'sky' | 'danger' | 'slate';
  title?:   string;
}

function ActionBtn({ label, icon: Icon, loading, disabled, onClick, variant, title }: ActionBtnProps) {
  return (
    <button onClick={onClick} disabled={disabled} title={title ?? label} className={actionBtn({ variant })}>
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Row actions
// ---------------------------------------------------------------------------

interface RowActionsProps {
  apt:        AdminAppointment;
  isActing:   boolean;
  actingAction: string;
  isBusy:     boolean;
  onAction:   (id: string, action: 'approve' | 'reject' | 'cancel' | 'complete') => void;
  onDrawer:   (apt: AdminAppointment) => void;
}

function RowActions({ apt, isActing, actingAction, isBusy, onAction, onDrawer }: RowActionsProps) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        onClick={() => onDrawer(apt)}
        title="Detay"
        className="p-1.5 rounded-lg text-slate-400 hover:text-brand-500 hover:bg-brand-500/10 transition-all"
      >
        <Eye className="w-4 h-4" />
      </button>

      {apt.status === 'pending' && (
        <>
          <ActionBtn
            label="Onayla" icon={CheckCircle2} variant="emerald"
            loading={isActing && actingAction === 'approve'}
            disabled={isBusy}
            onClick={() => onAction(apt._id, 'approve')}
          />
          <ActionBtn
            label="Reddet" icon={XCircle} variant="danger"
            loading={isActing && actingAction === 'reject'}
            disabled={isBusy}
            onClick={() => onAction(apt._id, 'reject')}
          />
        </>
      )}

      {apt.status === 'approved' && (
        <ActionBtn
          label="Tamamlandı" icon={Award} variant="sky"
          loading={isActing && actingAction === 'complete'}
          disabled={isBusy}
          onClick={() => onAction(apt._id, 'complete')}
        />
      )}

      {(apt.status === 'pending' || apt.status === 'approved') && (
        <ActionBtn
          label="İptal" icon={Ban} variant="slate"
          loading={isActing && actingAction === 'cancel'}
          disabled={isBusy}
          onClick={() => onAction(apt._id, 'cancel')}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile card — shown below sm breakpoint
// ---------------------------------------------------------------------------

interface MobileCardProps {
  apt:          AdminAppointment;
  isSelected:   boolean;
  isActing:     boolean;
  actingAction: string;
  isBusy:       boolean;
  onToggle:     () => void;
  onAction:     (id: string, action: 'approve' | 'reject' | 'cancel' | 'complete') => void;
  onDrawer:     (apt: AdminAppointment) => void;
}

function MobileCard({ apt, isSelected, isActing, actingAction, isBusy, onToggle, onAction, onDrawer }: MobileCardProps) {
  const urgencyCfg = apt.triage ? URGENCY_CONFIG[apt.triage.urgency] : null;

  return (
    <div
      className={cn(
        'rounded-xl border p-3 space-y-2 transition-all',
        isSelected
          ? 'border-brand-300 dark:border-brand-500/40 bg-brand-500/5'
          : 'border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900',
        urgencyCfg?.row,
      )}
    >
      <div className="flex items-start gap-2">
        <button onClick={onToggle} className="mt-0.5 text-slate-400 hover:text-brand-500 transition-colors flex-shrink-0">
          {isSelected
            ? <CheckSquare className="w-4 h-4 text-brand-500" />
            : <Square className="w-4 h-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{apt.name}</p>
            <UrgencyBadge triage={apt.triage} />
            <StatusBadge status={apt.status} />
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{apt.email}</p>
        </div>
        <button
          onClick={() => onDrawer(apt)}
          className="p-1 rounded-lg text-slate-400 hover:text-brand-500 hover:bg-brand-500/10 transition-all flex-shrink-0"
        >
          <Eye className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-500">
        <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" />
        <span>{formatDisplayDateTime(apt.dateTime, TIMEZONE)}</span>
        <span className="font-mono text-slate-400 ml-auto text-[10px]">{apt.bookingReference}</span>
      </div>

      {apt.triage?.adminSummary && (
        <p className="text-[11px] italic text-brand-600 dark:text-brand-400 leading-relaxed">
          {apt.triage.adminSummary}
        </p>
      )}

      <div className="flex gap-2 flex-wrap pt-1 border-t border-slate-100 dark:border-slate-800">
        <RowActions
          apt={apt} isActing={isActing} actingAction={actingAction}
          isBusy={isBusy} onAction={onAction} onDrawer={onDrawer}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local filter helpers
// ---------------------------------------------------------------------------

type DateFilter    = 'all' | 'today' | 'tomorrow' | 'week';
type UrgencyFilter = 'none' | 'CRITICAL' | 'HIGH';

function applyLocalFilters(
  appointments: AdminAppointment[],
  search: string,
  dateFilter: DateFilter,
  urgencyFilter: UrgencyFilter,
): AdminAppointment[] {
  const now         = DateTime.now().setZone(TIMEZONE);
  const todayStr    = now.toFormat('yyyy-MM-dd');
  const tomorrowStr = now.plus({ days: 1 }).toFormat('yyyy-MM-dd');
  const weekEndStr  = now.endOf('week').toFormat('yyyy-MM-dd');

  let result = appointments.filter((apt) => {
    if (search) {
      const q = search.toLowerCase();
      if (!apt.name.toLowerCase().includes(q) && !apt.email.toLowerCase().includes(q)) return false;
    }
    if (dateFilter !== 'all') {
      const dayStr = DateTime.fromISO(apt.dateTime, { zone: TIMEZONE }).toFormat('yyyy-MM-dd');
      if (dateFilter === 'today'    && dayStr !== todayStr)                        return false;
      if (dateFilter === 'tomorrow' && dayStr !== tomorrowStr)                     return false;
      if (dateFilter === 'week'     && (dayStr < todayStr || dayStr > weekEndStr)) return false;
    }
    if (urgencyFilter !== 'none' && apt.triage?.urgency !== urgencyFilter) return false;
    return true;
  });

  if (urgencyFilter !== 'none') {
    result = [...result].sort((a, b) => (b.triage?.clarity ?? 0) - (a.triage?.clarity ?? 0));
  }

  return result;
}

// ---------------------------------------------------------------------------
// Filter toolbar — search + date + urgency
// ---------------------------------------------------------------------------

const DATE_OPTS: { key: DateFilter; label: string }[] = [
  { key: 'today',    label: 'Bugün'    },
  { key: 'tomorrow', label: 'Yarın'    },
  { key: 'week',     label: 'Bu Hafta' },
];

interface FilterToolbarProps {
  search:          string;
  dateFilter:      DateFilter;
  urgencyFilter:   UrgencyFilter;
  criticalCount:   number;
  highCount:       number;
  onSearchChange:  (v: string) => void;
  onDateFilter:    (v: DateFilter) => void;
  onUrgencyFilter: (v: UrgencyFilter) => void;
  onClearAll:      () => void;
}

function FilterToolbar({
  search, dateFilter, urgencyFilter, criticalCount, highCount,
  onSearchChange, onDateFilter, onUrgencyFilter, onClearAll,
}: FilterToolbarProps) {
  const hasFilters = !!search || dateFilter !== 'all' || urgencyFilter !== 'none';

  return (
    <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700/50 flex flex-wrap items-center gap-2">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="İsim veya e-posta…"
          className="pl-7 pr-7 py-1 text-xs rounded-lg w-44 bg-slate-100 dark:bg-slate-800 border border-transparent
                     focus:border-brand-300 dark:focus:border-brand-500/50 focus:outline-none
                     text-slate-700 dark:text-slate-300 placeholder-slate-400 transition-colors"
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Date filter toggles */}
      <div className="flex items-center gap-1">
        {DATE_OPTS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onDateFilter(dateFilter === key ? 'all' : key)}
            className={cn(
              'px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors',
              dateFilter === key
                ? 'bg-brand-500 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* CRITICAL filter — pulsing red */}
      {criticalCount > 0 && (
        <button
          onClick={() => onUrgencyFilter(urgencyFilter === 'CRITICAL' ? 'none' : 'CRITICAL')}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors',
            urgencyFilter === 'CRITICAL'
              ? 'bg-red-500 text-white shadow-sm'
              : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-300/60 dark:border-red-500/30 hover:bg-red-500/20',
          )}
        >
          <AlertTriangle className={cn('w-3 h-3', urgencyFilter !== 'CRITICAL' && 'animate-pulse')} />
          Kritik ({criticalCount})
        </button>
      )}

      {/* HIGH filter — solid orange */}
      {highCount > 0 && (
        <button
          onClick={() => onUrgencyFilter(urgencyFilter === 'HIGH' ? 'none' : 'HIGH')}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors',
            urgencyFilter === 'HIGH'
              ? 'bg-amber-500 text-white shadow-sm'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-300/60 dark:border-amber-500/30 hover:bg-amber-500/20',
          )}
        >
          <AlertTriangle className="w-3 h-3" />
          Önemli ({highCount})
        </button>
      )}

      {/* Clear all active filters */}
      {hasFilters && (
        <button
          onClick={onClearAll}
          className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-3 h-3" />
          Temizle
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface AppointmentTableProps {
  appointments: AdminAppointment[];
  selected:     Set<string>;
  actingIds:    Set<string>;
  actingAction: string;
  bulkLoading:  boolean;
  filterTabs:   { key: string; label: string; count: number }[];
  activeFilter: string;
  onFilterChange:    (f: string) => void;
  onToggleSelect:    (id: string) => void;
  onToggleSelectAll: (ids: string[]) => void;
  onAction:          (id: string, action: 'approve' | 'reject' | 'cancel' | 'complete') => void;
  onDrawer:          (apt: AdminAppointment) => void;
}

export function AppointmentTable({
  appointments, selected, actingIds, actingAction, bulkLoading,
  filterTabs, activeFilter, onFilterChange,
  onToggleSelect, onToggleSelectAll, onAction, onDrawer,
}: AppointmentTableProps) {
  const [search, setSearch]               = useState('');
  const [dateFilter, setDateFilter]       = useState<DateFilter>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>('none');

  const displayed     = applyLocalFilters(appointments, search, dateFilter, urgencyFilter);
  const criticalCount = appointments.filter((a) => a.triage?.urgency === 'CRITICAL').length;
  const highCount     = appointments.filter((a) => a.triage?.urgency === 'HIGH').length;
  const isBusy        = actingIds.size > 0 || bulkLoading;
  const allSelected   = displayed.length > 0 && displayed.every((a) => selected.has(a._id));
  const someSelected  = displayed.some((a) => selected.has(a._id));

  function clearLocalFilters() {
    setSearch('');
    setDateFilter('all');
    setUrgencyFilter('none');
  }

  // ── Empty state (no appointments for this status filter) ─────────────────
  if (appointments.length === 0) {
    return (
      <div className="form-card !max-w-none">
        <FilterTabs tabs={filterTabs} active={activeFilter} onChange={onFilterChange} />
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center">
            <CalendarCheck className="w-7 h-7 text-brand-400 opacity-60" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Randevu bulunamadı</p>
            <p className="text-xs text-slate-400 mt-1">Bu filtrede gösterilecek randevu yok.</p>
          </div>
          <a
            href="/"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold transition-colors"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            Yeni Randevu Formu
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="form-card !max-w-none p-0 overflow-visible">
      <FilterTabs tabs={filterTabs} active={activeFilter} onChange={onFilterChange} />

      <FilterToolbar
        search={search}
        dateFilter={dateFilter}
        urgencyFilter={urgencyFilter}
        criticalCount={criticalCount}
        highCount={highCount}
        onSearchChange={setSearch}
        onDateFilter={setDateFilter}
        onUrgencyFilter={setUrgencyFilter}
        onClearAll={clearLocalFilters}
      />

      {/* ── Mobile card list (< sm) ────────────────────────────────────── */}
      <div className="sm:hidden p-3 space-y-2">
        {displayed.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-slate-400">Arama sonucu boş.</p>
          </div>
        ) : displayed.map((apt) => (
          <MobileCard
            key={apt._id}
            apt={apt}
            isSelected={selected.has(apt._id)}
            isActing={actingIds.has(apt._id)}
            actingAction={actingAction}
            isBusy={isBusy}
            onToggle={() => onToggleSelect(apt._id)}
            onAction={onAction}
            onDrawer={onDrawer}
          />
        ))}
      </div>

      {/* ── Desktop table (≥ sm) ───────────────────────────────────────── */}
      <div className="hidden sm:block overflow-auto max-h-[calc(100vh-24rem)] min-h-[180px]
                      [&::-webkit-scrollbar]:w-1.5
                      [&::-webkit-scrollbar-thumb]:rounded-full
                      [&::-webkit-scrollbar-thumb]:bg-slate-300
                      dark:[&::-webkit-scrollbar-thumb]:bg-slate-600
                      [&::-webkit-scrollbar-track]:bg-transparent">
        <table className="w-full table-auto text-sm min-w-[1100px] border-separate border-spacing-0">
          <thead className="sticky top-0 z-20">
            <tr className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700/50">
              <th className="pl-5 py-2.5 w-10 text-left">
                <button
                  onClick={() => onToggleSelectAll(displayed.map((a) => a._id))}
                  className="text-slate-400 hover:text-brand-500 transition-colors"
                  title={allSelected ? 'Tümünü kaldır' : 'Tümünü seç'}
                >
                  {allSelected
                    ? <CheckSquare className="w-4 h-4 text-brand-500" />
                    : someSelected
                      ? <CheckSquare className="w-4 h-4 text-slate-400" />
                      : <Square className="w-4 h-4" />}
                </button>
              </th>
              {(['Müşteri', 'Tarih & Saat', 'E-posta', 'Durum', 'İşlemler'] as const).map((h, i) => (
                <th
                  key={h}
                  className={cn(
                    'px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500',
                    i === 4 ? 'text-right' : 'text-left',
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
            {displayed.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-sm text-slate-400">
                  Arama veya filtre sonucu boş.
                </td>
              </tr>
            ) : displayed.map((apt) => {
              const isActing   = actingIds.has(apt._id);
              const isSelected = selected.has(apt._id);
              const urgencyCfg = apt.triage ? URGENCY_CONFIG[apt.triage.urgency] : null;

              return (
                <tr
                  key={apt._id}
                  className={cn(
                    'transition-all duration-200 group',
                    isSelected
                      ? 'bg-brand-500/5 dark:bg-brand-500/8'
                      : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50',
                    urgencyCfg?.row,
                  )}
                >
                  <td className="pl-5 py-2.5">
                    <button
                      onClick={() => onToggleSelect(apt._id)}
                      className="text-slate-400 hover:text-brand-500 transition-colors"
                    >
                      {isSelected
                        ? <CheckSquare className="w-4 h-4 text-brand-500" />
                        : <Square className="w-4 h-4" />}
                    </button>
                  </td>

                  <td className="px-4 py-2.5 min-w-[240px]">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-none">{apt.name}</p>
                        <UrgencyBadge triage={apt.triage} />
                      </div>
                      <p className="text-[10px] font-mono text-slate-400 tracking-tight">{apt.bookingReference}</p>
                      <p className="text-[11px] italic text-brand-600 dark:text-brand-400 leading-snug max-w-xs line-clamp-1">
                        {apt.triage?.adminSummary || 'Analiz bekleniyor…'}
                      </p>
                    </div>
                  </td>

                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300 text-xs whitespace-nowrap font-medium">
                    {formatDisplayDateTime(apt.dateTime, TIMEZONE)}
                  </td>

                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300 text-xs">
                    {apt.email}
                  </td>

                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <StatusBadge status={apt.status} />
                  </td>

                  <td className="px-4 py-2.5 text-right">
                    <RowActions
                      apt={apt} isActing={isActing} actingAction={actingAction}
                      isBusy={isBusy} onAction={onAction} onDrawer={onDrawer}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-2.5 border-t border-slate-100 dark:border-slate-700/40 flex items-center justify-between">
        <p className="text-xs text-slate-400">
          {displayed.length !== appointments.length
            ? `${displayed.length} / ${appointments.length} randevu gösteriliyor`
            : `${appointments.length} randevu`}
        </p>
        <p className="text-xs text-slate-400">Her 30s otomatik yenilenir</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter tabs (shared between table and empty state)
// ---------------------------------------------------------------------------

function FilterTabs({
  tabs, active, onChange,
}: {
  tabs:     { key: string; label: string; count: number }[];
  active:   string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 px-4 pt-3 pb-2.5 border-b border-slate-200 dark:border-slate-700/50 overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors',
            active === tab.key
              ? 'bg-brand-500 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800',
          )}
        >
          {tab.label}
          <span className={cn(
            'px-1.5 py-0.5 rounded-full text-[10px] font-bold',
            active === tab.key
              ? 'bg-white/20'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
          )}>
            {tab.count}
          </span>
        </button>
      ))}
    </div>
  );
}
