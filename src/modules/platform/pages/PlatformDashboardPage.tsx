import { useNavigate } from 'react-router-dom';

import { Button, Card, ErrorMessage, Loader, PageHeader } from '@/components';
import { cn } from '@/utils/cn';

import { PLATFORM_ROUTES } from '../constants/platform.constants';
import { useTenants } from '../hooks/useTenants';

import { ApiError } from '@/types/api';

/**
 * Ultra Admin's home (`HomeRedirect` sends `ultra_admin` here). Kept
 * intentionally small for this phase — a quick read of where the platform's
 * businesses stand, plus the one action asked for right now (creating one).
 * License types / platform admins / audit log stay as their own scheduled
 * screens (F2 continues from here).
 */
export function PlatformDashboardPage() {
  const navigate = useNavigate();
  const tenantsQuery = useTenants();

  if (tenantsQuery.isLoading) {
    return <Loader label="Loading platform overview…" />;
  }

  if (tenantsQuery.isError) {
    return (
      <ErrorMessage
        message={
          tenantsQuery.error instanceof ApiError
            ? tenantsQuery.error.message
            : 'Could not load the platform overview.'
        }
        onRetry={() => tenantsQuery.refetch()}
      />
    );
  }

  const tenants = tenantsQuery.data ?? [];
  const counts = {
    total: tenants.length,
    active: tenants.filter((tenant) => tenant.status === 'active').length,
    trial: tenants.filter((tenant) => tenant.status === 'trial').length,
    suspended: tenants.filter((tenant) => tenant.status === 'suspended').length,
  };

  return (
    <div>
      <PageHeader
        title="Platform"
        subtitle="Overview across every business on POSCountr"
        actions={
          <Button onClick={() => navigate(PLATFORM_ROUTES.tenants)}>Manage businesses</Button>
        }
      />

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard label="Total businesses" value={counts.total} />
        <StatCard label="Active" value={counts.active} tone="success" />
        <StatCard label="Trial" value={counts.trial} tone="accent" />
        <StatCard label="Suspended" value={counts.suspended} tone="danger" />
      </div>

      <Card className="mt-3.5">
        <p className="text-sm text-ink-soft">
          Create a new business — this sets up the tenant and its first owner login together.
        </p>
        <Button className="mt-3" onClick={() => navigate(PLATFORM_ROUTES.tenants)}>
          Go to Businesses
        </Button>
      </Card>
    </div>
  );
}

const TONE_TEXT_CLASSES = {
  success: 'text-success',
  accent: 'text-accent',
  danger: 'text-danger',
} as const;

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: keyof typeof TONE_TEXT_CLASSES;
}) {
  return (
    <Card>
      <p className="text-xs font-medium text-ink-soft">{label}</p>
      <p
        className={cn(
          'mt-2 font-display text-2xl font-extrabold',
          tone ? TONE_TEXT_CLASSES[tone] : 'text-ink',
        )}
      >
        {value}
      </p>
    </Card>
  );
}
