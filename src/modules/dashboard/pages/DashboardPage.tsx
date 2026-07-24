import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Medal } from 'lucide-react';

import type { BadgeTone } from '@/components';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorMessage,
  Loader,
  PageHeader,
  Tooltip,
} from '@/components';
import { cn } from '@/utils/cn';
import { dateIST } from '@/utils/date';
import { describeApiError } from '@/utils/errors';
import { statusLabel, toneForStatus } from '@/utils/status';

import { useAuthStore } from '@/modules/auth';
import type { Order } from '@/modules/billing';
import { BILLING_ROUTES, KDS_LATE_THRESHOLD_MINUTES, useOrders } from '@/modules/billing';
import type { Product, ProductStockRow, Unit } from '@/modules/inventory';
import { formatQuantity, INVENTORY_ROUTES, isStockRowLow, useProducts } from '@/modules/inventory';

/** A ticket is "on the kitchen board" in exactly these three statuses — mirrors the KDS's own scope (`KDSListView` only ever returns orders in this range) without needing a per-location `useKdsQueue()` call, which 400s for a tenant_admin with no single location to scope to. */
const ACTIVE_KDS_STATUSES: Order['status'][] = ['kot_fired', 'preparing', 'ready'];

/** How many rows each dashboard preview table shows — a taste of the full list, not the full list (see `BILLING_ROUTES.orders`/`INVENTORY_ROUTES.products` for that). */
const PREVIEW_ROW_COUNT = 5;

/** Top sellers only ever shows a podium — rank 1/2/3, medal-colored, not a longer list. */
const TOP_SELLERS_COUNT = 3;
const MEDAL_COLOR_CLASSES = ['text-amber-500', 'text-slate-400', 'text-amber-700'] as const;

/** Every IST calendar day from 6 days ago through today, oldest first — the x-axis of the average-order-value trend. */
const TREND_DAY_OFFSETS = [-6, -5, -4, -3, -2, -1, 0] as const;

const TREND_CHART_WIDTH = 280;
const TREND_CHART_HEIGHT = 64;
const TREND_CHART_Y_PADDING = 8;

interface TrendChartPoint {
  x: number;
  y: number;
}

/**
 * Catmull-Rom → cubic Bézier conversion — the standard way to draw a smooth
 * curve through a handful of points without pulling in a charting library.
 * Repeating the first/last point as their own neighbor (rather than
 * extrapolating past them) keeps the curve from overshooting past the
 * first/last data value, which a naive spline would do.
 */
