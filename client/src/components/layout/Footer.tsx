import { useEffect, useState } from 'react';
import { X, Shield, FileText, Mail } from 'lucide-react';
import { Logo } from '../ui/Logo';
import { BTN_BASE, BTN_VARIANTS } from '../ui/Button';

// ── Modal content ─────────────────────────────────────────────────────────────

type FooterModal = 'privacy' | 'terms' | 'contact';

const MODALS: Record<FooterModal, { icon: React.ElementType; title: string; body: React.ReactNode }> = {
  privacy: {
    icon:  Shield,
    title: 'Gizlilik Politikası',
    body: (
      <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
        <p>
          <strong className="text-slate-800 dark:text-white">Veri Saklama:</strong>{' '}
          Randevu başvurunuzu aldığımızda ad-soyad, e-posta adresi, talep metni ve
          seçtiğiniz tarih-saat bilgileri MongoDB Atlas altyapısında güvenli biçimde
          saklanır. Veriler yalnızca randevu yönetimi amacıyla kullanılır.
        </p>
        <p>
          <strong className="text-slate-800 dark:text-white">Google Hizmetleri:</strong>{' '}
          Onaylanan randevular Google Calendar'a eklenir; bildirim e-postaları Gmail
          OAuth2 altyapısıyla gönderilir. Bu işlemler Google Gizlilik Politikası
          kapsamında yürütülür.
        </p>
        <p>
          <strong className="text-slate-800 dark:text-white">Üçüncü Taraf Paylaşımı:</strong>{' '}
          Kişisel verileriniz hiçbir koşulda üçüncü taraflarla ticari amaçlı
          paylaşılmaz veya satılmaz.
        </p>
        <p>
          <strong className="text-slate-800 dark:text-white">Silme Talebi:</strong>{' '}
          Verilerinizin silinmesini talep etmek için{' '}
          <a href="mailto:destek@reserveai.com" className="text-brand-600 dark:text-brand-400 hover:underline">
            destek@reserveai.com
          </a>{' '}
          adresine e-posta gönderebilirsiniz.
        </p>
        <p className="text-xs text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700">
          Son güncelleme: Nisan 2026
        </p>
      </div>
    ),
  },
  terms: {
    icon: FileText,
    title: 'Kullanım Şartları',
    body: (
      <div 
        className="space-y-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto"
        style={{ 
          scrollbarWidth: 'none',      /* Firefox için */
          msOverflowStyle: 'none',     /* IE ve Edge için */
          WebkitOverflowScrolling: 'touch' 
        }}
      >
        {/* Webkit (Chrome, Safari) için gizleme stili */}
        <style dangerouslySetInnerHTML={{__html: `
          div::-webkit-scrollbar { display: none; }
        `}} />

        <p>
          <strong className="text-slate-800 dark:text-white">Hizmet Kapsamı:</strong>{' '}
          ReserveAI, randevu talepleri için bir aracı platform sunar. Hizmet; yapay
          zeka destekli talep analizi, takvim entegrasyonu ve e-posta bildirimlerini kapsar.
        </p>
        <p>
          <strong className="text-slate-800 dark:text-white">Kullanıcı Sorumluluğu:</strong>{' '}
          Platforma girilen bilgilerin doğru ve güncel olması kullanıcının
          sorumluluğundadır. Yanıltıcı bilgi içeren başvurular reddedilebilir.
        </p>
        <p>
          <strong className="text-slate-800 dark:text-white">Randevu Onayı:</strong>{' '}
          Başvurunun sisteme alınması kesin randevu anlamına gelmez. Randevu,
          yönetici onayından sonra geçerli sayılır; onay durumu e-posta ile bildirilir.
        </p>
        <p>
          <strong className="text-slate-800 dark:text-white">İptal Politikası:</strong>{' '}
          Onaylanan randevuyu iptal etmek için onay e-postasındaki bağlantıyı
          kullanabilir ya da doğrudan iletişime geçebilirsiniz.
        </p>
        <p>
          <strong className="text-slate-800 dark:text-white">Hizmet Değişiklikleri:</strong>{' '}
          ReserveAI, önceden bildirmeksizin hizmet kapsamını değiştirme hakkını saklı tutar.
        </p>
        <p className="text-xs text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700">
          Son güncelleme: Nisan 2026
        </p>
      </div>
    ),
  },
  contact: {
    icon:  Mail,
    title: 'İletişim',
    body: (
      <div className="space-y-5 text-sm">
        {(
          [
            {
              label: 'Destek E-postası',
              value: 'destek@reserveai.com',
              href:  'mailto:destek@reserveai.com',
              sub:   'Sorularınız için bize yazın — 24 saat içinde yanıt veririz.',
            },
            {
              label: 'Genel Bilgi',
              value: 'info@reserveai.com',
              href:  'mailto:info@reserveai.com',
              sub:   'İş birliği ve entegrasyon talepleri.',
            },
          ] as const
        ).map(({ label, value, href, sub }) => (
          <div
            key={label}
            className="rounded-xl p-4 space-y-1"
            style={{ background: 'var(--inset-base)', border: '1px solid var(--inset-border)' }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {label}
            </p>
            <a href={href} className="font-semibold text-brand-600 dark:text-brand-400 hover:underline">
              {value}
            </a>
            <p className="text-xs text-slate-500 dark:text-slate-400">{sub}</p>
          </div>
        ))}
        <p className="text-xs text-slate-400 text-center pt-1">
          Çalışma saatlerimiz: Hafta içi 09:00 – 18:00 (Istanbul)
        </p>
      </div>
    ),
  },
};

// ── Modal panel ───────────────────────────────────────────────────────────────

function FooterModalPanel({ id, onClose }: { id: FooterModal; onClose: () => void }) {
  const { icon: Icon, title, body } = MODALS[id];

  // Body scroll kilidi — modal açıkken arka plan kaymasın
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // ESC ile kapat
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    // Flex wrapper — backdrop + centering tek div'de, translate yok
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm"
      onClick={onClose}
      aria-hidden="true"
    >
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-md max-h-[90vh] flex flex-col
                   rounded-2xl shadow-2xl overflow-hidden animate-slide-up"
        style={{ background: 'var(--modal-bg)', border: '1px solid var(--modal-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-4 border-b flex-shrink-0"
          style={{ background: 'var(--modal-hdr-bg)', borderColor: 'var(--modal-hdr-bdr)' }}
        >
          <span className="w-8 h-8 rounded-lg bg-brand-500/15 flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4 text-brand-600 dark:text-brand-400" />
          </span>
          <h2 className="font-bold text-slate-900 dark:text-white flex-1 text-base">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                       text-slate-400 hover:text-slate-700 dark:hover:text-slate-200
                       hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body — kaydırılabilir, max yükseklik sınırlı */}
        <div className="px-5 py-5 overflow-y-auto" style={{ maxHeight: 'min(60vh, 420px)' }}>
          {body}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-4 border-t flex justify-end"
          style={{ borderColor: 'var(--modal-hdr-bdr)' }}
        >
          <button
            onClick={onClose}
            className={`${BTN_BASE} ${BTN_VARIANTS.secondary} px-5 py-2 text-sm`}
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────

const FOOTER_LINKS: { label: string; id: FooterModal }[] = [
  { label: 'Gizlilik Politikası', id: 'privacy' },
  { label: 'Kullanım Şartları',   id: 'terms'   },
  { label: 'İletişim',            id: 'contact'  },
];

export function Footer() {
  const [active, setActive] = useState<FooterModal | null>(null);

  return (
    <>
      <footer className="relative z-10 py-7 px-6
                         border-t border-slate-200 dark:border-white/5
                         pb-28 sm:pb-7">
        {/*
          pb-28 (mobil): LandingPage'deki fixed 'Ana Sayfa' butonu footer linklerinin
          üstüne biniyor. Bu padding onların altında boşluk bırakır.
          sm:pb-7: geniş ekranda normal padding geri döner.
        */}
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">

          {/* Brand — Header/Navbar ile birebir aynı logo kullanımı */}
          <a href="/" className="flex items-center gap-2.5 select-none group">
            <Logo className="w-7 h-7 flex-shrink-0" />
            <span className="text-sm font-bold tracking-tight text-slate-700 dark:text-white/80
                             group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
              Reserve<span className="text-brand-600 dark:text-brand-400">AI</span>
            </span>
            <span className="text-xs ml-1 text-slate-400 dark:text-white/25">
              © {new Date().getFullYear()}
            </span>
          </a>

          {/* Links */}
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {FOOTER_LINKS.map(({ label, id }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActive(id)}
                className="text-xs transition-colors
                           text-slate-400 dark:text-white/35
                           hover:text-slate-700 dark:hover:text-white/70"
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </footer>

      {active && <FooterModalPanel id={active} onClose={() => setActive(null)} />}
    </>
  );
}
