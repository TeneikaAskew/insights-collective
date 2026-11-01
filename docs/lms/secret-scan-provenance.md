# Secret Detection provenance, v2 (sanitized; no payload, no raw secret)

Check run 124615905778 (Security Scanning run 41227934767), TruffleHog 3.99.7 over PR range `99f81e3e..3370e5dd`: 130 chunks, 0 verified, 4 unverified 'Postgres' results, exit 183.

## What the metadata does and does not say

- The four annotations carry only `path`, `start_line`/`end_line`, level and message. `raw_details` is empty. `blob_href` points at the HEAD blob (3370e5dd) for all four: the action's convention, not a per-result commit.
- The job log holds the four `::warning` annotations and the summary line only: no per-result commit hash, fingerprint or decoder detail beyond 'with HTML encoding' on the test-file result.
- No detector fingerprint or per-result commit mapping therefore exists in the available metadata. The mapping below is reconstructed from repository bytes and labelled accordingly.

## Reconstruction method

TruffleHog's git source reports the line number within the file at the commit whose diff introduced the chunk. For every commit in the range that touched the two annotated files, every ADDED line carrying a `scheme://user:password@host` literal is listed with its new-file line number, the password LENGTH (never the value), the host, whether user, password and host parse as a URL (no `${…}` placeholders, which Go's url.Parse rejects in userinfo and host) and whether the host is loopback. Observed behaviour in this run: results appear only where the literal parses and the host is not loopback.

| commit | file | new-file line | user | password length | host | parseable | loopback |
|---|---|---|---|---|---|---|---|
| 6fdc563a | `scripts/local-db/tests/guard-negative.sh` | 23 | `postgres` | 1 | `db.${PROD}.supabase.co:5432` | no | no |
| 6fdc563a | `scripts/local-db/tests/guard-negative.sh` | 24 | `postgres.${PROD}` | 1 | `aws-0-us-east-1.pooler.supabase.com:6543` | no | no |
| 6fdc563a | `scripts/local-db/tests/guard-negative.sh` | 45 | `postgres` | 1 | `db.${PROD}.supabase.co:5432` | no | no |
| 6fdc563a | `scripts/local-db/tests/guard-negative.sh` | 46 | `postgres` | 1 | `db.${PROD}.supabase.co:5432` | no | no |
| 6fdc563a | `scripts/local-db/tests/guard-negative.sh` | 47 | `postgres` | 1 | `localhost.attacker.example:5432` | yes | no |
| 6fdc563a | `scripts/local-db/tests/guard-negative.sh` | 48 | `postgres` | 1 | `db.${PROD}.supabase.co:5432` | no | no |
| 6fdc563a | `src/test/__tests__/assertLocalDsn.test.ts` | 11 | `postgres` | 2 | `localhost:5432` | yes | yes |
| 6fdc563a | `src/test/__tests__/assertLocalDsn.test.ts` | 18 | `postgres` | 9 | `127.0.0.1:5432` | yes | yes |
| 6fdc563a | `src/test/__tests__/assertLocalDsn.test.ts` | 26 | `postgres` | 1 | `db.siuqvhscuiycvdrtiqsh.supabase.co:5432` | yes | no |
| 6d63c42b | `scripts/local-db/tests/guard-negative.sh` | 47 | `postgres` | 1 | `db.${PROD}.supabase.co:5432` | no | no |
| 6d63c42b | `scripts/local-db/tests/guard-negative.sh` | 72 | `postgres` | 1 | `db.${PROD}.supabase.co:5432` | no | no |
| 6d63c42b | `scripts/local-db/tests/guard-negative.sh` | 89 | `postgres.abcdefghijklmnopqrst` | 1 | `aws-0-eu-west-1.pooler.supabase.com:6543` | yes | no |
| 6d63c42b | `scripts/local-db/tests/guard-negative.sh` | 90 | `postgres` | 1 | `db.abcdefghijklmnopqrst.supabase.co:5432` | yes | no |
| 6d63c42b | `src/test/__tests__/assertLocalDsn.test.ts` | 77 | `postgres` | 1 | `db.${ISO}.supabase.co:5432` | no | no |
| 6d63c42b | `src/test/__tests__/assertLocalDsn.test.ts` | 78 | `postgres.${ISO}` | 1 | `aws-0-eu-west-1.pooler.supabase.com:6543` | no | no |
| 6d63c42b | `src/test/__tests__/assertLocalDsn.test.ts` | 79 | `postgres` | 1 | `db.${ISO}.supabase.co:5432` | no | no |
| 6d63c42b | `src/test/__tests__/assertLocalDsn.test.ts` | 80 | `postgres` | 1 | `db.${ISO}.supabase.co:5432` | no | no |
| 6d63c42b | `src/test/__tests__/assertLocalDsn.test.ts` | 81 | `postgres.${PROD}` | 1 | `aws-0-us-east-1.pooler.supabase.com:6543` | no | no |
| 6d63c42b | `src/test/__tests__/assertLocalDsn.test.ts` | 82 | `postgres` | 1 | `db.${PROD}.supabase.co:5432` | no | no |
| 6d63c42b | `src/test/__tests__/assertLocalDsn.test.ts` | 83 | `postgres.${ISO}` | 1 | `aws-0-eu-west-1.pooler.supabase.com.attacker.example:6543` | no | no |
| 7255e26b | `scripts/local-db/tests/guard-negative.sh` | 93 | `u` | 7 | `remote.example` | no | no |
| 7255e26b | `scripts/local-db/tests/guard-negative.sh` | 93 | `u` | 7 | `localhost` | no | yes |
| 7255e26b | `scripts/local-db/tests/guard-negative.sh` | 99 | `postgres` | 7 | `127.0.0.1:54329` | no | yes |
| 7255e26b | `src/test/__tests__/assertLocalDsn.test.ts` | 101 | `u` | 4 | `remote.example` | no | no |
| 7255e26b | `src/test/__tests__/assertLocalDsn.test.ts` | 102 | `u` | 4 | `localhost,remote.example` | no | no |
| 7255e26b | `src/test/__tests__/assertLocalDsn.test.ts` | 103 | `u` | 4 | `localhost` | no | yes |
| 7255e26b | `src/test/__tests__/assertLocalDsn.test.ts` | 104 | `postgres.abc` | 4 | `aws-0-eu-west-1.pooler.supabase.com:6543` | no | no |
| 7255e26b | `src/test/__tests__/assertLocalDsn.test.ts` | 114 | `u` | 4 | `localhost` | no | yes |

