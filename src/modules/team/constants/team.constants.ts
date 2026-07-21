/**
 * Route paths owned by the team module — imported by the router, never
 * hardcoded at call sites. Admins and Staff are two separate sidebar
 * entries/routes (not tabs on one `/team` page) — see `TeamAdminsPage`/
 * `TeamStaffPage`; `/team` itself redirects to `admins`.
 */
export const TEAM_ROUTES = {
  admins: '/team/admins',
  staff: '/team/staff',
} as const;

/** TanStack Query cache keys for this module — shared between hooks/pages so invalidation stays consistent. */
export const TEAM_QUERY_KEYS = {
  admins: ['team', 'admins'] as const,
  staff: ['team', 'staff'] as const,
};

/**
 * Mirrors the backend's `AddStaffInputSerializer.role` choices (manager/
 * kitchen_staff only — tenant_admins are added through the separate Admins
 * flow). Plain `{ value: string; label: string }[]`, not `as const` — this
 * feeds straight into `Select`'s `options` prop, which wants a mutable
 * array; the actual role values are still validated against the narrower
 * `StaffRole` union by `addStaffSchema`.
 */
export const STAFF_ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'manager', label: 'Manager' },
  { value: 'kitchen_staff', label: 'Staff' },
];

/** The PIN every new/reset staff account starts with (`apps/accounts/constants.py`'s `DEFAULT_PIN_PLACEHOLDER`) — must be changed on first login. */
export const DEFAULT_STAFF_PIN = '000000';
