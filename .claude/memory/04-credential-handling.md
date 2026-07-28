# Credential handling

Six credentials passed through a single chat transcript during one debugging
session. None of them needed to. This file records what happened and the rules
that would have prevented it.

**No credential values appear in this file.**

---

## What happened

Debugging a failing `SUPABASE_DB_URL`, the values pasted into chat were:

1. A live database password.
2. Four more candidates, pasted to ask which was the right one.
3. A sixth, later, to be tested.

Of the four candidates, two were identifiable by prefix as **Google OAuth client
secrets** (`GOCSPX-`) — live credentials for the app's social login, with nothing
to do with Postgres. One was a 40-character hex string of unknown purpose.

All of them now exist in a chat transcript and all need rotating.

---

## Rules

### Never ask for, and never accept, a credential value

A credential is only ever needed *in the secret store*. There is no debugging
task that requires seeing it. When a value is wrong, the useful outputs are:

- what **shape** it must have (scheme, encoding, which pooler mode);
- how to **obtain a known-good one** (reset it at the provider);
- what the **failure message means**.

If a credential is pasted anyway: do not echo it, do not write it to a file, do
not commit it, do not put it in a PR or commit message. Say plainly that it is
now exposed and should be rotated, then continue helping.

### Guessing candidates is the wrong loop

Trying values one at a time is slow, unverifiable in a sandbox without network
access to the service, and multiplies exposure with each attempt. **Resetting
the password is faster and produces a known-good value in one step** — and after
any exposure it is required regardless.

### Identify what was leaked

Recognising credential formats is genuinely useful, because it tells the user
what to rotate:

| prefix / shape | what it is |
|---|---|
| `GOCSPX-…` | Google OAuth client secret |
| `eyJ…` (three dot-separated segments) | JWT — for Supabase, likely an anon/publishable or service-role key |
| 40 hex characters | token/API key shape; needs identifying before dismissing |

Do not stop at "that's not the database password" — say what it *is*, so it gets
rotated too.

### Never write a credential-shaped literal, even a fake one

A fabricated example connection string in a workflow comment failed the Secret
Detection job. Scanners match on shape, not validity. Describe the structure in
prose; if an example is unavoidable, keep it far from anything resembling a real
authority section.

### Treat "this secret is only a test credential" with suspicion

The E2E suite here runs against the **production** database with real user data.
A key scoped to "just the tests" is a key to production. The service-role key is
a blanket RLS bypass across the whole API, reachable from anywhere — arguably a
broader blast radius than a database password, which at least requires network
reachability.

### If credentials cluster, flag the source

A database password, two Google OAuth secrets, and an unidentified token
appearing together suggests one file or note is accumulating production
credentials. Worth saying — the exposure is likely wider than the immediate
task.

---

## What to do after an exposure

1. Rotate every exposed credential, not just the one that mattered.
2. Prefer generated passwords without URI-reserved characters (`% ? # / @ :`)
   so no encoding step is needed and nothing gets mangled in transit.
3. Put the new value straight into the secret store.
4. Let CI report whether it works — that is a complete verification loop with
   zero further exposure.
