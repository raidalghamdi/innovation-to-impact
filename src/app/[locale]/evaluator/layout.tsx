import type { ReactNode } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/user';
import { AppShell } from '@/components/app-shell';
import { EvaluatorTabs } from '@/components/evaluator/evaluator-tabs';
import './theme.css';

// The evaluator area renders inside the platform-wide <AppShell> — same header
// (logo, language toggle, notification bell, user menu), same <SiteFooter>, and
// the same global fonts (Frutiger LT Arabic / Inter). Only the evaluator design
// SYSTEM (cards, buttons, brand tokens under `.ev-root`) is layered on top; no
// divergent chrome or typeface. The role-scoped tab row lives in <EvaluatorTabs>.
export default async function EvaluatorLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();

  // Unread notification count powers the red dot on the notifications tab.
  let unread = 0;
  const supabase = await createClient();
  if (supabase && user) {
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('read_at', null);
    unread = count ?? 0;
  }

  return (
    <AppShell>
      <div className="ev-root">
        <EvaluatorTabs unread={unread} />
        {children}
      </div>
    </AppShell>
  );
}
