import { useMemo, useState } from 'react';
import { Ban, CheckCircle2, KeyRound, MapPin, Pencil } from 'lucide-react';

import type { DataTableColumn, DataTableFilter, DataTableRowAction } from '@/components';
import { Badge, Button, Card, ConfirmDialog, DataTable, useToast } from '@/components';
import { describeApiError } from '@/utils/errors';
import { toneForStatus } from '@/utils/status';

import { useLocations } from '@/modules/businesses';

import { STAFF_ROLE_OPTIONS, TEAM_QUERY_KEYS } from '../../constants/team.constants';
import { useStaff } from '../../hooks/useStaff';
import { teamService } from '../../services/teamService';
import type { TeamMember } from '../../types/team.types';
import type {
  AddStaffFormValues,
  AssignLocationFormValues,
  UpdateStaffFormValues,
} from '../../validations/team.validation';
import { AddStaffModal } from '../AddStaffModal';
import { AssignLocationModal } from '../AssignLocationModal';
import { EditStaffModal } from '../EditStaffModal';
import type { StaffCredentialInfo } from '../StaffCredentialModal';
import { StaffCredentialModal } from '../StaffCredentialModal';

import { useMutation, useQueryClient } from '@tanstack/react-query';

type PendingToggle = { member: TeamMember; kind: 'deactivate' | 'activate' } | null;

const STATUS_FILTER_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

function getStaffSearchValue(member: TeamMember): string {
  return [`${member.firstName} ${member.lastName}`.trim(), member.username]
    .filter(Boolean)
    .join(' ');
}

function roleLabel(role: TeamMember['role']): string {
  return STAFF_ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;
}

/**
 * Every manager + kitchen_staff on the tenant — same table pattern as
 * `AdminsPanel`, with staff-specific columns (role, assigned location, PIN
 * state) and actions (edit, reset PIN, (re)assign location) neither admins
 * nor `PlatformAdminsPage` need. Edit, Reset PIN, and Assign location all
 * operate on one row at a time via a `member`-holding piece of state,
 * mirroring how `TenantAdminsModal`/`LocationsModal` already key an
 * "acting on this one" modal off a nullable selection instead of a boolean.
 * Edit folds role/username/name *and* location into one form
 * (`EditStaffModal`) — Assign location stays as its own quicker one-field
 * action too, for a plain reassignment that doesn't need the full form.
 * Clicking anywhere on a row (`onRowClick`) opens the same Edit modal as
 * its "Edit" action — Edit is the obvious "do something with this row"
 * default here, unlike a row that navigates somewhere on click, so the
 * whole row is a shortcut to it rather than a hidden dead click.
 *
 * Activate is proactively disabled (with a `disabledReason` tooltip) when
 * this row's username has since been taken by another active staff member —
 * `activeUsernames` mirrors the backend's own reactivation collision guard
 * client-side, so that's caught before the confirm dialog even opens rather
 * than after a failed 422. The fix is the same Edit action right above it.
 */
