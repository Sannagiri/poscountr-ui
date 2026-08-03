import { Truck } from 'lucide-react';
import type { YAxisTickContentProps } from 'recharts';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Card, CardHeader, EmptyState, ErrorMessage, Loader } from '@/components';
import { describeApiError } from '@/utils/errors';
import { colors } from '@/styles/colors';

import type { TopSupplierRow } from '../types/purchaseReports.types';
import { formatCompactMoney, formatMoney } from '../utils/reportsFormat';

/** Keeps the YAxis category label on one line — the tooltip still shows the full name. Same truncation width/logic as `TopProductsChart`. */
function truncateName(name: string): string {
  return name.length > 16 ? `${name.slice(0, 15)}…` : name;
}

/** Plain SVG `<text>` tick — see `TopProductsChart`'s `renderProductNameTick` for why (Recharts' default tick wraps an already-short label whenever `width` is set on the axis). */
function renderSupplierNameTick({ x, y, payload }: YAxisTickContentProps) {
  return (
    <text
      x={Number(x)}
      y={Number(y)}
      dy={4}
      textAnchor="end"
      fontSize={12}
      fill={colors.ink.DEFAULT}
    >
      {truncateName(String(payload.value))}
    </text>
  );
}

export interface TopSuppliersChartProps {
  data: TopSupplierRow[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

function SupplierTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: TopSupplierRow }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-control border border-border bg-surface-card px-3 py-2 text-xs shadow-card">
      <p className="font-semibold text-ink">{row.name}</p>
      <p className="mt-1 text-ink-soft">
        {formatMoney(row.spend)} · {row.poCount} PO{row.poCount === 1 ? '' : 's'}
      </p>
    </div>
  );
}

/**
 * Top suppliers by spend — ranking, not mix, so a bar (highest first), not a
 * donut. One color throughout, same reasoning as `TopProductsChart`. Top 5
 * only, in array order (already sorted highest-spend-first by the backend).
 */
export function TopSuppliersChart({ data, isLoading, isError, error }: TopSuppliersChartProps) {
  const chartData = data.slice(0, 5);

  return (
    <Card>
      <CardHeader
        title="Top suppliers"
        subtitle="Highest-spend suppliers in the selected range"
        icon={Truck}
      />
      {isLoading ? (
        <Loader label="Loading top suppliers…" />
      ) : isError ? (
        <ErrorMessage message={describeApiError(error)} />
      ) : data.length === 0 ? (
        <EmptyState title="No completed purchase orders in this range" />
      ) : (
        <div style={{ width: '100%', height: Math.max(220, chartData.length * 36) }}>
          <ResponsiveContainer>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 24, left: 4, bottom: 4 }}
            >
              <CartesianGrid stroke={colors.border.DEFAULT} horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={(value) => formatCompactMoney(Number(value))}
                tick={{ fontSize: 11, fill: colors.ink.faint }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={140}
                tick={renderSupplierNameTick}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<SupplierTooltip />} cursor={{ fill: colors.surface.DEFAULT }} />
              <Bar
                dataKey="spend"
                name="Spend"
                fill={colors.brand.DEFAULT}
                radius={[0, 4, 4, 0]}
                maxBarSize={22}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
