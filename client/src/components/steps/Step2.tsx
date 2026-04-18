import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAppointment } from '../../hooks/useAppointment';
import { step2Schema, type Step2Values } from '../../validators/formSchema';

const TERMS_SECTIONS = [
  {
    title: 'Görüşmelerin Bağlayıcı Olmayan Niteliği',
    body: 'Görüşme sırasında paylaşılan, tartışılan veya üzerinde uzlaşılan bilgiler bağlayıcı değildir ve geçicidir. Hizmet veya taahhüt niteliğindeki hiçbir anlaşma, açıkça yazılı olarak onaylanmadıkça kesinleşmiş sayılmaz.',
  },
  {
    title: 'Kayıt ve Not Araçlarının Yasaklanması',
    body: 'Randevu oluşturarak, görüşmeyi kayıt altına almak veya deşifre etmek amacıyla yapay zeka asistanları, not alma uygulamaları, kayıt cihazları ya da benzeri teknoloji araçları kullanmamayı kabul etmiş olursunuz. Bu kural, görüşmenin gizliliğine ve bütünlüğüne saygı göstermek amacıyla belirlenmiştir.',
  },
  {
    title: 'Koşulları Anladığınızın Onayı',
    body: 'Bu randevuyu oluşturarak, yukarıdaki hüküm ve koşulların tamamını okuduğunuzu ve kabul ettiğinizi beyan etmiş olursunuz.',
  },
];

export function Step2() {
  const { isLoading, globalError, submitStep2 } = useAppointment();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<Step2Values>({
    resolver: zodResolver(step2Schema),
    defaultValues: { accepted: false },
  });

  const accepted = watch('accepted');

  const onSubmit = async (_data: Step2Values) => {
    await submitStep2();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {/* Başlık */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-200/80 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">
            <ShieldCheck className="w-4 h-4" />
          </span>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Devam Etmeden Önce…</h2>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Randevunuzu oluşturmadan önce lütfen hüküm ve koşulları okuyun ve kabul edin.
        </p>
      </div>

      {/* Koşullar kutusu */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden inset-deep">
        {/* Başlık satırı */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700/50 sticky top-0 inset-header">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-500">
            Randevu Alma Hüküm &amp; Koşulları
          </p>
        </div>
        {/* İçerik */}
        <div className="p-4 space-y-4 max-h-52 overflow-y-auto scrollbar-thin">
          {TERMS_SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{section.title}</p>
              <p className="text-xs text-slate-500 dark:text-slate-500 leading-relaxed">{section.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Onay kutusu */}
      <label
        className={`flex items-start gap-3 cursor-pointer rounded-xl border p-3.5 transition-all duration-200
          ${accepted
            ? 'border-brand-500/50 bg-brand-500/10'
            : 'border-slate-200 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600/60'
          }`}
        style={!accepted ? undefined : undefined}
      >
        <div className="relative mt-0.5 flex-shrink-0">
          <input
            type="checkbox"
            className="sr-only"
            {...register('accepted')}
          />
          <div
            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-150
              ${accepted
                ? 'border-brand-500 bg-brand-600'
                : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
              }`}
          >
            {accepted && <CheckCircle2 className="w-3 h-3 text-white" strokeWidth={3} />}
          </div>
        </div>
        <span className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed select-none">
          Hüküm ve koşulları okudum, kabul ediyorum
        </span>
      </label>

      {errors.accepted && (
        <p className="form-error -mt-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {errors.accepted.message}
        </p>
      )}

      {/* Genel hata */}
      {globalError && (
        <div className="error-banner">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{globalError}</span>
        </div>
      )}

      {/* Gönder */}
      <button type="submit" disabled={isLoading} className="btn-primary w-full">
        {isLoading
          ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              İşleniyor…
            </span>
          )
          : 'Kabul Ediyorum — Devam Et →'
        }
      </button>
    </form>
  );
}