export function StaffPanel() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const staffQuery = useStaff();
  const locationsQuery = useLocations();

  const [addOpen, setAddOpen] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [pendingToggle, setPendingToggle] = useState<PendingToggle>(null);
  const [pendingResetPin, setPendingResetPin] = useState<TeamMember | null>(null);
  const [assigningMember, setAssigningMember] = useState<TeamMember | null | undefined>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<TeamMember | null | undefined>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [credential, setCredential] = useState<StaffCredentialInfo | null>(null);

  const addMutation = useMutation({
    mutationFn: (values: AddStaffFormValues) =>
      teamService.addStaff({
        role: values.role,
        username: values.username,
        firstName: values.firstName || undefined,
        lastName: values.lastName || undefined,
        locationId: values.locationId || undefined,
      }),
    onSuccess: ({ member, defaultPin, warning }) => {
      queryClient.invalidateQueries({ queryKey: TEAM_QUERY_KEYS.staff });
      setAddOpen(false);
      setAddError(null);
      if (warning) showToast({ tone: 'warning', message: warning });
      setCredential({ username: member.username, defaultPin });
    },
    onError: (error) => setAddError(describeApiError(error)),
  });

  const toggleMutation = useMutation({
    mutationFn: async (action: NonNullable<PendingToggle>): Promise<string | null> => {
      if (action.kind === 'deactivate') {
        await teamService.deactivateStaff(action.member.id);
        return null;
      }
      const result = await teamService.activateStaff(action.member.id);
      return result.warning;
    },
    onSuccess: (warning) => {
      queryClient.invalidateQueries({ queryKey: TEAM_QUERY_KEYS.staff });
      setPendingToggle(null);
      if (warning) showToast({ tone: 'warning', message: warning });
    },
    onError: (error) => {
      showToast({ tone: 'danger', message: describeApiError(error) });
      setPendingToggle(null);
    },
  });

  const resetPinMutation = useMutation({
    mutationFn: (member: TeamMember) => teamService.resetStaffPin(member.id),
    onSuccess: ({ member, defaultPin }) => {
      queryClient.invalidateQueries({ queryKey: TEAM_QUERY_KEYS.staff });
      setPendingResetPin(null);
      setCredential({ username: member.username, defaultPin });
    },
    onError: (error) => {
      showToast({ tone: 'danger', message: describeApiError(error) });
      setPendingResetPin(null);
    },
  });

  const assignMutation = useMutation({
    mutationFn: (values: AssignLocationFormValues) => {
      if (!assigningMember) throw new Error('No staff member selected');
      return teamService.assignStaffLocation(assigningMember.id, values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEAM_QUERY_KEYS.staff });
      setAssigningMember(null);
      setAssignError(null);
    },
    onError: (error) => setAssignError(describeApiError(error)),
  });

  const editMutation = useMutation({
    mutationFn: (values: UpdateStaffFormValues) => {
      if (!editingMember) throw new Error('No staff member selected');
      return teamService.updateStaff(editingMember.id, {
        role: values.role,
        username: values.username,
        firstName: values.firstName || undefined,
        lastName: values.lastName || undefined,
        locationId: values.locationId || undefined,
      });
    },
    onSuccess: ({ warning }) => {
      queryClient.invalidateQueries({ queryKey: TEAM_QUERY_KEYS.staff });
      setEditingMember(null);
      setEditError(null);
      if (warning) showToast({ tone: 'warning', message: warning });
    },
    onError: (error) => setEditError(describeApiError(error)),
  });

  const columns: DataTableColumn<TeamMember>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Name',
        width: '1.4fr',
        render: (row) => `${row.firstName} ${row.lastName}`.trim() || row.username,
      },
      { key: 'username', header: 'Username', width: '1.2fr' },
      {
        key: 'role',
        header: 'Role',
        width: '130px',
        render: (row) => <Badge tone="accent">{roleLabel(row.role)}</Badge>,
      },
      {
        key: 'location',
        header: 'Location',
        width: '1.4fr',
        render: (row) => row.assignedLocationName ?? '—',
      },
      {
        key: 'isActive',
        header: 'Status',
        width: '100px',
        render: (row) => (
          <Badge tone={toneForStatus(row.isActive ? 'active' : 'inactive')}>
            {row.isActive ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
      {
        key: 'mustChangePin',
        header: 'PIN',
        width: '160px',
        render: (row) =>
          row.mustChangePin ? (
            <Badge tone="warning">Needs PIN change</Badge>
          ) : (
            <span className="text-ink-faint">Set</span>
          ),
      },
    ],
    [],
  );

  const filters: DataTableFilter<TeamMember>[] = useMemo(
    () => [
      { key: 'role', label: 'Role', options: STAFF_ROLE_OPTIONS },
      {
        key: 'isActive',
        label: 'Status',
        options: STATUS_FILTER_OPTIONS,
        getValue: (row) => (row.isActive ? 'active' : 'inactive'),
        // Opens on Active-only — a deactivated staff member is one deliberate
        // filter change away rather than mixed in with the everyday list.
        defaultValue: 'active',
      },
    ],
    [],
  );

  // Usernames currently held by an *active* staff member — the same scope
  // as the backend's own uniqueness check (`TeamService.add_staff`/
  // `update_staff`/`set_staff_active`). Used below to catch a reactivation
  // that would collide *before* the person even clicks Activate, rather
  // than letting the confirm dialog open and then bounce off a 422.
  const activeUsernames = useMemo(
    () => new Set((staffQuery.data ?? []).filter((member) => member.isActive).map((member) => member.username)),
    [staffQuery.data],
  );

  function openEditModal(row: TeamMember) {
    setEditError(null);
    setEditingMember(row);
  }

  const rowActions: DataTableRowAction<TeamMember>[] = useMemo(
    () => [
      {
        label: 'Edit',
        icon: Pencil,
        onSelect: openEditModal,
      },
      {
        label: 'Reset PIN',
        icon: KeyRound,
        onSelect: (row) => setPendingResetPin(row),
      },
      {
        label: 'Assign location',
        icon: MapPin,
        onSelect: (row) => {
          setAssignError(null);
          setAssigningMember(row);
        },
      },
      {
        label: 'Deactivate',
        icon: Ban,
        destructive: true,
        disabled: (row) => !row.isActive,
        onSelect: (row) => setPendingToggle({ member: row, kind: 'deactivate' }),
      },
      {
        label: 'Activate',
        icon: CheckCircle2,
        // A deactivated member whose username has since been handed to
        // someone else (see `TeamService.add_staff`'s "usernames free up on
        // deactivation" rule) can't reactivate until that's resolved — the
        // backend would reject it anyway (`set_staff_active`'s collision
        // guard); catching it here means Activate is visibly blocked
        // instead of quietly opening a confirm dialog that's going to fail.
        disabled: (row) => row.isActive || activeUsernames.has(row.username),
        disabledReason: (row) =>
          !row.isActive && activeUsernames.has(row.username)
            ? `"${row.username}" is now used by another active staff member — edit this person's username first.`
            : undefined,
        onSelect: (row) => setPendingToggle({ member: row, kind: 'activate' }),
      },
    ],
    [activeUsernames],
  );

  return (
    <div>
      <Card>
        <DataTable
          columns={columns}
          data={staffQuery.data ?? []}
          getRowKey={(row) => row.id}
          isLoading={staffQuery.isLoading}
          errorMessage={staffQuery.isError ? describeApiError(staffQuery.error) : null}
          onRetry={() => staffQuery.refetch()}
          emptyTitle="No staff yet"
          emptyDescription="Add a manager or staff member to get started."
          getSearchValue={getStaffSearchValue}
          searchPlaceholder="Search staff…"
          onRowClick={openEditModal}
          filters={filters}
          toolbarTrailing={
            <Button
              onClick={() => {
                setAddError(null);
                setAddOpen(true);
              }}
            >
              Add staff
            </Button>
          }
          rowActions={() => rowActions}
        />
      </Card>

      <AddStaffModal
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) setAddError(null);
        }}
        onSubmit={async (values) => {
          await addMutation.mutateAsync(values);
        }}
        isSubmitting={addMutation.isPending}
        submitError={addError}
      />

      <AssignLocationModal
        member={assigningMember}
        locations={locationsQuery.data ?? []}
        onOpenChange={(open) => {
          if (!open) {
            setAssigningMember(null);
            setAssignError(null);
          }
        }}
        onSubmit={async (values) => {
          await assignMutation.mutateAsync(values);
        }}
        isSubmitting={assignMutation.isPending}
        submitError={assignError}
      />

      <EditStaffModal
        member={editingMember}
        onOpenChange={(open) => {
          if (!open) {
            setEditingMember(null);
            setEditError(null);
          }
        }}
        onSubmit={async (values) => {
          await editMutation.mutateAsync(values);
        }}
        isSubmitting={editMutation.isPending}
        submitError={editError}
      />

      <ConfirmDialog
        open={pendingToggle !== null}
        title={
          pendingToggle?.kind === 'deactivate'
            ? 'Deactivate this staff member?'
            : 'Activate this staff member?'
        }
        description={
          pendingToggle?.kind === 'deactivate'
            ? `${pendingToggle.member.username} immediately loses access to the PIN pad.`
            : pendingToggle
              ? `${pendingToggle.member.username} regains access immediately.`
              : undefined
        }
        confirmText={pendingToggle?.kind === 'deactivate' ? 'Deactivate' : 'Activate'}
        isDestructive={pendingToggle?.kind === 'deactivate'}
        isLoading={toggleMutation.isPending}
        onConfirm={() => pendingToggle && toggleMutation.mutate(pendingToggle)}
        onCancel={() => setPendingToggle(null)}
      />

      <ConfirmDialog
        open={pendingResetPin !== null}
        title="Reset this PIN?"
        description={`${pendingResetPin?.username ?? 'This staff member'} is signed out everywhere and must set a new PIN on next login.`}
        confirmText="Reset PIN"
        isDestructive={false}
        variant="warning"
        isLoading={resetPinMutation.isPending}
        onConfirm={() => pendingResetPin && resetPinMutation.mutate(pendingResetPin)}
        onCancel={() => setPendingResetPin(null)}
      />

      <StaffCredentialModal credential={credential} onAcknowledge={() => setCredential(null)} />
    </div>
  );
}
