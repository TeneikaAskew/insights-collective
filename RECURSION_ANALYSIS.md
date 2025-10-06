# Infinite Recursion Root Cause Analysis

## The Problem

Error: `infinite recursion detected in policy for relation "profiles"`

Happens when querying:
```sql
courses?select=*,instructor:profiles(...)
```

## The Recursion Chain

1. **User queries courses table** with JOIN to profiles
   ```sql
   SELECT * FROM courses c
   JOIN profiles p ON c.instructor_id = p.id
   ```

2. **Postgres checks profiles RLS policies** for each joined profile

3. **"View profiles in same courses" policy fires:**
   ```sql
   EXISTS (
     SELECT 1 FROM public.courses c
     JOIN public.enrollments e ON c.id = e.course_id
     WHERE e.user_id = auth.uid()
       AND c.instructor_id = profiles.id
   )
   ```

4. **This policy QUERIES COURSES AGAIN** ← **CIRCULAR DEPENDENCY!**

5. If courses policies reference profiles (or if there's another join), we're back to step 2

## Why This Creates Recursion

- **Outer query:** courses → profiles (JOIN)
- **Inner policy:** profiles policy queries courses
- **Result:** Circular dependency in RLS evaluation

## The Solution

**NEVER query tables in RLS policies that might query back to the same table.**

Instead:
1. Use SECURITY DEFINER functions that bypass RLS
2. Or use simpler policies that don't create circular dependencies

## Correct Approach

Create a SECURITY DEFINER function to check course relationships:

```sql
CREATE FUNCTION can_view_profile(viewer_id UUID, profile_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT
    viewer_id = profile_id  -- Can see own profile
    OR
    EXISTS (
      SELECT 1 FROM courses c
      JOIN enrollments e ON c.id = e.course_id
      WHERE e.user_id = viewer_id AND c.instructor_id = profile_id
    )
    OR
    EXISTS (
      SELECT 1 FROM courses c
      JOIN enrollments e ON c.id = e.course_id
      WHERE c.instructor_id = viewer_id AND e.user_id = profile_id
    );
$$;
```

Then profiles policy becomes:
```sql
CREATE POLICY "Users can view allowed profiles"
ON profiles FOR SELECT
USING (can_view_profile(auth.uid(), id));
```

**KEY:** The SECURITY DEFINER function bypasses RLS, breaking the circular dependency!
