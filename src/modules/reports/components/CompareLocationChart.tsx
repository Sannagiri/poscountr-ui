import { useMemo } from 'react';
import { Store } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardHeader, EmptyState, ErrorMessage, Loader } from '@/components';
import { describeApiError } from '@/utils/errors';
import { colors } from '@/styles/colors';

import type { Location } from '@/modules/businesses';

import type { CompareLocationPerformanceRow } from '../types/compareReports.types';
import { formatCompactMoney, formatMoney } from '../utils/reportsFormat';

export interface CompareLocationChartProps {
  data: CompareLocationPerformanceRow[];
  locations: Location[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

interface DisplayRow extends CompareLocationPerformanceRow {
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
      <p className="mt-1 text-ink-soft">
        Sales: <span className="font-medium text-ink">{formatMoney(row.sales)}</span>
      </p>
      <p className="text-ink-soft">
        Purchases: <span className="font-medium text-ink">{formatMoney(row.purchases)}</span>
      </p>
      <p className="mt-1 text-ink-soft">
        Margin: <span className="font-medium text-ink">{formatMoney(row.margin)}</span>
      </p>
    </div>
  );
}

/**
 * Sales vs purchases, paired per location — the chart the page exists for.
 * Unlike `StorePerformanceChart`/`PurchaseLocationChart` (donuts, single
 * value per location, gated behind "more than one location"), this is a
 * grouped bar chart (two values per location) and renders unconditionally,
 * even for a single-location business — it collapses to one bar-pair there,
 * which is still the point: comparing that location's sales against its
 * purchases. No denormalized location name from the backend, joined against
 * `locations` here, same as its sibling per-location charts.
 */
export function CompareLocationChart({
  data,
  locations,
  isLoading,
  isError,
  error,
}: CompareLocationChartProps) {
  const rows = useMemo(() => {
    const nameById = new Map(locations.map((location) => [location.id, location.name]));
    return data.map((row) => ({
      ...row,
      locationName: nameById.get(row.locationId) ?? row.locationId,
    }));
  }, [data, locations]);

  return (
    <Card>
      <CardHeader
        title="Sales vs purchases by location"
        subtitle="Which locations sell more than they buy"
        icon={Store}
      />
      {isLoading ? (
        <Loader label="Loading location comparison…" />
      ) : isError ? (
        <ErrorMessage message={describeApiError(error)} />
      ) : rows.length === 0 ? (
        <EmptyState title="No sales or purchase activity in this range" />
      ) : (
        <div style={{ width: '100%', height: Math.max(220, rows.length * 60) }}>
          <ResponsiveContainer>
            <BarChart data={rows} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid stroke={colors.border.DEFAULT} vertical={false} />
              <XAxis
                dataKey="locationName"
                tick={{ fontSize: 11, fill: colors.ink.faint }}
                axisLine={{ stroke: colors.border.strong }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(value) => formatCompactMoney(Number(value))}
                tick={{ fontSize: 11, fill: colors.ink.faint }}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip content={<LocationTooltip />} cursor={{ fill: colors.surface.DEFAULT }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="sales"
                name="Sales"
                fill={colors.brand.DEFAULT}
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              />
              <Bar
                dataKey="purchases"
                name="Purchases"
                fill={colors.accent.DEFAULT}
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