function buildSmoothLinePath(points: TrendChartPoint[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return path;
}

/** Plot points (in SVG viewBox space), the smooth line through them, and that same line closed down to the baseline for the area fill beneath it. */
function buildTrendChartGeometry(trend: { average: number }[]): {
  points: TrendChartPoint[];
  linePath: string;
  areaPath: string;
} {
  const maxAverage = Math.max(...trend.map((day) => day.average), 1);
  const drawableHeight = TREND_CHART_HEIGHT - TREND_CHART_Y_PADDING * 2;
  const points: TrendChartPoint[] = trend.map((day, index) => ({
    x: trend.length > 1 ? (index / (trend.length - 1)) * TREND_CHART_WIDTH : 0,
    y: TREND_CHART_HEIGHT - TREND_CHART_Y_PADDING - (day.average / maxAverage) * drawableHeight,
  }));
  const linePath = buildSmoothLinePath(points);
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${TREND_CHART_HEIGHT} L ${points[0].x} ${TREND_CHART_HEIGHT} Z`
      : '';
  return { points, linePath, areaPath };
}

const ORDER_TYPE_SHORT_LABELS: Record<Order['orderType'], string> = {
  dine_in: 'Dine-in',
  takeaway: 'Takeaway',
  delivery: 'Delivery',
};

/** "3 min ago" / "2 hr ago" / "1 d ago" — relative to now, for the recent-orders preview. */
function formatRelativeTime(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

function orderTypeLabel(order: Order): string {
  const base = ORDER_TYPE_SHORT_LABELS[order.orderType];
  return order.tableNumber ? `${base} · ${order.tableNumber}` : base;
}

/** Percentage change label vs `previous` — `null` when there's nothing to compare against (no orders/revenue at all yesterday), matching the dashboard's original "↑ 12% vs yesterday" copy but computed from real numbers. */
function percentTrend(
  current: number,
  previous: number,
): { label: string; tone: BadgeTone } | null {
  if (previous <= 0) return current > 0 ? { label: 'New today', tone: 'accent' } : null;
  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) return { label: 'Flat vs yesterday', tone: 'neutral' };
  const arrow = change > 0 ? '↑' : '↓';
  return {
    label: `${arrow} ${Math.abs(change)}% vs yesterday`,
    tone: change > 0 ? 'success' : 'danger',
  };
}

interface MiniColumn<TRow> {
  key: string;
  header: string;
  width: string;
  align?: 'right';
  /** Set false for a column whose `render` manages its own truncation internally (e.g. a two-line name+SKU stack) — the wrapper's own single-line `truncate` would otherwise fight that layout. Default true. */
  truncate?: boolean;
  render: (row: TRow) => ReactNode;
}

/**
 * A capped, content-sized preview table for the two dashboard "here's a
 * taste of the full list" cards (recent orders, low stock). Deliberately
 * NOT the shared `DataTable` — that component's row area is always sized by
 * `useFillRemainingHeight` (fills down to the viewport bottom), which is
 * exactly right for a full list page but wrong here: a 5-row preview would
 * end up with a huge blank scroll box below row 5. This sizes to its actual
 * content instead, and relies on the two preview cards sitting side by side
 * in a CSS Grid row (default `align-items: stretch`) to end up the same
 * height as each other with no extra height math needed.
 */
function MiniTable<TRow>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  emptyMessage,
  className,
}: {
  columns: MiniColumn<TRow>[];
  rows: TRow[];
  getRowKey: (row: TRow) => string;
  onRowClick?: (row: TRow) => void;
  emptyMessage: string;
  /** Merged onto the root wrapper — pass `flex-1` when the parent `Card` is `flex flex-col`, so this fills the card's stretched height (via flexbox's own sizing, not a percentage `height` that would need a definite ancestor height to resolve against). */
  className?: string;
}) {
  const gridTemplateColumns = columns.map((column) => column.width).join(' ');

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-control border border-border',
        className,
      )}
    >
      <div
        style={{ gridTemplateColumns }}
        className="grid items-center border-b border-border bg-surface"
      >
        {columns.map((column) => (
          <div
            key={column.key}
            className={cn(
              'min-w-0 truncate px-3 py-2.5 text-xs font-semibold text-ink-soft',
              column.align === 'right' && 'text-right',
            )}
          >
            {column.header}
          </div>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-6 text-xs text-ink-faint">
          {emptyMessage}
        </div>
      ) : (
        <div className="divide-y divide-border">
          {rows.map((row) => (
            <div
              key={getRowKey(row)}
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              style={{ gridTemplateColumns }}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={
                onRowClick
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
              className={cn(
                'grid items-center',
                onRowClick &&
                  'cursor-pointer hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/40',
              )}
            >
              {columns.map((column) => (
                <div
                  key={column.key}
                  className={cn(
                    'min-w-0 px-3 py-3 text-sm text-ink',
                    column.align === 'right' && 'text-right',
                    (column.truncate ?? true) && 'truncate',
                  )}
                >
                  {column.render(row)}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const recentOrderColumns: MiniColumn<Order>[] = [
  {
    key: 'token',
    header: 'Token',
    width: '1fr',
    render: (order) => (order.tokenNumber ? `#${order.tokenNumber}` : order.tableNumber || '—'),
  },
  { key: 'type', header: 'Type', width: '1fr', render: orderTypeLabel },
  {
    key: 'status',
    header: 'Status',
    width: '120px',
    render: (order) => (
      <Badge tone={toneForStatus(order.status)}>{statusLabel(order.status)}</Badge>
    ),
  },
  {
    key: 'total',
    header: 'Total',
    width: '90px',
    render: (order) => `₹${order.total}`,
  },
  {
    key: 'time',
    header: 'Time',
    width: '110px',
    render: (order) => formatRelativeTime(order.createdAt),
  },
];

/** One low-stock location line — a product can appear once per location that's running low, not just once overall, since business/location is exactly the extra context being added here. */
interface LowStockEntry {
  key: string;
  product: Product;
  stockRow: ProductStockRow;
}

