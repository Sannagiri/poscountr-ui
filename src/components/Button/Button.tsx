import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/utils/cn';

import { Tooltip } from '../Tooltip';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leadingIcon?: ReactNode;
  /**
   * Hover/focus text shown while `disabled` is true — for a button that's
   * present but blocked by something outside the form itself (a license
   * limit, a permission), where leaving the person no explanation is worse
   * than the disabled state alone. Native `disabled` buttons don't fire
   * mouse/focus events in any major browser (the HTML spec excludes
   * disabled form controls from the interaction event path), so setting
   * this wraps the button in a plain `span` and puts the `Tooltip` there
   * instead — without that wrapper, hovering a disabled button would
   * silently show nothing.
   */
  disabledReason?: string;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-brand text-white shadow-sm hover:bg-brand-dark active:bg-brand-dark disabled:bg-brand/50',
  secondary:
    'bg-white text-ink border border-border shadow-sm hover:bg-surface active:bg-surface disabled:opacity-50',
  // Brand-colored outline — a secondary action that still wants to read as
  // "on brand" (e.g. a template download next to a primary "Import"
  // button) without competing with the screen's actual primary action.
  outline:
    'bg-white text-brand border border-brand hover:bg-brand/5 active:bg-brand/10 disabled:opacity-50',
  ghost: 'bg-transparent text-ink hover:bg-surface active:bg-surface disabled:opacity-50',
  destructive:
    'bg-danger text-white shadow-sm hover:bg-danger/90 active:bg-danger/90 disabled:bg-danger/50',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
};

/**
 * Base button used everywhere in the app. Every screen must use this
 * component instead of a bare `<button>` so variants, sizing, and disabled/
 * loading behavior stay consistent (docs/coding-standards.md §13).
 */
export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leadingIcon,
  disabled,
  disabledReason,
  className,
  children,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || isLoading;

  const button = (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center rounded-control font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-1',
        'disabled:cursor-not-allowed disabled:shadow-none',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      disabled={isDisabled}
      aria-busy={isLoading}
      {...rest}
    >
      {isLoading ? (
        <span
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : (
        leadingIcon
      )}
      {children}
    </button>
  );

  if (isDisabled && disabledReason) {
    return (
      <Tooltip content={disabledReason}>
        {/* Not actually interactive — exists purely so the Tooltip has a
            hoverable/focusable target, since the disabled `<button>` it
            wraps can't fire either kind of event itself (see the
            `disabledReason` doc comment above). Block disable (not
            `-next-line`) since Prettier is free to re-wrap this tag's
            attributes onto their own lines, which would otherwise detach a
            `-next-line` comment from the `tabIndex` it's meant to cover. */}
        {/* eslint-disable jsx-a11y/no-noninteractive-tabindex */}
        <span
          tabIndex={0}
          className="inline-flex rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-1"
        >
          {button}
        </span>
        {/* eslint-enable jsx-a11y/no-noninteractive-tabindex */}
      </Tooltip>
    );
  }

  return button;
}
