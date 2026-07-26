-- Real code evaluation, Phase 0 (docs/architecture/code-evaluation.md):
-- structure the code_challenges table for the Problem Book UI and machine
-- evaluation, allow members to read challenges, and seed the challenges the
-- Code Practice page has so far carried as hardcoded demo data — now with
-- real, machine-checkable test cases.

-- 1. Structured columns for the Problem Book UI and the evaluation harness.
--    (prompt is kept and back-filled for compatibility with older readers.)
ALTER TABLE code_challenges ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE code_challenges ADD COLUMN IF NOT EXISTS detail text;
ALTER TABLE code_challenges ADD COLUMN IF NOT EXISTS example text;
ALTER TABLE code_challenges ADD COLUMN IF NOT EXISTS constraints jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE code_challenges ADD COLUMN IF NOT EXISTS hints jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE code_challenges ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'python';
ALTER TABLE code_challenges ADD COLUMN IF NOT EXISTS starter_code text;
ALTER TABLE code_challenges ADD COLUMN IF NOT EXISTS function_name text NOT NULL DEFAULT 'solution';
-- Which sandbox the challenge needs: python-stdlib | python-ml (pandas/numpy) | javascript
ALTER TABLE code_challenges ADD COLUMN IF NOT EXISTS runtime text NOT NULL DEFAULT 'python-stdlib';
-- How expected/actual outputs are compared: exact (deep JSON equality) | set (order-insensitive)
ALTER TABLE code_challenges ADD COLUMN IF NOT EXISTS compare_mode text NOT NULL DEFAULT 'exact';

-- 2. Members need to read challenges (write stays admin-only per the
--    existing "Only admins can insert code challenges" policy).
ALTER TABLE code_challenges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read code challenges" ON code_challenges;
CREATE POLICY "Authenticated users can read code challenges" ON code_challenges
FOR SELECT TO authenticated USING (true);

-- 3. Seed the role challenges. Fixed UUIDs make the seed idempotent.
--    test_cases: array of { input, expected, hidden } where input is an
--    argument list literal in the challenge's language and expected is the
--    JSON encoding of the return value.
INSERT INTO code_challenges
  (id, title, difficulty, prompt, description, detail, example, constraints, hints,
   language, starter_code, function_name, runtime, compare_mode, topic_tags, test_cases)