const lowStockColumns: MiniColumn<LowStockEntry>[] = [
  {
    key: 'product',
    header: 'Product',
    width: 'minmax(150px, 1.3fr)',
    truncate: false,
    render: (entry) => (
      <span className="flex min-w-0 flex-col" title={entry.product.name}>
        <span className="truncate font-medium">{entry.product.name}</span>
        <span className="truncate text-xs text-ink-faint">SKU {entry.product.sku}</span>
      </span>
    ),
  },
  {
    key: 'business',
    header: 'Business',
    width: 'minmax(110px, 1fr)',
    render: (entry) => <span title={entry.product.businessName}>{entry.product.businessName}</span>,
  },
  {
    key: 'location',
    header: 'Location',
    width: 'minmax(110px, 1fr)',
    render: (entry) => (
      <span title={entry.stockRow.locationName}>{entry.stockRow.locationName}</span>
    ),
  },
  {
    key: 'stock',
    header: 'Stock',
    width: '80px',
    render: (entry) => formatQuantity(entry.stockRow.quantity, entry.product.unit),
  },
  {
    key: 'status',
    header: 'Status',
    width: '100px',
    render: (entry) =>
      Number(entry.stockRow.quantity) <= 0 ? (
        <Badge tone="danger">Out of stock</Badge>
      ) : (
        <Badge tone="warning">Low</Badge>
      ),
  },
];

/**
 * Owner/manager home screen. There's no dedicated `/reports/` summary
 * endpoint on the backend (flagged pending in
 * `POSCountr-UI-Planning/poscountr-ui-page-inventory.md`, section D6), so
 * every stat here is aggregated client-side from the same
 * `useOrders()`/`useProducts()` data `OrdersPage`/`ProductsPage` already
 * fetch and filter client-side — not a new backend surface, just composing
 * what already exists. A manager's `useOrders()`/`useProducts()` are
 * pre-scoped to their own location/business by the backend; a tenant_admin
 * sees everything, so these numbers are tenant-wide for them.
 */
