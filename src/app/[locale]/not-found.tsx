import { Link } from '@/i18n/routing';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';

export default async function NotFound() {
  const t = await getTranslations('nav');
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-center">
      <p className="text-6xl font-bold text-brand-teal">404</p>
      <Button asChild>
        <Link href="/dashboard">{t('dashboard')}</Link>
      </Button>
    </div>
  );
}
