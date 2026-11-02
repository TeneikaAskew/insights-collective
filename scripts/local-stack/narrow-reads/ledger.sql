-- ABOUTME: #159 tier ledger on the disposable loopback stack ONLY: one row per apply / rollback / reapply, written by
-- ABOUTME: nr-psql.mjs in the same transaction as the file it records. Output: exactly one line "LEDGER <entries|NONE>".
-- local_evidence is created by STAGE PRE (egress-guard.sql). Entries are "step:version:sha256" in apply order.
\set ON_ERROR_STOP on
create table if not exists local_evidence.narrow_reads_applied (
  seq serial primary key,
  step text not null check (step in ('apply', 'rollback', 'reapply')),
  version text not null check (version ~ '^[0-9]{14}$'),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  applied_at timestamptz not null default clock_timestamp());
select 'LEDGER ' || coalesce(string_agg(step || ':' || version || ':' || sha256, ',' order by seq), 'NONE') as line
  from local_evidence.narrow_reads_applied;
