

## Plan: LessonDetail Fix + Responsive Audit via Playwright

### Part 1: Replace mockService in LessonDetail.tsx

**File:** `src/pages/LessonDetail.tsx`

Replace `mockService.getCourseById()`, `mockService.getModuleById()`, and the mock lesson lookup with Supabase queries using `useQuery` from TanStack Query:

- Query `courses` table by `courseId`
- Query `modules` table by `moduleId` 
- Query `lessons` table by `lessonId` (with `module_id = moduleId`)
- Query `lesson_progress` table for current user to determine completion status
- Update `handleMarkComplete` to upsert into `lesson_progress`
- Add loading spinner while data fetches
- Keep the existing "Lesson Not Found" fallback for missing data

**DB tables confirmed available:** `courses` (5 rows), `modules` (16 rows), `lessons` (4 rows), `lesson_progress` (schema confirmed with `completed`, `completed_at` columns).

### Part 2: Responsive Audit via Playwright

Use Playwright browser automation to capture screenshots of all course-related pages at mobile (390x844), tablet (768x1024), and desktop (1280x720) viewports. The screenshot from the user shows the CanvasModuleDetail page with text overflow issues on mobile.

**Pages to test (course features first):**

1. `/courses` — Course list
2. `/courses/:id` — Course detail (tabs, modules list, announcements)
3. `/courses/:id/modules/:id` — Module detail (the page in the screenshot — grid layout, content sidebar, lesson viewer)
4. `/courses/:id/modules/:id/content/:id` — Content item view
5. `/courses/:id/progress` — Course progress
6. `/courses/:id/calendar` — Course calendar
7. `/courses/:id/certificate` — Certificate page
8. `/courses/:id/learn` — Learn interface
9. `/enrolled-courses` — Enrolled courses dashboard
10. `/courses/:id/gradebook` — Gradebook
11. `/dashboard` — Main dashboard

**Known responsive risk areas based on code inspection:**
- `CanvasModuleDetail.tsx` line 318: `flex justify-between items-start` — the "Progress / 100%" text can collide with the module title on narrow screens
- `CanvasModuleDetail.tsx` line 339: `grid lg:grid-cols-4` — stacks on mobile but the module content sidebar takes full width before the lesson content
- `LessonDetail.tsx` line 78: Same `flex justify-between` pattern with badge potentially overlapping title
- `CourseDetail.tsx`: 870-line page with tabs, forms, and multiple card layouts — likely has overflow issues on mobile

**Process:**
1. Log in using E2E credentials
2. Navigate to each page at 3 viewport sizes
3. Capture screenshots
4. Identify overflow, truncation, overlapping, and layout issues
5. Report findings with specific line numbers and fix recommendations

### Files to modify

| File | Change |
|------|--------|
| `src/pages/LessonDetail.tsx` | Replace mockService with Supabase queries + lesson_progress upsert |

### Deliverables

1. Working LessonDetail page with real DB data
2. Screenshot-based responsive audit report covering all course pages at 3 breakpoints
3. List of specific responsive issues found with fix recommendations

