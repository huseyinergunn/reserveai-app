import { CalendarCheck, LayoutDashboard, Sparkles, ArrowRight, Shield } from 'lucide-react';
import { Logo } from '../ui/Logo';
import { useTheme } from '../../hooks/useTheme';
import { Sun, Moon } from 'lucide-react';
import { ResultBanner } from '../ui/ResultBanner';

function ThemeToggle() {
  const { isDark, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Açık temaya geç' : 'Koyu temaya geç'}
      className="absolute top-4 right-4 w-9 h-9 rounded-lg flex items-center justify-center
                 bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10
                 text-slate-600 dark:text-slate-300 hover:bg-white/20 transition-all"
    >
      {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-brand-500" />}
    </button>
  );
}

export function PortalPage() {
  return (
    <div className="min-h-screen flex-1 page-bg flex flex-col items-center justify-center px-4 py-8 relative">
      <ResultBanner />
      <ThemeToggle />
      <div className="flex flex-col items-center w-full">

      {/* Brand */}
      <div className="flex items-center gap-3 mb-10 select-none animate-fade-in">
        <Logo className="w-11 h-11 flex-shrink-0" />
        <div>
          <span className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Reserve<span className="text-brand-600 dark:text-brand-400">AI</span>
          </span>
          <p className="text-xs text-slate-500 dark:text-slate-400 -mt-0.5">Yapay Zeka Destekli Randevu Sistemi</p>
        </div>
      </div>

      {/* Welcome */}
      <div className="text-center mb-10 animate-fade-in space-y-3 max-w-md">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full
                        border border-brand-500/30 bg-brand-500/10
                        text-brand-700 dark:text-white text-xs font-semibold select-none">
          <Sparkles className="w-3.5 h-3.5" />
          Hoş Geldiniz
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white leading-snug pt-1">
          Randevu Sistemine<br />
          <span className="hero-gradient-text">Hoş Geldiniz</span>
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Devam etmek için rolünüzü seçin.
        </p>
      </div>

      {/* Portal cards */}
      <div className="grid sm:grid-cols-2 gap-5 w-full max-w-xl animate-fade-in">

        {/* Customer card */}
        <a
          href="/randevu"
          className="group relative rounded-2xl p-6 sm:p-7 flex flex-col items-center text-center gap-5 cursor-pointer
                     transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl
                     focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
          style={{
            background:        'var(--card-bg)',
            border:            '1px solid var(--card-border)',
            boxShadow:         'var(--card-shadow)',
            backdropFilter:    'blur(20px) saturate(160%)',
            WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          }}
        >
          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30
                          flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
            <CalendarCheck className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
          </div>

          {/* Text */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              Müşteri
            </p>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">
              Randevu Almak<br />İstiyorum
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Yeni randevu oluşturun veya mevcut randevunuzun durumunu sorgulayın.
            </p>
          </div>

          {/* CTA */}
          <div className="flex items-center justify-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400
                          group-hover:gap-2.5 transition-all duration-200">
            Devam Et
            <ArrowRight className="w-4 h-4" />
          </div>

          {/* Hover glow */}
          <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300
                          ring-2 ring-emerald-400/40 pointer-events-none" />
        </a>

        {/* Admin card */}
        <a
          href="/admin/login"
          className="group relative rounded-2xl p-6 sm:p-7 flex flex-col items-center text-center gap-5 cursor-pointer
                     transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl
                     focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
          style={{
            background:        'var(--card-bg)',
            border:            '1px solid var(--card-border)',
            boxShadow:         'var(--card-shadow)',
            backdropFilter:    'blur(20px) saturate(160%)',
            WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          }}
        >
          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-brand-500/15 border border-brand-200 dark:border-brand-500/30
                          flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
            <LayoutDashboard className="w-7 h-7 text-brand-600 dark:text-brand-400" />
          </div>

          {/* Text */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400">
              Yönetici
            </p>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">
              Yönetici<br />Girişi
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Admin paneline giriş yaparak randevuları yönetin ve istatistikleri görüntüleyin.
            </p>
          </div>

          {/* CTA */}
          <div className="flex items-center justify-center gap-1.5 text-sm font-semibold text-brand-600 dark:text-brand-400
                          group-hover:gap-2.5 transition-all duration-200">
            Giriş Yap
            <ArrowRight className="w-4 h-4" />
          </div>

          {/* Hover glow */}
          <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300
                          ring-2 ring-brand-400/40 pointer-events-none" />
        </a>
      </div>

        {/* Footer note */}
        <div className="mt-8 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 animate-fade-in">
          <Shield className="w-3.5 h-3.5" />
          Güvenli ve şifreli bağlantı · ReserveAI © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
