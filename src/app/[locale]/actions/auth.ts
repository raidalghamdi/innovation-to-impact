'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Signs the current user out and redirects to the sign-in page.
 * Safe to invoke via <form action={signOutAction}> or from a client
 * component wrapping it.
 */
export async function signOutAction(formData?: FormData) {
  const locale = (formData?.get('locale') as string) || 'en';
  const supabase = await createClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  // Route to the canonical login page. The `/auth/sign-in` path never
  // existed as a route — next-intl routes login as `/[locale]/login`.
  redirect(`/${locale}/login`);
}
