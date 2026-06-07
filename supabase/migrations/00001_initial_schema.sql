-- =====================================================================
-- Innovation-to-Impact Platform — General Authority for Competition (GAC)
-- Migration 00001: Initial schema
-- Idempotent: safe to run multiple times.
-- =====================================================================

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";

-- =====================================================================
-- ENUM TYPES (created idempotently via DO blocks)
-- =====================================================================
do $$ begin
  create type user_category as enum ('employee','startup','citizen','academic','sme','government');
exception when duplicate_object then null; end $$;

do $$ begin
  create type activity_type as enum ('idea_scheme','hackathon','challenge','accelerator','startup_call','award','regulatory_lab');
exception when duplicate_object then null; end $$;

do $$ begin
  create type idea_status as enum ('draft','submitted','screening','needs_completion','evaluation','committee','approved','rejected','returned','assigned','in_pilot','in_implementation','benefits_tracking','closed','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type idea_source as enum ('new','legacy_migration');
exception when duplicate_object then null; end $$;

do $$ begin
  create type confidentiality_level as enum ('public','internal','confidential');
exception when duplicate_object then null; end $$;

do $$ begin
  create type relationship_type as enum ('duplicate','related','derived','merged','cross_theme');
exception when duplicate_object then null; end $$;

do $$ begin
  create type detection_source as enum ('ai','human');
exception when duplicate_object then null; end $$;

do $$ begin
  create type committee_decision_type as enum ('approve','reject','return','study');
exception when duplicate_object then null; end $$;

do $$ begin
  create type benefit_type as enum ('financial','non_financial');
exception when duplicate_object then null; end $$;

do $$ begin
  create type benefit_category as enum ('savings','revenue','service_improvement','citizen_value','policy_effectiveness','capability');
exception when duplicate_object then null; end $$;

do $$ begin
  create type funding_status as enum ('requested','approved','rejected','disbursed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type regulator_type as enum ('SDAIA_NDMO','NCA','DGA','CST','RDIA');
exception when duplicate_object then null; end $$;

do $$ begin
  create type compliance_status as enum ('compliant','in_progress','non_compliant');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ip_type as enum ('patent','trademark','copyright','trade_secret','none');
exception when duplicate_object then null; end $$;

do $$ begin
  create type knowledge_type as enum ('lesson_learned','case_study','playbook','template','failed_experiment');
exception when duplicate_object then null; end $$;

-- =====================================================================
-- TABLES
-- =====================================================================

-- 1. user_profiles (mirrors auth.users)
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'member',
  department text,
  language_preference text not null default 'ar',
  user_category user_category not null default 'employee',
  created_at timestamptz not null default now()
);

-- 2. strategic_themes
create table if not exists public.strategic_themes (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_en text not null,
  description text,
  priority smallint not null default 3,
  owner_id uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 3. activities
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_en text not null,
  type activity_type not null,
  status text not null default 'active',
  start_date date,
  end_date date,
  target_audience text,
  branding_config jsonb default '{}'::jsonb,
  scorecard_config jsonb default '{}'::jsonb,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 4. ideas
create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  title_ar text not null,
  title_en text,
  problem_statement text,
  proposed_solution text,
  expected_benefits text,
  category text,
  strategic_theme_id uuid references public.strategic_themes(id) on delete set null,
  activity_id uuid references public.activities(id) on delete set null,
  status idea_status not null default 'draft',
  current_stage smallint not null default 0 check (current_stage between 0 and 8),
  submitter_id uuid references public.user_profiles(id) on delete set null,
  ownership_acknowledged boolean not null default false,
  attachments jsonb default '[]'::jsonb,
  source idea_source not null default 'new',
  original_source_metadata jsonb default '{}'::jsonb,
  confidentiality confidentiality_level not null default 'internal',
  ip_terms jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. idea_relationships
create table if not exists public.idea_relationships (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  related_idea_id uuid not null references public.ideas(id) on delete cascade,
  relationship_type relationship_type not null,
  confidence_score numeric(4,3),
  detected_by detection_source not null default 'ai',
  approved_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 6. evaluations
create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  evaluator_id uuid references public.user_profiles(id) on delete set null,
  criteria_scores jsonb default '{}'::jsonb,
  total_score numeric(6,2),
  comments text,
  recommendation text,
  conflict_of_interest boolean not null default false,
  submitted_at timestamptz not null default now()
);

-- 7. committee_decisions
create table if not exists public.committee_decisions (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  committee_name text,
  decision committee_decision_type not null,
  quorum_met boolean not null default false,
  comments text,
  attachments jsonb default '[]'::jsonb,
  decided_at timestamptz not null default now(),
  decided_by uuid references public.user_profiles(id) on delete set null
);

-- 8. assignments
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  owner_id uuid references public.user_profiles(id) on delete set null,
  department text,
  due_date date,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

-- 9. pilots
create table if not exists public.pilots (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  hypothesis text,
  experiment_plan text,
  budget numeric(14,2),
  start_date date,
  end_date date,
  milestones jsonb default '[]'::jsonb,
  results text,
  lessons_learned text,
  status text not null default 'planned',
  created_at timestamptz not null default now()
);

-- 10. scale_decisions
create table if not exists public.scale_decisions (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  evidence_of_viability text,
  value_assessment text,
  risk_assessment text,
  strategic_fit_score numeric(4,2),
  decision text,
  decided_at timestamptz not null default now(),
  decided_by uuid references public.user_profiles(id) on delete set null
);

-- 11. implementations
create table if not exists public.implementations (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  operational_owner text,
  integration_plan text,
  resource_commitment text,
  handover_status text not null default 'pending',
  line_unit text,
  created_at timestamptz not null default now()
);

-- 12. benefits
create table if not exists public.benefits (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  benefit_type benefit_type not null,
  category benefit_category not null,
  target_value numeric(16,2),
  realized_value numeric(16,2),
  measurement_unit text,
  measurement_date date,
  evidence jsonb default '[]'::jsonb,
  verified_by uuid references public.user_profiles(id) on delete set null
);

-- 13. funding_requests
create table if not exists public.funding_requests (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  amount_sar numeric(16,2) not null,
  justification text,
  status funding_status not null default 'requested',
  approved_amount numeric(16,2),
  approver_id uuid references public.user_profiles(id) on delete set null,
  decided_at timestamptz
);

-- 14. compliance_controls
create table if not exists public.compliance_controls (
  id uuid primary key default gen_random_uuid(),
  regulator regulator_type not null,
  clause text not null,
  applicability text,
  owner_id uuid references public.user_profiles(id) on delete set null,
  evidence_required text,
  mapped_feature text,
  review_cycle text,
  status compliance_status not null default 'in_progress',
  last_review_date date
);

-- 15. ip_records
create table if not exists public.ip_records (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid references public.ideas(id) on delete cascade,
  ip_type ip_type not null default 'none',
  ownership_party text,
  confidentiality_terms text,
  nda_required boolean not null default false,
  nda_signed_at timestamptz,
  participation_conditions text,
  created_at timestamptz not null default now()
);

-- 16. knowledge_articles
create table if not exists public.knowledge_articles (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid references public.ideas(id) on delete set null,
  title_ar text not null,
  title_en text,
  type knowledge_type not null,
  content_md text,
  tags text[] default '{}',
  visibility text not null default 'internal',
  author_id uuid references public.user_profiles(id) on delete set null,
  published_at timestamptz default now()
);

-- 17. audit_logs
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  actor_id uuid references public.user_profiles(id) on delete set null,
  before_state jsonb,
  after_state jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

-- 18. notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.user_profiles(id) on delete cascade,
  type text,
  title_ar text,
  title_en text,
  body_ar text,
  body_en text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- INDEXES
-- =====================================================================
create index if not exists idx_ideas_status on public.ideas(status);
create index if not exists idx_ideas_stage on public.ideas(current_stage);
create index if not exists idx_ideas_theme on public.ideas(strategic_theme_id);
create index if not exists idx_ideas_activity on public.ideas(activity_id);
create index if not exists idx_evaluations_idea on public.evaluations(idea_id);
create index if not exists idx_decisions_idea on public.committee_decisions(idea_id);
create index if not exists idx_benefits_idea on public.benefits(idea_id);
create index if not exists idx_compliance_regulator on public.compliance_controls(regulator);
create index if not exists idx_notifications_user on public.notifications(user_id);

-- =====================================================================
-- UPDATED_AT TRIGGER for ideas
-- =====================================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_ideas_updated_at on public.ideas;
create trigger trg_ideas_updated_at
  before update on public.ideas
  for each row execute function public.set_updated_at();

-- =====================================================================
-- NEW USER PROFILE TRIGGER
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- ROW LEVEL SECURITY
-- Default: authenticated users can read; admins & idea owners can modify.
-- =====================================================================

-- Helper: is the current user an admin?
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- Enable RLS on all tables
do $$
declare t text;
begin
  foreach t in array array[
    'user_profiles','strategic_themes','activities','ideas','idea_relationships',
    'evaluations','committee_decisions','assignments','pilots','scale_decisions',
    'implementations','benefits','funding_requests','compliance_controls',
    'ip_records','knowledge_articles','audit_logs','notifications'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end $$;

-- Generic read policy for authenticated users on most tables
do $$
declare t text;
begin
  foreach t in array array[
    'strategic_themes','activities','ideas','idea_relationships',
    'evaluations','committee_decisions','assignments','pilots','scale_decisions',
    'implementations','benefits','funding_requests','compliance_controls',
    'ip_records','knowledge_articles'
  ] loop
    execute format('drop policy if exists "read_auth_%1$s" on public.%1$I;', t);
    execute format(
      'create policy "read_auth_%1$s" on public.%1$I for select to authenticated using (true);',
      t
    );
    -- admins can do everything
    execute format('drop policy if exists "admin_all_%1$s" on public.%1$I;', t);
    execute format(
      'create policy "admin_all_%1$s" on public.%1$I for all to authenticated using (public.is_admin()) with check (public.is_admin());',
      t
    );
  end loop;
end $$;

-- user_profiles: each user reads all, updates own; admins manage all
drop policy if exists "profiles_read" on public.user_profiles;
create policy "profiles_read" on public.user_profiles
  for select to authenticated using (true);

drop policy if exists "profiles_update_own" on public.user_profiles;
create policy "profiles_update_own" on public.user_profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "profiles_admin_all" on public.user_profiles;
create policy "profiles_admin_all" on public.user_profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ideas: owners (submitters) can insert / update their own ideas
drop policy if exists "ideas_insert_own" on public.ideas;
create policy "ideas_insert_own" on public.ideas
  for insert to authenticated with check (submitter_id = auth.uid());

drop policy if exists "ideas_update_own" on public.ideas;
create policy "ideas_update_own" on public.ideas
  for update to authenticated using (submitter_id = auth.uid()) with check (submitter_id = auth.uid());

-- notifications: users see and update only their own
drop policy if exists "notif_own" on public.notifications;
create policy "notif_own" on public.notifications
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- audit_logs: read for authenticated, write via service role only (no insert policy)
drop policy if exists "audit_read" on public.audit_logs;
create policy "audit_read" on public.audit_logs
  for select to authenticated using (true);
