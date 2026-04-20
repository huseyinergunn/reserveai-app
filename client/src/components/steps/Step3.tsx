import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { DateTime } from 'luxon';
import { CalendarDays, Clock, User, Mail, AlertCircle, Sparkles, TriangleAlert } from 'lucide-react';
import { useAppointment } from '../../hooks/useAppointment';
import { step3Schema, type Step3Input, type Step3Values } from '../../validators/formSchema';
import { TIME_SLOTS, TIMEZONE } from '@shared/constants';
import { parseDateTimeFromForm } from '@shared/dateUtils';

// ---------------------------------------------------------------------------
// Yardımcı: ISO tarihi Türkçe göster — "Prş, 17 Nis" gibi
// ---------------------------------------------------------------------------

function formatDateTr(isoDate: string): string {
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      weekday: 'short', day: 'numeric', month: 'short',
      timeZone: 'Europe/Istanbul',
    }).format(new Date(isoDate + 'T12:00:00'));
  } catch {
    return isoDate;
  }
}

// ---------------------------------------------------------------------------
// AI tarih/saat doğrulama — artık ISO (YYYY-MM-DD) ile çalışır
// ---------------------------------------------------------------------------

interface AiWarnings { date: string | null; time: string | null; }

function computeAiWarnings(aiDate: string, aiTime: string, availableDates: string[]): AiWarnings {
  const warnings: AiWarnings = { date: null, time: null };

  if (aiDate) {
    const parsed = DateTime.fromISO(aiDate, { zone: 'Europe/Istanbul' });
    if (parsed.isValid) {
      const today = DateTime.now().setZone('Europe/Istanbul').startOf('day');
      if (parsed.startOf('day') < today) {
        warnings.date = 'AI bu tarihi önerdi ancak bugünden eski. Lütfen kontrol edin.';
      } else if (parsed.weekday === 6 || parsed.weekday === 7) {
        warnings.date = 'AI bu tarihi önerdi ancak hafta sonuna denk geliyor. Lütfen kontrol edin.';
      } else if (availableDates.length > 0 && !availableDates.includes(aiDate)) {
        warnings.date = 'AI bu tarihi önerdi ancak müsait günler arasında değil. Lütfen kontrol edin.';
      }
    }
  }

  if (aiTime && !TIME_SLOTS.includes(aiTime as (typeof TIME_SLOTS)[number])) {
    warnings.time = 'AI bu saati önerdi ancak çalışma saatlerimiz dışında. Lütfen kontrol edin.';
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// Bileşen
// ---------------------------------------------------------------------------

export function Step3() {
  const {
    isLoading, globalError, step1Data, dateOptions,
    extractedData, clientDates, loadDateOptions, submitStep3,
  } = useAppointment();

  useEffect(() => { loadDateOptions(); }, [loadDateOptions]);

  const availableDates = dateOptions?.dates ?? clientDates;
  // Always use local TIME_SLOTS for the time selector — never trust the server's
  // time list, which may be stale or formatted differently (e.g. AM/PM).
  // The Zod schema validates against the same constant, so they always match.
  const availableTimes = TIME_SLOTS;

  const aiDate = extractedData?.date ?? '';
  const aiTime = extractedData?.time ?? '';
  const hasAiSuggestion = Boolean(aiDate || aiTime);

  const aiWarnings = useMemo(
    () => computeAiWarnings(aiDate, aiTime, availableDates),
    [aiDate, aiTime, availableDates],
  );

  const { register, handleSubmit, setError, watch, setValue, formState: { errors } } = useForm<Step3Input>({
    resolver: zodResolver(step3Schema),
    defaultValues: { date: aiDate, time: aiTime },
  });

  // Sync AI suggestions into the select fields whenever extractedData arrives.
  // defaultValues only apply on mount; this effect handles async AI responses.
  // shouldDirty + shouldTouch ensure the native <select> DOM element re-renders.
  useEffect(() => {
    if (extractedData?.date) {
      setValue('date', extractedData.date, { shouldDirty: true, shouldTouch: true, shouldValidate: false });
    }
    if (extractedData?.time) {
      // Normalise: find the exact slot string so value always matches TIME_SLOTS
      const slot = (TIME_SLOTS as readonly string[]).find((s) => s === extractedData.time);
      if (slot) setValue('time', slot, { shouldDirty: true, shouldTouch: true, shouldValidate: false });
    }
  }, [extractedData, setValue]);

  const selectedDate = watch('date');
  const bookedDateTimes = dateOptions?.bookedDateTimes ?? [];

  /** Returns true if this time slot is already booked for the currently selected date. */
  const isTimeBooked = useMemo(() => {
    if (!selectedDate || bookedDateTimes.length === 0) return (_t: string) => false;
    return (timeSlot: string) => {
      try {
        const iso = parseDateTimeFromForm(selectedDate, timeSlot, TIMEZONE);
        return bookedDateTimes.some((booked) => booked === iso);
      } catch {
        return false;
      }
    };
  }, [selectedDate, bookedDateTimes]);

  const selectedTime = watch('time');
  const isSelectedTimeBooked = selectedTime ? isTimeBooked(selectedTime) : false;

  const onSubmit = async (data: Step3Input) => {
    const result = await submitStep3(data as Step3Values);
    if (result.fieldErrors) {
      for (const [field, message] of Object.entries(result.fieldErrors)) {
        if (field === 'date' || field === 'time' || field === 'dateTime') {
          // dateTime conflict errors appear under the time selector, not date
          setError(field === 'dateTime' ? 'time' : (field as keyof Step3Values), { message });
        }
      }
    }
  };

  const datesLoading = !dateOptions && availableDates.length === 0;

  const initials =
    step1Data?.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() ?? '';

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {/* ── Başlık ─────────────────────────────────────────────────────────── */}
      <div className="space-y-1 animate-slide-up" style={{ animationDelay: '0ms' }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand-500/20 text-brand-500 dark:text-brand-400">
            <CalendarDays className="w-4 h-4" />
          </span>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Tarih ve Saat Seçin</h2>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Önümüzdeki 5 iş gününden birini seçin. Hafta sonları randevu alınamaz.
        </p>
      </div>

      {/* ── AI Shimmer Banner ─────────────────────────────────────────────── */}
      {hasAiSuggestion && (
        <div
          className="rounded-xl ai-shimmer-banner p-3.5 flex items-start gap-3 relative overflow-hidden animate-slide-up"
          style={{ animationDelay: '80ms' }}
        >
          <span className="absolute top-2.5 right-3 text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 border border-brand-500/40 bg-brand-500/10 px-2 py-0.5 rounded-full select-none">
            AI Optimize
          </span>
          <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand-500/20 text-brand-500 dark:text-brand-400">
            <Sparkles className="w-4 h-4 animate-sparkle-spin" />
          </span>
          <div className="space-y-0.5 min-w-0 pr-24">
            <p className="text-sm font-semibold text-brand-600 dark:text-brand-300">
              Niyet Anlaşıldı · AI tarafından optimize edildi
            </p>
            {extractedData?.suggestionMessage ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{extractedData.suggestionMessage}</p>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {[aiDate, aiTime].filter(Boolean).join(' · ')} otomatik seçildi.
                Dilediğiniz gibi değiştirebilirsiniz.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Tarih seçici ──────────────────────────────────────────────────── */}
      <div className="space-y-1.5 animate-slide-up" style={{ animationDelay: '160ms' }}>
        <label htmlFor="date" className="form-label">
          Tarih <span className="text-orange-500 dark:text-orange-400">*</span>
        </label>
        <div className="relative">
          <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <select
            id="date"
            disabled={datesLoading}
            className={`form-input pl-9 appearance-none ${errors.date ? 'form-input-error' : ''}`}
            {...register('date')}
          >
            <option value="" disabled>
              {datesLoading ? 'Tarihler yükleniyor…' : 'Tarih seçin'}
            </option>
            {availableDates.map((d) => (
              <option key={d} value={d}>{formatDateTr(d)}</option>
            ))}
          </select>
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
          </svg>
        </div>
        {aiWarnings.date && !errors.date && (
          <p className="ai-date-warning">
            <TriangleAlert className="w-3.5 h-3.5 flex-shrink-0" />
            {aiWarnings.date}
          </p>
        )}
        {errors.date && (
          <p className="form-error">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {errors.date.message}
          </p>
        )}
      </div>

      {/* ── Saat seçici ───────────────────────────────────────────────────── */}
      <div className="space-y-1.5 animate-slide-up" style={{ animationDelay: '240ms' }}>
        <label htmlFor="time" className="form-label">
          Saat <span className="text-orange-500 dark:text-orange-400">*</span>
        </label>
        <div className="relative">
          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <select
            id="time"
            className={`form-input pl-9 appearance-none ${errors.time ? 'form-input-error' : isSelectedTimeBooked ? 'form-input-error' : ''}`}
            {...register('time')}
          >
            <option value="" disabled>Saat seçin</option>
            {availableTimes.map((t) => {
              const booked = isTimeBooked(t);
              return (
                <option key={t} value={t} disabled={booked}>
                  {booked ? `${t} — 🔴 Dolu` : t}
                </option>
              );
            })}
          </select>
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
          </svg>
        </div>
        {aiWarnings.time && !errors.time && !isSelectedTimeBooked && (
          <p className="ai-date-warning">
            <TriangleAlert className="w-3.5 h-3.5 flex-shrink-0" />
            {aiWarnings.time}
          </p>
        )}
        {isSelectedTimeBooked && !errors.time && (
          <p className="form-error">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            Bu saat zaten rezerve edilmiş. Lütfen başka bir saat seçin.
          </p>
        )}
        {errors.time && (
          <p className="form-error">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {errors.time.message}
          </p>
        )}
      </div>

      {/* ── Randevu özeti ─────────────────────────────────────────────────── */}
      {step1Data && (
        <div
          className="rounded-xl border border-slate-200 dark:border-slate-700/50 p-3.5 flex items-start gap-3 inset-surface animate-slide-up"
          style={{ animationDelay: '320ms' }}
        >
          <span className="flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full bg-brand-500/20 text-brand-600 dark:text-brand-400 text-sm font-bold select-none border border-brand-500/30">
            {initials}
          </span>
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Randevu Sahibi
            </p>
            <p className="text-sm text-slate-700 dark:text-slate-300 flex items-center gap-1.5 truncate">
              <User className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
              {step1Data.name}
            </p>
            <p className="text-sm text-slate-700 dark:text-slate-300 flex items-center gap-1.5 truncate">
              <Mail className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
              {step1Data.email}
            </p>
          </div>
        </div>
      )}

      {/* Genel hata */}
      {globalError && (
        <div className="error-banner">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{globalError}</span>
        </div>
      )}

      {/* Gönder */}
      <button
        type="submit"
        disabled={isLoading || datesLoading || isSelectedTimeBooked}
        className="btn-primary w-full animate-slide-up"
        style={{ animationDelay: '400ms' }}
      >
        {isLoading
          ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Gönderiliyor…
            </span>
          )
          : 'Randevu İsteği Gönder →'
        }
      </button>
    </form>
  );
}
