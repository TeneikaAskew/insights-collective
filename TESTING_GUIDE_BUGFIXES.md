# Testing Guide: Critical Bug Fixes
## Module Content & Assignment Submission

**Date**: October 6, 2025
**Commit**: `d926a4cc`
**Status**: Ready for Testing

---

## 🎯 What Was Fixed

### Issue 1: Module Content Not Displaying ❌ → ✅
**Before**: Screenshot showed "0 Activities" even though modules had 4, 3, 3 items
**After**: All content items display correctly in module view

### Issue 2: Assignment Submission Failing ❌ → ✅
**Before**: "Assignment Not Found" error when clicking "Submit Assignment"
**After**: Assignment submission page loads with all details

### Issue 3: No Error Messages ❌ → ✅
**Before**: Silent failures with no debugging information
**After**: Clear error messages and console logging

---

## 🔧 Pre-Testing Setup

### 1. Apply Database Migrations

```bash
cd supabase
supabase db push
```

**Expected Output**:
```
Applying migration 20251006000000_fix_assignments_course_id.sql...
✓ Migration successful: All assignments have course_id populated
Applying migration 20251006000001_fix_published_defaults.sql...
✓ Migration successful: All content and modules have published status set
Total published content items: X
Total unpublished content items: Y
```

### 2. Verify Migrations Applied

```sql
-- Check assignments table has new columns
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'assignments'
  AND column_name IN ('course_id', 'module_id');

-- Should return: course_id, module_id

-- Check published defaults
SELECT published, COUNT(*)
FROM content_items
GROUP BY published;

-- Should show: true | count, false | count (no NULL values)
```

### 3. Open Browser Developer Tools
Press `F12` to open console for detailed logging

---

## 📝 Test Cases

### Test Case 1: Module Content Display

**Steps**:
1. Navigate to a course page
2. Click "View Modules" or click "Modules" in sidebar
3. Click on "Week 1: Foundations of Data Science" module
4. Observe the module content sidebar

**Expected Result**:
- ✅ Shows "4 Activities" (not "0 Activities")
- ✅ Lists all content items in sidebar:
  - Introduction to Data Science (page)
  - What is Data Science? (page)
  - Data Science Workflow (assignment)
  - Week 1 Quiz (quiz)
- ✅ Items are clickable
- ✅ Console shows: `Loaded 4 content items, showing 4 (instructor: true/false)`

**If Failed**:
- Check browser console for errors
- Verify migrations applied: `SELECT * FROM content_items WHERE module_id = 'your-module-id'`
- Check published status: All should be `true` or NULL (not `false`)

---

### Test Case 2: View Content Item

**Steps**:
1. From module view, click on any content item (e.g., "Introduction to Data Science")
2. Observe the main content area

**Expected Result**:
- ✅ Content displays in main area (not "Select an item from the module to view its content")
- ✅ Title shows correctly
- ✅ Type badge displays (page/assignment/quiz)
- ✅ Content renders properly

**If Failed**:
- Check console for "Content item loaded successfully" message
- Verify content_item has published !== false
- Check if content field has data

---

### Test Case 3: Assignment List View

**Steps**:
1. Navigate to course page
2. Click "Assignments" in sidebar
3. Observe the assignments list

**Expected Result**:
- ✅ Shows 3 assignments:
  - Python Data Analysis
  - Data Cleaning Exercise
  - Statistical Analysis Project
- ✅ Each shows "Not Submitted" badge
- ✅ Each has "Submit Assignment" button
- ✅ Shows due dates and point values

**If Failed**:
- Check if published status is filtering out assignments
- Verify: `SELECT * FROM content_items WHERE type = 'assignment' AND course_id = 'your-course-id'`

---

### Test Case 4: Assignment Submission (Critical!)

**Steps**:
1. From assignments list, click "Submit Assignment" for "Python Data Analysis"
2. Observe the page that loads

**Expected Result**:
- ✅ Assignment submission page loads (NOT "Assignment Not Found")
- ✅ Shows assignment title: "Python Data Analysis"
- ✅ Shows assignment details (points, due date, instructions)
- ✅ Shows submission form with tabs (Text Entry, URL, Upload)
- ✅ Console shows detailed logging:
  ```
  Loading assignment data for content item: abc-123-def-456
  Content item loaded successfully: {
    id: "abc-123",
    type: "assignment",
    hasAssignment: true,
    hasQuiz: false
  }
  Assignment loaded successfully: {
    contentItemId: "abc-123",
    assignmentId: "xyz-789",
    title: "Python Data Analysis"
  }
  ```

