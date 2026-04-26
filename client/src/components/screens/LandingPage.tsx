import { useState, useRef, useEffect } from 'react';
import {
  Bot, CalendarCheck, Zap, Sparkles, CheckCircle2, Clock,
  Mail, Search, AlertTriangle,
  Shield, Star, Home,
} from 'lucide-react';
import { Navbar }           from '../layout/Navbar';
import { Footer }           from '../layout/Footer';
import { StepIndicator }    from '../layout/StepIndicator';
import { Step1 }            from '../steps/Step1';
import { Step2 }            from '../steps/Step2';
import { Step3 }            from '../steps/Step3';
import { SuccessScreen }    from './SuccessScreen';
import { DeclineScreen }    from './DeclineScreen';
import {
  AppointmentProvider,
  useAppointment,
} from '../../context/AppointmentContext';
import { api, type AppointmentStatusItem } from '../../services/api';
import { formatDisplayDateTime } from '@shared/dateUtils';
import { TIMEZONE }             from '@shared/constants';
import { ResultBanner }         from '../ui/ResultBanner';
import { Button }               from '../ui/Button';
import { CustomerChat }         from '../chat/CustomerChat';
import { BentoCarousel }        from '../ui/BentoCarousel';

// ---------------------------------------------------------------------------
// Status badge helpers
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<string, string> = {
  pending:   'Onay Bekleniyor',
  approved:  'Onaylandı',
  rejected:  'Reddedildi',
  cancelled: 'İptal Edildi',
  completed: 'Tamamlandı',
};

