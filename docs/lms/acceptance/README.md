# Independent acceptance lane (read-only preparations)

Proposals from the independent cross-role, cross-device, release acceptance lane, 2026-11-04. These files are inputs to the canonical tracker (`../backlog-tracker.md`), not a competing tracker. Nothing here authorizes a run, migration apply, merge, publish or permission change; every run named needs its own exact approval. No reserved owner file was edited by this lane; the r7.41 text is a proposal for the coordinator to apply in place.

| File | Content |
|---|---|
| `acceptance-plan.md` | Plan revision 5 (2026-11-05: state after the November apply, post-apply identity comparison, merges and closes) on top of revision 4: reconciliation at 14:50 to 18:15 UTC, ownership and collision map (complete PR file pagination), requirement-to-source-to-evidence matrix, role-by-device coverage, bounded run sequence R0 to R12, release and rollback checklist, adopted dispositions and blocked outward steps |
| `prep-1-identity-verification.md` | Read-only served-bundle and live-catalog comparisons with scope, timestamps and unresolved differences; before/after procedure for any apply |
| `prep-2-role-negative-cases.md` | N-C1, N-C3, N-C6, N-C9 negative-case proposals for the carrier owners |
| `prep-3-playwright-spec-triage.md` | The 123 specs classified into isolated-safe, production-ref-bound and lane-owned (counts verified) |
| `prep-4-tracker-r7.41-proposal.md` | Proposed tracker r7.41 text for the coordinator |

Evidence tiers follow `../README.md`. Source merges, green CI, jsdom, older runtime runs and served-site observations are separate states and are labelled as such throughout.
