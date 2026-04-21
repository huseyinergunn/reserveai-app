import { useState } from 'react';
import {
  Bot, CalendarCheck, Zap, Sparkles, CheckCircle2, Clock,
  Mail, Search, Loader2, AlertTriangle,
  Shield, Star, ArrowRight, Home,
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
// Booking form (needs to be inside AppointmentProvider)
// ---------------------------------------------------------------------------

function BookingTabContent() {
  const { state } = useAppointment();
  const { screenState } = state;
  const isFormFlow = screenState.screen === 'form';

  return (
    <div className="px-3 sm:px-4 py-8 flex justify-center">
      <div id="booking-form-card" className="form-card w-full">
        {isFormFlow && <StepIndicator currentStep={screenState.step} />}
        {screenState.screen === 'form' && screenState.step === 1 && <Step1 />}
        {screenState.screen === 'form' && screenState.step === 2 && <Step2 />}
        {screenState.screen === 'form' && screenState.step === 3 && <Step3 />}
        {screenState.screen === 'declined' && <DeclineScreen />}
        {screenState.screen === 'success'  && <SuccessScreen summary={screenState.summary} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status check tab
// ---------------------------------------------------------------------------

function StatusTabContent() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AppointmentStatusItem[] | null>(null);
  const [error, setError]     = useState('');
  const [searched, setSearched] = useState(false);

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

  return (
    <div className="px-3 sm:px-4 py-8 flex justify-center">
      <div className="form-card w-full space-y-6">
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
          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex-shrink-0 flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Sorgula
          </button>
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
                </div>
              ))}
            </div>
          )
        )}
      </div>
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
            className="relative rounded-2xl p-6 space-y-4"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-3xl font-black text-slate-100 dark:text-slate-800 select-none">{step}</span>
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
  const [tab, setTab] = useState<Tab>('booking');

  return (
    <div className="page-bg flex flex-col">
      <ResultBanner />
      {/* Back to portal — fixed corner button */}
      <a
        href="/"
        className="fixed bottom-8 right-8 z-[1001] flex items-center gap-2.5
                   px-5 py-3 rounded-full
                   text-sm font-semibold text-white
                   bg-blue-600 hover:bg-blue-500
                   shadow-2xl shadow-blue-600/40
                   backdrop-blur-sm
                   transition-all duration-200 hover:-translate-y-1 active:translate-y-0 active:shadow-lg"
        title="Ana Sayfaya Dön"
      >
        <Home className="w-4 h-4" />
        Ana Sayfa
      </a>
      <Navbar />

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative z-10 text-center px-4 pt-14 sm:pt-20 pb-10">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6
                        border border-brand-500/30 bg-brand-500/10
                        text-brand-700 dark:text-white text-xs font-semibold select-none">
          <Sparkles className="w-3.5 h-3.5" />
          Yapay Zeka Destekli · Ücretsiz Deneyin
        </div>

        {/* Headline */}
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight mb-4
                       text-slate-900 dark:text-white max-w-3xl mx-auto">
          Randevunuzu{' '}
          <span className="hero-gradient-text">Saniyeler İçinde</span>{' '}
          Ayarlayın
        </h1>

        {/* Subtext */}
        <p className="text-sm sm:text-base lg:text-lg max-w-lg mx-auto leading-relaxed mb-8
                      text-slate-500 dark:text-slate-400">
          Yapay zeka asistanımız mesajınızı anlayarak size en uygun zamanı önerir.
          Hızlı, güvenli ve tamamen otomatik.
        </p>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => { setTab('booking'); document.getElementById('action-area')?.scrollIntoView({ behavior: 'smooth' }); }}
            className="btn-primary flex items-center gap-2"
          >
            <CalendarCheck className="w-4 h-4" />
            Hemen Randevu Al
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setTab('status'); document.getElementById('action-area')?.scrollIntoView({ behavior: 'smooth' }); }}
            className="btn-secondary flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            Randevumu Sorgula
          </button>
        </div>

        {/* Feature pills */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {[
            { icon: Bot,           text: 'AI destekli sınıflandırma' },
            { icon: CalendarCheck, text: 'Akıllı tarih önerileri'    },
            { icon: Zap,           text: 'Anında e-posta onayı'      },
          ].map(({ icon: Icon, text }) => (
            <div key={text}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                         bg-slate-100/80 dark:bg-white/5
                         border border-slate-200 dark:border-white/10
                         text-slate-500 dark:text-slate-400">
              <Icon className="w-3.5 h-3.5 text-brand-500 dark:text-brand-400" />
              {text}
            </div>
          ))}
        </div>
      </section>

      {/* ── Tab bar + interactive area ──────────────────────────────────── */}
      <section id="action-area" className="relative z-10 px-4">
        {/* Tab bar */}
        <div className="flex justify-center mb-0">
          <div className="inline-flex rounded-xl p-1 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50">
            {([
              { key: 'booking', label: 'Randevu Al',         icon: CalendarCheck },
              { key: 'status',  label: 'Randevumu Sorgula',  icon: Search },
            ] as { key: Tab; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all
                  ${tab === key
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        {tab === 'booking' ? (
          <AppointmentProvider>
            <BookingTabContent />
          </AppointmentProvider>
        ) : (
          <StatusTabContent />
        )}
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <HowItWorksSection />

      {/* ── Trust indicators ────────────────────────────────────────────── */}
      <TrustSection />

      <Footer />
    </div>
  );
}
