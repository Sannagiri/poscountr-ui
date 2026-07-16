import type { ReactNode } from 'react';

import { SearchInput } from '@/components/SearchInput';
import { Select } from '@/components/Select';
import { cn } from '@/utils/cn';
import { ALL_FILTER_VALUE } from '@/utils/listFilter';

export interface ListToolbarFilter {
  key: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

export interface ListToolbarProps {
  /** Omit both `searchValue`/`onSearchChange` to leave the search box off entirely. */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ListToolbarFilter[];
  hasActiveFilters?: boolean;
  onClear?: () => void;
  /**
   * Extra filter controls rendered before the search box — for filters that
   * don't fit the simple `{ key, label, value, onChange, options }` shape
   * above (e.g. server-side filters that re-query on change and already own
   * their own "All ___" option, like `AuditLogPage`'s business/action
   * selects). Plain `ReactNode`, so the caller renders whatever it needs.
   */
  leading?: ReactNode;
  /** Extra controls at the end of the strip — e.g. a Table/Cards view toggle. */
  trailing?: ReactNode;
  className?: string;
}

/**
 * The search box + filter dropdowns every list screen shows above its data —
 * extracted out of `DataTable` so a screen that offers more than one
 * presentation of the same data (see `TenantsPage`'s Table/Cards toggle) can
 * lift search/filter state above both views and drive them from one toolbar,
 * instead of `DataTable` owning state a card grid has no way to reach.
 * `DataTable` itself still uses this internally for every other list page.
 */
export function ListToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search…',
  filters,
  hasActiveFilters = false,
  onClear,
  leading,
  trailing,
  className,
}: ListToolbarProps) {
  return (
    <div className={cn('mb-3.5 flex flex-wrap items-center gap-2.5', className)}>
      {leading}
      {onSearchChange ? (
        <SearchInput
          containerClassName="max-w-xs"
          placeholder={searchPlaceholder}
          value={searchValue ?? ''}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      ) : null}
      {(filters ?? []).map((filter) => (
        <Select
          key={filter.key}
          className="w-auto min-w-[9rem]"
          value={filter.value}
          onChange={filter.onChange}
          options={[
            { value: ALL_FILTER_VALUE, label: `All ${filter.label.toLowerCase()}` },
            ...filter.options,
          ]}
        />
      ))}
      {hasActiveFilters ? (
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-semibold text-accent hover:text-accent-dark"
        >
          Clear
        </button>
      ) : null}
      {trailing ? <div className="ml-auto flex items-center gap-2">{trailing}</div> : null}
    </div>
  );
}
