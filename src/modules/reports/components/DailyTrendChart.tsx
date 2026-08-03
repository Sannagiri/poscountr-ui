import { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardHeader, EmptyState, ErrorMessage, Loader } from '@/components';
import { describeApiError } from '@/utils/errors';
import { colors } from '@/styles/colors';

import type { DailyTrendPoint } from '../types/reports.types';
import { formatCompactMoney, formatMoney, formatShortDate } from '../utils/reportsFormat';

export interface DailyTrendChartProps {
  data: DailyTrendPoint[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  /** @default 'Daily sales trend' */
  title?: string;
  /** @default 'Revenue over the selected range, with a smoothed trend line' */
  subtitle?: string;
  /** Tooltip's first-line label — @default 'Revenue'. Lets a caller with a differently-named money figure (e.g. purchase spend) reuse this chart without a fork; the underlying `revenue`/`orders`/`units` field names stay fixed, only display text changes. */
  valueLabel?: string;
  /** @default 'No completed orders in this range' */
  emptyTitle?: string;
}

interface TrendPoint {
  label: string;
  revenue: number;
  orders: number;
  units: number;
}

// One axis, one measure (revenue) — a second scaled series (e.g. order
// count) would be a dual-axis chart, which reads as two unrelated stories
// forced onto one plot; orders/units are still available on hover instead.
const DAILY_POINT_THRESHOLD = 45;
const WEEKLY_POINT_THRESHOLD = 180;

function toTrendPoint(point: DailyTrendPoint): TrendPoint {
  return {
    label: formatShortDate(point.date),
    revenue: Number(point.revenue),
    orders: point.orders,
    units: Number(point.units),
  };
}

/** Re-buckets daily points to weekly/monthly for a wide range — 90+ individual daily dots reads as noise, not a trend. */
function bucketTrend(data: DailyTrendPoint[]): TrendPoint[] {
  if (data.length <= DAILY_POINT_THRESHOLD) return data.map(toTrendPoint);

  const bucketDays = data.length <= WEEKLY_POINT_THRESHOLD ? 7 : 30;
  const points: TrendPoint[] = [];
  for (let i = 0; i < data.length; i += bucketDays) {
    const slice = data.slice(i, i + bucketDays);
    const revenue = slice.reduce((sum, point) => sum + Number(point.revenue), 0);
    const orders = slice.reduce((sum, point) => sum + point.orders, 0);
    const units = slice.reduce((sum, point) => sum + Number(point.units), 0);
    const label =
      bucketDays === 7
        ? `Wk of ${formatShortDate(slice[0].date)}`
        : formatShortDate(slice[0].date, { month: 'short', year: '2-digit', day: undefined });
    points.push({ label, revenue, orders, units });
  }
  return points;
}

/** Trailing smoothed line over whatever granularity `points` is already bucketed at — cuts day-to-day noise into a readable trend. */
function withMovingAverage(points: TrendPoint[]): (TrendPoint & { movingAverage: number })[] {
  return points.map((point, index) => {
    const window = points.slice(Math.max(0, index - 6), index + 1);
    const movingAverage = window.reduce((sum, p) => sum + p.revenue, 0) / window.length;
    return { ...point, movingAverage };
  });
}

function TrendTooltip({
  active,
  payload,
  valueLabel,
}: {
  active?: boolean;
  payload?: { payload: TrendPoint }[];
  valueLabel: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-control border border-border bg-white px-3 py-2 text-xs shadow-card">
      <p className="font-semibold text-ink">{point.label}</p>
      <p className="mt-1 text-ink-soft">
        {valueLabel}: <span className="font-medium text-ink">{formatMoney(point.revenue)}</span>
      </p>
      <p className="text-ink-soft">
        Orders: <span className="font-medium text-ink">{point.orders}</span>
      </p>
      <p className="text-ink-soft">
        Units: <span className="font-medium text-ink">{point.units}</span>
      </p>
    </div>
  );
}

/** The dashboard's hero chart — daily revenue trend with a smoothed overlay, re-bucketed to weekly/monthly for wide ranges. Reused as-is (parameterized) by the Purchase-summary tab — the bucketing/smoothing logic has zero sales-specific coupling once the header text and tooltip label are props. */
export function DailyTrendChart({
  data,
  isLoading,
  isError,
  error,
  title = 'Daily sales trend',
  subtitle = 'Revenue over the selected range, with a smoothed trend line',
  valueLabel = 'Revenue',
  emptyTitle = 'No completed orders in this range',
}: DailyTrendChartProps) {
  const points = useMemo(() => withMovingAverage(bucketTrend(data)), [data]);

  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} icon={TrendingUp} />
      {isLoading ? (
        <Loader label="Loading trend…" />
      ) : isError ? (
        <ErrorMessage message={describeApiError(error)} />
      ) : points.length === 0 ? (
        <EmptyState title={emptyTitle} />
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
              <Tooltip content={<TrendTooltip valueLabel={valueLabel} />} />
              <Area
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke={colors.brand.DEFAULT}
                fill={colors.brand.DEFAULT}
                fillOpacity={0.14}
                strokeWidth={2}
                dot={points.length <= 31}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="movingAverage"
                name="Trend"
                stroke={colors.accent.DEFAULT}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
