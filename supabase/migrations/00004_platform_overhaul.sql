-- ============================================================================
-- 00004_platform_overhaul.sql
-- Innovation to Impact — platform overhaul (Session 1)
--
-- Idempotent + additive. Safe to run against the existing `public` schema.
-- Adds: profiles, ideas lifecycle columns, evaluations, notifications,
-- audit_log, idea_feedback, cms_content, plus RLS policies.
--
-- NOTE: The Supabase JS clients are currently configured with
-- `db: { schema: 'innovation' }` while these tables live in `public`.
-- Reconcile that mismatch (Session 2) before the app can read/write these
-- tables directly; until then the app uses a demo-data fallback.
-- ============================================================================

-- Needed for gen_random_uuid()
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- PROFILES (extends auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid references auth.users(id) primary key,
  full_name text,
  full_name_ar text,
  email text unique,
  role text not null default 'submitter'
    check (role in ('submitter','evaluator','judge','admin')),
  organization text,
  department text,
  phone text,
  avatar_url text,
  points int default 0,
  level int default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- IDEAS LIFECYCLE (extend existing ideas table)
-- ---------------------------------------------------------------------------
alter table public.ideas
  add column if not exists lifecycle_status text default 'draft',
  add column if not exists rejection_reason text,
  add column if not exists rejection_reason_ar text,
  add column if not exists revision_count int default 0,
  add column if not exists parent_idea_id uuid references public.ideas(id),
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists approved_at timestamptz;

-- Add the lifecycle_status check constraint only if not already present.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ideas_lifecycle_status_check'
  ) then
    alter table public.ideas
      add constraint ideas_lifecycle_status_check
      check (lifecycle_status in (
        'draft','submitted','under_review','feedback_requested','revised',
        'approved','rejected','pilot','implemented','archived'
      ));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- EVALUATIONS
-- ---------------------------------------------------------------------------
create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid references public.ideas(id) on delete cascade,
  evaluator_id uuid references public.profiles(id),
  strategic_alignment int check (strategic_alignment between 1 and 5),
  innovation int check (innovation between 1 and 5),
  feasibility int check (feasibility between 1 and 5),
  impact int check (impact between 1 and 5),
  effort int check (effort between 1 and 5),
  total_score decimal(4,2),
  comment text,
  comment_ar text,
  recommendation text check (recommendation in ('approve','revise','reject','escalate')),
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- NOTIFICATIONS
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  title_ar text not null,
  body text,
  body_ar text,
  link text,
  read_at timestamptz,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- AUDIT LOG
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  changes jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- FEEDBACK (evaluators -> submitters)
-- ---------------------------------------------------------------------------
create table if not exists public.idea_feedback (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid references public.ideas(id) on delete cascade,
  from_user_id uuid references public.profiles(id),
  message text not null,
  message_ar text,
  requires_revision boolean default false,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- CMS CONTENT
-- ---------------------------------------------------------------------------
create table if not exists public.cms_content (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text,
  title_ar text,
  body jsonb,
  body_ar jsonb,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Helper: is the current user an admin? (SECURITY DEFINER avoids RLS recursion)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.evaluations   enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log     enable row level security;
alter table public.idea_feedback enable row level security;
alter table public.cms_content   enable row level security;

-- ---------------------------------------------------------------------------
-- POLICIES (drop-then-create for idempotency)
-- ---------------------------------------------------------------------------

-- profiles: self read/update; admin all
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_self_insert on public.profiles;
create policy profiles_self_insert on public.profiles
  for insert with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_admin_delete on public.profiles;
create policy profiles_admin_delete on public.profiles
  for delete using (public.is_admin());

-- evaluations: evaluator self CRUD; submitter of idea can read; admin all
drop policy if exists evaluations_read on public.evaluations;
create policy evaluations_read on public.evaluations
  for select using (
    evaluator_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.ideas i
      where i.id = evaluations.idea_id and i.submitter_id = auth.uid()
    )
  );

drop policy if exists evaluations_write on public.evaluations;
create policy evaluations_write on public.evaluations
  for insert with check (evaluator_id = auth.uid() or public.is_admin());

drop policy if exists evaluations_update on public.evaluations;
create policy evaluations_update on public.evaluations
  for update using (evaluator_id = auth.uid() or public.is_admin())
  with check (evaluator_id = auth.uid() or public.is_admin());

drop policy if exists evaluations_delete on public.evaluations;
create policy evaluations_delete on public.evaluations
  for delete using (evaluator_id = auth.uid() or public.is_admin());

-- notifications: user reads/updates own; admin all
drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications
  for insert with check (true);

-- audit_log: admin read only; any authenticated actor may insert own row
drop policy if exists audit_admin_read on public.audit_log;
create policy audit_admin_read on public.audit_log
  for select using (public.is_admin());

drop policy if exists audit_insert on public.audit_log;
create policy audit_insert on public.audit_log
  for insert with check (actor_id = auth.uid() or actor_id is null);

-- idea_feedback: idea owner reads; evaluator creates; admin all
drop policy if exists feedback_read on public.idea_feedback;
create policy feedback_read on public.idea_feedback
  for select using (
    from_user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.ideas i
      where i.id = idea_feedback.idea_id and i.submitter_id = auth.uid()
    )
  );

