import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Receipt } from 'lucide-react';

import { Card, CardHeader, EmptyState, ErrorMessage, Loader } from '@/components';

import { BILLING_ROUTES, PAYMENT_METHOD_OPTIONS } from '@/modules/billing';
import type { Location } from '@/modules/businesses';

import type { RepresentativeTransaction } from '../types/reports.types';
import { formatMoney } from '../utils/reportsFormat';

export interface RepresentativeTransactionsTableProps {
  data: RepresentativeTransaction[];
  locations: Location[];
  isLoading: boolean;
  errorMessage?: string | null;
}

interface DisplayRow extends RepresentativeTransaction {
  locationName: string;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = Object.fromEntries(
  PAYMENT_METHOD_OPTIONS.map((option) => [option.value, option.label]),
);

const COLUMN_TEMPLATE = '76px 1fr 84px 92px';

function TransactionColumn({ rows }: { rows: DisplayRow[] }) {
  return (
    <div className="overflow-hidden rounded-control border border-border">
      <div
        style={{ gridTemplateColumns: COLUMN_TEMPLATE }}
        className="grid items-center bg-surface px-3 py-2 text-xs font-semibold text-ink-soft"
      >
        <span>Order</span>
        <span>Location</span>
        <span>Payment</span>
        <span className="text-right">Total</span>
      </div>
      {rows.map((row) => (
        <div
          key={row.id}
          style={{ gridTemplateColumns: COLUMN_TEMPLATE }}
          className="grid items-center border-t border-border px-3 py-2.5 text-sm"
        >
          <span className="truncate text-ink">{row.orderNumber ?? '—'}</span>
          <span className="truncate text-ink-soft">{row.locationName}</span>
          <span className="truncate text-ink-soft">
            {row.paymentMethod ? (PAYMENT_METHOD_LABELS[row.paymentMethod] ?? row.paymentMethod) : '—'}
          </span>
          <span className="text-right font-semibold text-ink">{formatMoney(row.total)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * A capped, recent slice — 10 of the most recent completed orders (5+5 in a
 * two-column layout, no scroll) — an appendix for a quick sanity check,
 * deliberately not the star of the page. Trimmed to just Order/Location/
 * Payment/Total; date/type/items/discount live in the full Orders list
 * (linked below) for anyone who needs them.
 */
export function RepresentativeTransactionsTable({
  data,
  locations,
  isLoading,
  errorMessage,
}: RepresentativeTransactionsTableProps) {
  const rows = useMemo(() => {
    const nameById = new Map(locations.map((location) => [location.id, location.name]));
    return data
      .slice(0, 10)
      .map((row) => ({ ...row, locationName: nameById.get(row.locationId) ?? row.locationId }));
  }, [data, locations]);

  return (
    <Card>
      <CardHeader
        title="Representative transactions"
        subtitle="Most recent completed orders in this range"
        icon={Receipt}
        action={<Link to={BILLING_ROUTES.orders}>View all in Orders →</Link>}
      />
      {isLoading ? (
        <Loader label="Loading transactions…" />
      ) : errorMessage ? (
        <ErrorMessage message={errorMessage} />
      ) : rows.length === 0 ? (
        <EmptyState title="No completed orders in this range" />
      ) : (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <TransactionColumn rows={rows.slice(0, 5)} />
          {rows.length > 5 ? <TransactionColumn rows={rows.slice(5, 10)} /> : null}
        </div>
      )}
    </Card>
  );
}
