-- ABOUTME: Moves the Coursera fallback catalog out of the JS bundle and into the
-- ABOUTME: database, plus the crawl queue that lets an Edge Function refresh it in
-- ABOUTME: cron-sized batches instead of one long run.
--
-- Why the database rather than a generated TS file
-- ------------------------------------------------
-- The catalog was shipped as src/data/courseraCatalog.generated.ts. That works, but
-- it ties every data refresh to a code deploy, and it cannot be curated: hiding a
-- course you disagree with means a commit. As a table it is refreshable on a
-- schedule and editable by an admin, and career pages can filter it in SQL.
--
-- The generated file stays in the repo as the seed and as a client-side fallback for
-- when the query fails, so a database outage degrades the section rather than
-- emptying it.
--
-- Why a queue instead of one crawl
-- -------------------------------
-- Edge Functions are wall-clock limited (150s on the current plan). Measured
-- locally, refreshing the 177 known courses takes about 3 minutes and a
-- 1,500-course discovery sweep about 30 — both well past the ceiling, and that is
-- with deliberate rate limiting that should not be removed. So the unit of work has
-- to be a batch: cron wakes the function, it drains N rows from
-- `coursera_crawl_queue`, and progress survives between invocations.

-- pg_cron is already installed on this project. pg_net is what lets a cron job call
-- an Edge Function over HTTP. Installed into its own `net` schema (its default) —
-- forcing it into `extensions` moves the function names and breaks `net.http_post`.
create extension if not exists pg_net;

-- ── Subject keywords ────────────────────────────────────────────────────────
--
-- Mirrors src/data/subjectKeywords.json, which stays canonical — the seed
-- migration is generated from it. The Edge Function reads this table so it can
-- classify a freshly fetched course without a copy of the keyword list inlined
-- into the function bundle.
create table if not exists public.coursera_subject_keywords (
  subject text not null,
  keyword text not null,
  primary key (subject, keyword)
);

comment on table public.coursera_subject_keywords is
  'Keyword table for classifying courses into learning subjects. Generated from src/data/subjectKeywords.json — edit that file, not this table.';

-- ── Catalog ─────────────────────────────────────────────────────────────────
create table if not exists public.coursera_courses (
  slug text primary key,
  -- Stored, never derived. Coursera serves /learn/, /specializations/ and
  -- /professional-certificates/ and the prefix cannot be inferred from the format;
  -- deriving it previously produced 11 broken links out of 34.
  url text not null,
  title text not null,
  -- Attribution is the one field this must not fabricate, hence NOT NULL with no
  -- default. Rows whose partner could not be determined are dropped upstream.
  partner text not null,
  format text not null check (format in ('Course', 'Specialization', 'Professional Certificate')),
  level text not null default 'Intermediate'
    check (level in ('Beginner', 'Intermediate', 'Advanced')),

  rating numeric(3, 2) check (rating is null or (rating >= 0 and rating <= 5)),
  reviews integer check (reviews is null or reviews >= 0),
  enrolled bigint check (enrolled is null or enrolled >= 0),
  estimated_hours numeric(6, 1) check (estimated_hours is null or estimated_hours >= 0),

  description text,
  skills text[] not null default '{}',
  -- Subjects this course teaches, and the subset named in its title. Computed at
  -- ingest from title + skills; see the Edge Function.
  subjects text[] not null default '{}',
  primary_subjects text[] not null default '{}',
  -- Learner review excerpts, [{rating, comment}]. Not surfaced yet.
  top_reviews jsonb not null default '[]'::jsonb,

  -- ── Curation. The reason this is a table and not a build artifact. ──
  -- 'active'  → eligible for recommendation
  -- 'hidden'  → an admin judged it a poor fit; kept so it is not re-added blindly
  -- 'retired' → 404s upstream; replaces scripts/coursera-denylist.json over time
  status text not null default 'active' check (status in ('active', 'hidden', 'retired')),
  curator_note text,
  -- Forces a course to the top of its subjects regardless of rating.
  is_featured boolean not null default false,

  -- ── Crawl bookkeeping ──
  last_fetched_at timestamptz,
  last_verified_at timestamptz,
  last_http_status integer,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.coursera_courses is
  'External Coursera courses recommended when no Insights Collective course covers a career role''s subject. Refreshed by the coursera-refresh Edge Function.';

-- Subject lookup is the only hot query: "courses teaching any of these subjects".
create index if not exists coursera_courses_subjects_idx
  on public.coursera_courses using gin (subjects);
-- Partial: recommendation queries only ever want active rows.
create index if not exists coursera_courses_active_idx
  on public.coursera_courses (status) where status = 'active';
-- Drives "refresh the stalest rows first".
create index if not exists coursera_courses_last_fetched_idx
  on public.coursera_courses (last_fetched_at nulls first);

-- ── Crawl queue ─────────────────────────────────────────────────────────────
create table if not exists public.coursera_crawl_queue (
  url text primary key,
  slug text not null,
  state text not null default 'pending' check (state in ('pending', 'done', 'failed')),
  attempts integer not null default 0,
  last_error text,
  -- 'refresh' re-reads known courses; 'discover' fetches sitemap candidates.
  source text not null default 'refresh' check (source in ('refresh', 'discover')),
  enqueued_at timestamptz not null default now(),
  processed_at timestamptz
);

comment on table public.coursera_crawl_queue is
  'Work list for the coursera-refresh Edge Function. Exists because Edge Functions are wall-clock limited and a full crawl is not: progress has to survive across invocations.';

-- The function's only claim query: oldest pending first, retries not yet exhausted.
create index if not exists coursera_crawl_queue_pending_idx
  on public.coursera_crawl_queue (state, enqueued_at) where state = 'pending';

-- ── updated_at ──────────────────────────────────────────────────────────────
create or replace function public.touch_coursera_courses_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists coursera_courses_touch_updated_at on public.coursera_courses;
create trigger coursera_courses_touch_updated_at
  before update on public.coursera_courses
  for each row execute function public.touch_coursera_courses_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.coursera_courses enable row level security;
alter table public.coursera_subject_keywords enable row level security;
alter table public.coursera_crawl_queue enable row level security;

-- Career pages are public (no auth required to browse roles), so the read policy
-- has to cover anon as well as authenticated. Only active rows: 'hidden' and
-- 'retired' are curation state, not something to publish.
drop policy if exists "coursera_courses_public_read" on public.coursera_courses;
create policy "coursera_courses_public_read"
  on public.coursera_courses for select
  to anon, authenticated
  using (status = 'active');

-- Admins see everything, including hidden rows, so a curation UI can unhide.
drop policy if exists "coursera_courses_admin_read_all" on public.coursera_courses;
create policy "coursera_courses_admin_read_all"
  on public.coursera_courses for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "coursera_courses_admin_write" on public.coursera_courses;
create policy "coursera_courses_admin_write"
  on public.coursera_courses for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Keywords are needed to explain *why* a course was recommended, so they are
-- readable; they are only ever written by the seed migration.
drop policy if exists "coursera_subject_keywords_public_read" on public.coursera_subject_keywords;
create policy "coursera_subject_keywords_public_read"
  on public.coursera_subject_keywords for select
  to anon, authenticated
  using (true);

-- No policy on coursera_crawl_queue and no INSERT/DELETE policy on
-- coursera_courses: with RLS enabled and no matching policy, every non-service
-- role is denied. The Edge Function uses the service role, which bypasses RLS, so
-- crawl state stays entirely server-side. This is deliberate — do not add an anon
-- policy here to "make it work" from the browser.
