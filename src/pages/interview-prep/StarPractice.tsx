
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/use-user';
import { supabase } from '@/integrations/supabase/client';
import { Spinner } from '@/components/ui/spinner';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Check, AlertCircle, ChevronLeft, ChevronRight, HistoryIcon, RefreshCw } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { LocalStorageUtils } from '@/utils/localStorageUtils';

interface StarResponse {
  id: string;
  question_id: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  ai_feedback: any;
  submitted_at: string;
}

interface Question {
  id: string;
  question: string;
  targetCompetency: string;
  type: 'behavioral' | 'technical';
  preparationTips?: string;
}

export default function StarPractice() {
  const { toast } = useToast();
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState('practice');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [responses, setResponses] = useState<StarResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    situation: '',
    task: '',
    action: '',
    result: '',
  });
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  useEffect(() => {
    if (user) {
      loadQuestions();
      
      // Try to load responses from local storage first
      const cachedResponses = LocalStorageUtils.getStarResponses(user.id);
      if (cachedResponses && cachedResponses.length > 0) {
        console.log('Loaded STAR responses from local storage:', cachedResponses.length);
        setResponses(cachedResponses);
      } else {
        // If nothing in local storage, try to load from database
        loadResponses();
      }
    }
  }, [user]);

  const loadQuestions = async () => {
    try {
      // Try to get study guide from local storage first
      if (user) {
        const cachedStudyGuide = LocalStorageUtils.getStudyGuide(user.id);
        if (cachedStudyGuide && cachedStudyGuide.questions) {
          const behavioralQuestions = cachedStudyGuide.questions.filter(
            (q: any) => q.type === 'behavioral'
          );
          
          if (behavioralQuestions.length > 0) {
            console.log('Loaded questions from local storage study guide');
            setQuestions(behavioralQuestions);
            setSelectedQuestion(behavioralQuestions[0]);
            setIsLoading(false);
            return;
          }
        }
      }

      // Fall back to database if no local storage data
      const { data: studyGuides, error: studyGuidesError } = await supabase
        .from('study_guides')
        .select('questions')
        .eq('user_id', user?.id);

      if (studyGuidesError) throw studyGuidesError;

      const behavioralQuestions = studyGuides
        .flatMap(guide => guide.questions)
        .filter(q => q.type === 'behavioral');

      setQuestions(behavioralQuestions);
      if (behavioralQuestions.length > 0) {
        setSelectedQuestion(behavioralQuestions[0]);
      }
    } catch (error) {
      console.error('Error loading questions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load practice questions',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadResponses = async () => {
    try {
      const { data, error } = await supabase
        .from('star_responses')
        .select('*')
        .eq('user_id', user?.id)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      
      if (data && data.length > 0) {
        setResponses(data);
        // Save to local storage for future use
        if (user) {
          LocalStorageUtils.saveStarResponses(user.id, data);
        }
      }
    } catch (error) {
      console.error('Error loading responses:', error);
      toast({
        title: 'Error',
        description: 'Failed to load your previous responses',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async () => {
    if (!selectedQuestion) return;

    const { situation, task, action, result } = formData;
    if (!situation || !task || !action || !result) {
      toast({
        title: 'Incomplete Response',
        description: 'Please fill out all sections of the STAR response',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Save the response
      const { data: responseData, error: responseError } = await supabase
        .from('star_responses')
        .insert({
          user_id: user?.id,
          question_id: selectedQuestion.id,
          situation,
          task,
          action,
          result,
        })
        .select()
        .single();

      if (responseError) throw responseError;

      // Get AI feedback
      const { data: feedbackData, error: feedbackError } = await supabase
        .functions.invoke('evaluate-star-response', {
          body: { responseId: responseData.id }
        });

      if (feedbackError) throw feedbackError;

      // Add feedback to the response
      const completeResponse = { ...responseData, ai_feedback: feedbackData?.ai_feedback };
      
      // Update responses list
      const updatedResponses = [completeResponse, ...responses];
      setResponses(updatedResponses);
      
      // Save to local storage for future access
      if (user) {
        LocalStorageUtils.saveStarResponses(user.id, updatedResponses);
      }
      
      // Reset form
      setFormData({
        situation: '',
        task: '',
        action: '',
        result: '',
      });

      toast({
        title: 'Response Submitted',
        description: 'Your STAR response has been evaluated',
      });

      // Switch to history tab to show feedback
      setActiveTab('history');
    } catch (error) {
      console.error('Error submitting response:', error);
      toast({
        title: 'Submission Error',
        description: 'An error occurred while submitting your response',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      const nextIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIndex);
      setSelectedQuestion(questions[nextIndex]);
      setFormData({
        situation: '',
        task: '',
        action: '',
        result: '',
      });
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      const prevIndex = currentQuestionIndex - 1;
      setCurrentQuestionIndex(prevIndex);
      setSelectedQuestion(questions[prevIndex]);
      setFormData({
        situation: '',
        task: '',
        action: '',
        result: '',
      });
    }
  };

  const handleClearHistory = () => {
    if (user) {
      // Clear responses from local storage
      window.localStorage.removeItem(`star_responses_${user.id}`);
      setResponses([]);
      toast({
        title: 'History Cleared',
        description: 'Your response history has been cleared',
      });
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="container mx-auto py-8">
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <Spinner size="lg" />
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (questions.length === 0) {
    return (
      <AppLayout>
        <div className="container mx-auto py-8">
          <Card>
            <CardHeader>
              <CardTitle>No Questions Available</CardTitle>
              <CardDescription>
                Please analyze a job description first to get personalized STAR questions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => window.history.push('/interview-prep/job-description')}>
                Analyze Job Description
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">STAR Response Practice</h1>
          <p className="text-muted-foreground">
            Practice answering behavioral interview questions using the STAR method.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="practice">Practice</TabsTrigger>
              <TabsTrigger value="history" disabled={responses.length === 0}>
                Response History
              </TabsTrigger>
            </TabsList>
            
            {responses.length > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleClearHistory}
                className="flex items-center gap-1"
              >
                <RefreshCw className="h-4 w-4" />
                Clear History
              </Button>
            )}
          </div>

          <TabsContent value="practice">
            <div className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle>Question {currentQuestionIndex + 1} of {questions.length}</CardTitle>
                  <CardDescription>
                    Answer the following behavioral question using the STAR method.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedQuestion ? (
                    <div className="space-y-4">
                      <p className="text-lg font-medium">{selectedQuestion.question}</p>
                      <Badge variant="outline">
                        Competency: {selectedQuestion.targetCompetency}
                      </Badge>
                      {selectedQuestion.preparationTips && (
                        <p className="text-sm text-muted-foreground mt-2">
                          Tip: {selectedQuestion.preparationTips}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">
                      No practice questions available. Please analyze a job description first.
                    </p>
                  )}
                </CardContent>
              </Card>

              {selectedQuestion && (
                <Card>
                  <CardHeader>
                    <CardTitle>Your Response</CardTitle>
                    <CardDescription>
                      Structure your answer using the Situation, Task, Action, Result format.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <h3 className="font-medium">Situation</h3>
                      <Textarea
                        placeholder="Describe the situation or context..."
                        value={formData.situation}
                        onChange={(e) => setFormData(prev => ({ ...prev, situation: e.target.value }))}
                        className="min-h-[100px]"
                      />
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-medium">Task</h3>
                      <Textarea
                        placeholder="What was your responsibility or goal..."
                        value={formData.task}
                        onChange={(e) => setFormData(prev => ({ ...prev, task: e.target.value }))}
                        className="min-h-[100px]"
                      />
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-medium">Action</h3>
                      <Textarea
                        placeholder="What steps did you take..."
                        value={formData.action}
                        onChange={(e) => setFormData(prev => ({ ...prev, action: e.target.value }))}
                        className="min-h-[100px]"
                      />
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-medium">Result</h3>
                      <Textarea
                        placeholder="What was the outcome..."
                        value={formData.result}
                        onChange={(e) => setFormData(prev => ({ ...prev, result: e.target.value }))}
                        className="min-h-[100px]"
                      />
                    </div>

                    <div className="flex justify-between items-center pt-4">
                      <Button
                        variant="outline"
                        onClick={handlePrevious}
                        disabled={currentQuestionIndex === 0}
                      >
                        <ChevronLeft className="h-4 w-4 mr-2" />
                        Previous
                      </Button>
                      <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !formData.situation || !formData.task || !formData.action || !formData.result}
                      >
                        {isSubmitting ? <Spinner size="sm" className="mr-2" /> : null}
                        Submit Response
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleNext}
                        disabled={currentQuestionIndex === questions.length - 1}
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="history">
            <div className="space-y-8">
              {responses.map((response) => (
                <Card key={response.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>
                          {questions.find(q => q.id === response.question_id)?.question || 'Behavioral Question'}
                        </CardTitle>
                        <CardDescription>
                          Submitted on {new Date(response.submitted_at).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      {response.ai_feedback && (
                        <div className="flex items-center gap-2">
                          <Badge variant={response.ai_feedback.scores?.overall >= 8 ? 'default' : 'secondary'}>
                            Score: {response.ai_feedback.scores?.overall || 'N/A'}/10
                          </Badge>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <div>
                          <h3 className="font-medium mb-2">Situation</h3>
                          <p className="text-sm">{response.situation}</p>
                        </div>
                        <div>
                          <h3 className="font-medium mb-2">Task</h3>
                          <p className="text-sm">{response.task}</p>
                        </div>
                        <div>
                          <h3 className="font-medium mb-2">Action</h3>
                          <p className="text-sm">{response.action}</p>
                        </div>
                        <div>
                          <h3 className="font-medium mb-2">Result</h3>
                          <p className="text-sm">{response.result}</p>
                        </div>
                      </div>

                      {response.ai_feedback && (
                        <div className="space-y-4 pt-4 border-t">
                          <h3 className="font-medium">AI Feedback</h3>
                          
                          {response.ai_feedback.scores && (
                            <div className="space-y-2">
                              <h4 className="text-sm font-medium mb-2">Component Scores</h4>
                              <div className="space-y-2">
                                <div>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span>Situation</span>
                                    <span>{response.ai_feedback.scores.situation}/10</span>
                                  </div>
                                  <Progress value={response.ai_feedback.scores.situation * 10} />
                                </div>
                                <div>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span>Task</span>
                                    <span>{response.ai_feedback.scores.task}/10</span>
                                  </div>
                                  <Progress value={response.ai_feedback.scores.task * 10} />
                                </div>
                                <div>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span>Action</span>
                                    <span>{response.ai_feedback.scores.action}/10</span>
                                  </div>
                                  <Progress value={response.ai_feedback.scores.action * 10} />
                                </div>
                                <div>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span>Result</span>
                                    <span>{response.ai_feedback.scores.result}/10</span>
                                  </div>
                                  <Progress value={response.ai_feedback.scores.result * 10} />
                                </div>
                                <div>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span className="font-medium">Overall</span>
                                    <span className="font-medium">{response.ai_feedback.scores.overall}/10</span>
                                  </div>
                                  <Progress value={response.ai_feedback.scores.overall * 10} />
                                </div>
                              </div>
                            </div>
                          )}

                          {response.ai_feedback.analysis && (
                            <div>
                              <h4 className="text-sm font-medium mb-2">Analysis</h4>
                              <div className="space-y-2 text-sm">
                                <p><strong>Completeness:</strong> {response.ai_feedback.analysis.completeness}</p>
                                <p><strong>Specificity:</strong> {response.ai_feedback.analysis.specificity}</p>
                                <p><strong>Relevance:</strong> {response.ai_feedback.analysis.relevance}</p>
                                <p><strong>Impact:</strong> {response.ai_feedback.analysis.impact}</p>
                                <p><strong>Communication:</strong> {response.ai_feedback.analysis.communication}</p>
                              </div>
                            </div>
                          )}

                          {response.ai_feedback.feedback && (
                            <>
                              <div>
                                <h4 className="text-sm font-medium mb-2">Strengths</h4>
                                <ul className="list-disc list-inside space-y-1">
                                  {response.ai_feedback.feedback.strengths.map((strength: string, index: number) => (
                                    <li key={index} className="text-sm flex items-start">
                                      <Check className="h-4 w-4 text-green-500 mr-2 mt-1 flex-shrink-0" />
                                      <span>{strength}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <div>
                                <h4 className="text-sm font-medium mb-2">Areas for Improvement</h4>
                                <ul className="list-disc list-inside space-y-1">
                                  {response.ai_feedback.feedback.improvements.map((improvement: string, index: number) => (
                                    <li key={index} className="text-sm flex items-start">
                                      <AlertCircle className="h-4 w-4 text-amber-500 mr-2 mt-1 flex-shrink-0" />
                                      <span>{improvement}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <div>
                                <h4 className="text-sm font-medium mb-2">Suggestions</h4>
                                <ul className="list-disc list-inside space-y-1">
                                  {response.ai_feedback.feedback.suggestions.map((suggestion: string, index: number) => (
                                    <li key={index} className="text-sm">{suggestion}</li>
                                  ))}
                                </ul>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}

              {responses.length === 0 && (
                <Card>
                  <CardContent className="py-8 text-center">
                    <HistoryIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      No responses yet. Start practicing to see your history here.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
