-- Availability saves were replace-by-delete-then-insert from the client: two
-- requests, not atomic, and the client had to guess whether the clearing
-- DELETE was needed at all. Its guess — an existence flag cached at load time
-- — went stale whenever the initial load failed or another tab wrote rows in
-- between, so a save could silently keep stale slots alongside the new ones
-- (flagged by Codex review on PR #129). One SECURITY INVOKER function does
-- the whole replacement in a single transaction, under the caller's own RLS
-- policies (owner-scoped DELETE and INSERT on availability_slots), and a
-- first-time save no longer needs a client-issued DELETE that matches nothing.

create or replace function public.replace_availability(p_slots jsonb)
returns void
language sql
security invoker
set search_path to 'public'
as $function$
  delete from public.availability_slots where user_id = auth.uid();
  insert into public.availability_slots (user_id, weekday, time_slot, is_available)
  select auth.uid(),
         (s ->> 'weekday')::int,
         s ->> 'time_slot',
         coalesce((s ->> 'is_available')::boolean, true)
  from jsonb_array_elements(coalesce(p_slots, '[]'::jsonb)) as s;
$function$;

revoke execute on function public.replace_availability(jsonb) from public, anon;
grant execute on function public.replace_availability(jsonb) to authenticated;
