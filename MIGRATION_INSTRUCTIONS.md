# Migration Instructions - Difficulty Level & Estimated Hours

## Current Situation

The `difficulty_level` and `estimated_hours` fields migration has been created and tested locally, but needs to be applied to the remote Supabase database. The migration file exists at:

- `supabase/migrations/20251005200000_add_course_difficulty_and_hours.sql`

However, there are conflicting migrations preventing automated `supabase db push` from working.

## ✅ Solution: Apply Migration via Supabase SQL Editor

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase project dashboard: https://supabase.com/dashboard/project/siuqvhscuiycvdrtiqsh
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**

### Step 2: Run the Migration SQL

Copy the contents of `apply_difficulty_hours_directly.sql` and paste it into the SQL Editor, then click **Run**.

**File Location**: `apply_difficulty_hours_directly.sql` (in project root)

This will:
- ✅ Create `course_difficulty` ENUM type (beginner/intermediate/advanced)
- ✅ Add `difficulty_level` column to `courses` table
- ✅ Add `estimated_hours` column to `courses` table
- ✅ Create `calculate_course_difficulty()` function
- ✅ Create `calculate_course_hours()` function
- ✅ Populate ALL existing courses with calculated values
- ✅ Set default values for new courses
- ✅ Create performance indexes
- ✅ Create `course_statistics` view
- ✅ Create `get_courses_by_difficulty()` helper function
- ✅ Add validation constraints

### Step 3: Verify Migration

After running the SQL, verify it worked by running this query in the SQL Editor:

```sql
-- Check that columns exist and have data
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'courses'
  AND column_name IN ('difficulty_level', 'estimated_hours');

-- Check some sample data
SELECT
  id,
  title,
  difficulty_level,
  estimated_hours,
  level,
  duration
FROM courses
LIMIT 10;
```

Expected result:
- Should see both `difficulty_level` and `estimated_hours` columns
- Courses should have calculated values for both fields

### Step 4: Test the Frontend

After applying the migration:

1. Open the application: http://localhost:8080
2. Navigate to the Courses page: http://localhost:8080/courses
3. You should see:
   - ✅ Difficulty badges (Beginner/Intermediate/Advanced) with icons
   - ✅ Estimated hours badges (e.g., "5.5 hours")
   - ✅ Difficulty filter dropdown working
   - ✅ Sorting by difficulty and hours working

## What the UI Already Has

The frontend components have been updated and are **ready to use** the new fields:

### 1. CourseCard Component ([src/components/common/CourseCard.tsx](src/components/common/CourseCard.tsx:216-243))
- ✅ Displays difficulty badges with color-coded icons
- ✅ Displays estimated hours with Clock icon
- ✅ Gracefully handles missing data (no badges shown if fields are null)

### 2. FeaturedCourses Component ([src/components/home/FeaturedCourses.tsx](src/components/home/FeaturedCourses.tsx:166-193))
- ✅ Same badge system as CourseCard
- ✅ Responsive grid layout

### 3. CourseList Page ([src/pages/CourseList.tsx](src/pages/CourseList.tsx))
- ✅ Difficulty filter dropdown (lines 203-214)
- ✅ Sorting by difficulty (easy→hard, hard→easy) (lines 116-131)
- ✅ Sorting by estimated hours (shortest→longest, longest→shortest) (lines 132-141)

## Troubleshooting

### Issue: "Column does not exist" error in frontend

**Solution**: The migration hasn't been applied yet. Follow Step 1-2 above.

### Issue: Badges not showing on course cards

**Check 1**: Verify migration was applied:
```sql
SELECT difficulty_level, estimated_hours FROM courses LIMIT 1;
```

**Check 2**: Check if courses have data:
```sql
SELECT
  COUNT(*) as total_courses,
  COUNT(difficulty_level) as with_difficulty,
  COUNT(estimated_hours) as with_hours
FROM courses;
```

All three counts should be the same.

### Issue: Filtering/sorting not working

**Solution**: Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R) to clear cached JavaScript.

## Migration Safety

This migration is **100% safe** and **non-destructive**:
- ✅ Adds new columns (doesn't modify existing data)
- ✅ All fields are optional (nullable initially)
- ✅ Sets defaults after data migration
- ✅ Backwards compatible (existing queries still work)
- ✅ Uses `IF NOT EXISTS` and `IF NOT NULL` checks
- ✅ Can be rolled back if needed

## Rollback (If Needed)

If you need to undo the migration, run this in SQL Editor:

```sql
-- Remove indexes
DROP INDEX IF EXISTS idx_courses_difficulty_level;
DROP INDEX IF EXISTS idx_courses_estimated_hours;

-- Drop view
DROP VIEW IF EXISTS course_statistics;

-- Drop functions
DROP FUNCTION IF EXISTS get_courses_by_difficulty(course_difficulty);
DROP FUNCTION IF EXISTS calculate_course_hours(UUID);
DROP FUNCTION IF EXISTS calculate_course_difficulty(UUID);

-- Remove columns
ALTER TABLE courses DROP COLUMN IF EXISTS difficulty_level;
ALTER TABLE courses DROP COLUMN IF EXISTS estimated_hours;

-- Drop constraint
ALTER TABLE courses DROP CONSTRAINT IF EXISTS check_estimated_hours_positive;

-- Drop ENUM type (only if not used elsewhere)
DROP TYPE IF EXISTS course_difficulty;
```

## Next Steps After Migration

Once the migration is applied:

1. ✅ **Test the UI** - Navigate to /courses and verify badges show
2. ✅ **Test Filtering** - Use the difficulty dropdown to filter courses
3. ✅ **Test Sorting** - Try sorting by difficulty and hours
4. ✅ **Mobile Test** - Check responsive design on mobile devices
5. ✅ **Accessibility Test** - Try keyboard navigation (Tab, Enter, arrows)

## Files Reference

### Migration Files:
- `supabase/migrations/20251005200000_add_course_difficulty_and_hours.sql` (original migration)
- `apply_difficulty_hours_directly.sql` (standalone SQL for manual application)
- `supabase/migrations/README_DIFFICULTY_HOURS.md` (detailed documentation)

### Frontend Files (Already Updated):
- `src/types/course.ts` - TypeScript types
- `src/components/common/CourseCard.tsx` - Course card with badges
- `src/components/home/FeaturedCourses.tsx` - Featured courses with badges
- `src/pages/CourseList.tsx` - Filtering and sorting

### Documentation:
- `PHASE_1_2_COMPLETION_REPORT.md` - Comprehensive completion report
- `MIGRATION_INSTRUCTIONS.md` (this file)

## Support

If you encounter any issues:

1. Check the Supabase dashboard for error messages
2. Review the verification query results
3. Check browser console for frontend errors
4. Refer to `PHASE_1_2_COMPLETION_REPORT.md` for detailed implementation info
