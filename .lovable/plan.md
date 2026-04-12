

# Plan: Run Full E2E Test Suite

## What exists
You already have **60+ E2E spec files** covering every major area of the app — admin, auth, courses, career, interviews, portfolio, blog, survey, events, messages, navigation, and more. The infrastructure (Playwright config, global setup/teardown, fixtures for member/admin/instructor roles) is all in place.

## What needs to happen

### 1. Install Playwright browsers
```bash
npx playwright install --with-deps chromium firefox
```

### 2. Start the dev server
The tests expect the app running at `http://localhost:8080`.

### 3. Seed test credentials
Global setup (`e2e/global-setup.ts`) logs in as member, admin, and instructor using `E2E_*` environment variables and saves session files to `.playwright-sessions/`.

### 4. Run all tests
```bash
npx playwright test --reporter=list
```
This runs all 60+ specs across 5 projects: chromium-member, chromium-admin, chromium-instructor, chromium-public, and firefox.

### 5. Generate report
```bash
npx playwright show-report
```
Export the HTML report to `/mnt/documents/` for review.

## Coverage summary (already written)

| Area | Specs | Routes covered |
|------|-------|---------------|
| Admin | 11 specs | /admin, /admin/activity, users, courses, events, blog, forms, page-visibility, local-storage-debug |
| Auth | 5 specs | /login, /register, /reset-password, /auth/callback, redirect flows |
| Courses | 13 specs | /courses, /enrolled-courses, /course-management, detail, builder, learn, gradebook, rubrics, question-banks, progress, certificate, calendar |
| Assignments | 4 specs | submission, grading, quiz taking, quiz results |
| Career/AI | 6 specs | /career-agent, /career-pathway, /assistants, /assistant/:id, /explore-data-careers, /resume |
| Interview | 6 specs | /interview-prep, code-practice, mock-interviews, mock-interview-room, star-practice, job-description |
| Portfolio | 3 specs | explorer, editor, public portfolio |
| Events | 2 specs | /events, /events/:id |
| Messages | 1 spec | /messages |
| Blog | 2 specs | /blog/:slug, /data-blueprint-series |
| Survey | 3 specs | /survey, /survey/:slug, /survey-confirmation |
| Navigation | 4 specs | layout, sidebar, route parity, session flows |
| Dashboard | 1 spec | /dashboard |
| Calendar | 1 spec | /calendar |
| Notifications | 1 spec | /notifications |
| Profile | 1 spec | /profile |
| Resources | 2 specs | /resources, social archives |
| Legal | 2 specs | /privacy-policy, /terms-of-service |
| Landing | 1 spec | / |

**Total: 69 spec files covering all routes and major functionality.**

## Missing pages (not yet covered)
- `/user-dashboard` — no dedicated spec
- `/create-blog-post` and `/edit-blog-post/:slug` — no specs
- `/courses/:courseId/insights` (StudentInsights) — no spec

## Deliverable
After running, I will provide a full pass/fail report with error details for any failures, plus the HTML report as a downloadable artifact.

