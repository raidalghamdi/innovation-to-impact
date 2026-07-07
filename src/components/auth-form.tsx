'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Logo } from '@/components/logo';
import { SkipToContent } from '@/components/skip-to-content';
import { AlertCircle, ArrowLeft, Info } from 'lucide-react';
import { PASSWORD_POLICY, validatePassword, type PolicyIssue } from '@/lib/password-policy';
import { homeForRoleCode } from '@/lib/roles';

// src/components/auth-form.tsx:1
// Unified email-first auth flow (Phase 11.1). One entry point handles all
// four states surfaced by /api/auth/lookup:
//   • login    → email + existing password  (→ OTP → session)
//   • activate → email + choose a NEW password for the first time
//   • signup   → email + full profile + choose a password
//   • closed   → registration disabled — show contact-admin message
//
// The `mode` prop is kept for backwards compatibility with the old routes
// but is no longer meaningful — /signup is redirected to /login by
// middleware, so every user lands here regardless.
type FlowState =
  | { phase: 'email' }
  | { phase: 'login' }
  | { phase: 'activate' }
  | { phase: 'signup' }
  | { phase: 'closed' };

export function AuthForm({ mode: _mode }: { mode?: 'login' | 'signup' }) {
  const t = useTranslations('auth');
  const tc = useTranslations('categories');
  const locale = useLocale();
  const router = useRouter();

  const [flow, setFlow] = useState<FlowState>({ phase: 'email' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');
  const [category, setCategory] = useState('citizen');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<PolicyIssue[]>([]);

  function resetToEmailPhase() {
    setError(null);
    setIssues([]);
    setPassword('');
    setPasswordConfirm('');
    setFullName('');
    setDepartment('');
    setCategory('citizen');
    setFlow({ phase: 'email' });
  }

  // Phase 1 — user submits their email; the server decides the next screen.
  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIssues([]);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error === 'invalid_email' ? t('invalidEmail') : t('lookupFailed'));
        return;
      }
      if (data.state === 'login') setFlow({ phase: 'login' });
      else if (data.state === 'activate') setFlow({ phase: 'activate' });
      else if (data.state === 'signup') setFlow({ phase: 'signup' });
      else setFlow({ phase: 'closed' });
    } catch (err: any) {
      setError(err?.message ?? t('lookupFailed'));
    } finally {
      setLoading(false);
    }
  }

  // Shared helper — routes the user to /login/verify (or straight to
  // dashboard when OTP is disabled).
  async function proceedAfterAuth(data: any) {
    if (data.otpSkipped) {
      const verifyRes = await fetch('/api/auth/login-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        setError(t('loginFailed'));
        return;
      }
      const target = verifyData.needsRoleSelection
        ? '/select-role'
        : homeForRoleCode(verifyData.activeRole);
      router.push(target as any);
      router.refresh();
      return;
    }
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('i2i_pending_pw', password);
    }
    const qs = new URLSearchParams({ email });
    if (data.devOtp) qs.set('devOtp', data.devOtp);
    router.push((`/login/verify?${qs.toString()}`) as any);
  }

  // Phase 2a — existing account with a password: normal login.
  async function handleLoginPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error === 'invalid_credentials' ? t('invalidCredentials') : t('loginFailed'));
        return;
      }
      await proceedAfterAuth(data);
    } catch (err: any) {
      setError(err?.message ?? t('loginFailed'));
    } finally {
      setLoading(false);
    }
  }

  // Phase 2b — imported account activating for the first time.
  async function handleActivate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIssues([]);
    if (password !== passwordConfirm) {
      setError(t('passwordMismatch'));
      return;
    }
    const check = validatePassword(password);
    if (!check.ok) {
      setIssues(check.issues);
      setError(t('weakPassword'));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.error === 'weak_password') {
          setIssues(data.issues ?? []);
          setError(t('weakPassword'));
        } else if (data?.error === 'already_activated') {
          setError(t('alreadyActivated'));
        } else {
          setError(t('activationFailed'));
        }
        return;
      }
      await proceedAfterAuth(data);
    } catch (err: any) {
      setError(err?.message ?? t('activationFailed'));
    } finally {
      setLoading(false);
    }
  }

  // Phase 2c — brand-new external user registration.
  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIssues([]);
    if (password !== passwordConfirm) {
      setError(t('passwordMismatch'));
      return;
    }
    const check = validatePassword(password);
    if (!check.ok) {
      setIssues(check.issues);
      setError(t('weakPassword'));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName, department, category }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.error === 'weak_password') {
          setIssues(data.issues ?? []);
          setError(t('weakPassword'));
        } else if (data?.error === 'registration_closed') {
          setFlow({ phase: 'closed' });
        } else if (data?.error === 'already_registered') {
          setError(t('alreadyRegistered'));
        } else {
          setError(t('registrationFailed'));
        }
        return;
      }
      await proceedAfterAuth(data);
    } catch (err: any) {
      setError(err?.message ?? t('registrationFailed'));
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------
  const passwordIssueText = (i: PolicyIssue): string => {
    switch (i) {
      case 'too_short':
        return t('policyTooShort', { min: PASSWORD_POLICY.minLength });
      case 'no_uppercase':
        return t('policyNoUppercase');
      case 'no_lowercase':
        return t('policyNoLowercase');
      case 'no_digit':
        return t('policyNoDigit');
      case 'no_symbol':
        return t('policyNoSymbol');
    }
  };

  const passwordPolicyHint = (
    <ul className="mt-1 space-y-1 text-[11px] text-muted-foreground">
      <li className="flex items-start gap-1.5">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        <span>{t('policyHint', { min: PASSWORD_POLICY.minLength })}</span>
      </li>
    </ul>
  );

  const errorBlock = (
    <div role="alert" aria-live="polite" className="empty:hidden">
      {error && (
        <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          {issues.length > 0 && (
            <ul className="mt-2 list-inside list-disc ps-5 text-xs">
              {issues.map((i) => (
                <li key={i}>{passwordIssueText(i)}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );

  // Header messaging depends on phase.
  const header = {
    email: { title: t('welcomeTitle'), subtitle: t('welcomeSubtitle') },
    login: { title: t('loginTitle'), subtitle: t('loginSubtitle') },
    activate: { title: t('activateTitle'), subtitle: t('activateSubtitle') },
    signup: { title: t('signupTitle'), subtitle: t('signupSubtitle') },
    closed: { title: t('registrationClosedTitle'), subtitle: '' },
  }[flow.phase];

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <SkipToContent targetId="auth-main" />
      <Card id="auth-main" className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <span className="mx-auto mb-2 text-brand-teal">
            <Logo className="h-14 w-14" />
          </span>
          <CardTitle className="text-brand-teal">{header.title}</CardTitle>
          {header.subtitle && <CardDescription>{header.subtitle}</CardDescription>}
        </CardHeader>

        <CardContent>
          {/* --- Phase 1: email lookup ------------------------------------ */}
          {flow.phase === 'email' && (
            <form onSubmit={handleLookup} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">{t('email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  dir="ltr"
                  autoComplete="email"
                  autoFocus
                />
              </div>
              {errorBlock}
              <Button type="submit" className="w-full" disabled={loading || !email}>
                {loading ? t('pleaseWait') : t('continue')}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full border-brand-teal text-brand-teal hover:bg-brand-teal-light"
                onClick={() => {
                  setEmail('innovator@gac-demo.sa');
                  setPassword('Demo2026!');
                }}
              >
                {t('useDemoAccount')}
              </Button>
              <div className="rounded-2xl bg-brand-teal-light/60 px-3 py-2 text-center text-xs text-brand-teal">
                <p className="font-medium">{t('demoCredentials')}</p>
                <p dir="ltr" className="mt-0.5 font-mono">
                  innovator@gac-demo.sa / Demo2026!
                </p>
              </div>
              <p className="text-center text-[11px] text-muted-foreground">{t('demoNote')}</p>
            </form>
          )}

          {/* --- Phase 2a: existing user → password ---------------------- */}
          {flow.phase === 'login' && (
            <form onSubmit={handleLoginPassword} className="space-y-4">
              <button
                type="button"
                onClick={resetToEmailPhase}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-teal hover:underline"
              >
                <ArrowLeft className="h-3 w-3 rtl:rotate-180" />
                {t('backToEmail')}
              </button>
              <div className="rounded-md border border-border bg-muted/40 p-2 text-xs" dir="ltr">
                {email}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">{t('password')}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  dir="ltr"
                  autoComplete="current-password"
                  autoFocus
                />
              </div>
              <p className="text-xs text-muted-foreground">{t('otpHint')}</p>
              <p className="text-end text-xs">
                <Link href={('/forgot-password') as any} className="font-medium text-brand-teal hover:underline">
                  {t('forgotPassword')}
                </Link>
              </p>
              {errorBlock}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t('pleaseWait') : t('continueToOtp')}
              </Button>
            </form>
          )}

          {/* --- Phase 2b: activate account (first-time password) --------- */}
          {flow.phase === 'activate' && (
            <form onSubmit={handleActivate} className="space-y-4">
              <button
                type="button"
                onClick={resetToEmailPhase}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-teal hover:underline"
              >
                <ArrowLeft className="h-3 w-3 rtl:rotate-180" />
                {t('backToEmail')}
              </button>
              <div className="rounded-md border border-border bg-muted/40 p-2 text-xs" dir="ltr">
                {email}
              </div>
              <div className="rounded-md bg-brand-teal-light/50 p-3 text-xs text-brand-teal">
                {t('activateInfo')}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">{t('choosePassword')}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  dir="ltr"
                  autoComplete="new-password"
                  autoFocus
                />
                {passwordPolicyHint}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="passwordConfirm">{t('confirmPassword')}</Label>
                <Input
                  id="passwordConfirm"
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  required
                  dir="ltr"
                  autoComplete="new-password"
                />
              </div>
              {errorBlock}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t('pleaseWait') : t('activateAndContinue')}
              </Button>
            </form>
          )}

          {/* --- Phase 2c: brand-new registration -------------------------- */}
          {flow.phase === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-4">
              <button
                type="button"
                onClick={resetToEmailPhase}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-teal hover:underline"
              >
                <ArrowLeft className="h-3 w-3 rtl:rotate-180" />
                {t('backToEmail')}
              </button>
              <div className="rounded-md border border-border bg-muted/40 p-2 text-xs" dir="ltr">
                {email}
              </div>
              <div className="rounded-md bg-brand-teal-light/50 p-3 text-xs text-brand-teal">
                {t('signupInfo')}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fullName">{t('fullName')}</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="department">{t('department')}</Label>
                <Input
                  id="department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category">{t('category')}</Label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {['citizen', 'startup', 'academic', 'sme', 'government', 'employee'].map((c) => (
                    <option key={c} value={c}>
                      {tc(c)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">{t('choosePassword')}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  dir="ltr"
                  autoComplete="new-password"
                />
                {passwordPolicyHint}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="passwordConfirm">{t('confirmPassword')}</Label>
                <Input
                  id="passwordConfirm"
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  required
                  dir="ltr"
                  autoComplete="new-password"
                />
              </div>
              {errorBlock}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t('pleaseWait') : t('registerAndContinue')}
              </Button>
            </form>
          )}

          {/* --- Closed: self-registration disabled ----------------------- */}
          {flow.phase === 'closed' && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">{t('registrationClosedBody')}</p>
              <Button
                type="button"
                variant="outline"
                onClick={resetToEmailPhase}
                className="border-brand-teal text-brand-teal hover:bg-brand-teal-light"
              >
                {t('backToEmail')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
