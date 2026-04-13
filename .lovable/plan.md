

## Hardcoded Data Replacement — Database Availability Assessment

### Data Availability Summary

| # | Hardcoded Area | DB Table Exists? | Has Real Data? | Can Replace? | Notes |
|---|---------------|-----------------|---------------|-------------|-------|
| 1 | **Admin Activity Log** (10 fake entries) | `audit_logs` — YES, `security_events` — YES | audit_logs: **0 rows**, security_events: **8,149 rows** | **PARTIAL** | security_events has plenty of data but it's security-focused (login attempts, admin checks), not general user activity. audit_logs exists but is empty — nothing is writing to it yet. Need to either: wire up audit_log triggers on key tables, or display security_events as the activity feed. |
| 2 | **Notifications** (3 mock items) | **NO `notifications` table exists** | N/A | **NO — table must be created** | There is no notifications table in the database at all. A migration is required to create one, plus logic to populate it (e.g., on enrollment, assignment due, announcements). |
| 3 | **Blog Analytics** (random bounce/conversion rates) | `blog_analytics` — YES, `blog_post_views` — YES | blog_analytics: **0 rows**, blog_post_views: **99 rows** | **PARTIAL** | `blog_post_views` has real view data (99 records with view_duration). `blog_analytics` has columns for bounce_rate, referrer_data, avg_time_on_page but is **empty** — nothing writes to it. Can derive view counts from blog_post_views; bounce/conversion rates have no real source. |
| 4 | **Enrolled Courses Dashboard** (random module counts, hardcoded due date) | `modules` — YES, `assignments` — YES, `enrollments` — YES | modules: **16 rows**, assignments with due_date: **16 rows**, enrollments: **22 rows** | **YES** | Real data exists. Module counts can be queried per course. Assignment due dates exist (16 assignments have due_date set). Enrollment data has real completion_status values. |
| 5 | **Dashboard "In Progress" stat** (hardcoded to 2) | `enrollments` — YES | **22 rows** with real completion_status (0-100) | **YES** | Can count enrollments where 0 < completion_status < 100 for the logged-in user. |
| 6 | **Student Insights** (random activity timeline) | `content_item_progressions` — YES, `module_progress` — YES, `lesson_progress` — YES | progressions: **19 rows**, module_progress: **2 rows**, lesson_progress: **0 rows** | **MINIMAL** | Some progress data exists but is sparse. Could show real data where available, but the timeline will look thin compared to the fake 7-day chart. |
| 7 | **Learning Progress Chart** (hardcoded Jan-Jun data) | `enrollments` — YES, `module_progress` — YES | enrollments: **22 rows** with completion_status | **PARTIAL** | Can show real enrollment progress per course, but there's no time-series progress history table. Current data is snapshot-only (current completion %), not "progress over months." Would need a `progress_snapshots` table to track changes over time. |
| 8 | **Lesson Detail page** (entirely from mockService) | `lessons` — YES, `modules` — YES, `courses` — YES, `content_items` — YES | lessons: **4 rows**, modules: **16 rows**, courses: **5 published**, content_items: **59 rows** | **YES** | Real course/module/lesson/content data exists and can replace mockService entirely. |
| 9 | **Job Description Analyzer** (random 70-100% loading) | N/A — cosmetic | N/A | **YES** | Just replace with a proper loading spinner or determinate progress. No DB needed. |
| 10 | **Homepage marketing stats** ("50+ Courses", "10k+ Students", "98% Completion") | `courses`, `profiles`, `enrollments` | 5 courses, 83 users, 22 enrollments | **YES, but numbers are small** | Real counts would show "5 Courses", "83 Students", "~60% Avg Completion" — significantly lower than the marketing claims. May want to keep as aspirational marketing copy or show real numbers. |

---

### Verdict by Category

**Ready to replace now (real data exists):**
- Enrolled Courses Dashboard — module counts, due dates, instructor names
- Dashboard "In Progress" stat — from enrollments
- Lesson Detail page — from courses/modules/lessons/content_items
- Job Description Analyzer loading — cosmetic fix, no DB needed

**Partially replaceable (table exists but data is sparse or missing columns):**
- Admin Activity Log — security_events has 8K+ rows but audit_logs is empty; need to start writing audit_logs via triggers
- Blog Analytics — blog_post_views has 99 rows for view counts; bounce_rate/referrer data has no source
- Student Insights — some progress data exists but very sparse
- Learning Progress Chart — no time-series history exists; only current snapshot

**Requires new infrastructure (table doesn't exist):**
- Notifications — no `notifications` table; must create table + populate logic

---

### Recommended Plan

**Phase 1 — Quick wins (real data exists, swap now):**
1. Dashboard "In Progress" — query enrollments for logged-in user
2. Enrolled Courses — query real module counts, due dates, instructor names
3. Lesson Detail — replace mockService with Supabase queries
4. Job Description Analyzer — replace random % with spinner

**Phase 2 — Wire up existing empty tables:**
5. Admin Activity — show security_events data (8K+ rows) as activity feed, add audit_log triggers for CRUD operations
6. Blog Analytics — use blog_post_views for view counts; remove or hide bounce/conversion cards that have no data source

**Phase 3 — New infrastructure needed:**
7. Create `notifications` table + insert triggers (on enrollment, assignment, announcement)
8. Create `progress_snapshots` table for Learning Progress Chart time-series
9. Student Insights — add activity logging to content_item_progressions

**Phase 4 — Marketing decision (not a code issue):**
10. Homepage stats — decide whether to show real numbers (5 courses, 83 users) or keep as marketing copy

### Files to Modify

| File | Phase | Change |
|------|-------|--------|
| `src/pages/Dashboard.tsx` | 1 | Query real in-progress count |
| `src/pages/EnrolledCoursesDashboard.tsx` | 1 | Query modules, due dates, instructors |
| `src/pages/LessonDetail.tsx` | 1 | Replace mockService with Supabase |
| `src/components/resume/JobDescriptionAnalyzer.tsx` | 1 | Replace random % with spinner |
| `src/pages/AdminActivity.tsx` | 2 | Query security_events table |
| `src/components/blog/analytics/BlogAnalyticsDashboard.tsx` | 2 | Use blog_post_views; hide empty metrics |
| `src/services/blogService.ts` | 2 | Remove Math.random() calls |
| `src/components/layout/NotificationsDropdown.tsx` | 3 | Wire to new notifications table |
| `src/components/home/LearningProgressChart.tsx` | 3 | Wire to new progress_snapshots table |
| `src/components/course/analytics/StudentInsightsDashboard.tsx` | 3 | Wire to real progress data |
| New migration | 2-3 | audit_log triggers, notifications table, progress_snapshots table |

