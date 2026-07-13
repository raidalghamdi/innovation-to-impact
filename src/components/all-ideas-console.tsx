'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Download, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/status-badge';
import { getIdeaAttachments, type SupervisorAttachment } from '@/app/[locale]/supervisor/actions';
import {
  matchesFilter,
  normalizeFilter,
  filterLabel,
  isReturned,
  SUPERVISOR_FILTERS,
  type SupervisorFilter,
} from '@/lib/supervisor-idea-filters';

type TeamMember = { name?: string | null; email?: string | null };

type Idea = {
  id: string;
  code: string | null;
  title_ar: string | null;
  title_en: string | null;
  proposed_solution: string | null;
  strategic_theme_id: string | null;
  activity_id: string | null;
  activity_name_ar: string | null;
  activity_name_en: string | null;
  participation_type: string | null;
  team_name: string | null;
  team_members: TeamMember[] | null;
  challenge: string | null;
  submitter_name: string | null;
  submitter_email: string | null;
  status: string;
  returned_to_innovator?: boolean | null;
  submitted_at: string | null;
  created_at: string | null;
  rejection_reason: string | null;
  rejection_reason_ar: string | null;
};

type Theme = { id: string; title_ar: string | null; title_en: string | null };

type Props = {
  locale: string;
  ideas: Idea[];
  themes: Theme[];
};

// Derive a human "current phase" label from the raw status. The status enum is
// owned by the innovator agent and may use either legacy or new values.
function phaseLabel(idea: Idea, isAr: boolean): string {
  if (isReturned(idea)) return isAr ? 'مُعادة للمبتكر' : 'Returned to innovator';
  switch (idea.status) {
    case 'submitted':
    case 'screening':
    case 'under_screening':
      return isAr ? 'الفرز الأولي' : 'Screening';
    case 'assigned':
    case 'evaluation':
    case 'under_evaluation':
      return isAr ? 'التقييم الفني' : 'Technical evaluation';
    case 'committee':
    case 'under_committee':
      return isAr ? 'التحكيم' : 'Committee';
    case 'approved':
      return isAr ? 'معتمدة' : 'Approved';
    case 'rejected':
      return isAr ? 'مرفوضة' : 'Rejected';
    default:
      return idea.status;
  }
}

