import clsx from 'clsx';
import { AlertCircle } from 'lucide-react';
import { forwardRef } from 'react';
import type { SelectHTMLAttributes } from 'react';

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  options: readonly string[];
  placeholder?: string;
}

export const SelectField = forwardRef<HTMLSelectElement, Props>(
  function SelectField({ label, error, options, placeholder, className, ...rest }, ref) {
    const id = rest.id ?? label.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="space-y-1">
        <label htmlFor={id} className="form-label">
          {label}
          {rest.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <select
          id={id}
          ref={ref}
          className={clsx('form-input', error && 'form-input-error', className)}
          {...rest}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        {error && (
          <p className="form-error">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />{error}
          </p>
        )}
      </div>
    );
  },
);
