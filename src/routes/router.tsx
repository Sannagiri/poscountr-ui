import { createBrowserRouter, Navigate } from 'react-router-dom';

import { ChangePinPage, LoginPage } from '@/modules/auth';
import { KitchenPage, NewOrderPage, OrderDetailPage, OrdersPage } from '@/modules/billing';
import { BusinessesPage, LocationsPage } from '@/modules/businesses';
import { DashboardPage } from '@/modules/dashboard';
import { ProductsPage } from '@/modules/inventory';
import {
  AuditLogPage,
  LicenseTypesPage,
  PlatformAdminsPage,
  PlatformDashboardPage,
  TenantsPage,
} from '@/modules/platform';
import { ReportsPage } from '@/modules/reports';
import { SettingsPage } from '@/modules/settings';
import { TeamAdminsPage, TeamStaffPage } from '@/modules/team';

import { RequireAuth } from './guards/RequireAuth';
import { RequireRole } from './guards/RequireRole';
import { HomeRedirect } from './HomeRedirect';
import { NotFoundPage } from './NotFoundPage';

import { AppShell } from '@/layouts/AppShell';

const OWNER_ROLES = ['tenant_admin', 'manager'] as const;

/**
 * Every route in the app. F7 — Reports & Settings is now fully built (see
 * `modules/reports`/`modules/settings`); every other placeholder module
 * page still uses `ComingSoonPage` with the phase it's scheduled for (see
 * POSCountr-UI-Planning/poscountr-ui-execution-roadmap.md).
 */
export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <RequireAuth />,
    children: [
      { path: '/change-pin', element: <ChangePinPage /> },
      {
        element: <AppShell />,
        children: [
          { index: true, element: <HomeRedirect /> },
          {
            element: <RequireRole roles={[...OWNER_ROLES]} />,
            children: [
              { path: '/dashboard', element: <DashboardPage /> },
              { path: '/inventory', element: <ProductsPage /> },
              { path: '/orders', element: <OrdersPage /> },
              { path: '/orders/new', element: <NewOrderPage /> },
              { path: '/orders/:orderId', element: <OrderDetailPage /> },
              { path: '/kitchen', element: <KitchenPage /> },
              { path: '/reports', element: <ReportsPage /> },
            ],
          },
          {
            element: <RequireRole roles={['tenant_admin']} />,
            children: [
              { path: '/businesses', element: <BusinessesPage /> },
              { path: '/locations', element: <LocationsPage /> },
              // Old combined-tabs URL — redirect rather than 404 for anyone
              // with it bookmarked (see `modules/team/README.md`).
              { path: '/team', element: <Navigate to="/team/admins" replace /> },
              { path: '/team/admins', element: <TeamAdminsPage /> },
              { path: '/team/staff', element: <TeamStaffPage /> },
              { path: '/settings', element: <SettingsPage /> },
            ],
          },
          {
            path: '/platform',
            element: <RequireRole roles={['ultra_admin']} />,
            children: [
              { index: true, element: <PlatformDashboardPage /> },
              {
                path: 'license-types',
                element: <LicenseTypesPage />,
              },
              {
                // Tenant editing is a slide-over opened from a row click in
                // TenantsPage (see `TenantEditDrawer`), not a separate route
                // — a `/tenants/:tenantId` page + tabs was more structure
                // than the edit form actually needed.
                path: 'tenants',
                element: <TenantsPage />,
              },
              {
                path: 'admins',
                element: <PlatformAdminsPage />,
              },
              {
                path: 'audit-log',
                element: <AuditLogPage />,
              },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
