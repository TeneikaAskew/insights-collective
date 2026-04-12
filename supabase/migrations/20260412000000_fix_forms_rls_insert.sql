-- Fix forms table RLS policy to explicitly allow admin INSERT/UPDATE
-- The existing "Admins can do everything with forms" policy only has USING clause,
-- which should implicitly apply to WITH CHECK, but may fail for INSERT due to
-- enum type comparison. This migration recreates it with explicit WITH CHECK.

DROP POLICY IF EXISTS "Admins can do everything with forms" ON forms;

CREATE POLICY "Admins can do everything with forms" ON forms
FOR ALL
TO authenticated
USING ('admin' = ANY(get_user_roles(auth.uid())))
WITH CHECK ('admin' = ANY(get_user_roles(auth.uid())));
