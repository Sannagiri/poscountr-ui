import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { Info } from 'lucide-react';

import { Button, Card, Input } from '@/components';
import { describeApiError } from '@/utils/errors';

import { LoginMarketingPanel } from '../components/LoginMarketingPanel';
import { PinPad } from '../components/PinPad';
import { useAuthStore } from '../hooks/useAuthStore';
import { authService } from '../services/authService';
import { tokenStorage } from '../services/tokenStorage';
import type { IdentifyResponse } from '../types/auth.types';
import type { IdentifyFormValues, PasswordLoginFormValues } from '../validations/auth.validation';
import {
  identifySchema,
  looksLikeEmail,
  passwordLoginSchema,
  pinSchema,
} from '../validations/auth.validation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';

type LoginStep = 'identify' | 'credential';

/**
 * Split layout — a brand/marketing panel on the left, the actual sign-in
 * form on the right, one consistent light surface throughout (no dark/light
 * mismatch). Two-step login (POSCountr-authentication-system.md §4): step 1
 * resolves who the user is and which credential type to render; step 2
 * collects the password (owner/ultra_admin) or 6-digit PIN (manager).
 *
 * Step 1 is a single "email or username" field rather than two separate
 * inputs — the backend tells owner/ultra_admin and staff apart by which
 * field is populated, and for owner/ultra_admin the username always mirrors
 * the email anyway (POSCountr-authentication-system.md §3), so there's
 * nothing for the person to choose between. `looksLikeEmail` decides which
 * one to send.
 */