**If Failed**:
- Check console for specific error message
- Verify content_item_id in URL matches database
- Check: `SELECT * FROM assignments WHERE content_item_id = 'id-from-url'`
- Ensure assignment row exists and has data

---

### Test Case 5: Submit Assignment

**Steps**:
1. On assignment submission page, select "Text Entry" tab
2. Type some text: "This is my test submission"
3. Click "Submit Assignment" button
4. Observe the result

**Expected Result**:
- ✅ Success message appears: "Assignment submitted successfully"
- ✅ Page shows submission details
- ✅ Badge changes to "Submitted"
- ✅ Database has record: `SELECT * FROM assignment_submissions WHERE user_id = 'your-id'`

**If Failed**:
- Check console for submission errors
- Verify assignment_id is correct (not content_item_id)
- Check RLS policies allow insert

---

### Test Case 6: Instructor View

**Steps**:
1. Log in as instructor
2. Navigate to module detail
3. Check console logging

**Expected Result**:
- ✅ Shows ALL content items (including unpublished ones)
- ✅ Console shows: `Loaded X content items, showing X (instructor: true)`
- ✅ Can see drafts and published content

**If Failed**:
- Verify user has 'instructor' or 'admin' role
- Check: `SELECT roles FROM profiles WHERE id = 'your-id'`

---

### Test Case 7: Student View

**Steps**:
1. Log in as student (no instructor/admin role)
2. Navigate to module detail
3. Check console logging

**Expected Result**:
- ✅ Shows only published content (published !== false)
- ✅ Shows content with NULL published status (backward compatibility)
- ✅ Hides content with published = false
- ✅ Console shows: `Loaded X content items, showing Y (instructor: false)`

**If Failed**:
- Check filtering logic in CanvasModuleDetail.tsx line 154-160
- Verify published column values

---

### Test Case 8: Breadcrumb Navigation

**Steps**:
1. From module detail page, observe breadcrumbs at top
2. Click each breadcrumb link

**Expected Result**:
- ✅ Shows: "My Courses > Introduction to Data Science > Week 1: Foundations"
- ✅ "My Courses" link works
- ✅ Course name link returns to course home
- ✅ Current page is non-clickable

**If Failed**:
- Check Link components have correct `to` props
- Verify courseId and moduleId in URL

---

## 🐛 Error Scenarios to Test

### Scenario 1: Missing Assignment Data

**Setup**:
1. Create a content_item with type='assignment' but no assignment row
2. Try to view/submit it

**Expected**:
- ✅ Error message: "Assignment details are missing. Please contact your instructor."
- ✅ Console shows: "Assignment data missing for assignment content item: [id]"

### Scenario 2: Invalid Content Item ID

**Setup**:
1. Navigate to: `/courses/[courseId]/modules/[moduleId]/assignments/invalid-uuid/submit`

**Expected**:
- ✅ Error message: "Assignment not found"
- ✅ Console shows: "Content item not found: invalid-uuid"

### Scenario 3: Unpublished Content (Student View)

**Setup**:
1. Set a content_item to published = false
2. View module as student

**Expected**:
- ✅ Content item does NOT appear in list
- ✅ Other published items still visible
- ✅ Console shows correct count: "Loaded 4 content items, showing 3 (instructor: false)"

---

## 📊 Database Verification Queries

### Check Assignment Structure
```sql
SELECT
  ci.id as content_item_id,
  ci.title,
  ci.type,
  ci.published,
  a.id as assignment_id,
  a.course_id,
  a.module_id
FROM content_items ci
LEFT JOIN assignments a ON ci.id = a.content_item_id
WHERE ci.type = 'assignment'
  AND ci.course_id = 'your-course-id';
```

**Expected**: All assignments should have assignment_id, course_id, and module_id populated

### Check Published Status
```sql
SELECT
  published,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM content_items
GROUP BY published
ORDER BY published;
```

**Expected**: No NULL values, mix of true/false

### Check Content Item Completeness
```sql
SELECT
  ci.id,
  ci.title,
  ci.type,
  CASE
    WHEN ci.type = 'assignment' AND a.id IS NULL THEN 'MISSING ASSIGNMENT'
    WHEN ci.type = 'quiz' AND q.id IS NULL THEN 'MISSING QUIZ'
    ELSE 'OK'
  END as status
FROM content_items ci
LEFT JOIN assignments a ON ci.id = a.content_item_id AND ci.type = 'assignment'
LEFT JOIN quizzes q ON ci.id = q.content_item_id AND ci.type = 'quiz'
WHERE status != 'OK';
```

