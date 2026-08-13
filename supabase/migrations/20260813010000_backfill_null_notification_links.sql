-- Give the legacy notifications a link, instead of leaning on a UI fallback.
--
-- 427 rows carry link IS NULL — every one of them type 'assignment_graded',
-- written between 2026-07-21 and 2026-08-10, before notify_student_on_grade
-- learned to set the column. The UI now derives a destination from the type and
-- course so those rows are no longer dead, but the fallback is a read-side
-- patch over a write-side gap: the column still says "this notification points
-- nowhere", and anything that reads the table without going through the UI
-- (the send-notification-email function builds its URL straight off `link`)
-- still sees nothing.
--
-- Why '/grades' and not the module-level deep link: notify_student_on_grade
-- picks '/courses/<c>/modules/<m>/assignments/<a>' when the assignment has a
-- module and '/courses/<c>/grades' otherwise. Matching all 427 back to their
-- assignment by the title embedded in 'Assignment graded: <title>' resolves
-- unambiguously — 427 unique matches, 0 ambiguous, 0 unmatched — and NONE of
-- those assignments has a module_id. So the trigger's own rule yields
-- '/courses/<c>/grades' for every one of them, and the title join buys nothing
-- but a chance to guess wrong. Write what the trigger would have written.
--
-- Idempotent: scoped to link IS NULL, so a re-run touches nothing.
UPDATE public.notifications
   SET link = '/courses/' || course_id::text || '/grades'
 WHERE link IS NULL
   AND type = 'assignment_graded'
   AND course_id IS NOT NULL;

-- Other types are deliberately left alone. The UI fallback covers them, and a
-- link invented here for a type whose trigger never wrote one would be a guess
-- recorded as fact.
