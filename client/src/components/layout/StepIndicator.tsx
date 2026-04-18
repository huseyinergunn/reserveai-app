import clsx from 'clsx';
import type { FormStep } from '../../context/AppointmentContext';

const STEPS: { number: FormStep; label: string }[] = [
  { number: 1, label: 'Sorgunuz'     },
  { number: 2, label: 'Koşullar'     },
  { number: 3, label: 'Tarih & Saat' },
];

interface Props {
  currentStep: FormStep;
}

export function StepIndicator({ currentStep }: Props) {
  return (
    <div className="flex items-center justify-between mb-7">
      {STEPS.map((step, idx) => {
        const isDone   = currentStep > step.number;
        const isActive = currentStep === step.number;

        return (
          <div key={step.number} className="flex items-center gap-1.5 flex-1">
            {/* Circle + Label */}
            <div className="flex flex-col items-center gap-1">
              <div
                className={clsx(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300',
                  isDone   && 'bg-brand-600 text-white shadow-md shadow-brand-600/40',
                  isActive && 'bg-brand-600 text-white ring-4 ring-brand-500/25 dark:ring-brand-500/20 shadow-lg shadow-brand-600/40',
                  !isDone && !isActive && 'bg-slate-100 dark:bg-slate-700/80 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-600/50',
                )}
              >
                {isDone ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step.number
                )}
              </div>
              <span
                className={clsx(
                  'text-[11px] font-medium whitespace-nowrap transition-colors duration-200',
                  isActive  ? 'text-brand-600 dark:text-brand-400'  : '',
                  isDone    ? 'text-slate-400 dark:text-slate-500'   : '',
                  !isDone && !isActive ? 'text-slate-400 dark:text-slate-600' : '',
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connector */}
            {idx < STEPS.length - 1 && (
              <div
                className={clsx(
                  'flex-1 h-px mx-1 mb-5 rounded-full transition-all duration-500',
                  currentStep > step.number
                    ? 'bg-brand-500 dark:bg-brand-600'
                    : 'bg-slate-200 dark:bg-slate-700',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