export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);

  const [step, setStep] = useState<LoginStep>('identify');
  const [identifyResult, setIdentifyResult] = useState<IdentifyResponse | null>(null);
  const [identifyValues, setIdentifyValues] = useState<IdentifyFormValues | null>(null);
  const [pin, setPin] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register: registerIdentify,
    handleSubmit: handleIdentifySubmit,
    formState: { errors: identifyErrors },
  } = useForm<IdentifyFormValues>({ resolver: zodResolver(identifySchema) });

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    formState: { errors: passwordErrors },
  } = useForm<PasswordLoginFormValues>({ resolver: zodResolver(passwordLoginSchema) });

  const identifyMutation = useMutation({
    mutationFn: authService.identify,
    onSuccess: (result) => {
      setIdentifyResult(result);
      setStep('credential');
      setFormError(null);
    },
    onError: (error) => setFormError(describeApiError(error)),
  });

  const loginMutation = useMutation({
    mutationFn: authService.login,
    onSuccess: async (result) => {
      // Store the tokens first so the `me` call (and, on the forced-change
      // path, `change-pin`) go out authenticated — `setSession` below also
      // writes them, but the store update needs the resolved user first.
      tokenStorage.setTokens(result.accessToken, result.refreshToken);
      const user = await authService.me();
      setSession(result.accessToken, result.refreshToken, user);
      if (result.mustChangePin) {
        navigate('/change-pin', { state: { currentPin: pin } });
        return;
      }
      // Not a hardcoded '/dashboard' — ultra_admin's home is '/platform'.
      // '/' resolves through HomeRedirect, which picks the right one from
      // the just-set session (same role→home mapping RequireRole uses).
      navigate('/');
    },
    onError: (error) => setFormError(describeApiError(error)),
  });

  function onIdentifySubmit(values: IdentifyFormValues) {
    setFormError(null);
    setIdentifyValues(values);
    const isEmail = looksLikeEmail(values.identity);
    identifyMutation.mutate({
      client: 'web',
      email: isEmail ? values.identity : undefined,
      tenantSlug: isEmail ? undefined : values.tenantSlug || undefined,
      username: isEmail ? undefined : values.identity,
    });
  }

  function onPasswordSubmit(values: PasswordLoginFormValues) {
    if (!identifyValues) return;
    setFormError(null);
    loginMutation.mutate({
      client: 'web',
      email: identifyValues.identity,
      password: values.password,
    });
  }

  function onPinSubmit() {
    if (!identifyValues) return;
    const parsed = pinSchema.safeParse(pin);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Enter a valid PIN');
      return;
    }
    setFormError(null);
    loginMutation.mutate({
      client: 'web',
      tenantSlug: identifyValues.tenantSlug || undefined,
      username: identifyValues.identity,
      pin,
    });
  }

  function handleGoBack() {
    setStep('identify');
    setFormError(null);
    setPin('');
  }

  return (
    <div className="flex min-h-screen bg-white">
      <LoginMarketingPanel />

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-[380px]">
          <div className="mb-8 flex justify-center lg:hidden">
            <CompactLogo />
          </div>

          <Card className="p-7">
            {step === 'identify' ? (
              <form onSubmit={handleIdentifySubmit(onIdentifySubmit)}>
                <h1 className="font-display text-xl font-extrabold text-ink">Log in</h1>

                <div className="mt-3 flex items-start gap-2.5 rounded-control border border-accent/20 bg-accent/5 p-3">
                  <Info size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
                  <p className="text-sm leading-snug text-ink-soft">
                    Enter your email (owner/admin) or your username (staff).
                  </p>
                </div>

                <div className="mt-5 flex flex-col gap-4">
                  <Input
                    label="Email or username"
                    placeholder="you@business.com or ravi.manager"
                    className="h-10 text-[15px]"
                    {...registerIdentify('identity')}
                    errorMessage={identifyErrors.identity?.message}
                  />
                  <Input
                    label="Business (only for username login)"
                    placeholder="sri-lakshmi"
                    className="h-10 text-[15px]"
                    {...registerIdentify('tenantSlug')}
                    errorMessage={identifyErrors.tenantSlug?.message}
                  />
                </div>

                {formError ? <p className="mt-3 text-sm text-danger">{formError}</p> : null}

                <Button
                  type="submit"
                  size="lg"
                  className="mt-6 w-full"
                  isLoading={identifyMutation.isPending}
                >
                  Continue
                </Button>
              </form>
            ) : (
              <div>
                <h1 className="font-display text-xl font-extrabold text-ink">
                  Hi {identifyResult?.displayName}
                </h1>
                <p className="mt-1.5 text-sm text-ink-soft">
                  {identifyResult?.tenantName ??
                    (identifyResult?.authMethod === 'pin'
                      ? 'Enter your PIN'
                      : 'Enter your password')}
                </p>

                <div className="mt-6">
                  {identifyResult?.authMethod === 'pin' ? (
                    <>
                      <PinPad
                        variant="light"
                        value={pin}
                        onChange={setPin}
                        disabled={loginMutation.isPending}
                      />
                      {formError ? <p className="mt-3 text-sm text-danger">{formError}</p> : null}
                      <Button
                        size="lg"
                        className="mt-6 w-full"
                        onClick={onPinSubmit}
                        isLoading={loginMutation.isPending}
                        disabled={pin.length < 1}
                      >
                        Log in
                      </Button>
                    </>
                  ) : (
                    <form onSubmit={handlePasswordSubmit(onPasswordSubmit)}>
                      <Input
                        type="password"
                        label="Password"
                        placeholder="••••••••"
                        className="h-10 text-[15px]"
                        {...registerPassword('password')}
                        errorMessage={passwordErrors.password?.message ?? formError ?? undefined}
                      />
                      <Button
                        type="submit"
                        size="lg"
                        className="mt-6 w-full"
                        isLoading={loginMutation.isPending}
                      >
                        Log in
                      </Button>
                    </form>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleGoBack}
                  className="mt-5 w-full text-center text-sm text-ink-faint hover:text-ink-soft"
                >
                  Not you? Go back
                </button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function CompactLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="30" height="30" viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <rect width="100" height="100" rx="24" fill="#111830" />
        <path
          d="M66 22 L30 22 Q18 22 18 34 L18 68 Q18 76 28 76"
          stroke="#5DA0FF"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <rect x="31" y="36" width="34" height="7" rx="3.5" fill="white" opacity="0.88" />
        <circle cx="70" cy="76" r="13" fill="#FF6B2B" />
        <circle cx="70" cy="76" r="6" fill="white" />
      </svg>
      <span className="font-display text-base font-black tracking-tight text-ink">
        POS<span className="text-brand">C</span>
        <span className="text-ink-faint">ountr</span>
      </span>
    </div>
  );
}
