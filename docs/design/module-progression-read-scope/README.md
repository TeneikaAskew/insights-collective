# Module progression read-scope repair proposal

`candidate.sql` changes only the instructor SELECT policy predicate. It replaces
unrestricted instructor-role access with the existing course-assignment helper,
retaining course ownership and administrator access. Student-own SELECT, INSERT
and UPDATE policies, grants, and stored progress records are unchanged.

The CLI-generated migration is
`supabase/migrations/20261109003000_scope_module_progression_instructor_reads.sql`.
Its ALTER POLICY statement is identical to the isolated-tested candidate. The CLI
startup restriction was resolved through approved creation of its state directory
and narrowly scoped filesystem access; no HOME redirect or credential creation was
used. Migration generation succeeded locally; optional telemetry received a 403
and was not retried. No database migration was applied by the CLI.

## Source and ownership

This worktree is separate from assessment-copy-mapping. Its base is
`62cf24dc5204a75be634dfcc354f687b53e2fa4f`; course-copy work remains at
`4a90301b6ddcd9b3279ffc2b7b8f4b44bfa2afab` unchanged.
GitHub read-only observation on 2026-11-09 found main at
`7eddd2829c821ce8405b0226d103aa2fbbcf7fa4`, 24 commits ahead. The current
schema snapshot still has the global instructor branch. Exact-name PR and branch
searches found no overlapping repair; these searches do not prove every owner idle.
The comparison response contains 300 paths and may be capped, so it does not
establish a complete inventory of newer migrations. Current-main integration must
be checked before publication; denied Git authentication paths were not retried.

## Isolated verification

Run `python3 docs/design/module-progression-read-scope/run.py` for preflight;
add `--execute` only for the isolated database test. This runner reuses the
retained hash-pinned composed-schema fixture in `/workspace/course-copy-fidelity`.
It requires the already-cached pinned PostgreSQL image and never pulls an image.
It uses an immutable container ID, disabled network, no published ports, one
read-only allowlisted input mount, and a temporary database filesystem.
There is no configurable remote database target. Cleanup destroys the owned
container and temporary database; logs and input hashes remain under `/workspace`.

The first run reproduced 17 failures in 49 old-policy checks. The candidate
passed 49 published-course checks and 49 unpublished-course checks, including
owner, assigned co-instructor without a global instructor role, unrelated global
instructor, two student identities and admin. Anonymous read denial, exact
progress-row preservation, other-policy preservation and fixture rollback passed.
This independently constructed matrix differs from the previously reported
49-check reproduction with 13 failures; those raw receipts were not present here.

These are PostgreSQL RLS checks using synthetic claims and the pinned composed
schema, not real Auth token verification, REST/PostgREST or signed-in browser
acceptance. Full-stack acceptance and current-main migration checks remain open.
No production records were accessed. Production application requires separate
approval and the repository migration workflow; no production apply is authorized
by this proposal.
