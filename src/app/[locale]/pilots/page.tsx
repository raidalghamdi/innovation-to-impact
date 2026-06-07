import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import { formatSAR } from '@/lib/utils';

const PILOTS = [
  {
    id: 'p1', title_ar: 'بوابة بلاغات تجار التجزئة', title_en: 'Retailer complaints portal',
    hypothesis_ar: 'بوابة موجهة تزيد بلاغات المنشآت الصغيرة بنسبة 30%.',
    hypothesis_en: 'A guided portal increases SME complaints by 30%.',
    budget: 150000, status: 'running', results_en: 'Complaints up 24% at mid-review.',
    milestones: [{ name: 'Launch', done: true }, { name: 'Mid-review', done: true }, { name: 'Final', done: false }],
  },
  {
    id: 'p2', title_ar: 'منصة موحدة لرصد الأسعار', title_en: 'Unified price monitoring platform',
    hypothesis_ar: 'التغذية الموحدة تقلل زمن الكشف للنصف.',
    hypothesis_en: 'A unified feed cuts detection lag in half.',
    budget: 220000, status: 'completed', results_en: 'Detection lag reduced 52%.',
    milestones: [{ name: 'Data onboarding', done: true }, { name: 'Model tuning', done: true }],
  },
];

export default async function PilotsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('pilots');

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {PILOTS.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-brand-teal">
                  {locale === 'ar' ? p.title_ar : p.title_en}
                </CardTitle>
                <StatusBadge status={p.status} locale={locale} />
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="font-medium text-foreground">{t('hypothesis')}</p>
                <p className="text-muted-foreground">{locale === 'ar' ? p.hypothesis_ar : p.hypothesis_en}</p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('budget')}</span>
                <span className="font-medium">{formatSAR(p.budget, locale)} SAR</span>
              </div>
              <div>
                <p className="mb-1 font-medium text-foreground">{t('milestones')}</p>
                <div className="flex flex-wrap gap-2">
                  {p.milestones.map((m) => (
                    <span
                      key={m.name}
                      className={`rounded-full px-2.5 py-0.5 text-xs ${m.done ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'}`}
                    >
                      {m.name}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-medium text-foreground">{t('results')}</p>
                <p className="text-muted-foreground">{p.results_en}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
