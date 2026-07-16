import { z } from 'zod';

/**
 * Client-side mirror of `TenantCreateInputSerializer` — instant feedback
 * before the round-trip, the server remains the source of truth (e.g. slug
 * uniqueness can only be checked server-side).
 */
export const createTenantSchema = z.object({
  name: z.string().min(1, 'Enter a business name'),
  slug: z
    .string()
    .min(1, 'Enter a URL slug')
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Lowercase letters, numbers, and hyphens only'),
  licenseTypeId: z.string().optional().or(z.literal('')),
  adminEmail: z.string().min(1, "Enter the owner's email").email('Enter a valid email'),
  adminPassword: z.string().min(8, 'At least 8 characters'),
  adminFirstName: z.string().optional().or(z.literal('')),
  adminLastName: z.string().optional().or(z.literal('')),
});

export type CreateTenantFormValues = z.infer<typeof createTenantSchema>;

/**
 * Client-side mirror of `TenantUpdateInputSerializer` — no `slug` field,
 * matching the backend exactly (it's immutable and the serializer doesn't
 * accept it at all).
 */
export const updateTenantSchema = z.object({
  name: z.string().min(1, 'Enter a business name'),
  displayName: z.string().optional().or(z.literal('')),
  licenseTypeId: z.string().optional().or(z.literal('')),
  licenseValidFrom: z.string().optional().or(z.literal('')),
  licenseValidUntil: z.string().optional().or(z.literal('')),
  enforcementMode: z.enum(['lenient', 'strict']),
});

export type UpdateTenantFormValues = z.infer<typeof updateTenantSchema>;

/** Client-side mirror of `AdminAccountInputSerializer` — reused for both "add tenant admin" and "create platform admin". */
export const adminAccountSchema = z.object({
  email: z.string().min(1, 'Enter an email').email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
  firstName: z.string().optional().or(z.literal('')),
  lastName: z.string().optional().or(z.literal('')),
});

export type AdminAccountFormValues = z.infer<typeof adminAccountSchema>;

/**
 * Client-side mirror of `LicenseTypeInputSerializer`. Deliberately has no
 * `maxMonthlyTransactions` field — the backend model has that column but its
 * input serializer doesn't accept it, so a form field for it would silently
 * do nothing.
 */
export const licenseTypeSchema = z.object({
  name: z.string().min(1, 'Enter a plan name'),
  code: z
    .string()
    .min(1, 'Enter a code')
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Lowercase letters, numbers, and hyphens only'),
  description: z.string().optional().or(z.literal('')),
  price: z
    .string()
    .min(1, 'Enter a price')
    .regex(/^\d+(\.\d{1,2})?$/, 'A number like 49.99'),
  defaultEnforcementMode: z.enum(['lenient', 'strict']),
  isActive: z.boolean(),
  maxTenantAdmins: z.coerce.number().int().min(0, '0 or more'),
  maxManagers: z.coerce.number().int().min(0, '0 or more'),
  maxKitchenStaff: z.coerce.number().int().min(0, '0 or more'),
  maxBusinessEntities: z.coerce.number().int().min(0, '0 or more'),
  maxLocations: z.coerce.number().int().min(0, '0 or more'),
  maxProducts: z.coerce.number().int().min(0, '0 or more'),
});

export type LicenseTypeFormValues = z.infer<typeof licenseTypeSchema>;
