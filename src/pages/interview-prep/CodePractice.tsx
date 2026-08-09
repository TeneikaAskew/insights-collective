import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/use-user';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Spinner } from '@/components/ui/spinner';
import Editor from '@monaco-editor/react';
// Side-effect import: binds the bundled Monaco to the loader before <Editor>
// mounts, so it never reaches for the jsdelivr copy. Must precede first render.
import '@/lib/monaco-setup';
import { Check, Code, ChevronLeft, RotateCcw } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { MonacoCard } from '@/components/ui/theme-monaco';

import { createLogger } from '@/utils/logger';

const logger = createLogger('CodePractice');

// Define the available job roles
const jobRoles = [
  { value: 'data_analyst', label: 'Data Analyst' },
  { value: 'data_scientist', label: 'Data Scientist' },
  { value: 'data_engineer', label: 'Data Engineer' },
  { value: 'cloud_engineer', label: 'Cloud Engineer' },
  { value: 'business_intelligence', label: 'Business Intelligence' },
  { value: 'product_analyst', label: 'Product Analyst' },
  { value: 'all', label: 'All Roles' }
];

// Sample challenges by role
const challengesByRole = {
  data_analyst: {
    title: 'Pandas DataFrame Filter',
    difficulty: 'Easy',
    description: 'Implement a function that filters a pandas DataFrame based on a given condition.',
    detail: 'Given a pandas DataFrame with sales data, write a function that returns rows where the sales amount exceeds a specified threshold.',
    example: "Input: df = pd.DataFrame({'product': ['A', 'B', 'C', 'D'], 'sales': [100, 200, 50, 300]}), threshold = 150\nOutput: DataFrame with products B and D",
    constraints: [
      'DataFrame will have at least 1 row',
      'All sales values will be positive integers',
      'Function should return a new DataFrame, not modify the original'
    ],
    hints: [
      'Use DataFrame boolean indexing',
      'Think about how to apply a comparison operator across a column',
      'Remember that pandas operations are vectorized'
    ]
  },
  data_scientist: {
    title: 'Two Sum',
    difficulty: 'Easy',
    description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
    detail: 'You may assume that each input would have exactly one solution, and you may not use the same element twice.',
    example: 'Input: nums = [2,7,11,15], target = 9\nOutput: [0,1]\nExplanation: Because nums[0] + nums[1] == 9, we return [0, 1].',
    constraints: [
      '2 <= nums.length <= 10^4',
      '-10^9 <= nums[i] <= 10^9',
      '-10^9 <= target <= 10^9',
      'Only one valid answer exists.'
    ],
    hints: [
      'Consider using a hash map to store values you\'ve seen so far.',
      'For each number, check if its complement (target - num) exists in the hash map.',
      'This can be solved in a single pass through the array.'
    ]
  },
  data_engineer: {
    title: 'Log Parser',
    difficulty: 'Medium',
    description: 'Create a function that parses log files and extracts specific information.',
    detail: 'Given a list of log strings, extract all IP addresses that made more than N requests.',
    example: "Input: logs = ['192.168.1.1 - GET /home', '192.168.1.2 - POST /login', '192.168.1.1 - GET /about'], N = 1\nOutput: ['192.168.1.1']",
    constraints: [
      'Log entries will be in the format "<ip_address> - <request_type> <endpoint>"',
      '1 <= logs.length <= 10^5',
      'Valid IP addresses only'
    ],
    hints: [
      'Use a dictionary to count occurrences of each IP',
      'Regular expressions can help extract the IP addresses',
      'Consider how to handle edge cases like empty logs'
    ]
  },
  cloud_engineer: {
    title: 'Resource Allocation',
    difficulty: 'Medium',
    description: 'Implement an algorithm to optimize resource allocation in a cloud environment.',
    detail: 'Given a list of tasks with their CPU and memory requirements, allocate them to servers to minimize the number of servers used.',
    example: "Input: tasks = [{'cpu': 2, 'mem': 4}, {'cpu': 1, 'mem': 2}, {'cpu': 3, 'mem': 1}], server_capacity = {'cpu': 4, 'mem': 8}\nOutput: 2 (servers)",
    constraints: [
      'Each server has the same capacity',
      '1 <= tasks.length <= 100',
      'All requirements are positive integers'
    ],
    hints: [
      'This is a bin packing problem variation',
      'Consider sorting tasks by resource requirements before allocation',
      'Try different greedy approaches to see which works best'
    ]
  },
  business_intelligence: {
    title: 'KPI Calculator',
    difficulty: 'Easy',
    description: 'Write a function to calculate key performance indicators from a dataset.',
    detail: 'Given monthly sales data, calculate the month-over-month growth percentages.',
    example: "Input: sales = [120, 145, 138, 162, 157]\nOutput: [None, 20.83, -4.83, 17.39, -3.09]",
    constraints: [
      'Array will have at least 1 value',
      'All sales values will be positive',
      'Return percentages rounded to 2 decimal places'
    ],
    hints: [
      'Handle the first month carefully since there is no previous month',
      'The formula for growth is (current - previous) / previous * 100',
      'Consider using a list comprehension for clean code'
    ]
  },
  product_analyst: {
    title: 'A/B Test Analysis',
    difficulty: 'Medium',
    description: 'Implement a function to analyze A/B test results and determine statistical significance.',
    detail: 'Given conversion counts and sample sizes for control and test groups, calculate the p-value to determine if the difference is statistically significant.',
    example: "Input: control = {'conversions': 100, 'size': 1000}, test = {'conversions': 120, 'size': 1000}\nOutput: {'p_value': 0.0436, 'significant': True}",
    constraints: [
      'All values will be positive integers',
      'Sample sizes will be greater than 10',
      'Use a significance level of 0.05'
    ],
    hints: [
      'Consider using a chi-square test or z-test for proportions',
      'The null hypothesis is that there is no difference between groups',
      'Remember to interpret the p-value correctly'
    ]
  },
  all: {
    title: 'Two Sum',
    difficulty: 'Easy',
    description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
    detail: 'You may assume that each input would have exactly one solution, and you may not use the same element twice.',
    example: 'Input: nums = [2,7,11,15], target = 9\nOutput: [0,1]\nExplanation: Because nums[0] + nums[1] == 9, we return [0, 1].',
    constraints: [
      '2 <= nums.length <= 10^4',
      '-10^9 <= nums[i] <= 10^9',
      '-10^9 <= target <= 10^9',
      'Only one valid answer exists.'
    ],
    hints: [
      'Consider using a hash map to store values you\'ve seen so far.',
      'For each number, check if its complement (target - num) exists in the hash map.',
      'This can be solved in a single pass through the array.'
    ]
  }
};

