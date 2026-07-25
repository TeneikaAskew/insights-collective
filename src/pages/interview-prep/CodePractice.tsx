import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Spinner } from '@/components/ui/spinner';
import Editor from '@monaco-editor/react';
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

export default function CodePractice() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [code, setCode] = useState('// Write your solution here');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [selectedRole, setSelectedRole] = useState('all');
  const [currentChallenge, setCurrentChallenge] = useState(challengesByRole.all);
  const [activeTab, setActiveTab] = useState('code'); // Set default tab to code editor

  useEffect(() => {
    // Update the current challenge when the selected role changes
    setCurrentChallenge(challengesByRole[selectedRole]);

    // Reset the code editor with template based on the role
    setCode(templateForRole(selectedRole));
    setFeedback(null);
    setActiveTab('code');
  }, [selectedRole]);

  const handleCodeChange = (value) => {
    setCode(value);
  };

  const handleRoleChange = (value) => {
    setSelectedRole(value);
  };

  const handleReset = () => {
    setCode(templateForRole(selectedRole));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Simulate API call with timeout
      setTimeout(() => {
        setFeedback({
          correct: true,
          runtime: '42ms',
          memory: '8.2MB',
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
    selectedRole === 'data_analyst' || selectedRole === 'data_scientist' ? 'python' : 'javascript';
  const showFeedback = activeTab === 'feedback' && feedback;

  return (
    <AppLayout fullWidth>
      <div className="soft-studio ss-wash min-h-full px-4 sm:px-6 py-8">
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
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border bg-card px-4 py-3 text-center">
                        <p className="text-xl font-bold">{feedback.runtime}</p>
                        <p className="text-xs text-muted-foreground">runtime</p>
                      </div>
                      <div className="rounded-2xl border bg-card px-4 py-3 text-center">
                        <p className="text-xl font-bold">{feedback.memory}</p>
                        <p className="text-xs text-muted-foreground">memory</p>
                      </div>
                    </div>

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
                      <CardTitle>{currentChallenge.title}</CardTitle>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          difficultyChip[currentChallenge.difficulty] ?? 'bg-ss-track text-muted-foreground'
                        }`}
                      >
                        {currentChallenge.difficulty}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-5">
                      <div>
                        <p className="text-sm font-medium mb-2">{currentChallenge.description}</p>
                        <p className="text-sm text-muted-foreground mb-2">{currentChallenge.detail}</p>
                        <p className="text-sm text-muted-foreground">
                          This is a common problem type for {jobRoles.find(role => role.value === selectedRole).label} interviews.
                        </p>
                      </div>

                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Example</h3>
                        <pre className="bg-muted p-3 rounded-xl text-xs overflow-auto max-h-[150px] whitespace-pre-wrap">
                          {currentChallenge.example}
                        </pre>
                      </div>

                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Constraints</h3>
                        <ul className="list-disc list-inside space-y-1">
                          {currentChallenge.constraints.map((constraint, index) => (
                            <li key={index} className="text-sm">{constraint}</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Hints</h3>
                        <div className="space-y-2">
                          {currentChallenge.hints.map((hint, index) => (
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
                  <span className="ml-2 font-mono text-xs text-gray-400">
                    {language === 'python' ? 'solution.py' : 'solution.js'}
                  </span>
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="ml-auto">
                    <TabsList className="bg-transparent p-0 gap-1">
                      <TabsTrigger
                        value="code"
                        className="rounded-full text-xs font-bold text-gray-400 data-[state=active]:bg-[#3A3644] data-[state=active]:text-white data-[state=active]:shadow-none"
                      >
                        Code Editor
                      </TabsTrigger>
                      <TabsTrigger
                        value="feedback"
                        disabled={!feedback}
                        className="rounded-full text-xs font-bold text-gray-400 data-[state=active]:bg-[#3A3644] data-[state=active]:text-white data-[state=active]:shadow-none"
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

                <div className="flex justify-end gap-3 px-5 py-4 border-t border-[#3A3644]">
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    className="rounded-full font-bold border-[#4A445C] bg-transparent text-gray-300 hover:bg-[#333333] hover:text-white"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                  <Button onClick={handleSubmit} disabled={loading} className="rounded-full font-bold">
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
