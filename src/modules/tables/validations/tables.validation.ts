import { z } from 'zod';

/**
 * A table's seat count — like the countable-unit product quantities
 * (`inventory.validation.ts`), a table seats a whole number of people, no
 * decimals.
 */
export const tableFormSchema = z.object({
  name: z.string().min(1, 'Enter a table name').max(16, 'At most 16 characters'),
  shape: z.enum(['round', 'square']),
  size: z.enum(['small', 'medium', 'large']),
  seats: z.coerce.number().int('Whole numbers only').min(1, 'At least 1 seat'),
});

export type TableFormValues = z.infer<typeof tableFormSchema>;
