
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Spinner } from '@/components/ui/spinner';
import Editor from '@monaco-editor/react';
import { Badge } from '@/components/ui/badge';
import { Check, Code, ChevronLeft } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { MonacoThemeProvider, MonacoCard } from '@/components/ui/theme-monaco';

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

export default function CodePractice() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('question');
  const [code, setCode] = useState('// Write your solution here');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [selectedRole, setSelectedRole] = useState('all');
  const [currentChallenge, setCurrentChallenge] = useState(challengesByRole.all);

  useEffect(() => {
    // Update the current challenge when the selected role changes
    setCurrentChallenge(challengesByRole[selectedRole]);
    
    // Reset the code editor with template based on the role
    let template = '// Write your solution here';
    if (selectedRole === 'data_analyst' || selectedRole === 'data_scientist') {
      template = '# Write your solution here\n\nimport pandas as pd\nimport numpy as np\n\ndef solution(data):\n    # Your code here\n    pass';
    } else if (selectedRole === 'data_engineer') {
      template = '# Write your solution here\n\ndef parse_logs(logs, threshold):\n    # Your code here\n    pass';
    }
    
    setCode(template);
    setFeedback(null);
    setActiveTab('question');
  }, [selectedRole]);

  const handleCodeChange = (value) => {
    setCode(value);
  };

  const handleRoleChange = (value) => {
    setSelectedRole(value);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Implement code submission and evaluation logic
      // This would typically call an API endpoint
      
      // Simulating API call with timeout
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
      console.error('Error submitting code:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit code. Please try again.',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={() => navigate('/interview-prep')}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Interview Prep
            </Button>
          </div>
          <h1 className="text-4xl font-bold mb-2">Code Challenge Practice</h1>
          <p className="text-muted-foreground">
            Practice technical coding challenges with real-time feedback.
          </p>
        </div>

        <div className="mb-6">
          <label className="text-sm font-medium mb-2 block">Select your target role:</label>
          <Select value={selectedRole} onValueChange={handleRoleChange}>
            <SelectTrigger className="w-full sm:w-[300px]">
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>
              {jobRoles.map((role) => (
                <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-2">
            Questions will be tailored to the specific skills needed for your selected role
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>{currentChallenge.title}</CardTitle>
                <CardDescription>{currentChallenge.difficulty}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm mb-4">
                  {currentChallenge.description}
                </p>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium mb-2">Example:</h3>
                    <pre className="bg-muted p-2 rounded-md text-xs overflow-auto max-h-[150px]">
                      {currentChallenge.example}
                    </pre>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium mb-2">Constraints:</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {currentChallenge.constraints.map((constraint, index) => (
                        <li key={index} className="text-sm">{constraint}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="md:col-span-2">
            <MonacoCard className="h-full">
              <CardHeader className="pb-2 border-b border-[#444444]">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="bg-[#333333]">
                    <TabsTrigger value="question" className="data-[state=active]:bg-[#0e639c] data-[state=active]:text-white">Problem</TabsTrigger>
                    <TabsTrigger value="code" className="data-[state=active]:bg-[#0e639c] data-[state=active]:text-white">Code Editor</TabsTrigger>
                    <TabsTrigger value="feedback" disabled={!feedback} className="data-[state=active]:bg-[#0e639c] data-[state=active]:text-white">Feedback</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>
              
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsContent value="question">
                    <div className="prose max-w-none text-gray-200">
                      <h3 className="text-gray-100">{currentChallenge.title}</h3>
                      <p className="text-gray-300">
                        {currentChallenge.detail}
                      </p>
                      <p className="text-gray-300">
                        This is a common problem type for {jobRoles.find(role => role.value === selectedRole).label} interviews.
                      </p>
                      <h4 className="text-gray-100">Hints:</h4>
                      <ol className="text-gray-300 space-y-2">
                        {currentChallenge.hints.map((hint, index) => (
                          <li key={index}>{hint}</li>
                        ))}
                      </ol>
                      
                      <Button onClick={() => setActiveTab('code')} className="mt-4 bg-[#0e639c] hover:bg-[#1177bb] text-white">
                        Start Coding
                      </Button>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="code">
                    <div className="h-[500px] border rounded-md border-[#444444] overflow-hidden">
                      <Editor
                        height="100%"
                        language={selectedRole === 'data_analyst' || selectedRole === 'data_scientist' ? 'python' : 'javascript'}
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
                    <div className="mt-4 flex justify-end">
                      <Button onClick={handleSubmit} disabled={loading} className="bg-[#0e639c] hover:bg-[#1177bb] text-white">
                        {loading ? <Spinner size="sm" className="mr-2" /> : null}
                        Submit Solution
                      </Button>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="feedback">
                    {feedback && (
                      <div className="space-y-6 text-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            {feedback.correct ? (
                              <Badge className="bg-green-900/50 text-green-400 border-green-700 mr-2">
                                <Check className="h-4 w-4 mr-1" />
                                Correct
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="mr-2">
                                Incorrect
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-xs text-gray-300">
                              <span className="font-medium">Runtime:</span> {feedback.runtime}
                            </div>
                            <div className="text-xs text-gray-300">
                              <span className="font-medium">Memory:</span> {feedback.memory}
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <h3 className="text-sm font-medium mb-2 text-gray-100">Code Review</h3>
                          <p className="text-sm text-gray-300">{feedback.feedback}</p>
                        </div>
                        
                        <div>
                          <h3 className="text-sm font-medium mb-2 text-gray-100">Suggestions</h3>
                          <ul className="list-disc list-inside space-y-1">
                            {feedback.suggestions.map((suggestion, index) => (
                              <li key={index} className="text-sm text-gray-300">{suggestion}</li>
                            ))}
                          </ul>
                        </div>
                        
                        <div className="flex justify-end">
                          <Button variant="outline" onClick={() => setActiveTab('code')} className="border-[#444444] text-gray-300 hover:bg-[#333333]">
                            <Code className="h-4 w-4 mr-2" />
                            Continue Editing
                          </Button>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </MonacoCard>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
