/**
 * NavModals — three corporate modal windows triggered from the Navbar.
 *
 * Modals:
 *   'how'     → Nasıl Çalışır?  (3-step flow + n8n AI diagram)
 *   'pricing' → Fiyatlandırma   (3-tier SaaS cards)
 *   'contact' → İletişim        (contact form + info)
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  X,
  ArrowLeft,
  MessageSquare,
  Brain,
  CalendarCheck,
  ArrowRight,
  Check,
  MapPin,
  Mail,
  Phone,
  Twitter,
  Linkedin,
  Github,
  Sparkles,
  Zap,
  Building2,
  Shield,
  Workflow,
  Globe,
  Headphones,
  Users,
} from 'lucide-react';
import { Button } from '../ui/Button';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ModalId = 'how' | 'pricing' | 'contact';

interface NavModalsProps {
  activeModal: ModalId;
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Base modal shell
// ─────────────────────────────────────────────────────────────────────────────

interface ModalShellProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  size?: 'md' | 'lg' | 'xl';
  children: ReactNode;
}

const SIZE_CLASS: Record<NonNullable<ModalShellProps['size']>, string> = {
  md: 'sm:max-w-xl',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
};

function ModalShell({ title, subtitle, onClose, size = 'lg', children }: ModalShellProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // iOS: position:fixed + savedY kilidini uygula; diğer platformlarda overflow:hidden yeterli
  useEffect(() => {
    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const savedY = window.scrollY;

    document.body.style.overflow = 'hidden';
    if (ios) {
      document.body.style.position = 'fixed';
      document.body.style.top      = `-${savedY}px`;
      document.body.style.width    = '100%';
    }

    return () => {
      document.body.style.overflow = '';
      if (ios) {
        document.body.style.position = '';
        document.body.style.top      = '';
        document.body.style.width    = '';
      }
      window.scrollTo(0, savedY);
    };
  }, []);

  const bodyRef = useRef<HTMLDivElement>(null);

  // Modal açıldığında veya title değiştiğinde (farklı modal) içerik scroll'unu sıfırla
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [title]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 modal-overlay"
        onClick={onClose}
      />

      {/* Card — bottom-sheet on mobile, centered dialog on sm+ */}
      <div
        ref={cardRef}
        className={`modal-card relative z-10 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full ${SIZE_CLASS[size]}
                    max-h-[92vh] sm:max-h-[88vh] flex flex-col animate-fade-in overflow-hidden`}
      >
        {/* Sticky header */}
        <div className="modal-header flex-shrink-0 flex items-start justify-between px-5 sm:px-6 py-4 sm:py-5 border-b">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
            {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 ml-4 flex items-center justify-center rounded-xl lg:rounded-lg
                       p-2.5 lg:p-1.5 min-w-[44px] min-h-[44px] lg:min-w-0 lg:min-h-0
                       text-slate-400 hover:text-slate-700 dark:hover:text-slate-200
                       hover:bg-slate-100 dark:hover:bg-slate-700/60
                       active:scale-95 transition-all"
            aria-label="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 sm:py-6">
          {children}
        </div>

        {/* Mobile-only sticky footer close button */}
        <div className="flex-shrink-0 lg:hidden px-4 py-3 border-t border-slate-100 dark:border-slate-700/40 modal-header">
          <button
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 min-h-[44px] rounded-xl
                       text-sm font-semibold text-slate-700 dark:text-slate-200
                       bg-slate-100/80 dark:bg-slate-700/60
                       border border-slate-200 dark:border-slate-600/50
                       active:scale-[0.98] transition-transform"
          >
            <X className="w-4 h-4" />
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1 — HOW IT WORKS
// ─────────────────────────────────────────────────────────────────────────────

const HOW_STEPS = [
  {
    num:        '01',
    icon:       MessageSquare,
    iconLight:  'bg-blue-50 text-blue-600 border-blue-200',
    iconDark:   'dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/20',
    ringLight:  'ring-blue-100',
    ringDark:   'dark:ring-blue-500/10',
    title:      'Niyetinizi Söyleyin',
    desc:       "Asistanımıza doğal dilde yazın: \"Çarşamba sabahı 9'da görüşelim\" yeterli. Format bilgisi gerekmez.",
    tech:       'Groq LLaMA · NLP Parsing',
  },
  {
    num:        '02',
    icon:       Brain,
    iconLight:  'bg-indigo-50 text-indigo-600 border-indigo-200',
    iconDark:   'dark:bg-indigo-500/15 dark:text-indigo-400 dark:border-indigo-500/20',
    ringLight:  'ring-indigo-100',
    ringDark:   'dark:ring-indigo-500/10',
    title:      'AI Analiz Eder',
    desc:       'Modelimiz mesajınızdan tarih, saat ve niyeti çıkarır; uygun olmayan talepleri önceden filtreler.',
    tech:       'n8n Enquiry Classifier · Intent Extraction',
  },
  {
    num:        '03',
    icon:       CalendarCheck,
    iconLight:  'bg-emerald-50 text-emerald-600 border-emerald-200',
    iconDark:   'dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/20',
    ringLight:  'ring-emerald-100',
    ringDark:   'dark:ring-emerald-500/10',
    title:      'Anında Senkronizasyon',
    desc:       'Tek onay ile takviminiz güncellenir, size ve yöneticiye otomatik onay e-postaları gönderilir.',
    tech:       'Google Calendar API · Gmail OAuth · n8n Webhook',
  },
];

function HowItWorksContent() {
  return (
    <div className="space-y-8">
      <div className="relative">
        {/* Vertical connector line */}
        <div className="absolute left-[27px] top-10 bottom-10 w-0.5
                        bg-gradient-to-b from-blue-300 via-indigo-300 to-emerald-300
                        dark:from-blue-500/30 dark:via-indigo-500/30 dark:to-emerald-500/30
                        hidden sm:block" />

        <div className="space-y-6">
          {HOW_STEPS.map((step) => (
            <div key={step.num} className="flex gap-4 sm:gap-5 animate-slide-up">
              {/* Icon circle */}
              <div className="flex-shrink-0 relative z-10">
                <div className={`w-14 h-14 rounded-2xl border-2 flex flex-col items-center justify-center
                                 ring-4 ${step.iconLight} ${step.iconDark} ${step.ringLight} ${step.ringDark}`}>
                  <step.icon className="w-6 h-6" strokeWidth={1.8} />
                </div>
                <span className="block text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1 tracking-widest">
                  {step.num}
                </span>
              </div>

              {/* Content */}
              <div className="pt-1 min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">{step.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-2">{step.desc}</p>
                <span className="inline-block text-[11px] font-semibold font-mono px-2.5 py-1 rounded-full
                                 text-slate-500 dark:text-slate-400
                                 bg-slate-100 dark:bg-slate-700/60">
                  {step.tech}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* n8n automation note */}
      <div className="rounded-xl p-4 sm:p-5 border
                      bg-gradient-to-br from-slate-50 to-blue-50 border-blue-200
                      dark:from-slate-800/60 dark:to-blue-900/20 dark:border-blue-500/20">
        <div className="flex items-center gap-2 mb-2">
          <Workflow className="w-4 h-4 text-brand-600 dark:text-brand-400" />
          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Altyapı: n8n Otomasyon Platformu
          </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Tüm iş akışları <strong className="text-slate-700 dark:text-slate-300">n8n</strong> üzerinde çalışır:{' '}
          AI sınıflandırma → şart dalları → onay akışı → e-posta teslimi → Google Takvim güncellemesi.
          Kodsuz görsel düzenleyici ile her adım özelleştirilebilir.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2 — PRICING
// ─────────────────────────────────────────────────────────────────────────────

interface PlanFeature { text: string; included: boolean; }
interface Plan {
  name:        string;
  price:       string;
  period:      string;
  description: string;
  badge?:      string;
  icon:        React.ElementType;
  features:    PlanFeature[];
  cta:         string;
  highlight:   boolean;
}

const PLANS: Plan[] = [
  {
    name:        'Başlangıç',
    price:       'Ücretsiz',
    period:      'sonsuza dek',
    description: 'Bireysel kullanım ve proje denemeleri için',
    icon:        Sparkles,
    features: [
      { text: 'Aylık 10 randevu',           included: true  },
      { text: 'Temel AI sınıflandırma',      included: true  },
      { text: 'E-posta onayı',               included: true  },
      { text: 'Standart destek',             included: true  },
      { text: 'n8n entegrasyonu',            included: false },
      { text: 'Google Takvim sync',          included: false },
      { text: 'Öncelikli destek',            included: false },
      { text: 'Özel API erişimi',            included: false },
    ],
    cta:       'Ücretsiz Başla',
    highlight: false,
  },
  {
    name:        'Pro',
    price:       '₺299',
    period:      'aylık',
    description: 'Büyüyen işletmeler için tam özellikli paket',
    badge:       'En Popüler',
    icon:        Zap,
    features: [
      { text: 'Sınırsız randevu',              included: true },
      { text: 'Gelişmiş AI (Groq + GPT)',      included: true },
      { text: 'E-posta onayı',                 included: true },
      { text: 'Öncelikli destek',              included: true },
      { text: 'n8n iş akışı entegrasyonu',     included: true },
      { text: 'Google Takvim senkronizasyonu', included: true },
      { text: 'Özelleştirilebilir formlar',    included: true },
      { text: 'Özel API erişimi',              included: false },
    ],
    cta:       "Pro'ya Geç",
    highlight: true,
  },
  {
    name:        'Kurumsal',
    price:       'Özel',
    period:      'teklif alın',
    description: 'Ölçeklenebilir kurumsal altyapı ihtiyaçları için',
    icon:        Building2,
    features: [
      { text: 'Sınırsız randevu',              included: true },
      { text: 'Tüm AI modelleri',              included: true },
      { text: 'E-posta onayı',                 included: true },
      { text: '7/24 özel destek',              included: true },
      { text: 'n8n iş akışı entegrasyonu',     included: true },
      { text: 'Google Takvim senkronizasyonu', included: true },
      { text: 'Beyaz etiket (White-label)',     included: true },
      { text: 'Özel API + SLA güvencesi',      included: true },
    ],
    cta:       'Teklif Al',
    highlight: false,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Plan detail sub-layer — shown when a pricing CTA is clicked
// ─────────────────────────────────────────────────────────────────────────────

interface PlanDetailMeta {
  tagline:    string;
  proofLine:  string;
  formType:   'free' | 'pro' | 'enterprise';
  ctaLabel:   string;
  highlights: string[];
}

const PLAN_DETAIL: Record<string, PlanDetailMeta> = {
  'Başlangıç': {
    tagline:    'Dakikalar içinde başlayın',
    proofLine:  'Kredi kartı gerekmez · Sözleşme yok · İstediğinizde iptal',
    formType:   'free',
    ctaLabel:   'Ücretsiz Hesap Oluştur',
    highlights: [
      'Aylık 10 randevu kapasitesi',
      'Temel AI sınıflandırma aktif',
      'Otomatik e-posta onayları',
    ],
  },
  'Pro': {
    tagline:    '30 gün ücretsiz deneyin',
    proofLine:  'Deneme bitmeden ücret alınmaz · İstediğinizde iptal',
    formType:   'pro',
    ctaLabel:   '30 Gün Ücretsiz Başla',
    highlights: [
      'Sınırsız randevu kapasitesi',
      'n8n + Google Takvim entegrasyonu',
      'Öncelikli destek hattı',
    ],
  },
  'Kurumsal': {
    tagline:    'Ekibinize özel çözüm',
    proofLine:  'Bir uzmanımız 24 saat içinde sizi arar',
    formType:   'enterprise',
    ctaLabel:   'Demo Talep Et',
    highlights: [
      'White-label kurulum & özel API',
      'Özel SLA güvencesi',
      '7/24 öncelikli destek hattı',
    ],
  },
};

function PlanDetailSheet({ plan, onBack }: { plan: Plan; onBack: () => void }) {
  const [done, setDone] = useState(false);
  const cfg = PLAN_DETAIL[plan.name];
  if (!cfg) return null;

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); setDone(true); };

  if (done) {
    return (
      <div className="py-10 text-center space-y-4 animate-fade-in">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto animate-success-pop
                        bg-emerald-100 dark:bg-emerald-500/15">
          <Check className="w-7 h-7 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">İstek Alındı!</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto">{cfg.proofLine}</p>
        </div>
        <button onClick={onBack} className="text-sm text-brand-600 dark:text-brand-400 hover:underline font-medium">
          ← Planlara Dön
        </button>
      </div>
    );
  }

  const isPro = plan.highlight;

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Back navigation */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs font-semibold group
                   text-slate-500 dark:text-slate-400
                   hover:text-brand-600 dark:hover:text-brand-400 transition-colors -ml-0.5"
      >
        <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
        Planlara Dön
      </button>

      {/* Hero card — Tactile Kinetic */}
      <div className={`relative rounded-2xl p-5 border overflow-hidden ${
        isPro
          ? 'bg-gradient-to-br from-brand-600 to-indigo-700 border-brand-500/80'
          : plan.name === 'Kurumsal'
            ? 'bg-gradient-to-br from-violet-50 to-slate-50 border-violet-100 dark:from-violet-950/40 dark:to-slate-800/60 dark:border-violet-500/20'
            : 'bg-gradient-to-br from-blue-50 to-indigo-50/60 border-blue-100 dark:from-blue-950/40 dark:to-indigo-950/20 dark:border-blue-500/20'
      }`}>
        {/* Grain texture overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.035]"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='150' height='150' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")" }}
        />

        <div className="relative z-10">
          <div className="flex items-start gap-3.5 mb-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isPro
                ? 'bg-white/20 text-white'
                : plan.name === 'Kurumsal'
                  ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400'
                  : 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
            }`}>
              <plan.icon className="w-5 h-5" strokeWidth={1.8} />
            </div>
            <div>
              <p className={`text-[11px] font-semibold uppercase tracking-wider mb-0.5 ${
                isPro ? 'text-blue-200' : 'text-slate-500 dark:text-slate-400'
              }`}>
                {plan.name} Planı · {plan.price}
                {plan.period !== 'sonsuza dek' && plan.period !== 'teklif alın' ? ` / ${plan.period}` : ''}
              </p>
              <p className={`text-lg font-bold leading-snug ${
                isPro ? 'text-white' : 'text-slate-900 dark:text-white'
              }`}>
                {cfg.tagline}
              </p>
            </div>
          </div>

          <ul className="space-y-2">
            {cfg.highlights.map((h) => (
              <li key={h} className="flex items-center gap-2.5">
                <span className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center ${
                  isPro
                    ? 'bg-white/20 text-white'
                    : 'bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400'
                }`}>
                  <Check className="w-2.5 h-2.5" strokeWidth={3} />
                </span>
                <span className={`text-xs font-medium ${
                  isPro ? 'text-white' : 'text-slate-700 dark:text-slate-300'
                }`}>
                  {h}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Proof line */}
      <p className="text-[11px] text-center text-slate-400 dark:text-slate-500 tracking-wide">
        {cfg.proofLine}
      </p>

      {/* Action form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        {cfg.formType === 'free' && (
          <div className="space-y-1.5">
            <label className="form-label">E-posta adresiniz</label>
            <input type="email" required placeholder="siz@ornek.com" className="form-input" />
          </div>
        )}

        {cfg.formType === 'pro' && (
          <>
            <div className="space-y-1.5">
              <label className="form-label">E-posta adresiniz</label>
              <input type="email" required placeholder="siz@ornek.com" className="form-input" />
            </div>
            <div className="space-y-1.5">
              <label className="form-label">Ödeme Yöntemi</label>
              <select className="form-input appearance-none">
                <option>Kredi / Banka Kartı</option>
                <option>EFT / IBAN Transferi</option>
              </select>
            </div>
          </>
        )}

        {cfg.formType === 'enterprise' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="form-label">Ad Soyad</label>
                <input type="text" required placeholder="Ayşe Yılmaz" className="form-input" />
              </div>
              <div className="space-y-1.5">
                <label className="form-label">Şirket</label>
                <input type="text" required placeholder="Şirket Adı" className="form-input" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="form-label">
                Mesajınız{' '}
                <span className="font-normal text-slate-400 dark:text-slate-500">(isteğe bağlı)</span>
              </label>
              <textarea rows={3} placeholder="Ekibinizin ihtiyaçlarını kısaca açıklayın…"
                className="form-input resize-none" />
            </div>
          </>
        )}

        <Button type="submit" className="w-full mt-1">
          {cfg.ctaLabel}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}

function PricingContent() {
  const [activePlan, setActivePlan] = useState<Plan | null>(null);

  if (activePlan) {
    return <PlanDetailSheet plan={activePlan} onBack={() => setActivePlan(null)} />;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={`relative rounded-2xl p-5 flex flex-col border transition-all duration-300
              ${plan.highlight
                ? 'bg-brand-600 border-brand-500 pro-glow'
                : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/60 shadow-sm dark:shadow-none hover:shadow-md dark:hover:shadow-slate-900/50 hover:-translate-y-0.5'
              }`}
          >
            {/* Popular badge */}
            {plan.badge && (
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 text-[11px]
                               font-bold uppercase tracking-wider whitespace-nowrap rounded-full
                               bg-amber-400 text-amber-900 shadow-lg shadow-amber-400/30">
                ✦ {plan.badge}
              </span>
            )}

            {/* Plan icon */}
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${
              plan.highlight
                ? 'bg-white/20 text-white'
                : 'bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400'
            }`}>
              <plan.icon className="w-5 h-5" strokeWidth={1.8} />
            </div>

            {/* Name + price */}
            <p className={`text-sm font-semibold mb-0.5 ${
              plan.highlight ? 'text-blue-200' : 'text-slate-600 dark:text-slate-400'
            }`}>
              {plan.name}
            </p>
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className={`text-2xl font-extrabold ${
                plan.highlight ? 'text-white' : 'text-slate-900 dark:text-white'
              }`}>
                {plan.price}
              </span>
              <span className={`text-xs ${
                plan.highlight ? 'text-blue-300' : 'text-slate-400 dark:text-slate-500'
              }`}>
                / {plan.period}
              </span>
            </div>
            <p className={`text-xs leading-relaxed mb-4 ${
              plan.highlight ? 'text-blue-200' : 'text-slate-600 dark:text-slate-400'
            }`}>
              {plan.description}
            </p>

            {/* Features */}
            <ul className="space-y-2 mb-5 flex-1">
              {plan.features.map((f) => (
                <li key={f.text} className="flex items-center gap-2">
                  <span className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center
                    ${f.included
                      ? plan.highlight
                        ? 'bg-white/20 text-white'
                        : 'bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400'
                      : 'bg-slate-100 dark:bg-slate-700/60 text-slate-400 dark:text-slate-600'
                    }`}
                  >
                    <Check className="w-2.5 h-2.5" strokeWidth={3} />
                  </span>
                  <span className={`text-xs ${
                    f.included
                      ? plan.highlight
                        ? 'text-white'
                        : 'text-slate-700 dark:text-slate-300'
                      : plan.highlight
                        ? 'text-blue-400/50'
                        : 'text-slate-400 dark:text-slate-600 line-through'
                  }`}>
                    {f.text}
                  </span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <button
              onClick={() => setActivePlan(plan)}
              className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
                ${plan.highlight
                  ? 'bg-white text-brand-600 hover:bg-blue-50 hover:shadow-md'
                  : 'bg-brand-600 dark:bg-brand-600 text-white hover:bg-brand-700 dark:hover:bg-brand-500'
                }`}
            >
              {plan.cta}
            </button>
          </div>
        ))}
      </div>

      {/* Trust badges */}
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-3 pt-1">
        {[
          { icon: Shield,     text: 'SSL Güvenli Ödeme'    },
          { icon: Globe,      text: 'KVKK Uyumlu'          },
          { icon: Headphones, text: '7/24 Teknik Destek'   },
          { icon: Users,      text: '500+ Aktif Kullanıcı' },
        ].map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
            <Icon className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            {text}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3 — CONTACT
// ─────────────────────────────────────────────────────────────────────────────

const SUBJECTS = [
  'Teknik Destek',
  'Satış ve Fiyatlandırma',
  'Entegrasyon Soruları',
  'Genel Bilgi',
  'Diğer',
];

const CONTACT_INFO = [
  { icon: MapPin, label: 'Adres',   value: 'Maslak, İstanbul, Türkiye' },
  { icon: Mail,   label: 'E-posta', value: 'info@reserveai.com'        },
  { icon: Phone,  label: 'Telefon', value: '+90 212 000 00 00'         },
];

const SOCIALS = [
  { icon: Twitter,  href: '#', label: 'Twitter'  },
  { icon: Linkedin, href: '#', label: 'LinkedIn'  },
  { icon: Github,   href: '#', label: 'GitHub'    },
];

function ContactContent() {
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); setSent(true); };

  if (sent) {
    return (
      <div className="py-10 text-center space-y-4 animate-fade-in">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto animate-success-pop
                        bg-emerald-100 dark:bg-emerald-500/15">
          <Check className="w-7 h-7 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Mesajınız İletildi!</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
          En kısa sürede size geri döneceğiz. Genellikle 1 iş günü içinde yanıt veriyoruz.
        </p>
        <button
          onClick={() => setSent(false)}
          className="text-sm text-brand-600 dark:text-brand-400 hover:underline"
        >
          Yeni mesaj gönder
        </button>
      </div>
    );
  }

  return (
    <div className="grid sm:grid-cols-5 gap-6 sm:gap-8">
      {/* Form — 3 cols */}
      <form onSubmit={handleSubmit} className="sm:col-span-3 space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="space-y-1.5">
            <label className="form-label">Ad Soyad</label>
            <input type="text" required placeholder="Ayşe Yılmaz" className="form-input" />
          </div>
          <div className="space-y-1.5">
            <label className="form-label">E-posta</label>
            <input type="email" required placeholder="ayse@firma.com" className="form-input" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="form-label">Konu</label>
          <select className="form-input appearance-none">
            {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="form-label">Mesajınız</label>
          <textarea required rows={4} placeholder="Nasıl yardımcı olabiliriz?"
            className="form-input resize-none" />
        </div>

        <Button type="submit" className="w-full">
          Mesaj Gönder
          <ArrowRight className="w-4 h-4" />
        </Button>
      </form>

      {/* Info — 2 cols */}
      <div className="sm:col-span-2 space-y-5">
        <div className="space-y-4">
          {CONTACT_INFO.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5
                              bg-brand-50 dark:bg-brand-500/15">
                <Icon className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">{value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="h-px bg-slate-100 dark:bg-slate-700/60" />

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
            Sosyal Medya
          </p>
          <div className="flex items-center gap-2">
            {SOCIALS.map(({ icon: Icon, href, label }) => (
              <a
                key={label} href={href} aria-label={label}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors
                           bg-slate-100 dark:bg-slate-700/60
                           text-slate-500 dark:text-slate-400
                           hover:bg-brand-50 dark:hover:bg-brand-500/15
                           hover:text-brand-600 dark:hover:text-brand-400"
              >
                <Icon className="w-4 h-4" />
              </a>
            ))}
          </div>
        </div>

        <div className="rounded-xl p-3.5 border
                        bg-brand-50 dark:bg-brand-500/10
                        border-brand-100 dark:border-brand-500/20">
          <p className="text-xs leading-relaxed text-brand-700 dark:text-brand-300">
            <strong>Ortalama yanıt süresi:</strong> 1 iş günü içinde.
            Acil teknik destek için öncelikli destek kanalımızı kullanın.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Router — picks the right modal
// ─────────────────────────────────────────────────────────────────────────────

const MODAL_CONFIG: Record<ModalId, { title: string; subtitle: string; size: ModalShellProps['size'] }> = {
  how: {
    title:    'Nasıl Çalışır?',
    subtitle: 'n8n otomasyonu ve yapay zeka entegrasyonu 3 adımda',
    size:     'lg',
  },
  pricing: {
    title:    'Fiyatlandırma',
    subtitle: 'Her ölçekte işletme için uygun bir paket',
    size:     'xl',
  },
  contact: {
    title:    'İletişim',
    subtitle: 'Sorularınız için ekibimize ulaşın',
    size:     'lg',
  },
};

export function NavModals({ activeModal, onClose }: NavModalsProps) {
  const cfg = MODAL_CONFIG[activeModal];

  return (
    <ModalShell
      title={cfg.title}
      subtitle={cfg.subtitle}
      size={cfg.size}
      onClose={onClose}
    >
      {activeModal === 'how'     && <HowItWorksContent />}
      {activeModal === 'pricing' && <PricingContent    />}
      {activeModal === 'contact' && <ContactContent    />}
    </ModalShell>
  );
}
