import { FileText, IndianRupee, Receipt, Scale, ShoppingCart } from 'lucide-react';

import { Loader } from '@/components';

import type { CompareReportsKpi } from '../types/compareReports.types';
import { formatCompactMoney, formatPercent } from '../utils/reportsFormat';
import { KpiTile } from './KpiTile';

export interface CompareKpiStripProps {
  data: CompareReportsKpi | undefined;
  isLoading: boolean;
}

/**
 * The compare-reports executive summary — no period-over-period delta here
 * (unlike `KpiStrip`/`PurchaseKpiStrip`): this page's whole point is
 * already a comparison (sales vs purchases), a second this-vs-last-period
 * comparison layered on top would be one comparison too many for one strip
 * to read cleanly. `margin_percent` rides as the gross-margin tile's
 * caption rather than its own tile — same pattern Purchase Reports uses for
 * "Outstanding dues (in range)".
 */
export function CompareKpiStrip({ data, isLoading }: CompareKpiStripProps) {
  if (isLoading || !data) return <Loader label="Loading comparison…" />;

  const tiles: {
    label: string;
    value: string;
    icon: typeof IndianRupee;
    tint: 'brand' | 'accent' | 'success' | 'warning';
    inlineCaption?: string;
  }[] = [
    {
      label: 'Net sales',
      value: formatCompactMoney(Number(data.netSales)),
      icon: IndianRupee,
      tint: 'brand',
    },
    {
      label: 'Total purchase value',
      value: formatCompactMoney(Number(data.totalPurchaseValue)),
      icon: ShoppingCart,
      tint: 'accent',
    },
    {
      label: 'Gross margin',
      value: formatCompactMoney(Number(data.grossMargin)),
      icon: Scale,
      tint: 'success',
      inlineCaption: `(${formatPercent(data.marginPercent)})`,
    },
    {
      label: 'Transactions',
      value: String(data.transactionCount),
      icon: Receipt,
      tint: 'accent',
    },
    {
      label: 'PO count',
      value: String(data.poCount),
      icon: FileText,
      tint: 'warning',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-5">
      {tiles.map((tile) => (
        <KpiTile
          key={tile.label}
          label={tile.label}
          value={tile.value}
          icon={tile.icon}
          tint={tile.tint}
          deltaPercent={null}
          goodDirection="neutral"
          inlineCaption={tile.inlineCaption}
        />
      ))}
    </div>
  );
}
