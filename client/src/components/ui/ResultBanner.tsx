import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';

type BannerCfg = {
  text:       string;
  icon:       typeof CheckCircle;
  glow:       string;
  glass:      string;
  accent:     string;
  text_color: string;
  icon_color: string;
};

const MESSAGES: Record<string, BannerCfg> = {
  success: {
    text:       'Randevunuz başarıyla onaylandı!',
    icon:       CheckCircle,
    glow:       'ring-emerald-400/40 dark:ring-emerald-500/30',
    glass:      'bg-white/85 dark:bg-slate-900/85 border-emerald-200/70 dark:border-emerald-600/30',
    accent:     'border-l-emerald-500 dark:border-l-emerald-400',
    text_color: 'text-emerald-900 dark:text-emerald-100',
    icon_color: 'text-emerald-500 dark:text-emerald-400',
  },
  rejected: {
    text:       'Randevu talebi reddedildi.',
    icon:       XCircle,
    glow:       'ring-red-400/40 dark:ring-red-500/30',
    glass:      'bg-white/85 dark:bg-slate-900/85 border-red-200/70 dark:border-red-600/30',
    accent:     'border-l-red-500 dark:border-l-red-400',
    text_color: 'text-red-900 dark:text-red-100',
    icon_color: 'text-red-500 dark:text-red-400',
  },
  cancelled: {
    text:       'Randevunuz başarıyla iptal edilmiştir.',
    icon:       AlertCircle,
    glow:       'ring-amber-400/40 dark:ring-amber-500/30',
    glass:      'bg-white/85 dark:bg-slate-900/85 border-amber-200/70 dark:border-amber-600/30',
    accent:     'border-l-amber-500 dark:border-l-amber-400',
    text_color: 'text-amber-900 dark:text-amber-100',
    icon_color: 'text-amber-500 dark:text-amber-400',
  },
  error: {
    text:       'İşlem sırasında bir hata oluştu. Lütfen tekrar deneyin.',
    icon:       XCircle,
    glow:       'ring-red-400/40 dark:ring-red-500/30',
    glass:      'bg-white/85 dark:bg-slate-900/85 border-red-200/70 dark:border-red-600/30',
    accent:     'border-l-red-500 dark:border-l-red-400',
    text_color: 'text-red-900 dark:text-red-100',
    icon_color: 'text-red-500 dark:text-red-400',
  },
  'cancel-invalid': {
    text:       'Geçersiz veya süresi dolmuş iptal bağlantısı.',
    icon:       Info,
    glow:       'ring-slate-400/30 dark:ring-slate-500/20',
    glass:      'bg-white/85 dark:bg-slate-900/85 border-slate-200/70 dark:border-slate-600/30',
    accent:     'border-l-slate-400 dark:border-l-slate-500',
    text_color: 'text-slate-700 dark:text-slate-200',
    icon_color: 'text-slate-500 dark:text-slate-400',
  },
};

const neutralCfg = (text: string): BannerCfg => ({
  text,
  icon:       Info,
  glow:       'ring-slate-400/30 dark:ring-slate-500/20',
  glass:      'bg-white/85 dark:bg-slate-900/85 border-slate-200/70 dark:border-slate-600/30',
  accent:     'border-l-slate-400 dark:border-l-slate-500',
  text_color: 'text-slate-700 dark:text-slate-200',
  icon_color: 'text-slate-500 dark:text-slate-400',
});

export function ResultBanner() {
  const [visible, setVisible] = useState(false);
  const [cfg, setCfg]         = useState<BannerCfg | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('result');
    if (!result) return;

    window.history.replaceState({}, '', window.location.pathname);

    let resolved = MESSAGES[result];
    if (!resolved && result.startsWith('already-')) {
      const status = result.replace('already-', '');
      const label: Record<string, string> = {
        approved: 'onaylanmış', rejected: 'reddedilmiş',
        cancelled: 'iptal edilmiş', pending: 'beklemede',
      };
      resolved = neutralCfg(`Bu randevu zaten ${label[status] ?? status} durumunda.`);
    }
    if (!resolved) return;

    setCfg(resolved);
    setLeaving(false);
    setVisible(true);

    const t = setTimeout(() => dismiss(), 7000);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    setLeaving(true);
    setTimeout(() => setVisible(false), 300);
  }

  if (!visible || !cfg) return null;

  const Icon = cfg.icon;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={[
        'fixed z-50',
        'top-5 left-4 right-4',
        'sm:left-auto sm:right-5 sm:w-auto sm:max-w-sm',
        'flex items-start gap-3 px-4 py-3.5',
        'rounded-2xl border-2 border-l-4 shadow-2xl',
        'backdrop-blur-xl',
        cfg.glass,
        cfg.accent,
        'ring-1', cfg.glow,
        leaving
          ? 'opacity-0 -translate-y-2 sm:translate-y-0 sm:translate-x-3 transition-all duration-300'
          : 'animate-slide-up sm:animate-toast-in',
      ].join(' ')}
    >
      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${cfg.icon_color}`} />

      <span className={`text-sm font-semibold leading-snug flex-1 pr-1 ${cfg.text_color}`}>
        {cfg.text}
      </span>

      <button
        onClick={dismiss}
        className={`shrink-0 opacity-40 hover:opacity-80 transition-opacity
                    text-base leading-none mt-0.5 ${cfg.text_color}`}
        aria-label="Kapat"
      >
        ✕
      </button>
    </div>
  );
}
