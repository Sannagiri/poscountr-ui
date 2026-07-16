import { cn } from '@/utils/cn';

export interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

const SIZE_PX: Record<NonNullable<LoaderProps['size']>, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-9 w-9 border-[3px]',
};

/**
 * Centralized loading indicator. Every async section (table, card, page)
 * renders this instead of a bespoke spinner (docs/coding-standards.md §17).
 */
export function Loader({ size = 'md', label, className }: LoaderProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 py-8', className)}>
      <span
        role="status"
        aria-label={label ?? 'Loading'}
        className={cn(
          'animate-spin rounded-full border-border-strong border-t-brand',
          SIZE_PX[size],
        )}
      />
      {label ? <p className="text-xs text-ink-faint">{label}</p> : null}
    </div>
  );
}
