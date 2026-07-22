import { z } from 'zod';

/** Client-side mirror of `AddAdminInputSerializer` — another tenant_admin, password auth. */
export const addAdminSchema = z.object({
  email: z.string().min(1, 'Enter an email').email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
  firstName: z.string().optional().or(z.literal('')),
  lastName: z.string().optional().or(z.literal('')),
});

export type AddAdminFormValues = z.infer<typeof addAdminSchema>;

/**
 * Mirrors `apps/accounts/validators.py`'s `validate_staff_username` exactly.
 * Exported so the live "is this username taken" check
 * (`useStaffUsernameAvailability`) only treats a syntactically-valid
 * username as checkable, instead of duplicating this pattern a second time.
 */
export const STAFF_USERNAME_REGEX = /^[a-z0-9][a-z0-9._-]{2,149}$/;

/**
 * Client-side mirror of `AddStaffInputSerializer`. `locationId` is optional
 * at the type level, but a schema built with `requireLocation: true` (the
 * caller passes this once it knows the tenant has 2+ active locations, per
 * `TeamService._resolve_staff_location`'s own rule) makes it required —
 * the "required only with 2+ locations" branch can't be a static rule here
 * since it depends on data (how many locations exist), not just the form's
 * own shape.
 */
export function addStaffSchema(requireLocation: boolean) {
  return z.object({
    role: z.enum(['manager', 'kitchen_staff']),
    username: z
      .string()
      .min(1, 'Enter a username')
      .regex(STAFF_USERNAME_REGEX, "3-150 characters: lowercase letters, digits, '.', '_' or '-'"),
    firstName: z.string().optional().or(z.literal('')),
    lastName: z.string().optional().or(z.literal('')),
    locationId: requireLocation
      ? z.string().min(1, 'Choose a location — this tenant has more than one')
      : z.string().optional().or(z.literal('')),
  });
}

export type AddStaffFormValues = z.infer<ReturnType<typeof addStaffSchema>>;

/**
 * Client-side mirror of `UpdateStaffInputSerializer` — same shape (and same
 * "required only with 2+ active locations" caveat) as `addStaffSchema`,
 * just for editing a staff member that already exists rather than creating
 * one.
 */
export function updateStaffSchema(requireLocation: boolean) {
  return z.object({
    role: z.enum(['manager', 'kitchen_staff']),
    username: z
      .string()
      .min(1, 'Enter a username')
      .regex(STAFF_USERNAME_REGEX, "3-150 characters: lowercase letters, digits, '.', '_' or '-'"),
    firstName: z.string().optional().or(z.literal('')),
    lastName: z.string().optional().or(z.literal('')),
    locationId: requireLocation
      ? z.string().min(1, 'Choose a location — this tenant has more than one')
      : z.string().optional().or(z.literal('')),
  });
}

export type UpdateStaffFormValues = z.infer<ReturnType<typeof updateStaffSchema>>;

export const assignLocationSchema = z.object({
  locationId: z.string().min(1, 'Choose a location'),
});

export type AssignLocationFormValues = z.infer<typeof assignLocationSchema>;
