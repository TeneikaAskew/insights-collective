# T-34 dependency repair: raw evidence (measured 2026-10-31, npm 10.9.9, node 22.23.4, bun 1.4.4)

Base = main `99f81e3e`. After = this branch. Evidence tier for everything below: **measured** in a
cloud container (commands run, outputs unedited apart from replacing local paths with `<worktree>` /
`<base-checkout>`). Nothing here is a browser, production or Lovable-build observation.

## npm (package-lock.json; what CI installs with `npm install --legacy-peer-deps`)
| File | Command | Result |
|---|---|---|
| `npm-audit-omit-dev-BEFORE-99f81e3e.json` | `npm audit --omit=dev --json` with the repo `.npmrc` | exit 1; 1 critical, 4 high, 5 moderate |
| `npm-audit-omit-dev-AFTER.json` | same, this branch | exit 1; 0 critical, 0 high, 5 moderate |
| `npm-audit-omit-dev-BEFORE-99f81e3e-WITHOUT-repo-npmrc.json` | same lock, **no** `.npmrc` | 1 critical, 5 high, 33 moderate |

The last row matters: the repository `.npmrc` sets `legacy-peer-deps=true`, which changes the tree npm
audits. Counts taken outside a checkout (no `.npmrc`) are not comparable. CI checks out the file, so the
first two rows are the CI-equivalent numbers.

Remaining moderates after: `@tiptap/core`, `@tiptap/starter-kit`, `fflate`, `react-router`,
`react-router-dom` (all need major or out-of-range bumps; not in this repair).

`npm-ls-*.txt`: `npm ls zod @hookform/resolvers dompurify @xmldom/xmldom markdown-it prosemirror-view
react-hook-form --all`, exit 0 both. Before -> after: zod 3.25.67 -> 4.6.7; @hookform/resolvers 3.10.0 ->
5.9.2; dompurify 3.4.13 -> 3.4.17 (direct and via jspdf); @xmldom/xmldom 0.8.13 -> 0.8.15; markdown-it
14.3.0 -> 14.3.3; prosemirror-view 1.40.0 -> 1.42.9; react-hook-form 7.59.0 unchanged. (`@types/dompurify@3.2.0`
is a types package, not the library.) One pre-existing `invalid` peer (`@tiptap/pm@2.23.0` vs
`@tiptap/extension-table` wanting ^3.6.5) is present on both.

`npm install --legacy-peer-deps` on this branch leaves `package-lock.json` byte-identical (lock in sync).
On base `99f81e3e` the same command REWRITES the lock and `npm ci` fails: the lock lacks
`@lovable.dev/vite-plugin-dev-server-bridge` and `@lovable.dev/vite-plugin-hmr-gate`, which Lovable added to
package.json and bun.lock only (commit 13a97da).

## Typecheck
`typecheck-*.log.txt`. The root `tsconfig.json` has `"files": []`, so `npx tsc --noEmit` at the root checks
**0 files** and passes vacuously (shown: with an injected type error it still exits 0). The real command is
`npm run typecheck` = `tsc -b` (references `tsconfig.app.json`, 734 src files, and `tsconfig.node.json`):
exit 0 on base and after; with the injected error it exits 2.

## Real forms (`src/test/__tests__/zodFormsRuntime.test.tsx`), identical file run on base and after
ProfileForm (invalid -> 3 schema messages, no callback; valid -> callback with values), BlogSettings
(empty title -> "Blog title is required", no write; posts_per_page 0 and 51 rejected with no write, 25 saved
via update), BlogPostForm (missing title+content -> both messages, no insert; valid -> insert payload
carries defaults featured=false, allow_comments=true), AssignmentSubmission (invalid URL rejected, valid
URL submitted; text-mode classification below). Base: 9/9 pass. After: 9/9 pass (+2 pairing tests = 11).
Only I/O (supabase) and the two rich editors are stubbed; schema, resolver and form components are real.

**Baseline defect, unchanged by the upgrade:** AssignmentSubmission defaults `url` to `''` and validates it
with `z.string().url().optional()`; `''` is not `undefined`, so a text-only submission is BLOCKED whenever
the hidden url field is empty. Proven on both trees; the cause check (same text submission passes when the
url field already holds a valid URL) also passes on both. Live route: `src/pages/AssignmentDetail.tsx`.
Not fixed here: a product fix must be its own reviewed change, not a side effect of a dependency diff.

## bun.lock (what Lovable writes; release installer NOT verified)
Every bun.lock commit in fetched history is by `gpt-engineer-app[bot]` (Lovable); package-lock.json is
maintained by repository PRs and CI. Lovable's 13a97da added two packages to package.json and bun.lock but not
package-lock. Which lockfile the deployed site's build uses is **not verifiable from here** (no Lovable build
log access); it would be settled by a Lovable build log or project setting.

| File | Command | Result |
|---|---|---|
| `bun-audit-prod-BEFORE-99f81e3e.json` | `bun audit --prod --json` on base package.json+bun.lock | 1 critical, 43 high, 42 moderate, 8 low |
| `bun-audit-prod-AFTER-package-json-only.json` | after `bun install --lockfile-only` with this branch's package.json (scratch copy) | 1 critical, 42 high (only zod cleared) |

bun keeps its own pins (dompurify 3.2.6, @xmldom/xmldom 0.8.10, markdown-it 14.1.0, prosemirror-view 1.40.0),
so the npm-side "0 critical, 0 high" does **not** hold for bun.lock. bun.lock is unchanged on this branch:
no deletion, no regeneration. Options for review: (a) confirm Lovable's build installer; (b) if it is bun,
update bun.lock in a separate reviewed commit and add a bun audit gate; (c) if it is npm, document bun.lock as
editor-only and stop it drifting silently. Owner/reviewer decision.

## Not proven by any of this
The zod advisory cleared by 4.6.7 is GHSA-mrhx-c7xc-m3w5 ("Zod can exhaust memory while validating oversized
constrained collections"). Clearing an advisory is not proof that resource exhaustion is impossible: the app's
own schemas still accept unbounded arrays (`BlogPostForm` `tags: z.array(z.string())`, `AssignmentSubmission`
`files: z.array(z.any()).optional()`). Adding `.max(...)` bounds is a product change for review, not part of
this dependency repair. No exploit was observed or attempted.
