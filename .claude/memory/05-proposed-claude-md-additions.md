# Proposed `CLAUDE.md` additions

Drop-in sections, written as instructions rather than narrative. Take what is
useful; the surrounding files hold the evidence for each rule.

---

## Section: Verification before assertion

```markdown
### Verification Discipline

Before claiming a change fixes something, name the specific observation that
proves it and make that observation. If it cannot be verified now, say so
explicitly ("I could not verify X because Y") rather than asserting it.

- **Fixtures must satisfy render conditions, not just schema constraints.** When
  seed data exists to make UI appear, read the component's conditional for that
  element first. A row that satisfies every NOT NULL constraint can still leave
  the element unrendered.
- **When replacing a failing assertion, check the replacement against every
  failure mode**, not only the one that prompted the change. Identify rows by
  primary key rather than by text or aggregate counts.
- **Before fixing a tool's finding, establish what the tool examined** — working
  tree, diff, or commit range. The correct remediation differs completely.
- **Verify generated shell/YAML by executing it**, not by reading it. Extract the
  step and run it against good and bad inputs.
- **Do not assert third-party UI navigation from memory.** Vendor dashboards
  change. Give the artefact the user needs, or check current docs.
```

---

## Section: Investigate before changing shared state

```markdown
### Investigate Before Changing Shared State

The E2E suite runs against the **shared production database**. Before treating
an anomaly as a bug, find the comparison that distinguishes broken from working
— e.g. do unaffected users show the same symptom?

- Prefer two cheap queries over one confident assumption.
- Do not delete production rows to make a test pass. Check first whether a spec
  depends on the data existing.
- Never run `--update-snapshots` to clear visual-regression failures. That bakes
  in current rendering and discards what the baseline protected. Visual diffs
  need a human looking at the images.
- Test data accumulates because teardown is opt-in and currently broken; treat
  accumulation as expected, not as evidence of a product bug.
```

---

## Section: Credentials

```markdown
### Credentials

Never ask for or accept a credential value in chat. A credential is only needed
in the secret store. When one is wrong, supply: the shape it must have, how to
obtain a known-good one, and what the error means.

- If a credential is pasted anyway: do not echo, write, or commit it. State that
  it is now exposed and must be rotated, then continue helping.
- Do not guess through candidate values — resetting the credential is faster and
  is required after exposure regardless.
- Identify what a leaked value *is* (`GOCSPX-` = Google OAuth client secret,
  `eyJ…` = JWT) so the user knows everything that needs rotating.
- Never write a credential-shaped literal, even a fabricated one, even in a
  comment — secret scanners match on shape, not validity.
- Never weaken a security control to make a check pass. If a scanner flags your
  own work, fix the work.
```

---

## Section: E2E and CI specifics

```markdown
### E2E / CI Notes

- **Seeding** (`e2e/fixtures/seed.sql`) runs only when `SUPABASE_DB_URL` is set;
  **teardown** only when `E2E_ENABLE_DB_TEARDOWN=true` and
  `E2E_ALLOW_TEARDOWN_TARGET` matches the project ref. The intended cycle is
  seed → test → teardown.
- `psql` treats a non-URI argument as a **database name** and falls back to the
  local socket — a socket error usually means a malformed value, not a network
  fault. Always pass `-v ON_ERROR_STOP=1`, or a half-applied script exits 0.
- Percent-encode passwords containing `% ? # / @ :` before putting them in a URI.
- From GitHub Actions use the **session pooler** (`…pooler.supabase.com:5432`);
  direct connections are IPv6-only and runners are IPv4.
- `auth.users` is **not** reachable over PostgREST. Resolve users by email via
  the Auth Admin API; `public.profiles` has no email column.
- Assignments need a linked published `content_items` row to be gradable —
  `InstructorAssignments.tsx` hides the grading link without `content_item_id`.
- Check a CI webhook's SHA against the current head before acting; events arrive
  stale and out of order.
```

---

## Known outstanding issues worth recording

```markdown
### Known Issues

- `e2e/global-teardown.ts` has never worked: it queries `auth.users` through
  PostgREST (impossible), so `getTestUserIds()` always returns `[]` and every
  scoped delete hits zero rows. `SUPABASE_SERVICE_ROLE_KEY` is also absent from
  the `e2e.yml` job env. Fails safe, but cleans nothing.
- Visual-regression specs screenshot data-driven pages against the shared
  production database, so baselines drift whenever data changes. The durable fix
  is masking dynamic regions or using a dedicated E2E project.
```
