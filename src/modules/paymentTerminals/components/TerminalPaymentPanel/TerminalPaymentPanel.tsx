import { useEffect, useState } from 'react';
import { CreditCard } from 'lucide-react';

import { Button, Loader, useToast } from '@/components';
import { describeApiError } from '@/utils/errors';

import { paymentTerminalsService } from '../../services/paymentTerminalsService';
import type { PaymentIntent } from '../../types/paymentTerminals.types';

import { useMutation } from '@tanstack/react-query';

export interface TerminalPaymentPanelProps {
  orderId: string;
  amount: string;
  /**
   * The parent's own (already-fetched) order status, `=== 'completed'`. This
   * component deliberately doesn't poll the order itself — `paymentTerminals`
   * has no business depending on `@/modules/billing` (that would be
   * circular, since `NewOrderPage`/`OrderDetailPage` import this component
   * the other way) — the parent already has `useOrder` in scope and just
   * needs telling when to turn its own polling on/off, via `onInitiated`/
   * `onCancel` below.
   */
  isCompleted: boolean;
  /** Fires right after a payment is successfully pushed to the terminal — the parent should start polling its own order (`useOrder(orderId, { poll: true })`). */
  onInitiated: () => void;
  /** Fires once, when `isCompleted` turns true while a payment is outstanding. */
  onCompleted: () => void;
  /** "Enter manually instead" — stop waiting and tell the parent to stop polling too. Never cancels the gateway-side payment itself (there's no cancel endpoint). */
  onCancel: () => void;
}

/**
 * Self-contained "pay via terminal" flow, dropped into both `NewOrderPage`'s
 * and `OrderDetailPage`'s completion modals. There is no endpoint to fetch a
 * `PaymentIntent` by id — the only signal a client has that payment
 * succeeded is the order itself flipping to `completed`, which the parent
 * polls for and reports back via `isCompleted`.
 */
export function TerminalPaymentPanel({
  orderId,
  amount,
  isCompleted,
  onInitiated,
  onCompleted,
  onCancel,
}: TerminalPaymentPanelProps) {
  const { showToast } = useToast();
  const [intent, setIntent] = useState<PaymentIntent | null>(null);

  const initiateMutation = useMutation({
    mutationFn: () => paymentTerminalsService.initiatePayment(orderId),
    onSuccess: (result) => {
      setIntent(result);
      onInitiated();
    },
    onError: (error) => showToast({ tone: 'danger', message: describeApiError(error) }),
  });

  useEffect(() => {
    if (intent && isCompleted) onCompleted();
    // Only re-fire when an outstanding intent's completion state actually
    // changes — `onCompleted` itself isn't a dependency since the parent
    // passes a fresh closure every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent, isCompleted]);

  function handleCancel() {
    setIntent(null);
    onCancel();
  }

  if (!intent) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-control border border-dashed border-border py-6 text-center">
        <CreditCard size={24} className="text-brand" />
        <p className="text-sm text-ink-soft">
          Push ₹{amount} to this location&apos;s EDC/UPI machine — the order completes on its own
          once the payment is confirmed.
        </p>
        <Button isLoading={initiateMutation.isPending} onClick={() => initiateMutation.mutate()}>
          Pay via terminal
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-control border border-border py-6 text-center">
      {intent.displayPayload.upiQrImageUrl ? (
        <img
          src={intent.displayPayload.upiQrImageUrl}
          alt="Scan to pay"
          className="h-40 w-40 rounded-control border border-border object-contain"
        />
      ) : null}
      <Loader size="sm" />
      <p className="text-sm font-semibold text-ink">Waiting for payment confirmation…</p>
      <p className="text-xs text-ink-faint">Scan the QR or tap the card on the machine.</p>
      <Button variant="secondary" onClick={handleCancel}>
        Enter manually instead
      </Button>
    </div>
  );
}
