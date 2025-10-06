# Security Fix: Proper User Roles Separation

## The Problem

Lovable's initial security fix created **infinite recursion** by having circular dependencies in RLS policies:

```
profiles policy → has_role(uid, 'admin')
                    ↓
has_role() function → queries user_roles table
                    ↓
user_roles policy → has_role(uid, 'admin') ← INFINITE LOOP!
```

## The Solution

**Key Insight:** The `user_roles` table RLS policies must use **direct queries** instead of calling `has_role()`.

### Architecture

1. **user_roles table** - Stores roles separately (prevents privilege escalation)
2. **SECURITY DEFINER functions** - `has_role()` and `get_user_roles()` bypass RLS
3. **Breaking the recursion cycle** - user_roles policies use direct SQL queries

### How It Works

```sql
-- ✅ CORRECT: user_roles policies use DIRECT queries (no has_role() call)
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles AS ur  -- Direct query!
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::app_role
  )
);

-- ✅ SAFE: profiles policies CAN use has_role() now
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));  -- Safe because user_roles doesn't call this!
```

### Why This is Secure

1. **Roles in separate table** - Users cannot modify `profiles` table to grant themselves admin
2. **SECURITY DEFINER functions** - Bypass RLS to read user_roles without triggering policies
3. **No recursion** - user_roles policies use direct queries, not functions
4. **Proper permissions** - Only admins can modify roles via `update_user_roles()` RPC

### Migration Path

1. Drop all existing broken policies
2. Create `user_roles` table with `app_role` enum
3. Migrate data from `profiles.roles` to `user_roles`
4. Create SECURITY DEFINER functions (`has_role`, `get_user_roles`)
5. Create user_roles policies with **direct queries** (no `has_role()` calls)
6. Create profiles policies (can safely use `has_role()`)

## Why Previous Approach Was Insecure

Storing roles in `profiles.roles`:
- ❌ Users could potentially modify their own roles
- ❌ Vulnerable to privilege escalation via UPDATE on profiles
- ❌ Roles stored alongside user-modifiable data

## Security Best Practices Followed

✅ Principle of least privilege - Users can only see their own roles
✅ Separation of concerns - Roles in dedicated table
✅ Defense in depth - Multiple layers of protection
✅ Audit trail - `granted_by` and `granted_at` fields
✅ No privilege escalation - Only admins can grant roles

## Testing the Fix

After applying this migration:

1. **Verify no recursion:**
   ```sql
   -- Should return WITHOUT infinite recursion error
   SELECT * FROM profiles WHERE id = auth.uid();
   ```

2. **Verify roles are separate:**
   ```sql
   -- Users cannot modify their own roles
   UPDATE user_roles SET role = 'admin' WHERE user_id = auth.uid();
   -- Should fail with RLS policy error
   ```

3. **Verify admin functions work:**
   ```sql
   -- Only works if you're an admin
   SELECT update_user_roles('some-user-id', ARRAY['instructor', 'student']);
   ```

## Deployment

This migration must be applied to the remote database via Supabase Dashboard SQL Editor because:
- Migration history conflicts prevent `supabase db push`
- Direct SQL execution is fastest and most reliable
- Allows immediate verification of fix

**Run:** `supabase/migrations/20251006020000_proper_security_fix_with_user_roles.sql`
