import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface DataTableColumn<TRow> {
  /** Unique key for the column — also used as the React key for the header cell. */
  key: string;
  header: string;
  /** Renders a cell's content. Defaults to `String(row[key])` when omitted. */
  render?: (row: TRow) => ReactNode;
  sortable?: boolean;
  /**
   * A raw CSS grid track, e.g. `'160px'`, `'1fr'`, `'minmax(140px,1fr)'`.
   * The header row and every body row are each their own CSS Grid using the
   * exact same track list built from every column's `width` — that's what
   * guarantees pixel-perfect column alignment regardless of content or
   * browser quirks (docs/coding-standards.md §7); a native `<table>`'s
   * `auto`/`fixed` layout algorithms don't give that guarantee. Defaults to
   * `'1fr'` (shares remaining space evenly) when omitted.
   */
  width?: string;
  align?: 'left' | 'right' | 'center';
  /** Cell content is truncated with an ellipsis instead of wrapping. Default true for plain (non-`render`) columns. */
  truncate?: boolean;
}

export type SortDirection = 'asc' | 'desc';

export interface DataTableSort {
  key: string;
  direction: SortDirection;
}

/**
 * One entry in a row's "⋮" action menu (rendered via the shared
 * `DropdownMenu` component). `disabled` is a predicate rather than a
 * boolean since whether an action is allowed usually depends on the row
 * itself (e.g. "can't deactivate the last active admin").
 */
export interface DataTableRowAction<TRow> {
  label: string;
  icon?: LucideIcon;
  onSelect: (row: TRow) => void;
  destructive?: boolean;
  disabled?: (row: TRow) => boolean;
  /** Hover text shown when `disabled` returns true for this row — explains why (e.g. a license limit). */
  disabledReason?: (row: TRow) => string | undefined;
}

export interface DataTableFilterOption {
  value: string;
  label: string;
}

export interface DataTableFilter<TRow> {
  key: string;
  label: string;
  /** First option is implicit — "All <label>" is always prepended. */
  options: DataTableFilterOption[];
  /** Defaults to reading `String(row[key])`. */
  getValue?: (row: TRow) => string;
}
