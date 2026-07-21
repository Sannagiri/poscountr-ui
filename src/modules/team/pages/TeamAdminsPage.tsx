import { PageHeader } from '@/components';

import { AdminsPanel } from '../components/AdminsPanel';

/**
 * Tenant Admin's "Admins" screen — split out of the original combined
 * `TeamPage` (Admins/Staff tabs) into its own sidebar entry and route.
 * Admins and staff have almost nothing in common beyond both being accounts
 * on the tenant (password vs. PIN auth, email vs. username, no location vs.
 * an assigned one), and splitting them into separate nav items — rather
 * than one "Team" entry with tabs underneath — makes that distinction
 * visible in the sidebar itself, not just after landing on the page.
 * `tenant_admin`-only, same as before; a `manager` still has no team-
 * management access at all (unchanged from the original `/team`).
 */
export function TeamAdminsPage() {
  return (
    <div>
      <PageHeader title="Admins" subtitle="Tenant admins on this account" />
      <AdminsPanel />
    </div>
  );
}
