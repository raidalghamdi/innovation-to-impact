'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sparkles,
  Check,
  ChevronLeft,
  ChevronRight,
  Paperclip,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import type { StrategicTheme, Activity } from '@/lib/demo-data';

// --- Smart title suggestion -----------------------------------------------
const STOPWORDS_AR = new Set([
  'في','من','إلى','الى','على','عن','مع','هذا','هذه','ذلك','تلك','التي','الذي',
  'كان','يكون','هو','هي','هم','هن','نحن','أنت','انت','أنا','انا','ما','لا','لم',
  'لن','قد','بعض','كل','أي','اي','أو','او','و','ثم','حيث','بسبب','حتى','عند',
  'بعد','قبل','أن','ان','إن','بأن','وأن','يتم','تم','يوجد','هناك','هنا','هنالك',
]);
const STOPWORDS_EN = new Set([
  'the','a','an','of','to','in','on','for','with','and','or','is','are','was',
  'were','be','been','being','as','at','by','it','its','this','that','these',
  'those','from','but','not','no','do','does','did','have','has','had','will',
  'would','can','could','should','may','might','our','their','your','my','we',
  'they','them','i','you','he','she','about','into','than','then','so','too',
]);

function smartTitle(text: string, locale: string): string {
  if (!text) return '';
  const cleaned = text.replace(/[\.،,;:!\?\n\r]+/g, ' ').trim();
  const tokens = cleaned.split(/\s+/);
  const isAr = locale === 'ar';
  const stop = isAr ? STOPWORDS_AR : STOPWORDS_EN;
  const kept: string[] = [];
  for (const tok of tokens) {
    const t = tok.replace(/^[«»"'\(\)\[\]]+|[«»"'\(\)\[\]]+$/g, '');
    if (!t) continue;
    if (stop.has(t.toLowerCase())) continue;
    kept.push(t);
    if (kept.length >= 7) break;
  }
  if (kept.length < 3) return tokens.slice(0, 6).join(' ');
  return kept.slice(0, 6).join(' ');
}

type SimilarIdea = {
  id: string;
  code: string;
  title_ar: string | null;
  title_en: string | null;
  status: string | null;
  similarity: number;
};

// Character limits per field.
const LIMITS = { title: 120, summary: 300, description: 2000 };

const DRAFT_KEY = 'gac-idea-draft-v1';

type Draft = {
  title: string;
  summary: string;
  description: string;
  theme: string;
  activity: string;
};

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
  const tf = useTranslations('ideaForm');
  const tc = useTranslations('common');
  const ts = useTranslations('similarity');
  const router = useRouter();
  const isAr = locale === 'ar';
  const Chevron = isAr ? ChevronLeft : ChevronRight;
  const ChevronBack = isAr ? ChevronRight : ChevronLeft;

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [theme, setTheme] = useState(themes[0]?.id ?? '');
  const [activity, setActivity] = useState(activities[0]?.id ?? '');
  const [ack, setAck] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [similar, setSimilar] = useState<SimilarIdea[]>([]);
  const [checkingSimilar, setCheckingSimilar] = useState(false);
  const restored = useRef(false);

  const steps = [tf('steps.basics'), tf('steps.details'), tf('steps.attachments'), tf('steps.review')];

  // Restore draft on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Draft;
        if (d.title) setTitle(d.title.slice(0, LIMITS.title));
        if (d.summary) setSummary(d.summary.slice(0, LIMITS.summary));
        if (d.description) setDescription(d.description.slice(0, LIMITS.description));
        if (d.theme) setTheme(d.theme);
        if (d.activity) setActivity(d.activity);
        if (d.title || d.summary || d.description) {
          setSavedNote(tf('autosaveRestored'));
        }
      }
    } catch {
      /* ignore */
    }
    restored.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave (debounced) whenever fields change.
  useEffect(() => {
    if (!restored.current) return;
    const id = setTimeout(() => {
      try {
        const draft: Draft = { title, summary, description, theme, activity };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        setSavedNote(tf('autosaveSaved'));
      } catch {
        /* ignore */
      }
    }, 700);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, summary, description, theme, activity]);

  // Debounced AI-similarity check as the user types the title.
  useEffect(() => {
    const query = title.trim();
    if (query.length < 4) {
      setSimilar([]);
      setCheckingSimilar(false);
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    setCheckingSimilar(true);
    const id = setTimeout(async () => {
      try {
        const { data } = await supabase.rpc('find_similar_ideas', {
          query_text: query,
          exclude_id: null,
          similarity_threshold: 0.2,
          max_results: 5,
        });
        setSimilar((data as SimilarIdea[]) ?? []);
      } catch {
        setSimilar([]);
      } finally {
        setCheckingSimilar(false);
      }
    }, 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  const strongMatches = similar.filter((s) => s.similarity > 0.5).length;

  function suggestTitle() {
    const suggestion = smartTitle(summary || description, locale);
    if (suggestion) setTitle(suggestion.slice(0, LIMITS.title));
  }

  function stepValid(s: number): boolean {
    if (s === 0) return title.trim().length > 0 && summary.trim().length > 0;
    if (s === 1) return description.trim().length > 0 && Boolean(theme);
    return true;
  }

  function next() {
    if (!stepValid(step)) {
      setError(tf('required'));
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, steps.length - 1));
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  const selectClass =
    'flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  const activeTheme = themes.find((th) => th.id === theme);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step !== steps.length - 1) {
      next();
      return;
    }
    if (!ack) return;
    setError(null);
    setSubmitting(true);
    const supabase = createClient();
    if (!supabase) {
      setError(t('loginRequired'));
      setSubmitting(false);
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      setSubmitting(false);
      router.push('/login');
      return;
    }
    const payload: Record<string, any> = {
      title_ar: isAr ? title : null,
      title_en: !isAr ? title : null,
      problem_statement: summary,
      proposed_solution: description,
      strategic_theme_id: theme || null,
      activity_id: activity || null,
      ownership_acknowledged: ack,
      status: 'submitted',
      current_stage: 1,
      submitter_id: userData.user.id,
    };
    try {
      await supabase.from('ideas').insert(payload);
    } catch {
      /* best-effort */
    }
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    setSubmitting(false);
    router.push('/my-ideas');
  }

  function counter(value: string, limit: number) {
    return (
      <span className="text-xs text-muted-foreground">
        {tf('charsLeft', { n: Math.max(0, limit - value.length) })}
      </span>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        {/* Stepper / progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-2">
            {steps.map((label, i) => {
              const done = i < step;
              const current = i === step;
              return (
                <div key={label} className="flex flex-1 flex-col items-center gap-1.5">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${
                      done
                        ? 'bg-brand-teal text-white'
                        : current
                          ? 'bg-brand-cyan text-white'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {done ? <Check className="h-4 w-4" /> : i + 1}
                  </div>
                  <span
                    className={`hidden text-center text-[11px] sm:block ${
                      current ? 'font-semibold text-brand-teal' : 'text-muted-foreground'
                    }`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand-teal transition-all"
              style={{ width: `${((step + 1) / steps.length) * 100}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {tf('stepOf', { current: step + 1, total: steps.length })}
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          {/* ---- Step 1: Basics ---- */}
          {step === 0 && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="title">{tf('titleLabel')}</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={suggestTitle}
                    className="text-brand-teal"
                    disabled={!summary && !description}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {title ? t('aiTitleRegenerate') : t('aiTitleAssist')}
                  </Button>
                </div>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, LIMITS.title))}
                  maxLength={LIMITS.title}
                  required
                  dir={isAr ? 'rtl' : 'ltr'}
                />
                <div className="flex justify-end">{counter(title, LIMITS.title)}</div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="summary">{tf('summaryLabel')}</Label>
                <Textarea
                  id="summary"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value.slice(0, LIMITS.summary))}
                  maxLength={LIMITS.summary}
                  required
                  rows={3}
                  dir={isAr ? 'rtl' : 'ltr'}
                />
                <div className="flex justify-end">{counter(summary, LIMITS.summary)}</div>
              </div>

              {/* AI similarity suggestions */}
              {(checkingSimilar || similar.length > 0) && (
                <div className="rounded-2xl border border-brand-cyan/30 bg-brand-cyan-light/20 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-brand-teal">
                    <Sparkles className="h-4 w-4 text-brand-cyan" />
                    {checkingSimilar ? ts('checking') : ts('title')}
                  </div>

                  {strongMatches >= 3 && (
                    <div className="mt-2 flex items-start gap-2 rounded-lg bg-brand-gold-light/60 p-2.5 text-xs text-brand-teal">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-gold" />
                      <span>
                        <strong>{ts('nudgeTitle')}</strong> — {ts('nudge')}
                      </span>
                    </div>
                  )}

                  {similar.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {similar.map((s) => (
                        <li key={s.id}>
                          <Link
                            href={`/ideas/${s.id}` as any}
                            target="_blank"
                            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm transition hover:border-brand-teal/40"
                          >
                            <span className="line-clamp-1 flex-1" dir={isAr ? 'rtl' : 'ltr'}>
                              {(isAr ? s.title_ar : s.title_en) || s.title_en || s.title_ar || s.code}
                            </span>
                            <span className="shrink-0 rounded-full bg-brand-teal-light px-2 py-0.5 text-[11px] font-medium text-brand-teal">
                              {ts('match', { pct: Math.round(s.similarity * 100) })}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ---- Step 2: Details ---- */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="description">{tf('descriptionLabel')}</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, LIMITS.description))}
                  maxLength={LIMITS.description}
                  required
                  rows={6}
                  dir={isAr ? 'rtl' : 'ltr'}
                />
                <div className="flex justify-end">{counter(description, LIMITS.description)}</div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{tf('themeLabel')}</Label>
                  <select value={theme} onChange={(e) => setTheme(e.target.value)} className={selectClass}>
                    {themes.map((th) => (
                      <option key={th.id} value={th.id}>
                        {isAr ? th.name_ar : th.name_en}
                      </option>
                    ))}
                  </select>
                  <p className="rounded-lg bg-brand-teal-light/40 p-2.5 text-xs text-brand-teal">
                    {activeTheme?.description || tf('themeExplain')}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>{t('activity')}</Label>
                  <select
                    value={activity}
                    onChange={(e) => setActivity(e.target.value)}
                    className={selectClass}
                  >
                    {activities.map((a) => (
                      <option key={a.id} value={a.id}>
                        {isAr ? a.name_ar : a.name_en}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ---- Step 3: Attachments ---- */}
          {step === 2 && (
            <div className="space-y-3">
              <Label>{t('attachments')}</Label>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-muted/30 p-8 text-center transition hover:border-brand-teal/40">
                <Paperclip className="h-6 w-6 text-brand-teal" />
                <span className="text-sm text-muted-foreground">{tf('attachmentsHint')}</span>
                <Input type="file" multiple className="hidden" />
              </label>
            </div>
          )}

          {/* ---- Step 4: Review ---- */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="rounded-lg bg-brand-cyan-light/40 p-3 text-sm text-brand-teal">
                {tf('reviewNote')}
              </p>
              <dl className="divide-y divide-border rounded-xl border border-border">
                <div className="grid grid-cols-3 gap-2 p-3">
                  <dt className="text-sm font-medium text-muted-foreground">{tf('titleLabel')}</dt>
                  <dd className="col-span-2 text-sm text-foreground">{title || '—'}</dd>
                </div>
                <div className="grid grid-cols-3 gap-2 p-3">
                  <dt className="text-sm font-medium text-muted-foreground">{tf('summaryLabel')}</dt>
                  <dd className="col-span-2 text-sm text-foreground">{summary || '—'}</dd>
                </div>
                <div className="grid grid-cols-3 gap-2 p-3">
                  <dt className="text-sm font-medium text-muted-foreground">{tf('descriptionLabel')}</dt>
                  <dd className="col-span-2 whitespace-pre-wrap text-sm text-foreground">
                    {description || '—'}
                  </dd>
                </div>
                <div className="grid grid-cols-3 gap-2 p-3">
                  <dt className="text-sm font-medium text-muted-foreground">{tf('themeLabel')}</dt>
                  <dd className="col-span-2 text-sm text-foreground">
                    {activeTheme ? (isAr ? activeTheme.name_ar : activeTheme.name_en) : '—'}
                  </dd>
                </div>
              </dl>

              <label className="flex items-start gap-2 rounded-2xl border border-border bg-muted/40 p-3 text-sm">
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                  required
                  className="mt-0.5 h-4 w-4 accent-brand-teal"
                />
                <span>
                  {t('ownershipAckPrefix')}{' '}
                  <Link
                    href="/ip-terms"
                    target="_blank"
                    className="font-medium text-brand-teal underline-offset-2 hover:underline"
                  >
                    {t('ownershipAckLink')}
                  </Link>
                </span>
              </label>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">{error}</div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {savedNote && (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-brand-teal" />
                  {savedNote}
                </>
              )}
            </div>
            <div className="flex gap-2">
              {step > 0 && (
                <Button type="button" variant="outline" onClick={back}>
                  <ChevronBack className="h-4 w-4" />
                  {tf('back')}
                </Button>
              )}
              {step < steps.length - 1 ? (
                <Button type="button" onClick={next}>
                  {tf('next')}
                  <Chevron className="h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" disabled={submitting || !ack}>
                  {tf('submit')}
                </Button>
              )}
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
