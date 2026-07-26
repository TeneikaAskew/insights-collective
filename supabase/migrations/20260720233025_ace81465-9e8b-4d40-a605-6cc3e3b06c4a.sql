-- Sync profiles.roles legacy column with user_roles for admin/instructor accounts
-- so edge functions gated on profiles.roles (admin-users) recognize them.
UPDATE public.profiles p
SET roles = ARRAY(
  SELECT DISTINCT ur.role::text
  FROM public.user_roles ur
  WHERE ur.user_id = p.id
)
WHERE EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id
)
AND (
  p.roles IS NULL
  OR NOT (p.roles @> ARRAY(SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = p.id))
);