import clsx from 'clsx';
import { AlertCircle } from 'lucide-react';
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { forwardRef } from 'react';

interface Base { label: string; error?: string; hint?: string; }
interface InputProps extends Base, InputHTMLAttributes<HTMLInputElement> { as?: 'input'; }
interface TextareaProps extends Base, TextareaHTMLAttributes<HTMLTextAreaElement> { as: 'textarea'; }
type Props = InputProps | TextareaProps;

export const FormField = forwardRef<
  HTMLInputElement | HTMLTextAreaElement,
  Props
>(function FormField({ label, error, hint, as = 'input', ...rest }, ref) {
  const id = (rest as InputProps).id ?? label.toLowerCase().replace(/\s+/g, '-');
  const cls = clsx('form-input', error && 'form-input-error');

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="form-label">
        {label}
        {rest.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      {as === 'textarea'
        ? <textarea id={id} ref={ref as React.Ref<HTMLTextAreaElement>}
            className={clsx(cls, 'resize-none min-h-[100px]')}
            {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)} />
        : <input id={id} ref={ref as React.Ref<HTMLInputElement>}
            className={cls}
            {...(rest as InputHTMLAttributes<HTMLInputElement>)} />
      }

      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && (
        <p className="form-error">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />{error}
        </p>
      )}
    </div>
  );
});
