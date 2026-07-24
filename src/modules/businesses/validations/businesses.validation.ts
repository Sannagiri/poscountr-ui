import { z } from 'zod';

/**
 * Mirrors `apps/businesses/validators.py`'s `validate_gstin` — format-only
 * (2 state digits + 10-char PAN + 1 entity digit + 'Z' + 1 checksum char).
 * Checksum verification is a backend "future enhancement" per that file's
 * own docstring, so this client-side check deliberately doesn't attempt it
 * either — matching the server's actual validation depth, not exceeding it.
 */
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** Client-side mirror of `BusinessEntityInputSerializer` — instant feedback before the round-trip. */
export const businessSchema = z.object({
  name: z.string().min(1, 'Enter a business name'),
  entityType: z.enum(['restaurant', 'retail', 'pharmacy', 'grocery', 'cafe', 'other']),
  gstin: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (value) => !value || GSTIN_REGEX.test(value.toUpperCase()),
      'Invalid GSTIN format (expected a 15-character GSTIN)',
    ),
  phone: z.string().optional().or(z.literal('')),
  // Required before an invoice can ever be generated for this business (the
  // CGST/SGST vs IGST split needs it) — see `InvoiceService.generate_from_order`
  // — but still optional here, same as the backend's own `allow_blank=True`:
  // a business can exist a while before its GST registration is finalized.
  state: z.string().optional().or(z.literal('')),
});

export type BusinessFormValues = z.infer<typeof businessSchema>;

/** Mirrors `apps/businesses/validators.py`'s `validate_pincode` — 6 digits, first digit non-zero. */
const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

/** Client-side mirror of `LocationInputSerializer` — `businessId` is fixed at create time (never edited). */
export const locationSchema = z.object({
  businessId: z.string().min(1, 'Choose a business'),
  name: z.string().min(1, 'Enter a location name'),
  addressLine1: z.string().optional().or(z.literal('')),
  addressLine2: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
  pincode: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((value) => !value || PINCODE_REGEX.test(value), 'Invalid PIN code (expected 6 digits)'),
  phone: z.string().optional().or(z.literal('')),
});

export type LocationFormValues = z.infer<typeof locationSchema>;
