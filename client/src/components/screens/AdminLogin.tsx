import { useState } from 'react';
import { Lock, AlertTriangle } from 'lucide-react';
import { Logo } from '../ui/Logo';
import { Button } from '../ui/Button';
import { adminApi } from '../../services/api';

export function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = password.trim();
    if (!trimmed) { setError('Lütfen şifreyi girin.'); return; }

    setLoading(true);
    setError('');
    try {
      await adminApi.login(trimmed);
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
        <div className="text-center space-y-4">
          <a href="/" className="inline-flex items-center gap-2 select-none">
            <Logo className="w-9 h-9 flex-shrink-0" />
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
              Yönetim paneline erişmek için şifrenizi girin.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Şifre</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="••••••••••••••••"
              className={`form-input mt-1 ${error ? 'form-input-error' : ''}`}
              disabled={loading}
              autoComplete="current-password"
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

        <p className="text-center text-xs text-slate-400">
          <a href="/" className="hover:text-brand-500 transition-colors">
            ← Ana Sayfaya Dön
          </a>
        </p>
      </div>
    </div>
  );
}
