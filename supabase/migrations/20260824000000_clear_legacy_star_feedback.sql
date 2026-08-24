-- Clear STAR feedback written before the scale moved to the rubric's own 1-5.
--
-- Those blobs hold scores out of 10, and there is no honest way to redraw them
-- on the new scale: the two prompts asked different questions with different
-- anchors, so a 7/10 is not a 4/5. Re-running the stored answers through the new
-- path bears that out — one that scored 8.2/10 scores 2/5, because the old 1-10
-- prompt was inflating. The written answers are kept; only the evaluations go,
-- and each one re-scores on the next visit to its question.
--
-- At authoring time this matched 51 rows, all belonging to a single account, and
-- `star_responses` is read by exactly one page — no dashboard, export or report
-- depends on it.
--
-- Predicated on the ABSENCE of the score_scale stamp rather than on a date or an
-- id list, so it cannot touch anything the fixed function wrote and is safe to
-- re-run.

update public.star_responses
   set ai_feedback = null
 where ai_feedback is not null
   and not (ai_feedback ? 'score_scale');
