# Documented local-only divergences from the live catalog

Each entry is a deliberate difference between this sanitized snapshot and the live `public` schema.
`verify-identities.sh` treats exactly these identities as expected differences and fails on anything else.

| Kind | Identity | Live | Local | Why |
|---|---|---|---|---|
| column | `resources.created_by` | `uuid default '<fixed uuid>'` | `uuid` (no default) | The default is a fixed user id, a production identity. Not looked up, not reproduced. Rows inserted locally without `created_by` get NULL; the FK to `auth.users` is unchanged. |
| view | `quiz_analytics` | self-referencing view; `SELECT` raises 42P17 live | **absent** | Cannot be created (its definition references itself). Locally a `SELECT` raises **42P01 undefined_table**; the live recursion error is NOT reproduced, the object is omitted. |
| table_grant | `quiz_analytics→anon/authenticated/service_role` | present | absent | follow from the omitted view |

Machine-readable list used by the verifier (one `kind<TAB>ident` per line):
