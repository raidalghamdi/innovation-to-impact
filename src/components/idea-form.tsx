'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, CheckCircle2 } from 'lucide-react';
import type { StrategicTheme, Activity } from '@/lib/demo-data';

export function IdeaForm({
  themes,
  activities,
  locale,
}: {
  themes: StrategicTheme[];
  activities: Activity[];
  locale: string;
}) {
  const t = useTranslations('ideas');
  const tc = useTranslations('common');
  const router = useRouter();

  const [titleAr, setTitleAr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [problem, setProblem] = useState('');
  const [solution, setSolution] = useState('');
  const [confidentiality, setConfidentiality] = useState('internal');
  const [theme, setTheme] = useState(themes[0]?.id ?? '');
  const [activity, setActivity] = useState(activities[0]?.id ?? '');
  const [ack, setAck] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function suggestTitle() {
    if (!problem) return;
    const words = problem.split(/\s+/).slice(0, 6).join(' ');
    if (!titleAr) setTitleAr(words);
    if (!titleEn) setTitleEn(words);
  }

  const selectClass =
    'flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const supabase = createClient();
    if (supabase) {
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from('ideas').insert({
        title_ar: titleAr,
        title_en: titleEn,
        problem_statement: problem,
        proposed_solution: solution,
        confidentiality,
        strategic_theme_id: theme || null,
        activity_id: activity || null,
        ownership_acknowledged: ack,
        status: 'submitted',
        current_stage: 1,
        submitter_id: userData.user?.id,
      });
    }
    setSubmitting(false);
    setDone(true);
    setTimeout(() => router.push('/ideas'), 1200);
  }

  if (done) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-600" />
          <p className="text-lg font-medium">{tc('submit')} ✓</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="titleAr">{t('ideaTitle')} (العربية)</Label>
              <Input id="titleAr" value={titleAr} onChange={(e) => setTitleAr(e.target.value)} required dir="rtl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="titleEn">{t('ideaTitle')} (English)</Label>
              <Input id="titleEn" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} dir="ltr" />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="problem">{t('problemStatement')}</Label>
              <Button type="button" size="sm" variant="ghost" onClick={suggestTitle} className="text-brand-teal">
                <Sparkles className="h-3.5 w-3.5" />
                {t('aiTitleAssist')}
              </Button>
            </div>
            <Textarea id="problem" value={problem} onChange={(e) => setProblem(e.target.value)} required rows={3} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="solution">{t('proposedSolution')}</Label>
            <Textarea id="solution" value={solution} onChange={(e) => setSolution(e.target.value)} rows={3} />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label>{t('theme')}</Label>
              <select value={theme} onChange={(e) => setTheme(e.target.value)} className={selectClass}>
                {themes.map((th) => (
                  <option key={th.id} value={th.id}>{locale === 'ar' ? th.name_ar : th.name_en}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('activity')}</Label>
              <select value={activity} onChange={(e) => setActivity(e.target.value)} className={selectClass}>
                {activities.map((a) => (
                  <option key={a.id} value={a.id}>{locale === 'ar' ? a.name_ar : a.name_en}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('confidentiality')}</Label>
              <select value={confidentiality} onChange={(e) => setConfidentiality(e.target.value)} className={selectClass}>
                <option value="public">public</option>
                <option value="internal">internal</option>
                <option value="confidential">confidential</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t('attachments')}</Label>
            <Input type="file" multiple className="cursor-pointer" />
          </div>

          <label className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              required
              className="mt-0.5 h-4 w-4 accent-[#01696F]"
            />
            <span>{t('ownershipAck')}</span>
          </label>

          <Button type="submit" disabled={submitting || !ack} className="w-full sm:w-auto">
            {tc('submit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
