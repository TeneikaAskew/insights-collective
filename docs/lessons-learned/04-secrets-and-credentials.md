# Secrets and credentials

## Never write a credential-shaped placeholder

A workflow comment explained the expected format of a database URL by writing a
complete example connection URI with a `user:password@host` shape. TruffleHog's
Postgres detector matched it and `Secret Detection` went red on a string that
was pure documentation.

The cleanup was disproportionate to the mistake. Secret scanning covers the
whole `main..HEAD` range and flags **each commit's diff**, so:

- a follow-up commit deleting the string does not help — the original commit is
  still in range
- a `trufflehog:ignore` comment does not help — it is evaluated against the
  historical line
- the only fix is rewriting the commit, which needed a force-push and explicit
  user permission

**Lesson:** describe a credential format in prose. Name the parts — scheme,
credentials, host, port, database — without emitting a string that pattern-
matches as a real one. The rejected alternatives (`--exclude-detectors`,
`--exclude-paths`) would have cleared the check by weakening scanning repo-wide:
a bad trade for a mistake in a comment.

## When a user pastes a live credential

It happened twice in this session. The correct response:

1. **Say so immediately and recommend rotation.** It is now in a transcript.
2. **Do not persist it** — not in a file, not in a commit, not in the repo.
3. **Do not echo it back** in full. Describe the structural finding instead.
4. **Diagnose what you can without transmitting it.** Parsing a URI locally and
   reporting `scheme / user / host / port / database / chars needing encoding`
   answers the real question without a single packet leaving the machine.

## URI encoding is a real failure mode

The first credential could not work regardless of correctness. In a URI's
userinfo section:

- `%` begins a percent-escape; `%` followed by a non-hex pair is an invalid
  token
- `?` terminates the authority and starts the query string
- `)` and `*` are sub-delims and are fine unescaped

So a password containing `%` and `?` must encode them as `%25` and `%3F`.

Two *distinct* faults were separable from the error text alone:

| Symptom | Meaning |
|---|---|
| psql dials the **local unix socket** | the value never started with `postgresql://`, so it was read as a bare database *name* |
| `invalid percent-encoded token` | it *was* parsed as a URI, then failed decoding |

**Lesson:** read the error precisely enough to distinguish "not recognised as a
URI" from "recognised and invalid". They have different fixes.

## Don't run a test whose result cannot mean anything

Asked to test a connection string, the honest answer was to first check whether
a test was even possible:

```
TCP <db-pooler-host>:5432 -> BLOCKED (TimeoutError)
```

Outbound 5432 is blocked from the sandbox. A `psql` attempt would have timed out
whether or not the credentials were valid — a false negative, while transmitting
a live credential for no benefit. Reporting that, plus the structural validation
that *was* possible, is more useful than a meaningless red result.

**Lesson:** before running a diagnostic, ask what each possible outcome would
prove. If a failure would be uninformative, say so instead of running it.

## Ephemeral session material

The Playwright session files hold live JWTs. Retaining them for the rest of a CI
job (to let a guard inspect them) is acceptable *because* the directory is
gitignored, the runner is ephemeral, and the commit step stages only a specific
path — three independent reasons no token can reach the repository. The
retention is opt-in and CI-scoped rather than a default.

**Lesson:** when relaxing a cleanup step, enumerate why the relaxation is safe,
and encode it as an explicit opt-in so the default stays strict.
