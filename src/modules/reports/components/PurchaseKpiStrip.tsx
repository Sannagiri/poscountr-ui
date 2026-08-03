import type { LucideIcon } from 'lucide-react';
import {
  IndianRupee,
  Package,
  Percent,
  Receipt,
  ShoppingCart,
  Wallet,
  XCircle,
} from 'lucide-react';

import { Loader } from '@/components';

import type { PurchaseReportsKpi } from '../types/purchaseReports.types';
import { formatCompactMoney } from '../utils/reportsFormat';
import type { KpiTint } from './KpiTile';
import { KpiTile } from './KpiTile';

export interface PurchaseKpiStripProps {
  current: PurchaseReportsKpi | undefined;
  /** The prior equal-length period's KPI block — `null` while it's still loading, so tiles render with no delta badge rather than a spinner per-tile. */
  previous: PurchaseReportsKpi | null;
  isLoading: boolean;
}

function deltaPercent(current: number, previous: number | undefined): number | null {
  if (previous === undefined) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

/**
 * The purchasing executive summary — same shape/shell as `KpiStrip` (sales),
 * a separate component rather than a shared generic one since the two tile
 * lists are hardcoded to different fields with no shared schema to drive off
 * (see `PurchaseKpiStrip`'s sibling note in the roadmap plan).
 */
export function PurchaseKpiStrip({ current, previous, isLoading }: PurchaseKpiStripProps) {
  if (isLoading || !current) return <Loader label="Loading purchase summary…" />;

  const tiles: {
    label: string;
    value: string;
    delta: number | null;
    good: 'up' | 'down' | 'neutral';
    icon: LucideIcon;
    tint: KpiTint;
    caption?: string;
  }[] = [
    {
      label: 'Total purchase value',
      value: formatCompactMoney(Number(current.totalPurchaseValue)),
      delta: deltaPercent(
        Number(current.totalPurchaseValue),
        previous ? Number(previous.totalPurchaseValue) : undefined,
      ),
      good: 'neutral',
      icon: IndianRupee,
      tint: 'brand',
    },
    {
      label: 'Tax paid',
      value: formatCompactMoney(Number(current.taxTotal)),
      delta: deltaPercent(
        Number(current.taxTotal),
        previous ? Number(previous.taxTotal) : undefined,
      ),
      good: 'neutral',
      icon: Percent,
      tint: 'warning',
    },
    {
      label: 'PO count',
      value: String(current.poCount),
      delta: deltaPercent(current.poCount, previous?.poCount),
      good: 'neutral',
      icon: Receipt,
      tint: 'accent',
    },
    {
      label: 'Avg PO value',
      value: formatCompactMoney(Number(current.averagePoValue)),
      delta: deltaPercent(
        Number(current.averagePoValue),
        previous ? Number(previous.averagePoValue) : undefined,
      ),
      good: 'neutral',
      icon: ShoppingCart,
      tint: 'accent',
    },
    {
      label: 'Units purchased',
      value: Number(current.unitsPurchased).toFixed(0),
      delta: deltaPercent(
        Number(current.unitsPurchased),
        previous ? Number(previous.unitsPurchased) : undefined,
      ),
      good: 'neutral',
      icon: Package,
      tint: 'brand',
    },
    {
      label: 'Outstanding dues',
      value: formatCompactMoney(Number(current.outstandingDues)),
      delta: deltaPercent(
        Number(current.outstandingDues),
        previous ? Number(previous.outstandingDues) : undefined,
      ),
      good: 'down',
      icon: Wallet,
      tint: 'danger',
      caption: 'For POs raised in this range, not an all-time balance',
    },
    {
      label: 'Cancelled POs',
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
          caption={tile.caption}
        />
      ))}
    </div>
  );
}
