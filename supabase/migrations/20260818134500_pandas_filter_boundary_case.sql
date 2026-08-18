-- Pandas DataFrame Filter never tests the boundary it is defined by.
--
-- The challenge says rows where sales "exceeds" the threshold — strictly
-- greater. But no stored case has a sales value equal to its threshold:
--
--   [100,200,50,300] thr=150   >  gives [200,300]   >= gives [200,300]
--   [10]             thr=100   >  gives []          >= gives []
--   [500,600]        thr=1     >  gives [500,600]   >= gives [500,600]
--
-- Identical either way, so `sales >= threshold` passes the whole suite while
-- being wrong on the one input that distinguishes it. This is the failure
-- review-code's own header comment records from the model comparison — the
-- llama-3.3-70b passed a log parser using `>=` where it needed `>`. Log Parser's
-- data catches that; this challenge's does not.
--
-- Note this is the opposite of the Two Sum defect fixed in
-- 20260818131500: that one FAILED correct solutions, this one PASSES incorrect
-- ones. Both come from test data that does not pin down the spec.
--
-- Adding a case rather than changing one, so existing coverage is untouched and
-- the visible example still matches the row it documents. 150/151/149 around a
-- threshold of 150 separates the two operators in one shot:
--
--   >  150  ->  [Q]        (151 only)
--   >= 150  ->  [P, Q]     (150 and 151)  <-- now fails, as it should
--
-- Hidden, like the other added cases, so the boundary is not handed to the
-- solver in the prompt.

UPDATE code_challenges
SET test_cases = test_cases || '[
    {"input": "pd.DataFrame({''product'': [''P'',''Q'',''R''], ''sales'': [150,151,149]}), 150", "expected": "[{\"product\": \"Q\", \"sales\": 151}]", "hidden": true}
  ]'::jsonb
WHERE id = 'c0de0001-0000-4000-8000-000000000001';