const templateForRole = (role: string) => {
  if (role === 'data_analyst' || role === 'data_scientist') {
    return '# Write your solution here\n\nimport pandas as pd\nimport numpy as np\n\ndef solution(data):\n    # Your code here\n    pass';
  }
  if (role === 'data_engineer') {
    return '# Write your solution here\n\ndef parse_logs(logs, threshold):\n    # Your code here\n    pass';
  }
  return '// Write your solution here';
};

const difficultyChip: Record<string, string> = {
  Easy: 'bg-ss-good-chip text-ss-good',
  Medium: 'bg-ss-warn-chip text-ss-warn',
  Hard: 'bg-ss-bad-chip text-ss-bad',
};

const modeChip: Record<string, { label: string; className: string }> = {
  demo: { label: 'Demo', className: 'bg-ss-track text-muted-foreground' },
  'ai-judged': { label: 'AI-judged', className: 'bg-ss-lav-chip text-ss-lav-deep' },
  executed: { label: 'Executed', className: 'bg-ss-teal-chip text-ss-teal' },
};

// Challenges live in the code_challenges table (seeded by the
// 20260727000000 migration); the hardcoded set above stays as a demo
// fallback for logged-out visitors and empty databases.
interface DbChallenge {
  id: string;
  title: string;
  difficulty: string;
  prompt: string;
  description: string | null;
  detail: string | null;
  example: string | null;
  constraints: string[] | null;
  hints: string[] | null;
  language: string;
  starter_code: string | null;
  function_name: string;
}

