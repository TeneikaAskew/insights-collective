-- Drop the duplicate event_registrations -> events foreign key, which has been
-- making /admin/events fail on every load.
--
-- THE SYMPTOM
--
-- Every visit to /admin/events logged:
--
--   PGRST201  Could not embed because more than one relationship was found
--             for 'event_registrations' and 'event_id'
--
-- returning 300 for the Registrations query in useEventRegistrations.ts:18-33,
-- so that tab never loaded its data. Found by removing the count-guards from
-- admin-events.spec.ts, which had been asserting against the page regardless.
--
-- THE CAUSE
--
-- event_registrations carries TWO foreign keys on event_id, byte-identical in
-- everything but name:
--
--   event_registrations_event_id_fkey  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
--   fk_event_registrations_event_id    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
--
-- PostgREST resolves an embed like `events:event_id (...)` by finding the
-- relationship to the target table. With two candidates it refuses to guess.
--
-- The second was added by 20250626191012, whose comment says it was there to
-- "fix the relationship queries". Its user_id half genuinely did that — it
-- introduced the event_registrations -> profiles relationship that
-- `profiles:user_id (...)` still depends on. Its event_id half duplicated a
-- constraint Postgres had already created with the default name, and broke the
-- embed it was meant to enable.
--
-- WHY DROP RATHER THAN HINT
--
-- The alternative is to disambiguate at each call site
-- (`events!event_registrations_event_id_fkey (...)`). That would pin every
-- query to a constraint NAME, leaves the redundant constraint in place to
-- confuse the next reader, and has to be repeated in every consumer. One
-- relationship, one constraint.
--
-- The two user_id foreign keys are deliberately left alone: they point at
-- DIFFERENT tables (auth.users and profiles), so PostgREST disambiguates them
-- by target and both are reachable. Only the event_id pair is ambiguous.
--
-- SAFETY
--
-- Dropping a duplicate constraint removes no integrity guarantee: the identical
-- surviving constraint enforces exactly the same rule, with the same ON DELETE
-- CASCADE. No row can become orphaned by this.

ALTER TABLE public.event_registrations
  DROP CONSTRAINT IF EXISTS fk_event_registrations_event_id;

DO $$
BEGIN
  -- The rule must still be enforced, by the constraint we kept.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.event_registrations'::regclass
       AND contype = 'f'
       AND conname = 'event_registrations_event_id_fkey'
  ) THEN
    RAISE EXCEPTION 'event_registrations_event_id_fkey is missing: dropping the duplicate would leave event_id unconstrained';
  END IF;

  -- And exactly one relationship to events must remain, or the embed is still
  -- ambiguous and this migration achieved nothing.
  IF (
    SELECT COUNT(*) FROM pg_constraint
     WHERE conrelid = 'public.event_registrations'::regclass
       AND contype = 'f'
       AND confrelid = 'public.events'::regclass
  ) <> 1 THEN
    RAISE EXCEPTION 'event_registrations still has more than one foreign key to events; PostgREST will keep raising PGRST201';
  END IF;
END $$;
