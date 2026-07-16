import type { DataTableColumn } from '@/components';
import { Badge, Button, Card, CardHeader, DataTable, PageHeader } from '@/components';
import { statusLabel, toneForStatus } from '@/utils/status';

import { useAuthStore } from '@/modules/auth';

import type { MockRecentOrder } from '../data/mockDashboardData';
import { mockDashboardStats, mockLowStockItems, mockRecentOrders } from '../data/mockDashboardData';

const orderColumns: DataTableColumn<MockRecentOrder>[] = [
  { key: 'token', header: 'Token', width: '1fr' },
  { key: 'type', header: 'Type', width: '1fr' },
  {
    key: 'status',
    header: 'Status',
    width: '130px',
    render: (row) => <Badge tone={toneForStatus(row.status)}>{statusLabel(row.status)}</Badge>,
  },
  { key: 'total', header: 'Total', width: '100px', align: 'right' },
  { key: 'time', header: 'Time', width: '90px', align: 'right' },
];

/**
 * Owner/manager home screen. Data is mocked for now — see
 * `data/mockDashboardData.ts` for why — but every piece of UI (stat cards,
 * recent-orders table, low-stock panel) is the real component that F6/F7
 * will point at live data.
 */
export function DashboardPage() {
  const user = useAuthStore((state) => state.user);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={user?.tenantName ? `${user.tenantName} · today` : 'Today'}
        actions={
          <>
            <Button variant="secondary">Add product</Button>
            <Button variant="primary">New order</Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {mockDashboardStats.map((stat) => (
          <Card key={stat.label}>
            <p className="text-xs font-medium text-ink-soft">{stat.label}</p>
            <p className="mt-2 font-display text-2xl font-extrabold text-ink">{stat.value}</p>
            {stat.trend ? (
              <p className="mt-1">
                <Badge tone={stat.tone}>{stat.trend}</Badge>
              </p>
            ) : null}
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader title="Recent orders" action="View all" />
          <DataTable
            columns={orderColumns}
            data={mockRecentOrders}
            getRowKey={(row) => row.token}
            emptyTitle="No orders yet today"
          />
        </Card>
        <Card>
          <CardHeader title="Low stock alerts" action="View inventory" />
          <ul className="divide-y divide-border">
            {mockLowStockItems.map((item) => (
              <li key={item.sku} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <p className="font-medium text-ink">{item.name}</p>
                  <p className="text-xs text-ink-faint">SKU {item.sku}</p>
                </div>
                <Badge tone="danger">{item.level}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
