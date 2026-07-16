/**
 * Placeholder data for the owner/manager dashboard.
 *
 * TODO(F7 — Reports & Settings): the backend has no summary/reports
 * endpoint yet (see POSCountr-UI-Planning/poscountr-ui-page-inventory.md,
 * section D6 — flagged pending). Replace this module with a real
 * `dashboardService` call once that endpoint ships; the page component
 * itself will not need to change shape, only its data source.
 */
import type { BadgeTone } from '@/components';

export interface DashboardStat {
  label: string;
  value: string;
  trend?: string;
  tone: BadgeTone;
}

export const mockDashboardStats: DashboardStat[] = [
  { label: "Today's orders", value: '38', trend: '↑ 12% vs yesterday', tone: 'accent' },
  { label: 'Revenue today', value: '₹18,420', trend: '↑ 8% vs yesterday', tone: 'success' },
  { label: 'Active KDS tickets', value: '6', trend: '2 running late', tone: 'warning' },
  { label: 'Low stock items', value: '4', trend: 'Needs reorder', tone: 'danger' },
];

export interface MockRecentOrder {
  token: string;
  type: string;
  status: string;
  total: string;
  time: string;
}

export const mockRecentOrders: MockRecentOrder[] = [
  { token: '#042', type: 'Dine-in · T4', status: 'preparing', total: '₹460', time: '2 min ago' },
  { token: '#041', type: 'Takeaway', status: 'ready', total: '₹210', time: '6 min ago' },
  { token: '#040', type: 'Dine-in · T2', status: 'completed', total: '₹680', time: '14 min ago' },
  { token: '#039', type: 'Delivery', status: 'delivered', total: '₹350', time: '21 min ago' },
  { token: '#038', type: 'Dine-in · T1', status: 'cancelled', total: '₹0', time: '33 min ago' },
];

export interface MockLowStockItem {
  name: string;
  sku: string;
  level: string;
}

export const mockLowStockItems: MockLowStockItem[] = [
  { name: 'Filter Coffee Powder', sku: 'CFE-014', level: '3 left' },
  { name: 'Paneer Butter Masala', sku: 'RES-062', level: 'Out of stock' },
  { name: 'Milk (1L)', sku: 'DAI-003', level: '5 left' },
  { name: 'Disposable Cups', sku: 'PKG-021', level: '12 left' },
];
