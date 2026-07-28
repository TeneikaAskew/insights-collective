# CI and tooling behaviour

How the tools in this repo's pipeline actually behave, as opposed to how they
appear to behave. Each item cost at least one CI cycle to learn.

---

## TruffleHog scans a commit range, not the working tree

The Secret Detection job logs its scope:

```
scanning repo {"base": "65b5e99…", "head": "3924976…"}
```

**Deleting a flagged string in a follow-up commit does not clear the finding** —
the string still exists in the earlier commit's diff, which is inside the range.
The only fix is to rewrite history so the line never existed (soft-reset and
recommit, then force-with-lease).

This is correct behaviour: for a genuine leak, a later deletion does not
un-leak the secret.

### It matches on shape, not on validity

The finding here was a **fabricated** connection string in a workflow comment,
written as documentation. It had the form `<scheme>://<user>:<password>@<host>`
with a password containing a `?`, used to illustrate how the parse breaks. The
literal is deliberately not reproduced here — quoting it in this file would trip
the same scanner, which is itself the point.

It reported as *unverified* precisely because the credentials were invented —
but it still failed the job. **Never write a credential-shaped literal, even an
obviously fake one, even in a comment.** Describe the failure mode in prose
instead.

### Do not suppress the finding to go green

Adding an exclusion or an ignore-comment would make the check pass by weakening
a security control. When the finding is your own mess, clean up the mess.

---

## psql treats a non-URI argument as a database name

Given a value that is not a connection URI, `psql "$VALUE"` interprets it as a
**database name** and connects to the local unix socket. The result:

```
psql: error: connection to server on socket "/var/run/postgresql/.s.PGSQL.5432"
failed: No such file or directory
```

That reads like a network fault. It is not — it means the value was never a URI.

### A URI-shaped value can still be broken

A password containing URI reserved characters corrupts the authority section
even when the scheme is right. A raw `?` opens the query component; a raw `%`
starts a percent-escape. A password beginning `%)*` and containing a `?` makes a
parser read the *hostname* as `postgres.<ref>` and take everything up to the `?`
as the *port* — so the connection never even reaches the right server.

(Deliberately no literal example: writing one is how the Secret Detection job
got tripped in the first place. See "It matches on shape, not on validity"
above.)

Encode before use: `%`→`%25`, `?`→`%3F`, `#`→`%23`, `/`→`%2F`, `@`→`%40`,
`:`→`%3A`. Or generate a password without reserved characters and sidestep it.

### Always pass `-v ON_ERROR_STOP=1`

Without it psql prints a failing statement and **still exits 0**. A half-applied
seed — including a tripped `RAISE EXCEPTION` invariant — reports success, and
the specs fail later for reasons that make no sense.

---

## Supabase connectivity from GitHub Actions

- **Direct connections** (`db.<ref>.supabase.co:5432`) are **IPv6-only** without
  the IPv4 add-on. GitHub runners are IPv4, so this string fails from CI no
  matter how correct it is.
- **Shared pooler, session mode** (`…pooler.supabase.com:5432`) is the
  IPv4-compatible option and the right one for `psql` running a script.
- **Shared pooler, transaction mode** (port `6543`) does not support
  session-level features.

The `aws-0` vs `aws-1` host prefix varies by project provisioning date — copy it
from the dashboard rather than assuming.

---

## This sandbox cannot reach Postgres

Outbound TCP on 5432 is blocked; only HTTPS egresses through the agent proxy.

The proxy answers `CONNECT host:5432` with `200 Connection Established`, which
looks like a usable tunnel — **it is not**. Postgres opens with an `SSLRequest`
packet, which is not a TLS ClientHello, and the MITM proxy drops it. A raw probe
sending the 8-byte SSLRequest receives nothing and times out.

**Consequence:** database credentials cannot be validated from here. Say so
plainly instead of implying a timeout means a bad password — a network timeout
carries no information about the credential. CI is the test.

---

## Verify generated shell/YAML by executing it, not by reading it

The seed guard involved a heredoc inside a YAML block scalar — indentation there
is easy to get subtly wrong. Rather than eyeballing it, extract and run it:

```bash
python3 -c "
import yaml
d=yaml.safe_load(open('.github/workflows/e2e.yml'))
s=[x for x in d['jobs']['e2e']['steps'] if x.get('name')=='Seed E2E fixtures'][0]['run']
open('step.sh','w').write(s.replace('psql …','echo WOULD_RUN'))"
SUPABASE_DB_URL='<bad value>' bash step.sh
```

This caught the difference between "the YAML parses" and "the script does the
right thing on all three input classes".

---

## Webhook events arrive stale and out of order

Several CI-failure events referenced commits that had already been superseded —
including one for a SHA replaced by a force-push. **Check the event's SHA against
the current head before acting.** Re-diagnosing a superseded commit wastes a
cycle and can produce a "fix" for something already fixed.
