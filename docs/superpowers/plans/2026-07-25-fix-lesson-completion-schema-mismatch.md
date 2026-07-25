# Fix Live-Schema Alignment (Expanded Scope) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every service/component that was written against the never-applied "canvas enhancements" schema actually work: fix the broken CourseProgress page, create corrected migrations for the lesson-completion and grades/grade-history systems, fix all wrong-column queries, and mount the one orphaned component with a natural home (SubmissionComments) into the live grading UI.

**Architecture:** The live database uses the canvas model (`content_items` + `content_item_progressions`, `assignment_submissions` keyed by `user_id`/`workflow_state`, `quiz_attempts` by `user_id`). Frontend code written against the unapplied migrations expects `lesson_completions`, `lesson_completion_requirements`, `content_progress`, `grades`, `grade_history`, `submission_comments`, `grade_change_notifications`, `grading_sessions`, an RPC `calculate_module_progress`, `assignment_submissions.student_id/status`, `quizzes.total_points`, and `profiles.full_name/email`. Strategy: (a) rewrite the one live-mounted broken consumer (ModuleProgressCard) against live tables; (b) CREATE the missing tables via corrected migrations so the services work; (c) fix wrong-column references in services against tables that already exist; (d) mount SubmissionComments in CanvasGradingInterface.

**Tech Stack:** React 18 + TypeScript (non-strict), TanStack Query, Supabase (Postgres + RLS), Vitest + Testing Library.

## Scope decisions (locked — do not re-litigate)

- NEW lesson-completion tables use `user_id` (repo/live convention); `lessonCompletionService` is updated to match. NEW grades-stack tables keep `student_id` column names because `gradeService`/`gradeHistoryService` and their passing tests are written against `student_id`, and those tables don't exist yet — only their RLS references to the EXISTING `assignment_submissions` table are corrected to `user_id`.
- `LessonCompletionButton` and the `GradeDetailView`/`GradeHistoryViewer` pair stay unmounted: recon confirmed the mounted student player (`LessonViewer` via `CourseLearn`) already has its own completion system on `content_item_progressions`, and the mounted grading page has no natural insertion point for the detail/history pair without a redesign. They become *functional* (their backing tables/services will work) but wiring them in is a product-design decision documented for the user.
- Never apply the files in `supabase/migrations/unapplied/` — they conflict with the live `assignment_submissions` shape. The corrected migrations in Tasks 2-3 supersede them; delete the `unapplied/` files in those tasks.

## Global Constraints

- Live schema facts (verified against project `siuqvhscuiycvdrtiqsh`, 2026-07-25):
  - `assignment_submissions`: `user_id`, `workflow_state` in (`draft`,`unsubmitted`,`submitted`,`graded`), `grade` — NO `student_id`, NO `status`.
  - `profiles`: `id, first_name, last_name, avatar_url, bio, roles, ...` — NO `full_name`, NO `email`.
  - `quizzes`: `points_possible`, `module_id`, `content_item_id` — NO `total_points`.
  - `content_items`: `id, module_id, type, title, position, published`.
  - `content_item_progressions`: `content_item_id, user_id, workflow_state` (`read`/`completed` = done).
  - `quiz_attempts`: `user_id, quiz_id, score, completed_at`.
  - `course_assignments`: `id, user_id, course_id, role` (roles include `instructor`).
  - `lessons`: `id, title, module_id` (legacy, 4 rows); `modules.course_id` exists.
  - RPC `check_course_completion` exists; `calculate_module_progress` does NOT.
- Commit messages: conventional commits, present tense, NO AI/Claude branding or co-author tags (`.claude/CLAUDE.md` rule).
- Tests: `npm run test -- --run <path>` per file; full suite `npm run test -- --run` must end green.
- Migration files go in `supabase/migrations/` named `20260725<HHMMSS>_<name>.sql`; they are applied to the live DB in Task 5 by the controller — implementers only author the SQL files and commit them.

---

### Task 1: Rewrite ModuleProgressCard's data layer against the live schema

The card (mounted on `/courses/:courseId/progress` via `CourseProgressOverview`) currently makes two queries that both fail in production: an RPC call to `calculate_module_progress` (does not exist) and a detail query joining `lessons` → `lesson_completions` (table does not exist) plus `assignment_submissions.status/student_id` (wrong columns). Replace both with one query function against live tables, computing progress client-side.

**Files:**
- Create: `src/components/course/__tests__/ModuleProgressCard.test.tsx`
- Modify: `src/components/course/ModuleProgressCard.tsx`

**Interfaces:**
- Consumes: `supabase` client, `ModuleProgress` from `@/types/course` (unchanged: `{ total_lessons, completed_lessons, total_assignments, completed_assignments, total_quizzes, completed_quizzes, progress_percentage }`).
- Produces: same component props (unchanged — `CourseProgressOverview.tsx:469-487` keeps working): `{ moduleId, moduleTitle, studentId, isLocked?, unlockDate?, prerequisites?, onLessonClick?, showDetails? }`. `onLessonClick` now receives a **content_item id**.

- [ ] **Step 1: Write the failing test**

Create `src/components/course/__tests__/ModuleProgressCard.test.tsx`:

