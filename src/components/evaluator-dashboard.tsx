'use client';

// Evaluator dashboard — batch 07/26 rebuild.
//
// Replaces the previous minimalist queue with a full workflow surface:
//   1. Summary KPI cards (assigned / completed / remaining / progress / next due)
//   2. Filter bar (track, status, due-date search)
//   3. Rich queue list with color-coded status pill per item
//   4. Idea detail card — title, description, team, track, attachments,
//      video, innovation score
//   5. Inline scorecard + evidence uploader
//   6. Notification banner (pending count / next due / autosave / all done)
//
// Server data comes from fetchEvaluatorDashboard (single roundtrip). All
// filtering is client-side over the initial queue snapshot.

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EvaluationScorecard } from '@/components/evaluation-scorecard';
import { EvidenceUploader } from '@/components/evidence-uploader';
import { cn } from '@/lib/utils';
import { pickFromRow } from '@/lib/i18n-content';
import type { EvaluatorDashboard, EvaluatorQueueItem } from '@/lib/data';
import {
  CheckCircle2,
  Clock,
  Circle,
  AlertTriangle,
  Filter,
  Search,
  Users,
  Target,
  Paperclip,
  Video,
  Sparkles,
  BellRing,
  CalendarClock,
  Play,
} from 'lucide-react';

type StatusKey = EvaluatorQueueItem['eval_status'];

// Status pill palette. Values match the user's spec:
//  🟢 submitted, 🟡 in_progress, ⚪ not_started, 🔴 needs_review
const STATUS_META: Record<StatusKey, { dot: string; badge: string; icon: any; labelKey: string }> = {
  submitted: {
    dot: 'bg-emerald-500',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    icon: CheckCircle2,
    labelKey: 'statusSubmitted',
  },
  in_progress: {
    dot: 'bg-amber-500',
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
    icon: Clock,
    labelKey: 'statusInProgress',
  },
  not_started: {
    dot: 'bg-slate-400',
    badge: 'border-slate-200 bg-slate-50 text-slate-700',
    icon: Circle,
    labelKey: 'statusNotStarted',
  },
  needs_review: {
    dot: 'bg-rose-500',
    badge: 'border-rose-200 bg-rose-50 text-rose-700',
    icon: AlertTriangle,
    labelKey: 'statusNeedsReview',
  },
};

