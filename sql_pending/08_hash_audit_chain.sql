-- 08_hash_audit_chain.sql  (P0 governance — tamper-evident audit ledger)
--
-- Makes innovation.audit_logs verifiable as an append-only ledger. Each row is
-- assigned a monotonic chain_seq and a row_hash that folds in the PREVIOUS
-- row's row_hash plus this row's core fields:
--
--   row_hash = sha256( prev_hash || entity_type|entity_id|action|actor_id|created_at )
--
-- A single edit, deletion, or reorder anywhere in the chain breaks every
-- subsequent link, and innovation.verify_audit_chain() reports the first
-- broken sequence. Runs manually — do NOT auto-apply.
--
-- Derived from migration 00005_audit_hash_chain.sql (bytea variant).

begin;

create extension if not exists pgcrypto;

-- 1. Chain columns.
alter table innovation.audit_logs
  add column if not exists chain_seq bigint,
  add column if not exists row_hash  bytea,
  add column if not exists prev_hash bytea;

-- 2. BEFORE-INSERT trigger: assign the next chain_seq, link prev_hash to the
--    current tip's row_hash, and compute this row's row_hash. created_at's
--    default is populated before BEFORE-INSERT triggers fire, so NEW.created_at
--    is stable and matches what verify_audit_chain() will later read back.
create or replace function innovation.audit_logs_chain_before_insert()
returns trigger
language plpgsql
as $$
declare
  v_prev_seq  bigint;
  v_prev_hash bytea;
begin
  select al.chain_seq, al.row_hash
    into v_prev_seq, v_prev_hash
    from innovation.audit_logs al
   order by al.chain_seq desc nulls last
   limit 1;

  new.chain_seq := coalesce(v_prev_seq, 0) + 1;
  new.prev_hash := v_prev_hash;
  new.row_hash  := digest(
    coalesce(v_prev_hash, ''::bytea)
      || convert_to(
           coalesce(new.entity_type, '') || '|'
             || coalesce(new.entity_id::text, '') || '|'
             || coalesce(new.action, '') || '|'
             || coalesce(new.actor_id::text, '') || '|'
             || coalesce(new.created_at::text, ''),
           'UTF8'
         ),
    'sha256'
  );
  return new;
end;
$$;

drop trigger if exists audit_logs_chain_trg on innovation.audit_logs;
create trigger audit_logs_chain_trg
  before insert on innovation.audit_logs
  for each row
  execute function innovation.audit_logs_chain_before_insert();

-- 3. Verifier. Recomputes each row's hash in chain_seq order using the SAME
--    formula as the trigger/backfill and compares against the stored values.
--    Returns one row for the FIRST break (empty result set = chain intact).
create or replace function innovation.verify_audit_chain()
returns table (broken_seq bigint, expected_hash bytea, actual_hash bytea)
language plpgsql
stable
as $$
declare
  r           record;
  v_prev_hash bytea := null;
  v_expected  bytea;
begin
  for r in
    select * from innovation.audit_logs order by chain_seq asc
  loop
    v_expected := digest(
      coalesce(v_prev_hash, ''::bytea)
        || convert_to(
             coalesce(r.entity_type, '') || '|'
               || coalesce(r.entity_id::text, '') || '|'
               || coalesce(r.action, '') || '|'
               || coalesce(r.actor_id::text, '') || '|'
               || coalesce(r.created_at::text, ''),
             'UTF8'
           ),
      'sha256'
    );

    if r.prev_hash is distinct from v_prev_hash
       or r.row_hash is distinct from v_expected then
      broken_seq    := r.chain_seq;
      expected_hash := v_expected;
      actual_hash   := r.row_hash;
      return next;
      return;
    end if;

    v_prev_hash := r.row_hash;
  end loop;

  -- No break found: return nothing (empty = intact).
  return;
end;
$$;

-- 4. Backfill existing rows in created_at order (chain_seq starts at 1, hashes
--    computed iteratively). Done as an iterating DO block rather than a
--    recursive CTE for clarity and to reuse the exact hash formula above.
--    UPDATE does not fire the BEFORE-INSERT trigger, so this is safe to run
--    after the trigger is installed.
do $$
declare
  r      record;
  v_seq  bigint := 0;
  v_prev bytea  := null;
  v_hash bytea;
begin
  for r in
    select id, entity_type, entity_id, action, actor_id, created_at
      from innovation.audit_logs
     order by created_at asc, id asc
  loop
    v_seq  := v_seq + 1;
    v_hash := digest(
      coalesce(v_prev, ''::bytea)
        || convert_to(
             coalesce(r.entity_type, '') || '|'
               || coalesce(r.entity_id::text, '') || '|'
               || coalesce(r.action, '') || '|'
               || coalesce(r.actor_id::text, '') || '|'
               || coalesce(r.created_at::text, ''),
             'UTF8'
           ),
      'sha256'
    );

    update innovation.audit_logs
       set chain_seq = v_seq,
           prev_hash = v_prev,
           row_hash  = v_hash
     where id = r.id;

    v_prev := v_hash;
  end loop;
end $$;

-- 5. Enforce uniqueness/monotonicity of the sequence going forward.
create unique index if not exists idx_audit_logs_chain_seq
  on innovation.audit_logs (chain_seq);

commit;

-- POST-VERIFY (run after applying):
--   select * from innovation.verify_audit_chain();   -- expect 0 rows (intact)
--   insert into innovation.audit_logs (entity_type, entity_id, action, actor_id)
--     values ('test', null, 'test.event', null);
--   select chain_seq, encode(prev_hash,'hex'), encode(row_hash,'hex')
--     from innovation.audit_logs order by chain_seq desc limit 2;
--   -- Tamper test: update any row's action, then re-run verify_audit_chain()
--   --              → one row with broken_seq = the edited row's chain_seq.

-- ROLLBACK (manual):
-- begin;
--   drop index if exists innovation.idx_audit_logs_chain_seq;
--   drop trigger if exists audit_logs_chain_trg on innovation.audit_logs;
--   drop function if exists innovation.audit_logs_chain_before_insert();
--   drop function if exists innovation.verify_audit_chain();
--   alter table innovation.audit_logs
--     drop column if exists chain_seq,
--     drop column if exists row_hash,
--     drop column if exists prev_hash;
-- commit;
