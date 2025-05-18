import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/use-user';
import { supabase } from '@/lib/supabase';
import { Spinner } from '@/components/ui/spinner';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Check, AlertCircle, ChevronLeft, ChevronRight, Play, Code as CodeIcon } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <Spinner size="lg" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (challenges.length === 0) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>No Challenges Available</CardTitle>
            <CardDescription>
              Please analyze a job description first to get relevant coding challenges.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.history.back()}>Go Back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentChallenge = challenges[currentChallengeIndex];

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Code Challenge Practice</h1>
        <p className="text-muted-foreground">
          Practice technical coding challenges with real-time feedback.
        </p>
      </div>

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Challenge {currentChallengeIndex + 1} of {challenges.length}</CardTitle>
                <CardDescription>
                  Topics: {currentChallenge.topic_tags.join(', ')}
                </CardDescription>
              </div>
              <Badge>{currentChallenge.difficulty}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">{currentChallenge.title}</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">{currentChallenge.prompt}</p>
              </div>

              <div className="flex items-center gap-4">
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  onClick={handleExecute}
                  disabled={executing || !code.trim()}
                  className="ml-auto"
                >
                  {executing ? (
                    <Spinner size="sm" className="mr-2" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Run Tests
                </Button>
              </div>

              <div className="border rounded-md">
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
                  <h3 className="text-sm font-medium mb-2">Test Results</h3>
                  <div className="space-y-2">
                    {testResults.map((result, index) => (
                      <div
                        key={index}
                        className={`p-4 rounded-md ${
                          result.passed ? 'bg-green-50' : 'bg-red-50'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {result.passed ? (
                            <Check className="h-5 w-5 text-green-500" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-red-500" />
                          )}
                          <div className="flex-1 text-sm">
                            <p>
                              <strong>Input:</strong> {result.input}
                            </p>
                            <p>
                              <strong>Expected:</strong> {result.expectedOutput}
                            </p>
                            <p>
                              <strong>Actual:</strong> {result.actualOutput}
                            </p>
                            <p className="text-xs text-muted-foreground">
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
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={handleNext}
                  disabled={currentChallengeIndex === challenges.length - 1}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {review && (
          <Card>
            <CardHeader>
              <CardTitle>AI Code Review</CardTitle>
              <CardDescription>Analysis of your solution</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium mb-2">Scores</h3>
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Correctness</span>
                        <span>{review.scores.correctness}/10</span>
                      </div>
                      <Progress value={review.scores.correctness * 10} />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Efficiency</span>
                        <span>{review.scores.efficiency}/10</span>
                      </div>
                      <Progress value={review.scores.efficiency * 10} />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Style</span>
                        <span>{review.scores.style}/10</span>
                      </div>
                      <Progress value={review.scores.style * 10} />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">Overall</span>
                        <span className="font-medium">{review.scores.overall}/10</span>
                      </div>
                      <Progress value={review.scores.overall * 10} />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">Analysis</h3>
                  <div className="space-y-2 text-sm">
                    <p><strong>Correctness:</strong> {review.analysis.correctness}</p>
                    <p><strong>Time Complexity:</strong> {review.analysis.complexity.time}</p>
                    <p><strong>Space Complexity:</strong> {review.analysis.complexity.space}</p>
                    <p><strong>Code Style:</strong> {review.analysis.style}</p>
                    <p><strong>Maintainability:</strong> {review.analysis.maintainability}</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">Strengths</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {review.feedback.strengths.map((strength: string, index: number) => (
                      <li key={index} className="text-sm flex items-start">
                        <Check className="h-4 w-4 text-green-500 mr-2 mt-1 flex-shrink-0" />
                        <span>{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">Improvements</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {review.feedback.improvements.map((improvement: string, index: number) => (
                      <li key={index} className="text-sm flex items-start">
                        <AlertCircle className="h-4 w-4 text-amber-500 mr-2 mt-1 flex-shrink-0" />
                        <span>{improvement}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">Alternative Approaches</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {review.feedback.alternative_approaches.map((approach: string, index: number) => (
                      <li key={index} className="text-sm flex items-start">
                        <CodeIcon className="h-4 w-4 text-blue-500 mr-2 mt-1 flex-shrink-0" />
                        <span>{approach}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
} 