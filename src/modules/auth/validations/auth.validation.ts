import { z } from 'zod';

import { PIN_LENGTH } from '../constants/auth.constants';

/**
 * One text field carries both login styles — the backend distinguishes
 * them by which field is populated (`email` vs `username`), not by asking
 * the person which kind of account they have
 * (POSCountr-authentication-system.md §4): owner/ultra_admin `username`
 * always mirrors their `email` (§3), so there is nothing for the person to
 * choose between. The client-side rule is: contains "@" → email (owner
 * path, no business needed); otherwise → username (staff path, needs the
 * business/subdomain too).
 */
export function looksLikeEmail(value: string): boolean {
  return value.includes('@');
}

export const identifySchema = z
  .object({
    tenantSlug: z.string().optional().or(z.literal('')),
    identity: z.string().min(1, 'Enter your email or username'),
  })
  .refine((value) => looksLikeEmail(value.identity) || Boolean(value.tenantSlug), {
    message: 'Enter your business name for a username login',
    path: ['tenantSlug'],
  });

export type IdentifyFormValues = z.infer<typeof identifySchema>;

export const passwordLoginSchema = z.object({
  password: z.string().min(1, 'Enter your password'),
});

export type PasswordLoginFormValues = z.infer<typeof passwordLoginSchema>;

/**
 * Login-time PIN check — shape only (exactly 6 digits). The backend
 * intentionally issues the weak, all-same-digit `000000` as every new
 * manager's default PIN, specifically so they can log in with it once and
 * get redirected to ChangePinPage via `mustChangePin`. The stricter policy
 * below (not all-identical, not sequential) must not run here — it used to,
 * and rejected `000000` before the request even went out, so a manager
 * logging in with their untouched default PIN saw a client-side error and
 * could never reach the server response that would send them to change it.
 */
export const pinLoginValueSchema = z
  .string()
  .length(PIN_LENGTH, `PIN must be exactly ${PIN_LENGTH} digits`)
  .regex(/^\d+$/, 'PIN must be numeric');

export const pinLoginSchema = z.object({
  pin: pinLoginValueSchema,
});

export type PinLoginFormValues = z.infer<typeof pinLoginSchema>;

/**
 * PIN *choice* policy — mirrors the backend rule (exactly 6 digits, not
 * all-identical, not strictly sequential) so the user gets instant feedback
 * before the round-trip when picking a new PIN (ChangePinPage). Deliberately
 * separate from `pinLoginValueSchema` above: this policy governs what a
 * manager is allowed to *set* their PIN to, not what they're allowed to log
 * in with — the default `000000` has to pass login but must never be
 * re-chosen as the "new" PIN.
 */
export const pinSchema = z
  .string()
  .length(PIN_LENGTH, `PIN must be exactly ${PIN_LENGTH} digits`)
  .regex(/^\d+$/, 'PIN must be numeric')
  .refine((value) => !isAllSameDigit(value), 'PIN cannot be all the same digit')
  .refine((value) => !isSequential(value), 'PIN cannot be sequential');

function isAllSameDigit(value: string): boolean {
  return value.split('').every((digit) => digit === value[0]);
}

function isSequential(value: string): boolean {
  const digits = value.split('').map(Number);
  const ascending = digits.every((digit, index) => index === 0 || digit === digits[index - 1] + 1);
  const descending = digits.every((digit, index) => index === 0 || digit === digits[index - 1] - 1);
  return ascending || descending;
}
