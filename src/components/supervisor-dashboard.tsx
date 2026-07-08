'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/status-badge';

type Idea = {
  id: string;
  code: string | null;
  title_ar: string | null;
  title_en: string | null;
  problem_statement: string | null;
  proposed_solution: string | null;
  expected_benefits: string | null;
  strategic_theme_id: string | null;
  status: string;
  submitted_at: string | null;
  created_at: string | null;
  rejection_reason: string | null;
  rejection_reason_ar: string | null;
};

type Theme = { id: string; title_ar: string | null; title_en: string | null };
type Evaluator = { id: string; full_name: string | null; email: string | null };
type TA = { id: string; theme_id: string; evaluator_id: string; status: string; assigned_at: string; notes: string | null };

type Props = {
  locale: string;
  ideas: Idea[];
  themes: Theme[];
  evaluators: Evaluator[];
  trackAssignments: TA[];
};

const SCREENING_STATUSES = new Set(['submitted', 'screening']);

export function SupervisorDashboard({ locale, ideas, themes, evaluators, trackAssignments }: Props) {
  const isAr = locale === 'ar';
  const router = useRouter();
  const [tab, setTab] = useState<'screening' | 'tracks' | 'archive'>('screening');
  const [search, setSearch] = useState('');
  const [themeFilter, setThemeFilter] = useState<string>('all');
  const [pending, startTransition] = useTransition();
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [decision, setDecision] = useState<'approve' | 'reject' | 'return' | null>(null);
  const [reasonAr, setReasonAr] = useState('');
  const [reasonEn, setReasonEn] = useState('');
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);

  const themeMap = useMemo(() => {
    const m = new Map<string, Theme>();
    for (const t of themes) m.set(t.id, t);
    return m;
  }, [themes]);

  const evaluatorMap = useMemo(() => {
    const m = new Map<string, Evaluator>();
    for (const e of evaluators) m.set(e.id, e);
    return m;
  }, [evaluators]);

  // Screening tab data
  const screeningIdeas = useMemo(() => {
    return ideas.filter((i) => {
      if (!SCREENING_STATUSES.has(i.status)) return false;
      if (themeFilter !== 'all' && i.strategic_theme_id !== themeFilter) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        (i.title_ar ?? '').toLowerCase().includes(q) ||
        (i.title_en ?? '').toLowerCase().includes(q) ||
        (i.code ?? '').toLowerCase().includes(q)
      );
    });
  }, [ideas, search, themeFilter]);

  const archiveIdeas = useMemo(() => {
    return ideas.filter((i) => ['approved', 'assigned', 'evaluation', 'rejected', 'returned'].includes(i.status));
  }, [ideas]);

  // KPIs
  const kpi = useMemo(() => {
    const total = ideas.length;
    const pending = ideas.filter((i) => SCREENING_STATUSES.has(i.status)).length;
    const approved = ideas.filter((i) => ['approved', 'assigned', 'evaluation'].includes(i.status)).length;
    const rejected = ideas.filter((i) => i.status === 'rejected').length;
    const returned = ideas.filter((i) => i.status === 'returned').length;
    return { total, pending, approved, rejected, returned };
  }, [ideas]);

  function openDecision(idea: Idea, kind: 'approve' | 'reject' | 'return') {
    setSelectedIdea(idea);
    setDecision(kind);
    setReasonAr('');
    setReasonEn('');
  }

  function submitDecision() {
    if (!selectedIdea || !decision) return;
    startTransition(async () => {
      const res = await fetch(`/api/supervisor/ideas/${selectedIdea.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reason: reasonEn || null, reason_ar: reasonAr || null }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setFlash({ ok: true, msg: isAr ? 'تم حفظ القرار' : 'Decision saved' });
        setSelectedIdea(null);
        setDecision(null);
        router.refresh();
      } else {
        setFlash({ ok: false, msg: j.error || (isAr ? 'فشل الحفظ' : 'Save failed') });
      }
      setTimeout(() => setFlash(null), 3000);
    });
  }

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <KpiCard label={isAr ? 'إجمالي' : 'Total'} value={kpi.total} />
        <KpiCard label={isAr ? 'قيد الفحص' : 'Pending screening'} value={kpi.pending} highlight />
        <KpiCard label={isAr ? 'مُعتمَدة' : 'Approved'} value={kpi.approved} tone="success" />
        <KpiCard label={isAr ? 'مُعادة' : 'Returned'} value={kpi.returned} tone="warning" />
        <KpiCard label={isAr ? 'مرفوضة' : 'Rejected'} value={kpi.rejected} tone="error" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <TabButton active={tab === 'screening'} onClick={() => setTab('screening')}>
          {isAr ? `الفحص (${screeningIdeas.length})` : `Screening (${screeningIdeas.length})`}
        </TabButton>
        <TabButton active={tab === 'tracks'} onClick={() => setTab('tracks')}>
          {isAr ? 'تعيين المسارات' : 'Track assignments'}
        </TabButton>
        <TabButton active={tab === 'archive'} onClick={() => setTab('archive')}>
          {isAr ? 'الأرشيف' : 'Archive'}
        </TabButton>
      </div>

      {flash && (
        <div
          className={`rounded-md border px-4 py-2 text-sm ${flash.ok ? 'border-green-500 bg-green-50 text-green-800' : 'border-red-500 bg-red-50 text-red-800'}`}
        >
          {flash.msg}
        </div>
      )}

      {/* Screening tab */}
      {tab === 'screening' && (
        <>
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder={isAr ? 'ابحث بالعنوان أو الرقم…' : 'Search title or code…'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <select
              value={themeFilter}
              onChange={(e) => setThemeFilter(e.target.value)}
              className="rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">{isAr ? 'كل المسارات' : 'All tracks'}</option>
              {themes.map((t) => (
                <option key={t.id} value={t.id}>
                  {isAr ? t.title_ar || t.title_en : t.title_en || t.title_ar}
                </option>
              ))}
            </select>
          </div>

          {screeningIdeas.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                {isAr ? 'لا توجد أفكار بحاجة إلى الفحص حالياً.' : 'No ideas awaiting screening.'}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {screeningIdeas.map((i) => {
                const theme = i.strategic_theme_id ? themeMap.get(i.strategic_theme_id) : null;
                return (
                  <Card key={i.id} className="flex flex-col">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs text-muted-foreground">{i.code}</div>
                          <CardTitle className="mt-1 truncate text-base">
                            {isAr ? i.title_ar || i.title_en : i.title_en || i.title_ar}
                          </CardTitle>
                          {theme && (
                            <Badge variant="outline" className="mt-2">
                              {isAr ? theme.title_ar || theme.title_en : theme.title_en || theme.title_ar}
                            </Badge>
                          )}
                        </div>
                        <StatusBadge status={i.status as any} locale={locale} />
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col gap-3 pt-0">
                      {i.problem_statement && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground">
                            {isAr ? 'المشكلة' : 'Problem'}
                          </div>
                          <p className="line-clamp-3 text-sm">{i.problem_statement}</p>
                        </div>
                      )}
                      {i.proposed_solution && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground">
                            {isAr ? 'الحل المقترح' : 'Proposed solution'}
                          </div>
                          <p className="line-clamp-3 text-sm">{i.proposed_solution}</p>
                        </div>
                      )}
                      <div className="mt-auto flex flex-wrap gap-2 pt-2">
                        <Button
                          size="sm"
                          onClick={() => openDecision(i, 'approve')}
                          className="bg-green-700 hover:bg-green-800"
                        >
                          {isAr ? 'اعتماد' : 'Approve'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openDecision(i, 'return')}
                        >
                          {isAr ? 'إعادة للمبتكر' : 'Return'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-500 text-red-700 hover:bg-red-50"
                          onClick={() => openDecision(i, 'reject')}
                        >
                          {isAr ? 'رفض' : 'Reject'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Track assignments tab */}
      {tab === 'tracks' && (
        <TrackAssignmentsPanel
          locale={locale}
          themes={themes}
          evaluators={evaluators}
          assignments={trackAssignments}
          onChanged={() => router.refresh()}
        />
      )}

      {/* Archive tab */}
      {tab === 'archive' && (
        <div className="grid gap-3">
          {archiveIdeas.map((i) => {
            const theme = i.strategic_theme_id ? themeMap.get(i.strategic_theme_id) : null;
            return (
              <Card key={i.id}>
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-muted-foreground">{i.code}</div>
                    <div className="truncate font-medium">
                      {isAr ? i.title_ar || i.title_en : i.title_en || i.title_ar}
                    </div>
                    {theme && (
                      <div className="text-xs text-muted-foreground">
                        {isAr ? theme.title_ar || theme.title_en : theme.title_en || theme.title_ar}
                      </div>
                    )}
                    {(i.rejection_reason_ar || i.rejection_reason) && (
                      <div className="mt-1 text-xs text-red-700">
                        {isAr ? i.rejection_reason_ar || i.rejection_reason : i.rejection_reason || i.rejection_reason_ar}
                      </div>
                    )}
                  </div>
                  <StatusBadge status={i.status as any} locale={locale} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Decision modal */}
      {selectedIdea && decision && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelectedIdea(null)}
        >
          <Card className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="text-lg">
                {decision === 'approve' && (isAr ? 'اعتماد الفكرة' : 'Approve idea')}
                {decision === 'reject' && (isAr ? 'رفض الفكرة' : 'Reject idea')}
                {decision === 'return' && (isAr ? 'إعادة للمبتكر' : 'Return to innovator')}
              </CardTitle>
              <div className="text-sm text-muted-foreground">
                {selectedIdea.code} — {isAr ? selectedIdea.title_ar || selectedIdea.title_en : selectedIdea.title_en || selectedIdea.title_ar}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {decision !== 'approve' && (
                <>
                  <div>
                    <Label>{isAr ? 'السبب (عربي)' : 'Reason (Arabic)'}</Label>
                    <Textarea
                      value={reasonAr}
                      onChange={(e) => setReasonAr(e.target.value)}
                      placeholder={isAr ? 'اكتب السبب…' : 'Write reason in Arabic…'}
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>{isAr ? 'السبب (إنجليزي)' : 'Reason (English)'}</Label>
                    <Textarea
                      value={reasonEn}
                      onChange={(e) => setReasonEn(e.target.value)}
                      placeholder={isAr ? 'اكتب السبب بالإنجليزية…' : 'Write reason in English…'}
                      rows={3}
                    />
                  </div>
                </>
              )}
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={submitDecision}
                  disabled={pending}
                  className={
                    decision === 'approve'
                      ? 'bg-green-700 hover:bg-green-800'
                      : decision === 'reject'
                      ? 'bg-red-700 hover:bg-red-800'
                      : ''
                  }
                >
                  {pending ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : isAr ? 'تأكيد' : 'Confirm'}
                </Button>
                <Button variant="outline" onClick={() => setSelectedIdea(null)}>
                  {isAr ? 'إلغاء' : 'Cancel'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  highlight,
  tone,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  tone?: 'success' | 'warning' | 'error';
}) {
  const toneClass =
    tone === 'success'
      ? 'text-green-700'
      : tone === 'warning'
      ? 'text-amber-700'
      : tone === 'error'
      ? 'text-red-700'
      : highlight
      ? 'text-teal-700'
      : '';
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
        active
          ? 'border-teal-600 text-teal-700'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

function TrackAssignmentsPanel({
  locale,
  themes,
  evaluators,
  assignments,
  onChanged,
}: {
  locale: string;
  themes: Theme[];
  evaluators: Evaluator[];
  assignments: TA[];
  onChanged: () => void;
}) {
  const isAr = locale === 'ar';
  const [selectedTheme, setSelectedTheme] = useState<string>(themes[0]?.id ?? '');
  const [selectedEvalIds, setSelectedEvalIds] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string>('');

  const byTheme = useMemo(() => {
    const m = new Map<string, TA[]>();
    for (const a of assignments) {
      const arr = m.get(a.theme_id) ?? [];
      arr.push(a);
      m.set(a.theme_id, arr);
    }
    return m;
  }, [assignments]);

  function assign() {
    if (!selectedTheme || selectedEvalIds.length === 0) return;
    startTransition(async () => {
      const res = await fetch('/api/supervisor/track-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeId: selectedTheme, evaluatorIds: selectedEvalIds }),
      });
      if (res.ok) {
        setMsg(isAr ? 'تم التعيين' : 'Assigned');
        setSelectedEvalIds([]);
        onChanged();
      } else {
        const j = await res.json().catch(() => ({}));
        setMsg(j.error || (isAr ? 'فشل التعيين' : 'Assign failed'));
      }
      setTimeout(() => setMsg(''), 2500);
    });
  }

  function revoke(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/supervisor/track-assignments?id=${id}`, { method: 'DELETE' });
      if (res.ok) onChanged();
    });
  }

  return (
    <div className="space-y-6">
      {/* Assign form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isAr ? 'تعيين مقيّمين لمسار' : 'Assign evaluators to a track'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>{isAr ? 'المسار' : 'Track'}</Label>
            <select
              value={selectedTheme}
              onChange={(e) => setSelectedTheme(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {themes.map((t) => (
                <option key={t.id} value={t.id}>
                  {isAr ? t.title_ar || t.title_en : t.title_en || t.title_ar}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>{isAr ? 'المقيّمون' : 'Evaluators'}</Label>
            <div className="max-h-56 overflow-y-auto rounded-md border p-2">
              {evaluators.length === 0 && (
                <div className="p-3 text-sm text-muted-foreground">
                  {isAr ? 'لا يوجد مقيّمون بعد. أنشئهم من إدارة المستخدمين.' : 'No evaluators yet. Create them via User management.'}
                </div>
              )}
              {evaluators.map((e) => (
                <label key={e.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={selectedEvalIds.includes(e.id)}
                    onChange={(ev) => {
                      setSelectedEvalIds((prev) =>
                        ev.target.checked ? [...prev, e.id] : prev.filter((x) => x !== e.id)
                      );
                    }}
                  />
                  <span className="text-sm">
                    {e.full_name || e.email} {e.email && <span className="text-xs text-muted-foreground">({e.email})</span>}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={assign} disabled={pending || !selectedTheme || selectedEvalIds.length === 0}>
              {pending ? (isAr ? 'جارٍ…' : 'Working…') : isAr ? 'تعيين' : 'Assign'}
            </Button>
            {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
          </div>
        </CardContent>
      </Card>

      {/* Current assignments per track */}
      <div className="space-y-4">
        {themes.map((t) => {
          const rows = byTheme.get(t.id) ?? [];
          return (
            <Card key={t.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {isAr ? t.title_ar || t.title_en : t.title_en || t.title_ar}
                  <span className="ml-2 text-sm text-muted-foreground">
                    ({rows.length} {isAr ? 'مقيّم' : 'evaluators'})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {rows.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    {isAr ? 'لا يوجد مقيّمون معيّنون لهذا المسار.' : 'No evaluators assigned to this track yet.'}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {rows.map((r) => {
                      const ev = evaluators.find((e) => e.id === r.evaluator_id);
                      return (
                        <Badge key={r.id} variant="secondary" className="gap-2 py-1">
                          <span>{ev?.full_name || ev?.email || r.evaluator_id.slice(0, 6)}</span>
                          <button
                            onClick={() => revoke(r.id)}
                            className="text-red-600 hover:text-red-800"
                            title={isAr ? 'إزالة' : 'Remove'}
                          >
                            ×
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
