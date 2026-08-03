import { createBrowserRouter, Navigate } from 'react-router-dom';

import { ChangePinPage, LoginPage } from '@/modules/auth';
import { KitchenPage, NewOrderPage, OrderDetailPage, OrdersPage } from '@/modules/billing';
import { BusinessesPage, LocationsPage } from '@/modules/businesses';
import { DashboardPage } from '@/modules/dashboard';
import {
  LayoutEditorPage,
  LayoutListPage,
  ThermalLayoutEditorPage,
} from '@/modules/documentLayouts';
import { ProductsPage } from '@/modules/inventory';
import { NotificationsPage } from '@/modules/notifications';
import { PaymentDetailsPage } from '@/modules/paymentDetails';
import {
  AuditLogPage,
  LicenseTypesPage,
  PlatformAdminsPage,
  PlatformDashboardPage,
  TenantsPage,
} from '@/modules/platform';
import { ProfilePage } from '@/modules/profile';
import {
  NewPurchaseOrderPage,
  PurchaseOrderDetailPage,
  PurchaseOrdersPage,
  SuppliersPage,
} from '@/modules/purchasing';
import { NewQuotationPage, QuotationDetailPage, QuotationsPage } from '@/modules/quotations';
import {
  CompareReportsPage,
  GstReportsPage,
  PurchaseReportsPage,
  SalesReportsPage,
} from '@/modules/reports';
import { InvoiceSettingsPage, OrderSettingsPage, PurchaseSettingsPage } from '@/modules/settings';
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
 *
 * The old combined `/settings` screen (own account + per-business invoice
 * config on one page) was split in two: `/profile` ("My Profile" — identity,
 * password, plan & usage; `modules/profile`) and `/settings/invoices`
 * ("Settings" > "Invoices" in the sidebar; `modules/settings`), matching the
 * sidebar's own expandable "Settings" group (see `layouts/AppShell/
 * navConfig.tsx`) — more settings sections join as sibling routes here.
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
              { path: '/notifications', element: <NotificationsPage /> },
              { path: '/inventory', element: <ProductsPage /> },
              { path: '/orders', element: <OrdersPage /> },
              { path: '/orders/new', element: <NewOrderPage /> },
              { path: '/orders/:orderId', element: <OrderDetailPage /> },
              // Reachable by URL even where the sidebar hides them (a
              // restaurant/cafe business) — same "route stays open, only the
              // nav entry is gated" approach every other role-only screen
              // already takes; there's no per-business route guard anywhere
              // in this router today to extend instead of introducing a new
              // kind of guard just for this.
              { path: '/suppliers', element: <SuppliersPage /> },
              { path: '/purchase-orders', element: <PurchaseOrdersPage /> },
              { path: '/purchase-orders/new', element: <NewPurchaseOrderPage /> },
              { path: '/purchase-orders/:purchaseOrderId', element: <PurchaseOrderDetailPage /> },
              // Reachable by URL even where the sidebar hides them (a
              // restaurant/cafe business) — same "route stays open, only the
              // nav entry is gated" approach the purchasing routes above
              // already take.
              { path: '/quotations', element: <QuotationsPage /> },
              { path: '/quotations/new', element: <NewQuotationPage /> },
              { path: '/quotations/:quotationId', element: <QuotationDetailPage /> },
              { path: '/kitchen', element: <KitchenPage /> },
              // Old combined-tabs URL — redirect to the first (so far only)
              // report rather than 404 anyone with it bookmarked (same
              // "old combined URL" pattern as `/team`/`/settings` below).
              { path: '/reports', element: <Navigate to="/reports/sales" replace /> },
              { path: '/reports/sales', element: <SalesReportsPage /> },
              { path: '/reports/purchases', element: <PurchaseReportsPage /> },
              { path: '/reports/gst', element: <GstReportsPage /> },
              { path: '/reports/compare', element: <CompareReportsPage /> },
            ],
          },
          {
            element: <RequireRole roles={['tenant_admin']} />,
            children: [
              { path: '/businesses', element: <BusinessesPage /> },
              { path: '/locations', element: <LocationsPage /> },
              { path: '/payment-details', element: <PaymentDetailsPage /> },
              // One page for both create and edit (`id === 'new'` means
              // create) — see `LayoutEditorPage`'s own doc comment for why
              // this doesn't split into a dedicated `/layouts/new` route +
              // component the way `/purchase-orders/new` and `/quotations/new`
              // do (those are genuinely different UIs from their own detail
              // pages; the layout editor's create/edit forms are identical).
              { path: '/layouts', element: <LayoutListPage /> },
              // Thermal Bill's config shape is genuinely different from the
              // A4 doc types' (see `ThermalLayoutEditorPage`'s own doc
              // comment) — its own route/page rather than folded into
              // `LayoutEditorPage`. Registered before the `:id` wildcard
              // below only for readability; React Router already resolves
              // the literal `thermal` segment ahead of the dynamic one
              // regardless of declaration order.
              { path: '/layouts/thermal/:id', element: <ThermalLayoutEditorPage /> },
              { path: '/layouts/:id', element: <LayoutEditorPage /> },
              // Old combined-tabs URL — redirect rather than 404 for anyone
              // with it bookmarked (see `modules/team/README.md`).
              { path: '/team', element: <Navigate to="/team/admins" replace /> },
              { path: '/team/admins', element: <TeamAdminsPage /> },
              { path: '/team/staff', element: <TeamStaffPage /> },
              { path: '/profile', element: <ProfilePage /> },
              // Old combined-page URL — redirect to the first (so far only)
              // settings section rather than 404 anyone with it bookmarked
              // (same "old combined URL" pattern as `/team` above).
              { path: '/settings', element: <Navigate to="/settings/invoices" replace /> },
              { path: '/settings/invoices', element: <InvoiceSettingsPage /> },
              { path: '/settings/orders', element: <OrderSettingsPage /> },
              { path: '/settings/purchasing', element: <PurchaseSettingsPage /> },
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
