# businesses module

Tenant Admin's "Businesses" screen. See
`POSCountr-UI-Planning/poscountr-ui-page-inventory.md` section D2.

## Built (F3)

- **Businesses** (`/businesses`) — every business (operating
  entity) on the account as a card grid (mirrors the Platform Console's
  Tenants/License Plans pattern), create/edit, deactivate/activate.
  Locations are managed nested inside a business's card via a "N locations"
  button (`LocationsModal`) — create/edit/deactivate/activate, same shape
  `TenantAdminsModal` uses for a tenant's admins. The add/edit form is a
  `view` this one `Modal` swaps to (list ↔ form), not a second stacked
  `Modal` — two independent Radix dialogs open at once used to render two
  overlays and made the list's own Edit/Deactivate/Activate menu look
  unreachable.
- GSTIN format validation client-side, mirroring the backend's
  `validate_gstin` (structure-only — 15 characters, no checksum
  verification, matching the backend's own depth).
- Reactive quota handling on create/reactivate is unchanged: a `warning`
  toast when a lenient-mode create/reactivate returns `meta.warning` (at/over
  `max_business_entities`/`max_locations` but allowed), a `danger` toast when
  a strict-mode create is blocked (422 `quota_exceeded`).

## Built (post-F4 follow-up)

- **License usage panel** (`LicenseUsageCard`, top of `/businesses`) — a
  proactive "N of M used" read for `business_entities`/`locations`, via a new
  tenant-facing endpoint (`GET /tenant/license/usage/`,
  `TenantLicenseUsageView` in `apps/businesses/views/license_usage.py`) that
  projects a narrow, tenant-safe slice of `QuotaService.effective_limits` —
  just the two resources this screen manages, not every resource a license
  caps (the fuller picture stays ultra_admin-only on the Platform Console).
  Fails soft: a loading/error state here doesn't block the rest of the page.
  Built on `UsageMeter` (`src/components/UsageMeter`), a generic label+bar
  component with no knowledge of licenses specifically, so a future fuller
  "My plan & usage" view (F7) can reuse it for other resources.
- **Locations** (`/locations`, `LocationsPage`) — every location across every
  business, in one flat table (name, business, staff count, status,
  actions), a companion to the per-business nested view already in
  `LocationsModal`. Add stays exclusively in the nested flow; Edit reuses
  `LocationsModal`'s form via a new `initialEditLocationId` prop (jumps
  straight to editing one location instead of opening its business's full
  list first) rather than a second copy of that form. Staff count comes from
  `@/modules/team`'s `useStaff`, grouped by `assignedLocationId` — imported
  by its concrete hook path, not the `@/modules/team` barrel, to avoid a
  circular import (that barrel's `StaffPanel` already imports `useLocations`
  from this module's own barrel).

## Folders

```txt
businesses/
  components/
    BusinessCardGrid/     # BusinessCard, BusinessCardGrid
    BusinessEditModal/    # create/edit form
    EntityTypePicker/     # icon-grid entity_type selector
    LicenseUsageCard/     # proactive business_entities/locations usage panel
    LocationFormModal/    # deprecated stub — form now lives inside LocationsModal
    LocationsModal/       # one business's locations list + actions + add/edit form (single Modal, two views); also opened in edit-only mode from LocationsPage
  pages/            # BusinessesPage, LocationsPage
  hooks/            # useBusinesses, useLocations, useLicenseUsage (TanStack Query)
  services/         # businessesService.ts — all /tenant/businesses/ + /tenant/locations/ + /tenant/license/usage/ calls
  types/            # BusinessEntity, Location, EntityType, LicenseUsage
  constants/        # BUSINESSES_ROUTES, BUSINESSES_QUERY_KEYS, ENTITY_TYPE_OPTIONS
  validations/      # businessSchema, locationSchema (zod)
  index.ts
```

`EntityTypeIcon` (the icon-per-`entity_type` mapping itself) lives in
`src/components/EntityTypeIcon` — it's a domain-agnostic shared component
(nothing in `src/components` imports from `src/modules/*`), reused by
`EntityTypePicker` here and, later, F5's entity-type-aware product forms.