VALUES
(
  'c0de0001-0000-4000-8000-000000000001',
  'Pandas DataFrame Filter',
  'easy',
  'Implement a function that filters a pandas DataFrame based on a given condition.',
  'Implement a function that filters a pandas DataFrame based on a given condition.',
  'Given a pandas DataFrame with sales data, write a function that returns rows where the sales amount exceeds a specified threshold. The function receives the DataFrame and the threshold as arguments.',
  E'Input: df = pd.DataFrame({''product'': [''A'', ''B'', ''C'', ''D''], ''sales'': [100, 200, 50, 300]}), threshold = 150\nOutput: DataFrame with products B and D',
  '["DataFrame will have at least 1 row", "All sales values will be positive integers", "Function should return a new DataFrame, not modify the original"]'::jsonb,
  '["Use DataFrame boolean indexing", "Think about how to apply a comparison operator across a column", "Remember that pandas operations are vectorized"]'::jsonb,
  'python',
  E'import pandas as pd\nimport numpy as np\n\ndef solution(data, threshold):\n    # Return the rows of `data` whose sales exceed `threshold`\n    pass',
  'solution',
  'python-ml',
  'exact',
  ARRAY['data_analyst', 'pandas'],
  '[
    {"input": "pd.DataFrame({''product'': [''A'',''B'',''C'',''D''], ''sales'': [100,200,50,300]}), 150", "expected": "[{\"product\": \"B\", \"sales\": 200}, {\"product\": \"D\", \"sales\": 300}]", "hidden": false},
    {"input": "pd.DataFrame({''product'': [''A''], ''sales'': [10]}), 100", "expected": "[]", "hidden": true},
    {"input": "pd.DataFrame({''product'': [''X'',''Y''], ''sales'': [500,600]}), 1", "expected": "[{\"product\": \"X\", \"sales\": 500}, {\"product\": \"Y\", \"sales\": 600}]", "hidden": true}
  ]'::jsonb
),
(
  'c0de0002-0000-4000-8000-000000000002',
  'Two Sum',
  'easy',
  'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
  'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
  'You may assume that each input would have exactly one solution, and you may not use the same element twice. Return the indices in ascending order.',
  E'Input: nums = [2,7,11,15], target = 9\nOutput: [0,1]\nExplanation: Because nums[0] + nums[1] == 9, we return [0, 1].',
  '["2 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9", "-10^9 <= target <= 10^9", "Only one valid answer exists."]'::jsonb,
  '["Consider using a hash map to store values you''ve seen so far.", "For each number, check if its complement (target - num) exists in the hash map.", "This can be solved in a single pass through the array."]'::jsonb,
  'python',
  E'def solution(nums, target):\n    # Return the indices of the two numbers that add up to target\n    pass',
  'solution',
  'python-stdlib',
  'exact',
  ARRAY['data_scientist', 'algorithms'],
  '[
    {"input": "[2,7,11,15], 9", "expected": "[0, 1]", "hidden": false},
    {"input": "[3,2,4], 6", "expected": "[1, 2]", "hidden": true},
    {"input": "[3,3], 6", "expected": "[0, 1]", "hidden": true},
    {"input": "[-1,0,1,2], 1", "expected": "[0, 3]", "hidden": true}
  ]'::jsonb
),
(
  'c0de0003-0000-4000-8000-000000000003',
  'Log Parser',
  'medium',
  'Create a function that parses log files and extracts specific information.',
  'Create a function that parses log files and extracts specific information.',
  'Given a list of log strings, extract all IP addresses that made more than N requests. Return them as a list (any order).',
  E'Input: logs = [''192.168.1.1 - GET /home'', ''192.168.1.2 - POST /login'', ''192.168.1.1 - GET /about''], N = 1\nOutput: [''192.168.1.1'']',
  '["Log entries will be in the format \"<ip_address> - <request_type> <endpoint>\"", "1 <= logs.length <= 10^5", "Valid IP addresses only"]'::jsonb,
  '["Use a dictionary to count occurrences of each IP", "Regular expressions can help extract the IP addresses", "Consider how to handle edge cases like empty logs"]'::jsonb,
  'python',
  E'def parse_logs(logs, threshold):\n    # Return the IPs that appear more than `threshold` times\n    pass',
  'parse_logs',
  'python-stdlib',
  'set',
  ARRAY['data_engineer', 'parsing'],
  '[
    {"input": "[''192.168.1.1 - GET /home'', ''192.168.1.2 - POST /login'', ''192.168.1.1 - GET /about''], 1", "expected": "[\"192.168.1.1\"]", "hidden": false},
    {"input": "[], 1", "expected": "[]", "hidden": true},
    {"input": "[''10.0.0.1 - GET /a'', ''10.0.0.1 - GET /b'', ''10.0.0.2 - GET /c'', ''10.0.0.2 - GET /d'', ''10.0.0.3 - GET /e''], 1", "expected": "[\"10.0.0.1\", \"10.0.0.2\"]", "hidden": true}
  ]'::jsonb
),
(
  'c0de0004-0000-4000-8000-000000000004',
  'Resource Allocation',
  'medium',
  'Implement an algorithm to optimize resource allocation in a cloud environment.',
  'Implement an algorithm to optimize resource allocation in a cloud environment.',
  'Given a list of tasks with their CPU and memory requirements, allocate them to servers to minimize the number of servers used. Return the minimum number of servers.',
  E'Input: tasks = [{cpu: 2, mem: 4}, {cpu: 1, mem: 2}, {cpu: 3, mem: 1}], server_capacity = {cpu: 4, mem: 8}\nOutput: 2 (servers)',
  '["Each server has the same capacity", "1 <= tasks.length <= 100", "All requirements are positive integers"]'::jsonb,
  '["This is a bin packing problem variation", "Consider sorting tasks by resource requirements before allocation", "Try different greedy approaches to see which works best"]'::jsonb,
  'javascript',
  E'function solution(tasks, serverCapacity) {\n  // Return the minimum number of servers needed\n}',
  'solution',
  'javascript',
  'exact',
  ARRAY['cloud_engineer', 'optimization'],
  '[
    {"input": "[{cpu: 2, mem: 4}, {cpu: 1, mem: 2}, {cpu: 3, mem: 1}], {cpu: 4, mem: 8}", "expected": "2", "hidden": false},
    {"input": "[{cpu: 1, mem: 1}], {cpu: 4, mem: 8}", "expected": "1", "hidden": true},
    {"input": "[{cpu: 4, mem: 8}, {cpu: 4, mem: 8}, {cpu: 4, mem: 8}], {cpu: 4, mem: 8}", "expected": "3", "hidden": true}
  ]'::jsonb
),
(
  'c0de0005-0000-4000-8000-000000000005',
  'KPI Calculator',
  'easy',
  'Write a function to calculate key performance indicators from a dataset.',
  'Write a function to calculate key performance indicators from a dataset.',
  'Given monthly sales data, calculate the month-over-month growth percentages, rounded to 2 decimal places. The first month has no previous month, so its value is null.',
  E'Input: sales = [120, 145, 138, 162, 157]\nOutput: [null, 20.83, -4.83, 17.39, -3.09]',
  '["Array will have at least 1 value", "All sales values will be positive", "Return percentages rounded to 2 decimal places"]'::jsonb,
  '["Handle the first month carefully since there is no previous month", "The formula for growth is (current - previous) / previous * 100", "Consider using a list comprehension for clean code"]'::jsonb,
  'javascript',
  E'function solution(sales) {\n  // Return month-over-month growth percentages (first month is null)\n}',
  'solution',
  'javascript',
  'exact',
  ARRAY['business_intelligence', 'metrics'],
  '[
    {"input": "[120, 145, 138, 162, 157]", "expected": "[null, 20.83, -4.83, 17.39, -3.09]", "hidden": false},
    {"input": "[100]", "expected": "[null]", "hidden": true},
    {"input": "[100, 100]", "expected": "[null, 0]", "hidden": true},
    {"input": "[50, 100]", "expected": "[null, 100]", "hidden": true}
  ]'::jsonb
),
(
  'c0de0006-0000-4000-8000-000000000006',
  'A/B Test Analysis',
  'medium',
  'Implement a function to analyze A/B test results and determine statistical significance.',
  'Implement a function to analyze A/B test results and determine statistical significance.',
  'Given conversion counts and sample sizes for control and test groups, run a two-tailed two-proportion z-test. Return a dict with the p-value rounded to 4 decimal places and whether the difference is significant at the 0.05 level.',
  E'Input: control = {''conversions'': 100, ''size'': 1000}, test = {''conversions'': 150, ''size'': 1000}\nOutput: {''p_value'': 0.0007, ''significant'': True}',
  '["All values will be positive integers", "Sample sizes will be greater than 10", "Use a significance level of 0.05", "Round p_value to 4 decimal places"]'::jsonb,
  '["Use a two-proportion z-test with the pooled proportion", "math.erf gives you the normal CDF without scipy", "The null hypothesis is that there is no difference between groups"]'::jsonb,
  'python',
  E'import math\n\ndef solution(control, test):\n    # Return {''p_value'': <rounded to 4 dp>, ''significant'': <bool>}\n    pass',
  'solution',
  'python-stdlib',
  'exact',
  ARRAY['product_analyst', 'statistics'],
  '[
    {"input": "{''conversions'': 100, ''size'': 1000}, {''conversions'': 150, ''size'': 1000}", "expected": "{\"p_value\": 0.0007, \"significant\": true}", "hidden": false},
    {"input": "{''conversions'': 100, ''size'': 1000}, {''conversions'': 100, ''size'': 1000}", "expected": "{\"p_value\": 1.0, \"significant\": false}", "hidden": true},
    {"input": "{''conversions'': 100, ''size'': 1000}, {''conversions'': 130, ''size'': 1000}", "expected": "{\"p_value\": 0.0355, \"significant\": true}", "hidden": true}
  ]'::jsonb
),
(
  'c0de0007-0000-4000-8000-000000000007',
  'Two Sum',
  'easy',
  'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
  'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
  'You may assume that each input would have exactly one solution, and you may not use the same element twice. Return the indices in ascending order.',
  E'Input: nums = [2,7,11,15], target = 9\nOutput: [0,1]\nExplanation: Because nums[0] + nums[1] == 9, we return [0, 1].',
  '["2 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9", "-10^9 <= target <= 10^9", "Only one valid answer exists."]'::jsonb,
  '["Consider using a hash map to store values you''ve seen so far.", "For each number, check if its complement (target - num) exists in the hash map.", "This can be solved in a single pass through the array."]'::jsonb,
  'javascript',
  E'function solution(nums, target) {\n  // Return the indices of the two numbers that add up to target\n}',
  'solution',
  'javascript',
  'exact',
  ARRAY['all', 'algorithms'],
  '[
    {"input": "[2,7,11,15], 9", "expected": "[0, 1]", "hidden": false},
    {"input": "[3,2,4], 6", "expected": "[1, 2]", "hidden": true},
    {"input": "[3,3], 6", "expected": "[0, 1]", "hidden": true}
  ]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

COMMENT ON COLUMN code_challenges.test_cases IS
  'Array of { input, expected, hidden }. input is an argument-list literal in the challenge language; expected is the JSON encoding of the return value. Hidden cases are never sent to the client.';
