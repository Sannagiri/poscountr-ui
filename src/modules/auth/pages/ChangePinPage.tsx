import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { Button, Card, useToast } from '@/components';

import { CompactLogo } from '../components/CompactLogo';
import { LoginMarketingPanel } from '../components/LoginMarketingPanel';
import { PinPad } from '../components/PinPad';
import { useAuthStore } from '../hooks/useAuthStore';
import { authService } from '../services/authService';
import { tokenStorage } from '../services/tokenStorage';
import { pinSchema } from '../validations/auth.validation';

import { ApiError } from '@/types/api';
import { useMutation } from '@tanstack/react-query';

interface ChangePinLocationState {
  currentPin?: string;
  username?: string;
  tenantSlug?: string;
}

/**
 * Forced PIN change — shown when login returns `must_change_pin` (default
 * PIN `000000`, or after an owner-initiated reset). Built on the same split
 * `LoginMarketingPanel` + `Card` layout as `LoginPage` instead of a bespoke
 * full-screen dark surface — every screen has to share one design language
 * (docs/coding-standards.md §13), and this one previously didn't.
 *
 * Changing the PIN revokes every session on the backend
 * (POSCountr-authentication-system.md §6), including the one just created by
 * login — the change-pin endpoint itself returns no new tokens, only a
 * success message. Rather than send the person back to the login screen to
 * type their username and new PIN a second time, this page logs back in
 * with the new PIN automatically (the same `authService.login` call
 * `LoginPage`'s PIN step makes) right after the change succeeds, then drops
 * them straight onto their dashboard with a confirmation toast.
 *
 * The change-pin call and the follow-up auto-login are deliberately two
 * separate steps, not one combined mutation — by the time `changePin`
 * resolves, the PIN really has been updated on the backend and the old
 * session is already revoked, so a failure in the *login* step (e.g. a
 * dropped `username`/`tenantSlug` if this page is ever reached without
 * router state) must not be reported as "changing your PIN failed" (which
 * would invite retrying `changePin` with a `current_pin` that's no longer
 * correct, hitting a 401 on the now-revoked session and forcing an
 * `onSessionExpired` redirect to `/login` with no explanation). Instead, a
 * failed auto-login still counts the PIN change as a success — it just
 * falls back to sending the person to `/login` to sign in normally with
 * the PIN they just set, with a clear toast saying so instead of a raw
 * "Validation failed".
 */
export function ChangePinPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);
  const { showToast } = useToast();
  const state = (location.state as ChangePinLocationState | null) ?? {};
  const currentPin = state.currentPin ?? '';

  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [stage, setStage] = useState<'enter' | 'confirm'>('enter');
  const [formError, setFormError] = useState<string | null>(null);

  const changePinMutation = useMutation({
    mutationFn: () => authService.changePin(currentPin, newPin),
    onSuccess: async () => {
      try {
        // The call above just revoked the session it rode in on — log back
        // in with the new PIN to get a fresh, valid one instead of bouncing
        // the person to the login screen to do it themselves.
        const result = await authService.login({
          client: 'web',
          // `|| undefined` (not just `state.tenantSlug`) so an accidental
          // empty string never reaches the backend — `tenant_slug` is a
          // required-non-blank field there once present at all, same
          // defensive normalization `LoginPage`'s own PIN-login call uses.
          tenantSlug: state.tenantSlug || undefined,
          username: state.username,
          pin: newPin,
        });
        tokenStorage.setTokens(result.accessToken, result.refreshToken);
        const user = await authService.me();
        setSession(result.accessToken, result.refreshToken, user);
        showToast({ tone: 'success', message: 'New PIN set for your account.' });
        // Not a hardcoded '/dashboard' — mirrors LoginPage's own post-login
        // redirect, since HomeRedirect resolves the right home from the
        // session `setSession` above just wrote.
        navigate('/');
      } catch {
        // PIN change itself succeeded — only the automatic sign-in
        // afterward didn't. Clear out the now-revoked local session instead
        // of leaving stale tokens around to trip a confusing 401 later, and
        // send the person to log in normally with the PIN they just set.
        clearSession();
        showToast({
          tone: 'success',
          message: 'PIN updated. Please log in with your new PIN.',
        });
        navigate('/login');
      }
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
    <div className="flex min-h-screen bg-white">
      <LoginMarketingPanel />

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-[380px]">
          <div className="mb-8 flex justify-center lg:hidden">
            <CompactLogo />
          </div>

          <Card className="p-7">
            <h1 className="font-display text-xl font-extrabold text-ink">
              First time here? Set your PIN.
            </h1>
            <p className="mt-1.5 text-sm text-ink-soft">
              {stage === 'enter'
                ? "Choose a 6-digit PIN and remember it — you'll use it to log in from now on."
                : 'Enter it again to confirm.'}
            </p>

            <div className="mt-6">
              <PinPad
                variant="light"
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
              {formError ? <p className="mt-3 text-sm text-danger">{formError}</p> : null}
              {changePinMutation.isPending ? (
                <Button size="lg" className="mt-6 w-full" isLoading disabled>
                  Signing you in…
                </Button>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => {
                clearSession();
                navigate('/login');
              }}
              disabled={changePinMutation.isPending}
              className="mt-5 w-full text-center text-sm text-ink-faint hover:text-ink-soft disabled:opacity-50"
            >
              Back to login
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
}
