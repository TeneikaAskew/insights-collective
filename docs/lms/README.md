# LMS modernization — working documents

This folder is the single place where the Insights Collective course-platform work is
tracked. It consolidates the October 31, 2026 handoff package (master implementation
plan, Lovable prompt archive, start-here note) with the independent repository audit
performed in the Claude Code session that owns this branch.

| File | Purpose |
|---|---|
| [`backlog-tracker.md`](./backlog-tracker.md) | One traceable backlog: every work package WP-00 to WP-17, every Lovable prompt A0 to A10, every audit finding, with source, status, evidence tier and acceptance gate |
| [`baseline-inventory.md`](./baseline-inventory.md) | Provenance (document hashes, baseline SHAs), route matrix, schema and policy facts verified against the live catalog, CI trigger inventory, environment safety findings |
| [`publication-gate.md`](./publication-gate.md) | Exactly what a branch push, a pull request and a merge trigger today, and the production-safe workflow proposed for review |
| [`completion-policy-trace.md`](./completion-policy-trace.md) | T-09/T-10 traced to the handoff documents: clear requirements versus unresolved owner choices |
| [`isolated-stack-plan.md`](./isolated-stack-plan.md) | Implementation-ready, dependency-ordered plan for an isolated full-stack QA job on GitHub Actions (not dispatched) |
| [`secret-scan-provenance.md`](./secret-scan-provenance.md) | Sanitized per-result mapping of the Secret Detection findings on PR #134: what the metadata holds, how the mapping was reconstructed, which results are exact and which remain likely/open |

Status vocabulary used throughout:

- **Done-code**: landed on `main`; says nothing about runtime correctness.
- **Verified (tier)**: confirmed with the named evidence tier. Tiers are `code` (read in source), `live-catalog` (read-only query of the live database catalog), `local-db` (test run on the disposable local snapshot database), `ci` (a GitHub Actions run), `browser` (a real Playwright or manual screen check). Only `browser` plus `local-db`/`ci` together count as end-to-end acceptance.
- **Incomplete**, **Blocked** (named prerequisite), **Decision** (owner approval or product decision required), **Unfinished QA** (a review that was queued, rejected or never sent; never report it as passed).
