import { useMemo } from 'react';
import { Store } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { Card, CardHeader, EmptyState, ErrorMessage, Loader } from '@/components';
import { describeApiError } from '@/utils/errors';
import { categoricalColorAt } from '@/styles/colors';

import type { Location } from '@/modules/businesses';

import type { PurchaseLocationPerformanceRow } from '../types/purchaseReports.types';
import { formatMoney, formatPercent } from '../utils/reportsFormat';

export interface PurchaseLocationChartProps {
  data: PurchaseLocationPerformanceRow[];
  locations: Location[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

interface DisplayRow extends PurchaseLocationPerformanceRow {
  locationName: string;
}

function LocationTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: DisplayRow }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-control border border-border bg-surface-card px-3 py-2 text-xs shadow-card">
      <p className="font-semibold text-ink">{row.locationName}</p>
      <p className="text-ink-soft">
        {formatMoney(row.spend)} · {formatPercent(row.share)}
      </p>
    </div>
  );
}

/**
 * Purchase spend by location — same "mix, not ranking" reasoning as
 * `StorePerformanceChart` (the sales-side sibling), only rendered by the
 * page for a tenant_admin with more than one location. No denormalized
 * location name from the backend, joined against `locations` here.
 */
export function PurchaseLocationChart({
  data,
  locations,
  isLoading,
  isError,
  error,
}: PurchaseLocationChartProps) {
  const rows = useMemo(() => {
    const nameById = new Map(locations.map((location) => [location.id, location.name]));
    return data.map((row) => ({
      ...row,
      locationName: nameById.get(row.locationId) ?? row.locationId,
    }));
  }, [data, locations]);

  return (
    <Card>
      <CardHeader title="Purchases by location" subtitle="Spend by location" icon={Store} />
      {isLoading ? (
        <Loader label="Loading location breakdown…" />
      ) : isError ? (
        <ErrorMessage message={describeApiError(error)} />
      ) : rows.length === 0 ? (
        <EmptyState title="No completed purchase orders in this range" />
      ) : (
        <div className="flex justify-center" style={{ width: '100%', height: 180 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={rows}
                dataKey={(row) => Number(row.spend)}
                nameKey="locationName"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                stroke="none"
              >
                {rows.map((row, index) => (
                  <Cell key={row.locationId} fill={categoricalColorAt(index)} />
                ))}
              </Pie>
              <Tooltip content={<LocationTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