Candidates that parse and are non-loopback: **4** (the scanner reported **4**).

- 6fdc563a `scripts/local-db/tests/guard-negative.sh`:47 user `postgres`, password length 1, host `localhost.attacker.example:5432`
- 6fdc563a `src/test/__tests__/assertLocalDsn.test.ts`:26 user `postgres`, password length 1, host `db.siuqvhscuiycvdrtiqsh.supabase.co:5432`
- 6d63c42b `scripts/local-db/tests/guard-negative.sh`:89 user `postgres.abcdefghijklmnopqrst`, password length 1, host `aws-0-eu-west-1.pooler.supabase.com:6543`
- 6d63c42b `scripts/local-db/tests/guard-negative.sh`:90 user `postgres`, password length 1, host `db.abcdefghijklmnopqrst.supabase.co:5432`

## Mapping of the four annotations

| annotation (path:line) | mapped to | status |
|---|---|---|
| `scripts/local-db/tests/guard-negative.sh:47` | 6fdc563a, added line 47 (look-alike host `localhost.attacker.example`, 1-char password) | **exact**: the only parseable non-loopback literal at line 47 in any commit of the range (6d63c42b line 47 has a `${PROD}` host and cannot parse) |
| `src/test/__tests__/assertLocalDsn.test.ts:26` | 6fdc563a, added line 26 (production db host, 1-char password) | **exact**: the only candidate at that line in the range; unchanged in later commits, so not re-diffed |
| `scripts/local-db/tests/guard-negative.sh:89` | 6d63c42b, added line 89 (positive control 'declared isolated project (pooler DSN)': user `postgres.abcdefghijklmnopqrst`, 1-char password, host `aws-0-eu-west-1.pooler.supabase.com:6543`) | **likely, not conclusively closed**: the only commit in the range whose line 89 carries a parseable non-loopback literal, and the candidate count equals the scanner's; no per-result commit field exists to confirm |
| `scripts/local-db/tests/guard-negative.sh:90` | 6d63c42b, added line 90 (positive control 'declared isolated project (db host DSN)': user `postgres`, 1-char password, host `db.abcdefghijklmnopqrst.supabase.co:5432`) | **likely, not conclusively closed**: same reasoning |

## 6d63c42b diff evidence (sanitized)

Hunk headers of `scripts/local-db/tests/guard-negative.sh` in that commit, then the two added lines at new-file lines 89 and 90 with the password replaced:

    @@ -41,9 +41,51 @@ done
    +L89: +positive "seed.sh ← declared isolated project (pooler DSN)" env E2E_ISOLATED_TARGET_REF=abcdefghijklmnopqrst VITE_SUPABASE_URL="https://abcdefghijklmnopqrst.supabase.co" E2E_RELAY_TARGET="https://abcdefghijklmnopqrst.su
    +L90: +positive "seed.sh ← declared isolated project (db host DSN)" env E2E_ISOLATED_TARGET_REF=abcdefghijklmnopqrst VITE_SUPABASE_URL="https://abcdefghijklmnopqrst.supabase.co" E2E_RELAY_TARGET="https://abcdefghijklmnopqrst.s

## Conclusion, with the precision the evidence supports

- Two of four results are mapped exactly (guard line 47, test line 26) to added test inputs with one-character placeholder passwords.
- Two of four (guard lines 89, 90) are mapped as **likely** to 6d63c42b's two positive-control DSNs for the synthetic isolated project ref `abcdefghijklmnopqrst`, each with a one-character placeholder password. This is consistent with the scanner's count but is not a detector fingerprint. These two findings remain **open** until confirmed by an authentic scan whose output carries per-result commit data, or accepted by the owner.
- Across every commit in the range, every credential-shaped literal added to the two files has a one-character password, a 2-9 character test word on a loopback host, or a declared sentinel variable; no environment credential was present in the authoring container. The earlier statement '4/4 not a leak' is withdrawn in favour of the per-result statuses above.
