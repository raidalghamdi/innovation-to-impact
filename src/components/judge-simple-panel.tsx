'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

export type JudgeIdea = {
  id: string;
  code: string | null;
  title_ar: string | null;
  title_en: string | null;
  problem_statement: string | null;
  proposed_solution: string | null;
  theme_ar?: string | null;
  theme_en?: string | null;
  avg_score?: number | null;
  evaluations_count?: number;
};

type Props = {
  locale: string;
  ideas: JudgeIdea[];
};

type Decision = 'approve' | 'reject';

/**
 * Simple judge form — one card per idea in the committee queue.
 *
 * Fields the judge fills in:
 *   • decision: approve | reject
 *   • overall score (0-100)
 *   • justification (Arabic + English optional)
 *
 * No per-criterion breakdown. No conflict tracking. No comparison view.
 * This is the "single simple form per idea" pattern the workflow calls for.
 */
export function JudgeSimplePanel({ locale, ideas }: Props) {
  const isAr = locale === 'ar';
  const router = useRouter();
  const [saving, startTransition] = useTransition();
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);
  const [drafts, setDrafts] = useState<
    Record<string, { decision: Decision | null; score: string; note_ar: string; note_en: string }>
  >({});

  function draftFor(id: string) {
    return drafts[id] ?? { decision: null, score: '', note_ar: '', note_en: '' };
  }
  function updateDraft(id: string, patch: Partial<ReturnType<typeof draftFor>>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...draftFor(id), ...patch } }));
  }

  function submit(id: string) {
    const d = draftFor(id);
    if (!d.decision) {
      setFlash({ ok: false, msg: isAr ? 'اختر القرار أولاً' : 'Pick a decision first' });
      setTimeout(() => setFlash(null), 2500);
      return;
    }
    const score = d.score ? Number(d.score) : null;
    if (score !== null && (Number.isNaN(score) || score < 0 || score > 100)) {
      setFlash({ ok: false, msg: isAr ? 'الدرجة يجب أن تكون بين 0 و 100' : 'Score must be 0–100' });
      setTimeout(() => setFlash(null), 2500);
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/judge/decisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea_id: id,
          decision: d.decision,
          score,
          note_ar: d.note_ar || null,
          note_en: d.note_en || null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setFlash({ ok: true, msg: isAr ? 'تم حفظ القرار' : 'Decision saved' });
        router.refresh();
      } else {
        setFlash({ ok: false, msg: j.error || (isAr ? 'فشل الحفظ' : 'Save failed') });
      }
      setTimeout(() => setFlash(null), 2500);
    });
  }

  const sorted = useMemo(() => ideas.slice(), [ideas]);

  if (sorted.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          {isAr ? 'لا توجد أفكار في مرحلة اللجنة حالياً.' : 'No ideas in the committee queue.'}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {flash && (
        <div
          className={`rounded-md border px-4 py-2 text-sm ${
            flash.ok ? 'border-green-500 bg-green-50 text-green-800' : 'border-red-500 bg-red-50 text-red-800'
          }`}
        >
          {flash.msg}
        </div>
      )}
      <div className="grid gap-6">
        {sorted.map((i) => {
          const d = draftFor(i.id);
          const title = isAr ? i.title_ar || i.title_en : i.title_en || i.title_ar;
          const theme = isAr ? i.theme_ar || i.theme_en : i.theme_en || i.theme_ar;
          return (
            <Card key={i.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">{i.code}</div>
                    <CardTitle className="mt-1 text-lg">{title}</CardTitle>
                    {theme && (
                      <Badge variant="outline" className="mt-2">
                        {theme}
                      </Badge>
                    )}
                  </div>
                  {i.avg_score !== null && i.avg_score !== undefined && (
                    <div className="rounded-lg border bg-muted/40 px-3 py-2 text-center">
                      <div className="text-[10px] uppercase text-muted-foreground">
                        {isAr ? 'متوسط المقيّمين' : 'Evaluators avg'}
                      </div>
                      <div className="text-lg font-bold tabular-nums">{i.avg_score.toFixed(1)}</div>
                      {i.evaluations_count !== undefined && (
                        <div className="text-[10px] text-muted-foreground">
                          {i.evaluations_count} {isAr ? 'تقييمات' : 'evals'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {i.problem_statement && (
                  <Section label={isAr ? 'المشكلة' : 'Problem'} value={i.problem_statement} />
                )}
                {i.proposed_solution && (
                  <Section label={isAr ? 'الحل المقترح' : 'Proposed solution'} value={i.proposed_solution} />
                )}

                <div className="border-t pt-4">
                  <div className="mb-2 text-sm font-semibold">
                    {isAr ? 'قرار المحكّم' : "Judge's decision"}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label>{isAr ? 'القرار' : 'Decision'}</Label>
                      <div className="mt-1 flex gap-2">
                        <Button
                          size="sm"
                          variant={d.decision === 'approve' ? 'default' : 'outline'}
                          className={d.decision === 'approve' ? 'bg-green-700 hover:bg-green-800' : ''}
                          onClick={() => updateDraft(i.id, { decision: 'approve' })}
                        >
                          {isAr ? 'قبول' : 'Approve'}
                        </Button>
                        <Button
                          size="sm"
                          variant={d.decision === 'reject' ? 'default' : 'outline'}
                          className={d.decision === 'reject' ? 'bg-red-700 hover:bg-red-800' : ''}
                          onClick={() => updateDraft(i.id, { decision: 'reject' })}
                        >
                          {isAr ? 'رفض' : 'Reject'}
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label>{isAr ? 'الدرجة النهائية (0-100)' : 'Final score (0-100)'}</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={d.score}
                        onChange={(e) => updateDraft(i.id, { score: e.target.value })}
                        placeholder="0-100"
                      />
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <Label>{isAr ? 'المبرر (عربي)' : 'Justification (Arabic)'}</Label>
                      <Textarea
                        rows={3}
                        value={d.note_ar}
                        onChange={(e) => updateDraft(i.id, { note_ar: e.target.value })}
                        placeholder={isAr ? 'اكتب المبرر…' : 'Write justification in Arabic…'}
                      />
                    </div>
                    <div>
                      <Label>{isAr ? 'المبرر (إنجليزي)' : 'Justification (English)'}</Label>
                      <Textarea
                        rows={3}
                        value={d.note_en}
                        onChange={(e) => updateDraft(i.id, { note_en: e.target.value })}
                        placeholder={isAr ? 'اكتب المبرر بالإنجليزية…' : 'Write justification in English…'}
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <Button onClick={() => submit(i.id)} disabled={saving || !d.decision}>
                      {saving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : isAr ? 'حفظ القرار' : 'Save decision'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Section({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <p className="whitespace-pre-wrap text-sm">{value}</p>
    </div>
  );
}
