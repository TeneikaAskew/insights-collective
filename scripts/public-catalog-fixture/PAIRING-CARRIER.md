# Pairing carrier: one run-owned row in public.blog_tags (source evidence for review)

Chosen with the shared bootstrap owner (2026-11-02 03:34Z) and approved for local preparation by T (03:38Z).
Static evidence only, read at base 96e9676d. No live stack, no production probe. The real-stack anon readback in
`pairing-producer.mjs` is the actual check, and it fails closed.

## Schema (existing; no change proposed)
Git blobs at 96e9676d: 01_types_tables.sql c73032dac90c8207dbe6d1ca629516cd58dde655, 02_constraints_indexes_views.sql 45a6113f5f60ec3a19e16ef59068099a6b25c7be,
04_rls_policies.sql 7a2f9d1fa4d98fc808e6633fde05226dd11de92e, 05_triggers_grants.sql 54b52ecf8d2394c16a6be75f7fce637b0c75ed0a.
`scripts/local-stack/schema/01_types_tables.sql:294-299`:
```
create table if not exists public.blog_tags (
  id uuid not null default gen_random_uuid(),
  name character varying(50) not null,
  slug character varying(50) not null,
  created_at timestamp with time zone default now()
);
```
`02_constraints_indexes_views.sql:24` primary key (id); `:133` UNIQUE (slug); `:245` blog_post_tags.tag_id FK (ON DELETE CASCADE).
The carrier is name = slug = the 32-hex stack_id (fits varchar(50)), id = 7e57ca7a-0000-4000-8000-000000000900.

## RLS (existing)
`04_rls_policies.sql:24` enable row level security; `:245`
`create policy "Tags are viewable by everyone" on public.blog_tags as permissive for SELECT to public using (true);`
Writes: `:238` INSERT requires auth.uid() IS NOT NULL; `:239`/`:242` DELETE/UPDATE admin only. The carrier is written through
this lane's owner DSN, not through anon.

## Grants (existing)
`05_triggers_grants.sql:128` `grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.blog_tags to anon;`
(RLS above still limits anon to SELECT.) No grant, revoke, policy or DDL is added by this lane.

## Readers (no-render scope)
`grep -rn "blog_tags" src --include=*.ts --include=*.tsx | grep -v blog_post_tags` at 96e9676d:
```
src/integrations/supabase/types.ts:831:            referencedRelation: "blog_tags"
src/integrations/supabase/types.ts:1126:      blog_tags: {
```
Generated types only: no component, page, hook or service queries or embeds blog_tags, so it cannot reach `/`, `/courses`,
`/courses/<id>` or any screenshot. The lane's specs, fixtures, probes and config never name it (only run.sh's W0 check and
the producer). The course description carrier used by gradebook (rendered on /courses and the home page) is NOT used.

## Limits
- Static snapshot: the grant and policy above are what the local-stack schema files say; the producer's anon readback on
  the real stack is the check, and anon not seeing the row is PAIR_E_API_MISMATCH (no authenticated or DSN substitute).
- The nonce is anon-readable through the API by design (that is the binding); it is not a secret and is never printed.
- TRUSTED_PRODUCERS stays empty and PRE_CONTRACT_PINS stays empty: every run is BLOCKED until concrete job source
  qualification and a specific run approval.
