import { useEffect, useRef, useState, useCallback } from 'react';
import {
  LogOut, RefreshCw, Bell, CheckCircle2,
  XCircle, Ban, Clock, Users, CalendarCheck, Loader2, Lock,
  Eye, AlertTriangle,
} from 'lucide-react';
import { Logo } from '../ui/Logo';
import { Button } from '../ui/Button';
import { adminApi, type AdminAppointment, type AdminStats } from '../../services/api';
import { formatDisplayDateTime } from '@shared/dateUtils';
import { TIMEZONE } from '@shared/constants';

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected' | 'cancelled';
type ActionState  = { id: string; action: string } | null;

const STATUS_LABEL: Record<string, string> = {
  pending:   'Bekliyor',
  approved:  'Onaylandı',
  rejected:  'Reddedildi',
  cancelled: 'İptal',
};

const STATUS_BADGE: Record<string, string> = {
  pending:   'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30',
  approved:  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30',
  rejected:  'bg-red-500/15 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-500/30',
  cancelled: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-600',
};

const STORAGE_KEY = 'admin_key';
const POLL_MS     = 30_000;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: number; color: string;
}) {
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

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[status] ?? STATUS_BADGE.cancelled}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Lock screen
// ---------------------------------------------------------------------------

const ENV_KEY = import.meta.env.VITE_ADMIN_SECRET_KEY as string | undefined;

