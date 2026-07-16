import { createBrowserRouter } from 'react-router-dom';

import { ComingSoonPage } from '@/components';

import { ChangePinPage, LoginPage } from '@/modules/auth';
import { BusinessesPage } from '@/modules/businesses';
import { DashboardPage } from '@/modules/dashboard';
import {
  AuditLogPage,
  LicenseTypesPage,
  PlatformAdminsPage,
  PlatformDashboardPage,
  TenantsPage,
} from '@/modules/platform';

import { RequireAuth } from './guards/RequireAuth';
import { RequireRole } from './guards/RequireRole';
import { HomeRedirect } from './HomeRedirect';
import { NotFoundPage } from './NotFoundPage';

import { AppShell } from '@/layouts/AppShell';

const OWNER_ROLES = ['tenant_admin', 'manager'] as const;

/**
 * Every route in the app. Placeholder module pages use `ComingSoonPage`
 * with the phase they're scheduled for (see
 * POSCountr-UI-Planning/poscountr-ui-execution-roadmap.md) so the full
 * navigation is real and clickable end-to-end even before F2–F7 build
 * the screens behind it.
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
              {
                path: '/inventory',
                element: <ComingSoonPage title="Inventory" phase="F5 — Inventory" />,
              },
              {
                path: '/orders',
                element: <ComingSoonPage title="Orders & KDS" phase="F6 — Billing" />,
              },
              {
                path: '/reports',
                element: <ComingSoonPage title="Reports" phase="F7 — Reports & Settings" />,
              },
            ],
          },
          {
            element: <RequireRole roles={['tenant_admin']} />,
            children: [
              { path: '/businesses', element: <BusinessesPage /> },
              { path: '/team', element: <ComingSoonPage title="Team" phase="F4 — Team" /> },
              {
                path: '/settings',
                element: <ComingSoonPage title="Settings" phase="F7 — Reports & Settings" />,
              },
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
