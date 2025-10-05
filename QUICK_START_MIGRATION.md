# Quick Start: Apply Difficulty & Hours Migration

## TL;DR - 3 Steps to Apply

```bash
# 1. Navigate to supabase directory
cd supabase

# 2. Apply migration to local instance
supabase db push

# 3. Run tests
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f ../scripts/test-difficulty-migration.sql
```

---

## Detailed Instructions

### Prerequisites
- ✅ Supabase CLI installed
- ✅ Local Supabase running (`supabase status`)
- ✅ Project linked (`supabase link`)

### Step 1: Backup (Recommended)
```bash
# Create backup before migration
supabase db dump > backup_$(date +%Y%m%d).sql
```

### Step 2: Apply Migration

#### Option A: Using Supabase CLI (Recommended)
```bash
cd supabase
supabase db push
```

#### Option B: Direct SQL (Alternative)
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -f supabase/migrations/20251005200000_add_course_difficulty_and_hours.sql
```

### Step 3: Verify Migration

#### Quick Check
```sql
-- Connect to database
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

-- Check columns exist
\d courses

-- View sample data
SELECT id, title, difficulty_level, estimated_hours
FROM courses LIMIT 5;
```

#### Full Test Suite
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -f scripts/test-difficulty-migration.sql
```

### Step 4: Update Frontend (Optional)

Add to your course query:
```typescript
const { data: courses } = await supabase
  .from('courses')
  .select('*, difficulty_level, estimated_hours');
```

Display in UI:
```tsx
<Badge>{course.difficulty_level}</Badge>
<p>{course.estimated_hours} hours</p>
```

---

## Expected Output

### After Migration
```
✓ Test 1 PASSED: Both columns exist
✓ Test 2 PASSED: ENUM type has 3 values
✓ Test 3 PASSED: All courses have difficulty and hours
✓ Test 4 PASSED: Both indexes created
✓ Test 5 PASSED: All functions created
✓ Test 6 PASSED: Both triggers created
✓ Test 7 PASSED: course_statistics view created
✓ Test 8 PASSED: calculate_course_difficulty returns valid value
✓ Test 9 PASSED: calculate_course_hours returns valid value
✓ Test 10 PASSED: get_courses_by_difficulty works
```

### Sample Data
```
 difficulty_level | count | avg_hours
------------------+-------+-----------
 beginner         |    15 |      8.50
 intermediate     |    23 |     24.75
 advanced         |     8 |     45.25
```

---

## Troubleshooting

### Migration Fails
```bash
# Check Supabase status
supabase status

# View recent migrations
supabase migration list

# Check logs
supabase logs
```

### Columns Not Showing
```sql
-- Verify migration applied
SELECT column_name FROM information_schema.columns
WHERE table_name = 'courses'
AND column_name IN ('difficulty_level', 'estimated_hours');
```

### Estimates Seem Wrong
```sql
-- Manually recalculate for one course
UPDATE courses
SET
  difficulty_level = calculate_course_difficulty(id),
  estimated_hours = calculate_course_hours(id)
WHERE id = 'your-course-id-here';
```

---

## Rollback (If Needed)

### Quick Rollback
```sql
ALTER TABLE courses DROP COLUMN difficulty_level;
ALTER TABLE courses DROP COLUMN estimated_hours;
DROP TYPE course_difficulty;
```

### Full Rollback
```bash
# Restore from backup
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" < backup_YYYYMMDD.sql
```

See [`README_DIFFICULTY_HOURS.md`](supabase/migrations/README_DIFFICULTY_HOURS.md) for complete rollback script.

---

## Production Deployment

⚠️ **IMPORTANT**: Test locally first!

```bash
# 1. Link to production
supabase link --project-ref YOUR_PROD_REF

# 2. Create production backup
supabase db dump --db-url YOUR_PROD_URL > prod_backup.sql

# 3. Apply migration
supabase db push

# 4. Verify
# Run test queries on production database
```

---

## Next Steps

1. ✅ Apply migration locally
2. ✅ Run test suite
3. 🔄 Update frontend components to use new fields
4. 🔄 Add filtering by difficulty
5. 🔄 Display estimated hours in UI
6. 🔄 Deploy to production

---

## Quick Reference

| What | Command |
|------|---------|
| Apply migration | `supabase db push` |
| Run tests | See Step 3 above |
| Check status | `supabase status` |
| View data | `SELECT * FROM course_statistics;` |
| Recalculate | `UPDATE courses SET difficulty_level = calculate_course_difficulty(id);` |
| Rollback | See Rollback section |

---

**Need Help?**
- Full documentation: [`README_DIFFICULTY_HOURS.md`](supabase/migrations/README_DIFFICULTY_HOURS.md)
- Test plan: [`MIGRATION_TEST_PLAN.md`](MIGRATION_TEST_PLAN.md)
- Summary: [`PHASE1_IMPLEMENTATION_SUMMARY.md`](PHASE1_IMPLEMENTATION_SUMMARY.md)
