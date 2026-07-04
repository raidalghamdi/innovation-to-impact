-- Migration 00012 — Evidence upload via Supabase Storage (WS7 Data Ingress F1)
-- Purpose: a private `evidence` bucket plus an innovation.evidence_attachments
--   ledger so uploaded files can be linked to an idea/evaluation/committee
--   decision/compliance control/implementation and served back via signed URLs.
-- Storage layout: evidence/{uploader-uid}/{entity_type}/{entity_id}/{filename}
--   — the leading uid segment lets RLS scope writes to the owner cheaply.
--
-- Author: Raid Alghamdi
-- Date: 2026-07-04
-- Runs manually — do NOT auto-apply.

begin;

-- 1. Private bucket. Idempotent: skip if it already exists.
insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', false)
on conflict (id) do nothing;

-- 2. Attachment ledger.
create table if not exists innovation.evidence_attachments (
  id                 uuid primary key default gen_random_uuid(),
  idea_id            uuid references innovation.ideas(id) on delete cascade,
  uploader_id        uuid references innovation.user_profiles(id) on delete set null,
  storage_path       text not null,
  filename           text not null,
  content_type       text,
  size_bytes         bigint,
  context            text not null default 'idea_submission'
                     check (context in
                       ('idea_submission','evaluation','committee','compliance','implementation')),
  linked_entity_type text,
  linked_entity_id   uuid,
  uploaded_at        timestamptz not null default now(),
  deleted_at         timestamptz
);

create index if not exists idx_evidence_linked
  on innovation.evidence_attachments (linked_entity_type, linked_entity_id)
  where deleted_at is null;
create index if not exists idx_evidence_idea
  on innovation.evidence_attachments (idea_id)
  where deleted_at is null;

alter table innovation.evidence_attachments enable row level security;

-- Admins: full access.
drop policy if exists evidence_admin_all on innovation.evidence_attachments;
create policy evidence_admin_all
  on innovation.evidence_attachments
  for all
  to authenticated
  using (
    exists (select 1 from innovation.user_profiles up
             where up.id = auth.uid() and up.role = 'admin')
  )
  with check (
    exists (select 1 from innovation.user_profiles up
             where up.id = auth.uid() and up.role = 'admin')
  );

-- Uploaders: insert + read + soft-delete their own rows.
drop policy if exists evidence_uploader_own on innovation.evidence_attachments;
create policy evidence_uploader_own
  on innovation.evidence_attachments
  for all
  to authenticated
  using (uploader_id = auth.uid())
  with check (uploader_id = auth.uid());

-- Idea stakeholders can read evidence tied to that idea: the submitter, an
-- assigned evaluator, and any judge.
drop policy if exists evidence_idea_stakeholders on innovation.evidence_attachments;
create policy evidence_idea_stakeholders
  on innovation.evidence_attachments
  for select
  to authenticated
  using (
    idea_id is not null and (
      exists (select 1 from innovation.ideas i
               where i.id = innovation.evidence_attachments.idea_id
                 and i.submitter_id = auth.uid())
      or exists (select 1 from innovation.assignments a
                  where a.idea_id = innovation.evidence_attachments.idea_id
                    and a.evaluator_id = auth.uid())
      or exists (select 1 from innovation.user_profiles up
                  where up.id = auth.uid() and up.role in ('judge','admin'))
    )
  );

-- 3. Storage object policies on the evidence bucket.
--    Writes: authenticated users may only touch objects under their own uid
--    folder (evidence/{uid}/...). Reads: owner folder, or admin/judge (all).
drop policy if exists evidence_obj_insert_own on storage.objects;
create policy evidence_obj_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists evidence_obj_update_own on storage.objects;
create policy evidence_obj_update_own
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'evidence' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists evidence_obj_delete_own on storage.objects;
create policy evidence_obj_delete_own
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'evidence' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists evidence_obj_read on storage.objects;
create policy evidence_obj_read
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'evidence' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from innovation.user_profiles up
                  where up.id = auth.uid() and up.role in ('judge','admin'))
    )
  );

commit;

-- POST-VERIFY:
--   select id, public from storage.buckets where id = 'evidence';
--   select count(*) from innovation.evidence_attachments;
--   -- as uploader: expect only own rows; as admin: expect all.
--
-- ROLLBACK (manual):
-- begin;
--   drop policy if exists evidence_obj_read        on storage.objects;
--   drop policy if exists evidence_obj_delete_own  on storage.objects;
--   drop policy if exists evidence_obj_update_own  on storage.objects;
--   drop policy if exists evidence_obj_insert_own  on storage.objects;
--   drop policy if exists evidence_admin_all           on innovation.evidence_attachments;
--   drop policy if exists evidence_uploader_own        on innovation.evidence_attachments;
--   drop policy if exists evidence_idea_stakeholders   on innovation.evidence_attachments;
--   drop table if exists innovation.evidence_attachments;
--   delete from storage.buckets where id = 'evidence';
-- commit;
