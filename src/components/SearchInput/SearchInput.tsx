import type { InputHTMLAttributes } from 'react';

import { cn } from '@/utils/cn';

export interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string;
}

/** Search box used above every filterable table (docs/coding-standards.md §6, §7). */
export function SearchInput({
  containerClassName,
  className,
  placeholder = 'Search…',
  ...rest
}: SearchInputProps) {
  return (
    <div
      className={cn(
        'flex h-10 flex-1 items-center gap-2 rounded-control border border-border bg-white px-3 transition-colors',
        'focus-within:border-brand/40 focus-within:ring-2 focus-within:ring-brand/20',
        'hover:border-border-strong',
        containerClassName,
      )}
    >
      <SearchIcon />
      <input
        type="search"
        placeholder={placeholder}
        className={cn(
          'w-full border-none bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none',
          className,
        )}
        {...rest}
      />
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="shrink-0 text-ink-faint"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
