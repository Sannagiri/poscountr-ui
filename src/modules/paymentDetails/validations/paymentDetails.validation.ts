import { z } from 'zod';

/**
 * Client-side mirror of the backend's own service-side required-field rule
 * (see `apps/.../payment_detail_service.py` or wherever it's enforced,
 * curl-verified): a `bank` entry requires `bankName`+`accountNumber`+
 * `ifscCode`; a `upi` entry requires `upiId`. `PaymentDetailFormModal`'s
 * form — `detailType` drives which branch below actually fires, same
 * "superRefine on a discriminating field" shape `buildPurchaseLineSchema`
 * (purchasing) already establishes for its own batch-tracked gate.
 */
export const paymentDetailSchema = z
  .object({
    businessId: z.string().min(1, 'Select a business'),
    detailType: z.enum(['bank', 'upi']),
    label: z.string().min(1, 'Enter a label'),
    accountHolderName: z.string().optional().or(z.literal('')),
    bankName: z.string().optional().or(z.literal('')),
    accountNumber: z.string().optional().or(z.literal('')),
    ifscCode: z.string().optional().or(z.literal('')),
    branch: z.string().optional().or(z.literal('')),
    upiId: z.string().optional().or(z.literal('')),
    upiName: z.string().optional().or(z.literal('')),
  })
  .superRefine((values, ctx) => {
    if (values.detailType === 'bank') {
      if (!values.bankName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['bankName'],
          message: 'Required for a bank account',
        });
      }
      if (!values.accountNumber) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['accountNumber'],
          message: 'Required for a bank account',
        });
      }
      if (!values.ifscCode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ifscCode'],
          message: 'Required for a bank account',
        });
      }
    } else if (!values.upiId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['upiId'],
        message: 'Required for a UPI entry',
      });
    }
  });

export type PaymentDetailFormValues = z.infer<typeof paymentDetailSchema>;