**Expected**: Empty result (no missing data)

---

## ✅ Success Criteria

All tests pass when:

1. **Module Content Display**
   - [x] Shows correct number of activities (not 0)
   - [x] All items clickable and loadable
   - [x] Filtering works correctly by role

2. **Assignment Submission**
   - [x] Assignment submission page loads
   - [x] Shows all assignment details
   - [x] Form submission works
   - [x] Submissions saved to database

3. **Error Handling**
   - [x] Clear error messages shown
   - [x] Console logging provides debugging info
   - [x] Invalid IDs handled gracefully

4. **Database Integrity**
   - [x] All assignments have course_id and module_id
   - [x] No NULL published values
   - [x] All assignments have corresponding assignment rows

5. **User Experience**
   - [x] No silent failures
   - [x] Fast page loads (<2 seconds)
   - [x] Responsive on mobile
   - [x] Breadcrumbs work correctly

---

## 🔍 Console Logging Reference

### Successful Module Load
```
Loaded 4 content items, showing 4 (instructor: true)
```

### Successful Assignment Load
```
Loading assignment data for content item: abc-123
Content item loaded successfully: {id: "abc-123", type: "assignment", hasAssignment: true}
Assignment loaded successfully: {contentItemId: "abc-123", assignmentId: "xyz-789", title: "..."}
```

### Content Not Found (Expected)
```
Content item not found: invalid-id
```

### Missing Assignment Data (Error)
```
Assignment data missing for assignment content item: abc-123
```

---

## 🚨 Rollback Plan

If critical issues found:

### Quick Rollback (Keep Migrations)
```bash
# Revert code changes only
git revert d926a4cc
git push
```

### Full Rollback (Remove Migrations)
```sql
-- Remove added columns
ALTER TABLE assignments DROP COLUMN IF EXISTS course_id;
ALTER TABLE assignments DROP COLUMN IF EXISTS module_id;

-- Revert published defaults
ALTER TABLE content_items ALTER COLUMN published DROP DEFAULT;
ALTER TABLE modules ALTER COLUMN published DROP DEFAULT;

-- Drop helper functions
DROP FUNCTION IF EXISTS publish_content_item;
DROP FUNCTION IF EXISTS unpublish_content_item;
DROP FUNCTION IF EXISTS publish_module;
DROP FUNCTION IF EXISTS unpublish_module;
```

---

## 📞 Support & Debugging

### Common Issues

**"0 Activities" still showing**:
- Check published column: `SELECT published FROM content_items WHERE module_id = 'id'`
- Ensure migrations ran: `SELECT * FROM information_schema.columns WHERE table_name = 'content_items' AND column_name = 'published'`
- Check filtering logic is deployed

**"Assignment Not Found"**:
- Verify content_item_id in URL
- Check assignment exists: `SELECT * FROM assignments WHERE content_item_id = 'id'`
- Look at console errors for specific issue

**Submissions not saving**:
- Check RLS policies: `SELECT * FROM pg_policies WHERE tablename = 'assignment_submissions'`
- Verify user is authenticated
- Check assignment_id is correct (not content_item_id)

### Where to Look

- **Frontend Errors**: Browser DevTools Console (F12)
- **Backend Errors**: Supabase Dashboard > Logs
- **Database Issues**: Run verification queries above
- **Network Issues**: DevTools Network tab

---

## 📈 Performance Benchmarks

Test these after fixes applied:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Module load time | < 1s | DevTools Network tab |
| Assignment page load | < 1.5s | DevTools Network tab |
| Content item click response | < 300ms | User perception |
| Submission save time | < 2s | Network tab + toast message |

---

## ✅ Sign-Off Checklist

Before approving fixes:

- [ ] All migrations applied successfully
- [ ] All 8 test cases pass
- [ ] Error scenarios handled correctly
- [ ] Database verification queries clean
- [ ] Console logging provides useful info
- [ ] No regressions in other features
- [ ] Mobile testing completed
- [ ] Performance acceptable
- [ ] Ready to proceed to Phase 2

---

**Testing Started**: __________
**Testing Completed**: __________
**Tested By**: __________
**Status**: ⬜ Pass | ⬜ Fail | ⬜ Needs Revision

**Notes**:
_________________________________
_________________________________
_________________________________