export default function CodePractice() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useUser();
  const [code, setCode] = useState('// Write your solution here');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [selectedRole, setSelectedRole] = useState('all');
  const [currentChallenge, setCurrentChallenge] = useState(challengesByRole.all);
  const [dbChallenge, setDbChallenge] = useState<DbChallenge | null>(null);
  // True while the database challenge for this role is in flight. Submitting
  // during that window would take the demo path and hand a signed-in user
  // fabricated "3/3 passed" feedback for code that never ran.
  const [challengeLoading, setChallengeLoading] = useState(false);
  // A failed lookup is not the same as "this role has no challenge". Only the
  // latter makes the demo honest; the former must not resolve as a pass.
  const [challengeError, setChallengeError] = useState(false);
  const [challengeReloads, setChallengeReloads] = useState(0);
  const [activeTab, setActiveTab] = useState('code'); // Set default tab to code editor

  useEffect(() => {
    // Update the current challenge when the selected role changes
    setCurrentChallenge(challengesByRole[selectedRole]);

    // Reset the code editor with template based on the role
    setCode(templateForRole(selectedRole));
    setFeedback(null);
    setActiveTab('code');

    // Try the database for a real challenge for this role; the hardcoded
    // set stays as fallback so the page never regresses to an empty state.
    let cancelled = false;
    setDbChallenge(null);
    setChallengeError(false);
    setChallengeLoading(true);
    (async () => {
      try {
        // Explicit projection: test_cases stays server-side (hidden cases
        // must never reach the browser; column privileges enforce this too).
        const { data, error } = await supabase
          .from('code_challenges')
          .select('id,title,difficulty,prompt,description,detail,example,constraints,hints,language,starter_code,function_name,runtime,compare_mode,topic_tags')
          .contains('topic_tags', [selectedRole])
          .order('difficulty', { ascending: true })
          .limit(1);
        if (cancelled) return;
        if (error) {
          logger.error('Challenge lookup failed:', error);
          setChallengeError(true);
          return;
        }
        // A genuinely empty result means this role has no database challenge,
        // which is the one case where the demo is truthful.
        if (!data || data.length === 0) return;
        const row = data[0] as DbChallenge;
        setDbChallenge(row);
        if (row.starter_code) setCode(row.starter_code);
      } catch (error) {
        logger.error('Error loading challenge from database:', error);
        if (!cancelled) setChallengeError(true);
      } finally {
        if (!cancelled) setChallengeLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedRole, challengeReloads]);

  // The demo path is only honest once we know there is no signed-in user and
  // no database challenge — until then, submitting would invent a result.
  const submitBlocked = authLoading || (!!user && (challengeLoading || challengeError));

  const handleCodeChange = (value) => {
    setCode(value);
  };

  const handleRoleChange = (value) => {
    setSelectedRole(value);
  };

  const handleReset = () => {
    // A database challenge defines its own starter signature — reset to it,
    // not to the generic role template.
    setCode(dbChallenge?.starter_code || templateForRole(selectedRole));
  };

  const handleSubmit = async () => {
    // Never resolve a real submission as a demo just because auth or the
    // challenge had not arrived yet.
    if (submitBlocked) return;

    // Real evaluation: signed in with a database-backed challenge.
    // Phase 3 flow: execute-code runs the submission in a sandbox for
    // ground-truth results, then review-code writes the qualitative review.
    // If the sandbox is unavailable, fall back to the AI judge alone.
    if (user && dbChallenge) {
      setLoading(true);
      try {
        let execution: any = null;
        try {
          const { data, error } = await supabase.functions.invoke('execute-code', {
            body: { challengeId: dbChallenge.id, code, language },
          });
          if (error) throw error;
          if (data?.error) throw new Error(data.error);
          execution = data;
        } catch (executionError) {
          logger.error('Sandbox execution unavailable, falling back to AI judge:', executionError);
        }

        // Review mode only needs the attemptId — the function derives the
        // verdict from the execution record stored server-side on the attempt.
        const { data: review, error: reviewError } = await supabase.functions.invoke('review-code', {
          body: execution?.attemptId
            ? { challengeId: dbChallenge.id, code, language, attemptId: execution.attemptId }
            : { challengeId: dbChallenge.id, code, language },
        });
        if (reviewError) throw reviewError;
        if (review?.error) throw new Error(review.error);

        if (execution) {
          setFeedback({
            correct: execution.allTestsPassed,
            mode: 'executed',
            testsPassed: `${execution.testsPassed}/${execution.testsTotal}`,
            runtime: execution.runtimeMs ? `${execution.runtimeMs}ms` : null,
            memory: execution.memoryKb ? `${(execution.memoryKb / 1024).toFixed(1)}MB` : null,
            feedback: review.review,
            suggestions: review.suggestions || [],
            testResults: (execution.results || []).filter((r) => !r.hidden),
          });
        } else {
          setFeedback({
            correct: review.correct,
            mode: review.evaluationMode || 'ai-judged',
            testsPassed: `${review.testsPassed}/${review.testsTotal}`,
            runtime: null,
            memory: null,
            feedback: review.review,
            suggestions: review.suggestions || [],
            testResults: review.testResults || [],
          });
        }
        setActiveTab('feedback');
      } catch (error: any) {
        logger.error('Error submitting code:', error);
        toast({
          title: 'Error',
          description: error?.message || 'Failed to submit code. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
      return;
    }

    // Demo fallback (logged out, or no challenge rows in the database):
    // simulated feedback, clearly labeled as a demo in the result card.
    setLoading(true);
    try {
      // Simulate API call with timeout
      setTimeout(() => {
        setFeedback({
          correct: true,
          mode: 'demo',
          runtime: '42ms',
          memory: '8.2MB',
          testsPassed: '3/3',
          feedback: `Your solution for the ${currentChallenge.title} challenge is correct and efficient.`,
          suggestions: [
            'Consider handling edge cases for empty inputs',
            'You could optimize space complexity further',
            `For ${jobRoles.find(role => role.value === selectedRole).label} roles, consider focusing on performance optimization`
          ]
        });
        setActiveTab('feedback');
        setLoading(false);
      }, 1500);

    } catch (error) {
      logger.error('Error submitting code:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit code. Please try again.',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  const language =
    dbChallenge?.language ??
    (selectedRole === 'data_analyst' || selectedRole === 'data_scientist' ? 'python' : 'javascript');
  const showFeedback = activeTab === 'feedback' && feedback;

  // What the problem page renders: the database row when one exists,
  // otherwise the hardcoded demo challenge for the role.
  const challenge = dbChallenge
    ? {
        title: dbChallenge.title,
        difficulty:
          dbChallenge.difficulty.charAt(0).toUpperCase() + dbChallenge.difficulty.slice(1),
        description: dbChallenge.description || dbChallenge.prompt,
        detail: dbChallenge.detail || '',
        example: dbChallenge.example || '',
        constraints: Array.isArray(dbChallenge.constraints) ? dbChallenge.constraints : [],
        hints: Array.isArray(dbChallenge.hints) ? dbChallenge.hints : [],
      }
    : currentChallenge;

  return (
    <AppLayout fullWidth>
      <div className="ss-wash min-h-full px-4 sm:px-6 py-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/interview-prep')}
                className="rounded-full font-bold"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Interview prep
              </Button>
              <span className="text-sm text-muted-foreground">· Step 03</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">Code Challenge Practice</h1>
            <p className="text-muted-foreground text-lg">
              Practice technical coding challenges with real-time feedback.
            </p>
          </div>

          <div className="mb-6">
            <label className="text-sm font-medium mb-2 block">Select your target role:</label>
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={selectedRole} onValueChange={handleRoleChange}>
                <SelectTrigger className="w-full sm:w-[300px] rounded-xl bg-card">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {jobRoles.map((role) => (
                    <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="rounded-full bg-ss-lav-chip px-3 py-1 text-xs font-medium text-ss-lav-deep">
                {language === 'python' ? 'Python' : 'JavaScript'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Questions will be tailored to the specific skills needed for your selected role
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
            {/* Left page: the problem while composing, the result after submitting */}
            <div className="lg:col-span-2">
              {showFeedback ? (
                <Card className="ss-card">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <CardTitle>Result</CardTitle>
                      {feedback.correct ? (
                        <span className="flex items-center rounded-full bg-ss-good-chip px-3 py-1 text-xs font-bold text-ss-good">
                          <Check className="h-3.5 w-3.5 mr-1" />
                          Correct
                        </span>
                      ) : (
                        <span className="rounded-full bg-ss-bad-chip px-3 py-1 text-xs font-bold text-ss-bad">
                          Incorrect
                        </span>
                      )}
                      {feedback.mode && modeChip[feedback.mode] && (
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${modeChip[feedback.mode].className}`}>
                          {modeChip[feedback.mode].label}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="flex gap-3">
                      {feedback.runtime && (
                        <div className="flex-1 rounded-2xl border bg-card px-4 py-3 text-center">
                          <p className="text-xl font-bold">{feedback.runtime}</p>
                          <p className="text-xs text-muted-foreground">runtime</p>
                        </div>
                      )}
                      {feedback.memory && (
                        <div className="flex-1 rounded-2xl border bg-card px-4 py-3 text-center">
                          <p className="text-xl font-bold">{feedback.memory}</p>
                          <p className="text-xs text-muted-foreground">memory</p>
                        </div>
                      )}
                      <div className="flex-1 rounded-2xl border bg-card px-4 py-3 text-center">
                        <p className="text-xl font-bold">{feedback.testsPassed}</p>
                        <p className="text-xs text-muted-foreground">test cases passed</p>
                      </div>
                    </div>

                    {feedback.testResults?.length > 0 && (
                      <div className="space-y-2">
                        {feedback.testResults.map((result, index) => (
                          <div
                            key={index}
                            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-mono ${
                              result.passed ? 'bg-ss-good-chip' : 'bg-ss-bad-chip'
                            }`}
                          >
                            <span className={`font-bold ${result.passed ? 'text-ss-good' : 'text-ss-bad'}`}>
                              {result.passed ? '✓' : '✕'}
                            </span>
                            <span className="truncate">({result.input})</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="rounded-2xl bg-ss-card-warm border border-ss-peach/30 p-4">
                      <h3 className="text-sm font-bold text-ss-peach-deep mb-2">Code Review</h3>
                      <p className="text-sm">{feedback.feedback}</p>
                    </div>

                    <div className="rounded-2xl bg-ss-lav-chip p-4">
                      <h3 className="text-sm font-bold text-ss-lav-deep mb-2">Suggestions</h3>
                      <ol className="space-y-2">
                        {feedback.suggestions.map((suggestion, index) => (
                          <li key={index} className="flex gap-2 text-sm">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-card text-xs font-bold text-ss-lav-deep">
                              {index + 1}
                            </span>
                            {suggestion}
                          </li>
                        ))}
                      </ol>
                    </div>

                    <div className="flex justify-end">
                      <Button onClick={() => setActiveTab('code')} className="rounded-full font-bold">
                        <Code className="h-4 w-4 mr-2" />
                        Continue Editing
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="ss-card">
                  <CardHeader>
                    <div className="flex items-center gap-3 flex-wrap">
                      <CardTitle>{challenge.title}</CardTitle>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          difficultyChip[challenge.difficulty] ?? 'bg-ss-track text-muted-foreground'
                        }`}
                      >
                        {challenge.difficulty}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-5">
                      <div>
                        <p className="text-sm font-medium mb-2">{challenge.description}</p>
                        <p className="text-sm text-muted-foreground mb-2">{challenge.detail}</p>
                        <p className="text-sm text-muted-foreground">
                          This is a common problem type for {jobRoles.find(role => role.value === selectedRole).label} interviews.
                        </p>
                      </div>

                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Example</h3>
                        <pre className="bg-muted p-3 rounded-xl text-xs overflow-auto max-h-[150px] whitespace-pre-wrap">
                          {challenge.example}
                        </pre>
                      </div>

                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Constraints</h3>
                        <ul className="list-disc list-inside space-y-1">
                          {challenge.constraints.map((constraint, index) => (
                            <li key={index} className="text-sm">{constraint}</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Hints</h3>
                        <div className="space-y-2">
                          {challenge.hints.map((hint, index) => (
                            <div key={index} className="rounded-xl bg-ss-lav-chip px-4 py-3 text-sm">
                              <span className="font-bold text-ss-lav-deep">Hint {index + 1}.</span> {hint}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right page: the dark editor sitting in a soft frame */}
            <div className="lg:col-span-3">
              <MonacoCard className="rounded-[26px] overflow-hidden shadow-[0_14px_34px_-18px_rgba(90,80,120,0.55)] border-[#3A3644]">
                <div className="flex items-center gap-2 px-5 py-3 border-b border-[#3A3644]">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#EC6A5E]" aria-hidden="true" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#F4BF4F]" aria-hidden="true" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#61C554]" aria-hidden="true" />
                  <span className="ml-2 font-mono text-xs text-[#9CA3AF]">
                    {language === 'python' ? 'solution.py' : 'solution.js'}
                  </span>
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="ml-auto">
                    <TabsList className="bg-transparent p-0 gap-1">
                      <TabsTrigger
                        value="code"
                        className="rounded-full text-xs font-bold text-[#9CA3AF] data-[state=active]:bg-[#3A3644] data-[state=active]:text-white data-[state=active]:shadow-none"
                      >
                        Code Editor
                      </TabsTrigger>
                      <TabsTrigger
                        value="feedback"
                        disabled={!feedback}
                        className="rounded-full text-xs font-bold text-[#9CA3AF] data-[state=active]:bg-[#3A3644] data-[state=active]:text-white data-[state=active]:shadow-none"
                      >
                        Feedback
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <div className="h-[500px]">
                  <Editor
                    height="100%"
                    language={language}
                    theme="vs-dark"
                    value={code}
                    onChange={handleCodeChange}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      scrollBeyondLastLine: false,
                    }}
                  />
                </div>

                {user && challengeError && (
                  <div
                    data-testid="challenge-load-error"
                    role="alert"
                    className="flex items-center gap-3 flex-wrap px-5 py-3 border-t border-[#3A3644] text-sm text-[#D1D5DB]"
                  >
                    <span>Couldn’t load this challenge, so it can’t be evaluated yet.</span>
                    <Button
                      variant="outline"
                      onClick={() => setChallengeReloads((n) => n + 1)}
                      className="rounded-full font-bold border-[#4A445C] bg-transparent text-[#D1D5DB] hover:bg-[#333333] hover:text-white"
                    >
                      Try again
                    </Button>
                  </div>
                )}

                <div className="flex justify-end gap-3 px-5 py-4 border-t border-[#3A3644]">
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    className="rounded-full font-bold border-[#4A445C] bg-transparent text-[#D1D5DB] hover:bg-[#333333] hover:text-white"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={loading || submitBlocked}
                    className="rounded-full font-bold"
                  >
                    {loading ? <Spinner size="sm" className="mr-2" /> : null}
                    Submit Solution
                  </Button>
                </div>
              </MonacoCard>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
