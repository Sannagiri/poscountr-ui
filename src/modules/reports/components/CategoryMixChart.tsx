import { LayoutGrid } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { Card, CardHeader, EmptyState, ErrorMessage, Loader } from '@/components';
import { describeApiError } from '@/utils/errors';
import { categoricalColorAt } from '@/styles/colors';

import type { CategoryMixRow } from '../types/reports.types';
import { formatMoney, formatPercent } from '../utils/reportsFormat';

export interface CategoryMixChartProps {
  data: CategoryMixRow[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

function CategoryTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: CategoryMixRow }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-control border border-border bg-surface-card px-3 py-2 text-xs shadow-card">
      <p className="font-semibold text-ink">{row.category}</p>
      <p className="text-ink-soft">
        {formatMoney(row.revenue)} · {formatPercent(row.share)}
      </p>
    </div>
  );
}

/**
 * Category-mix donut — "what the business sells" at a glance. A donut, not a
 * bar: mix/share is a "how does this slice compare to the whole" question, a
 * bar makes you compare heights instead. Hover-only identity reveal (no
 * persistent legend) — an informed user decision to keep the dashboard
 * clean; the textual category/revenue/share breakdown is deferred to the
 * future CSV/Word export instead of living on-screen here.
 */
export function CategoryMixChart({ data, isLoading, isError, error }: CategoryMixChartProps) {
  return (
    <Card>
      <CardHeader
        title="Category sales"
        subtitle="Share of revenue by product category"
        icon={LayoutGrid}
      />
      {isLoading ? (
        <Loader label="Loading category mix…" />
      ) : isError ? (
        <ErrorMessage message={describeApiError(error)} />
      ) : data.length === 0 ? (
        <EmptyState title="No completed orders in this range" />
      ) : (
        <div className="flex justify-center" style={{ width: '100%', height: 180 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={data}
                dataKey={(row) => Number(row.revenue)}
                nameKey="category"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                stroke="none"
              >
                {data.map((row, index) => (
                  <Cell key={row.category} fill={categoricalColorAt(index)} />
                ))}
              </Pie>
              <Tooltip content={<CategoryTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
