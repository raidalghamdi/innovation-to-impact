import { redirect } from '@/i18n/routing';

// src/app/[locale]/profile/page.tsx
// The standalone "Profile" page was consolidated into "Settings" per the
// July 2026 UX batch — a single settings surface owns profile info, password,
// preferences, and notification channels. Any stray link to /profile now
// redirects to /settings so old bookmarks and links keep working.
type Props = { params: { locale: 'ar' | 'en' } };

export default function ProfilePage({ params: { locale } }: Props) {
  redirect({ href: '/settings', locale });
}
