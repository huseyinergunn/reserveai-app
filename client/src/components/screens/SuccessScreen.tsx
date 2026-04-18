import { useEffect, useMemo } from 'react';
import { formatDisplayDateTime } from '@shared/dateUtils';
import { TIMEZONE } from '@shared/constants';
import { useAppointmentForm } from '../../hooks/useAppointmentForm';
import { Button } from '../ui/Button';
import type { SuccessSummary } from '../../context/AppointmentContext';
import {
  CheckCircle2, Mail, Bell, CalendarCheck,
  User, Clock, FileText, ArrowRight,
} from 'lucide-react';

interface Props { summary: SuccessSummary; }

// ─────────────────────────────────────────────────────────────────────────────
// Neon konfeti (dark mode için canlı renkler)
// ─────────────────────────────────────────────────────────────────────────────

const NEON_COLORS = [
  '#00f5ff', // cyan
  '#bf00ff', // neon mor
  '#00ff88', // neon yeşil
  '#ffef00', // neon sarı
  '#ff4dff', // magenta
  '#ff6b35', // neon turuncu
  '#4dffff', // açık cyan
  '#7fff00', // chartreuse
];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 52 }, (_, i) => ({
        id:       i,
        left:     Math.random() * 100,
        delay:    Math.random() * 2.5,
        color:    NEON_COLORS[i % NEON_COLORS.length],
        width:    5 + Math.random() * 10,
        height:   4 + Math.random() * 7,
        rotation: Math.random() * 360,
      })),
    [],
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left:            `${p.left}%`,
            animationDelay:  `${p.delay}s`,
            backgroundColor: p.color,
            width:           `${p.width}px`,
            height:          `${p.height}px`,
            transform:       `rotate(${p.rotation}deg)`,
            boxShadow:       `0 0 6px ${p.color}80`,
          }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tracking steps
// ─────────────────────────────────────────────────────────────────────────────

const TRACKING_STEPS = [
  {
    icon:     CalendarCheck,
    title:    'Randevu İsteği Alındı',
    detail:   'Talebiniz sistemimize başarıyla iletildi.',
    iconBg:   'bg-emerald-500/20',
    iconText: 'text-emerald-700 dark:text-emerald-400',
  },
  {
    icon:     Mail,
    title:    'Onay E-postası Gönderildi',
    detail:   'Gelen kutunuzu kontrol edin.',
    iconBg:   'bg-blue-500/20',
    iconText: 'text-blue-700 dark:text-blue-400',
  },
  {
    icon:     Bell,
    title:    'Yönetici Bildirimi İletildi',
    detail:   'Onay süreci otomatik olarak başlatıldı.',
    iconBg:   'bg-violet-500/20',
    iconText: 'text-violet-700 dark:text-violet-400',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Ana bileşen
// ─────────────────────────────────────────────────────────────────────────────

export function SuccessScreen({ summary }: Props) {
  const { reset } = useAppointmentForm();
  const displayDateTime = formatDisplayDateTime(summary.dateTime, TIMEZONE);

  /* ── Tarayıcı Bildirimi ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!('Notification' in window)) return;
    const send = () => {
      try {
        new Notification('İsteğiniz Alındı! 🚀', {
          body: 'Randevu detaylarınız e-posta adresinize gönderildi.',
          icon: '/favicon.ico',
        });
      } catch { /* sessizce geç */ }
    };
    if (Notification.permission === 'granted') {
      send();
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((p) => { if (p === 'granted') send(); });
    }
  }, []);

  return (
    <div className="relative space-y-5 animate-fade-in overflow-hidden">
      <Confetti />

      {/* ── Başarı ikonu ──────────────────────────────────────────────────── */}
      <div className="text-center space-y-3 pb-1">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center animate-success-pop screen-icon-bg-emerald">
            <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Randevu İsteği Gönderildi!</h2>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            Talebiniz alınmıştır. Randevu bilgileriniz ve sonraki adımlar
            e-posta adresinize gönderildi — lütfen gelen kutunuzu kontrol edin.
          </p>
        </div>
      </div>

      {/* ── Tracking paneli ───────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700/50 overflow-hidden inset-deep">
        {/* Panel başlığı */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-700/40 flex items-center justify-between inset-header">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500">
              İşlem Takip Paneli
            </p>
            <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">{summary.bookingReference}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border
                           text-emerald-700 dark:text-emerald-400
                           border-emerald-300 dark:border-emerald-500/30
                           badge-active-emerald">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
            Aktif
          </span>
        </div>

        {/* Timeline adımları */}
        <div className="px-5 py-4 space-y-0">
          {TRACKING_STEPS.map((step, i) => (
            <div
              key={i}
              className="tracking-step pb-5 animate-slide-up"
              style={{ animationDelay: `${i * 160}ms` }}
            >
              <div className={`flex-shrink-0 w-8 h-8 rounded-full ${step.iconBg} flex items-center justify-center border border-white/5`}>
                <step.icon className={`w-4 h-4 ${step.iconText}`} strokeWidth={2} />
              </div>
              <div className="min-w-0 pt-0.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{step.title}</p>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Rezervasyon özeti ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden inset-surface">
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700/40 inset-deep">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            Rezervasyon Özeti
          </p>
        </div>
        <div className="px-5 py-4 space-y-3.5">
          {[
            { icon: User,        bg: 'bg-blue-500/15',   text: 'text-blue-600 dark:text-blue-400',   label: 'Ad Soyad',       value: summary.name          },
            { icon: Clock,       bg: 'bg-violet-500/15', text: 'text-violet-600 dark:text-violet-400', label: 'Tarih &amp; Saat', value: displayDateTime        },
          ].map(({ icon: Icon, bg, text, label, value }) => (
            <div key={label} className="flex items-start gap-3">
              <div className={`flex-shrink-0 w-7 h-7 rounded-lg ${bg} flex items-center justify-center mt-0.5`}>
                <Icon className={`w-3.5 h-3.5 ${text}`} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide"
                  dangerouslySetInnerHTML={{ __html: label }} />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-0.5">{value}</p>
              </div>
            </div>
          ))}

          {/* Talep — farklı layout */}
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center mt-0.5">
              <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Talep Özeti</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">{summary.enquiry}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Aksiyon */}
      <Button variant="secondary" onClick={reset} className="w-full group">
        Yeni Randevu Oluştur
        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
      </Button>
    </div>
  );
}
