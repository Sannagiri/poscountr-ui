import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MoreVertical } from 'lucide-react';

import { Button } from '@/components/Button';
import { Checkbox } from '@/components/Checkbox';
import type { DropdownMenuEntry } from '@/components/DropdownMenu';
import { DropdownMenu } from '@/components/DropdownMenu';
import { EmptyState } from '@/components/EmptyState';
import { ErrorMessage } from '@/components/ErrorMessage';
import { ListToolbar } from '@/components/ListToolbar';
import { Loader } from '@/components/Loader';
import { useFillRemainingHeight } from '@/hooks/useFillRemainingHeight';
import { useInfiniteReveal } from '@/hooks/useInfiniteReveal';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/utils/cn';
import { applyFilterValues, filterBySearch, hasActiveListFilters } from '@/utils/listFilter';
import { getSessionMemory, setSessionMemory } from '@/utils/sessionMemory';
import { breakpoints } from '@/styles/breakpoints';

import type {
  DataTableColumn,
  DataTableFilter,
  DataTableRowAction,
  DataTableSort,
  SortDirection,
} from './DataTable.types';

export interface DataTableProps<TRow> {
  columns: DataTableColumn<TRow>[];
  data: TRow[];
  getRowKey: (row: TRow) => string;
  isLoading?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  sort?: DataTableSort;
  onSortChange?: (sort: DataTableSort) => void;
  onRowClick?: (row: TRow) => void;
  /**
   * Enables the built-in search box, filtering `data` client-side against
   * this row→string extractor. Omit to leave search off (e.g. a
   * server-paginated table where search has to be a server round-trip).
   */
  getSearchValue?: (row: TRow) => string;
  searchPlaceholder?: string;
  /**
   * Disambiguates persisted search/filter state (see below) when a single
   * route renders more than one `DataTable` — otherwise unnecessary, since
   * the default key (the current pathname) already scopes state correctly
   * for the common one-table-per-page case.
   */
  persistKey?: string;
  /** Column filter dropdowns, rendered next to the search box. Client-side, same caveat as search. */
  filters?: DataTableFilter<TRow>[];
  /**
   * Extra filter controls rendered in the same toolbar strip as the search
   * box, before it — for filters that are server-side (re-query on change)
   * rather than a post-fetch client-side narrowing of `data`, so they can't
   * be expressed as a `DataTableFilter`. `AuditLogPage`'s business/action
   * selects are the motivating case: they used to sit in their own row above
   * the table entirely, which read as disconnected from the table they
   * actually filter.
   */
  filtersSlot?: ReactNode;
  /**
   * Extra controls rendered at the right end of the toolbar strip — e.g. an
   * "Add ___" primary action, so it sits in the same row as search/filters
   * instead of a separate row above the table (`AdminsPanel`/`StaffPanel`'s
   * motivating case).
   */
  toolbarTrailing?: ReactNode;
  /** Adds a checkbox column for bulk selection. Selection is scoped to whatever's currently rendered (post search/filter). */
  selectable?: boolean;
  /**
   * Rendered in a toolbar strip above the table whenever at least one row is
   * selected — receives the selected rows and a callback to clear selection
   * (e.g. after a bulk action completes). Only meaningful with `selectable`.
   */
  bulkActions?: (selectedRows: TRow[], clearSelection: () => void) => ReactNode;
  /** Adds a "⋮" action-menu column, rendered last, built from this row's actions. */
  rowActions?: (row: TRow) => DataTableRowAction<TRow>[];
  /** How many rows to render initially and per additional batch while scrolling. Default 25. */
  batchSize?: number;
  /** Never shrinks the row area below this many pixels, even on a very short viewport. Default 240. Ignored when `maxBodyHeight` is set. */
  minBodyHeight?: number;
  /**
   * Caps the row area's height instead of filling to the viewport bottom —
   * the box then sizes to its actual content (however many rows that is)
   * and only scrolls once content exceeds this cap. Use this for a table
   * embedded among other cards on a detail page (e.g. `OrderDetailPage`'s
   * item list), where the default fill-to-viewport-bottom behavior leaves a
   * wall of empty space under a short list. Omit to keep the default —
   * every existing caller's current behavior — unchanged.
   */
  maxBodyHeight?: number;
  /**
   * Opt-in mobile layout: below `md`, renders one of these per row (in a
   * plain page-scrolling list, not the fixed-height grid table) instead of
   * the multi-column table — a table with more than 3-4 columns reads as
   * cramped and forces horizontal scrolling on a phone. Omit to keep the
   * table on every screen size (this is the default and every existing
   * caller's current behavior — passing this prop is the only thing that
   * changes it, so it's zero-risk to every other `DataTable` on the page).
   */
  mobileCard?: (row: TRow) => ReactNode;
}

