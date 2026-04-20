import {
  AppointmentProvider,
  useAppointment,
} from './context/AppointmentContext';
import { Navbar }        from './components/layout/Navbar';
import { Footer }        from './components/layout/Footer';
import { StepIndicator } from './components/layout/StepIndicator';
import { Step1 }         from './components/steps/Step1';
import { Step2 }         from './components/steps/Step2';
import { Step3 }         from './components/steps/Step3';
import { SuccessScreen } from './components/screens/SuccessScreen';
import { DeclineScreen } from './components/screens/DeclineScreen';
import { ResultBanner }  from './components/ui/ResultBanner';
import { Sparkles, Bot, CalendarCheck, Zap } from 'lucide-react';

// ---------------------------------------------------------------------------
// Hero section — visible only during the form flow
// ---------------------------------------------------------------------------

const FEATURES = [
  { icon: Bot,           text: 'AI destekli sınıflandırma'  },
  { icon: CalendarCheck, text: 'Akıllı tarih önerileri'      },
  { icon: Zap,           text: 'Anında e-posta onayı'        },
];

function HeroSection() {
  return (
    <section className="relative z-10 text-center px-4 pt-10 sm:pt-14 pb-8 sm:pb-10">
      {/* Badge */}
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-5 sm:mb-6 select-none
                      border border-brand-500/30 bg-brand-500/10
                      text-brand-700 dark:text-white text-xs font-semibold">
        <Sparkles className="w-3.5 h-3.5" />
        Yapay Zeka Destekli · Ücretsiz Deneyin
      </div>

      {/* Headline */}
      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight mb-3 sm:mb-4
                     text-slate-900 dark:text-white">
        Randevunuzu{' '}
        <span className="hero-gradient-text">
          Saniyeler İçinde
        </span>{' '}
        Ayarlayın
      </h1>

      {/* Subtext */}
      <p className="text-sm sm:text-base lg:text-lg max-w-md mx-auto leading-relaxed mb-6 sm:mb-8
                    text-slate-500 dark:text-slate-400">
        Yapay zeka asistanımız mesajınızı anlayarak size en uygun zamanı önerir.
        Hızlı, akıllı ve tamamen otomatik.
      </p>

      {/* Feature pills */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        {FEATURES.map(({ icon: Icon, text }) => (
          <div
            key={text}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                       bg-slate-100/80 dark:bg-white/5
                       border border-slate-200 dark:border-white/10
                       text-slate-500 dark:text-slate-400"
          >
            <Icon className="w-3.5 h-3.5 text-brand-500 dark:text-brand-400" />
            {text}
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main content
// ---------------------------------------------------------------------------

function AppContent() {
  const { state } = useAppointment();
  const { screenState } = state;

  const isFormFlow = screenState.screen === 'form';

  return (
    <div className="page-bg min-h-screen flex flex-col">
      <ResultBanner />
      <Navbar />

      <main className="flex-1 flex flex-col relative z-10">
        {/* Hero — only shown on form steps */}
        {isFormFlow && <HeroSection />}

        {/* Non-form screens get breathing room */}
        {!isFormFlow && <div className="pt-10 sm:pt-14" />}

        {/* Form card area */}
        <div className="px-3 sm:px-4 pb-12 sm:pb-16 flex justify-center">
          <div className="form-card">
            {/* Step indicator — only during form flow */}
            {isFormFlow && (
              <StepIndicator currentStep={screenState.step} />
            )}

            {screenState.screen === 'form' && screenState.step === 1 && <Step1 />}
            {screenState.screen === 'form' && screenState.step === 2 && <Step2 />}
            {screenState.screen === 'form' && screenState.step === 3 && <Step3 />}
            {screenState.screen === 'declined' && <DeclineScreen />}
            {screenState.screen === 'success' && (
              <SuccessScreen summary={screenState.summary} />
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <AppointmentProvider>
      <AppContent />
    </AppointmentProvider>
  );
}
