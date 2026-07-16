import { KeyRound } from 'lucide-react';

import { Button, CopyableText, Modal } from '@/components';

export interface StaffCredentialInfo {
  username: string;
  defaultPin: string;
}

export interface StaffCredentialModalProps {
  /** `null` closes the modal — a truthy value opens it with that staff member's credential. */
  credential: StaffCredentialInfo | null;
  onAcknowledge: () => void;
}

/**
 * The one-time "here's the credential you need to hand off" screen, shown
 * right after adding a staff member or resetting one's PIN — both actions
 * put the account back on the same default PIN
 * (`apps/accounts/constants.py`'s `DEFAULT_PIN_PLACEHOLDER`, "000000") with
 * `must_change_pin=True`. Modeled on `CreateBusinessModal`'s generated-
 * password reveal: a credential the admin actually has to go tell someone
 * doesn't belong in a toast that can be missed or auto-dismiss before it's
 * read — this requires an explicit "Got it" before it closes.
 */
export function StaffCredentialModal({ credential, onAcknowledge }: StaffCredentialModalProps) {
  return (
    <Modal
      open={credential !== null}
      onOpenChange={(open) => {
        if (!open) onAcknowledge();
      }}
      title="Staff account ready"
      hideHeader
      size="sm"
      footer={
        <Button className="w-full" onClick={onAcknowledge}>
          Got it
        </Button>
      }
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent-dark">
          <KeyRound size={24} />
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-display text-base font-bold text-ink">Staff account ready</p>
          <p className="text-xs text-ink-soft">
            Hand these to <span className="font-semibold">{credential?.username}</span> — they'll
            be asked to set a real PIN the moment they log in.
          </p>
        </div>
        <div className="flex w-full items-center justify-center gap-6 rounded-control border border-border bg-surface px-4 py-3">
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
              Username
            </span>
            <span className="text-sm font-bold text-ink">{credential?.username}</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
              PIN
            </span>
            {credential ? (
              <CopyableText
                value={credential.defaultPin}
                copiedMessage="PIN copied to clipboard"
                className="text-sm font-bold text-ink"
              />
            ) : null}
          </div>
        </div>
      </div>
    </Modal>
  );
}
