import { Card, EmptyState, ErrorMessage, Loader } from '@/components';
import { describeApiError } from '@/utils/errors';

import { useTables } from '../../hooks/useTables';
import type { Table } from '../../types/tables.types';
import { TableLayoutCanvas } from '../TableLayoutCanvas';

export interface TableSelectScreenProps {
  locationId: string;
  /** A free table was tapped — proceed into the item-grid/cart with this table pre-filled. */
  onSelectFreeTable: (table: Table) => void;
  /** An occupied table was tapped — its order should be opened directly instead of starting a new one. */
  onSelectOccupiedTable: (table: Table) => void;
}

/**
 * The table-first order-entry step — `NewOrderPage` renders this in place
 * of the product grid until a table is chosen. Polls occupancy (via
 * `useTables`'s `poll` option) so two staff picking tables around the same
 * moment both see up-to-date free/occupied coloring; the actual
 * double-booking race is still closed server-side (`OrderService.create`
 * re-checks occupancy at creation time), this is just about the screen not
 * looking stale while it's open.
 */
export function TableSelectScreen({
  locationId,
  onSelectFreeTable,
  onSelectOccupiedTable,
}: TableSelectScreenProps) {
  const tablesQuery = useTables(locationId, { poll: true });

  function handleTableClick(table: Table) {
    if (table.currentOrder) onSelectOccupiedTable(table);
    else onSelectFreeTable(table);
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">
            Select a table
          </p>
          <p className="mt-0.5 text-xs text-ink-faint">
            Tap a free table to start an order, or an occupied one to reopen its bill
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-ink-faint">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-border bg-white" /> Free
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-warning-text bg-warning-bg" />{' '}
            Occupied
          </span>
        </div>
      </div>
      {tablesQuery.isLoading ? (
        <Loader label="Loading tables…" />
      ) : tablesQuery.isError ? (
        <ErrorMessage
          message={describeApiError(tablesQuery.error)}
          onRetry={() => tablesQuery.refetch()}
        />
      ) : (tablesQuery.data ?? []).length === 0 ? (
        <EmptyState
          title="No tables set up yet"
          description="Design this location's floor plan from Locations → Edit layout."
        />
      ) : (
        <TableLayoutCanvas tables={tablesQuery.data ?? []} mode="select" onTableClick={handleTableClick} />
      )}
    </Card>
  );
}
