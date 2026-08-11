import { PAYMENT_TERMINALS_QUERY_KEYS } from '../constants/paymentTerminals.constants';
import { paymentTerminalsService } from '../services/paymentTerminalsService';

import { useQuery } from '@tanstack/react-query';

/**
 * Terminals across every location, active or not (`PaymentTerminalsPage`'s
 * own Status filter narrows to active by default, its Location filter to one
 * location) — each row carries its own `locationId`/`locationName`, so one
 * unscoped fetch backs the whole page rather than a per-location query.
 * Pass `locationId` only for a caller that genuinely wants one location's
 * rows server-side filtered (`TerminalPaymentPanel` doesn't need this — it
 * only ever initiates a payment, it never lists terminals).
 */
export function usePaymentTerminals(locationId?: string) {
  return useQuery({
    queryKey: PAYMENT_TERMINALS_QUERY_KEYS.paymentTerminals(locationId),
    queryFn: () => paymentTerminalsService.listPaymentTerminals(locationId),
  });
}
