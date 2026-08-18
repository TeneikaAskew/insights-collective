-- Two Sum's fourth test case has two right answers, and the grader accepts one.
--
-- `[-1,0,1,2]` with target 1 can be solved as [0,3] (-1 + 2) or [1,2] (0 + 1).
-- The stored expectation is [0,3], and compare_mode for this challenge is
-- 'exact', so the textbook single-pass hash map — walk the list, return as soon
-- as the complement has been seen — is marked WRONG. It reaches 0 + 1 first and
-- returns [1,2]:
--
--   i=0  n=-1  need 2   not seen        seen={-1:0}
--   i=1  n=0   need 1   not seen        seen={-1:0, 0:1}
--   i=2  n=1   need 0   SEEN at 1  -->  returns [1, 2]
--
-- That is the canonical answer to this problem, so the challenge fails the
-- people who solve it correctly and passes only those who happen to iterate in
-- an order that finds the far pair first. Two Sum's own premise is that exactly
-- one solution exists; this case broke that premise, which is what made a
-- single expected value unsafe.
--
-- Caught when an AI-judged submission came back 3/4 and the judge turned out to
-- be right: the model traced the code correctly and the test data was wrong.
--
-- The fix keeps everything the case was there to cover — negative numbers, a
-- four-element list, an answer spanning the ends — and only removes the second
-- valid pair. `[-1,0,2,4]` with target 3 has exactly one solution, and it is
-- still [0,3], so the expectation does not move:
--
--   -1+0=-1   -1+2=1   -1+4=3  <-- only pair    0+2=2   0+4=4   2+4=6
--
-- Scoped to the Python challenge. The JavaScript Two Sum
-- (c0de0007-...-000000000007) carries only the first three cases and is unaffected.
--
-- Existing code_attempts are left alone: they record what was graded at the
-- time, and rewriting that history would misrepresent what those users saw.

UPDATE code_challenges
SET test_cases = '[
    {"input": "[2,7,11,15], 9", "expected": "[0, 1]", "hidden": false},
    {"input": "[3,2,4], 6", "expected": "[1, 2]", "hidden": true},
    {"input": "[3,3], 6", "expected": "[0, 1]", "hidden": true},
    {"input": "[-1,0,2,4], 3", "expected": "[0, 3]", "hidden": true}
  ]'::jsonb
WHERE id = 'c0de0002-0000-4000-8000-000000000002';
