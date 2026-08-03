import { Award } from 'lucide-react';
import type { YAxisTickContentProps } from 'recharts';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Card, CardHeader, EmptyState, ErrorMessage, Loader } from '@/components';
import { describeApiError } from '@/utils/errors';
import { colors } from '@/styles/colors';

import type { TopProductPurchasedRow } from '../types/purchaseReports.types';
import { formatCompactMoney, formatMoney } from '../utils/reportsFormat';

/** Same truncation as `TopProductsChart`'s YAxis tick — the tooltip still shows the full name. */
function truncateName(name: string): string {
  return name.length > 16 ? `${name.slice(0, 15)}…` : name;
}

function renderProductNameTick({ x, y, payload }: YAxisTickContentProps) {
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

export interface TopProductsPurchasedChartProps {
  data: TopProductPurchasedRow[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

function ProductTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: TopProductPurchasedRow }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-control border border-border bg-white px-3 py-2 text-xs shadow-card">
      <p className="font-semibold text-ink">{row.name}</p>
      <p className="text-ink-soft">{row.category}</p>
      <p className="mt-1 text-ink-soft">
        {formatMoney(row.spend)} · {Number(row.quantityPurchased).toFixed(0)} purchased
      </p>
    </div>
  );
}

/**
 * Top products by purchase spend — ranking, not mix, same bar-not-donut
 * reasoning as `TopProductsChart` (the sales-side sibling). Top 5 only, in
 * array order (already sorted highest-spend-first by the backend).
 */
export function TopProductsPurchasedChart({
  data,
  isLoading,
  isError,
  error,
}: TopProductsPurchasedChartProps) {
  const chartData = data.slice(0, 5);

  return (
    <Card>
      <CardHeader
        title="Top products purchased"
        subtitle="Highest-spend products in the selected range"
        icon={Award}
      />
      {isLoading ? (
        <Loader label="Loading top products purchased…" />
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
                tick={renderProductNameTick}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ProductTooltip />} cursor={{ fill: colors.surface.DEFAULT }} />
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
