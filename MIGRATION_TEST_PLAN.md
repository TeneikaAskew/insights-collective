# Migration Test Plan: Course Difficulty & Estimated Hours

## Phase 1 Implementation Status

✅ **COMPLETED** - 2025-10-05

### Files Created/Modified

#### 1. Database Migration
- **File**: `supabase/migrations/20251005200000_add_course_difficulty_and_hours.sql`
- **Status**: ✅ Created
- **Contents**:
  - ENUM type `course_difficulty` (beginner, intermediate, advanced)
  - Added `difficulty_level` column to courses table
  - Added `estimated_hours` column to courses table
  - Calculation functions for auto-estimating values
  - Triggers for auto-updates on content changes
  - Indexes for performance
  - Helper view `course_statistics`
  - Data migration for existing courses

#### 2. TypeScript Types
- **File**: `src/types/course.ts`
- **Status**: ✅ Updated
- **Changes**:
  - Added `CourseDifficulty` type export
  - Updated `Course` interface with `difficulty_level` and `estimated_hours`
  - Updated `CourseFormData` interface
  - Updated `CourseStats` interface
  - Updated `EnhancedCourse` interface
  - Included both snake_case and camelCase variants for compatibility

#### 3. Documentation
- **File**: `supabase/migrations/README_DIFFICULTY_HOURS.md`
- **Status**: ✅ Created
- **Contents**: Complete migration guide with examples and troubleshooting

#### 4. Test Scripts
- **File**: `scripts/test-difficulty-migration.sql`
- **Status**: ✅ Created
- **Contents**: 12 automated tests to verify migration success

---

## Testing Checklist

### Pre-Migration Tests
- [ ] Backup production database
- [ ] Verify local Supabase is running: `supabase status`
- [ ] Link to correct project: `supabase link --project-ref siuqvhscuiycvdrtiqsh`
- [ ] List existing migrations: `supabase migration list`

### Migration Application

#### Local Environment
```bash
# Apply migration to local Supabase
cd supabase
supabase db push

# Or apply specific migration
supabase migration up --include-all
```

#### Production Environment
```bash
# ONLY after successful local testing
supabase db push --project-ref siuqvhscuiycvdrtiqsh
```

### Post-Migration Tests

#### Automated SQL Tests
```bash
# Run test script
psql $DATABASE_URL -f scripts/test-difficulty-migration.sql

# Expected output: All tests should pass (✓)
```

#### Manual Verification

1. **Schema Verification**
```sql
-- Check columns exist
\d courses

-- Should show:
--   difficulty_level | course_difficulty |
--   estimated_hours  | numeric(5,2)      |
```

2. **Data Verification**
```sql
-- Check data was migrated
SELECT
  id,
  title,
  difficulty_level,
  estimated_hours
FROM courses
LIMIT 5;

-- All rows should have non-NULL values
```

3. **Function Testing**
```sql
-- Test calculation functions
SELECT
  id,
  title,
  calculate_course_difficulty(id) as calculated_diff,
  calculate_course_hours(id) as calculated_hours
FROM courses
LIMIT 3;
```

4. **View Testing**
```sql
-- Test statistics view
SELECT * FROM course_statistics LIMIT 5;
```

5. **Trigger Testing**
```sql
-- Create test course
INSERT INTO courses (title, description, category, level, instructor_id, published, status)
VALUES ('Test Course', 'Test', 'Technology', 'beginner', (SELECT id FROM auth.users LIMIT 1), false, 'draft')
RETURNING id, difficulty_level, estimated_hours;

-- Should auto-populate difficulty_level = 'beginner' and estimated_hours

-- Add a module and check if estimates update
INSERT INTO modules (course_id, title, description, week)
VALUES (
  (SELECT id FROM courses WHERE title = 'Test Course'),
  'Test Module',
  'Test',
  1
);

-- Check if course was updated
SELECT difficulty_level, estimated_hours
FROM courses
WHERE title = 'Test Course';

-- Clean up
DELETE FROM courses WHERE title = 'Test Course';
```

### Frontend Integration Tests

#### 1. Update Course Components
Components to check/update:

- [x] `src/components/course/CourseDetailsForm.tsx` - Add difficulty and hours fields
- [ ] `src/components/course/CourseList.tsx` - Display difficulty badges
- [ ] `src/pages/CourseDetail.tsx` - Show estimated hours
- [ ] `src/components/course/CourseCategoryBadge.tsx` - Add difficulty variant

#### 2. Test Data Fetching
```typescript
// In your course service or component
const { data: courses } = await supabase
  .from('courses')
  .select('*, difficulty_level, estimated_hours');

console.log('Courses with new fields:', courses);
```

#### 3. Test Filtering
```typescript
// Filter by difficulty
const { data: beginnerCourses } = await supabase
  .from('courses')
  .select('*')
  .eq('difficulty_level', 'beginner');

// Filter by hours range
const { data: shortCourses } = await supabase
  .from('courses')
  .select('*')
  .lte('estimated_hours', 10);
```

### TypeScript Compilation Test
```bash
# Ensure no type errors
npm run build

# Or just type check
npx tsc --noEmit
```

### React Component Tests
```bash
# Run existing tests to ensure nothing broke
npm run test

# Tests that should still pass:
# - Course creation
# - Course enrollment
# - Course listing
# - Course detail view
```

