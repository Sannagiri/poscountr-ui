import { PAYMENT_TERMINALS_QUERY_KEYS } from '../constants/paymentTerminals.constants';
import { paymentTerminalsService } from '../services/paymentTerminalsService';

import { useQuery } from '@tanstack/react-query';

/** One terminal's own detail read — `undefined`/`''` keeps the query disabled, same "no id yet" convention `usePaymentDetail` follows. */
export function usePaymentTerminal(paymentTerminalId: string | undefined) {
  return useQuery({
    queryKey: PAYMENT_TERMINALS_QUERY_KEYS.paymentTerminal(paymentTerminalId ?? ''),
    queryFn: () => paymentTerminalsService.getPaymentTerminal(paymentTerminalId as string),
    enabled: Boolean(paymentTerminalId),
  });
}