export function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const ordersQuery = useOrders();
  const productsQuery = useProducts();

  const stats = useMemo(() => {
    const orders = ordersQuery.data ?? [];
    const products = productsQuery.data ?? [];

    const today = dateIST();
    const yesterday = dateIST(-1);
    const todaysOrders = orders.filter((order) => order.tokenDate === today);
    const yesterdaysOrders = orders.filter((order) => order.tokenDate === yesterday);

    const completedTodaysOrders = todaysOrders.filter((order) => order.status === 'completed');
    const completedYesterdaysOrders = yesterdaysOrders.filter(
      (order) => order.status === 'completed',
    );
    const revenueOf = (list: Order[]) => list.reduce((sum, order) => sum + Number(order.total), 0);
    const todaysRevenue = revenueOf(completedTodaysOrders);
    const yesterdaysRevenue = revenueOf(completedYesterdaysOrders);
    const averageOrderValue =
      completedTodaysOrders.length > 0 ? todaysRevenue / completedTodaysOrders.length : 0;

    // Same "average of completed orders" definition as `averageOrderValue`
    // above, just repeated once per day for the last week so the single
    // number reads as a trend instead of a floating figure with no context.
    const averageOrderValueTrend = TREND_DAY_OFFSETS.map((offsetDays) => {
      const date = dateIST(offsetDays);
      const completedThatDay = orders.filter(
        (order) => order.tokenDate === date && order.status === 'completed',
      );
      const totalThatDay = revenueOf(completedThatDay);
      return {
        date,
        weekdayLabel: new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
          weekday: 'short',
        }),
        isToday: offsetDays === 0,
        average: completedThatDay.length > 0 ? totalThatDay / completedThatDay.length : 0,
      };
    });

    const activeKdsOrders = orders.filter((order) => ACTIVE_KDS_STATUSES.includes(order.status));
    const lateKdsOrders = activeKdsOrders.filter(
      (order) =>
        order.kotFiredAt &&
        Date.now() - new Date(order.kotFiredAt).getTime() > KDS_LATE_THRESHOLD_MINUTES * 60_000,
    );

    const lowStockProducts = products.filter(
      (product) => product.isStockTracked && product.stock.some(isStockRowLow),
    );

    // Every low location for every low product, flattened — a product low
    // in two locations shows up as two rows, since business/location is the
    // whole point of this table, not just "this product is low somewhere."
    const lowStockEntries: LowStockEntry[] = lowStockProducts
      .flatMap((product) =>
        product.stock
          .filter(isStockRowLow)
          .map((stockRow) => ({ key: `${product.id}:${stockRow.locationId}`, product, stockRow })),
      )
      .sort((a, b) => Number(a.stockRow.quantity) - Number(b.stockRow.quantity));

    const orderTypeBreakdown: Record<Order['orderType'], number> = {
      dine_in: 0,
      takeaway: 0,
      delivery: 0,
    };
    for (const order of todaysOrders) orderTypeBreakdown[order.orderType] += 1;

    const unitByProductId = new Map(products.map((product) => [product.id, product.unit]));

    // Units sold today, by product — cancelled orders never rang up a real
    // sale, so they're excluded (everything else, including still-open
    // orders, counts what's actually gone out the door or is about to).
    const sellerTotals = new Map<string, { name: string; quantity: number; unit?: Unit }>();
    for (const order of todaysOrders) {
      if (order.status === 'cancelled') continue;
      for (const item of order.items) {
        const existing = sellerTotals.get(item.productId);
        const quantity = Number(item.quantity);
        if (existing) existing.quantity += quantity;
        else
          sellerTotals.set(item.productId, {
            name: item.name,
            quantity,
            unit: unitByProductId.get(item.productId),
          });
      }
    }
    const topSellers = Array.from(sellerTotals.values()).sort((a, b) => b.quantity - a.quantity);

    return {
      todaysOrderCount: todaysOrders.length,
      orderTrend: percentTrend(todaysOrders.length, yesterdaysOrders.length),
      todaysRevenue,
      revenueTrend: percentTrend(todaysRevenue, yesterdaysRevenue),
      averageOrderValue,
      averageOrderValueTrend,
      activeKdsCount: activeKdsOrders.length,
      lateKdsCount: lateKdsOrders.length,
      lowStockCount: lowStockProducts.length,
      lowStockEntries,
      orderTypeBreakdown,
      topSellers,
    };
  }, [ordersQuery.data, productsQuery.data]);

  // Backend already orders `/tenant/orders/` newest-first (`Order.Meta.ordering = ("-created_at",)`), so the first few are simply the most recent.
  const recentOrders = useMemo(
    () => (ordersQuery.data ?? []).slice(0, PREVIEW_ROW_COUNT),
    [ordersQuery.data],
  );
  const previewLowStockEntries = stats.lowStockEntries.slice(0, PREVIEW_ROW_COUNT);
  const previewTopSellers = stats.topSellers.slice(0, TOP_SELLERS_COUNT);
  const trendChart = useMemo(
    () => buildTrendChartGeometry(stats.averageOrderValueTrend),
    [stats.averageOrderValueTrend],
  );

  if (ordersQuery.isLoading || productsQuery.isLoading) {
    return <Loader label="Loading dashboard…" />;
  }

  if (ordersQuery.isError || productsQuery.isError) {
    return (
      <ErrorMessage
        message={describeApiError(ordersQuery.error ?? productsQuery.error)}
        onRetry={() => {
          if (ordersQuery.isError) ordersQuery.refetch();
          if (productsQuery.isError) productsQuery.refetch();
        }}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={user?.tenantName ? `${user.tenantName} · today` : 'Today'}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() =>
                navigate(INVENTORY_ROUTES.products, { state: { autoOpenCreate: true } })
              }
            >
              Add product
            </Button>
            <Button variant="primary" onClick={() => navigate(BILLING_ROUTES.newOrder)}>
              New order
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Card>
          <p className="text-xs font-medium text-ink-soft">Today&apos;s orders</p>
          <p className="mt-2 font-display text-2xl font-extrabold text-ink">
            {stats.todaysOrderCount}
          </p>
          {stats.orderTrend ? (
            <p className="mt-1">
              <Badge tone={stats.orderTrend.tone}>{stats.orderTrend.label}</Badge>
            </p>
          ) : null}
        </Card>
        <Card>
          <p className="text-xs font-medium text-ink-soft">Revenue today</p>
          <p className="mt-2 font-display text-2xl font-extrabold text-ink">
            ₹{stats.todaysRevenue.toLocaleString('en-IN')}
          </p>
          {stats.revenueTrend ? (
            <p className="mt-1">
              <Badge tone={stats.revenueTrend.tone}>{stats.revenueTrend.label}</Badge>
            </p>
          ) : null}
        </Card>
        <Card>
          <p className="text-xs font-medium text-ink-soft">Active KDS tickets</p>
          <p className="mt-2 font-display text-2xl font-extrabold text-ink">
            {stats.activeKdsCount}
          </p>
          <p className="mt-1">
            <Badge tone={stats.lateKdsCount > 0 ? 'warning' : 'accent'}>
              {stats.lateKdsCount > 0 ? `${stats.lateKdsCount} running late` : 'On track'}
            </Badge>
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-ink-soft">Low stock items</p>
          <p className="mt-2 font-display text-2xl font-extrabold text-ink">
            {stats.lowStockCount}
          </p>
          <p className="mt-1">
            <Badge tone={stats.lowStockCount > 0 ? 'danger' : 'success'}>
              {stats.lowStockCount > 0 ? 'Needs reorder' : 'All stocked'}
            </Badge>
          </p>
        </Card>
      </div>

      <div className="mb-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader
            title="Recent orders"
            action={
              <button type="button" onClick={() => navigate(BILLING_ROUTES.orders)}>
                View all
              </button>
            }
          />
          <MiniTable
            columns={recentOrderColumns}
            rows={recentOrders}
            getRowKey={(order) => order.id}
            onRowClick={(order) => navigate(BILLING_ROUTES.orderDetail(order.id))}
            emptyMessage="No orders yet today."
            className="flex-1"
          />
        </Card>
        <Card className="flex flex-col">
          <CardHeader
            title="Low stock alerts"
            action={
              <button type="button" onClick={() => navigate(INVENTORY_ROUTES.products)}>
                View inventory
              </button>
            }
          />
          <MiniTable
            columns={lowStockColumns}
            rows={previewLowStockEntries}
            getRowKey={(entry) => entry.key}
            emptyMessage="Everything's well stocked."
            className="flex-1"
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        <Card>
          <CardHeader title="Average order value" subtitle="Last 7 days, completed orders" />
          <p className="mb-3 font-display text-2xl font-extrabold text-ink">
            ₹
            {stats.averageOrderValue.toLocaleString('en-IN', {
              maximumFractionDigits: 0,
            })}
          </p>
          <div className="relative h-16 w-full">
            <svg
              viewBox={`0 0 ${TREND_CHART_WIDTH} ${TREND_CHART_HEIGHT}`}
              preserveAspectRatio="none"
              className="h-full w-full overflow-visible"
              aria-hidden="true"
            >
              <defs>
                {/* Mirrors tailwind.config.js's `accent.DEFAULT` (#1A5FD4) — gradients can't take a Tailwind class, so it's spelled out here instead. */}
                <linearGradient id="avgOrderValueTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1A5FD4" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#1A5FD4" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={trendChart.areaPath} fill="url(#avgOrderValueTrendFill)" />
              <path
                d={trendChart.linePath}
                fill="none"
                className="stroke-accent"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {trendChart.points.length > 0 ? (
                <circle
                  cx={trendChart.points[trendChart.points.length - 1].x}
                  cy={trendChart.points[trendChart.points.length - 1].y}
                  r="4"
                  className="fill-accent"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                />
              ) : null}
            </svg>
            <div className="absolute inset-0 flex">
              {stats.averageOrderValueTrend.map((day) => (
                <Tooltip
                  key={day.date}
                  content={`${day.isToday ? 'Today' : day.weekdayLabel} · ₹${Math.round(
                    day.average,
                  ).toLocaleString('en-IN')}`}
                >
                  <div className="h-full flex-1 cursor-default" />
                </Tooltip>
              ))}
            </div>
          </div>
          <div className="mt-1.5 flex">
            {stats.averageOrderValueTrend.map((day) => (
              <span
                key={day.date}
                className="flex-1 text-center text-[10px] font-medium text-ink-faint"
              >
                {day.weekdayLabel}
              </span>
            ))}
          </div>
        </Card>
        <Card className="flex flex-col">
          <CardHeader title="Orders by type" subtitle="Today" />
          <ul className="flex flex-1 flex-col justify-between">
            {(
              [
                ['dine_in', 'Dine-in'],
                ['takeaway', 'Takeaway'],
                ['delivery', 'Delivery'],
              ] as const
            ).map(([type, label]) => (
              <li
                key={type}
                className="flex items-center justify-between border-b border-border py-2.5 text-base last:border-none"
              >
                <span className="text-ink-soft">{label}</span>
                <span className="text-xl font-bold text-ink">{stats.orderTypeBreakdown[type]}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="flex flex-col">
          <CardHeader title="Top sellers" subtitle="By quantity, today" />
          {previewTopSellers.length === 0 ? (
            <p className="flex flex-1 items-center justify-center text-sm text-ink-faint">
              No items sold yet today.
            </p>
          ) : (
            <ol className="flex flex-1 flex-col justify-between">
              {previewTopSellers.map((seller, index) => (
                <li
                  key={seller.name}
                  className="flex items-center justify-between gap-2 border-b border-border py-2.5 text-base last:border-none"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Medal size={20} className={cn('shrink-0', MEDAL_COLOR_CLASSES[index])} />
                    <span className="truncate font-medium text-ink-soft">{seller.name}</span>
                  </span>
                  <span className="shrink-0 text-xl font-bold text-ink">
                    {formatQuantity(String(seller.quantity), seller.unit)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}
