import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { User, Mail, MessageSquare, AlertCircle, Sparkles, Brain, CalendarSearch, Zap } from 'lucide-react';
import { useAppointment } from '../../hooks/useAppointment';
import { step1Schema, type Step1Values } from '../../validators/formSchema';

const ENQUIRY_MAX = 2000;

const AI_STEPS = [
  { icon: Brain,          label: 'Mesajınız işleniyor…'               },
  { icon: CalendarSearch, label: 'Randevu niyeti analiz ediliyor…'    },
  { icon: Zap,            label: 'Tarih ve saat bilgisi çıkarılıyor…' },
];

export function Step1() {
  const { isLoading, globalError, submitStep1 } = useAppointment();
  const [enquiryLen, setEnquiryLen] = useState(0);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
  });

  const { onChange: onEnquiryChange, ...enquiryRest } = register('enquiry');

  const onSubmit = async (data: Step1Values) => {
    const result = await submitStep1(data);
    if (result.fieldErrors) {
      for (const [field, message] of Object.entries(result.fieldErrors)) {
        setError(field as keyof Step1Values, { message });
      }
    }
  };

  /* ── AI Analiz Ekranı ─────────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="py-6 flex flex-col items-center gap-6 animate-fade-in">
        {/* Animasyonlu AI ikonu */}
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-brand-600 flex items-center justify-center animate-ai-glow shadow-lg shadow-brand-600/40">
            <Sparkles className="w-10 h-10 text-white animate-sparkle-spin" />
          </div>
          <div className="absolute inset-0 rounded-2xl bg-brand-500/30 animate-ping" />
        </div>

        {/* Başlık */}
        <div className="text-center space-y-1.5">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">AI Mesajınızı Analiz Ediyor</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
            Groq destekli yapay zeka modelimiz sorgunuzu değerlendiriyor ve
            randevu niyetinizi anlıyor…
          </p>
        </div>

        {/* Zıplayan noktalar */}
        <div className="flex items-center gap-2">
          {[0, 200, 400].map((delay) => (
            <div
              key={delay}
              className="w-2.5 h-2.5 rounded-full bg-brand-500 animate-dot-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>

        {/* Adım iskeleti */}
        <div className="w-full space-y-2.5">
          {AI_STEPS.map(({ icon: Icon, label }, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-brand-500/20 inset-ai animate-slide-up"
              style={{ animationDelay: `${i * 120}ms` }}
            >
              <span className="flex-shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-500/20 text-brand-500 dark:text-brand-400">
                <Icon className="w-3.5 h-3.5" />
              </span>
              <span className="text-sm text-brand-600 dark:text-brand-300 font-medium">{label}</span>
              <div className="ml-auto h-2 w-12 rounded-full ai-shimmer-banner opacity-70" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {/* Başlık */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand-500/20 text-brand-500 dark:text-brand-400">
            <Sparkles className="w-4 h-4" />
          </span>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Randevu Talep Et</h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
          Kendinizi ve talebinizi kısaca anlatın. AI asistanımız uygun olup
          olmadığınızı değerlendirecek.
        </p>
      </div>

      {/* Ad Soyad */}
      <div className="space-y-1.5">
        <label htmlFor="name" className="form-label">
          Ad Soyad <span className="text-orange-500 dark:text-orange-400">*</span>
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            id="name"
            type="text"
            placeholder="örn. Ayşe Yılmaz"
            autoComplete="name"
            className={`form-input pl-9 ${errors.name ? 'form-input-error' : ''}`}
            {...register('name')}
          />
        </div>
        {errors.name && (
          <p className="form-error">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {errors.name.message}
          </p>
        )}
      </div>

      {/* E-posta */}
      <div className="space-y-1.5">
        <label htmlFor="email" className="form-label">
          E-posta Adresi <span className="text-orange-500 dark:text-orange-400">*</span>
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            id="email"
            type="email"
            placeholder="örn. ayse@firma.com"
            autoComplete="email"
            className={`form-input pl-9 ${errors.email ? 'form-input-error' : ''}`}
            {...register('email')}
          />
        </div>
        {errors.email && (
          <p className="form-error">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {errors.email.message}
          </p>
        )}
      </div>

      {/* Talebiniz */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="enquiry" className="form-label mb-0">
            Talebiniz <span className="text-orange-500 dark:text-orange-400">*</span>
          </label>
          <span className={`text-xs tabular-nums ${enquiryLen > ENQUIRY_MAX * 0.9 ? 'text-amber-500 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`}>
            {enquiryLen} / {ENQUIRY_MAX}
          </span>
        </div>
        <div className="relative">
          <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-slate-500 pointer-events-none" />
          <textarea
            id="enquiry"
            rows={4}
            placeholder="örn. İşletmem için yapay zeka otomasyonu konusunda yardım almak istiyorum…"
            className={`form-input pl-9 resize-none ${errors.enquiry ? 'form-input-error' : ''}`}
            onChange={(e) => {
              setEnquiryLen(e.target.value.length);
              onEnquiryChange(e);
            }}
            {...enquiryRest}
          />
        </div>
        {errors.enquiry && (
          <p className="form-error">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {errors.enquiry.message}
          </p>
        )}
        <p className="text-xs text-slate-400 dark:text-slate-500">
          En az 10 karakter. Ne kadar detay verirseniz AI o kadar iyi sonuç üretir.
        </p>
      </div>

      {/* Genel hata */}
      {globalError && (
        <div className="error-banner">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{globalError}</span>
        </div>
      )}

      {/* Gönder */}
      <button type="submit" disabled={isLoading} className="btn-primary w-full">
        Devam Et →
      </button>
    </form>
  );
}