function LockScreen({ onAuth }: { onAuth: (key: string) => void }) {
  const [key, setKey]       = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) { setError('Lütfen admin anahtarını girin.'); return; }

    // If env key is configured, validate locally (instant feedback)
    if (ENV_KEY) {
      if (trimmed !== ENV_KEY) {
        setError('Şifre hatalı. Lütfen tekrar deneyin.');
        return;
      }
      onAuth(trimmed);
      return;
    }

    // No env key — verify against server with a test request
    setLoading(true);
    try {
      await import('../../services/api').then(({ adminApi }) => adminApi.getStats());
      onAuth(trimmed);
    } catch (err: unknown) {
      const e = err as { error?: string };
      setError(e.error ?? 'Sunucuya bağlanılamadı.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen page-bg flex items-center justify-center">
      <div className="form-card max-w-sm w-full mx-4 space-y-6 animate-fade-in">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-2xl bg-brand-500/15 border border-brand-300 dark:border-brand-500/30 flex items-center justify-center">
              <Lock className="w-7 h-7 text-brand-600 dark:text-brand-400" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Admin Paneli</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Devam etmek için admin anahtarını girin.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Admin Anahtarı</label>
            <input
              type="password"
              value={key}
              onChange={(e) => { setKey(e.target.value); setError(''); }}
              placeholder="••••••••••••••••"
              className={`form-input mt-1 ${error ? 'border-red-400 dark:border-red-500 ring-1 ring-red-400/40' : ''}`}
              disabled={loading}
            />
            {error && (
              <p className="mt-1.5 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                {error}
              </p>
            )}
          </div>
          <Button type="submit" variant="sky" disabled={loading} loading={loading} className="w-full">
            {loading ? 'Doğrulanıyor…' : 'Giriş Yap'}
          </Button>
        </form>

        {/* Debug hint — only in development */}
        {import.meta.env.DEV && (
          <p className="text-center text-[10px] text-slate-400">
            API: {import.meta.env.VITE_API_URL ?? '(proxy)'}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail drawer (enquiry preview)
// ---------------------------------------------------------------------------

function EnquiryDrawer({ apt, onClose }: { apt: AdminAppointment; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0 bg-black/40 backdrop-blur-sm animate-fade-in"
         onClick={onClose}>
      <div className="form-card w-full max-w-lg sm:mx-4 space-y-4 animate-slide-up"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white">Talep Detayı</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        <div className="rounded-xl inset-surface border border-slate-200 dark:border-slate-700/50 px-4 py-4 space-y-3 text-sm">
          <Row label="İsim"      value={apt.name} />
          <Row label="E-posta"   value={apt.email} />
          <Row label="Ref"       value={apt.bookingReference} mono />
          <Row label="Tarih"     value={formatDisplayDateTime(apt.dateTime, TIMEZONE)} />
          <Row label="Durum"     value={<StatusBadge status={apt.status} />} />
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

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 w-16 flex-shrink-0 pt-0.5">{label}</span>
      <span className={`text-slate-700 dark:text-slate-300 ${mono ? 'font-mono text-xs' : 'text-sm'}`}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main AdminPage
// ---------------------------------------------------------------------------

export function AdminPage() {
  const [adminKey, setAdminKey]       = useState<string | null>(
    () => sessionStorage.getItem(STORAGE_KEY),
  );
  const [appointments, setAppointments] = useState<AdminAppointment[]>([]);
  const [stats, setStats]               = useState<AdminStats | null>(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [filter, setFilter]             = useState<FilterStatus>('all');
  const [actionState, setActionState]   = useState<ActionState>(null);
  const [actionError, setActionError]   = useState('');
  const [newCount, setNewCount]         = useState(0);
  const [drawerApt, setDrawerApt]       = useState<AdminAppointment | null>(null);

  const prevPendingRef  = useRef<number | null>(null);
  const pollRef         = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Auth ──────────────────────────────────────────────────────────────────

  function handleAuth(key: string) {
    sessionStorage.setItem(STORAGE_KEY, key);
    setAdminKey(key);
  }

  function handleLogout() {
    sessionStorage.removeItem(STORAGE_KEY);
    setAdminKey(null);
  }

  // ── Data fetching ─────────────────────────────────────────────────────────

  const loadData = useCallback(async (_key: string, silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [{ appointments: apts }, statsData] = await Promise.all([
        adminApi.getAppointments(),
        adminApi.getStats(),
      ]);
      setAppointments(apts);
      setStats(statsData);

      // Detect new pending appointments for notification
      const pendingNow = statsData.pending;
      if (prevPendingRef.current !== null && pendingNow > prevPendingRef.current) {
        setNewCount((c) => c + (pendingNow - (prevPendingRef.current ?? 0)));
      }
      prevPendingRef.current = pendingNow;
    } catch (err: unknown) {
      // Interceptor normalises errors to { error: string }.
      // 401/403 → kick back to lock screen; anything else → show inline.
      const e   = err as { error?: string };
      const msg = e.error ?? 'Sunucuya bağlanılamadı.';
      if (msg.includes('Yetkisiz') || msg.includes('Unauthorized') || msg.includes('401')) {
        sessionStorage.removeItem(STORAGE_KEY);
        setAdminKey(null);
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

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleAction(id: string, action: 'approve' | 'reject' | 'cancel') {
    if (!adminKey) return;
    setActionState({ id, action });
    setActionError('');
    try {
      if (action === 'approve')      await adminApi.approve(id);
      else if (action === 'reject')  await adminApi.reject(id);
      else                           await adminApi.cancel(id);

      // Reload after short delay (n8n may need a moment to update DB)
      setTimeout(() => loadData(adminKey, true), 1800);
    } catch (err: unknown) {
      const e = err as { error?: string };
      setActionError(e.error ?? 'İşlem başarısız oldu.');
    } finally {
      setActionState(null);
    }
  }

  // ── Render guard — lock screen ────────────────────────────────────────────

  if (!adminKey) return <LockScreen onAuth={handleAuth} />;

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filtered = filter === 'all'
    ? appointments
    : appointments.filter((a) => a.status === filter);

  const filterTabs: { key: FilterStatus; label: string; count: number }[] = [
    { key: 'all',       label: 'Tümü',      count: appointments.length },
    { key: 'pending',   label: 'Bekleyen',  count: stats?.pending   ?? 0 },
    { key: 'approved',  label: 'Onaylı',    count: stats?.approved  ?? 0 },
    { key: 'rejected',  label: 'Reddedildi',count: stats?.rejected  ?? 0 },
    { key: 'cancelled', label: 'İptal',     count: stats?.cancelled ?? 0 },
  ];

  // ── Main dashboard ────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen page-bg">
      {drawerApt && <EnquiryDrawer apt={drawerApt} onClose={() => setDrawerApt(null)} />}

      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo className="w-7 h-7 flex-shrink-0" />
            <span className="font-bold text-slate-900 dark:text-white text-sm">Admin Paneli</span>
          </div>
          <div className="flex items-center gap-3">
            {/* New appointment notification */}
            {newCount > 0 && (
              <button
                onClick={() => { setNewCount(0); setFilter('pending'); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
                           bg-amber-500/15 text-amber-700 dark:text-amber-300
                           border border-amber-300 dark:border-amber-500/30
                           hover:bg-amber-500/25 transition-colors animate-pulse"
              >
                <Bell className="w-3.5 h-3.5" />
                {newCount} Yeni Randevu
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
              onClick={handleLogout}
              title="Çıkış"
              className="p-2 rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Error banner */}
        {error && (
          <div className="rounded-xl border border-red-300 dark:border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Action error */}
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
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
          </div>
        ) : stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              icon={Users}
              label="Toplam Randevu"
              value={stats.total}
              color="bg-blue-500/15 text-blue-600 dark:text-blue-400"
            />
            <StatCard
              icon={Clock}
              label="Bekleyen"
              value={stats.pending}
              color="bg-amber-500/15 text-amber-600 dark:text-amber-400"
            />
            <StatCard
              icon={CalendarCheck}
              label="Onaylanan"
              value={stats.approved}
              color="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            />
            <StatCard
              icon={Ban}
              label="İptal / Red"
              value={stats.rejected + stats.cancelled}
              color="bg-red-500/15 text-red-600 dark:text-red-400"
            />
          </div>
        )}

        {/* Filter tabs + table */}
        <div className="form-card p-0 overflow-hidden">

          {/* Filter tabs */}
          <div className="flex items-center gap-1 px-5 pt-4 pb-3 border-b border-slate-200 dark:border-slate-700/50 overflow-x-auto">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
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
                    {['Müşteri', 'Tarih & Saat', 'E-posta', 'Durum', 'İşlemler'].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                  {filtered.map((apt) => {
                    const isActing = actionState?.id === apt._id;
                    return (
                      <tr
                        key={apt._id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Name + ref */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <p className="font-semibold text-slate-800 dark:text-slate-100">{apt.name}</p>
                          <p className="text-[10px] font-mono text-slate-400 mt-0.5">{apt.bookingReference}</p>
                        </td>

                        {/* Date */}
                        <td className="px-5 py-3.5 whitespace-nowrap text-slate-600 dark:text-slate-300">
                          {formatDisplayDateTime(apt.dateTime, TIMEZONE)}
                        </td>

                        {/* Email */}
                        <td className="px-5 py-3.5 whitespace-nowrap text-slate-600 dark:text-slate-300">
                          {apt.email}
                        </td>

                        {/* Status */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <StatusBadge status={apt.status} />
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {/* Detail preview */}
                            <button
                              onClick={() => setDrawerApt(apt)}
                              title="Detay"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-brand-500 hover:bg-brand-500/10 transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {apt.status === 'pending' && (
                              <>
                                <ActionBtn
                                  label="Onayla"
                                  icon={CheckCircle2}
                                  loading={isActing && actionState?.action === 'approve'}
                                  disabled={!!actionState}
                                  onClick={() => handleAction(apt._id, 'approve')}
                                  colorClass="text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 hover:bg-emerald-500/20"
                                />
                                <ActionBtn
                                  label="Reddet"
                                  icon={XCircle}
                                  loading={isActing && actionState?.action === 'reject'}
                                  disabled={!!actionState}
                                  onClick={() => handleAction(apt._id, 'reject')}
                                  colorClass="text-red-700 dark:text-red-400 bg-red-500/10 border-red-300 dark:border-red-500/30 hover:bg-red-500/20"
                                />
                              </>
                            )}

                            {(apt.status === 'pending' || apt.status === 'approved') && (
                              <ActionBtn
                                label="İptal"
                                icon={Ban}
                                loading={isActing && actionState?.action === 'cancel'}
                                disabled={!!actionState}
                                onClick={() => handleAction(apt._id, 'cancel')}
                                colorClass="text-slate-600 dark:text-slate-400 bg-slate-500/10 border-slate-300 dark:border-slate-600 hover:bg-slate-500/20"
                              />
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

          {/* Footer */}
          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700/40 flex items-center justify-between inset-deep">
            <p className="text-xs text-slate-400">
              {filtered.length} randevu gösteriliyor
            </p>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <RefreshCw className="w-3 h-3" />
              Her {POLL_MS / 1000}s'de otomatik yenilenir
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable action button
// ---------------------------------------------------------------------------

function ActionBtn({ label, icon: Icon, loading, disabled, onClick, colorClass }: {
  label: string;
  icon: React.ElementType;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
  colorClass: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border
                  transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${colorClass}`}
    >
      {loading
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : <Icon className="w-3.5 h-3.5" />}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