```tsx
// ABOUTME: Tests for ModuleProgressCard — locks its queries to the live schema:
// ABOUTME: content_items + content_item_progressions, no lesson_completions, no RPC.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/utils/test-utils';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { ModuleProgressCard } from '../ModuleProgressCard';

type QueryResult = { data?: unknown; error?: unknown };

function makeTableBuilder(result: QueryResult) {
  const builder: any = {};
  const promise = Promise.resolve({ data: null, error: null, ...result });
  for (const m of [
    'select', 'eq', 'neq', 'in', 'is', 'order', 'limit',
    'gt', 'gte', 'lt', 'lte', 'not', 'or', 'filter', 'match',
  ]) {
    builder[m] = vi.fn(() => builder);
  }
  builder.single = vi.fn(() => promise);
  builder.maybeSingle = vi.fn(() => promise);
  builder.then = (f: any, r: any) => promise.then(f, r);
  return builder;
}

function mockTables(tables: Record<string, QueryResult>) {
  const builders: Record<string, any> = {};
  const queried: string[] = [];
  (mockSupabaseClient.from as ReturnType<typeof vi.fn>).mockImplementation(
    (table: string) => {
      queried.push(table);
      if (!builders[table]) builders[table] = makeTableBuilder(tables[table] ?? {});
      return builders[table];
    }
  );
  return { builders, queried };
}

function stubHappyPath() {
  return mockTables({
    content_items: {
      data: [
        { id: 'i1', title: 'Intro video', type: 'video', position: 1 },
        { id: 'i2', title: 'Reading', type: 'page', position: 2 },
      ],
    },
    content_item_progressions: {
      data: [{ content_item_id: 'i1', workflow_state: 'completed' }],
    },
    assignments: {
      data: [{
        id: 'a1', title: 'Essay', due_date: null, points: 10,
        submissions: [{ id: 's1', workflow_state: 'graded', grade: 9 }],
      }],
    },
    quizzes: {
      data: [{
        id: 'q1', title: 'Quiz 1', points_possible: 5,
        attempts: [],
      }],
    },
  });
}

describe('ModuleProgressCard', () => {
  // REGRESSION: the card used to call the calculate_module_progress RPC and
  // join lessons -> lesson_completions with assignment_submissions.status /
  // student_id. None of those exist in the live database; the page 400'd.
  it('queries live tables only — no RPC, no lessons/lesson_completions, submissions by user_id', async () => {
    const { builders, queried } = stubHappyPath();

    render(
      <ModuleProgressCard
        moduleId="m1"
        moduleTitle="Week 1"
        studentId="user-1"
        showDetails={true}
      />
    );
    await screen.findByText('Week 1');

    expect(mockSupabaseClient.rpc).not.toHaveBeenCalledWith(
      'calculate_module_progress',
      expect.anything()
    );
    expect(queried).not.toContain('lessons');
    expect(queried).not.toContain('lesson_completions');
    expect(queried).toContain('content_items');
    expect(queried).toContain('content_item_progressions');
    expect(builders['content_item_progressions'].eq).toHaveBeenCalledWith('user_id', 'user-1');
    const assignmentSelect = builders['assignments'].select.mock.calls[0][0] as string;
    expect(assignmentSelect).toContain('workflow_state');
    expect(assignmentSelect).not.toMatch(/(^|[,\s(])status([,\s)]|$)/);
    expect(builders['assignments'].eq).toHaveBeenCalledWith('submissions.user_id', 'user-1');
  });

  it('computes progress client-side: 2 of 4 items done (1 content item + 1 graded assignment) = 50%', async () => {
    stubHappyPath();

    render(
      <ModuleProgressCard
        moduleId="m1"
        moduleTitle="Week 1"
        studentId="user-1"
        showDetails={true}
      />
    );
    await screen.findByText('Week 1');

    // i1 completed + a1 graded = 2 done; i2 + q1 not done. 2/4 = 50%.
    expect(screen.getByText(/50%/)).toBeInTheDocument();
    expect(screen.getByText(/2\s*\/\s*4/)).toBeInTheDocument();
  });

  it('renders the error state with retry when a query fails', async () => {
    mockTables({
      content_items: { data: null, error: { message: 'boom' } },
      content_item_progressions: { data: [] },
      assignments: { data: [] },
      quizzes: { data: [] },
    });

    render(
      <ModuleProgressCard
        moduleId="m1"
        moduleTitle="Week 1"
        studentId="user-1"
        showDetails={true}
      />
    );

    expect(
      await screen.findByText(/Failed to load progress for Week 1/i)
    ).toBeInTheDocument();
  });
});
```

Note: adjust the `2 / 4` assertion to whatever "completed/total" copy the card renders (it currently renders `{completedItems}/{totalItems} items completed` — keep that copy and assert on it).

- [ ] **Step 2: Run the test, verify it fails**

Run: `npm run test -- --run src/components/course/__tests__/ModuleProgressCard.test.tsx`
Expected: FAIL — the current component calls `supabase.rpc('calculate_module_progress')` and never resolves past the loading skeleton (mocked rpc returns `{data: null}`), and it queries `lessons`.

- [ ] **Step 3: Rewrite the component's data layer**

In `src/components/course/ModuleProgressCard.tsx`, replace the two `useQuery` blocks (the RPC query at ~lines 56-75 and the detail query at ~lines 78-148) with ONE query:

```tsx
const {
  data: moduleData,
  isLoading,
  error: moduleError,
  refetch,
} = useQuery({
  queryKey: ['module-progress', moduleId, studentId],
  queryFn: async () => {
    // 1. Published content items in this module.
    const itemsRes = await supabase
      .from('content_items')
      .select('id, title, type, position')
      .eq('module_id', moduleId)
      .eq('published', true)
      .order('position');
    if (itemsRes.error) throw new Error(itemsRes.error.message);
    const items = itemsRes.data || [];
    const itemIds = items.map((i) => i.id);

    // 2. The student's progressions, assignments, and quizzes in parallel.
    const [progressionsRes, assignmentsRes, quizzesRes] = await Promise.all([
      itemIds.length
        ? supabase
            .from('content_item_progressions')
            .select('content_item_id, workflow_state')
            .eq('user_id', studentId)
            .in('content_item_id', itemIds)
        : Promise.resolve({ data: [], error: null } as any),
      supabase
        .from('assignments')
        .select(`
          id,
          title,
          due_date,
          points,
          submissions:assignment_submissions!left(
            id,
            workflow_state,
            grade
          )
        `)
        .eq('module_id', moduleId)
        .eq('submissions.user_id', studentId),
      supabase
        .from('quizzes')
        .select(`
          id,
          title,
          points_possible,
          attempts:quiz_attempts!left(
            id,
            score,
            completed_at
          )
        `)
        .eq('module_id', moduleId)
        .eq('attempts.user_id', studentId),
    ]);

    // A failed query must surface as an error — silently rendering empty
    // lists would misrepresent the module content.
    const queryError =
      progressionsRes.error ?? assignmentsRes.error ?? quizzesRes.error;
    if (queryError) throw new Error(queryError.message || 'Failed to load module content');

    const doneItems = new Set(
      (progressionsRes.data || [])
        .filter((p: any) => p.workflow_state === 'read' || p.workflow_state === 'completed')
        .map((p: any) => p.content_item_id)
    );
    const lessons = items.map((i) => ({ ...i, completed: doneItems.has(i.id) }));
    const assignments = assignmentsRes.data || [];
    const quizzes = quizzesRes.data || [];

    const isAssignmentDone = (a: any) =>
      (a.submissions || []).some(
        (s: any) => s.workflow_state === 'graded' || s.grade != null
      );
    const isQuizDone = (q: any) =>
      (q.attempts || []).some((at: any) => at.completed_at);

    const progress: ModuleProgress = {
      total_lessons: lessons.length,
      completed_lessons: lessons.filter((l) => l.completed).length,
      total_assignments: assignments.length,
      completed_assignments: assignments.filter(isAssignmentDone).length,
      total_quizzes: quizzes.length,
      completed_quizzes: quizzes.filter(isQuizDone).length,
      progress_percentage: 0,
    };
    const total = progress.total_lessons + progress.total_assignments + progress.total_quizzes;
    const done = progress.completed_lessons + progress.completed_assignments + progress.completed_quizzes;
    progress.progress_percentage = total ? Math.round((done / total) * 100) : 0;

    return { progress, lessons, assignments, quizzes };
  },
  enabled: !!moduleId && !!studentId,
});
```

Then update the render body:
- `progress` → `moduleData?.progress`; `moduleContent` → `moduleData` (its `lessons`/`assignments`/`quizzes`).
- Error branch: use `moduleError` and `refetch` (there is now one error/retry pair; delete the second `CourseErrorState` block for `contentError` if present).
- In `renderContentItem`: lesson completed check becomes `item.completed === true`; assignment check becomes `item.submissions?.some((s) => s.workflow_state === 'graded' || s.grade != null)`; quiz check unchanged (`attempts?.some((a) => a.completed_at)`).
- Remove the `estimated_time_minutes` chip for lessons (column does not exist on `content_items`).
- Replace `item.total_points` with `item.points_possible` in the quiz row.
- Keep `onLessonClick?.(item.id)` — it now navigates by content_item id, which is what `onNavigateToLesson` handlers use in the canvas model.

- [ ] **Step 4: Run the new test file, verify it passes**

Run: `npm run test -- --run src/components/course/__tests__/ModuleProgressCard.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the neighboring suites that mock or mount this component**

Run: `npm run test -- --run src/components/course/__tests__/CourseProgressOverview.test.tsx src/pages/__tests__/CourseProgress.test.tsx`
Expected: PASS — both mock ModuleProgressCard away, so they should be unaffected; if one fails, the mock path changed and must be fixed here, not there.

- [ ] **Step 6: Commit**

```bash
git add src/components/course/ModuleProgressCard.tsx src/components/course/__tests__/ModuleProgressCard.test.tsx
git commit -m "fix: rewrite ModuleProgressCard against live schema (content_items, user_id/workflow_state)"
```

---

### Task 2: Lesson-completion migration + lessonCompletionService column fixes

Create the three tables `lessonCompletionService` needs (`lesson_completions`, `lesson_completion_requirements`, `content_progress`) with the repo's `user_id` convention, and fix the service's queries against the EXISTING `assignment_submissions` table plus its `student_id` references on the new tables. Update the service's tests to the corrected schema.

**Files:**
- Create: `supabase/migrations/20260725120000_lesson_completion_system.sql`
- Modify: `src/services/lessonCompletionService.ts`
- Modify: `src/services/__tests__/lessonCompletionService.test.ts`
- Modify: `src/types/course.ts` (LessonCompletion type: `student_id` → `user_id`, if the field exists there)
- Modify: `src/hooks/useLessonCompletion.ts` + `src/hooks/__tests__/useLessonCompletion.test.tsx` and `src/components/course/LessonCompletionButton.tsx` ONLY if they reference the renamed fields (hook params named `studentId` may stay — only column/field names in payloads matter)
- Delete: `supabase/migrations/unapplied/20250715090000-canvas-style-course-enhancements.sql`

**Interfaces:**
- Consumes: existing `assignment_submissions` live columns (`user_id`, `workflow_state`, `grade`).
- Produces: SQL tables `lesson_completions(lesson_id, user_id, completed_at, completion_method)`, `lesson_completion_requirements(lesson_id, requirement_type, requirement_data)`, `content_progress(lesson_id, user_id, progress_percentage, time_spent, last_accessed)`. Service API signatures unchanged (params still named `studentId`).

- [ ] **Step 1: Author the migration file**

Create `supabase/migrations/20260725120000_lesson_completion_system.sql` with exactly this content:

```sql
-- Lesson-completion system, corrected for the live schema.
-- Supersedes the never-applied 20250715090000-canvas-style-course-enhancements.sql:
-- that file's assignment_submissions/student_id shape conflicts with the live
-- table (user_id/workflow_state), so these tables are created standalone and
-- keyed by user_id per the live convention.

