-- Records the career quiz's experience answer.
--
-- The quiz previously had no question about proficiency at all: nine of its ten
-- questions asked what the person enjoyed, preferred or was excited by, and the
-- "skill level" shown alongside each track — and used to pick the difficulty of
-- the recommended courses — was read off the sum of those answers. Enthusiasm
-- was being reported as expertise, so someone who found four tracks appealing
-- was told they were Advanced in all four and pointed at MLOps.
--
-- The quiz now asks directly. This column stores the chosen option id
-- ('none' | 'learning' | 'working' | 'seasoned'); the level it maps to lives in
-- src/data/careerQuizData.ts beside the question, so rewording the answers does
-- not require a data migration.
--
-- Nullable on purpose. Every attempt taken before this question existed has no
-- answer, and the UI renders that as "not recorded" rather than inventing a
-- level for someone who was never asked.
ALTER TABLE public.career_quiz_attempts
  ADD COLUMN IF NOT EXISTS self_reported_experience text;

COMMENT ON COLUMN public.career_quiz_attempts.self_reported_experience IS
  'Option id from the career quiz experience question (none/learning/working/seasoned). NULL for attempts taken before the question existed. Maps to a SkillLevel in src/data/careerQuizData.ts.';
