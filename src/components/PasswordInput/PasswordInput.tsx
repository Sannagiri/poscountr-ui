import type { InputHTMLAttributes } from 'react';
import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { cn } from '@/utils/cn';

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  errorMessage?: string;
  hint?: string;
}

/**
 * Same look as `Input`, for a password field specifically — adds a
 * show/hide toggle (an eye icon at the field's right edge) so a person can
 * check what they actually typed before submitting, since a plain
 * `type="password"` field gives no other way to catch a typo before it
 * either rejects a login or (worse, on a change-password form) silently
 * sets a mistyped value as the new password.
 *
 * A dedicated component rather than a new prop on `Input` itself — `Input`
 * is the base for every text field in the app; this stays scoped to the
 * one field type that actually needs the toggle. Built the same way
 * `SearchInput` is: the bordered/focus-ring box is the outer `div`, the
 * `<input>` itself is borderless/transparent so the trailing icon button
 * can sit in the same flex row instead of needing to be absolutely
 * positioned over the text.
 *
 * Deliberately a real flex sibling, not our eye icon absolutely positioned
 * on top of the `<input>` — a password manager extension (1Password,
 * LastPass, Bitwarden, …) that injects its own icon anchors it to the
 * `<input>` element's own bounding box, which in this layout ends *before*
 * our button starts; stacking our icon over the input the more common way
 * is what actually causes the two to land on the same pixels. This can't be
 * guaranteed for every extension's own positioning logic (that's each
 * extension's code, not ours to control), but it avoids the collision for
 * the common case. Edge's *built-in* reveal/clear icons are a separate,
 * fully deterministic case — those are suppressed outright in
 * `styles/global.css` (`::-ms-reveal`/`::-ms-clear`), since otherwise
 * they'd render inside the input and directly overlap this button.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ label, errorMessage, hint, id, className, ...rest }, ref) {
    const [visible, setVisible] = useState(false);
    const inputId = id ?? rest.name;
    const hasError = Boolean(errorMessage);

    return (
      <div className="flex flex-col gap-1.5">
        {label ? (
          <label htmlFor={inputId} className="text-xs font-semibold text-ink-soft">
            {label}
          </label>
        ) : null}
        <div
          className={cn(
            'flex h-10 items-center gap-1 rounded-control border bg-white pl-3 pr-1.5 transition-colors',
            'focus-within:ring-2 focus-within:ring-brand/40',
            'hover:border-border-strong',
            hasError ? 'border-danger' : 'border-border',
          )}
        >
          <input
            ref={ref}
            id={inputId}
            type={visible ? 'text' : 'password'}
            className={cn(
              'w-full border-none bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-0',
              className,
            )}
            aria-invalid={hasError}
            aria-describedby={hasError ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            {...rest}
          />
          <button
            type="button"
            onClick={() => setVisible((prev) => !prev)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-ink-faint transition-colors hover:text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
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
  },
);
