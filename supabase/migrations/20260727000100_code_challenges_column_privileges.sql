-- Security hardening (PR #17 review): hidden test cases must never reach
-- the browser. RLS controls which ROWS authenticated users can read, but
-- test_cases is a COLUMN on readable rows — so enforce column-level
-- privileges: members can read every challenge column except test_cases.
-- Edge functions use the service role and keep full access.
--
-- Note: after this, `select('*')` on code_challenges fails for
-- authenticated clients ("permission denied for table code_challenges");
-- clients must project explicit columns (the app already does).

REVOKE SELECT ON code_challenges FROM authenticated;
REVOKE SELECT ON code_challenges FROM anon;

GRANT SELECT (
  id,
  title,
  difficulty,
  prompt,
  description,
  detail,
  example,
  constraints,
  hints,
  language,
  starter_code,
  function_name,
  runtime,
  compare_mode,
  topic_tags,
  created_at
) ON code_challenges TO authenticated;
