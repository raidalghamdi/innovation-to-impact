-- Migration 00005 — Tamper-evident hash-chained audit ledger
-- Purpose: make innovation.audit_logs append-only-verifiable. Each row's
--   row_hash = sha256(chain_seq || prev_hash || actor_id || action ||
--                     entity_type || entity_id || after_state::text)
-- and prev_hash links to the row with the previous max(chain_seq). A single
-- edit or deletion anywhere in the chain makes verify_audit_chain() report the
-- first broken sequence.
--
-- Author: Raid Alghamdi
-- Date: 2026-07-04
-- Runs manually — do NOT auto-apply.

begin;

create extension if not exists pgcrypto;

-- New columns. before_state complements the existing after_state so logAudit()
-- can record both sides of a change.
alter table innovation.audit_logs
  add column if not exists before_state jsonb,
  add column if not exists prev_hash    text,
  add column if not exists row_hash     text,
  add column if not exists chain_seq    bigserial;

-- Compute the linked hash on insert. Column defaults (chain_seq's sequence)
-- are populated before BEFORE-INSERT triggers fire, so NEW.chain_seq is set.
create or replace function innovation.audit_logs_compute_hash()
returns trigger
language plpgsql
as $$
declare
  v_prev_hash text;
begin
  select al.row_hash
    into v_prev_hash
    from innovation.audit_logs al
   order by al.chain_seq desc
   limit 1;

  new.prev_hash := v_prev_hash;
  new.row_hash := encode(
    digest(
      coalesce(new.chain_seq::text, '')
        || coalesce(new.prev_hash, '')
        || coalesce(new.actor_id::text, '')
        || coalesce(new.action, '')
        || coalesce(new.entity_type, '')
        || coalesce(new.entity_id::text, '')
        || coalesce(new.after_state::text, ''),
      'sha256'
    ),
    'hex'
  );
  return new;
end;
$$;

drop trigger if exists audit_logs_set_hash on innovation.audit_logs;
create trigger audit_logs_set_hash
  before insert on innovation.audit_logs
  for each row
  execute function innovation.audit_logs_compute_hash();

-- Recompute each row in chain_seq order and compare against the stored
-- row_hash. Returns ok=false and the first broken chain_seq if any row was
-- altered, reordered, or deleted (a gap breaks the prev_hash link).
create or replace function innovation.verify_audit_chain()
returns table (ok boolean, first_break_seq bigint)
language plpgsql
stable
as $$
declare
  r            record;
  v_prev_hash  text := null;
  v_expected   text;
begin
  ok := true;
  first_break_seq := null;

  for r in
    select * from innovation.audit_logs order by chain_seq asc
  loop
    v_expected := encode(
      digest(
        coalesce(r.chain_seq::text, '')
          || coalesce(v_prev_hash, '')
          || coalesce(r.actor_id::text, '')
          || coalesce(r.action, '')
          || coalesce(r.entity_type, '')
          || coalesce(r.entity_id::text, '')
          || coalesce(r.after_state::text, ''),
        'sha256'
      ),
      'hex'
    );

    if r.prev_hash is distinct from v_prev_hash or r.row_hash is distinct from v_expected then
      ok := false;
      first_break_seq := r.chain_seq;
      return next;
      return;
    end if;

    v_prev_hash := r.row_hash;
  end loop;

  return next;
end;
$$;

commit;

-- POST-VERIFY (run after applying):
--   select * from innovation.verify_audit_chain();            -- expect ok=t
--   insert into innovation.audit_logs (actor_id, action, entity_type, entity_id, after_state)
--     values (null, 'test.event', 'test', null, '{"x":1}');
--   select chain_seq, prev_hash, row_hash from innovation.audit_logs order by chain_seq desc limit 2;
--   -- Tamper test: update any after_state then re-run verify_audit_chain()
--   --              → ok=f, first_break_seq = the edited row's chain_seq.

-- ROLLBACK (manual):
-- begin;
--   drop trigger if exists audit_logs_set_hash on innovation.audit_logs;
--   drop function if exists innovation.audit_logs_compute_hash();
--   drop function if exists innovation.verify_audit_chain();
--   alter table innovation.audit_logs
--     drop column if exists before_state,
--     drop column if exists prev_hash,
--     drop column if exists row_hash,
--     drop column if exists chain_seq;
-- commit;
