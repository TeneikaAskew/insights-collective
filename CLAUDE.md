# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands
```bash
npm install # Install dependencies (including Vite)
npm install vite --save-dev # If you still get the error, install Vite directly:


**Development**
```bash
npm run dev       # Start development server on http://localhost:8080
npm run build     # Production build with Vite
npm run build:dev # Development build with Vite
npm run preview   # Preview production build locally
npm run lint      # Run ESLint for code quality checks
```

**Testing**
```bash
npm run test          # Run all tests in watch mode
npm run test:ui       # Run tests with Vitest UI
npm run test:coverage # Run tests with coverage report
```

**Supabase Local Development** (if needed)
```bash
supabase start    # Start local Supabase instance
supabase db push  # Push migrations to local database
supabase functions serve [function-name] # Test Edge Functions locally
supabase link --project-ref siuqvhscuiycvdrtiqsh
```

## High-Level Architecture

### Tech Stack
- **Frontend**: React 18 + TypeScript, Vite, TailwindCSS, shadcn/ui components
- **Backend**: Supabase (PostgreSQL, Edge Functions with Deno)
- **State Management**: React Context API + TanStack Query (React Query)
- **Routing**: React Router v6
- **AI Integration**: Together AI API for assistant responses

### Application Structure

**Provider Hierarchy**
```
QueryClientProvider (TanStack Query)
└── Router (React Router)
    └── AuthProvider (Authentication state)
        └── PageVisibilityProvider (Access control)
            └── OnboardingProvider (User onboarding)
                └── Application Routes
```

### Key Architectural Patterns

1. **Feature-Based Component Organization**
   - Components grouped by domain: `/components/course/`, `/components/portfolio/`, `/components/admin/`
   - Shared UI components in `/components/ui/` (shadcn/ui)
   - Each feature may have its own types, utils, and sub-components

2. **Service Layer Pattern**
   - API calls abstracted in `/services/` directory
   - Services handle Supabase queries, error handling, and data transformation
   - Example: `blogService.ts`, `conversationService.ts`, `quizService.ts`

3. **Custom Hooks for Business Logic**
   - Extensive hook usage in `/hooks/` for encapsulating feature logic
   - Hooks use React Query for server state management
   - Pattern: `use[Feature]` returns data, loading states, and mutations

4. **Type Safety**
   - TypeScript throughout with generated Supabase types
   - Types organized in `/types/` directory
   - Note: TypeScript is configured with relaxed rules (no strict null checks, implicit any allowed)

### Core Application Flows

1. **Authentication Flow**
   - Supabase Auth with session persistence in localStorage
   - Role-based access: user, instructor, admin
   - Social auth support (Google, GitHub, Twitter)
   - Protected routes redirect to login, then back to intended destination

2. **Course System**
   - Hierarchical structure: Courses → Modules → Lessons
   - Instructor permissions for course management
   - Student enrollment and progress tracking
   - Content blocks system for flexible lesson content

3. **AI Assistant System**
   - Multiple specialized assistants defined in `/data/assistantData.ts`
   - Chat interface with message history persistence
   - Structured response parsing for career reports
   - Integration through Supabase Edge Functions

4. **Portfolio System**
   - Custom portfolio pages with unique URLs
   - Multiple layout templates (Classic, Grid, Hero, etc.)
   - Public viewing without authentication
   - Project showcase and skill tracking

### Important Contexts

- **AuthContext**: User session, roles, login/logout functionality
- **OnboardingContext**: First-time user guidance and tours
- **PageVisibilityContext**: Page-level access control (page catalog lives in `src/config/pageManifest.ts`; enforcement is the `VisibilityGate` layout route)

### Supabase Edge Functions

Key functions in `/supabase/functions/`:
- `assistant-ai`: Handles AI assistant chat interactions
- `resume-analyzer`: Analyzes and scores resume content
- `together-ai`: Integration with Together AI API
- `generate-career-action-plan`: Creates structured career guidance

### Path Aliases

The project uses `@/` as an alias for `./src/`:
```typescript
import { Button } from "@/components/ui/button"
// Resolves to: ./src/components/ui/button
```

### Key Dependencies

- **UI Framework**: React + shadcn/ui components
- **Styling**: TailwindCSS with custom animations
- **Forms**: react-hook-form with zod validation
- **Rich Text**: Monaco Editor for code editing
- **Charts**: Recharts for data visualization
- **File Handling**: react-dropzone for uploads
- **Date Handling**: date-fns
- **Icons**: lucide-react + react-icons

### Development Notes

1. The project is a Lovable.dev application (AI-assisted development platform)
2. Component tagging is enabled in development mode for Lovable integration
3. ESLint is configured but with relaxed rules (unused vars allowed)
4. Vitest is configured for unit testing with React Testing Library
5. The application requires Supabase environment variables to function properly

### Testing Architecture

**Test Organization**
- Unit tests are colocated with source files in `__tests__` directories
- Test utilities and mocks are in `/src/test/`
- Coverage reports exclude test files, config files, and main.tsx

**Test Stack**
- **Framework**: Vitest (Vite-native test runner)
- **React Testing**: @testing-library/react for component testing
- **Mocking**: Vitest vi.mock() and custom Supabase mocks
- **Coverage**: Vitest with v8 provider

**Key Test Patterns**
1. **Component Tests**: Use custom render function with all providers
2. **Hook Tests**: Use renderHook with proper wrappers
3. **Service Tests**: Mock Supabase client responses
4. **Authentication Tests**: Mock auth states and user profiles

**Running Tests**
```bash
# Run specific test file
npm run test src/components/auth/__tests__/Login.test.tsx

