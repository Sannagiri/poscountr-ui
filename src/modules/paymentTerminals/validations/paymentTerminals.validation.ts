import { z } from 'zod';

/**
 * `apiSecret` is required on create (there's nothing to fall back to yet)
 * but optional on edit (blank = keep the existing encrypted value — see
 * `PaymentTerminalUpdateRequest`'s doc comment). Built as a function of
 * `isEditing` rather than one static schema, same "superRefine on a
 * discriminating field" shape `paymentDetailSchema` establishes for its own
 * `detailType` branch — the discriminator here is which mode the form is in,
 * not a form value.
 */
export function paymentTerminalSchema(isEditing: boolean) {
  return z
    .object({
      locationId: z.string().min(1, 'Select a location'),
      provider: z.enum(['razorpay', 'phonepe', 'paytm']),
      label: z.string().min(1, 'Enter a label'),
      mid: z.string().min(1, 'Enter the MID'),
      tid: z.string().optional().or(z.literal('')),
      deviceSerial: z.string().optional().or(z.literal('')),
      apiKey: z.string().min(1, 'Enter the API key'),
      apiSecret: z.string().optional().or(z.literal('')),
      webhookSecret: z.string().optional().or(z.literal('')),
    })
    .superRefine((values, ctx) => {
      if (!isEditing && !values.apiSecret) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['apiSecret'],
          message: 'Enter the API secret',
        });
      }
    });
}

export type PaymentTerminalFormValues = z.infer<ReturnType<typeof paymentTerminalSchema>>;
