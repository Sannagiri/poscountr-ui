import type { InputHTMLAttributes } from 'react';
import { forwardRef } from 'react';

import { cn } from '@/utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  errorMessage?: string;
  hint?: string;
}

/**
 * Base text input, forwarding refs so it drops directly into React Hook Form
 * (`register('field')`) without a wrapper (docs/coding-standards.md §16).
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, errorMessage, hint, id, className, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  const hasError = Boolean(errorMessage);

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={inputId} className="text-xs font-semibold text-ink-soft">
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={inputId}
        className={cn(
          'h-10 rounded-control border bg-white px-3 text-sm text-ink transition-colors placeholder:text-ink-faint',
          'hover:border-border-strong',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
          hasError ? 'border-danger' : 'border-border',
          className,
        )}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        {...rest}
      />
      {hasError ? (
        <p id={`${inputId}-error`} className="text-xs text-danger">
          {errorMessage}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
