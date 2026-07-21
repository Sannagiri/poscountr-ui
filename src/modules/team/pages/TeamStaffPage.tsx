import { PageHeader } from '@/components';

import { StaffPanel } from '../components/StaffPanel';

/**
 * Tenant Admin's "Staff" screen — split out of the original combined
 * `TeamPage` (Admins/Staff tabs) into its own sidebar entry and route. See
 * `TeamAdminsPage` for why these are two nav items instead of tabs on one
 * page. `tenant_admin`-only, same as before.
 */
export function TeamStaffPage() {
  return (
    <div>
      <PageHeader title="Staff" subtitle="Managers and kitchen staff on this account" />
      <StaffPanel />
    </div>
  );
}
