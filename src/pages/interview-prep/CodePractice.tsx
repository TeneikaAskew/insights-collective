import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/use-user';
import { supabase } from '@/integrations/supabase/client';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, AlertCircle, Play, History, Code as CodeIcon } from 'lucide-react';
import Editor from '@monaco-editor/react';

interface CodeChallenge {
  id: string;
  title: string;
  prompt: string;
  test_cases: {
    input: string;
    expected_output: string;
  }[];
  topic_tags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

interface CodeAttempt {
  id: string;
  challenge_id: string;
  code: string;
  language: string;
  duration: number;
  passed_tests: boolean;
  ai_review: {
    overall_score: number;
    code_quality_score: number;
    efficiency_score: number;
    readability_score: number;
    strengths: string[];
    areas_for_improvement: string[];
    suggestions: string[];
  };
  created_at: string;
}

const SUPPORTED_LANGUAGES = [
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'java', label: 'Java' },
];

export default function CodePractice() {
  const { toast } = useToast();
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState('practice');
  const [challenges, setChallenges] = useState<CodeChallenge[]>([]);
  const [selectedChallenge, setSelectedChallenge] = useState<CodeChallenge | null>(null);
  const [attempts, setAttempts] = useState<CodeAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('python');
  const [code, setCode] = useState('');
  const [executionResults, setExecutionResults] = useState<{
    passed: boolean;
    results: { input: string; expected: string; actual: string; passed: boolean }[];
  } | null>(null);

  useEffect(() => {
    loadChallenges();
    loadAttempts();
  }, []);

  const loadChallenges = async () => {
    try {
      const { data: studyGuides, error: studyGuidesError } = await supabase
        .from('study_guides')
        .select('technical_checklist')
        .eq('user_id', user?.id);

      if (studyGuidesError) throw studyGuidesError;

      const skills = studyGuides
        .flatMap(guide => guide.technical_checklist)
        .map(item => item.skill);

      const { data: challengeData, error: challengeError } = await supabase
        .from('code_challenges')
        .select('*')
        .in('topic_tags', skills);

      if (challengeError) throw challengeError;

      setChallenges(challengeData);
      if (challengeData.length > 0) {
        setSelectedChallenge(challengeData[0]);
        setCode(getStarterCode(challengeData[0], selectedLanguage));
      }
    } catch (error) {
      console.error('Error loading challenges:', error);
      toast({
        title: 'Error',
        description: 'Failed to load code challenges',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadAttempts = async () => {
    try {
      const { data, error } = await supabase
        .from('code_attempts')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAttempts(data || []);
    } catch (error) {
      console.error('Error loading attempts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load your previous attempts',
        variant: 'destructive',
      });
    }
  };

  const getStarterCode = (challenge: CodeChallenge, language: string) => {
    switch (language) {
      case 'python':
        return `def solution(input):\n    # Write your solution here\n    pass\n`;
      case 'javascript':
      case 'typescript':
        return `function solution(input) {\n    // Write your solution here\n}\n`;
      case 'java':
        return `public class Solution {\n    public static Object solution(Object input) {\n        // Write your solution here\n        return null;\n    }\n}\n`;
      default:
        return '';
    }
  };

  const handleLanguageChange = (value: string) => {
    setSelectedLanguage(value);
    if (selectedChallenge) {
      setCode(getStarterCode(selectedChallenge, value));
    }
  };

  const handleExecute = async () => {
    if (!selectedChallenge) return;

    setIsExecuting(true);
    try {
      // Execute code
      const { data: executionData, error: executionError } = await supabase
        .functions.invoke('execute-code', {
          body: {
            code,
            language: selectedLanguage,
            testCases: selectedChallenge.test_cases,
          }
        });

      if (executionError) throw executionError;

      // Save attempt
      const { data: attemptData, error: attemptError } = await supabase
        .from('code_attempts')
        .insert({
          user_id: user?.id,
          challenge_id: selectedChallenge.id,
          code,
          language: selectedLanguage,
          duration: 0, // TODO: Track duration
          passed_tests: executionData.passed,
        })
        .select()
        .single();

      if (attemptError) throw attemptError;

      // Get AI review
      const { data: reviewData, error: reviewError } = await supabase
        .functions.invoke('review-code', {
          body: { attemptId: attemptData.id }
        });

      if (reviewError) throw reviewError;

      // Update attempts list
      setAttempts(prev => [{ ...attemptData, ai_review: reviewData }, ...prev]);
      setExecutionResults(executionData);

      toast({
        title: executionData.passed ? 'All Tests Passed!' : 'Some Tests Failed',
        description: executionData.passed
          ? 'Great job! Your solution passed all test cases.'
          : 'Review the test results and try again.',
        variant: executionData.passed ? 'default' : 'destructive',
      });
    } catch (error) {
      console.error('Error executing code:', error);
      toast({
        title: 'Execution Error',
        description: 'An error occurred while executing your code',
        variant: 'destructive',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  if (isLoading) {
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

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Code Practice</h1>
        <p className="text-muted-foreground">
          Practice technical coding challenges with real-time feedback.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <TabsList>
          <TabsTrigger value="practice">Practice</TabsTrigger>
          <TabsTrigger value="history">Attempt History</TabsTrigger>
        </TabsList>

        <TabsContent value="practice">
          <div className="space-y-8">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{selectedChallenge?.title || 'No Challenge Selected'}</CardTitle>
                    <CardDescription>
                      {selectedChallenge?.prompt || 'Please analyze a job description to get relevant challenges.'}
                    </CardDescription>
                  </div>
                  {selectedChallenge && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {selectedChallenge.difficulty}
                      </Badge>
                      {selectedChallenge.topic_tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardHeader>
              {selectedChallenge && (
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Select Language" />
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
                        disabled={isExecuting}
                        className="w-[200px]"
                      >
                        {isExecuting ? (
                          <>
                            <Spinner size="sm" className="mr-2" />
                            Running...
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            Run Tests
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="h-[500px] border rounded-md overflow-hidden">
                      <Editor
                        height="100%"
                        defaultLanguage={selectedLanguage}
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

                    {executionResults && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Test Results</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {executionResults.results.map((result, index) => (
                              <div
                                key={index}
                                className={`p-4 rounded-md ${
                                  result.passed
                                    ? 'bg-green-500/10 border border-green-500/20'
                                    : 'bg-red-500/10 border border-red-500/20'
                                }`}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  {result.passed ? (
                                    <Check className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <AlertCircle className="h-4 w-4 text-red-500" />
                                  )}
                                  <span className="font-medium">Test Case {index + 1}</span>
                                </div>
                                <div className="space-y-2 text-sm">
                                  <p>Input: {result.input}</p>
                                  <p>Expected: {result.expected}</p>
                                  <p>Actual: {result.actual}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <div className="space-y-8">
            {attempts.map((attempt) => (
              <Card key={attempt.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>
                        {challenges.find(c => c.id === attempt.challenge_id)?.title}
                      </CardTitle>
                      <CardDescription>
                        Attempted on {new Date(attempt.created_at).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={attempt.passed_tests ? 'default' : 'secondary'}>
                        {attempt.passed_tests ? 'Passed' : 'Failed'}
                      </Badge>
                      <Badge variant="outline">{attempt.language}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="h-[200px] border rounded-md overflow-hidden">
                      <Editor
                        height="100%"
                        defaultLanguage={attempt.language}
                        value={attempt.code}
                        theme="vs-dark"
                        options={{
                          readOnly: true,
                          minimap: { enabled: false },
                          fontSize: 14,
                          lineNumbers: 'on',
                          automaticLayout: true,
                        }}
                      />
                    </div>

                    {attempt.ai_review && (
                      <div className="space-y-4 pt-4 border-t">
                        <h3 className="font-medium">AI Review</h3>
                        
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm font-medium">Code Quality</p>
                            <Badge variant="outline">
                              {attempt.ai_review.code_quality_score}/10
                            </Badge>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Efficiency</p>
                            <Badge variant="outline">
                              {attempt.ai_review.efficiency_score}/10
                            </Badge>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Readability</p>
                            <Badge variant="outline">
                              {attempt.ai_review.readability_score}/10
                            </Badge>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-sm font-medium mb-2">Strengths</h4>
                          <ul className="list-disc list-inside space-y-1">
                            {attempt.ai_review.strengths.map((strength, index) => (
                              <li key={index} className="text-sm text-muted-foreground">
                                {strength}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <h4 className="text-sm font-medium mb-2">Areas for Improvement</h4>
                          <ul className="list-disc list-inside space-y-1">
                            {attempt.ai_review.areas_for_improvement.map((area, index) => (
                              <li key={index} className="text-sm text-muted-foreground">
                                {area}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <h4 className="text-sm font-medium mb-2">Suggestions</h4>
                          <ul className="list-disc list-inside space-y-1">
                            {attempt.ai_review.suggestions.map((suggestion, index) => (
                              <li key={index} className="text-sm text-muted-foreground">
                                {suggestion}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {attempts.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center">
                  <CodeIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    No attempts yet. Start practicing to see your history here.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 