CREATE TABLE IF NOT EXISTS public.lesson_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT now(),
  completion_method TEXT CHECK (completion_method IN ('manual', 'automatic', 'requirement_met')),
  UNIQUE (lesson_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.lesson_completion_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  requirement_type TEXT NOT NULL CHECK (requirement_type IN ('view', 'participate', 'submit', 'minimum_score', 'mark_done')),
  requirement_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (lesson_id, requirement_type)
);

-- View/access tracking for legacy lessons; lessonCompletionService.trackLessonView
-- upserts on (lesson_id, user_id).
CREATE TABLE IF NOT EXISTS public.content_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  progress_percentage NUMERIC DEFAULT 0,
  time_spent NUMERIC DEFAULT 0,
  last_accessed TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (lesson_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_completions_user ON public.lesson_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_completions_lesson ON public.lesson_completions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_completion_requirements_lesson ON public.lesson_completion_requirements(lesson_id);
CREATE INDEX IF NOT EXISTS idx_content_progress_user ON public.content_progress(user_id);

ALTER TABLE public.lesson_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_completion_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_progress ENABLE ROW LEVEL SECURITY;

-- Students manage their own completion rows.
CREATE POLICY "Users manage own lesson completions" ON public.lesson_completions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Instructors of the owning course can view completions.
CREATE POLICY "Course instructors view lesson completions" ON public.lesson_completions
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.lessons l
      JOIN public.modules m ON m.id = l.module_id
      JOIN public.course_assignments ca ON ca.course_id = m.course_id
      WHERE l.id = lesson_completions.lesson_id
        AND ca.user_id = auth.uid()
        AND ca.role IN ('instructor', 'assistant')
    )
  );

-- Any signed-in user can read requirements (they gate lesson completion).
CREATE POLICY "Authenticated users read lesson requirements" ON public.lesson_completion_requirements
  FOR SELECT TO authenticated USING (true);

-- Instructors of the owning course manage requirements.
CREATE POLICY "Course instructors manage lesson requirements" ON public.lesson_completion_requirements
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.lessons l
      JOIN public.modules m ON m.id = l.module_id
      JOIN public.course_assignments ca ON ca.course_id = m.course_id
      WHERE l.id = lesson_completion_requirements.lesson_id
        AND ca.user_id = auth.uid()
        AND ca.role IN ('instructor', 'assistant')
    )
  );

-- Students manage their own view-tracking rows.
CREATE POLICY "Users manage own content progress" ON public.content_progress
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

- [ ] **Step 2: Update the failing tests first (they define the corrected contract)**

In `src/services/__tests__/lessonCompletionService.test.ts`:
- `markLessonComplete` insert assertion: `{ lesson_id: 'lesson-1', user_id: 'student-1', completion_method: 'manual' }` (was `student_id`).
- All `lesson_completions` fixtures/assertions: `student_id` → `user_id`.
- `makeFilteringSubmissionBuilder`: filter keys `student_id` → `user_id`, `in:status` → `in:workflow_state`; submission fixtures use `user_id`/`workflow_state` (the `makeSubmission` fixture in `src/test/utils/course-fixtures.ts` ALREADY uses the correct names — drop the wrong-name overrides).
- Assertion `expect(submissionBuilder.eq).toHaveBeenCalledWith('student_id', 'student-1')` → `('user_id', 'student-1')`.

Run: `npm run test -- --run src/services/__tests__/lessonCompletionService.test.ts`
Expected: FAIL (service still uses old names).

- [ ] **Step 3: Fix the service**

In `src/services/lessonCompletionService.ts`:
- `markLessonComplete` insert: `student_id: studentId` → `user_id: studentId`.
- `markLessonIncomplete`, `getLessonCompletion`, `getModuleCompletions`, `getCourseCompletions`: `.eq('student_id', studentId)` → `.eq('user_id', studentId)`.
- `checkLessonRequirements` 'submit' case: `.eq('student_id', studentId)` → `.eq('user_id', studentId)`; `.in('status', ['submitted', 'graded'])` → `.in('workflow_state', ['submitted', 'graded'])`.
- 'minimum_score' case: `.eq('student_id', studentId)` → `.eq('user_id', studentId)`.
- `content_progress` queries already use `user_id` — leave them.
- In `src/types/course.ts`, if `LessonCompletion` has `student_id`, rename the field to `user_id`. Check `useLessonCompletion.ts`, its test, and `LessonCompletionButton.tsx` for reads of `.student_id` on completion rows and rename those reads.

