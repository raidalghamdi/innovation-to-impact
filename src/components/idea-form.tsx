'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/client';
import { uploadEvidence } from '@/lib/storage';
import { notifySupervisorsOfNewIdea } from '@/app/[locale]/ideas/new/actions';
import { getTrackChallenges } from '@/lib/tracks';
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
  Plus,
  Download,
  X,
  FileText,
} from 'lucide-react';
import type { StrategicTheme, Activity } from '@/lib/demo-data';
import { pickFromRow } from '@/lib/i18n-content';

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

type TeamMember = { email: string; name: string };

const MAX_TEAM_MEMBERS = 5;

// Character limits per field.
const LIMITS = { title: 120, summary: 300, description: 2000 };

const DRAFT_KEY = 'gac-idea-draft-v1';

// Attachment constraints — mirror the server-side guard in lib/storage.ts.
const ATTACH_MAX_FILES = 5;
const ATTACH_MAX_BYTES = 10 * 1024 * 1024; // 10MB per file
const ATTACH_ALLOWED_MIME = new Set<string>([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
]);
const ATTACH_ALLOWED_EXT = /\.(pdf|jpe?g|png|docx)$/i;

type Draft = {
  title: string;
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
  const router = useRouter();
  const isAr = locale === 'ar';
  const Chevron = isAr ? ChevronLeft : ChevronRight;
  const ChevronBack = isAr ? ChevronRight : ChevronLeft;

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [theme, setTheme] = useState(themes[0]?.id ?? '');
  const [activity, setActivity] = useState(activities[0]?.id ?? '');
  const [challenge, setChallenge] = useState('');
  const [participation, setParticipation] = useState<'individual' | 'team'>('individual');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([{ email: '', name: '' }]);
  const [teamName, setTeamName] = useState('');
  const [ack, setAck] = useState(false);
  const [terms, setTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  // Attachments selected on step 3. Held in memory until the idea row is
  // created — uploads happen post-insert so we know the linked_entity_id.
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const restored = useRef(false);

  // Challenges are static per track (see lib/tracks.ts). Reset the selection
  // whenever the track changes so a stale challenge from a prior track can't
  // be submitted.
  const challenges = getTrackChallenges(theme, locale);

  // Ref to the current step's heading. On step change we move keyboard focus
  // here so screen readers announce the new section and sighted keyboard users
  // start from the top of the newly revealed content. tabIndex={-1} lets the
  // element receive programmatic focus without being in the tab order.
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  const steps = [tf('steps.basics'), tf('steps.details'), tf('steps.attachments'), tf('steps.review')];

  // On step change, move focus to the step heading so assistive tech reads
  // out the new section and Tab starts from a predictable place.
  useEffect(() => {
    // Skip on initial mount — the URL landing state shouldn't steal focus
    // from whatever the user was doing before the form loaded.
    if (!restored.current) return;
    stepHeadingRef.current?.focus();
  }, [step]);

  // Restore draft on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Draft;
        if (d.title) setTitle(d.title.slice(0, LIMITS.title));
        if (d.description) setDescription(d.description.slice(0, LIMITS.description));
        if (d.theme) setTheme(d.theme);
        if (d.activity) setActivity(d.activity);
        if (d.title || d.description) {
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
        const draft: Draft = { title, description, theme, activity };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        setSavedNote(tf('autosaveSaved'));
      } catch {
        /* ignore */
      }
    }, 700);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, theme, activity]);

  function updateMember(idx: number, patch: Partial<TeamMember>) {
    setTeamMembers((prev) => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  }
  function addMember() {
    setTeamMembers((prev) =>
      prev.length >= MAX_TEAM_MEMBERS ? prev : [...prev, { email: '', name: '' }]
    );
  }
  function removeMember(idx: number) {
    setTeamMembers((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  const validTeamMembers = teamMembers.filter(
    (m) => /\S+@\S+\.\S+/.test(m.email.trim()) && m.name.trim().length > 0
  );

  function suggestTitle() {
    const suggestion = smartTitle(description, locale);
    if (suggestion) setTitle(suggestion.slice(0, LIMITS.title));
  }

  // File intake for the step-3 attachments dropzone. Uploaded files land in a
  // queue that is flushed post-insert. Mirrors the server guard in lib/storage.ts.
  function ingestFiles(incoming: File[]) {
    setAttachError(null);
    if (incoming.length === 0) return;
    const rejected: string[] = [];
    const accepted: File[] = [];
    for (const f of incoming) {
      const mimeOk = ATTACH_ALLOWED_MIME.has(f.type);
      const extOk = ATTACH_ALLOWED_EXT.test(f.name);
      if (!mimeOk && !extOk) {
        rejected.push(`${f.name} — ${tf('attachmentsRejectType')}`);
        continue;
      }
      if (f.size > ATTACH_MAX_BYTES) {
        rejected.push(`${f.name} — ${tf('attachmentsRejectSize')}`);
        continue;
      }
      accepted.push(f);
    }
    setSelectedFiles((prev) => {
      const room = ATTACH_MAX_FILES - prev.length;
      const clipped = accepted.slice(0, Math.max(0, room));
      if (accepted.length > clipped.length) rejected.push(tf('attachmentsRejectCount'));
      return [...prev, ...clipped];
    });
    if (rejected.length > 0) setAttachError(rejected.join(' · '));
  }

  function stepValid(s: number): boolean {
    if (s === 0) {
      // Basics: all fields required. Event (activity) and Track must be set,
      // a challenge must be chosen when the track defines any, and team
      // participation requires a team name plus at least one member with both
      // a name and a valid email.
      const basics = Boolean(activity) && Boolean(theme);
      const challengeOk = challenges.length === 0 || Boolean(challenge);
      const teamOk =
        participation === 'individual' ||
        (teamName.trim().length > 0 && validTeamMembers.length >= 1);
      return basics && challengeOk && teamOk;
    }
    if (s === 1) return title.trim().length > 0 && description.trim().length > 0;
    // Attachments: at least one file must be queued before proceeding.
    if (s === 2) return selectedFiles.length >= 1;
    return true;
  }

  function next() {
    if (!stepValid(step)) {
      setError(step === 2 ? tf('attachmentsRequired') : tf('required'));
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
  const activeActivity = activities.find((a) => a.id === activity);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step !== steps.length - 1) {
      next();
      return;
    }
    if (!ack || !terms) return;
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
    // Summary was removed from the form (folded into the single description
    // field per the 4-page re-order). The long description is stored as the
    // idea's main body in proposed_solution, matching the prior mapping.
    const payload: Record<string, any> = {
      title_ar: isAr ? title : null,
      title_en: !isAr ? title : null,
      proposed_solution: description,
      strategic_theme_id: theme || null,
      activity_id: activity || null,
      ownership_acknowledged: ack,
      status: 'submitted',
      current_stage: 1,
      submitter_id: userData.user.id,
    };
    // Persist to innovation.ideas. Do NOT swallow errors silently — if the
      // insert fails (RLS, missing columns, offline) we must surface the message
    // to the author so they can retry rather than being bounced to an empty
    // /my-ideas page under the illusion of success.
    let newIdeaId: string | null = null;
    {
      const { data: inserted, error: insertErr } = await supabase
        .from('ideas')
        .insert(payload)
        .select('id')
        .single();
      if (insertErr) {
        // eslint-disable-next-line no-console
        console.error('[idea-form] insert failed:', insertErr);
        setError(insertErr.message || tc('genericError'));
        setSubmitting(false);
        return;
      }
      newIdeaId = (inserted as { id?: string } | null)?.id ?? null;
    }
    // Alert supervisors that a new idea is awaiting screening. Best-effort —
    // the server action swallows its own errors, so this never blocks submit.
    if (newIdeaId) {
      try {
        await notifySupervisorsOfNewIdea(newIdeaId);
      } catch {
        /* non-blocking */
      }
    }
    // Upload any queued attachments now that we have an idea id. Uploads are
    // best-effort: a failed attachment doesn't roll back the idea — the author
    // can retry from the idea detail page. Errors are surfaced but non-blocking.
    if (newIdeaId && selectedFiles.length > 0) {
      const failed: string[] = [];
      for (const file of selectedFiles) {
        try {
          const res = await uploadEvidence(file, 'idea_submission', {
            ideaId: newIdeaId,
            entityType: 'idea',
            entityId: newIdeaId,
          });
          if (!res.ok) failed.push(file.name);
        } catch {
          failed.push(file.name);
        }
      }
      if (failed.length > 0) {
        // eslint-disable-next-line no-console
        console.warn('[idea-form] attachment upload(s) failed:', failed);
      }
    }
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    setSubmitting(false);
    // Use a full-page navigation (window.location.assign) rather than
    // router.push here. The idea insert above may have triggered a Supabase
    // JWT refresh in the browser client. Those refreshed cookies live on
    // document.cookie but Next's client router keeps its in-memory RSC
    // payload — meaning the middleware on the next protected route can
    // occasionally see stale auth state and bounce the user to /login
    // right after they submit. A hard navigation forces a full round-trip
    // so middleware reads the fresh cookies from the request.
    if (newIdeaId) {
      window.location.assign(`/${locale}/ideas/${newIdeaId}/submitted`);
    } else {
      window.location.assign(`/${locale}/my-ideas`);
    }
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
      <CardContent className="p-4 sm:p-6">
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

        {/* Live step heading — receives focus on step change so screen readers
            announce each section. Rendered as a visually-subtle H2 so sighted
            users still get the semantic anchor without visual duplication. */}
        <h2
          ref={stepHeadingRef}
          tabIndex={-1}
          className="sr-only"
          aria-live="polite"
        >
          {steps[step]}
        </h2>

        <form onSubmit={onSubmit} className="space-y-5">
          {/* ---- Step 1: Basics ---- */}
          {step === 0 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="activity">
                    {tf('eventLabel')} <span className="text-red-500">*</span>
                  </Label>
                  <select
                    id="activity"
                    value={activity}
                    onChange={(e) => setActivity(e.target.value)}
                    className={selectClass}
                    required
                  >
                    {activities.map((a) => (
                      <option key={a.id} value={a.id}>
                        {pickFromRow(a, 'name', locale)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="theme">
                    {tf('themeLabel')} <span className="text-red-500">*</span>
                  </Label>
                  <select
                    id="theme"
                    value={theme}
                    onChange={(e) => {
                      setTheme(e.target.value);
                      setChallenge('');
                    }}
                    className={selectClass}
                  >
                    {themes.map((th) => (
                      <option key={th.id} value={th.id}>
                        {pickFromRow(th, 'name', locale)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="challenge">
                  {tf('challengeLabel')} <span className="text-red-500">*</span>
                </Label>
                {challenges.length === 0 ? (
                  <p className="rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
                    {tf('challengeNone')}
                  </p>
                ) : (
                  <select
                    id="challenge"
                    value={challenge}
                    onChange={(e) => setChallenge(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">{tf('challengePlaceholder')}</option>
                    {challenges.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">{tf('participationLabel')}</legend>
                <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
                  {(['individual', 'team'] as const).map((opt) => (
                    <label
                      key={opt}
                      className={`flex flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition ${
                        participation === opt
                          ? 'border-brand-teal bg-brand-teal-light/40 font-medium text-brand-teal'
                          : 'border-border hover:border-brand-teal/40'
                      }`}
                    >
                      <input
                        type="radio"
                        name="participation"
                        value={opt}
                        checked={participation === opt}
                        onChange={() => setParticipation(opt)}
                        className="h-4 w-4 accent-brand-teal"
                      />
                      {opt === 'individual' ? tf('participationIndividual') : tf('participationTeam')}
                    </label>
                  ))}
                </div>
              </fieldset>

              {participation === 'team' && (
                <div className="space-y-3 rounded-2xl border border-border bg-muted/20 p-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="team-name">
                      {tf('teamNameLabel')} <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="team-name"
                      type="text"
                      placeholder={tf('teamNamePlaceholder')}
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      dir={isAr ? 'rtl' : 'ltr'}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label>
                      {tf('teamMembersLabel')} <span className="text-red-500">*</span>
                    </Label>
                    <span className="text-xs text-muted-foreground">{tf('teamMembersHint')}</span>
                  </div>
                  <ul className="space-y-2">
                    {teamMembers.map((m, idx) => (
                      <li key={idx} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        {/* Name first in the DOM so that under RTL it lands on
                            the right and the email input on the left. Order is
                            layout-driven, not a label swap. */}
                        <Input
                          type="text"
                          placeholder={tf('teamMemberName')}
                          value={m.name}
                          onChange={(e) => updateMember(idx, { name: e.target.value })}
                          className="flex-1"
                          dir={isAr ? 'rtl' : 'ltr'}
                        />
                        <Input
                          type="email"
                          inputMode="email"
                          placeholder={tf('teamMemberEmail')}
                          value={m.email}
                          onChange={(e) => updateMember(idx, { email: e.target.value })}
                          className="flex-1"
                          dir="ltr"
                        />
                        <button
                          type="button"
                          aria-label={tf('teamMemberRemove')}
                          onClick={() => removeMember(idx)}
                          disabled={teamMembers.length <= 1}
                          className="self-end rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 sm:self-auto"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  {teamMembers.length < MAX_TEAM_MEMBERS && (
                    <Button type="button" size="sm" variant="outline" onClick={addMember}>
                      <Plus className="h-4 w-4" />
                      {tf('teamMemberAdd')}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ---- Step 2: Details ---- */}
          {step === 1 && (
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
                    disabled={!description}
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
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="description">{tf('descriptionLabel')}</Label>
                  <a
                    href="/templates/idea-description-template.docx"
                    download
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-teal underline-offset-2 hover:underline"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {tf('descriptionTemplate')}
                  </a>
                </div>
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
            </div>
          )}

          {/* ---- Step 3: Attachments ---- */}
          {step === 2 && (
            <div className="space-y-3">
              <Label>
                {t('attachments')} <span className="text-red-500">*</span>
              </Label>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-muted/30 p-8 text-center transition hover:border-brand-teal/40">
                <Paperclip className="h-6 w-6 text-brand-teal" aria-hidden="true" />
                <span className="text-sm text-muted-foreground">{tf('attachmentsHint')}</span>
                <span className="text-xs text-muted-foreground">
                  {tf('attachmentsLimit', {
                    count: ATTACH_MAX_FILES,
                    mb: ATTACH_MAX_BYTES / (1024 * 1024),
                  })}
                </span>
                <span className="mt-1 max-w-md text-[11px] leading-relaxed text-muted-foreground">
                  {tf('attachmentsExamples')}
                </span>
                <Input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.docx,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => {
                    ingestFiles(Array.from(e.target.files ?? []));
                    // Reset the input so re-selecting the same file re-fires onChange.
                    e.target.value = '';
                  }}
                />
              </label>
              {attachError && (
                <div
                  role="alert"
                  className="rounded-md bg-amber-50 p-2.5 text-xs text-amber-800"
                >
                  {attachError}
                </div>
              )}
              {selectedFiles.length > 0 && (
                <ul className="space-y-2">
                  {selectedFiles.map((f, idx) => (
                    <li
                      key={`${f.name}-${idx}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-white p-2.5 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-brand-teal" aria-hidden="true" />
                        <span className="truncate">{f.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {(f.size / 1024).toFixed(0)} KB
                        </span>
                      </span>
                      <button
                        type="button"
                        aria-label={tf('attachmentsRemove')}
                        onClick={() =>
                          setSelectedFiles((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* ---- Step 4: Review ---- */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="rounded-lg bg-brand-cyan-light/40 p-3 text-sm text-brand-teal">
                {tf('reviewNote')}
              </p>
              <dl className="divide-y divide-border rounded-xl border border-border">
                <div className="grid grid-cols-1 gap-1 p-3 sm:grid-cols-3 sm:gap-2">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:text-sm sm:normal-case sm:tracking-normal">{tf('titleLabel')}</dt>
                  <dd className="text-sm text-foreground sm:col-span-2">{title || '—'}</dd>
                </div>
                <div className="grid grid-cols-1 gap-1 p-3 sm:grid-cols-3 sm:gap-2">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:text-sm sm:normal-case sm:tracking-normal">{tf('descriptionLabel')}</dt>
                  <dd className="whitespace-pre-wrap text-sm text-foreground sm:col-span-2">
                    {description || '—'}
                  </dd>
                </div>
                <div className="grid grid-cols-1 gap-1 p-3 sm:grid-cols-3 sm:gap-2">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:text-sm sm:normal-case sm:tracking-normal">{tf('themeLabel')}</dt>
                  <dd className="text-sm text-foreground sm:col-span-2">
                    {activeTheme ? pickFromRow(activeTheme, 'name', locale) : '—'}
                  </dd>
                </div>
                <div className="grid grid-cols-1 gap-1 p-3 sm:grid-cols-3 sm:gap-2">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:text-sm sm:normal-case sm:tracking-normal">{tf('eventLabel')}</dt>
                  <dd className="text-sm text-foreground sm:col-span-2">
                    {activeActivity ? pickFromRow(activeActivity, 'name', locale) : '—'}
                  </dd>
                </div>
                {challenge && (
                  <div className="grid grid-cols-1 gap-1 p-3 sm:grid-cols-3 sm:gap-2">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:text-sm sm:normal-case sm:tracking-normal">{tf('challengeLabel')}</dt>
                    <dd className="text-sm text-foreground sm:col-span-2">{challenge}</dd>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-1 p-3 sm:grid-cols-3 sm:gap-2">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:text-sm sm:normal-case sm:tracking-normal">{tf('participationLabel')}</dt>
                  <dd className="text-sm text-foreground sm:col-span-2">
                    {participation === 'team'
                      ? `${tf('participationTeam')} (${validTeamMembers.length})`
                      : tf('participationIndividual')}
                  </dd>
                </div>
              </dl>

              {/* IP + Terms declarations — both required. Replaces the former
                  /ip-sign step; the author confirms authorship and agrees to
                  the hackathon terms inline before submitting. */}
              <div className="space-y-3">
                <label className="flex items-start gap-2 rounded-2xl border border-border bg-muted/40 p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={ack}
                    onChange={(e) => setAck(e.target.checked)}
                    required
                    className="mt-0.5 h-4 w-4 accent-brand-teal"
                  />
                  <span>
                    {tf('ipDeclaration')}{' '}
                    <Link
                      href="/ip-terms"
                      target="_blank"
                      className="font-medium text-brand-teal underline-offset-2 hover:underline"
                    >
                      {t('ownershipAckLink')}
                    </Link>
                  </span>
                </label>
                <label className="flex items-start gap-2 rounded-2xl border border-border bg-muted/40 p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={terms}
                    onChange={(e) => setTerms(e.target.checked)}
                    required
                    className="mt-0.5 h-4 w-4 accent-brand-teal"
                  />
                  <span>
                    {tf('termsAgreePrefix')}{' '}
                    <Link
                      href="/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-brand-teal underline-offset-2 hover:underline"
                    >
                      {tf('termsLink')}
                    </Link>
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Validation error surface. `role="alert"` announces immediately,
              `aria-live="polite"` mirrors the same content for AT that
              prefers the live-region path. The empty div is always rendered
              so screen readers register the live region on mount, not on
              first error. */}
          <div role="alert" aria-live="polite" className="empty:hidden">
            {error && (
              <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                {error}
              </div>
            )}
          </div>

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
                <Button
                  type="button"
                  onClick={next}
                  disabled={step === 2 && selectedFiles.length === 0}
                >
                  {tf('next')}
                  <Chevron className="h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" disabled={submitting || !ack || !terms}>
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
