import { useMemo } from 'react';

import { STAFF_USERNAME_REGEX } from '../validations/team.validation';
import { useStaff } from './useStaff';

export type UsernameAvailability = 'idle' | 'available' | 'taken';

/**
 * Live "is this username free" check against the tenant's own staff list —
 * `useStaff` is the same query `StaffPanel` already has open, so this reuses
 * its cache rather than round-tripping to the server on every keystroke.
 * Scoped exactly like the backend (`TeamService.add_staff`/`update_staff`):
 * only an *active* staff member reserves a username, and `excludeUserId`
 * (the member being edited) is left out of its own collision check.
 *
 * Returns `'idle'` until the username is at least syntactically valid —
 * there's no point flagging "taken" or "available" on a username the format
 * validator is about to reject anyway, and it keeps this from fighting the
 * zod error message for the same field.
 */
export function useStaffUsernameAvailability(
  rawUsername: string,
  excludeUserId?: string,
): UsernameAvailability {
  const staffQuery = useStaff();

  return useMemo(() => {
    const username = rawUsername.trim().toLowerCase();
    if (!STAFF_USERNAME_REGEX.test(username)) return 'idle';
    const taken = (staffQuery.data ?? []).some(
      (member) => member.isActive && member.username === username && member.id !== excludeUserId,
    );
    return taken ? 'taken' : 'available';
  }, [rawUsername, staffQuery.data, excludeUserId]);
}
