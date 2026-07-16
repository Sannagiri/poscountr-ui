# platform module

Ultra Admin platform console. See
`POSCountr-UI-Planning/poscountr-ui-page-inventory.md` section C and
`POSCountr-UI-Planning/progress/04_platform_console.md` for the build
checkpoint.

## Built (F2, first pass)

- **Platform dashboard** (`/platform`) — tenant counts by status + a way in
  to Businesses.
- **Businesses** (`/platform/tenants`) — list every tenant, create a new one
  (which also creates its first tenant_admin login in the same call, per
  `POST /platform/tenants/`), suspend/activate.

## Still scaffolded (`ComingSoonPage`)

- `/platform/license-types` — license plan CRUD (the "Businesses" create
  form already reads plans via `GET /platform/license-types/` for its
  dropdown; managing plans themselves is a separate screen, not yet built).
- `/platform/admins` — additional ultra_admin accounts.
- `/platform/audit-log` — `AuditLog` read-only feed.

## Folders

```txt
platform/
  components/     # CreateBusinessModal
  pages/          # PlatformDashboardPage, TenantsPage
  hooks/          # useTenants, useLicenseTypes (TanStack Query)
  services/       # platformService.ts — all /platform/* calls
  types/          # Tenant, LicenseType, CreateTenantRequest
  constants/      # PLATFORM_ROUTES, PLATFORM_QUERY_KEYS
  validations/    # createTenantSchema (zod)
  index.ts
```
