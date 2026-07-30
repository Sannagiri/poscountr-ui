import { useMemo } from 'react';
import { Store } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { Card, CardHeader, EmptyState, ErrorMessage, Loader } from '@/components';
import { describeApiError } from '@/utils/errors';
import { categoricalColorAt } from '@/styles/colors';

import type { Location } from '@/modules/businesses';

import type { StorePerformanceRow } from '../types/reports.types';
import { formatMoney, formatPercent } from '../utils/reportsFormat';

export interface StorePerformanceChartProps {
  data: StorePerformanceRow[];
  locations: Location[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

interface DisplayRow extends StorePerformanceRow {
  locationName: string;
}

function StoreTooltip({ active, payload }: { active?: boolean; payload?: { payload: DisplayRow }[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-control border border-border bg-white px-3 py-2 text-xs shadow-card">
      <p className="font-semibold text-ink">{row.locationName}</p>
      <p className="text-ink-soft">
        {formatMoney(row.revenue)} · {formatPercent(row.share)}
      </p>
    </div>
  );
}

/**
 * Store-performance donut — only rendered by the page for a tenant_admin
 * with more than one location. Same "mix, not ranking" reasoning and
 * hover-only identity reveal as `CategoryMixChart`/`PaymentMixChart` — no
 * denormalized name from the backend, so it's joined against `locations`
 * here, same as the table it replaces.
 */
export function StorePerformanceChart({
  data,
  locations,
  isLoading,
  isError,
  error,
}: StorePerformanceChartProps) {
  const rows = useMemo(() => {
    const nameById = new Map(locations.map((location) => [location.id, location.name]));
    return data.map((row) => ({ ...row, locationName: nameById.get(row.locationId) ?? row.locationId }));
  }, [data, locations]);

  return (
    <Card>
      <CardHeader title="Store performance" subtitle="Revenue by location" icon={Store} />
      {isLoading ? (
        <Loader label="Loading store performance…" />
      ) : isError ? (
        <ErrorMessage message={describeApiError(error)} />
      ) : rows.length === 0 ? (
        <EmptyState title="No completed orders in this range" />
      ) : (
        <div className="flex justify-center" style={{ width: '100%', height: 180 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={rows}
                dataKey={(row) => Number(row.revenue)}
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
              <Tooltip content={<StoreTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
