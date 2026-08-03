import { Wallet } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { Card, CardHeader, EmptyState, ErrorMessage, Loader } from '@/components';
import { describeApiError } from '@/utils/errors';
import { statusLabel } from '@/utils/status';
import { purchasePaymentStatusColorRole } from '@/styles/colors';

import type { PaymentStatusMixRow } from '../types/purchaseReports.types';
import { formatMoney, formatPercent } from '../utils/reportsFormat';

export interface PurchasePaymentStatusChartProps {
  data: PaymentStatusMixRow[];
  /** The KPI strip's `outstandingDues` figure, shown as a footer line so it's visible right next to the paid/partial/credit split it explains. */
  outstandingDues: string | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

function PaymentStatusTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: PaymentStatusMixRow }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-control border border-border bg-surface-card px-3 py-2 text-xs shadow-card">
      <p className="font-semibold text-ink">{statusLabel(row.paymentStatus)}</p>
      <p className="text-ink-soft">
        {formatMoney(row.amount)} · {formatPercent(row.share)}
      </p>
    </div>
  );
}

/**
 * Paid/partial/credit split for completed purchase orders — same "mix, not
 * ranking" donut reasoning as `PaymentMixChart` (the sales-side sibling).
 * Fixed per-status colors (`purchasePaymentStatusColorRole`), not
 * `categoricalColorAt` — payment status has inherent semantic meaning
 * (paid=good, credit=owed), unlike an arbitrary payment method.
 */
export function PurchasePaymentStatusChart({
  data,
  outstandingDues,
  isLoading,
  isError,
  error,
}: PurchasePaymentStatusChartProps) {
  return (
    <Card>
      <CardHeader
        title="Payment status"
        subtitle="Share of purchase spend by paid / partial / credit"
        icon={Wallet}
      />
      {isLoading ? (
        <Loader label="Loading payment status…" />
      ) : isError ? (
        <ErrorMessage message={describeApiError(error)} />
      ) : data.length === 0 ? (
        <EmptyState title="No completed purchase orders in this range" />
      ) : (
        <>
          <div className="flex justify-center" style={{ width: '100%', height: 180 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={data}
                  dataKey={(row) => Number(row.amount)}
                  nameKey="paymentStatus"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  stroke="none"
                >
                  {data.map((row) => (
                    <Cell
                      key={row.paymentStatus}
                      fill={purchasePaymentStatusColorRole[row.paymentStatus]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<PaymentStatusTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {outstandingDues !== undefined ? (
            <p className="mt-1 text-center text-xs text-ink-soft">
              Outstanding dues in range:{' '}
              <span className="font-medium text-ink">{formatMoney(outstandingDues)}</span>
            </p>
          ) : null}
        </>
      )}
    </Card>
  );
}
