# Checks that check nothing

A green check you have never seen go red is not evidence. Three things in this
repository looked like verification and were not, plus the tool behaviours that
made assertions fail for reasons unrelated to the code.

---

## 1. `tsc --noEmit` typechecked zero files, for an entire session

`tsconfig.json` here is a **solution file**:

```json
{ "compilerOptions": { ... }, "files": [], "references": [
  { "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" } ] }
```

`"files": []` with `references` means the root project contains no files. `npx tsc
--noEmit` dutifully checks all zero of them and exits 0. I reported "tsc clean"
perhaps a dozen times across the session on that basis.

The correct invocation is `tsc -b`, which follows the references. Switching
found, immediately:

- a second `RecommendedRole` interface in `src/components/assistants/types.ts`
  still carrying the `salaryRange` field I had removed from
  `utils/types.ts` — six call sites broken;
- `Brain is not defined` in `src/pages/ExploreDataCareers.tsx`, from removing an
  icon import while `CategoryIcon` still used it. That one **rendered the page
  blank**, and `npm run build` passed anyway (Vite does not typecheck).

Added `"typecheck": "tsc -b"` to `package.json`, then **proved it works**:

```
$ printf 'const broken: number = "not a number";\n' >> src/components/careers/WageBand.tsx
$ npm run typecheck
src/components/careers/WageBand.tsx(109,7): error TS2322: Type 'string' is not
  assignable to type 'number'.
```

**Rule.** When you adopt a check, break something on purpose and confirm it goes
red. A check that has only ever been green is an untested code path.

**Corollary.** `npm run build` passing is not a typecheck. Vite/esbuild strip
types without checking them.

---

## 2. Tests that pass whether or not the feature works

`e2e/career/explore-data-careers.spec.ts` had eight tests and this shape
throughout:

```ts
test('career role cards are visible', async ({ page }) => {
  const cards = page.locator('[class*="Card"], article, [class*="role"]').first();
  if (await cards.count() > 0) {          // absent -> zero -> test passes
    await expect(cards).toBeVisible();
  }
});

test('search input filters roles', async ({ page }) => {
  const searchInput = page.locator(Sel.searchInput).first();
  if (await searchInput.count() > 0) {
    await searchInput.fill('analyst');
    await page.waitForTimeout(400);       // no assertion at all
  }
});
```

Across the whole `e2e/` tree there were **zero** matches for `salary`, `wage`,
`BLS` or `RoleCard`. A feature can be entirely uncovered while its page has eight
green tests.

After rewriting with unconditional assertions, I demonstrated the tests could
fail — the step that makes them worth having:

```
# point the hook at a view that does not exist
- .from('career_role_wages')
+ .from('career_role_wages_MISSING')
6 failed          <- all wage assertions
# restore
6 passed
```

**Rule.** `if (count > 0)` in a test is a request to pass. So is a test body with
no `expect`. Before believing a new spec, make the thing it tests unavailable and
watch it go red.

---

## 3. Fabricated data survives because nobody greps for its shape

Auditing "where do salary figures come from" turned up, in shipped code:

| where | what |
|---|---|
| `supabase/functions/generate-career-action-plan/index.ts:197` | `` salary: `$${60000 + Math.floor(Math.random() * 40000)} - ...` `` — a **`Math.random()` salary**, re-rolled per generation, attached to a project title rather than an occupation |
| `supabase/functions/assistant-ai/index.ts` | an undated hardcoded salary ladder in the system prompt, which the model answered pay questions from |
| `supabase/functions/evaluateCareerAdvice/index.ts` | prompt schema *required* the model to emit `salaryRange`, and the result was persisted to `career_pathway_results` |
| `src/components/assistants/InteractiveCareerReportSection.tsx` | `reportData` defaulted to a fixture: a fake named person with invented salaries and match percentages, rendered whenever the prop was missing |
| `src/data/dataCareerRoles.ts` | course recommendations referencing ids (`da101`, `ml201`) for courses that **do not exist** — every link a 404 |

None of these are typos. Each was written deliberately as a placeholder and then
became load-bearing.

**Rule.** Grep for the *shape*: `Math.random`, `salary`, `\$[0-9]{2,3}[Kk,]`,
`|| 'Not specified'`, `sample`/`demo`/`placeholder` as a default prop. Then ask
of every number on screen: which query produced this? If none, it is a claim the
product is making without evidence.

---

## 4. Tool behaviours that make assertions fail for the wrong reason

Recording these because each cost a debugging cycle where the product was fine.

**Playwright**

- `locator.all()` and `locator.evaluateAll()` **do not auto-retry**. They race
  async data where `expect(...).toHaveCount()` would have waited. Wait for the
  data with a retrying assertion first, then read attributes.
- Radix `Select` renders a `<button role="combobox">`, not a `<select>`.
  `selectOption()` fails; click the trigger and click the option.
- Radix tabs do not respond to a synthetic `element.click()` from
  `page.evaluate()`. Use a real Playwright click.
- Rendering desktop and mobile copies of the same control puts **two matching
  elements** in the DOM. Strict mode fails on both `getByPlaceholder` and
  `getByLabel` unless the labels differ; `{ exact: true }` will still match
  `"Salary Range"` inside `"Salary Range (mobile)"` only if you are careful.
- A `placeholder` is not an accessible name. Three controls here had no
  accessible name at all — a real defect the tests surfaced.
- Pagination bites test authors: `#role-data-analyst` is not in the DOM when the
  page shows the first 9 of 33 alphabetically. Search first, then click.

**Environment**

- `tsconfig` aside, the sandbox browser has **no outbound egress** while the
  shell does. Every in-page Supabase call fails `ERR_CONNECTION_RESET` while
  `curl` to the same host succeeds. Solved with an opt-in `page.route` bridge
  (`e2e/fixtures/supabase-bridge.ts`, `E2E_SUPABASE_BRIDGE=1`) — deliberately not
  automatic, since a bridge that always engaged would hide a real network
  regression.
- Relaying through that bridge, `curl -i` is wrong: through an HTTPS proxy the
  response contains **two header blocks** (the `CONNECT` 200 first). Splitting on
  the first blank line truncates the body and drops `Content-Type`, which then
  fails MIME checks on module scripts. Use `-D headers -o body` and parse the
  **last** block.
- `supabase db push` could not run here: the direct connection wants a database
  password and `db.<ref>.supabase.co` resolves **IPv6-only**, which the container
  cannot route. The Management API (`POST /v1/projects/{ref}/database/query`)
  works over IPv4 and needs only the access token.
- Playwright's browser revision is pinned per version. `/opt/pw-browsers` had
  `chromium-1194`; Playwright 1.59.1 wanted `1217`, and the headless shell has a
  different internal directory layout between the two.

---

## 5. `git add -A` after a build step commits build output

Adding `"typecheck": "tsc -b"` meant `tsc` began emitting
`tsconfig.app.tsbuildinfo` and `tsconfig.node.tsbuildinfo`. Neither was in
`.gitignore`, and `git add -A` swept both into a commit. They change on every
typecheck, so they would have produced noise in every future diff.

**Rule.** After introducing a command that writes files, run `git status` before
staging. Prefer explicit paths over `-A` when a build step just ran.