- [ ] **Step 4: Run the service + hook + neighboring tests**

Run: `npm run test -- --run src/services/__tests__/lessonCompletionService.test.ts src/hooks/__tests__/useLessonCompletion.test.tsx`
Expected: PASS.

- [ ] **Step 5: Delete the superseded unapplied migration**

```bash
git rm supabase/migrations/unapplied/20250715090000-canvas-style-course-enhancements.sql
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260725120000_lesson_completion_system.sql src/services/lessonCompletionService.ts src/services/__tests__/lessonCompletionService.test.ts src/types/course.ts src/hooks/useLessonCompletion.ts src/hooks/__tests__/useLessonCompletion.test.tsx src/components/course/LessonCompletionButton.tsx
git commit -m "feat: add lesson-completion schema and align service with live columns"
```

---

### Task 3: Grades-stack migration + grade service embed fixes

Create `grades`, `grade_history`, `submission_comments`, `grade_change_notifications`, `grading_sessions` (corrected from the unapplied 20250723000001 file), and fix the latent wrong-column embeds in `gradeService`/`gradeHistoryService` (`profiles.full_name/email` don't exist; `quizzes.total_points` doesn't exist) plus the display components that render those fields.

**Files:**
- Create: `supabase/migrations/20260725121000_grades_and_history_system.sql`
- Modify: `src/services/gradeService.ts`
- Modify: `src/services/gradeHistoryService.ts`
- Modify: `src/components/course/grading/GradeHistoryViewer.tsx`, `src/components/course/grading/SubmissionComments.tsx`, `src/components/course/grading/GradeDetailView.tsx` (display of `full_name` → first/last)
- Modify: `src/services/__tests__/gradeService.test.ts`, `src/services/__tests__/gradeHistoryService.test.ts` (only where they assert on the changed select strings/fields)
- Delete: `supabase/migrations/unapplied/20250723000001-add-grade-history-and-comments.sql`

**Interfaces:**
- Consumes: live `profiles(first_name, last_name, avatar_url)`, `quizzes(points_possible)`, `assignment_submissions(user_id)`, `course_assignments(user_id, course_id, role)`.
- Produces: the five tables below, with `student_id` column naming (matches the services); `grades` has `UNIQUE NULLS NOT DISTINCT (course_id, student_id, assignment_id, quiz_id)` so `gradeService.upsertGrade`'s `onConflict: 'course_id,student_id,assignment_id,quiz_id'` works. Person-name embeds change shape: `{ first_name, last_name, avatar_url }` instead of `{ full_name, avatar_url }` — the `GradeHistoryEntry.changer/student` and `SubmissionComment.author` interfaces in `gradeHistoryService.ts` change accordingly, and a shared helper renders "First Last".

- [ ] **Step 1: Author the migration file**

Create `supabase/migrations/20260725121000_grades_and_history_system.sql`:

