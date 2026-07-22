import { z } from 'zod';

import { PIN_LENGTH } from '@/modules/auth';

// `changePasswordFormSchema`/`ChangePasswordFormValues` moved to
// `modules/profile/validations/profile.validation.ts` — password change is
// now part of the tenant_admin's own account screen ("My Profile"), not
// this module's per-business invoice configuration.

function isAllSameDigit(value: string): boolean {
  return value.split('').every((digit) => digit === value[0]);
}

function isSequential(value: string): boolean {
  const digits = value.split('').map(Number);
  const ascending = digits.every((digit, index) => index === 0 || digit === digits[index - 1] + 1);
  const descending = digits.every((digit, index) => index === 0 || digit === digits[index - 1] - 1);
  return ascending || descending;
}

const pinShape = z
  .string()
  .length(PIN_LENGTH, `PIN must be exactly ${PIN_LENGTH} digits`)
  .regex(/^\d+$/, 'PIN must be numeric');

/** `newPin`'s strength policy mirrors `modules/auth/validations/auth.validation.ts`'s `pinSchema` (not imported directly — that file's schemas are internal to the auth module, not part of its public barrel). */
export const changePinFormSchema = z
  .object({
    currentPin: pinShape,
    newPin: pinShape
      .refine((value) => !isAllSameDigit(value), 'PIN cannot be all the same digit')
      .refine((value) => !isSequential(value), 'PIN cannot be sequential'),
    confirmPin: pinShape,
  })
  .refine((values) => values.newPin === values.confirmPin, {
    message: 'PINs do not match',
    path: ['confirmPin'],
  });

export type ChangePinFormValues = z.infer<typeof changePinFormSchema>;

/**
 * Mirrors the backend's `InvoiceSettingsService.update` guard — `{seq}`
 * must stay in `numberingFormat` or gap-less invoice numbering breaks (see
 * `apps/invoicing/services/settings_service.py`'s `_REQUIRED_PLACEHOLDER`).
 */
export const invoiceSettingsFormSchema = z.object({
  numberingPrefix: z.string().min(1, 'Enter a prefix').max(12, 'At most 12 characters'),
  numberingFormat: z
    .string()
    .min(1, 'Enter a numbering format')
    .max(40, 'At most 40 characters')
    .refine((value) => value.includes('{seq}'), 'Must include the {seq} placeholder'),
  headerNote: z.string().max(255, 'At most 255 characters'),
  footerNote: z.string(),
  showCustomerGstin: z.boolean(),
});

export type InvoiceSettingsFormValues = z.infer<typeof invoiceSettingsFormSchema>;
