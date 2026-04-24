import { Shield, Database, Globe, Trash2, Mail, ArrowLeft } from 'lucide-react';
import { Logo } from '../ui/Logo';

// ---------------------------------------------------------------------------
// Section helper
// ---------------------------------------------------------------------------

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon:     React.ElementType;
  title:    string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div className="w-9 h-9 rounded-xl bg-brand-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-brand-600 dark:text-brand-400" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-sm font-bold text-slate-800 dark:text-white">{title}</h2>
        <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed space-y-2">
          {children}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PrivacyPage
// ---------------------------------------------------------------------------

export function PrivacyPage() {
  return (
    <div className="page-bg min-h-screen flex flex-col">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700/60">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <a
            href="/"
            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-500 hover:bg-brand-500/10 transition-colors"
            aria-label="Geri dön"
          >
            <ArrowLeft className="w-4 h-4" />
          </a>
          <a href="/" className="flex items-center gap-2 select-none">
            <Logo className="w-7 h-7 flex-shrink-0" />
            <span className="font-bold text-slate-900 dark:text-white text-sm">
              Reserve<span className="text-brand-600 dark:text-brand-400">AI</span>
            </span>
          </a>
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-14">

        {/* Title block */}
        <div className="mb-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold
                          bg-brand-500/10 text-brand-700 dark:text-brand-400
                          border border-brand-300/50 dark:border-brand-500/30">
            <Shield className="w-3.5 h-3.5" />
            Gizlilik Politikası
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Verileriniz Güvende
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-xl">
            ReserveAI olarak kişisel verilerinizin korunması önceliğimizdir.
            Bu sayfa, hangi verileri topladığımızı, nasıl kullandığımızı ve
            haklarınızı açıklamaktadır.
          </p>
        </div>

        {/* Sections */}
        <div className="form-card space-y-8 !max-w-none">

          <Section icon={Database} title="Veri Saklama ve İşleme">
            <p>
              Randevu başvurunuzu aldığımızda <strong className="text-slate-800 dark:text-white">ad-soyad</strong>,{' '}
              <strong className="text-slate-800 dark:text-white">e-posta adresi</strong>,{' '}
              talep metni ve seçtiğiniz tarih-saat bilgileri MongoDB Atlas altyapısında
              şifreli bağlantı üzerinden güvenli biçimde saklanır.
            </p>
            <p>
              Toplanan veriler yalnızca randevu yönetimi amacıyla kullanılır; pazarlama,
              profil oluşturma veya otomatik karar verme süreçlerinde kullanılmaz.
            </p>
          </Section>

          <div className="border-t border-slate-200 dark:border-slate-700/50" />

          <Section icon={Globe} title="Google Hizmetleri Entegrasyonu">
            <p>
              Onaylanan randevular <strong className="text-slate-800 dark:text-white">Google Calendar</strong>'a
              eklenir; bildirim e-postaları{' '}
              <strong className="text-slate-800 dark:text-white">Gmail OAuth2</strong> altyapısıyla gönderilir.
              Bu işlemler{' '}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 dark:text-brand-400 hover:underline"
              >
                Google Gizlilik Politikası
              </a>{' '}
              kapsamında yürütülür.
            </p>
            <p>
              Yapay zeka sınıflandırma servisi (Groq / LLM), yalnızca talep metnini
              analiz etmek için kullanılır; kişisel bilgiler (ad, e-posta) bu servise
              gönderilmez.
            </p>
          </Section>

          <div className="border-t border-slate-200 dark:border-slate-700/50" />

          <Section icon={Shield} title="Üçüncü Taraf Paylaşımı">
            <p>
              Kişisel verileriniz hiçbir koşulda üçüncü taraflarla{' '}
              <strong className="text-slate-800 dark:text-white">ticari amaçlı paylaşılmaz veya satılmaz</strong>.
            </p>
            <p>
              Veriler yalnızca randevu sürecinin teknik işleyişi için gerekli olan
              hizmet sağlayıcılarla (Google, MongoDB Atlas) paylaşılır.
              Bu paylaşımlar hizmet sözleşmeleriyle güvence altına alınmıştır.
            </p>
          </Section>

          <div className="border-t border-slate-200 dark:border-slate-700/50" />

          <Section icon={Trash2} title="Silme ve Erişim Talebi">
            <p>
              Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında verilerinize
              erişim, düzeltme veya silme talebinde bulunabilirsiniz.
            </p>
            <p>
              Talep için aşağıdaki adrese e-posta göndermeniz yeterlidir —
              en geç <strong className="text-slate-800 dark:text-white">30 gün</strong> içinde yanıt verilir.
            </p>
            <a
              href="mailto:reserveaiapp@gmail.com"
              className="inline-flex items-center gap-1.5 text-brand-600 dark:text-brand-400 hover:underline font-medium"
            >
              <Mail className="w-3.5 h-3.5" />
              reserveaiapp@gmail.com
            </a>
          </Section>

        </div>

        {/* Footer note */}
        <p className="mt-8 text-xs text-slate-400 dark:text-slate-500 text-center">
          Son güncelleme: Nisan 2026 · ReserveAI v1.0
        </p>
      </main>

      {/* ── Bottom nav ──────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 dark:border-slate-700/40 py-4 text-center">
        <a
          href="/"
          className="text-xs text-slate-400 hover:text-brand-500 dark:hover:text-brand-400 transition-colors"
        >
          ← Ana Sayfaya Dön
        </a>
      </footer>

    </div>
  );
}