```sql
-- Grades + grade-history + submission-comments system, corrected for the live
-- schema. Supersedes the never-applied 20250723000001 file:
--  * RLS that referenced assignment_submissions.student_id now uses user_id
--    (the live column).
--  * grades gains a UNIQUE NULLS NOT DISTINCT index so the frontend's
--    upsert onConflict (course_id,student_id,assignment_id,quiz_id) works.
--  * grades table itself comes from the also-unapplied 20250715090000 file.

CREATE TABLE IF NOT EXISTS public.grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE,
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
  grade_type TEXT NOT NULL CHECK (grade_type IN ('assignment', 'quiz', 'participation', 'final', 'midterm', 'other')),
  points_earned DECIMAL(8,2),
  points_possible DECIMAL(8,2),
  percentage DECIMAL(5,2),
  letter_grade TEXT,
  weight DECIMAL(5,2) DEFAULT 1.0,
  comments TEXT,
  graded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_grades_scope UNIQUE NULLS NOT DISTINCT (course_id, student_id, assignment_id, quiz_id)
);

CREATE TABLE IF NOT EXISTS public.grade_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_id UUID NOT NULL REFERENCES public.grades(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE,
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  previous_points_earned DECIMAL(8,2),
  previous_points_possible DECIMAL(8,2),
  previous_percentage DECIMAL(5,2),
  previous_letter_grade TEXT,
  previous_comments TEXT,
  new_points_earned DECIMAL(8,2),
  new_points_possible DECIMAL(8,2),
  new_percentage DECIMAL(5,2),
  new_letter_grade TEXT,
  new_comments TEXT,
  change_type TEXT NOT NULL CHECK (change_type IN ('created', 'updated', 'deleted', 'excused', 'unexcused')),
  change_reason TEXT,
  changed_by UUID NOT NULL REFERENCES public.profiles(id),
  changed_at TIMESTAMPTZ DEFAULT now(),
  grading_method TEXT,
  rubric_data JSONB,
  submission_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.submission_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL,
  submission_type TEXT NOT NULL CHECK (submission_type IN ('assignment', 'quiz')),
  comment_text TEXT NOT NULL,
  comment_type TEXT NOT NULL CHECK (comment_type IN ('feedback', 'grade_justification', 'question', 'note', 'rubric_feedback')),
  author_id UUID NOT NULL REFERENCES public.profiles(id),
  author_type TEXT NOT NULL CHECK (author_type IN ('instructor', 'student', 'ta', 'grader')),
  is_private BOOLEAN DEFAULT false,
  parent_comment_id UUID REFERENCES public.submission_comments(id) ON DELETE CASCADE,
  thread_position INTEGER DEFAULT 0,
  attachments JSONB,
  rich_content JSONB,
  is_draft BOOLEAN DEFAULT false,
  is_edited BOOLEAN DEFAULT false,
  edit_history JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.grade_change_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_history_id UUID NOT NULL REFERENCES public.grade_history(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('grade_posted', 'grade_updated', 'grade_removed', 'feedback_added')),
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  delivery_method TEXT[] DEFAULT ARRAY['in_app'],
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.grading_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grader_id UUID NOT NULL REFERENCES public.profiles(id),
  course_id UUID NOT NULL REFERENCES public.courses(id),
  assignment_id UUID REFERENCES public.assignments(id),
  quiz_id UUID REFERENCES public.quizzes(id),
  session_type TEXT NOT NULL CHECK (session_type IN ('individual', 'bulk', 'rubric', 'speedgrader')),
  grading_method TEXT CHECK (grading_method IN ('manual', 'rubric', 'auto', 'imported')),
  submissions_graded INTEGER DEFAULT 0,
  total_submissions INTEGER,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  grading_criteria JSONB,
  batch_changes JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_grades_course_student ON public.grades(course_id, student_id);
CREATE INDEX IF NOT EXISTS idx_grade_history_grade_id ON public.grade_history(grade_id);
CREATE INDEX IF NOT EXISTS idx_grade_history_student_course ON public.grade_history(student_id, course_id);
CREATE INDEX IF NOT EXISTS idx_grade_history_changed_at ON public.grade_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_submission_comments_submission ON public.submission_comments(submission_id, submission_type);
CREATE INDEX IF NOT EXISTS idx_submission_comments_author ON public.submission_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_submission_comments_parent ON public.submission_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_grade_notifications_student ON public.grade_change_notifications(student_id);
CREATE INDEX IF NOT EXISTS idx_grade_notifications_unread ON public.grade_change_notifications(student_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_grading_sessions_grader ON public.grading_sessions(grader_id);
CREATE INDEX IF NOT EXISTS idx_grading_sessions_course ON public.grading_sessions(course_id);

ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_change_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grading_sessions ENABLE ROW LEVEL SECURITY;

-- Grades
CREATE POLICY "Students view own grades" ON public.grades
  FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Course staff manage grades" ON public.grades
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.course_assignments ca
      WHERE ca.course_id = grades.course_id
        AND ca.user_id = auth.uid()
        AND ca.role IN ('instructor', 'assistant')
    )
  );

-- Grade history
CREATE POLICY "Course staff view grade history" ON public.grade_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.course_assignments ca
      WHERE ca.course_id = grade_history.course_id
        AND ca.user_id = auth.uid()
        AND ca.role IN ('instructor', 'assistant')
    )
  );
CREATE POLICY "Students view own grade history" ON public.grade_history
  FOR SELECT USING (student_id = auth.uid());

-- Submission comments (corrected: assignment_submissions is keyed by user_id)
CREATE POLICY "Users view comments on their submissions" ON public.submission_comments
  FOR SELECT USING (
    author_id = auth.uid() OR
    (submission_type = 'assignment' AND EXISTS (
      SELECT 1 FROM public.assignment_submissions asub
      WHERE asub.id = submission_comments.submission_id
        AND asub.user_id = auth.uid()
    )) OR
    (submission_type = 'quiz' AND EXISTS (
      SELECT 1 FROM public.quiz_attempts qa
      WHERE qa.id = submission_comments.submission_id
        AND qa.user_id = auth.uid()
    )) OR
    (submission_type = 'assignment' AND EXISTS (
      SELECT 1
      FROM public.assignment_submissions asub
      JOIN public.assignments a ON a.id = asub.assignment_id
      JOIN public.course_assignments ca ON ca.course_id = a.course_id
      WHERE asub.id = submission_comments.submission_id
        AND ca.user_id = auth.uid()
        AND ca.role IN ('instructor', 'assistant')
    ))
  );
CREATE POLICY "Users create comments as themselves" ON public.submission_comments
  FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "Users edit own comments" ON public.submission_comments
  FOR UPDATE USING (author_id = auth.uid());

-- Notifications
CREATE POLICY "Students manage own grade notifications" ON public.grade_change_notifications
  FOR ALL USING (student_id = auth.uid());

-- Grading sessions
CREATE POLICY "Graders manage own sessions" ON public.grading_sessions
  FOR ALL USING (grader_id = auth.uid());

-- Automatic grade-history tracking on grades changes.
CREATE OR REPLACE FUNCTION public.track_grade_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.grade_history (
      grade_id, assignment_id, quiz_id, student_id, course_id,
      new_points_earned, new_points_possible, new_percentage, new_letter_grade, new_comments,
      change_type, changed_by, grading_method
    ) VALUES (
      NEW.id, NEW.assignment_id, NEW.quiz_id, NEW.student_id, NEW.course_id,
      NEW.points_earned, NEW.points_possible, NEW.percentage, NEW.letter_grade, NEW.comments,
      'created', auth.uid(), 'manual'
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF (OLD.points_earned IS DISTINCT FROM NEW.points_earned) OR
       (OLD.points_possible IS DISTINCT FROM NEW.points_possible) OR
       (OLD.percentage IS DISTINCT FROM NEW.percentage) OR
       (OLD.letter_grade IS DISTINCT FROM NEW.letter_grade) OR
       (OLD.comments IS DISTINCT FROM NEW.comments) THEN
      INSERT INTO public.grade_history (
        grade_id, assignment_id, quiz_id, student_id, course_id,
        previous_points_earned, previous_points_possible, previous_percentage, previous_letter_grade, previous_comments,
        new_points_earned, new_points_possible, new_percentage, new_letter_grade, new_comments,
        change_type, changed_by, grading_method
      ) VALUES (
        NEW.id, NEW.assignment_id, NEW.quiz_id, NEW.student_id, NEW.course_id,
        OLD.points_earned, OLD.points_possible, OLD.percentage, OLD.letter_grade, OLD.comments,
        NEW.points_earned, NEW.points_possible, NEW.percentage, NEW.letter_grade, NEW.comments,
        'updated', auth.uid(), 'manual'
      );
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- NOTE: no DELETE branch. grade_history.grade_id is NOT NULL with ON DELETE
-- CASCADE, so a delete-history row would either violate the FK (AFTER DELETE)
-- or be cascade-removed with its parent (BEFORE DELETE) — delete history is
-- unrecordable under this FK design. The 'deleted' change_type remains in the
-- CHECK constraint for manual entries written while the grade still exists.
DROP TRIGGER IF EXISTS track_grade_changes_trigger ON public.grades;
CREATE TRIGGER track_grade_changes_trigger
  AFTER INSERT OR UPDATE ON public.grades
  FOR EACH ROW EXECUTE FUNCTION public.track_grade_changes();

-- Notify students when their grade history records a change.
CREATE OR REPLACE FUNCTION public.create_grade_notification()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.change_type IN ('created', 'updated') THEN
    INSERT INTO public.grade_change_notifications (
      grade_history_id, student_id, course_id, notification_type, title, message
    ) VALUES (
      NEW.id, NEW.student_id, NEW.course_id,
      CASE WHEN NEW.change_type = 'created' THEN 'grade_posted' ELSE 'grade_updated' END,
      CASE WHEN NEW.change_type = 'created' THEN 'New Grade Posted' ELSE 'Grade Updated' END,
      CASE
        WHEN NEW.assignment_id IS NOT NULL THEN 'Your assignment grade has been ' || NEW.change_type
        WHEN NEW.quiz_id IS NOT NULL THEN 'Your quiz grade has been ' || NEW.change_type
        ELSE 'Your grade has been ' || NEW.change_type
      END
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS create_grade_notification_trigger ON public.grade_history;
CREATE TRIGGER create_grade_notification_trigger
  AFTER INSERT ON public.grade_history
  FOR EACH ROW EXECUTE FUNCTION public.create_grade_notification();

-- Stamp edits on submission comments.
CREATE OR REPLACE FUNCTION public.update_comment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.is_edited = true;
  NEW.edit_history = COALESCE(NEW.edit_history, '[]'::jsonb) ||
    jsonb_build_object('edited_at', now(), 'previous_text', OLD.comment_text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_comment_updated_at_trigger ON public.submission_comments;
CREATE TRIGGER update_comment_updated_at_trigger
  BEFORE UPDATE ON public.submission_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_comment_updated_at();
```