---

## Rollback Plan

If migration causes issues:

### Immediate Rollback (Quick)
```sql
-- Remove new columns (data will be lost!)
ALTER TABLE courses DROP COLUMN IF EXISTS difficulty_level;
ALTER TABLE courses DROP COLUMN IF EXISTS estimated_hours;
```

### Full Rollback (Clean)
```sql
-- Run complete rollback script from README_DIFFICULTY_HOURS.md
-- This removes triggers, functions, views, columns, and ENUM type
```

### Restore from Backup
```bash
# If you created a backup before migration
supabase db dump --db-url postgresql://... > pre_migration_backup.sql

# Restore
psql $DATABASE_URL < pre_migration_backup.sql
```

---

## Success Criteria

### ✅ Migration is successful if:
1. All 12 automated tests pass
2. No existing functionality is broken
3. TypeScript compiles without errors
4. Existing tests still pass
5. Can query courses with new fields
6. Triggers properly update values
7. Functions return expected results
8. No performance degradation on course queries

### ⚠️ Investigate if:
- Some courses have NULL difficulty or hours
- Calculated values seem incorrect
- Triggers don't fire on content changes
- Functions return errors
- Queries are slower than before

---

## Performance Benchmarks

### Before Migration Baseline
```sql
EXPLAIN ANALYZE
SELECT * FROM courses WHERE published = true
ORDER BY created_at DESC LIMIT 20;
```

### After Migration Comparison
```sql
-- Same query with new fields
EXPLAIN ANALYZE
SELECT *, difficulty_level, estimated_hours
FROM courses WHERE published = true
ORDER BY created_at DESC LIMIT 20;

-- New filtered queries
EXPLAIN ANALYZE
SELECT * FROM courses
WHERE difficulty_level = 'beginner'
  AND estimated_hours <= 20;
```

### Expected Performance
- Simple SELECT with new fields: < 5% overhead
- Filtered by difficulty: Fast due to index
- Filtered by hours range: Fast due to index
- Statistics view: Acceptable with < 1000 courses

---

## Known Issues & Limitations

### Current Limitations
1. **Estimates are algorithmic**: Based on content count, not actual complexity
2. **No manual override UI**: Instructors can't easily override calculated values
3. **Trigger performance**: May slow down bulk content operations
4. **NULL handling**: New courses get defaults, existing empty courses get minimum values

### Future Improvements
- [ ] Add instructor override UI
- [ ] Track actual student completion times
- [ ] Refine calculation algorithms based on real data
- [ ] Add difficulty factors (prerequisites, complexity scores)
- [ ] Create analytics dashboard for estimate accuracy

---

## Next Steps After Migration

### Immediate (Week 1)
1. Monitor for any reported issues
2. Verify estimates look reasonable
3. Add UI components to display difficulty/hours
4. Update course filters to use new fields

### Short Term (Week 2-3)
1. Add difficulty badges to course listings
2. Show estimated hours on course cards
3. Implement filtering by difficulty and hours
4. Add to course creation form

### Long Term (Month 1+)
1. Collect actual completion time data
2. Compare estimates vs actual times
3. Refine calculation algorithms
4. Add instructor override functionality
5. Create difficulty/hours recommendation system

---

## Monitoring & Alerts

### Metrics to Track
- % of courses with difficulty assigned
- % of courses with estimated hours
- Average hours by difficulty level
- Estimate accuracy (if tracking actual times)
- Query performance on new indexes

### Alerts to Set Up
- NULL values appearing in new columns
- Trigger failures (check logs)
- Unusual estimate values (e.g., > 500 hours)
- Slow queries using new fields

---

## Support & Documentation

### For Developers
- This file: Migration test plan
- `README_DIFFICULTY_HOURS.md`: Detailed migration guide
- `src/types/course.ts`: TypeScript type definitions
- Migration file: SQL implementation with comments

### For Database Admins
- Migration file includes rollback SQL
- All functions have COMMENT ON documentation
- Indexes named clearly for identification
- Triggers follow naming convention

### For QA/Testing
- `scripts/test-difficulty-migration.sql`: Automated test suite
- This file: Manual test procedures
- Expected behaviors documented in README

---

## Sign-Off Checklist

- [ ] Local migration tested successfully
- [ ] All automated tests pass
- [ ] Manual verification completed
- [ ] TypeScript compiles
- [ ] React tests pass
- [ ] Performance benchmarks acceptable
- [ ] Rollback plan tested
- [ ] Documentation reviewed
- [ ] Team notified
- [ ] Production migration scheduled
- [ ] Backup created
- [ ] Production migration completed
- [ ] Production tests verified
- [ ] Monitoring enabled

---

## Migration Log

| Date | Environment | Status | Notes |
|------|-------------|--------|-------|
| 2025-10-05 | Development | ✅ Created | Migration file and types created |
| | Local | ⏳ Pending | Awaiting local test |
| | Staging | ⏳ Pending | Awaiting staging test |
| | Production | ⏳ Pending | Awaiting production deployment |

---

**Last Updated**: 2025-10-05
**Migration Version**: 20251005200000
**Phase**: 1 of COURSES_ROADMAP.md
