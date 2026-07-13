'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TITLE_DEFAULTS, type ReportTitle } from '@/lib/report-titles';
import { updateReportTitles, type TitlePatch } from '@/app/[locale]/admin/reports/actions';

type TitleMap = Record<string, ReportTitle>;

// Full-page editor for the admin Reports Center titles (route:
// /admin/reports/titles). Iterates every editable element defined in
// TITLE_DEFAULTS — hero, section header, KPI card labels, and each chart
// heading — so the list stays in sync with the defaults automatically. Saves
// through the same server action as the in-page modal; blank fields fall back
// to the hardcoded default.
export function ReportTitlesEditor({ titles, locale }: { titles: TitleMap; locale: string }) {
  const isAr = locale === 'ar';
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const keys = Object.keys(TITLE_DEFAULTS);
  const [draft, setDraft] = useState<Record<string, TitlePatch>>(() => {
    const seed: Record<string, TitlePatch> = {};
    for (const key of keys) {
      const t = titles[key] ?? TITLE_DEFAULTS[key];
      seed[key] = {
        key,
        title_ar: t?.title_ar ?? '',
        title_en: t?.title_en ?? '',
        subtitle_ar: t?.subtitle_ar ?? '',
        subtitle_en: t?.subtitle_en ?? '',
      };
    }
    return seed;
  });

  const setField = (key: string, field: keyof Omit<TitlePatch, 'key'>, value: string) => {
    setSaved(false);
    setDraft((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const onSave = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateReportTitles(Object.values(draft));
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  };

  const isKpi = (key: string) => key.startsWith('kpi_');

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {isAr
            ? 'حرّر عناوين التقارير والرسوم ومؤشرات الأداء بالعربية والإنجليزية. اترك الحقل فارغًا للرجوع إلى القيمة الافتراضية.'
            : 'Edit report, chart, and KPI titles in Arabic and English. Leave a field blank to fall back to the default.'}
        </p>
        <div className="flex items-center gap-3">
          {saved && !error && (
            <span className="text-sm text-brand-teal">{isAr ? 'تم الحفظ' : 'Saved'}</span>
          )}
          {error && (
            <span className="text-sm text-destructive">
              {isAr ? 'تعذّر الحفظ: ' : 'Save failed: '}
              {error}
            </span>
          )}
          <Button onClick={onSave} disabled={pending} className="shrink-0">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isAr ? 'حفظ التغييرات' : 'Save changes'}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {keys.map((key) => (
          <Card key={key}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                <p className="font-mono text-xs text-muted-foreground">{key}</p>
                {isKpi(key) && (
                  <span className="rounded-full bg-brand-teal-light px-2 py-0.5 text-[10px] font-medium text-brand-teal">
                    KPI
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor={`${key}-title_ar`}>{isAr ? 'العنوان (عربي)' : 'Title (AR)'}</Label>
                  <Input
                    id={`${key}-title_ar`}
                    dir="rtl"
                    value={draft[key].title_ar ?? ''}
                    onChange={(e) => setField(key, 'title_ar', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${key}-title_en`}>{isAr ? 'العنوان (إنجليزي)' : 'Title (EN)'}</Label>
                  <Input
                    id={`${key}-title_en`}
                    dir="ltr"
                    value={draft[key].title_en ?? ''}
                    onChange={(e) => setField(key, 'title_en', e.target.value)}
                  />
                </div>
                {!isKpi(key) && (
                  <>
                    <div className="space-y-1">
                      <Label htmlFor={`${key}-subtitle_ar`}>{isAr ? 'الوصف (عربي)' : 'Subtitle (AR)'}</Label>
                      <Input
                        id={`${key}-subtitle_ar`}
                        dir="rtl"
                        value={draft[key].subtitle_ar ?? ''}
                        onChange={(e) => setField(key, 'subtitle_ar', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`${key}-subtitle_en`}>{isAr ? 'الوصف (إنجليزي)' : 'Subtitle (EN)'}</Label>
                      <Input
                        id={`${key}-subtitle_en`}
                        dir="ltr"
                        value={draft[key].subtitle_en ?? ''}
                        onChange={(e) => setField(key, 'subtitle_en', e.target.value)}
                      />
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