- [ ] **Step 2: Fix the latent wrong-column embeds (tests first where they assert on them)**

In `src/services/gradeService.ts`:
- `getGradesByCourse` + `exportGradesToCSV`: `student:profiles!student_id(id, full_name, email, avatar_url)` → `student:profiles!student_id(id, first_name, last_name, avatar_url)`.
- `getGradesByCourse` + `getStudentGrades`: `quiz:quizzes(id, title, total_points, ...)` → `quiz:quizzes(id, title, points_possible, ...)`.
- `exportGradesToCSV`: headers become `['Student Name', 'Assignment/Quiz', 'Type', 'Points Earned', 'Points Possible', 'Percentage', 'Letter Grade']` (email column removed — profiles has no email); row name becomes `` `${grade.student.first_name ?? ''} ${grade.student.last_name ?? ''}`.trim() ``.

In `src/services/gradeHistoryService.ts`:
- Every `profiles!<fk>(full_name, avatar_url)` embed → `(first_name, last_name, avatar_url)` (changer, author, student).
- Interfaces: `changer?/author?/student?` shapes become `{ first_name: string | null; last_name: string | null; avatar_url?: string }`.

In the three grading components (`GradeHistoryViewer.tsx`, `SubmissionComments.tsx`, `GradeDetailView.tsx`): wherever `full_name` is rendered, render `` `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Unknown' `` (extract a tiny local helper per file, or one shared `formatProfileName` in `src/lib/utils.ts` if all three need it).

Update `src/services/__tests__/gradeService.test.ts` / `gradeHistoryService.test.ts` fixtures and assertions only where they reference `full_name`, `email`, or `total_points`.

- [ ] **Step 3: Run the affected suites**

Run: `npm run test -- --run src/services/__tests__/gradeService.test.ts src/services/__tests__/gradeHistoryService.test.ts src/hooks/__tests__/useGrades.test.tsx src/hooks/__tests__/useGradeHistory.test.tsx`
Expected: PASS.

- [ ] **Step 4: Delete the superseded unapplied migration**

```bash
git rm supabase/migrations/unapplied/20250723000001-add-grade-history-and-comments.sql
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260725121000_grades_and_history_system.sql src/services/gradeService.ts src/services/gradeHistoryService.ts src/components/course/grading src/services/__tests__/gradeService.test.ts src/services/__tests__/gradeHistoryService.test.ts
git commit -m "feat: add grades and grade-history schema, fix profile/quiz column embeds"
```

---

### Task 4: Mount SubmissionComments in the live grading interface

`SubmissionComments` (threaded feedback on a submission) is complete and tested but mounted nowhere. Recon found its natural home: `src/pages/CanvasGradingInterface.tsx` (route `/courses/:courseId/assignments/:contentItemId/grade`), inside the grading Card's `CardContent` (~lines 433-501), after the Feedback editor block and before `</CardContent>`, where `selectedSubmission` is in scope.

**Files:**
- Modify: `src/pages/CanvasGradingInterface.tsx`
- Create or modify: the page's test file (`src/pages/__tests__/CanvasGradingInterface.test.tsx` — check if it exists first; if not, create it with only the new mount test, mocking heavy children)

**Interfaces:**
- Consumes: `SubmissionComments` props `{ submissionId: string; submissionType: 'assignment' | 'quiz' }` from `src/components/course/grading/SubmissionComments.tsx:43-60`. `AssignmentSubmission.submission_type` is `string | null` (`src/types/canvas.ts:96`) — submissions graded here are always assignment submissions, so pass the literal `'assignment'`, NOT the nullable field.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing test**

If `src/pages/__tests__/CanvasGradingInterface.test.tsx` exists, add this test to it (reusing its existing setup); otherwise create the file with the project's standard page-test shape (`render` from `@/test/utils/test-utils`, `vi.mocked(useAuth)` with an instructor user, supabase tables routed like `src/pages/__tests__/Dashboard.test.tsx`). Mock the comments component itself:

```tsx
vi.mock('@/components/course/grading/SubmissionComments', () => ({
  SubmissionComments: ({ submissionId, submissionType }: any) => (
    <div data-testid="submission-comments" data-submission-id={submissionId} data-submission-type={submissionType} />
  ),
}));
```

The test: stub the page's queries so one submission exists and gets selected, then assert:

```tsx
const panel = await screen.findByTestId('submission-comments');
expect(panel).toHaveAttribute('data-submission-id', 'sub-1');
expect(panel).toHaveAttribute('data-submission-type', 'assignment');
```

Run it, expect FAIL (component not mounted yet).

- [ ] **Step 2: Mount the component**

In `src/pages/CanvasGradingInterface.tsx`: import `{ SubmissionComments }` from `@/components/course/grading/SubmissionComments`, and inside the grading `CardContent`, after the "Previously graded" `Alert` block (~line 500) and before `</CardContent>`, add:

```tsx
{selectedSubmission && (
  <SubmissionComments
    submissionId={selectedSubmission.id}
    submissionType="assignment"
  />
)}
```

- [ ] **Step 3: Run the page's test file + full grading-adjacent suites**

Run: `npm run test -- --run src/pages/__tests__/CanvasGradingInterface.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/pages/CanvasGradingInterface.tsx src/pages/__tests__/CanvasGradingInterface.test.tsx
git commit -m "feat: mount submission comments panel in grading interface"
```

---

### Task 5: Apply migrations to the live database and regenerate types (controller-executed)

Performed by the session controller (has Supabase MCP access), not an implementer subagent.

- [ ] **Step 1:** Apply `20260725120000_lesson_completion_system.sql` via `apply_migration` (name `lesson_completion_system`).
- [ ] **Step 2:** Apply `20260725121000_grades_and_history_system.sql` via `apply_migration` (name `grades_and_history_system`).
- [ ] **Step 3:** Verify: query `information_schema.tables` for all 8 new tables; run `get_advisors` (security) and address any ERROR-level findings on the new tables.
- [ ] **Step 4:** Regenerate `src/integrations/supabase/types.ts` via `generate_typescript_types`; write and commit:

```bash
git add src/integrations/supabase/types.ts
git commit -m "chore: regenerate supabase types for new schema"
```

---

### Task 6: Full verification

- [ ] **Step 1:** `npm run test -- --run` — full suite green.
- [ ] **Step 2:** `npm run lint` — no new errors (repo baseline has warnings).
- [ ] **Step 3:** Live smoke via SQL: insert-free checks that PostgREST embeds used by the fixed services resolve, e.g. `SELECT 1 FROM grades LIMIT 1;`, `SELECT 1 FROM lesson_completions LIMIT 1;` (empty result = OK, error = broken), and confirm the CourseProgress queries: `SELECT id, title FROM content_items WHERE published = true LIMIT 1;`.
- [ ] **Step 4:** Commit any stragglers; otherwise nothing to commit.

---

## Deliberately not wired (documented for the user, with recommendations)

- `LessonCompletionButton` + the legacy lesson stack UI (`LessonManagerWithMigration`, `ModuleManager`): the mounted student player (`LessonViewer` in `CourseLearn`) already has "Mark as done" on `content_item_progressions`; the legacy `lessons` UI is unrouted (`/courses/:id/management` redirects to the builder). Mounting a second, parallel completion system would confuse the product. The backend now works; if the requirements feature is wanted in the modern flow, port `lessonCompletionService` to key off `content_item_id` and add the editor to `LessonEditView` (builder) — a separate feature effort.
- `GradeDetailView`/`GradeHistoryViewer`: no natural insertion point in the single-page `CanvasGradingInterface` without a redesign (needs a history tab/modal). Backend works after Task 3; wiring is a UX decision.
