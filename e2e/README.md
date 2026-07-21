# E2E test setup

Everything needed to run the Playwright suite lives in the repo. To run the
full suite locally or in CI:

1. Copy `.env.example` to `.env`.
2. Provide credentials. You have two options:
   - **Minimal (CI-friendly)**: set `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`,
     and `E2E_TEST_PASSWORD`. `e2e/global-setup.ts` will sign in as the admin
     and reset the instructor/member accounts to `E2E_TEST_PASSWORD` via the
     `admin-users` edge function's `setE2EPassword` action (narrowly scoped to
     the three `e2e-*@insightscollective.org` accounts).
   - **Explicit**: set each `E2E_{ADMIN,INSTRUCTOR,MEMBER}_PASSWORD` directly.
3. Seed fixtures (idempotent):
   ```
   psql "$SUPABASE_DB_URL" -f e2e/fixtures/seed.sql
   ```
4. Run: `npm run test:e2e` (or `npx playwright test`).

## Roles

| Role       | Account                                         | Notes                                                     |
| ---------- | ------------------------------------------------ | --------------------------------------------------------- |
| admin      | `e2e-admin@insightscollective.org`               | Admin flows, roster/report exports                        |
| instructor | `e2e-instructor@insightscollective.org`          | Course builder, grading, primary instructor of the course |
| member     | `e2e-member@insightscollective.org`              | Enrolled student flows, certificates                      |

## Reference fixtures

- Course `660e8400-e29b-41d4-a716-446655440001` — *Introduction to Data Science*
- The instructor above is set as `courses.instructor_id`
- The member is enrolled and has a seeded completion certificate
  (`verification_code = E2EMEMBERCERT`)
