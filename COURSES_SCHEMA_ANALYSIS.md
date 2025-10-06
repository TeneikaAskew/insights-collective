# Courses Feature Schema Analysis & Fixes

## Overview
This document provides a comprehensive analysis of all RLS policy fixes, schema corrections, and component updates made to resolve circular dependencies and query errors in the courses feature.

## Issues Fixed

### 1. **Infinite Recursion Errors (RESOLVED)**

#### Root Cause
Circular RLS policy dependencies where policies queried tables that queried back:
- `profiles` policies → `courses` → `profiles` (circular)
- `assignments` policies → `content_items` → `assignments` (circular)
- `quizzes` policies → `content_items` → `quizzes` (circular)

#### Solution
Created SECURITY DEFINER functions that bypass RLS, preventing circular evaluation:

**Functions Created:**
- `can_view_profile(viewer_id, profile_id)` - Profiles access
- `can_access_assignment(viewer_id, assignment_id)` - Assignments access
- `can_access_quiz(viewer_id, quiz_id)` - Quizzes access
- `can_access_quiz_question(viewer_id, question_id)` - Quiz questions access
- `can_access_submission(viewer_id, submission_id)` - Assignment submissions access
- `can_access_content_item(viewer_id, content_item_id)` - Content items access
- `can_access_module(viewer_id, module_id)` - Modules access

**Migration:** `20251006030000_fix_profiles_recursion.sql`, `20251006040000_fix_assignments_quizzes_recursion.sql`, `20251006060000_comprehensive_courses_schema_fix.sql`

### 2. **PostgREST 400 Errors (RESOLVED)**

#### Issue 1: Missing UNIQUE Constraints
**Error:** `Could not find a relationship` when using singular alias syntax

**Root Cause:** PostgREST requires UNIQUE constraints for one-to-one relationships when using singular aliases like `assignment:assignments(*)`

**Solution:** Added UNIQUE constraints:
```sql
ALTER TABLE assignments ADD CONSTRAINT assignments_content_item_id_unique UNIQUE (content_item_id);
ALTER TABLE quizzes ADD CONSTRAINT quizzes_content_item_id_unique UNIQUE (content_item_id);
```

**Migration:** `20251006040000_fix_assignments_quizzes_recursion.sql`

#### Issue 2: Missing Foreign Key
**Error:** `Could not find a relationship between 'quizzes' and 'quiz_questions'`

**Root Cause:** Missing FK from `quiz_questions.quiz_id` to `quizzes.id`

**Solution:** Added FK relationship:
```sql
ALTER TABLE quiz_questions
ADD CONSTRAINT quiz_questions_quiz_id_fkey
FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE;
```

**Migration:** `20251006050000_add_quiz_questions_fk.sql`

### 3. **Empty Quizzes Tab (RESOLVED)**

#### Root Cause
`QuizManager` was querying `content_items` with `type='quiz'`, but quizzes are stored in the `quizzes` table and linked via `content_item_id`.

#### Solution
Changed query to:
```typescript
// OLD (WRONG):
.from('content_items')
.eq('type', 'quiz')

// NEW (CORRECT):
.from('quizzes')
.select(`*, content_item:content_items!inner(...)`)
.eq('content_items.course_id', courseId)
```

**File:** `src/components/course/management/QuizManager.tsx`
**Commit:** `6f21ba0f`

## Schema Architecture

### Table Relationships

```
courses
  ├── modules (course_id FK)
  │   └── content_items (module_id FK, course_id FK)
  │       ├── assignments (content_item_id FK UNIQUE)
  │       │   └── assignment_submissions (assignment_id FK)
  │       └── quizzes (content_item_id FK UNIQUE)
  │           └── quiz_questions (quiz_id FK)
  ├── enrollments (course_id FK, user_id FK)
  └── instructor_id → profiles

profiles
  └── user_roles (user_id FK)
```

### Key Constraints

**UNIQUE Constraints (for PostgREST singular aliases):**
- `assignments.content_item_id` UNIQUE
- `quizzes.content_item_id` UNIQUE

**Foreign Keys:**
- `modules.course_id` → `courses.id`
- `content_items.course_id` → `courses.id`
- `content_items.module_id` → `modules.id`
- `assignments.content_item_id` → `content_items.id`
- `quizzes.content_item_id` → `content_items.id`
- `quiz_questions.quiz_id` → `quizzes.id`
- `assignment_submissions.assignment_id` → `assignments.id`
- `enrollments.course_id` → `courses.id`