# Run tests matching pattern
npm run test -- --grep "authentication"

# Run tests in CI mode (no watch)
npm run test -- --run
```
### Hard-won rules (evidence in docs/lessons-learned/)

**Before claiming the environment can't do something, run the command that
would do it.** `npx playwright install` works here (only the *postinstall* is
skipped via `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD`); a spec that stubs its data
needs no globalSetup and runs under a scratch config.

**The full E2E suite runs here, signed in, against the real project — use
`npm run e2e:relay`.** The browser cannot reach Supabase over HTTPS directly, so
`E2E_USE_RELAY=1` starts `scripts/e2e/serve.mjs`: a loopback relay to the project
plus a dev server pointed at it, which is what `playwright.config.ts` then uses as
its `webServer`. Everything works from there — global-setup signs in all four
roles and saves storage state, and signed-in specs pass. Plain
`npx playwright test` is what fails, and only because it skips the relay.

Two things that will mislead you into "it can't run here", both of which have:
- **Read the environment, not `.env`.** `.env` is a *template*: `E2E_MEMBER_PASSWORD`
  and friends are present but empty in the file, while the real values are in the
  process environment. Check `printenv E2E_MEMBER_PASSWORD`, not the file.
- **A blank page under a hand-rolled config is the missing relay, not a broken
  sandbox.** Without it the app mounts and then hangs on its first Supabase call,
  which looks exactly like a stalled proxy.

Visual baselines are the one thing relay mode cannot validate — it blocks fonts
and images, so never refresh snapshots from a relay run.

**E2E specifics that have each broken CI at least once:**
- Responsive components (e.g. `RoleTable`) mount BOTH presentations at every
  width; CSS hides one. Every Playwright read needs a visibility filter:
  `:visible` in selectors, `.filter({ visible: true })` on `getByText`.
  `count()`/`evaluateAll` never auto-filter hidden elements.
- The console-error fixture instruments only the injected `page`. To run a
  test signed out, override `test.use({ storageState: { cookies: [], origins: [] } })`
  — a hand-built `browser.newContext()` page escapes the instrumentation.
- A test asserting signed-out UI must not live unmodified in a signed-in
  project; that's a race against session restore, and retries only mask it.

**CI attribution, in order:** PR checks run against the *merge* of head into
main. Before owning a failure, reproduce it on `origin/main` alone
(`git checkout origin/main && npx vitest run <spec>`), and check main's own
push-run conclusions. Stacked PRs (base ≠ main) run NEITHER `test.yml` NOR
`e2e.yml` — their green is a subset; retarget to main before trusting it.

**The repo describes intent; only the live system describes state.** A
migration on main may not be applied (`/course-art` sat unapplied while prod
hotlinked Unsplash); a deployed Edge Function may not match the repo (deploy
from the file, never edit payloads in flight). When debugging anything
data-shaped, query the live table first.

**Apply migrations through `db-migrate.yml`, never the Supabase MCP's
`apply_migration`.** That tool stamps its own version (`20260811114625`) which can
never match the repo filename it came from (`20260811010000_*.sql`), so the file
reads as pending forever while its effects are live. Twenty-five such orphan rows
accumulated over three weeks before anyone reconciled them. The workflow derives
the version from the filename and commits the schema change and the ledger row in
one transaction, so the two cannot disagree. Use `execute_sql` for reads freely;
for DDL, dispatch the workflow.

**Dispatch that workflow yourself — do not hand it back to the user.** This is a
tooling rule, not a permission boundary: the GitHub MCP can run it, and telling
someone "now go dispatch db-migrate.yml" when you could have done it is a handoff
with no purpose. Use `actions_run_trigger` with `method: run_workflow`,
`workflow_id: db-migrate.yml`, and **`ref` set to your working branch** — the
workflow resolves the migration file on the ref it runs on, so dispatching against
`main` cannot see a file that only exists on your branch:

```
inputs: { migration: '<filename>.sql', confirm: 'apply', verify_table: '<table>' }
```

Then confirm against the live database rather than the green check — the object
exists and `schema_migrations` holds the filename's version:

```sql
select indexdef from pg_indexes where indexname = '...';
select count(*) from supabase_migrations.schema_migrations where version = '<version>';
```

A green run whose ledger version does not equal the filename's leading digits is
the orphan-row failure above, not a success.

If the workflow is genuinely unavailable, `execute_sql` may run the DDL **only**
when the matching ledger row goes in with it — `insert into
supabase_migrations.schema_migrations (version) values ('<leading digits of the
filename>')` — because a schema change without its ledger row is the same
divergence from the other direction: `db push` would later run the file a second
time. Still never `apply_migration`; the version it invents is the whole problem.

Ask first only when the migration is destructive or hard to reverse (dropping a
column, rewriting data). An additive index or constraint on a branch the user
asked you to work on does not need a second confirmation.

**Never reuse a migration version.** Supabase records by version, not filename:
the second file to carry a version is skipped in silence, and the ledger then
claims both applied. `20260728000000` was carried by two files;
`hide_quiz_answer_key` ran and `prune_page_visibility_dead_paths` never did, which
only surfaced two weeks later from `schema_migrations.name`. `npm run
check:migrations` (also a PR check) catches this at authoring time. If a
collision is already applied, renumber the skipped file and settle it with
`RECORD:<version>` plus a `scripts/reconcile/` script — do not blindly run it,
since a migration written months ago can seed rows the manifest has since retired.
