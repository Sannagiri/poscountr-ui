import type { LucideIcon } from 'lucide-react';
import { IndianRupee, Package, Percent, Receipt, ShoppingCart, TrendingUp, XCircle } from 'lucide-react';

import { Loader } from '@/components';

import type { ReportsDashboardKpi } from '../types/reports.types';
import { formatCompactMoney } from '../utils/reportsFormat';
import type { KpiTint } from './KpiTile';
import { KpiTile } from './KpiTile';

export interface KpiStripProps {
  current: ReportsDashboardKpi | undefined;
  /** The prior equal-length period's KPI block — `null` while it's still loading, so tiles render with no delta badge rather than a spinner per-tile. */
  previous: ReportsDashboardKpi | null;
  isLoading: boolean;
}

function deltaPercent(current: number, previous: number | undefined): number | null {
  if (previous === undefined) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

/**
 * The executive summary — the first thing this dashboard shows. Every tile
 * carries a period-over-period delta (see `KpiTile`) since a bare number
 * doesn't convey pulse; only a number next to "vs last period" does.
 */
export function KpiStrip({ current, previous, isLoading }: KpiStripProps) {
  if (isLoading || !current) return <Loader label="Loading summary…" />;

  const tiles: {
    label: string;
    value: string;
    delta: number | null;
    good: 'up' | 'down' | 'neutral';
    icon: LucideIcon;
    tint: KpiTint;
  }[] = [
    {
      label: 'Gross sales',
      value: formatCompactMoney(Number(current.grossSales)),
      delta: deltaPercent(Number(current.grossSales), previous ? Number(previous.grossSales) : undefined),
      good: 'up',
      icon: IndianRupee,
      tint: 'brand',
    },
    {
      label: 'Discounts',
      value: formatCompactMoney(Number(current.discountTotal)),
      delta: deltaPercent(
        Number(current.discountTotal),
        previous ? Number(previous.discountTotal) : undefined,
      ),
      good: 'neutral',
      icon: Percent,
      tint: 'warning',
    },
    {
      label: 'Net sales',
      value: formatCompactMoney(Number(current.netSales)),
      delta: deltaPercent(Number(current.netSales), previous ? Number(previous.netSales) : undefined),
      good: 'up',
      icon: TrendingUp,
      tint: 'success',
    },
    {
      label: 'Transactions',
      value: String(current.transactionCount),
      delta: deltaPercent(current.transactionCount, previous?.transactionCount),
      good: 'up',
      icon: Receipt,
      tint: 'accent',
    },
    {
      label: 'Avg order value',
      value: formatCompactMoney(Number(current.averageOrderValue)),
      delta: deltaPercent(
        Number(current.averageOrderValue),
        previous ? Number(previous.averageOrderValue) : undefined,
      ),
      good: 'up',
      icon: ShoppingCart,
      tint: 'accent',
    },
    {
      label: 'Units sold',
      value: Number(current.unitsSold).toFixed(0),
      delta: deltaPercent(Number(current.unitsSold), previous ? Number(previous.unitsSold) : undefined),
      good: 'up',
      icon: Package,
      tint: 'brand',
    },
    {
      label: 'Cancelled orders',
      value: String(current.cancelledCount),
      delta: deltaPercent(current.cancelledCount, previous?.cancelledCount),
      good: 'down',
      icon: XCircle,
      tint: 'danger',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4 xl:grid-cols-7">
      {tiles.map((tile) => (
        <KpiTile
          key={tile.label}
          label={tile.label}
          value={tile.value}
          icon={tile.icon}
          tint={tile.tint}
          deltaPercent={tile.delta}
          goodDirection={tile.good}
        />
      ))}
    </div>
  );
}
