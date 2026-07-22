import { Check, X } from 'lucide-react';

import type { UsernameAvailability } from '../../hooks/useStaffUsernameAvailability';

/**
 * The live message under a staff username field — shared by `AddStaffModal`
 * and `EditStaffModal` so the wording/styling can't drift between "add" and
 * "edit" for what is otherwise the exact same check
 * (`useStaffUsernameAvailability`). Renders nothing while `'idle'` (empty or
 * not yet a syntactically valid username) — the field's own format hint or
 * zod error message already covers that case.
 */
export function UsernameAvailabilityHint({ status }: { status: UsernameAvailability }) {
  if (status === 'idle') return null;
  return status === 'available' ? (
    <p className="flex items-center gap-1 text-xs text-success-text">
      <Check size={12} />
      Username available
    </p>
  ) : (
    <p className="flex items-center gap-1 text-xs text-danger">
      <X size={12} />
      Already used by an active staff member
    </p>
  );
}
