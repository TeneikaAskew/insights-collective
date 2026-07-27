# Database, migrations and RLS

## The near-miss: migrations are tracked by version number

A branch migration was numbered `20260728002000_tighten_blog_posts_rls`. An
already-applied migration in the live project carried the **same version**,
`20260728002000_restore_quiz_submissions_fk`.

Supabase tracks migrations by version number. A duplicate is **silently
skipped** — no error, no warning. The blog RLS security fix would simply never
have run on deploy, while every local signal said it had shipped.

Caught only by querying the live database and finding the old
`USING (true)` policy still present. All seven pending migrations were then
renumbered.

**Lesson:** before trusting that a migration will apply, confirm its version is
unused in the target. "It's in the repo" is not "it ran".

## Code that depends on unapplied migrations is broken code

Eleven E2E failures were a single root cause:

```
[useCourseRosterStats]    PGRST202  public.course_roster_stats     not found
[useFormSubmissionCounts] PGRST202  public.form_submission_counts  not found
[useAdminUsers]           PGRST202  public.search_admin_users      not found
```

"Apply these migrations on deploy" had been reported as a footnote on several
updates. It was not a footnote — it meant merging would ship an admin section
whose Users, Courses and Forms pages could not load data at all.

**Lesson:** when a diff introduces a call to a new database object, the
migration is part of the change, not a deployment detail. Track it as a blocker
and state the consequence concretely ("these three pages cannot load"), not
abstractly ("migrations pending").

## Verify the effect, not the success flag

After each migration, the assertion was a query, not the tool's `{"success":
true}`:

```sql
SELECT policyname, cmd, qual::text FROM pg_policies
WHERE tablename = 'blog_posts';
-- confirmed: the USING (true) SELECT policy is gone
```

And to confirm the public path still worked, the check impersonated the actual
role rather than reasoning about it:

```sql
BEGIN; SET LOCAL ROLE anon;
SELECT count(*) FROM public.blog_posts;   -- 10
ROLLBACK;
```

That test is what cleared the migration of suspicion when the blog page looked
wrong — the fault was elsewhere.

## Aggregate server-side; client tallies are silently truncated

PostgREST caps a response at `max-rows` (1000 by default). Selecting rows and
counting them in JS means that past the cap, forms report zero submissions and
courses report empty rosters — **wrong numbers presented as real ones**. Fixed
with `SECURITY INVOKER` RPCs so RLS still applies and no new access is granted.

## RLS design notes worth keeping

- **`SECURITY DEFINER` needs a pinned `search_path`** (`SET search_path = public,
  pg_temp`), or a caller-controlled path can hijack it.
- **`DEFINER` functions must gate themselves.** `search_admin_users` reads across
  all profiles, so it carries an internal `has_admin_access(auth.uid())` check;
  a non-admin caller gets zero rows.
- **Prefer `INVOKER` when RLS already expresses the rule** — the count RPCs run
  as the caller, so they expose nothing a direct select would not.
- **Resolve roles from one canonical source.** `get_user_roles` must read
  `user_roles`, never the self-writable `profiles.roles` mirror. A migration
  that *asserts* this and fails loudly is cheap insurance against a future
  `CREATE OR REPLACE` silently repointing it.
- **A public read path may need more than one table opened.** The blog renders
  bylines from `profiles`, which anon cannot read — so every post shows "Unknown
  Author". The fix is *not* granting anon read on `profiles`; that would publish
  every user's row to render a byline. Expose only what the surface needs.
