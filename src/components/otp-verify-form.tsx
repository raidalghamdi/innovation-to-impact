'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Logo } from '@/components/logo';
import { AlertCircle, KeyRound } from 'lucide-react';

// src/components/otp-verify-form.tsx:1
// Shared OTP entry UI for both post-login verification (mode="login") and
// password reset (mode="reset"). Reads email (+ optional devOtp) from the
// query string set by the preceding step.
function OtpVerifyInner({ mode }: { mode: 'login' | 'reset' }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get('email') ?? '';
  const devOtp = params.get('devOtp') ?? '';

  const [code, setCode] = useState(devOtp);
  const [password, setPassword] = useState('');

  // Password is read once from sessionStorage (set by AuthForm right before
  // navigating here) and then cleared — it never touches the URL.
  useEffect(() => {
    if (mode !== 'login' || typeof window === 'undefined') return;
    const pw = window.sessionStorage.getItem('i2i_pending_pw') ?? '';
    setPassword(pw);
    window.sessionStorage.removeItem('i2i_pending_pw');
  }, [mode]);
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (devOtp) setCode(devOtp);
  }, [devOtp]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await fetch('/api/auth/login-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, code }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(mapError(data?.error, t));
          return;
        }
        if (data.needsRoleSelection) {
          router.push(('/select-role') as any);
        } else {
          router.push(('/dashboard') as any);
        }
        router.refresh();
      } else {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, code, newPassword }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(mapError(data?.error, t));
          return;
        }
        router.push(('/login') as any);
      }
    } catch (err: any) {
      setError(err?.message ?? t('loginFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <span className="mx-auto mb-2 text-brand-teal">
            <Logo className="h-14 w-14" />
          </span>
          <span className="mx-auto mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-brand-teal-light text-brand-teal">
            <KeyRound className="h-5 w-5" />
          </span>
          <CardTitle className="text-brand-teal">{t('otpTitle')}</CardTitle>
          <CardDescription>
            {t('otpSubtitle')} <span dir="ltr" className="font-medium text-foreground">{email}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="otp">{t('otpLabel')}</Label>
              <Input
                id="otp"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                required
                dir="ltr"
                className="text-center text-2xl tracking-[0.5em]"
                autoFocus
              />
            </div>

            {mode === 'reset' && (
              <div className="space-y-1.5">
                <Label htmlFor="newPassword">{t('newPassword')}</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  dir="ltr"
                  minLength={8}
                />
              </div>
            )}

            {devOtp && (
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">
                {t('devOtpNotice', { code: devOtp })}
              </div>
            )}

            <div role="alert" aria-live="polite" className="empty:hidden">
              {error && (
                <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t('pleaseWait') : mode === 'login' ? t('verifyAndSignIn') : t('resetPassword')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function mapError(code: string | undefined, t: (k: any, args?: any) => string): string {
  switch (code) {
    case 'expired':
      return t('otpExpired');
    case 'too_many_attempts':
      return t('otpTooManyAttempts');
    case 'mismatch':
      return t('otpMismatch');
    case 'not_found':
      return t('otpNotFound');
    default:
      return t('loginFailed');
  }
}

export function OtpVerifyForm({ mode }: { mode: 'login' | 'reset' }) {
  return (
    <Suspense fallback={null}>
      <OtpVerifyInner mode={mode} />
    </Suspense>
  );
}
