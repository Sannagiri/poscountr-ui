import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { Button } from '@/components';

import { PinPad } from '../components/PinPad';
import { useAuthStore } from '../hooks/useAuthStore';
import { authService } from '../services/authService';
import { pinSchema } from '../validations/auth.validation';

import { ApiError } from '@/types/api';
import { useMutation } from '@tanstack/react-query';

interface ChangePinLocationState {
  currentPin?: string;
}

/**
 * Forced PIN change — shown when login returns `must_change_pin` (default
 * PIN `000000`, or after an owner-initiated reset). Changing the PIN
 * revokes every session on the backend (POSCountr-authentication-system.md
 * §6), including the one just created by login, so this page ends by
 * clearing the local session and sending the user back to log in with the
 * new PIN — never straight to the dashboard.
 */
export function ChangePinPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const clearSession = useAuthStore((state) => state.clearSession);
  const currentPin = (location.state as ChangePinLocationState | null)?.currentPin ?? '';

  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [stage, setStage] = useState<'enter' | 'confirm'>('enter');
  const [formError, setFormError] = useState<string | null>(null);

  const changePinMutation = useMutation({
    mutationFn: () => authService.changePin(currentPin, newPin),
    onSuccess: () => {
      clearSession();
      navigate('/login', { state: { message: 'PIN updated. Log in with your new PIN.' } });
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : 'Could not update your PIN.');
      setStage('enter');
      setNewPin('');
      setConfirmPin('');
    },
  });

  function handlePinComplete(value: string) {
    setFormError(null);
    if (stage === 'enter') {
      const parsed = pinSchema.safeParse(value);
      if (!parsed.success) {
        setFormError(parsed.error.issues[0]?.message ?? 'Enter a valid PIN');
        setNewPin('');
        return;
      }
      setNewPin(value);
      setStage('confirm');
      return;
    }

    setConfirmPin(value);
    if (value !== newPin) {
      setFormError('PINs do not match — try again.');
      setStage('enter');
      setNewPin('');
      setConfirmPin('');
      return;
    }
    changePinMutation.mutate();
  }

  const activeValue = stage === 'enter' ? newPin : confirmPin;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-navy-deep px-4">
      <div className="w-full max-w-[280px] rounded-card bg-navy-card p-6">
        <p className="mb-1 text-center font-display text-base font-extrabold text-white">
          Set a new PIN
        </p>
        <p className="mb-5 text-center text-xs text-white/40">
          {stage === 'enter' ? 'Choose a 6-digit PIN' : 'Enter it again to confirm'}
        </p>
        <PinPad
          value={activeValue}
          onChange={(value) => {
            if (value.length === 6) {
              handlePinComplete(value);
              return;
            }
            if (stage === 'enter') setNewPin(value);
            else setConfirmPin(value);
          }}
          disabled={changePinMutation.isPending}
        />
        {formError ? <p className="mt-3 text-center text-xs text-danger">{formError}</p> : null}
        <Button className="mt-4 w-full" isLoading={changePinMutation.isPending} disabled>
          {changePinMutation.isPending ? 'Saving…' : 'Enter all 6 digits to continue'}
        </Button>
      </div>
    </div>
  );
}
