
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/use-user';
import { supabase } from '@/integrations/supabase/client';
import { Spinner } from '@/components/ui/spinner';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Check, AlertCircle, ChevronLeft, ChevronRight, Play, Code as CodeIcon } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MonacoThemeProvider, MonacoCard } from '@/components/ui/theme-monaco';

interface CodeChallenge {
  id: string;
  title: string;
  prompt: string;
  test_cases: {
    input: string;
    setup?: string;
    expectedOutput: string;
  }[];
  topic_tags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

interface TestResult {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  executionTime: number;
}

const SUPPORTED_LANGUAGES = [
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
];

const STARTER_CODE = {
  python: `def solution():
    # Your code here
    pass`,
  javascript: `function solution() {
    // Your code here
}`,
};

export default function CodePractice() {
  const { toast } = useToast();
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [challenges, setChallenges] = useState<CodeChallenge[]>([]);
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState(STARTER_CODE.python);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [review, setReview] = useState<any>(null);
  // Default tab set to 'code' instead of 'question'
  const [activeTab, setActiveTab] = useState('code');

  useEffect(() => {
    loadChallenges();
  }, []);

  useEffect(() => {
    // Reset code when language changes
    setCode(STARTER_CODE[language as keyof typeof STARTER_CODE]);
  }, [language]);

  const loadChallenges = async () => {
    try {
      const { data: studyGuide, error: studyError } = await supabase
        .from('study_guides')
        .select('technical_checklist')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (studyError) throw studyError;

      const topics = studyGuide?.technical_checklist?.map((item: any) => item.topic) || [];

      const { data: challenges, error: challengeError } = await supabase
        .from('code_challenges')
        .select('*')
        .contains('topic_tags', topics)
        .order('difficulty', { ascending: true });

      if (challengeError) throw challengeError;

      setChallenges(challenges || []);
    } catch (error) {
      console.error('Error loading challenges:', error);
      toast({
        title: 'Error',
        description: 'Failed to load challenges. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!user) return;

    const currentChallenge = challenges[currentChallengeIndex];
    if (!currentChallenge) return;

    setExecuting(true);
    try {
      // Execute code
      const { data: executionResult, error: execError } = await supabase
        .functions.invoke('execute-code', {
          body: {
            challengeId: currentChallenge.id,
            code,
            language,
          },
        });

      if (execError) throw execError;

      setTestResults(executionResult.results);

      if (executionResult.allTestsPassed) {
        // Get AI review
        const { data: reviewResult, error: reviewError } = await supabase
          .functions.invoke('review-code', {
            body: { attemptId: executionResult.attempt.id },
          });

        if (reviewError) throw reviewError;

        setReview(reviewResult.ai_review);
      }

      toast({
        title: executionResult.allTestsPassed ? 'All Tests Passed!' : 'Some Tests Failed',
        description: executionResult.allTestsPassed
          ? 'Your solution has been reviewed by AI.'
          : 'Check the test results and try again.',
        variant: executionResult.allTestsPassed ? 'default' : 'destructive',
      });
    } catch (error) {
      console.error('Error executing code:', error);
      toast({
        title: 'Error',
        description: 'Failed to execute code. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setExecuting(false);
    }
  };

  const handleNext = () => {
    if (currentChallengeIndex < challenges.length - 1) {
      setCurrentChallengeIndex(currentChallengeIndex + 1);
      setCode(STARTER_CODE[language as keyof typeof STARTER_CODE]);
      setTestResults([]);
      setReview(null);
    }
  };

  const handlePrevious = () => {
    if (currentChallengeIndex > 0) {
      setCurrentChallengeIndex(currentChallengeIndex - 1);
      setCode(STARTER_CODE[language as keyof typeof STARTER_CODE]);
      setTestResults([]);
      setReview(null);
    }
  };

  if (loading) {
    return (
      <MonacoThemeProvider>
        <div className="container mx-auto py-8 px-4">
          <MonacoCard>
            <div className="flex items-center justify-center py-8">
              <Spinner size="lg" className="text-gray-300" />
            </div>
          </MonacoCard>
        </div>
      </MonacoThemeProvider>
    );
  }

  if (challenges.length === 0) {
    return (
      <MonacoThemeProvider>
        <div className="container mx-auto py-8 px-4">
          <MonacoCard>
            <CardHeader>
              <CardTitle className="text-gray-100">No Challenges Available</CardTitle>
              <CardDescription className="text-gray-400">
                Please analyze a job description first to get relevant coding challenges.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => window.history.back()}>Go Back</Button>
            </CardContent>
          </MonacoCard>
        </div>
      </MonacoThemeProvider>
    );
  }

  const currentChallenge = challenges[currentChallengeIndex];

  return (
    <MonacoThemeProvider>
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-gray-100">Code Challenge Practice</h1>
          <p className="text-gray-400">
            Practice technical coding challenges with real-time feedback.
          </p>
        </div>

        <div className="space-y-8">
          <MonacoCard>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle className="text-gray-100">Challenge {currentChallengeIndex + 1} of {challenges.length}</CardTitle>
                  <CardDescription className="text-gray-400">
                    Topics: {currentChallenge.topic_tags.join(', ')}
                  </CardDescription>
                </div>
                <Badge className="bg-[#4d4d4d] text-gray-100 hover:bg-[#5a5a5a]">{currentChallenge.difficulty}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2 text-gray-100">{currentChallenge.title}</h3>
                  <p className="text-gray-300 whitespace-pre-wrap overflow-auto max-h-[200px] custom-scrollbar">{currentChallenge.prompt}</p>
                  
                  <div className="mt-4 p-3 bg-[#2d2d2d] rounded-md border border-[#444444]">
                    <h4 className="font-medium text-sm text-gray-200 mb-2">Example Test Cases:</h4>
                    <div className="space-y-2 text-xs text-gray-300 overflow-auto max-h-[150px] custom-scrollbar">
                      {currentChallenge.test_cases.map((test, idx) => (
                        <div key={idx} className="p-2 bg-[#333333] rounded border border-[#555555]">
                          <div><span className="font-medium">Input:</span> {test.input}</div>
                          <div><span className="font-medium">Expected:</span> {test.expectedOutput}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="w-40 bg-[#333333] border-[#444444] text-gray-200">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#333333] border-[#444444] text-gray-200">
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <SelectItem key={lang.value} value={lang.value} className="hover:bg-[#444444]">
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    onClick={handleExecute}
                    disabled={executing || !code.trim()}
                    className="ml-auto bg-[#0e639c] hover:bg-[#1177bb] text-white"
                  >
                    {executing ? (
                      <Spinner size="sm" className="mr-2" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    Run Tests
                  </Button>
                </div>

                <div className="border rounded-md border-[#444444] overflow-hidden">
                  <Editor
                    height="400px"
                    language={language}
                    value={code}
                    onChange={(value) => setCode(value || '')}
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      lineNumbers: 'on',
                      automaticLayout: true,
                    }}
                  />
                </div>

                {testResults.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-2 text-gray-200">Test Results</h3>
                    <div className="space-y-2 max-h-[300px] overflow-auto custom-scrollbar pr-2">
                      {testResults.map((result, index) => (
                        <div
                          key={index}
                          className={`p-4 rounded-md ${
                            result.passed ? 'bg-green-900/20' : 'bg-red-900/20'
                          } border ${result.passed ? 'border-green-700' : 'border-red-700'}`}
                        >
                          <div className="flex items-start gap-2">
                            {result.passed ? (
                              <Check className="h-5 w-5 text-green-500" />
                            ) : (
                              <AlertCircle className="h-5 w-5 text-red-500" />
                            )}
                            <div className="flex-1 text-sm">
                              <p className="text-gray-300">
                                <strong>Input:</strong> {result.input}
                              </p>
                              <p className="text-gray-300">
                                <strong>Expected:</strong> {result.expectedOutput}
                              </p>
                              <p className="text-gray-300">
                                <strong>Actual:</strong> {result.actualOutput}
                              </p>
                              <p className="text-xs text-gray-400">
                                Execution time: {result.executionTime}ms
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center pt-4">
                  <Button
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={currentChallengeIndex === 0}
                    className="border-[#444444] text-gray-300 hover:bg-[#333333] hover:text-gray-100"
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleNext}
                    disabled={currentChallengeIndex === challenges.length - 1}
                    className="border-[#444444] text-gray-300 hover:bg-[#333333] hover:text-gray-100"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </MonacoCard>

          {review && (
            <MonacoCard>
              <CardHeader>
                <CardTitle className="text-gray-100">AI Code Review</CardTitle>
                <CardDescription className="text-gray-400">Analysis of your solution</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-medium mb-2 text-gray-200">Scores</h3>
                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-300">Correctness</span>
                          <span className="text-gray-300">{review.scores.correctness}/10</span>
                        </div>
                        <Progress 
                          value={review.scores.correctness * 10} 
                          className="bg-[#333333]"
                          indicatorClassName="bg-[#0e639c]"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-300">Efficiency</span>
                          <span className="text-gray-300">{review.scores.efficiency}/10</span>
                        </div>
                        <Progress 
                          value={review.scores.efficiency * 10} 
                          className="bg-[#333333]"
                          indicatorClassName="bg-[#0e639c]"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-300">Style</span>
                          <span className="text-gray-300">{review.scores.style}/10</span>
                        </div>
                        <Progress 
                          value={review.scores.style * 10} 
                          className="bg-[#333333]"
                          indicatorClassName="bg-[#0e639c]"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-200">Overall</span>
                          <span className="font-medium text-gray-200">{review.scores.overall}/10</span>
                        </div>
                        <Progress 
                          value={review.scores.overall * 10} 
                          className="bg-[#333333]"
                          indicatorClassName="bg-[#0e639c]"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium mb-2 text-gray-200">Analysis</h3>
                    <div className="space-y-2 text-sm text-gray-300">
                      <p><strong>Correctness:</strong> {review.analysis.correctness}</p>
                      <p><strong>Time Complexity:</strong> {review.analysis.complexity.time}</p>
                      <p><strong>Space Complexity:</strong> {review.analysis.complexity.space}</p>
                      <p><strong>Code Style:</strong> {review.analysis.style}</p>
                      <p><strong>Maintainability:</strong> {review.analysis.maintainability}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium mb-2 text-gray-200">Strengths</h3>
                    <ul className="space-y-1 max-h-[200px] overflow-auto custom-scrollbar pr-2">
                      {review.feedback.strengths.map((strength: string, index: number) => (
                        <li key={index} className="text-sm flex items-start">
                          <Check className="h-4 w-4 text-green-500 mr-2 mt-1 flex-shrink-0" />
                          <span className="text-gray-300">{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium mb-2 text-gray-200">Improvements</h3>
                    <ul className="space-y-1 max-h-[200px] overflow-auto custom-scrollbar pr-2">
                      {review.feedback.improvements.map((improvement: string, index: number) => (
                        <li key={index} className="text-sm flex items-start">
                          <AlertCircle className="h-4 w-4 text-amber-500 mr-2 mt-1 flex-shrink-0" />
                          <span className="text-gray-300">{improvement}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium mb-2 text-gray-200">Alternative Approaches</h3>
                    <ul className="space-y-1 max-h-[200px] overflow-auto custom-scrollbar pr-2">
                      {review.feedback.alternative_approaches.map((approach: string, index: number) => (
                        <li key={index} className="text-sm flex items-start">
                          <CodeIcon className="h-4 w-4 text-blue-500 mr-2 mt-1 flex-shrink-0" />
                          <span className="text-gray-300">{approach}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </MonacoCard>
          )}
        </div>
      </div>
    </MonacoThemeProvider>
  );
}