const DEFAULT_BATCH_SIZE = 25;

/**
 * The one table every list screen in the app uses instead of hand-rolling a
 * `<table>` (docs/coding-standards.md §7) — orders, tenants, staff, products,
 * all of it.
 *
 * Built as CSS Grid rows, not a native `<table>`. The header row and every
 * body row are each their own grid container using the *exact same*
 * `gridTemplateColumns` string (built once, from `columns` plus the optional
 * checkbox/action tracks) — that is what guarantees the columns line up
 * pixel-for-pixel no matter what a row's content looks like. ARIA
 * `table`/`row`/`columnheader`/`cell` roles keep it announced as a table to
 * assistive tech.
 *
 * The row area is a fixed-height scroll box — only the table's own content
 * scrolls (infinite scroll via `useInfiniteReveal`), not the whole page —
 * but that height is *computed*, not a static guess: `useFillRemainingHeight`
 * measures how much vertical space is actually left below the table on
 * *this* screen and fills exactly down to the bottom of the viewport, so
 * the box ends up taller on a 27" monitor than on a laptop instead of using
 * the same fixed number everywhere (too short on a big screen, too tall —
 * or scrolling the whole page — on a small one). The header stays visible
 * (`sticky`) within that same box.
 */
export function DataTable<TRow>({
  columns,
  data,
  getRowKey,
  isLoading = false,
  errorMessage = null,
  onRetry,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  sort,
  onSortChange,
  onRowClick,
  getSearchValue,
  searchPlaceholder = 'Search…',
  filters,
  filtersSlot,
  toolbarTrailing,
  selectable = false,
  bulkActions,
  rowActions,
  batchSize = DEFAULT_BATCH_SIZE,
  minBodyHeight = 240,
  maxBodyHeight,
  mobileCard,
  persistKey,
}: DataTableProps<TRow>) {
  // `lg`, not `md` — a tablet-width screen (e.g. iPad portrait, ~768–1024px)
  // has just as little room for a wide multi-column grid as a phone does, so
  // it gets the same card layout rather than a cramped/overflowing table.
  const isNarrowViewport = useMediaQuery(`(max-width: ${breakpoints.lg - 1}px)`);
  const showMobileCards = Boolean(mobileCard) && isNarrowViewport;

  // Search/filter state survives navigating away and back (e.g. Orders →
  // an order's detail page → back to Orders) via `sessionMemory` — an
  // in-memory store keyed by route, not `localStorage`, so it resets on an
  // actual browser reload rather than sticking around forever. Keyed off
  // the pathname by default so every page gets this for free; `persistKey`
  // only needed when one route renders more than one `DataTable`.
  const location = useLocation();
  const storageKey = `datatable:${persistKey ?? location.pathname}`;

  const [searchTerm, setSearchTerm] = useState(
    () => getSessionMemory<string>(`${storageKey}:search`) ?? '',
  );
  // A filter with its own `defaultValue` (e.g. Status → "Active") starts
  // there instead of "All ___" — see `DataTableFilter.defaultValue`'s doc
  // comment. Recomputed from `filters` rather than frozen at mount so a
  // page that builds its `filters` array conditionally still gets the
  // right starting point whenever that array's shape changes.
  const defaultFilterValues = useMemo(
    () =>
      Object.fromEntries(
        (filters ?? [])
          .filter((filter) => filter.defaultValue)
          .map((filter) => [filter.key, filter.defaultValue as string]),
      ),
    [filters],
  );
  const [filterValues, setFilterValues] = useState<Record<string, string>>(
    () => getSessionMemory<Record<string, string>>(`${storageKey}:filters`) ?? defaultFilterValues,
  );

  useEffect(() => {
    setSessionMemory(`${storageKey}:search`, searchTerm);
  }, [storageKey, searchTerm]);

  useEffect(() => {
    setSessionMemory(`${storageKey}:filters`, filterValues);
  }, [storageKey, filterValues]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  // Always called (Rules of Hooks) even in `maxBodyHeight` mode, where its
  // result goes unused — the alternative (a fixed height) is exactly what
  // `maxBodyHeight` mode replaces with content-driven `max-height` instead.
  const fillHeight = useFillRemainingHeight(scrollContainerRef, { minHeight: minBodyHeight });

  const leadingTrackWidth = selectable ? '40px' : null;
  const trailingTrackWidth = rowActions ? '48px' : null;
  const gridTemplateColumns = useMemo(
    () =>
      [leadingTrackWidth, ...columns.map((column) => column.width ?? '1fr'), trailingTrackWidth]
        .filter(Boolean)
        .join(' '),
    [columns, leadingTrackWidth, trailingTrackWidth],
  );

  const hasToolbar =
    Boolean(getSearchValue) ||
    Boolean(filters?.length) ||
    Boolean(filtersSlot) ||
    Boolean(toolbarTrailing);
  const hasActiveFilters = hasActiveListFilters(searchTerm, filterValues, defaultFilterValues);

  const visibleRows = useMemo(() => {
    const searched = filterBySearch(data, searchTerm, getSearchValue);
    return applyFilterValues(searched, filters ?? [], filterValues);
  }, [data, filters, filterValues, getSearchValue, searchTerm]);

  const { visibleCount, sentinelRef, hasMore } = useInfiniteReveal({
    totalCount: visibleRows.length,
    batchSize,
    resetKey: `${searchTerm}|${JSON.stringify(filterValues)}`,
    rootRef: scrollContainerRef,
  });
  const renderedRows = useMemo(
    () => visibleRows.slice(0, visibleCount),
    [visibleRows, visibleCount],
  );

  const selectedRows = useMemo(
    () => data.filter((row) => selectedKeys.has(getRowKey(row))),
    [data, getRowKey, selectedKeys],
  );

  function clearSelection() {
    setSelectedKeys(new Set());
  }

  function toggleRow(row: TRow) {
    const key = getRowKey(row);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const renderedKeys = renderedRows.map((row) => getRowKey(row));
  const allRenderedSelected =
    renderedKeys.length > 0 && renderedKeys.every((key) => selectedKeys.has(key));
  const someRenderedSelected = renderedKeys.some((key) => selectedKeys.has(key));
  const headerCheckedState: boolean | 'indeterminate' = allRenderedSelected
    ? true
    : someRenderedSelected
      ? 'indeterminate'
      : false;

  function toggleSelectAllRendered() {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (allRenderedSelected) {
        renderedKeys.forEach((key) => next.delete(key));
      } else {
        renderedKeys.forEach((key) => next.add(key));
      }
      return next;
    });
  }

  function clearAllFilters() {
    setSearchTerm('');
    setFilterValues(defaultFilterValues);
  }

  function handleSortClick(column: DataTableColumn<TRow>) {
    if (!column.sortable || !onSortChange) return;
    const nextDirection: SortDirection =
      sort?.key === column.key && sort.direction === 'asc' ? 'desc' : 'asc';
    onSortChange({ key: column.key, direction: nextDirection });
  }

  const toolbar = hasToolbar ? (
    <ListToolbar
      searchValue={getSearchValue ? searchTerm : undefined}
      onSearchChange={getSearchValue ? setSearchTerm : undefined}
      searchPlaceholder={searchPlaceholder}
      leading={filtersSlot}
      filters={(filters ?? []).map((filter) => ({
        key: filter.key,
        label: filter.label,
        value: filterValues[filter.key] ?? 'all',
        onChange: (value) => setFilterValues((prev) => ({ ...prev, [filter.key]: value })),
        options: filter.options,
      }))}
      hasActiveFilters={hasActiveFilters}
      onClear={clearAllFilters}
      trailing={toolbarTrailing}
    />
  ) : null;

  if (isLoading) {
    return (
      <div>
        {toolbar}
        <Loader label="Loading…" />
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div>
        {toolbar}
        <ErrorMessage message={errorMessage} onRetry={onRetry} />
      </div>
    );
  }

  if (visibleRows.length === 0) {
    const isFilteredEmpty = data.length > 0 && hasActiveFilters;
    return (
      <div>
        {toolbar}
        <EmptyState
          title={isFilteredEmpty ? 'No matches' : emptyTitle}
          description={
            isFilteredEmpty ? 'Try a different search term or clear the filters.' : emptyDescription
          }
          action={
            isFilteredEmpty ? (
              <Button variant="secondary" size="sm" onClick={clearAllFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div>
      {toolbar}
      {selectable && selectedRows.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-control bg-brand/5 px-3.5 py-2.5">
          <span className="text-xs font-semibold text-ink">{selectedRows.length} selected</span>
          <div className="flex flex-wrap items-center gap-2">
            {bulkActions?.(selectedRows, clearSelection)}
          </div>
          <button
            type="button"
            onClick={clearSelection}
            className="ml-auto text-xs font-semibold text-accent hover:text-accent-dark"
          >
            Clear selection
          </button>
        </div>
      ) : null}
      {showMobileCards ? (
        <div role="list" className="flex flex-col gap-2">
          {renderedRows.map((row) => {
            const key = getRowKey(row);
            return (
              <div
                key={key}
                role={onRowClick ? 'button' : 'listitem'}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
                className={cn(
                  'flex items-start justify-between gap-3 rounded-control border border-border p-3',
                  onRowClick &&
                    'cursor-pointer hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
                )}
              >
                <div className="min-w-0 flex-1">{mobileCard?.(row)}</div>
                {rowActions ? (
                  // Only blocks bubbling into the card's own onClick — the
                  // kebab button/menu inside is the real interactive element.
                  // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                  <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
                    <RowActionsMenu row={row} actions={rowActions(row)} />
                  </div>
                ) : null}
              </div>
            );
          })}
          {hasMore ? (
            <div ref={sentinelRef} className="flex justify-center py-3">
              <Loader size="sm" />
            </div>
          ) : null}
        </div>
      ) : (
        <div
          ref={scrollContainerRef}
          className="scrollbar-thin overflow-auto rounded-control border border-border"
          style={maxBodyHeight != null ? { maxHeight: maxBodyHeight } : { height: fillHeight }}
        >
        <div role="table" className="w-full text-sm">
          <div role="rowgroup" className="sticky top-0 z-10 rounded-t-control bg-surface">
            <div
              role="row"
              style={{ gridTemplateColumns }}
              className="grid items-center border-b border-border"
            >
              {selectable ? (
                <div role="columnheader" className="flex items-center px-3 py-2.5">
                  <Checkbox
                    checked={headerCheckedState}
                    onCheckedChange={toggleSelectAllRendered}
                    label="Select all rows"
                  />
                </div>
              ) : null}
              {columns.map((column) => {
                const headerContent = (
                  <>
                    {column.header}
                    {column.sortable && sort?.key === column.key
                      ? sort.direction === 'asc'
                        ? ' ↑'
                        : ' ↓'
                      : null}
                  </>
                );
                return (
                  <div
                    key={column.key}
                    role="columnheader"
                    aria-sort={
                      sort?.key === column.key
                        ? sort.direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : undefined
                    }
                    className={cn(
                      'min-w-0 px-3 py-2.5 text-xs font-semibold text-ink-soft',
                      column.align === 'right' && 'text-right',
                      column.align === 'center' && 'text-center',
                    )}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => handleSortClick(column)}
                        className="block w-full truncate text-left font-semibold hover:text-ink"
                      >
                        {headerContent}
                      </button>
                    ) : (
                      <span className="block truncate">{headerContent}</span>
                    )}
                  </div>
                );
              })}
              {rowActions ? <div role="columnheader" className="px-2" /> : null}
            </div>
          </div>
          <div role="rowgroup">
            {renderedRows.map((row) => {
              const key = getRowKey(row);
              const isSelected = selectedKeys.has(key);
              return (
                <div
                  key={key}
                  role="row"
                  style={{ gridTemplateColumns }}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                  className={cn(
                    'grid items-center border-b border-border last:border-none',
                    isSelected && 'bg-brand/5',
                    onRowClick &&
                      'cursor-pointer hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/40',
                  )}
                >
                  {selectable ? (
                    // This cell's only interaction is blocking its click from
                    // bubbling into the row's own `onRowClick` — the actual
                    // interactive control is the `Checkbox` inside it, which
                    // already has its own keyboard/ARIA handling.
                    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events
                    <div
                      role="cell"
                      className="flex items-center px-3 py-2.5"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleRow(row)}
                        label="Select row"
                      />
                    </div>
                  ) : null}
                  {columns.map((column) => (
                    <div
                      key={column.key}
                      role="cell"
                      className={cn(
                        'min-w-0 px-3 py-3 text-ink',
                        column.align === 'right' && 'text-right',
                        column.align === 'center' && 'text-center',
                        !column.render && (column.truncate ?? true) && 'truncate',
                      )}
                    >
                      {column.render
                        ? column.render(row)
                        : String((row as Record<string, unknown>)[column.key] ?? '')}
                    </div>
                  ))}
                  {rowActions ? (
                    // Same as the checkbox cell above — only blocks bubbling
                    // into the row click; the kebab button/menu inside is the
                    // real interactive element.
                    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events
                    <div
                      role="cell"
                      className="flex items-center justify-center px-2"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <RowActionsMenu row={row} actions={rowActions(row)} />
                    </div>
                  ) : null}
                </div>
              );
            })}
            {hasMore ? (
              <div ref={sentinelRef} className="flex justify-center pb-4 pt-3">
                <Loader size="sm" />
              </div>
            ) : (
              // Breathing room below the last row so it doesn't sit flush
              // against the scroll box's bottom edge — without this the last
              // row (or the box's own rounded corner/border) reads as
              // congested, especially since the box's height is a computed
              // viewport fill rather than a height that happens to end right
              // after the last row.
              <div className="pb-4" aria-hidden="true" />
            )}
          </div>
        </div>
        </div>
      )}
    </div>
  );
}

function RowActionsMenu<TRow>({
  row,
  actions,
}: {
  row: TRow;
  actions: DataTableRowAction<TRow>[];
}) {
  const items: DropdownMenuEntry[] = actions.map((action) => {
    const disabled = action.disabled?.(row) ?? false;
    return {
      label: action.label,
      icon: action.icon,
      destructive: action.destructive,
      disabled,
      title: disabled ? action.disabledReason?.(row) : undefined,
      onSelect: () => action.onSelect(row),
    };
  });

  return (
    <DropdownMenu
      align="end"
      trigger={
        <button
          type="button"
          aria-label="Row actions"
          className="flex h-7 w-7 items-center justify-center rounded-control text-ink-faint hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <MoreVertical size={16} />
        </button>
      }
      items={items}
    />
  );
}
