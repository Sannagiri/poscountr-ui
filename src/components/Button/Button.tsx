import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/utils/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leadingIcon?: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-brand text-white shadow-sm hover:bg-brand-dark active:bg-brand-dark disabled:bg-brand/50',
  secondary:
    'bg-white text-ink border border-border shadow-sm hover:bg-surface active:bg-surface disabled:opacity-50',
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
  className,
  children,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
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
}
