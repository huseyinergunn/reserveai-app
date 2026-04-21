import { useState } from 'react';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { NavModals, type ModalId } from './NavModals';
import { useTheme } from '../../hooks/useTheme';
import { Logo } from '../ui/Logo';

const NAV_ITEMS: { label: string; modal: ModalId }[] = [
  { label: 'Nasıl Çalışır?', modal: 'how'     },
  { label: 'Fiyatlandırma',  modal: 'pricing'  },
  { label: 'İletişim',       modal: 'contact'  },
];

function ThemeToggle({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isDark ? 'Açık temaya geç' : 'Koyu temaya geç'}
      title={isDark ? 'Açık temaya geç' : 'Koyu temaya geç'}
      className="relative w-9 h-9 rounded-lg flex items-center justify-center
                 transition-all duration-200
                 bg-slate-100 dark:bg-slate-700/60
                 border border-slate-200 dark:border-slate-600/50
                 text-slate-500 dark:text-slate-400
                 hover:bg-slate-200 dark:hover:bg-slate-600/60
                 hover:text-slate-700 dark:hover:text-slate-200
                 hover:scale-105 active:scale-95 focus:outline-none"
    >
      <Sun
        className="absolute w-4 h-4 text-amber-500"
        style={{
          opacity:    isDark ? 1 : 0,
          transform:  isDark ? 'rotate(0deg) scale(1)' : 'rotate(-120deg) scale(0.4)',
          transition: 'opacity 350ms cubic-bezier(0.4,0,0.2,1), transform 400ms cubic-bezier(0.34,1.56,0.64,1)',
        }}
      />
      <Moon
        className="absolute w-4 h-4 text-brand-600 dark:text-brand-400"
        style={{
          opacity:    isDark ? 0 : 1,
          transform:  isDark ? 'rotate(120deg) scale(0.4)' : 'rotate(0deg) scale(1)',
          transition: 'opacity 350ms cubic-bezier(0.4,0,0.2,1), transform 400ms cubic-bezier(0.34,1.56,0.64,1)',
        }}
      />
    </button>
  );
}

export function Navbar() {
  const [activeModal, setActiveModal] = useState<ModalId | null>(null);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const { isDark, toggle } = useTheme();

  const openModal  = (id: ModalId) => { setActiveModal(id); setMobileOpen(false); };
  const closeModal = ()             =>  setActiveModal(null);
  const closeMobile = ()            =>  setMobileOpen(false);

  return (
    <>
      {/* ── Overlay — menü açıkken arka planı karart ──────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[999] bg-black/40 backdrop-blur-sm md:hidden"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      <header className="navbar" style={{ position: 'sticky', top: 0, zIndex: 1000 }}>
        {/* ── Logo ──────────────────────────────────────────────────────── */}
        <a href="/" className="flex items-center gap-2.5 select-none">
          <Logo className="w-8 h-8 flex-shrink-0" />
          <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
            Reserve<span className="text-brand-600 dark:text-brand-400">AI</span>
          </span>
        </a>

        {/* ── Desktop nav ───────────────────────────────────────────────── */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map(({ label, modal }) => (
            <button
              key={label}
              type="button"
              onClick={() => openModal(modal)}
              className={`px-3.5 py-2 text-sm font-medium rounded-lg transition-colors
                ${activeModal === modal
                  ? 'text-slate-900 dark:text-white bg-slate-100 dark:bg-white/10'
                  : 'text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                }`}
            >
              {label}
            </button>
          ))}

          <div className="w-px h-5 bg-slate-200 dark:bg-white/10 mx-2" />
          <ThemeToggle isDark={isDark} onToggle={toggle} />
          <div className="w-px h-5 bg-slate-200 dark:bg-white/10 mx-2" />

          <button
            type="button"
            onClick={() => openModal('pricing')}
            className="px-4 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-lg transition-colors shadow-md shadow-brand-600/30"
          >
            Randevu Al
          </button>
        </nav>

        {/* ── Mobile: tema butonu + hamburger ───────────────────────────── */}
        <div className="md:hidden flex items-center gap-1.5">
          <ThemeToggle isDark={isDark} onToggle={toggle} />
          <button
            type="button"
            className="p-2 rounded-lg transition-colors
                       text-slate-600 dark:text-slate-400
                       hover:text-slate-900 dark:hover:text-white
                       hover:bg-slate-100 dark:hover:bg-white/10"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Menüyü kapat' : 'Menüyü aç'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* ── Mobile dropdown — header'ın içinde absolute ───────────────── */}
        {mobileOpen && (
          <div
            className="md:hidden absolute top-full left-0 right-0
                       px-4 py-3 space-y-1 border-b navbar-mobile-menu
                       animate-slide-up"
            style={{ zIndex: 1000 }}
          >
            {NAV_ITEMS.map(({ label, modal }) => (
              <button
                key={label}
                type="button"
                onClick={() => openModal(modal)}
                className="w-full text-left px-4 py-3 text-sm font-medium rounded-lg transition-colors
                           text-slate-700 dark:text-slate-300
                           hover:text-slate-900 dark:hover:text-white
                           hover:bg-slate-100 dark:hover:bg-white/5"
              >
                {label}
              </button>
            ))}
            <div className="pt-1 pb-0.5">
              <button
                type="button"
                onClick={() => openModal('pricing')}
                className="w-full px-4 py-3 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-lg transition-colors"
              >
                Randevu Al
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {activeModal && (
        <NavModals activeModal={activeModal} onClose={closeModal} />
      )}
    </>
  );
}
