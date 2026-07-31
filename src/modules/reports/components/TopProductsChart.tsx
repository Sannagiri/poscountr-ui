import { Award } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { YAxisTickContentProps } from 'recharts';

import { Card, CardHeader, EmptyState, ErrorMessage, Loader } from '@/components';
import { describeApiError } from '@/utils/errors';
import { colors } from '@/styles/colors';

import type { TopProductRow } from '../types/reports.types';
import { formatCompactMoney, formatMoney } from '../utils/reportsFormat';

/** Keeps the YAxis category label on one line — the tooltip still shows the full name. */
function truncateName(name: string): string {
  return name.length > 16 ? `${name.slice(0, 15)}…` : name;
}

/**
 * A plain SVG `<text>` tick instead of `tick={{ ... }}` — Recharts' default
 * tick renderer wraps long category labels onto multiple lines whenever a
 * `width` is set on the axis, even after the label is already truncated
 * short enough to fit; rendering the tick ourselves skips that wrapping
 * engine entirely and guarantees a single line. A render function (not a
 * component/element) — Recharts calls `tick` directly when it's a function,
 * which is the reliable path; passing an element for it to clone did not
 * pick up the injected `x`/`y`/`payload`.
 */
function renderProductNameTick({ x, y, payload }: YAxisTickContentProps) {
  return (
    <text x={Number(x)} y={Number(y)} dy={4} textAnchor="end" fontSize={12} fill={colors.ink.DEFAULT}>
      {truncateName(String(payload.value))}
    </text>
  );
}

export interface TopProductsChartProps {
  data: TopProductRow[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

function ProductTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: TopProductRow }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-control border border-border bg-white px-3 py-2 text-xs shadow-card">
      <p className="font-semibold text-ink">{row.name}</p>
      <p className="text-ink-soft">{row.category}</p>
      <p className="mt-1 text-ink-soft">
        {formatMoney(row.revenue)} · {Number(row.unitsSold).toFixed(0)} sold
      </p>
    </div>
  );
}

/**
 * Top products by revenue — ranking, not mix, so this is a bar (highest
 * first), not a donut. One color throughout: ranking a set of named items is
 * a magnitude question, not an identity one — coloring each bar differently
 * would spend the identity channel re-encoding what bar length already
 * shows (dataviz skill, "never color nominal bars by their value").
 *
 * Top 5 only, in array order — Recharts renders a vertical category `BarChart`
 * top-to-bottom in data order (index 0 at top), so with `data` already
 * sorted highest-revenue-first by the backend, no reversal is needed; an
 * earlier version incorrectly reversed the array, which put the lowest of
 * the top-10 at the top instead of #1.
 */
export function TopProductsChart({ data, isLoading, isError, error }: TopProductsChartProps) {
  const chartData = data.slice(0, 5);

  return (
    <Card>
      <CardHeader
        title="Top products"
        subtitle="Highest-revenue products in the selected range"
        icon={Award}
      />
      {isLoading ? (
        <Loader label="Loading top products…" />
      ) : isError ? (
        <ErrorMessage message={describeApiError(error)} />
      ) : data.length === 0 ? (
        <EmptyState title="No completed orders in this range" />
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
              <Bar dataKey="revenue" name="Revenue" fill={colors.brand.DEFAULT} radius={[0, 4, 4, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
