import { CalendarCheck } from 'lucide-react';

const FOOTER_LINKS = [
  { label: 'Gizlilik Politikası', href: '#' },
  { label: 'Kullanım Şartları',   href: '#' },
  { label: 'İletişim',            href: '#' },
];

export function Footer() {
  return (
    <footer className="relative z-10 py-7 px-6
                       border-t border-slate-200 dark:border-white/5">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2 select-none">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-brand-600 text-white">
            <CalendarCheck className="w-3.5 h-3.5" strokeWidth={2.5} />
          </span>
          <span className="text-sm font-bold text-slate-600 dark:text-white/70">
            Reserve<span className="text-brand-600 dark:text-brand-400">AI</span>
          </span>
          <span className="text-xs ml-2 text-slate-400 dark:text-white/25">
            © {new Date().getFullYear()} · Tüm hakları saklıdır.
          </span>
        </div>

        {/* Links */}
        <nav className="flex items-center gap-5">
          {FOOTER_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-xs transition-colors
                         text-slate-400 dark:text-white/35
                         hover:text-slate-700 dark:hover:text-white/70"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