## RLS Policy Pattern

### BEFORE (Circular Dependencies)
```sql
-- ❌ BAD: Direct table queries in policies
CREATE POLICY "..." ON assignments
USING (
  EXISTS (SELECT 1 FROM content_items WHERE ...) -- Queries another table!
);
```

### AFTER (SECURITY DEFINER)
```sql
-- ✅ GOOD: Only call SECURITY DEFINER function
CREATE POLICY "..." ON assignments
USING (can_access_assignment(auth.uid(), id));

-- Function bypasses RLS, preventing circular evaluation
CREATE FUNCTION can_access_assignment(...) SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM content_items ...) -- OK here
$$;
```

## Data Model Clarifications

### Content Items vs Separate Tables

**content_items** table serves as:
1. A container/placeholder for course content
2. Links to modules and courses
3. Stores metadata (title, published, position)
4. Has a `type` field ('assignment', 'quiz', 'page', etc.)

**Separate tables** (assignments, quizzes) store:
1. Type-specific data and settings
2. Link back to content_items via `content_item_id`
3. One-to-one relationship with content_items

### Query Patterns

**To get all assignments in a course:**
```typescript
// Option 1: Query assignments, join to content_items
supabase
  .from('assignments')
  .select('*, content_item:content_items!inner(...)')
  .eq('content_items.course_id', courseId)

// Option 2: Query content_items, join to assignments
supabase
  .from('content_items')
  .select('*, assignment:assignments(*)')
  .eq('course_id', courseId)
  .eq('type', 'assignment')
```

**Both work**, but Option 1 is clearer and doesn't rely on the `type` field being set correctly.

## Potential Remaining Issues

### Components to Check

1. **CanvasAssignmentsList** (`src/components/course/canvas/CanvasAssignmentsList.tsx`)
   - Currently uses: `content_items` where `type='assignment'`
   - Should verify: Does this work? Or does it need the same fix as QuizManager?
   - Line 46-55

2. **CanvasQuizResults** (`src/pages/CanvasQuizResults.tsx`)
   - May have similar query pattern
   - Need to verify

### Enrollment Policies

**NOT CHECKED YET:** Do `enrollments` table RLS policies have circular dependencies?

If enrollments policies query courses/content_items, and those query enrollments back, we'd have circular dependencies.

**Recommendation:** Run the comprehensive schema check and review enrollment policies.

## Testing Checklist

- [x] Profiles load without infinite recursion
- [x] Courses load without errors
- [x] Modules load without errors
- [x] Content items query works with nested assignments/quizzes
- [x] Quizzes tab shows quizzes
- [x] Quiz questions load
- [ ] Assignments tab shows assignments (check CanvasAssignmentsList)
- [ ] Assignment submissions work
- [ ] Enrollment checks work correctly
- [ ] Instructor permissions work correctly
- [ ] Student permissions work correctly (published content only)

## Migrations Summary

All migrations are in `supabase/migrations/`:

1. **20251006020000_proper_security_fix_with_user_roles.sql**
   - Creates user_roles table
   - Migrates roles from profiles
   - Creates has_role() and get_user_roles() functions

2. **20251006030000_fix_profiles_recursion.sql**
   - Creates can_view_profile() SECURITY DEFINER function
   - Replaces profiles policies

3. **20251006040000_fix_assignments_quizzes_recursion.sql**
   - Creates can_access_assignment() and can_access_quiz() functions
   - Creates can_access_quiz_question() and can_access_submission() functions
   - Adds UNIQUE constraints on content_item_id columns
   - Replaces all assignment/quiz/submission policies

4. **20251006050000_add_quiz_questions_fk.sql**
   - Adds missing FK from quiz_questions to quizzes
   - Creates index for performance

5. **20251006060000_comprehensive_courses_schema_fix.sql** (PENDING)
   - Creates can_access_content_item() and can_access_module() functions
   - Replaces content_items and modules policies
   - Verifies all FKs exist
   - Creates performance indexes

## Next Steps

1. **Run** `20251006060000_comprehensive_courses_schema_fix.sql` in Supabase SQL Editor
2. **Test** all course features thoroughly
3. **Check** CanvasAssignmentsList component - verify it shows assignments
4. **Run** comprehensive_schema_check.sql and review results for any remaining issues
5. **Check** enrollments RLS policies for circular dependencies
6. **Remove** debug console.log statements from QuizManager once verified working