export function AllIdeasConsole({ locale, ideas, themes }: Props) {
  const isAr = locale === 'ar';
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filter, setFilter] = useState<SupervisorFilter>(
    normalizeFilter(searchParams.get('filter'))
  );
  const [search, setSearch] = useState('');
  const [themeFilter, setThemeFilter] = useState<string>('all');
  const [pending, startTransition] = useTransition();

  const [viewIdea, setViewIdea] = useState<Idea | null>(null);
  const [decision, setDecision] = useState<'approve' | 'reject' | 'return' | null>(null);
  const [reason, setReason] = useState('');
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);
  const [attachments, setAttachments] = useState<SupervisorAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);

  // Keep the active filter in sync when arriving via a dashboard card link.
  useEffect(() => {
    setFilter(normalizeFilter(searchParams.get('filter')));
  }, [searchParams]);

  useEffect(() => {
    if (!viewIdea) {
      setAttachments([]);
      return;
    }
    let cancelled = false;
    setAttachmentsLoading(true);
    getIdeaAttachments(viewIdea.id)
      .then((rows) => {
        if (!cancelled) setAttachments(rows);
      })
      .catch(() => {
        if (!cancelled) setAttachments([]);
      })
      .finally(() => {
        if (!cancelled) setAttachmentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [viewIdea]);

  const themeMap = useMemo(() => {
    const m = new Map<string, Theme>();
    for (const t of themes) m.set(t.id, t);
    return m;
  }, [themes]);

  const themeName = (id: string | null) => {
    if (!id) return null;
    const th = themeMap.get(id);
    if (!th) return null;
    return isAr ? th.title_ar || th.title_en : th.title_en || th.title_ar;
  };

  const counts = useMemo(() => {
    const c = {} as Record<SupervisorFilter, number>;
    for (const f of SUPERVISOR_FILTERS) c[f] = ideas.filter((i) => matchesFilter(i, f)).length;
    return c;
  }, [ideas]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ideas.filter((i) => {
      if (!matchesFilter(i, filter)) return false;
      if (themeFilter !== 'all' && i.strategic_theme_id !== themeFilter) return false;
      if (!q) return true;
      return (
        (i.title_ar ?? '').toLowerCase().includes(q) ||
        (i.title_en ?? '').toLowerCase().includes(q) ||
        (i.proposed_solution ?? '').toLowerCase().includes(q) ||
        (i.code ?? '').toLowerCase().includes(q)
      );
    });
  }, [ideas, filter, themeFilter, search]);

  function setFilterAndUrl(f: SupervisorFilter) {
    setFilter(f);
    const params = new URLSearchParams(searchParams.toString());
    if (f === 'all') params.delete('filter');
    else params.set('filter', f);
    const qs = params.toString();
    router.replace(`/${locale}/admin/all-ideas${qs ? `?${qs}` : ''}`, { scroll: false });
  }

  function openReview(idea: Idea) {
    setViewIdea(idea);
    setDecision(null);
    setReason('');
  }
  function closeReview() {
    setViewIdea(null);
    setDecision(null);
    setReason('');
  }

  function submitDecision() {
    if (!viewIdea || !decision) return;
    startTransition(async () => {
      const r = reason.trim() || null;
      // Return needs the full section list — mirror the dashboard default of
      // "all sections editable" so an open-ended return is not rejected.
      const editable_sections =
        decision === 'return'
          ? ['activity_id', 'strategic_theme_id', 'challenge', 'participation_type', 'team', 'title', 'proposed_solution', 'attachments']
          : null;
      const res = await fetch(`/api/supervisor/ideas/${viewIdea.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reason: r, reason_ar: r, editable_sections }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setFlash({ ok: true, msg: isAr ? 'تم حفظ القرار' : 'Decision saved' });
        closeReview();
        router.refresh();
      } else {
        const msg =
          j.error === 'reason_required'
            ? isAr
              ? 'سبب الرفض مطلوب'
              : 'Rejection reason is required'
            : j.error || (isAr ? 'فشل الحفظ' : 'Save failed');
        setFlash({ ok: false, msg });
      }
      setTimeout(() => setFlash(null), 3000);
    });
  }

  const rejectBlocked = decision === 'reject' && reason.trim().length === 0;
  const returnBlocked = decision === 'return' && reason.trim().length < 10;

  return (
    <div className="space-y-6">
      {/* Filter chips — mirror the 5 dashboard cards. */}
      <div className="flex flex-wrap gap-2">
        {SUPERVISOR_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilterAndUrl(f)}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              filter === f
                ? 'border-teal-600 bg-brand-teal text-white'
                : 'border-input bg-background hover:border-teal-500'
            }`}
          >
            {filterLabel(f, isAr)}
            <span className="ml-1.5 rtl:mr-1.5 rtl:ml-0 text-xs opacity-80">({counts[f]})</span>
          </button>
        ))}
      </div>

      {/* Track filter (track only, per spec) + text search. */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder={isAr ? 'ابحث بالعنوان أو الرقم…' : 'Search title or code…'}
          aria-label={isAr ? 'ابحث بالعنوان أو الرقم' : 'Search title or code'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <select
          value={themeFilter}
          onChange={(e) => setThemeFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 text-sm"
          aria-label={isAr ? 'تصفية حسب المسار' : 'Filter by track'}
        >
          <option value="all">{isAr ? 'كل المسارات' : 'All tracks'}</option>
          {themes.map((t) => (
            <option key={t.id} value={t.id}>
              {isAr ? t.title_ar || t.title_en : t.title_en || t.title_ar}
            </option>
          ))}
        </select>
      </div>

      {flash && (
        <div
          className={`rounded-md border px-4 py-2 text-sm ${flash.ok ? 'border-green-500 bg-green-50 text-green-800' : 'border-red-500 bg-red-50 text-red-800'}`}
        >
          {flash.msg}
        </div>
      )}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            {isAr ? 'لا توجد أفكار مطابقة.' : 'No matching ideas.'}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-lg border md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <Th>{isAr ? 'الرقم' : 'Number'}</Th>
                  <Th>{isAr ? 'العنوان' : 'Title'}</Th>
                  <Th>{isAr ? 'المسار' : 'Track'}</Th>
                  <Th>{isAr ? 'التحدي' : 'Challenge'}</Th>
                  <Th>{isAr ? 'النوع' : 'Type'}</Th>
                  <Th>{isAr ? 'الحالة' : 'Status'}</Th>
                  <Th>{isAr ? 'المرحلة' : 'Phase'}</Th>
                  <Th>{isAr ? 'الإجراء' : 'Action'}</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((i) => {
                  const members = Array.isArray(i.team_members) ? i.team_members : [];
                  const isTeam = i.participation_type === 'team' || (!i.participation_type && members.length > 0);
                  return (
                    <tr key={i.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{i.code || '—'}</td>
                      <td className="px-3 py-2 font-medium">
                        {isAr ? i.title_ar || i.title_en : i.title_en || i.title_ar}
                      </td>
                      <td className="px-3 py-2">{themeName(i.strategic_theme_id) || '—'}</td>
                      <td className="px-3 py-2">{i.challenge || '—'}</td>
                      <td className="px-3 py-2">
                        {isTeam ? (isAr ? 'فريق' : 'Team') : isAr ? 'فردي' : 'Individual'}
                      </td>
                      <td className="px-3 py-2"><StatusBadge status={i.status} locale={locale} /></td>
                      <td className="px-3 py-2 text-xs">{phaseLabel(i, isAr)}</td>
                      <td className="px-3 py-2">
                        <Button size="sm" variant="outline" onClick={() => openReview(i)}>
                          {isAr ? 'معاينة' : 'Open'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="grid gap-3 md:hidden">
            {rows.map((i) => {
              const members = Array.isArray(i.team_members) ? i.team_members : [];
              const isTeam = i.participation_type === 'team' || (!i.participation_type && members.length > 0);
              return (
                <Card key={i.id} onClick={() => openReview(i)} className="cursor-pointer">
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-mono text-xs text-muted-foreground">{i.code || '—'}</div>
                        <div className="font-medium">
                          {isAr ? i.title_ar || i.title_en : i.title_en || i.title_ar}
                        </div>
                      </div>
                      <StatusBadge status={i.status} locale={locale} />
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                      {themeName(i.strategic_theme_id) && (
                        <Badge variant="outline">{themeName(i.strategic_theme_id)}</Badge>
                      )}
                      <Badge variant="outline">
                        {isTeam ? (isAr ? 'فريق' : 'Team') : isAr ? 'فردي' : 'Individual'}
                      </Badge>
                      <Badge variant="outline">{phaseLabel(i, isAr)}</Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Full-detail preview + decision modal */}
      {viewIdea && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeReview}
        >
          <Card
            className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="shrink-0 border-b">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">{viewIdea.code}</div>
                  <CardTitle className="mt-1 text-lg">
                    {isAr ? viewIdea.title_ar || viewIdea.title_en : viewIdea.title_en || viewIdea.title_ar}
                  </CardTitle>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {themeName(viewIdea.strategic_theme_id) && (
                      <Badge variant="outline">{themeName(viewIdea.strategic_theme_id)}</Badge>
                    )}
                    <StatusBadge status={viewIdea.status} locale={locale} />
                    <span className="text-xs text-muted-foreground">{phaseLabel(viewIdea, isAr)}</span>
                  </div>
                </div>
                <button
                  onClick={closeReview}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={isAr ? 'إغلاق' : 'Close'}
                >
                  ✕
                </button>
              </div>
            </CardHeader>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <CardContent className="space-y-5 py-5">
                {(() => {
                  const activity = isAr
                    ? viewIdea.activity_name_ar || viewIdea.activity_name_en
                    : viewIdea.activity_name_en || viewIdea.activity_name_ar;
                  const members = Array.isArray(viewIdea.team_members) ? viewIdea.team_members : [];
                  const isTeam =
                    viewIdea.participation_type === 'team' || (!viewIdea.participation_type && members.length > 0);
                  return (
                    <>
                      <Field label={isAr ? 'الفعالية' : 'Activity'} value={activity || '—'} />
                      <Field label={isAr ? 'المسار' : 'Track'} value={themeName(viewIdea.strategic_theme_id) || '—'} />
                      {viewIdea.challenge && (
                        <Field label={isAr ? 'التحدي' : 'Challenge'} value={viewIdea.challenge} />
                      )}
                      <Field
                        label={isAr ? 'نوع المشاركة' : 'Participation type'}
                        value={
                          isTeam
                            ? isAr
                              ? `فريق (${members.length} أعضاء)`
                              : `Team (${members.length} members)`
                            : isAr
                              ? 'فردي'
                              : 'Individual'
                        }
                      />
                      {isTeam && viewIdea.team_name && (
                        <Field label={isAr ? 'اسم الفريق' : 'Team name'} value={viewIdea.team_name} />
                      )}
                      {isTeam && members.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {isAr ? 'أعضاء الفريق' : 'Team members'}
                          </div>
                          <ul className="mt-2 space-y-2">
                            {members.map((m, idx) => {
                              const isLeader =
                                !!viewIdea.submitter_email &&
                                !!m?.email &&
                                m.email.toLowerCase() === viewIdea.submitter_email.toLowerCase();
                              return (
                                <li
                                  key={idx}
                                  className="flex flex-col gap-0.5 rounded-md border border-border p-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                                >
                                  <span className="flex items-center gap-2 font-medium">
                                    {m?.name || '—'}
                                    {isLeader && (
                                      <Badge variant="secondary" className="text-[10px]">
                                        {isAr ? 'قائد الفريق' : 'Team leader'}
                                      </Badge>
                                    )}
                                  </span>
                                  {m?.email && (
                                    <span className="text-xs text-muted-foreground" dir="ltr">{m.email}</span>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {isTeam
                            ? isAr
                              ? 'مقدّم الفكرة / قائد الفريق (صاحب الحساب)'
                              : 'Submitter / Team leader (account owner)'
                            : isAr
                              ? 'مقدّم الفكرة'
                              : 'Submitter'}
                        </div>
                        <div className="mt-1 text-sm">
                          <div className="font-medium">{viewIdea.submitter_name || '—'}</div>
                          {viewIdea.submitter_email && (
                            <div className="text-xs text-muted-foreground" dir="ltr">{viewIdea.submitter_email}</div>
                          )}
                        </div>
                      </div>
                      {viewIdea.proposed_solution && (
                        <Field label={isAr ? 'وصف الفكرة' : 'Idea description'} value={viewIdea.proposed_solution} />
                      )}
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {isAr ? 'المرفقات' : 'Attachments'}
                        </div>
                        {attachmentsLoading ? (
                          <div className="mt-1 text-sm text-muted-foreground">{isAr ? 'جارٍ التحميل…' : 'Loading…'}</div>
                        ) : attachments.length === 0 ? (
                          <div className="mt-1 text-sm text-muted-foreground">{isAr ? 'لا توجد مرفقات.' : 'No attachments.'}</div>
                        ) : (
                          <ul className="mt-2 space-y-2">
                            {attachments.map((a) => (
                              <li
                                key={a.id}
                                className="flex items-center justify-between gap-3 rounded-md border border-border p-2 text-sm"
                              >
                                <div className="flex min-w-0 items-center gap-2">
                                  <FileText className="h-4 w-4 shrink-0 text-brand-teal" />
                                  <span className="truncate">{a.filename}</span>
                                </div>
                                {a.url && (
                                  <a
                                    href={a.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand-teal hover:underline"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                    {isAr ? 'تنزيل' : 'Download'}
                                  </a>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </>
                  );
                })()}
                {(viewIdea.rejection_reason_ar || viewIdea.rejection_reason) && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3">
                    <div className="text-xs font-semibold text-red-800">{isAr ? 'سبب سابق' : 'Previous reason'}</div>
                    <p className="mt-1 text-sm text-red-900">
                      {isAr
                        ? viewIdea.rejection_reason_ar || viewIdea.rejection_reason
                        : viewIdea.rejection_reason || viewIdea.rejection_reason_ar}
                    </p>
                  </div>
                )}
              </CardContent>
            </div>

            {/* Decision bar — approve / return / reject */}
            <div className="border-t bg-muted/30 p-4">
              {!decision ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-muted-foreground">
                    {isAr ? 'اتخذ قراراً بشأن هذه الفكرة:' : 'Take a decision on this idea:'}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => { setDecision('approve'); setReason(''); }} className="bg-green-700 hover:bg-green-800">
                      {isAr ? 'اعتماد' : 'Approve'}
                    </Button>
                    <Button variant="outline" onClick={() => { setDecision('return'); setReason(''); }}>
                      {isAr ? 'إعادة للمبتكر' : 'Return'}
                    </Button>
                    <Button
                      variant="outline"
                      className="border-red-500 text-red-700 hover:bg-red-50"
                      onClick={() => { setDecision('reject'); setReason(''); }}
                    >
                      {isAr ? 'رفض' : 'Reject'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm font-semibold">
                    {decision === 'approve' && (isAr ? 'تأكيد الاعتماد' : 'Confirm approval')}
                    {decision === 'reject' && (isAr ? 'تأكيد الرفض' : 'Confirm rejection')}
                    {decision === 'return' && (isAr ? 'إعادة الفكرة للمبتكر' : 'Return idea to innovator')}
                  </div>
                  {decision !== 'approve' && (
                    <div>
                      <Label>
                        {decision === 'return' ? (isAr ? 'ملاحظات المشرف' : 'Supervisor notes') : isAr ? 'سبب الرفض' : 'Rejection reason'}
                      </Label>
                      <Textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder={
                          decision === 'return'
                            ? isAr
                              ? 'اشرح للمبتكر ما يجب تعديله…'
                              : 'Explain to the innovator what needs updating…'
                            : isAr
                              ? 'اكتب سبب الرفض…'
                              : 'Write the rejection reason…'
                        }
                        rows={3}
                      />
                      {returnBlocked && (
                        <div className="mt-1 text-xs text-red-700">
                          {isAr ? 'اكتب سبب الإرجاع (10 أحرف على الأقل).' : 'Enter a return reason (at least 10 characters).'}
                        </div>
                      )}
                      {rejectBlocked && (
                        <div className="mt-1 text-xs text-red-700">
                          {isAr ? 'سبب الرفض مطلوب' : 'Rejection reason is required'}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      onClick={submitDecision}
                      disabled={pending || rejectBlocked || returnBlocked}
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
                    <Button variant="outline" onClick={() => setDecision(null)} disabled={pending}>
                      {isAr ? 'رجوع' : 'Back'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-start font-semibold">{children}</th>;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{value}</p>
    </div>
  );
}
