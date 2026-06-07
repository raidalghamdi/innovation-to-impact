import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Construction } from 'lucide-react';

export function ComingSoon() {
  const t = useTranslations('common');
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-gold-light text-brand-gold">
          <Construction className="h-6 w-6" />
        </div>
        <p className="text-base font-medium text-foreground">{t('comingSoon')}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{t('comingSoonDesc')}</p>
      </CardContent>
    </Card>
  );
}
