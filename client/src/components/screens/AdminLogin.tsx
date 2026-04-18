import { useState } from 'react';
import { Lock, Loader2, AlertTriangle, CalendarCheck } from 'lucide-react';
import { adminApi } from '../../services/api';

const ENV_KEY    = import.meta.env.VITE_ADMIN_SECRET_KEY as string | undefined;
const STORAGE_KEY = 'admin_key';

export function AdminLogin() {
  const [key, setKey]       = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) { setError('Lütfen admin anahtarını girin.'); return; }

    if (ENV_KEY) {
      if (trimmed !== ENV_KEY) { setError('Şifre hatalı. Lütfen tekrar deneyin.'); return; }
      sessionStorage.setItem(STORAGE_KEY, trimmed);
      window.location.href = '/admin/dashboard';
      return;
    }

    // Fallback: verify against server
    setLoading(true);
    try {
      await adminApi.getStats(trimmed);
      sessionStorage.setItem(STORAGE_KEY, trimmed);
      window.location.href = '/admin/dashboard';
    } catch (err: unknown) {
      const e = err as { error?: string };
      setError(e.error ?? 'Sunucuya bağlanılamadı.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen page-bg flex flex-col items-center justify-center px-4">
      <div className="form-card max-w-sm w-full space-y-6 animate-fade-in">
        {/* Brand + header */}
        <div className="text-center space-y-4">
          <a href="/" className="inline-flex items-center gap-2 select-none group">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
              <CalendarCheck className="w-4.5 h-4.5" strokeWidth={2.5} />
            </span>
            <span className="text-lg font-bold text-slate-800 dark:text-white">
              Reserve<span className="text-brand-600 dark:text-brand-400">AI</span>
            </span>
          </a>
          <div className="space-y-1">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-2xl bg-brand-500/15 border border-brand-300 dark:border-brand-500/30 flex items-center justify-center">
                <Lock className="w-6 h-6 text-brand-600 dark:text-brand-400" />
              </div>
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Admin Girişi</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Yönetim paneline erişmek için anahtarı girin.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Admin Anahtarı</label>
            <input
              type="password"
              value={key}
              onChange={(e) => { setKey(e.target.value); setError(''); }}
              placeholder="••••••••••••••••"
              className={`form-input mt-1 ${error ? 'form-input-error' : ''}`}
              autoFocus
              disabled={loading}
            />
            {error && (
              <p className="mt-1.5 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                {error}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Doğrulanıyor…' : 'Giriş Yap'}
          </button>
        </form>

        {/* Back to landing */}
        <p className="text-center text-xs text-slate-400">
          <a href="/" className="hover:text-brand-500 transition-colors">
            ← Ana Sayfaya Dön
          </a>
        </p>

        {import.meta.env.DEV && (
          <p className="text-center text-[10px] text-slate-300 dark:text-slate-600">
            API: {import.meta.env.VITE_API_URL ?? '(proxy)'}
          </p>
        )}
      </div>
    </div>
  );
}
