/**
 * Retired — `TeamPage`'s combined Admins/Staff tabs were split into two
 * separate sidebar entries and routes, `TeamAdminsPage` (`/team/admins`) and
 * `TeamStaffPage` (`/team/staff`), so the Admins/Staff distinction is visible
 * in the sidebar itself rather than only after landing on the page. `/team`
 * now redirects to `/team/admins` (see `routes/router.tsx`). Kept as an
 * inert stub rather than deleted — same treatment `LocationFormModal` got
 * when its own job moved elsewhere (see `businesses/components/
 * LocationFormModal`) — since this file has no consumer left.
 */
export {};
