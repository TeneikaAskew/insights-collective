-- Fix: The FOR ALL "Users can access modules" policy blocks INSERT because can_access_module()
-- checks against modules.id for the not-yet-inserted row (always false). Rewrite it to only
-- apply to SELECT/UPDATE/DELETE via explicit per-command policies, and add an explicit
-- WITH CHECK clause where needed so instructors and admins can create modules.

DROP POLICY IF EXISTS "Users can access modules" ON public.modules;

-- Enrolled students can view published modules in courses they own or are enrolled in.
-- (INSERT/UPDATE/DELETE are already covered by the "Instructors can ..." policies.)
CREATE POLICY "Users can read modules they can access"
  ON public.modules
  FOR SELECT
  TO authenticated
  USING (public.can_access_module(auth.uid(), id));