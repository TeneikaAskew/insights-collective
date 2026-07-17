
DROP FUNCTION IF EXISTS public.debug_whoami();
DELETE FROM public.content_items WHERE title LIKE 'RLSTEST%' OR (title='Video lesson' AND created_at > now() - interval '1 hour');
