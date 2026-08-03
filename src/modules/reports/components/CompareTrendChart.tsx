import { useMemo } from 'react';
import { GitCompare } from 'lucide-react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardHeader, EmptyState, ErrorMessage, Loader } from '@/components';
import { describeApiError } from '@/utils/errors';
import { colors } from '@/styles/colors';

import type { CompareDailyTrendPoint } from '../types/compareReports.types';
import { formatCompactMoney, formatMoney, formatShortDate } from '../utils/reportsFormat';

export interface CompareTrendChartProps {
  data: CompareDailyTrendPoint[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

interface TrendPoint {
  label: string;
  sales: number;
  purchases: number;
}

// Same re-bucketing thresholds as `DailyTrendChart` — 90+ individual daily
// dots reads as noise, not a trend. No moving-average overlay here (unlike
// `DailyTrendChart`): with two independent series already on the plot, a
// third/fourth smoothed line would clutter more than it'd clarify — the
// point of this chart is the sales-vs-purchases gap itself, not either
// series' own trend shape.
const DAILY_POINT_THRESHOLD = 45;
const WEEKLY_POINT_THRESHOLD = 180;

function toTrendPoint(point: CompareDailyTrendPoint): TrendPoint {
  return {
    label: formatShortDate(point.date),
    sales: Number(point.sales),
    purchases: Number(point.purchases),
  };
}

function bucketTrend(data: CompareDailyTrendPoint[]): TrendPoint[] {
  if (data.length <= DAILY_POINT_THRESHOLD) return data.map(toTrendPoint);

  const bucketDays = data.length <= WEEKLY_POINT_THRESHOLD ? 7 : 30;
  const points: TrendPoint[] = [];
  for (let i = 0; i < data.length; i += bucketDays) {
    const slice = data.slice(i, i + bucketDays);
    const sales = slice.reduce((sum, point) => sum + Number(point.sales), 0);
    const purchases = slice.reduce((sum, point) => sum + Number(point.purchases), 0);
    const label =
      bucketDays === 7
        ? `Wk of ${formatShortDate(slice[0].date)}`
        : formatShortDate(slice[0].date, { month: 'short', year: '2-digit', day: undefined });
    points.push({ label, sales, purchases });
  }
  return points;
}

function CompareTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: TrendPoint }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const margin = point.sales - point.purchases;
  return (
    <div className="rounded-control border border-border bg-surface-card px-3 py-2 text-xs shadow-card">
      <p className="font-semibold text-ink">{point.label}</p>
      <p className="mt-1 text-ink-soft">
        Sales: <span className="font-medium text-ink">{formatMoney(point.sales)}</span>
      </p>
      <p className="text-ink-soft">
        Purchases: <span className="font-medium text-ink">{formatMoney(point.purchases)}</span>
      </p>
      <p className="mt-1 text-ink-soft">
        Margin: <span className="font-medium text-ink">{formatMoney(margin)}</span>
      </p>
    </div>
  );
}

/** Sales vs purchases, daily, on one shared date axis — the page's hero chart. Re-bucketed to weekly/monthly for wide ranges, same thresholds as `DailyTrendChart`. */
export function CompareTrendChart({ data, isLoading, isError, error }: CompareTrendChartProps) {
  const points = useMemo(() => bucketTrend(data), [data]);

  return (
    <Card>
      <CardHeader
        title="Sales vs purchases trend"
        subtitle="Daily sales and purchase spend over the selected range"
        icon={GitCompare}
      />
      {isLoading ? (
        <Loader label="Loading trend…" />
      ) : isError ? (
        <ErrorMessage message={describeApiError(error)} />
      ) : points.length === 0 ? (
        <EmptyState title="No sales or purchase activity in this range" />
      ) : (
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <ComposedChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={colors.border.DEFAULT} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: colors.ink.faint }}
                axisLine={{ stroke: colors.border.strong }}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                tickFormatter={(value) => formatCompactMoney(Number(value))}
                tick={{ fontSize: 11, fill: colors.ink.faint }}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip content={<CompareTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="sales"
                name="Sales"
                stroke={colors.brand.DEFAULT}
                fill={colors.brand.DEFAULT}
                fillOpacity={0.14}
                strokeWidth={2}
                dot={points.length <= 31}
                activeDot={{ r: 4 }}
              />
              <Area
                type="monotone"
                dataKey="purchases"
                name="Purchases"
                stroke={colors.accent.DEFAULT}
                fill={colors.accent.DEFAULT}
                fillOpacity={0.14}
                strokeWidth={2}
                dot={points.length <= 31}
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