const STATUS_STYLE: Record<string, string> = {
  pending:   'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30',
  approved:  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30',
  rejected:  'bg-red-500/15 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-500/30',
  cancelled: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-600',
  completed: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-500/30',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLE[status] ?? STATUS_STYLE.cancelled}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Booking form inline (inside glass card — no form-card wrapper)
// ---------------------------------------------------------------------------

function BookingFormInline() {
  const { state } = useAppointment();
  const { screenState } = state;
  const isFormFlow = screenState.screen === 'form';

  return (
    <>
      {isFormFlow && <StepIndicator currentStep={screenState.step} />}
      {screenState.screen === 'form' && screenState.step === 1 && <Step1 />}
      {screenState.screen === 'form' && screenState.step === 2 && <Step2 />}
      {screenState.screen === 'form' && screenState.step === 3 && <Step3 />}
      {screenState.screen === 'declined' && <DeclineScreen />}
      {screenState.screen === 'success'  && <SuccessScreen summary={screenState.summary} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Status check inline (inside glass card — no form-card wrapper)
// ---------------------------------------------------------------------------

function StatusFormInline() {
  const [email, setEmail]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [results, setResults]   = useState<AppointmentStatusItem[] | null>(null);
  const [error, setError]       = useState('');
  const [searched, setSearched] = useState(false);
  const [cancelState, setCancelState] = useState<Record<string, 'idle' | 'loading' | 'sent' | 'error'>>({});

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Lütfen geçerli bir e-posta adresi girin.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await api.getAppointmentStatus(trimmed);
      setResults(data.appointments);
      setSearched(true);
    } catch (err: unknown) {
      const e = err as { error?: string };
      setError(e.error ?? 'Sorgulama sırasında bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelRequest(bookingReference: string) {
    setCancelState((s) => ({ ...s, [bookingReference]: 'loading' }));
    try {
      await api.requestCancellation(email.trim(), bookingReference);
      setCancelState((s) => ({ ...s, [bookingReference]: 'sent' }));
    } catch {
      setCancelState((s) => ({ ...s, [bookingReference]: 'error' }));
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/15 border border-brand-300 dark:border-brand-500/30 flex items-center justify-center">
            <Search className="w-6 h-6 text-brand-600 dark:text-brand-400" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Randevum Ne Durumda?</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          E-posta adresinizi girerek tüm randevularınızın güncel durumunu görün.
        </p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(''); }}
            placeholder="ornek@email.com"
            className={`form-input pl-9 ${error ? 'form-input-error' : ''}`}
            disabled={loading}
          />
        </div>
        <Button type="submit" disabled={loading} loading={loading} className="flex-shrink-0">
          {!loading && <Search className="w-4 h-4" />}
          Sorgula
        </Button>
      </form>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </p>
      )}

      {/* Results */}
      {searched && results !== null && (
        results.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto">
              <CalendarCheck className="w-6 h-6 text-slate-400" />
            </div>
            <p className="font-medium text-slate-600 dark:text-slate-400">Randevu bulunamadı</p>
            <p className="text-sm text-slate-400">Bu e-posta adresiyle kayıtlı randevunuz yok.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {results.length} randevu bulundu
            </p>
            {results.map((apt) => (
              <div
                key={apt._id}
                className="rounded-xl border border-slate-200 dark:border-slate-700/50 inset-surface px-4 py-3.5 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{apt.name}</p>
                    <p className="text-xs font-mono text-slate-400 mt-0.5">{apt.bookingReference}</p>
                  </div>
                  <StatusBadge status={apt.status} />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                  {formatDisplayDateTime(apt.dateTime, TIMEZONE)}
                </div>
                {apt.status === 'pending' && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Randevunuz inceleme aşamasında. En kısa sürede e-posta ile bildirim alacaksınız.
                  </p>
                )}
                {apt.status === 'approved' && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    Randevunuz onaylandı. Takvim davetiyesi e-posta adresinize gönderildi.
                  </p>
                )}
                {(apt.status === 'pending' || apt.status === 'approved') && (() => {
                  const cs = cancelState[apt.bookingReference] ?? 'idle';
                  if (cs === 'sent') return (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                      İptal bağlantısı e-posta adresinize gönderildi.
                    </p>
                  );
                  return (
                    <div className="pt-1 space-y-1">
                      <button
                        onClick={() => handleCancelRequest(apt.bookingReference)}
                        disabled={cs === 'loading'}
                        className="text-xs text-red-500 dark:text-red-400 border border-red-200 dark:border-red-500/30
                                   rounded-lg px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-500/10
                                   disabled:opacity-50 transition-colors flex items-center gap-1.5"
                      >
                        {cs === 'loading'
                          ? <><span className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" /> Gönderiliyor…</>
                          : '🚫 İptal Talebi Gönder'}
                      </button>
                      {cs === 'error' && (
                        <p className="text-[11px] text-red-500">Gönderilemedi, tekrar deneyin.</p>
                      )}
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Static sections
// ---------------------------------------------------------------------------

const HOW_IT_WORKS = [
  {
    step:  '01',
    icon:  Bot,
    color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30',
    title: 'AI Talebi Analiz Eder',
    desc:  'Mesajınızı yazın. Yapay zeka asistanımız talebinizi saniyeler içinde analiz ederek uygunluğunu değerlendirir.',
  },
  {
    step:  '02',
    icon:  CalendarCheck,
    color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30',
    title: 'Tarih & Saat Seçin',
    desc:  'Müsait tarih ve saatler otomatik listelenir. Size en uygun zamanı seçmeniz yeterli.',
  },
  {
    step:  '03',
    icon:  Zap,
    color: 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-500/30',
    title: 'Onayı Bekleyin',
    desc:  'E-posta kutunuzu kontrol edin. Randevunuz onaylandığında takvim davetiyesi ve bildirim gönderilir.',
  },
];

const TRUST_ITEMS = [
  { icon: Shield,        text: 'Güvenli & Şifreli',      sub: 'Verileriniz korunuyor' },
  { icon: Zap,           text: 'Anlık Bildirim',          sub: 'E-posta ve takvim entegrasyonu' },
  { icon: Star,          text: 'AI Destekli',             sub: 'Akıllı talep analizi' },
  { icon: CheckCircle2,  text: '7/24 Erişim',             sub: 'Her an randevu alın' },
];

function HowItWorksSection() {
  return (
    <section className="relative z-10 px-4 py-16 sm:py-20 max-w-5xl mx-auto">
      <div className="text-center mb-12">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-500 mb-2">Süreç</p>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
          Nasıl Çalışır?
        </h2>
        <p className="mt-2 text-slate-500 dark:text-slate-400 max-w-md mx-auto text-sm sm:text-base">
          3 basit adımda randevunuzu alın — yapay zeka gerisini halleder.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-6">
        {HOW_IT_WORKS.map(({ step, icon: Icon, color, title, desc }) => (
          <div
            key={step}
            className="relative rounded-3xl p-6 space-y-4 flex flex-col items-center text-center jelly-hover"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}
          >
            <div className="flex flex-col items-center gap-2">
              <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <span className="text-4xl font-black text-slate-100 dark:text-slate-800 select-none leading-none">{step}</span>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">{title}</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TrustSection() {
  return (
    <section className="relative z-10 px-4 py-12 border-t border-slate-200 dark:border-white/5">
      <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4">
        {TRUST_ITEMS.map(({ icon: Icon, text, sub }) => (
          <div key={text} className="text-center space-y-2 py-4">
            <div className="flex justify-center">
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-200 dark:border-brand-500/20 flex items-center justify-center">
                <Icon className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              </div>
            </div>
            <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{text}</p>
            <p className="text-xs text-slate-400">{sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main LandingPage
// ---------------------------------------------------------------------------

type Tab = 'booking' | 'status';

export function LandingPage() {
  const [tab, setTab]             = useState<Tab>('booking');
  const [formFocused, setFormFocused] = useState(false);
  const bookingAreaRef            = useRef<HTMLDivElement>(null);

  // Warm up the Render server on page load so the first form submit never cold-starts
  useEffect(() => {
    const base = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
    fetch(`${base}/health`, { method: 'GET' }).catch(() => {/* silent */});
  }, []);

  useEffect(() => {
    function onFocusIn(e: FocusEvent) {
      if (bookingAreaRef.current?.contains(e.target as Node)) {
        setFormFocused(true);
      }
    }
    function onFocusOut(e: FocusEvent) {
      if (!bookingAreaRef.current?.contains(e.relatedTarget as Node)) {
        setFormFocused(false);
      }
    }
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  return (
    <div className="page-bg flex flex-col">
      <ResultBanner />
      {/* Ana Sayfa — portal sayfasına dön */}
      <button
        type="button"
        onClick={() => { window.location.href = '/'; }}
        title="Ana Sayfaya Dön"
        aria-label="Ana Sayfaya Dön"
        className="fixed bottom-6 right-6 z-[9999]
                   hidden lg:flex items-center gap-2
                   py-3 px-6 rounded-full
                   text-sm font-semibold text-white
                   bg-blue-600 hover:bg-blue-500
                   shadow-2xl shadow-blue-600/60
                   hover:scale-105 active:scale-95
                   transition-all duration-200"
        style={{ boxShadow: '0 8px 32px rgba(37,99,235,0.55), 0 0 0 1px rgba(96,165,250,0.2)' }}
      >
        <Home className="w-4 h-4 flex-shrink-0" />
        <span className="hidden lg:inline">Ana Sayfa</span>
      </button>
      <Navbar />

      {/* ── Hero + Form — Two Column ────────────────────────────────────── */}
      <section
        id="action-area"
        className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-10 pb-3"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-10 items-start">

          {/* ── LEFT: Text content ── */}
          <div className="flex flex-col gap-4 lg:gap-6 items-center lg:items-start text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full self-center lg:self-start
                            border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5
                            text-slate-600 dark:text-slate-300 text-xs font-medium select-none">
              <Sparkles className="w-3 h-3 text-brand-500" />
              Yapay Zeka Destekli · Ücretsiz Deneyin
            </div>

            {/* Headline */}
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black leading-[1.08] tracking-tight
                           text-slate-900 dark:text-white">
              Randevunuzu{' '}
              <span className="hero-gradient-text">Saniyeler İçinde</span>{' '}
              Ayarlayın
            </h1>

            {/* Subtext */}
            <p className="text-xs lg:text-sm leading-relaxed text-slate-500 dark:text-slate-400 max-w-xs">
              Yapay zeka asistanımız mesajınızı anlayarak size en uygun zamanı önerir.
              Hızlı, güvenli ve tamamen otomatik.
            </p>

            {/* Feature pills — desktop only */}
            <div className="hidden lg:flex flex-wrap gap-1.5">
              {[
                { icon: Bot,           text: 'AI destekli sınıflandırma' },
                { icon: CalendarCheck, text: 'Akıllı tarih önerileri'    },
                { icon: Zap,           text: 'Anında e-posta onayı'      },
              ].map(({ icon: Icon, text }) => (
                <div key={text}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium
                             bg-slate-100/80 dark:bg-white/5
                             border border-slate-200 dark:border-white/10
                             text-slate-500 dark:text-slate-400">
                  <Icon className="w-3 h-3 text-brand-500 dark:text-brand-400" />
                  {text}
                </div>
              ))}
            </div>

            {/* Trust mini-stats — desktop only */}
            <div className="hidden lg:flex items-center gap-4">
              <div>
                <p className="text-xl font-black text-slate-900 dark:text-white">7/24</p>
                <p className="text-[10px] text-slate-400">Erişim</p>
              </div>
              <div className="w-px h-8 bg-slate-200 dark:bg-white/10" />
              <div>
                <p className="text-xl font-black text-slate-900 dark:text-white">~3s</p>
                <p className="text-[10px] text-slate-400">AI Analiz</p>
              </div>
              <div className="w-px h-8 bg-slate-200 dark:bg-white/10" />
              <div>
                <p className="text-xl font-black text-slate-900 dark:text-white">100%</p>
                <p className="text-[10px] text-slate-400">Güvenli</p>
              </div>
            </div>

            {/* Bento carousel — desktop only */}
            <BentoCarousel />
          </div>

          {/* ── RIGHT: Glassmorphism form card ── */}
          <div className="relative">
            {/* Ambient light leak — focus durumunda nefes alır */}
            <div className={`absolute -inset-10 bg-brand-500/10 blur-[80px] rounded-full pointer-events-none transition-all duration-1000 ${formFocused ? 'glow-breathe' : ''}`} />
            <div className={`absolute -bottom-8 -left-8 w-64 h-64 bg-violet-500/6 blur-[60px] rounded-full pointer-events-none transition-all duration-1000 ${formFocused ? 'glow-breathe' : ''}`} style={{ animationDelay: '1.5s' }} />

            {/* Card — ağır cam blok, jelly değil */}
            <div
              className="relative rounded-[2rem] overflow-hidden
                          bg-white/80 dark:bg-slate-900/80
                          backdrop-blur-2xl
                          border border-white/60 dark:border-white/10
                          form-card-premium form-grain"
              style={{ boxShadow: 'var(--card-shadow)' }}
            >

              {/* Inline tab header */}
              <div className="flex border-b border-slate-200/80 dark:border-white/10">
                {([
                  { key: 'booking', label: 'Randevu Al',        icon: CalendarCheck },
                  { key: 'status',  label: 'Randevumu Sorgula', icon: Search },
                ] as { key: Tab; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold
                                transition-all border-b-2 -mb-px
                                ${tab === key
                                  ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                                  : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                                }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="px-5 pt-4 pb-6 sm:px-6 sm:pt-4 sm:pb-6">
                {tab === 'booking' ? (
                  <AppointmentProvider>
                    <div ref={bookingAreaRef}>
                      <BookingFormInline />
                    </div>
                  </AppointmentProvider>
                ) : (
                  <StatusFormInline />
                )}
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <HowItWorksSection />

      {/* ── Trust indicators ────────────────────────────────────────────── */}
      <TrustSection />

      <Footer />
      <div className={formFocused ? 'hidden' : ''}>
        <CustomerChat />
      </div>
    </div>
  );
}