function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function daysBetween(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

export function EvaluatorDashboardView({
  dashboard,
  locale,
}: {
  dashboard: EvaluatorDashboard;
  locale: string;
}) {
  const t = useTranslations('evaluation');
  const router = useRouter();
  const isAr = locale === 'ar';

  // Selected idea starts at the first non-submitted item (evaluator's next
  // actual work) rather than blindly index 0.
  const initialSelection =
    dashboard.queue.find((q) => q.eval_status !== 'submitted')?.idea_id ??
    dashboard.queue[0]?.idea_id ??
    null;
  const [selectedId, setSelectedId] = useState<string | null>(initialSelection);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusKey | 'all'>('all');
  const [trackFilter, setTrackFilter] = useState<string>('all');
  const [dueFilter, setDueFilter] = useState<'all' | 'today' | 'week' | 'overdue'>('all');
  const [search, setSearch] = useState<string>('');

  const tracks = useMemo(() => {
    const seen = new Map<string, { id: string; label: string }>();
    for (const item of dashboard.queue) {
      if (!item.theme_id) continue;
      if (seen.has(item.theme_id)) continue;
      const label = pickFromRow({ title_ar: item.theme_ar ?? '', title_en: item.theme_en ?? '' }, 'title', locale) || item.theme_id;
      seen.set(item.theme_id, { id: item.theme_id, label });
    }
    return Array.from(seen.values());
  }, [dashboard.queue, locale]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const dayMs = 86_400_000;
    return dashboard.queue.filter((item) => {
      if (statusFilter !== 'all' && item.eval_status !== statusFilter) return false;
      if (trackFilter !== 'all' && item.theme_id !== trackFilter) return false;
      if (dueFilter !== 'all') {
        // Any item without a due date is excluded from due-filtered views.
        if (!item.due_at) return false;
        const dt = new Date(item.due_at).getTime();
        if (dueFilter === 'overdue' && dt >= now) return false;
        if (dueFilter === 'today' && (dt < now || dt - now > dayMs)) return false;
        if (dueFilter === 'week' && (dt < now || dt - now > 7 * dayMs)) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const title = (item.title_ar ?? '').toLowerCase() + ' ' + (item.title_en ?? '').toLowerCase();
        const code = (item.idea_code ?? '').toLowerCase();
        if (!title.includes(q) && !code.includes(q)) return false;
      }
      return true;
    });
  }, [dashboard.queue, statusFilter, trackFilter, dueFilter, search]);

  const selected = selectedId ? dashboard.queue.find((q) => q.idea_id === selectedId) : null;

  const pendingCount = dashboard.notStarted + dashboard.inProgress + dashboard.needsReview;
  const nextDueDays = daysBetween(dashboard.nextDueAt);
  const allDone = dashboard.totalAssigned > 0 && dashboard.completed === dashboard.totalAssigned;

  return (
    <div className="space-y-6">
      {/* Anonymization notice */}
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {isAr
          ? 'تنويه: تظهر الأفكار مجهولة المصدر — لا يمكنك رؤية المبتكر، الفريق، أو تقييمات المقيّمين الآخرين.'
          : 'Notice: ideas are anonymized — innovator identity, team, and other evaluators’ scores are hidden.'}
      </div>

      {/* Notification banner */}
      {allDone ? (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">{t('notif.allDone')}</p>
        </div>
      ) : pendingCount > 0 ? (
        <div className="flex flex-wrap items-start gap-3 rounded-xl border border-brand-teal/30 bg-brand-teal-light/40 p-4 text-brand-teal">
          <BellRing className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">{t('notif.pending', { count: pendingCount })}</p>
            {nextDueDays !== null && (
              <p className="mt-1 text-brand-teal-dark/80">
                {nextDueDays < 0
                  ? t('notif.overdue', { days: Math.abs(nextDueDays) })
                  : t('notif.nextDue', { days: nextDueDays, date: formatDate(dashboard.nextDueAt, locale) })}
              </p>
            )}
          </div>
          {dashboard.overdueCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              {t('notif.overdueBadge', { count: dashboard.overdueCount })}
            </span>
          )}
        </div>
      ) : null}

      {/* KPI summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard
          icon={<Target className="h-5 w-5" />}
          label={t('kpi.assigned')}
          value={dashboard.totalAssigned}
          tone="teal"
        />
        <KpiCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label={t('kpi.completed')}
          value={dashboard.completed}
          tone="emerald"
        />
        <KpiCard
          icon={<Clock className="h-5 w-5" />}
          label={t('kpi.remaining')}
          value={pendingCount}
          tone="amber"
        />
        <KpiCard
          icon={<Sparkles className="h-5 w-5" />}
          label={t('kpi.progress')}
          value={`${dashboard.completionPct}%`}
          tone="gold"
          footer={
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full bg-white transition-all"
                style={{ width: `${Math.max(0, Math.min(100, dashboard.completionPct))}%` }}
              />
            </div>
          }
        />
        <KpiCard
          icon={<CalendarClock className="h-5 w-5" />}
          label={t('kpi.nextDue')}
          value={dashboard.nextDueAt ? formatDate(dashboard.nextDueAt, locale) : '—'}
          tone="rose"
          small
        />
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-6">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="h-4 w-4" />
            {t('filters.title')}
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="min-h-[40px] rounded-md border border-input bg-background px-3 text-sm"
            aria-label={t('filters.status')}
          >
            <option value="all">{t('filters.allStatuses')}</option>
            <option value="not_started">{t('statusNotStarted')}</option>
            <option value="in_progress">{t('statusInProgress')}</option>
            <option value="submitted">{t('statusSubmitted')}</option>
            <option value="needs_review">{t('statusNeedsReview')}</option>
          </select>
          <select
            value={trackFilter}
            onChange={(e) => setTrackFilter(e.target.value)}
            className="min-h-[40px] rounded-md border border-input bg-background px-3 text-sm"
            aria-label={t('filters.track')}
          >
            <option value="all">{t('filters.allTracks')}</option>
            {tracks.map((tr) => (
              <option key={tr.id} value={tr.id}>{tr.label}</option>
            ))}
          </select>
          <select
            value={dueFilter}
            onChange={(e) => setDueFilter(e.target.value as any)}
            className="min-h-[40px] rounded-md border border-input bg-background px-3 text-sm"
            aria-label={t('filters.due')}
          >
            <option value="all">{t('filters.allDates')}</option>
            <option value="today">{t('filters.dueToday')}</option>
            <option value="week">{t('filters.dueWeek')}</option>
            <option value="overdue">{t('filters.overdue')}</option>
          </select>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('filters.searchPlaceholder')}
              className="min-h-[40px] w-full rounded-md border border-input bg-background ps-9 pe-3 text-sm"
              aria-label={t('filters.search')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Queue + Detail */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Queue list */}
        <div className="space-y-2 lg:col-span-1">
          <h2 className="section-title mb-2">{t('queueHeading', { count: filtered.length })}</h2>
          {filtered.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">{t('queueEmpty')}</CardContent></Card>
          ) : (
            filtered.map((item) => {
              const meta = STATUS_META[item.eval_status];
              const Icon = meta.icon;
              const active = selectedId === item.idea_id;
              return (
                <button
                  key={item.idea_id}
                  type="button"
                  onClick={() => setSelectedId(item.idea_id)}
                  className={cn(
                    'w-full rounded-lg border p-3 text-start transition-all',
                    active
                      ? 'border-brand-teal bg-brand-teal-light shadow-sm'
                      : 'border-border bg-card hover:border-brand-teal/40 hover:shadow-sm'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-brand-gold">{item.idea_code ?? '—'}</span>
                    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', meta.badge)}>
                      <Icon className="h-3 w-3" />
                      {t(meta.labelKey)}
                    </span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm font-medium">
                    {pickFromRow(item, 'title', locale) || t('untitled')}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    {item.theme_ar || item.theme_en ? (
                      <span className="inline-flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        {pickFromRow({ title_ar: item.theme_ar ?? '', title_en: item.theme_en ?? '' }, 'title', locale)}
                      </span>
                    ) : null}
                    {item.due_at ? (
                      <span className={cn('inline-flex items-center gap-1', new Date(item.due_at).getTime() < Date.now() && item.eval_status !== 'submitted' ? 'font-semibold text-rose-600' : '')}>
                        <CalendarClock className="h-3 w-3" />
                        {formatDate(item.due_at, locale)}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Detail */}
        <div className="space-y-4 lg:col-span-2">
          {selected ? (
            <>
              <IdeaDetailCard item={selected} locale={locale} t={t} />
              <Card>
                <CardContent className="pt-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-brand-teal">{t('scorecard')}</h3>
                    {selected.eval_status !== 'submitted' && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-gold/15 px-3 py-1 text-xs font-medium text-brand-gold-dark">
                        <Play className="h-3 w-3" />
                        {t('startEvaluation')}
                      </span>
                    )}
                  </div>
                  <EvaluationScorecard
                    key={selected.idea_id}
                    ideaId={selected.idea_id}
                    onSaved={() => router.refresh()}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <h3 className="mb-3 text-base font-semibold text-brand-teal">{t('evidenceTitle')}</h3>
                  <EvidenceUploader
                    key={`ev-${selected.idea_id}`}
                    entityType="idea"
                    entityId={selected.idea_id}
                    ideaId={selected.idea_id}
                    context="evaluation"
                    locale={locale}
                  />
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                {t('selectIdea')}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  tone,
  footer,
  small,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone: 'teal' | 'emerald' | 'amber' | 'gold' | 'rose';
  footer?: React.ReactNode;
  small?: boolean;
}) {
  const tones: Record<typeof tone, string> = {
    teal: 'from-brand-teal to-brand-teal-dark text-white',
    emerald: 'from-emerald-600 to-emerald-700 text-white',
    amber: 'from-amber-500 to-amber-600 text-white',
    gold: 'from-brand-gold to-brand-gold-dark text-white',
    rose: 'from-rose-500 to-rose-600 text-white',
  };
  return (
    <div className={cn('rounded-xl bg-gradient-to-br p-4 shadow-sm', tones[tone])}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium opacity-90">{label}</span>
        <span className="opacity-90">{icon}</span>
      </div>
      <p className={cn('mt-2 font-bold tabular-nums', small ? 'text-lg' : 'text-3xl')}>{value}</p>
      {footer}
    </div>
  );
}

function IdeaDetailCard({
  item,
  locale,
  t,
}: {
  item: EvaluatorQueueItem;
  locale: string;
  t: any;
}) {
  const meta = STATUS_META[item.eval_status];
  const Icon = meta.icon;
  const title = pickFromRow(item, 'title', locale) || t('untitled');
  const theme = pickFromRow({ title_ar: item.theme_ar ?? '', title_en: item.theme_en ?? '' }, 'title', locale);
  // Team info is intentionally hidden from evaluators to preserve anonymity —
  // the backend also strips it, this is the second line of defense.
  const team = '';

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-brand-gold">{item.idea_code ?? '—'}</span>
              <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium', meta.badge)}>
                <Icon className="h-3.5 w-3.5" />
                {t(meta.labelKey)}
              </span>
            </div>
            <h3 className="mt-1.5 text-xl font-bold text-brand-teal">{title}</h3>
          </div>
          {item.innovation_score !== null && (
            <div className="rounded-lg border border-brand-gold/40 bg-brand-gold/5 px-3 py-2 text-center">
              <p className="text-[10px] uppercase tracking-wide text-brand-gold-dark">{t('innovationScore')}</p>
              <p className="text-lg font-bold text-brand-gold-dark tabular-nums">{item.innovation_score.toFixed(1)}</p>
            </div>
          )}
        </div>

        {/* Meta grid */}
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3 text-sm sm:grid-cols-4">
          {theme && (
            <MetaCell icon={<Target className="h-4 w-4" />} label={t('meta.track')} value={theme} />
          )}
          {/* Team cell removed — evaluator sees ideas anonymously. */}
          <MetaCell icon={<Paperclip className="h-4 w-4" />} label={t('meta.attachments')} value={String(item.attachments_count)} />
          <MetaCell icon={<Video className="h-4 w-4" />} label={t('meta.video')} value={item.has_video ? t('meta.videoYes') : t('meta.videoNo')} />
        </div>

        {/* Description sections */}
        {(item.problem_statement || item.proposed_solution || item.expected_benefits) && (
          <div className="mt-4 space-y-3 text-sm">
            {item.problem_statement && (
              <Section label={t('meta.problem')} value={item.problem_statement} />
            )}
            {item.proposed_solution && (
              <Section label={t('meta.solution')} value={item.proposed_solution} />
            )}
            {item.expected_benefits && (
              <Section label={t('meta.benefits')} value={item.expected_benefits} />
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <a href={`/${locale}/ideas/${item.idea_id}`} target="_blank" rel="noopener noreferrer">
              {t('openFullIdea')}
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MetaCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 truncate text-sm font-medium">{value}</p>
    </div>
  );
}

function Section({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 leading-relaxed">{value}</p>
    </div>
  );
}
