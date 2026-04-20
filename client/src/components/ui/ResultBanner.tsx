import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';

type BannerCfg = { text: string; icon: typeof CheckCircle; color: string };

const MESSAGES: Record<string, BannerCfg> = {
  success: {
    text: '✅ Randevu onaylandı! Onay e-postası gönderildi.',
    icon: CheckCircle,
    color: 'bg-green-50 border-green-300 text-green-900 dark:bg-green-900/40 dark:border-green-600 dark:text-green-200',
  },
  rejected: {
    text: '❌ Randevu reddedildi. Kullanıcıya bilgilendirme e-postası gönderildi.',
    icon: XCircle,
    color: 'bg-red-50 border-red-300 text-red-900 dark:bg-red-900/40 dark:border-red-600 dark:text-red-200',
  },
  cancelled: {
    text: '🚫 Randevunuz başarıyla iptal edildi.',
    icon: AlertCircle,
    color: 'bg-yellow-50 border-yellow-300 text-yellow-900 dark:bg-yellow-900/40 dark:border-yellow-600 dark:text-yellow-200',
  },
  error: {
    text: '⚠️ İşlem sırasında bir hata oluştu. Lütfen tekrar deneyin.',
    icon: XCircle,
    color: 'bg-red-50 border-red-300 text-red-900 dark:bg-red-900/40 dark:border-red-600 dark:text-red-200',
  },
  'cancel-invalid': {
    text: 'Geçersiz veya süresi dolmuş iptal bağlantısı.',
    icon: Info,
    color: 'bg-slate-100 border-slate-300 text-slate-700 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300',
  },
};

const alreadyColor = 'bg-slate-100 border-slate-300 text-slate-700 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300';

export function ResultBanner() {
  const [visible, setVisible] = useState(false);
  const [cfg, setCfg] = useState<BannerCfg | null>(null);

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
      resolved = {
        text: `Bu randevu zaten ${label[status] ?? status} durumunda.`,
        icon: Info,
        color: alreadyColor,
      };
    }
    if (!resolved) return;

    setCfg(resolved);
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 7000);
    return () => clearTimeout(t);
  }, []);

  if (!visible || !cfg) return null;

  const Icon = cfg.icon;

  return (
    <div
      role="alert"
      className={`fixed top-5 left-1/2 -translate-x-1/2 z-50
                  flex items-start gap-3 px-5 py-4
                  rounded-2xl border shadow-xl
                  max-w-md w-[calc(100%-2rem)]
                  animate-slide-up ${cfg.color}`}
    >
      <Icon className="w-5 h-5 mt-0.5 shrink-0" />
      <span className="text-sm font-semibold leading-snug flex-1">{cfg.text}</span>
      <button
        onClick={() => setVisible(false)}
        className="shrink-0 text-current opacity-50 hover:opacity-100 transition-opacity text-lg leading-none"
        aria-label="Kapat"
      >
        ✕
      </button>
    </div>
  );
}
