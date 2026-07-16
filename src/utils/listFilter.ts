/**
 * Client-side search + filter helpers shared by every list screen — used
 * directly by `DataTable`'s built-in toolbar, and by `TenantsPage`, which
 * lifts the same search/filter state above both its Table and Card views so
 * one toolbar drives whichever presentation is showing
 * (docs/coding-standards.md §12: don't implement the same concept twice).
 */

export const ALL_FILTER_VALUE = 'all';

export function filterBySearch<TRow>(
  rows: TRow[],
  searchTerm: string,
  getSearchValue?: (row: TRow) => string,
): TRow[] {
  if (!getSearchValue || !searchTerm.trim()) return rows;
  const term = searchTerm.trim().toLowerCase();
  return rows.filter((row) => getSearchValue(row).toLowerCase().includes(term));
}

export interface ListFilterDefinition<TRow> {
  key: string;
  /** Defaults to reading `String(row[key])`. */
  getValue?: (row: TRow) => string;
}

export function applyFilterValues<TRow>(
  rows: TRow[],
  filters: ListFilterDefinition<TRow>[],
  filterValues: Record<string, string>,
): TRow[] {
  let result = rows;
  for (const filter of filters) {
    const selected = filterValues[filter.key];
    if (selected && selected !== ALL_FILTER_VALUE) {
      const getValue =
        filter.getValue ?? ((row) => String((row as Record<string, unknown>)[filter.key] ?? ''));
      result = result.filter((row) => getValue(row) === selected);
    }
  }
  return result;
}

export function hasActiveListFilters(
  searchTerm: string,
  filterValues: Record<string, string>,
): boolean {
  return (
    Boolean(searchTerm.trim()) ||
    Object.values(filterValues).some((value) => value && value !== ALL_FILTER_VALUE)
  );
}