drop policy if exists feedback_write on public.idea_feedback;
create policy feedback_write on public.idea_feedback
  for insert with check (from_user_id = auth.uid() or public.is_admin());

-- cms_content: public read; admin write
drop policy if exists cms_public_read on public.cms_content;
create policy cms_public_read on public.cms_content
  for select using (true);

drop policy if exists cms_admin_write on public.cms_content;
create policy cms_admin_write on public.cms_content
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------
create index if not exists idx_evaluations_idea on public.evaluations(idea_id);
create index if not exists idx_notifications_user on public.notifications(user_id);
create index if not exists idx_notifications_unread on public.notifications(user_id) where read_at is null;
create index if not exists idx_audit_created on public.audit_log(created_at desc);
create index if not exists idx_feedback_idea on public.idea_feedback(idea_id);
create index if not exists idx_ideas_parent on public.ideas(parent_idea_id);
create index if not exists idx_ideas_lifecycle on public.ideas(lifecycle_status);

-- ---------------------------------------------------------------------------
-- SEED role profiles.
-- Run AFTER creating the four auth users in Supabase Auth, then replace the
-- placeholder UUIDs below with the real auth.users IDs.
-- Demo accounts: <role>@gac-demo.sa / Demo2026!
-- ---------------------------------------------------------------------------
-- insert into public.profiles (id, full_name, full_name_ar, email, role) values
--   ('<submitter-uuid>', 'Demo Submitter', 'مقدّم تجريبي',  'submitter@gac-demo.sa', 'submitter'),
--   ('<evaluator-uuid>', 'Demo Evaluator', 'مُقيّم تجريبي',  'evaluator@gac-demo.sa', 'evaluator'),
--   ('<judge-uuid>',     'Demo Judge',     'مُحكّم تجريبي',   'judge@gac-demo.sa',     'judge'),
--   ('<admin-uuid>',     'Demo Admin',     'مدير تجريبي',    'admin@gac-demo.sa',     'admin')
-- on conflict (id) do update set role = excluded.role;

-- ---------------------------------------------------------------------------
-- Seed CMS content slugs (empty placeholders the admin CMS page can list).
-- ---------------------------------------------------------------------------
insert into public.cms_content (slug, title, title_ar)
values
  ('landing_hero',     'Landing hero',      'واجهة الصفحة الرئيسية'),
  ('countdown_window', 'Countdown window',  'نافذة العد التنازلي'),
  ('roadmap',          'Roadmap',           'خارطة الطريق'),
  ('partners',         'Partners',          'الشركاء'),
  ('events_main',      'Events',            'الفعاليات'),
  ('events_hackathon', 'Hackathon',         'الهاكاثون'),
  ('events_workshops', 'Workshops',         'ورش العمل')
on conflict (slug) do nothing;
