# businesses module

Tenant Admin's "Businesses & Locations" screen. See
`POSCountr-UI-Planning/poscountr-ui-page-inventory.md` section D2.

## Built (F3)

- **Businesses & Locations** (`/businesses`) — every business (operating
  entity) on the account as a card grid (mirrors the Platform Console's
  Tenants/License Plans pattern), create/edit, deactivate/activate.
  Locations are managed nested inside a business's card via a "N locations"
  button (`LocationsModal`) — create/edit/deactivate/activate, same shape
  `TenantAdminsModal` uses for a tenant's admins.
- GSTIN format validation client-side, mirroring the backend's
  `validate_gstin` (structure-only — 15 characters, no checksum
  verification, matching the backend's own depth).
- Reactive-only quota handling: a `warning` toast when a lenient-mode
  create/reactivate returns `meta.warning` (at/over `max_business_entities`/
  `max_locations` but allowed), a `danger` toast when a strict-mode create
  is blocked (422 `quota_exceeded`). No proactive "N of M used" banner — the
  backend has no tenant-facing endpoint exposing `QuotaService.
effective_limits`/`summary` yet (those are ultra_admin-only routes), so
  guessing at a limit here would mean showing a number the frontend has no
  honest way to know. Revisit once F7 (or a dedicated backend addition)
  exposes one.

## Folders

```txt
businesses/
  components/
    BusinessCardGrid/     # BusinessCard, BusinessCardGrid
    BusinessEditModal/    # create/edit form
    EntityTypePicker/     # icon-grid entity_type selector
    LocationFormModal/    # add/edit one location
    LocationsModal/       # one business's locations list + actions
  pages/            # BusinessesPage
  hooks/            # useBusinesses, useLocations (TanStack Query)
  services/         # businessesService.ts — all /tenant/businesses/ + /tenant/locations/ calls
  types/            # BusinessEntity, Location, EntityType
  constants/        # BUSINESSES_ROUTES, BUSINESSES_QUERY_KEYS, ENTITY_TYPE_OPTIONS
  validations/      # businessSchema, locationSchema (zod)
  index.ts
```

`EntityTypeIcon` (the icon-per-`entity_type` mapping itself) lives in
`src/components/EntityTypeIcon` — it's a domain-agnostic shared component
(nothing in `src/components` imports from `src/modules/*`), reused by
`EntityTypePicker` here and, later, F5's entity-type-aware product forms.
