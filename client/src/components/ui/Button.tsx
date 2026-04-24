import clsx from 'clsx';
import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';

// ── Tasarım token'ları — saf Tailwind string, CSS layer yok ────────────────
export const BTN_BASE =
  'inline-flex items-center justify-center gap-2 ' +
  'rounded-full font-semibold shadow-md ' +
  'transition-all duration-200 ' +
  'focus:outline-none focus:ring-2 focus:ring-offset-2 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed ' +
  'hover:scale-105 active:scale-95';

export const BTN_VARIANTS = {
  primary:
    'bg-brand-600 hover:bg-brand-500 text-white ' +
    'focus:ring-brand-500 focus:ring-offset-white dark:focus:ring-offset-slate-900',
  emerald:
    'bg-emerald-500 hover:bg-emerald-600 text-white ' +
    'focus:ring-emerald-500 focus:ring-offset-white dark:focus:ring-offset-slate-900',
  sky:
    'bg-sky-500 hover:bg-sky-600 text-white ' +
    'focus:ring-sky-500 focus:ring-offset-white dark:focus:ring-offset-slate-900',
  danger:
    'bg-red-500 hover:bg-red-600 text-white ' +
    'focus:ring-red-500 focus:ring-offset-white dark:focus:ring-offset-slate-900',
  secondary:
    'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 ' +
    'text-slate-700 dark:text-slate-200 ' +
    'hover:bg-slate-50 dark:hover:bg-slate-700 ' +
    'focus:ring-slate-400 focus:ring-offset-white dark:focus:ring-offset-slate-900',
} as const;

export const BTN_SIZES = {
  sm: 'px-3.5 py-1.5 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-7 py-3 text-base',
} as const;

type Variant = keyof typeof BTN_VARIANTS;
type Size    = keyof typeof BTN_SIZES;

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?:    Size;
  loading?: boolean;
}

export function Button({
  variant  = 'primary',
  size     = 'md',
  loading,
  disabled,
  children,
  className,
  ...rest
}: Props) {
  return (
    <button
      className={clsx(BTN_BASE, BTN_VARIANTS[variant], BTN_SIZES[size], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
