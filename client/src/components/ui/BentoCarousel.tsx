import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, Zap, CalendarCheck, Clock,
  SmilePlus, TrendingUp,
} from 'lucide-react';

const SLIDE_DURATION = 4000;

// ---------------------------------------------------------------------------
// Shared animated card shell
// ---------------------------------------------------------------------------

interface CardProps {
  className?: string;
  delay?: number;
  children: React.ReactNode;
}

function Card({ className = '', delay = 0, children }: CardProps) {
  return (
    <motion.div
      className={`rounded-3xl border border-slate-200/70 dark:border-slate-700/40
                  bg-white dark:bg-slate-800/50
                  shadow-[inset_0_1px_0_#fff] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${className}`}
      initial={{ opacity: 0, y: 16, filter: 'blur(10px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: false, amount: 0.15 }}
      transition={{
        y:       { type: 'spring', stiffness: 380, damping: 28, delay },
        opacity: { duration: 0.3, ease: 'easeOut', delay },
        filter:  { duration: 0.45, ease: 'easeOut', delay },
      }}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Slide 1 — AI Triage
// ---------------------------------------------------------------------------

function SlideTriager() {
  return (
    <div className="grid grid-cols-[1fr_110px] grid-rows-2 gap-2 h-[172px]">
      <Card delay={0} className="row-span-2 p-4 flex flex-col justify-between">
        <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-200 dark:border-red-500/25
                        flex items-center justify-center">
          <Activity className="w-4 h-4 text-red-500 animate-pulse" />
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-red-500 mb-1">
            AI Triage
          </p>
          <h3 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
            Talepleri saniyeler içinde önceliklendirir.
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">
            Her talebe otomatik öncelik skoru atanır.
          </p>
        </div>
      </Card>

      <Card delay={0.12} className="p-2.5 flex flex-col items-center justify-center gap-0.5 text-center">
        <Zap className="w-3.5 h-3.5 text-amber-400 mb-0.5" />
        <p className="text-lg font-black text-slate-900 dark:text-white leading-none">~800ms</p>
        <p className="text-[11px] text-slate-400">AI yanıt süresi</p>
      </Card>

      <Card delay={0.22} className="p-2.5 flex flex-col justify-center gap-1.5">
        {[
          { label: 'Kritik', cls: 'bg-red-500/10 text-red-600 dark:text-red-400' },
          { label: 'Yüksek', cls: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
          { label: 'Normal',  cls: 'bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400' },
        ].map(({ label, cls }) => (
          <span key={label} className={`text-[11px] font-bold px-2 py-0.5 rounded-full text-center ${cls}`}>
            {label}
          </span>
        ))}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slide 2 — Smart Calendar
// ---------------------------------------------------------------------------

function SlideCalendar() {
  return (
    <div className="grid grid-cols-[1fr_110px] grid-rows-2 gap-2 h-[172px]">
      <Card delay={0} className="row-span-2 p-4 flex flex-col justify-between">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25
                        flex items-center justify-center">
          <CalendarCheck className="w-4 h-4 text-emerald-500 animate-float" />
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-500 mb-1">
            Smart Calendar
          </p>
          <h3 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
            Çakışmaları otomatik önler.
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">
            Google Calendar ile gerçek zamanlı senkronizasyon.
          </p>
        </div>
      </Card>

      <Card delay={0.12} className="p-2.5 flex flex-col items-center justify-center gap-0.5 text-center">
        <Clock className="w-3.5 h-3.5 text-emerald-400 mb-0.5" />
        <p className="text-lg font-black text-slate-900 dark:text-white leading-none">5 Gün</p>
        <p className="text-[11px] text-slate-400">ön rezervasyon</p>
      </Card>

      <Card delay={0.22} className="p-2.5 flex flex-col justify-center gap-1.5">
        {['09:00', '11:30', '14:00'].map((t, i) => (
          <div key={t} className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              i === 0 ? 'bg-emerald-400' : 'bg-slate-300 dark:bg-slate-600'
            }`} />
            <span className="text-xs font-mono text-slate-600 dark:text-slate-300">{t}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slide 3 — Sentiment Analysis
// ---------------------------------------------------------------------------

function SlideSentiment() {
  return (
    <div className="grid grid-cols-[1fr_110px] grid-rows-2 gap-2 h-[172px]">
      <Card delay={0} className="row-span-2 p-4 flex flex-col justify-between">
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-200 dark:border-violet-500/25
                        flex items-center justify-center">
          <SmilePlus className="w-4 h-4 text-violet-500 animate-float-slow" />
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-violet-500 mb-1">
            Duygu Analizi
          </p>
          <h3 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
            Müşteri duygu durumunu ölçer.
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">
            Endişeli · Nötr · Pozitif
          </p>
        </div>
      </Card>

      <Card delay={0.12} className="p-2.5 flex flex-col justify-center gap-1.5">
        {[
          { label: 'pozitif',  pct: 65, color: 'bg-violet-400' },
          { label: 'nötr',     pct: 25, color: 'bg-slate-300 dark:bg-slate-500' },
          { label: 'endişeli', pct: 10, color: 'bg-amber-400' },
        ].map(({ label, pct, color }) => (
          <div key={label}>
            <div className="flex justify-between mb-0.5">
              <span className="text-[10px] text-slate-400 capitalize">{label}</span>
              <span className="text-[10px] text-slate-400">{pct}%</span>
            </div>
            <div className="h-1 rounded-full bg-slate-100 dark:bg-slate-700/60">
              <div className={`h-1 rounded-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        ))}
      </Card>

      <Card delay={0.22} className="p-2.5 flex flex-col items-center justify-center gap-0.5 text-center">
        <TrendingUp className="w-3.5 h-3.5 text-violet-400 mb-0.5" />
        <p className="text-lg font-black text-slate-900 dark:text-white leading-none">92%</p>
        <p className="text-[11px] text-slate-400">doğruluk</p>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Carousel shell
// ---------------------------------------------------------------------------

const SLIDES = [SlideTriager, SlideCalendar, SlideSentiment];
const LABELS = ['AI Triage', 'Smart Calendar', 'Duygu Analizi'];

export function BentoCarousel() {
  const [active, setActive]   = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setInterval(() => advance((active + 1) % SLIDES.length), SLIDE_DURATION);
    return () => clearInterval(t);
  }, [active]);

  function advance(idx: number) {
    if (idx === active) return;
    setVisible(false);
    setTimeout(() => {
      setActive(idx);
      setVisible(true);
    }, 280);
  }

  const SlideComponent = SLIDES[active];

  return (
    <div className="hidden lg:flex flex-col gap-2 w-full">
      {/*
        key={active} forces React to unmount + remount the slide,
        which re-triggers whileInView on each card.
        CSS opacity/transform provides the smooth cross-fade.
      */}
      <div
        key={active}
        style={{
          opacity:    visible ? 1 : 0,
          transform:  visible ? 'translateY(0)' : 'translateY(6px)',
          transition: 'opacity 0.28s ease, transform 0.28s ease',
        }}
      >
        <SlideComponent />
      </div>

      {/* Dot + label navigation */}
      <div className="flex items-center gap-3">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => advance(i)}
            className="flex items-center gap-2 group"
            aria-label={LABELS[i]}
          >
            <span
              className={`block h-1.5 rounded-full transition-all duration-300 ${
                i === active
                  ? 'w-6 bg-brand-500'
                  : 'w-1.5 bg-slate-300 dark:bg-slate-600 group-hover:bg-slate-400 dark:group-hover:bg-slate-500'
              }`}
            />
            {i === active && (
              <span className="text-xs font-semibold text-brand-500 dark:text-brand-400 select-none">
                {LABELS[i]}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
