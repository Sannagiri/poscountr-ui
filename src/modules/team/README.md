# team module

Tenant Admin's "Team" screen (F4) — every `tenant_admin`, `manager`, and
`kitchen_staff` account under the tenant. See
`POSCountr-UI-Planning/poscountr-ui-page-inventory.md` section D3 and
`POSCountr-UI-Planning/progress/21_f4_team.md` for the confirmed UX
decisions and what was built.

## Structure

- `types/team.types.ts` — `TeamRole`, `TeamMember` (shared shape for both
  admins and staff — which fields are meaningful differs by `role`),
  `AddAdminRequest`, `StaffRole`, `AddStaffRequest`, `AssignLocationRequest`.
- `constants/team.constants.ts` — `TEAM_ROUTES`, `TEAM_QUERY_KEYS`,
  `STAFF_ROLE_OPTIONS`, `DEFAULT_STAFF_PIN`.
- `services/teamService.ts` — all calls to `/tenant/admins/` and
  `/tenant/staff/`, snake_case ↔ camelCase mapping.
- `validations/team.validation.ts` — `addAdminSchema`, `addStaffSchema`
  (a factory: `locationId` is required only when the tenant has 2+ active
  locations, mirroring `TeamService._resolve_staff_location`),
  `assignLocationSchema`.
- `hooks/useAdmins.ts`, `hooks/useStaff.ts` — TanStack Query wrappers.
- `components/AddAdminModal` — create a tenant_admin peer (no edit — the
  backend has no edit-admin endpoint).
- `components/AddStaffModal` — create a manager/kitchen_staff; the location
  field's requiredness is driven by how many active locations exist.
- `components/AssignLocationModal` — reassign an existing staff member's
  location.
- `components/StaffCredentialModal` — the confirmed "post-create reveal
  screen": shown after adding a staff member or resetting a PIN, since the
  default PIN needs to actually be handed to someone rather than risk being
  missed in a toast.
- `components/AdminsPanel`, `components/StaffPanel` — the two sections
  (confirmed as separate, table-based lists rather than one combined list or
  cards), now assembled into two separate pages/routes rather than tabs on
  one page (see "Post-F4 follow-up" below).
- `pages/TeamAdminsPage.tsx`, `pages/TeamStaffPage.tsx` — `/team/admins` and
  `/team/staff`, each just `PageHeader` + its panel. `pages/TeamPage.tsx`
  (the original combined tabs page) is retired to an inert stub — no
  consumer imports it anymore.

## Post-F4 follow-up: Admins/Staff split into separate nav items

Originally one `/team` page with `Tabs` (Admins, Staff). Split into two
sidebar entries and routes so the distinction is visible in the sidebar
itself, not just after landing on the page — `TEAM_ROUTES` now has
`admins`/`staff` instead of a single `team` path, and `/team` redirects to
`/team/admins` (`routes/router.tsx`) so old links/bookmarks still land
somewhere real. Both routes stay `tenant_admin`-only, same access as before
— a `manager` still has no team-management screen at all (unchanged).

## Confirmed F4 decisions

- **Team structure**: two separate sections (Admins, Staff), not one
  combined role-filtered list.
- **List style**: `DataTable` (matches Platform Admins), not the
  card-grid pattern used for Tenants/Businesses/License Plans — this is an
  account-management list, not a business entity.
- **Default PIN UX**: a dedicated post-create acknowledgment modal
  (`StaffCredentialModal`), not an inline hint + toast.
- **Quota UX**: reactive-only (same as F3) — a warning toast on a
  lenient-mode near-cap add/reactivate, a normal error on a strict-mode
  `quota_exceeded` block. No proactive usage banner (the tenant-facing app
  has no honest data source for one).
