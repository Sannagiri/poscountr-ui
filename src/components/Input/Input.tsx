import type { InputHTMLAttributes, WheelEvent } from 'react';
import { forwardRef, useRef } from 'react';
import { ChevronDown, ChevronUp, Hash } from 'lucide-react';

import { cn } from '@/utils/cn';
import { preventNumberInputScroll } from '@/utils/numberInputScroll';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  errorMessage?: string;
  hint?: string;
}

/** Nudges a number input via the native `stepUp`/`stepDown` (respects its own `min`/`max`/`step`), then fires a real `input` event — setting `.value` directly wouldn't reach React's `onChange` on a controlled field. */
function stepNumberInput(input: HTMLInputElement | null, direction: 1 | -1) {
  if (!input) return;
  if (direction === 1) input.stepUp();
  else input.stepDown();
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Base text input, forwarding refs so it drops directly into React Hook Form
 * (`register('field')`) without a wrapper (docs/coding-standards.md §16).
 *
 * Every digits-only field keeps the small "#" mark — same glyph this app
 * already uses for numeric identifiers (`Order #`, `Token #`) — as a cue
 * that letters won't be accepted here. `type="number"` additionally gets the
 * browser's own up/down spinner replaced outright — hidden via
 * `appearance-none` (its stock look reads as a dated OS control next to the
 * rest of this app's flat design) — with a borderless, barely-there chevron
 * pair sitting right next to the "#": transparent and muted at rest, only
 * picking up a rounded highlight on hover of each arrow individually, so the
 * control stays out of the way until it's actually needed instead of
 * sitting in a boxed toolbar the whole time. Wired to the input's real
 * `stepUp`/`stepDown` so `min`/`max`/`step` still apply exactly as they
 * would to the native spinner. A `type="text"` field paired with
 * `inputMode="numeric"`/`"decimal"` (the leading-zero-friendly pattern
 * `numberingStart`-style fields use) has no native spinner to replace, so it
 * shows just the "#" with no chevrons. `type="number"` additionally blurs on
 * mouse-wheel (`preventNumberInputScroll`): left alone, scrolling the page
 * while the cursor happens to be resting over a focused number field
 * silently increments/decrements it in every major browser, which reads as
 * the value "rolling" on its own.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, errorMessage, hint, id, className, onWheel, ...rest },
  forwardedRef,
) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  function setRefs(node: HTMLInputElement | null) {
    inputRef.current = node;
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef)
      (forwardedRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
  }

  const inputId = id ?? rest.name;
  const hasError = Boolean(errorMessage);
  const isNumberType = rest.type === 'number';
  const isNumeric = isNumberType || rest.inputMode === 'numeric' || rest.inputMode === 'decimal';

  function handleWheel(event: WheelEvent<HTMLInputElement>) {
    if (isNumberType) preventNumberInputScroll(event);
    onWheel?.(event);
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={inputId} className="text-xs font-semibold text-ink-soft">
          {label}
        </label>
      ) : null}
      <div className="relative">
        <input
          ref={setRefs}
          id={inputId}
          className={cn(
            'h-10 w-full rounded-control border bg-white px-3 text-sm text-ink transition-colors placeholder:text-ink-faint',
            'hover:border-border-strong',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
            hasError ? 'border-danger' : 'border-border',
            isNumberType ? 'pr-12' : isNumeric && 'pr-8',
            isNumberType &&
              '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
            className,
          )}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          onWheel={handleWheel}
          {...rest}
        />
        {isNumberType ? (
          <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-1.5">
            <Hash size={13} aria-hidden="true" className="text-ink-faint" />
            <div className="pointer-events-auto flex flex-col gap-[1px]">
              <button
                type="button"
                tabIndex={-1}
                aria-label="Increase"
                disabled={rest.disabled}
                onClick={() => stepNumberInput(inputRef.current, 1)}
                className="flex h-3.5 w-4 items-center justify-center rounded-sm text-ink-faint/70 transition-colors hover:bg-surface hover:text-brand disabled:pointer-events-none disabled:opacity-50"
              >
                <ChevronUp size={12} strokeWidth={2.5} />
              </button>
              <button
                type="button"
                tabIndex={-1}
                aria-label="Decrease"
                disabled={rest.disabled}
                onClick={() => stepNumberInput(inputRef.current, -1)}
                className="flex h-3.5 w-4 items-center justify-center rounded-sm text-ink-faint/70 transition-colors hover:bg-surface hover:text-brand disabled:pointer-events-none disabled:opacity-50"
              >
                <ChevronDown size={12} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        ) : isNumeric ? (
          <Hash
            size={14}
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint"
          />
        ) : null}
      </div>
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
