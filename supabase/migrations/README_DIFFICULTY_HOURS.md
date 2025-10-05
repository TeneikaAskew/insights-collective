# Course Difficulty and Estimated Hours Migration

## Overview
This migration adds two new fields to the `courses` table:
- `difficulty_level`: An ENUM field ('beginner', 'intermediate', 'advanced')
- `estimated_hours`: A numeric field representing estimated completion time

## Migration File
`20251005200000_add_course_difficulty_and_hours.sql`

## What This Migration Does

### 1. Schema Changes
- Creates `course_difficulty` ENUM type
- Adds `difficulty_level` column to courses table
- Adds `estimated_hours` column to courses table
- Adds indexes for better query performance
- Adds validation constraints

### 2. Data Migration
- Automatically calculates difficulty based on:
  - Module count
  - Assignment count
  - Quiz count
  - Content block count
- Estimates hours based on:
  - Sum of lesson estimated times
  - Assignment count (60 min each)
  - Quiz count (30 min each)
  - Content blocks (15 min each)

### 3. Automation
- Creates trigger functions to auto-update estimates when content changes
- Updates on module/assignment/lesson modifications

### 4. Helper Functions
- `calculate_course_difficulty(course_id)` - Computes difficulty level
- `calculate_course_hours(course_id)` - Computes estimated hours
- `get_courses_by_difficulty(difficulty)` - Query courses by difficulty
- `course_statistics` view - Aggregated course stats

## Running the Migration

### Local Supabase
```bash
# Start local Supabase
supabase start

# Link to project
supabase link --project-ref siuqvhscuiycvdrtiqsh

# Run migration
supabase db push

# Or apply specific migration
supabase migration up
```

### Production
```bash
# Link to production project
supabase link --project-ref siuqvhscuiycvdrtiqsh

# Push migration
supabase db push
```

## Testing the Migration

### 1. Verify Schema
```sql
-- Check columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'courses'
AND column_name IN ('difficulty_level', 'estimated_hours');

-- Check enum type
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = 'course_difficulty'::regtype;
```

### 2. Verify Data Migration
```sql
-- Check how many courses have values
SELECT
  COUNT(*) as total_courses,
  COUNT(difficulty_level) as with_difficulty,
  COUNT(estimated_hours) as with_hours
FROM courses;

-- Check distribution of difficulty
SELECT
  difficulty_level,
  COUNT(*) as count,
  AVG(estimated_hours) as avg_hours
FROM courses
GROUP BY difficulty_level;
```

### 3. Test Helper Functions
```sql
-- Test difficulty calculation for a specific course
SELECT calculate_course_difficulty('your-course-id-here');

-- Test hours calculation
SELECT calculate_course_hours('your-course-id-here');

-- Get all beginner courses
SELECT * FROM get_courses_by_difficulty('beginner');

-- View statistics
SELECT * FROM course_statistics;
```

## Rollback (if needed)

If you need to rollback this migration:

```sql
-- Remove triggers
DROP TRIGGER IF EXISTS trigger_refresh_course_estimates_on_module ON modules;
DROP TRIGGER IF EXISTS trigger_refresh_course_estimates_on_assignment ON assignments;

-- Drop functions
DROP FUNCTION IF EXISTS refresh_course_estimates();
DROP FUNCTION IF EXISTS get_courses_by_difficulty(course_difficulty);
DROP FUNCTION IF EXISTS calculate_course_hours(UUID);
DROP FUNCTION IF EXISTS calculate_course_difficulty(UUID);

-- Drop view
DROP VIEW IF EXISTS course_statistics;

-- Remove columns
ALTER TABLE courses DROP COLUMN IF EXISTS difficulty_level;
ALTER TABLE courses DROP COLUMN IF EXISTS estimated_hours;

-- Drop ENUM type (only if not used elsewhere)
DROP TYPE IF EXISTS course_difficulty;
```

## TypeScript Integration

The TypeScript types have been updated in `src/types/course.ts`:

```typescript
export type CourseDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface Course {
  // ... existing fields
  difficulty_level?: CourseDifficulty;
  difficultyLevel?: CourseDifficulty; // camelCase variant
  estimated_hours?: number;
  estimatedHours?: number; // camelCase variant
}
```

## Usage Examples

### Frontend Usage
```typescript
import { Course, CourseDifficulty } from '@/types/course';

// Filter courses by difficulty
const beginnerCourses = courses.filter(
  c => c.difficulty_level === 'beginner'
);

// Display estimated hours
<p>Estimated time: {course.estimated_hours} hours</p>

// Show difficulty badge
<Badge variant={getDifficultyColor(course.difficulty_level)}>
  {course.difficulty_level}
</Badge>
```

### Backend Queries
```typescript
// Fetch courses with difficulty and hours
const { data: courses } = await supabase
  .from('courses')
  .select('*, difficulty_level, estimated_hours')
  .eq('difficulty_level', 'beginner')
  .gte('estimated_hours', 5)
  .lte('estimated_hours', 20);

// Update course difficulty manually
await supabase
  .from('courses')
  .update({
    difficulty_level: 'advanced',
    estimated_hours: 40
  })
  .eq('id', courseId);
```

## Automated Updates

The migration includes triggers that automatically recalculate difficulty and hours when:
- Modules are added/removed
- Assignments are added/removed
- Content changes

You can also manually trigger recalculation:
```sql
UPDATE courses
SET
  difficulty_level = calculate_course_difficulty(id),
  estimated_hours = calculate_course_hours(id)
WHERE id = 'your-course-id';
```

## Known Limitations

1. **Initial Estimates**: First calculations are based on content count, not actual completion time
2. **Manual Override**: Instructors may want to manually set difficulty/hours
3. **Content Quality**: Algorithm doesn't account for content complexity/quality
4. **Prerequisites**: Doesn't factor in prerequisite courses

## Future Enhancements

1. Add instructor override flag
2. Track actual student completion times to refine estimates
3. Add difficulty factors (reading level, prerequisites, etc.)
4. Create analytics dashboard for accuracy tracking

## Troubleshooting

### Migration fails on existing data
- Check if courses table exists: `\dt courses`
- Verify no conflicting columns: `\d courses`

### Estimates seem incorrect
- Run calculation functions individually
- Check if content exists in related tables
- Verify counts: `SELECT COUNT(*) FROM modules WHERE course_id = ?`

### Triggers not firing
- Verify triggers exist: `\dft`
- Check trigger function exists: `\df refresh_course_estimates`
- Test manually with UPDATE statement

## Support

For issues or questions:
1. Check migration logs: `supabase migration list`
2. Review error messages in Supabase dashboard
3. Test locally before production deployment
