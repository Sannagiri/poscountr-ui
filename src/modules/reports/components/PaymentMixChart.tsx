import { CreditCard } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { Card, CardHeader, EmptyState, ErrorMessage, Loader } from '@/components';
import { describeApiError } from '@/utils/errors';
import { paymentMethodColorRole } from '@/styles/colors';

import { PAYMENT_METHOD_OPTIONS } from '@/modules/billing';

import type { PaymentMixRow } from '../types/reports.types';
import { formatMoney, formatPercent } from '../utils/reportsFormat';

export interface PaymentMixChartProps {
  data: PaymentMixRow[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = Object.fromEntries(
  PAYMENT_METHOD_OPTIONS.map((option) => [option.value, option.label]),
);

function paymentLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method] ?? method;
}

function PaymentTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: PaymentMixRow }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-control border border-border bg-white px-3 py-2 text-xs shadow-card">
      <p className="font-semibold text-ink">{paymentLabel(row.paymentMethod)}</p>
      <p className="text-ink-soft">
        {formatMoney(row.revenue)} · {formatPercent(row.share)}
      </p>
    </div>
  );
}

/**
 * Payment-method donut — same "mix, not ranking" reasoning and hover-only
 * identity reveal as `CategoryMixChart`. Colors come from
 * `paymentMethodColorRole` (a fixed per-method slot, same order as the
 * completion step's payment picker) so a method's color stays consistent
 * across the whole app, not just this chart.
 */
export function PaymentMixChart({ data, isLoading, isError, error }: PaymentMixChartProps) {
  return (
    <Card>
      <CardHeader
        title="Payment methods"
        subtitle="Share of revenue by how customers paid"
        icon={CreditCard}
      />
      {isLoading ? (
        <Loader label="Loading payment mix…" />
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
                nameKey="paymentMethod"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                stroke="none"
              >
                {data.map((row) => (
                  <Cell
                    key={row.paymentMethod}
                    fill={paymentMethodColorRole[row.paymentMethod] ?? paymentMethodColorRole.other}
                  />
                ))}
              </Pie>
              <Tooltip content={<PaymentTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
