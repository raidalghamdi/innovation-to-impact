'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Logo } from '@/components/logo';
import { SkipToContent } from '@/components/skip-to-content';
import { AlertCircle } from 'lucide-react';

// src/components/auth-form.tsx:1
// Login mode is now OTP-first (Batch B / Phase 10.2): password is verified
// server-side WITHOUT establishing a session, then the user is routed to
// /[locale]/login/verify to enter the emailed OTP. Signup mode is unchanged
// (external self-registration; see Phase 10.4 for the DB-driven toggle
// applied on the signup page itself).
export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const t = useTranslations('auth');
  const tc = useTranslations('categories');
  const locale = useLocale();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');
  const [category, setCategory] = useState('employee');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignup = mode === 'signup';

  async function handleLoginStart(e: React.FormEvent) {
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
      // Password is kept only in sessionStorage for the brief hop to the
      // verify step (never written to the URL/query string) — login-verify
      // needs it to establish the real Supabase session after OTP success.
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('i2i_pending_pw', password);
      }
      const qs = new URLSearchParams({ email });
      if (data.devOtp) qs.set('devOtp', data.devOtp);
      router.push((`/login/verify?${qs.toString()}`) as any);
    } catch (err: any) {
      setError(err?.message ?? t('loginFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createClient();
    if (!supabase) {
      setError(t('demoNote'));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, department, user_category: category } },
      });
      if (error) throw error;
      // Signup does not skip OTP — route through the same login flow so the
      // freshly created account still verifies via OTP on first sign-in.
      router.push(('/login') as any);
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = isSignup ? handleSignup : handleLoginStart;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <SkipToContent targetId="auth-main" />
      <Card id="auth-main" className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <span className="mx-auto mb-2 text-brand-teal">
            <Logo className="h-14 w-14" />
          </span>
          <CardTitle className="text-brand-teal">
            {isSignup ? t('signupTitle') : t('loginTitle')}
          </CardTitle>
          <CardDescription>
            {isSignup ? t('signupSubtitle') : t('loginSubtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">{t('fullName')}</Label>
                  <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="department">{t('department')}</Label>
                  <Input id="department" value={department} onChange={(e) => setDepartment(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="category">{t('category')}</Label>
                  <select
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {['employee', 'startup', 'citizen', 'academic', 'sme', 'government'].map((c) => (
                      <option key={c} value={c}>{tc(c)}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">{t('email')}</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t('password')}</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required dir="ltr" />
            </div>

            {!isSignup && (
              <p className="text-xs text-muted-foreground">{t('otpHint')}</p>
            )}

            {!isSignup && (
              <p className="text-end text-xs">
                <Link href={('/forgot-password') as any} className="font-medium text-brand-teal hover:underline">
                  {t('forgotPassword')}
                </Link>
              </p>
            )}

            {/* Error surface uses role=alert + aria-live=polite so screen
                readers announce authentication failures immediately. */}
            <div role="alert" aria-live="polite" className="empty:hidden">
              {error && (
                <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t('pleaseWait') : isSignup ? t('signUp') : t('continueToOtp')}
            </Button>

            {!isSignup && (
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
            )}
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {isSignup ? t('hasAccount') : t('noAccount')}{' '}
            <Link
              href={isSignup ? '/login' : '/signup'}
              className="font-medium text-brand-teal hover:underline"
            >
              {isSignup ? t('signIn') : t('signUp')}
            </Link>
          </p>
          <div className="mt-3 rounded-2xl bg-brand-teal-light/60 px-3 py-2 text-center text-xs text-brand-teal">
            <p className="font-medium">{t('demoCredentials')}</p>
            <p dir="ltr" className="mt-0.5 font-mono">innovator@gac-demo.sa / Demo2026!</p>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            {t('demoNote')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
