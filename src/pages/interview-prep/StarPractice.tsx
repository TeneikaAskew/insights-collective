
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
import { Check, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { LocalStorageUtils } from '@/utils/localStorageUtils';
import { useSearchParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface StarResponseDraft {
  situation: string;
  task: string;
  action: string;
  result: string;
}

interface STARResponse {
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
  type: 'behavioral' | 'technical';
  question: string;
  targetCompetency: string;
  preparationTips?: string;
}

interface SavedResponse {
  response: Partial<STARResponse>;
  feedback: any;
  timestamp: number;
}

export default function StarPractice() {
  const { toast } = useToast();
  const { user } = useUser();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const targetQuestionId = searchParams.get('questionId');
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [response, setResponse] = useState<Partial<STARResponse>>({
    situation: '',
    task: '',
    action: '',
    result: '',
  });
  const [feedback, setFeedback] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>("question");
  const [savedResponses, setSavedResponses] = useState<Record<string, SavedResponse>>({});

  useEffect(() => {
    if (user) {
      loadQuestions();
      // Load saved responses from localStorage
      const savedResponsesData = LocalStorageUtils.getSavedStarResponses(user.id);
      if (savedResponsesData) {
        setSavedResponses(savedResponsesData);
      }
    } else {
      setLoading(false);
    }
  }, [user]);
  
  useEffect(() => {
    if (!loading && questions.length > 0 && targetQuestionId) {
      findAndSetTargetQuestion(targetQuestionId);
    }
  }, [loading, questions, targetQuestionId]);

  // Save response draft as user types
  useEffect(() => {
    if (user && questions.length > 0) {
      const currentQuestion = questions[currentQuestionIndex];
      if (currentQuestion) {
        LocalStorageUtils.saveStarResponseDraftForQuestion(user.id, currentQuestion.id, response as StarResponseDraft);
      }
    }
  }, [response, currentQuestionIndex, questions, user]);

  const findAndSetTargetQuestion = (questionId: string) => {
    const index = questions.findIndex(q => q.id === questionId);
    if (index !== -1) {
      setCurrentQuestionIndex(index);
      
      // First check if we have a saved response with feedback
      if (user && savedResponses[questionId]) {
        setResponse(savedResponses[questionId].response);
        setFeedback(savedResponses[questionId].feedback);
      } 
      // If no saved response, check for draft
      else if (user) {
        const draft = LocalStorageUtils.getStarResponseDraftForQuestion(user.id, questionId);
        if (draft) {
          setResponse(draft);
        } else {
          // Reset response if no draft is available
          setResponse({
            situation: '',
            task: '',
            action: '',
            result: '',
          });
        }
        setFeedback(null); // Reset feedback when changing questions
      }
    } else if (questions.length > 0) {
      // If questionId not found but we have questions, navigate to the first question
      navigate(`/interview-prep/star-practice?questionId=${questions[0].id}`, { replace: true });
    }
  };

  const loadQuestions = async () => {
    try {
      setLoading(true);
      
      // First check if we have a cached study guide in local storage
      let behavioralQuestions: Question[] = [];
      
      if (user) {
        const cachedStudyGuide = LocalStorageUtils.getStudyGuide(user.id);
        
        if (cachedStudyGuide?.questions) {
          behavioralQuestions = cachedStudyGuide.questions.filter(
            (q: any) => q.type === 'behavioral'
          );
          console.log('Loaded questions from local storage cache:', behavioralQuestions.length);
        }
      }
      
      // If we don't have questions from local storage, try to fetch from database
      if (behavioralQuestions.length === 0 && user) {
        console.log('Fetching questions from database for user:', user.id);
        const { data: studyGuides, error } = await supabase
          .from('study_guides')
          .select('questions')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error) {
          console.error('Error loading questions from database:', error);
        } else if (studyGuides?.questions) {
          behavioralQuestions = studyGuides.questions.filter(
            (q: any) => q.type === 'behavioral'
          );
          console.log('Loaded questions from database:', behavioralQuestions.length);
        }
      }
      
      setQuestions(behavioralQuestions);
      
      // If we have a targeted question ID, find and set it
      if (targetQuestionId && behavioralQuestions.length > 0) {
        findAndSetTargetQuestion(targetQuestionId);
      } 
      // If no question ID specified, but we have questions, navigate to the first one
      else if (behavioralQuestions.length > 0) {
        navigate(`/interview-prep/star-practice?questionId=${behavioralQuestions[0].id}`, { replace: true });
      }
    } catch (error) {
      console.error('Error loading questions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load questions. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;

    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return;

    setSubmitting(true);
    try {
      // Save response
      const { data: savedResponse, error: saveError } = await supabase
        .from('star_responses')
        .insert({
          user_id: user.id,
          question_id: currentQuestion.id,
          ...response,
        })
        .select()
        .single();

      if (saveError) throw saveError;

      // Get AI feedback
      const { data: evaluatedResponse, error: evalError } = await supabase
        .functions.invoke('evaluate-star-response', {
          body: { responseId: savedResponse.id },
        });

      if (evalError) throw evalError;

      const newFeedback = evaluatedResponse.ai_feedback;
      setFeedback(newFeedback);
      
      // Save the response and feedback to localStorage
      const updatedSavedResponses = {
        ...savedResponses,
        [currentQuestion.id]: {
          response: { ...response },
          feedback: newFeedback,
          timestamp: Date.now()
        }
      };
      
      setSavedResponses(updatedSavedResponses);
      LocalStorageUtils.saveSavedStarResponses(user.id, updatedSavedResponses);

      toast({
        title: 'Response Submitted',
        description: 'Your STAR response has been evaluated.',
      });
    } catch (error) {
      console.error('Error submitting response:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit response. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      const nextIndex = currentQuestionIndex + 1;
      const nextQuestionId = questions[nextIndex].id;
      navigate(`/interview-prep/star-practice?questionId=${nextQuestionId}`, { replace: true });
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      const prevIndex = currentQuestionIndex - 1;
      const prevQuestionId = questions[prevIndex].id;
      navigate(`/interview-prep/star-practice?questionId=${prevQuestionId}`, { replace: true });
    }
  };

  if (loading) {
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
              <Button onClick={() => navigate('/interview-prep/job-description')}>
                Go to Job Description Analysis
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const hasSubmittedResponse = feedback !== null;

  return (
    <AppLayout>
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">STAR Response Practice</h1>
          <p className="text-muted-foreground">
            Practice answering behavioral interview questions using the STAR method.
          </p>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Question {currentQuestionIndex + 1} of {questions.length}</CardTitle>
                  <CardDescription>
                    Target Competency: {currentQuestion?.targetCompetency}
                  </CardDescription>
                </div>
                <Badge>{currentQuestion?.type}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">{currentQuestion?.question}</h3>
                  {currentQuestion?.preparationTips && (
                    <p className="text-muted-foreground text-sm">{currentQuestion.preparationTips}</p>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Situation</label>
                    <Textarea
                      placeholder="Describe the situation..."
                      value={response.situation || ''}
                      onChange={(e) => setResponse({ ...response, situation: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">Task</label>
                    <Textarea
                      placeholder="What was your task or goal?"
                      value={response.task || ''}
                      onChange={(e) => setResponse({ ...response, task: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">Action</label>
                    <Textarea
                      placeholder="What actions did you take?"
                      value={response.action || ''}
                      onChange={(e) => setResponse({ ...response, action: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">Result</label>
                    <Textarea
                      placeholder="What were the results?"
                      value={response.result || ''}
                      onChange={(e) => setResponse({ ...response, result: e.target.value })}
                      rows={3}
                    />
                  </div>
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
                    disabled={submitting || !response.situation || !response.task || !response.action || !response.result}
                  >
                    {submitting ? <Spinner size="sm" className="mr-2" /> : null}
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
              </div>
            </CardContent>
          </Card>

          {feedback && (
            <Card id="feedback-section">
              <CardHeader>
                <CardTitle>AI Feedback</CardTitle>
                <CardDescription>Analysis of your STAR response</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-medium mb-2">Component Scores</h3>
                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Situation</span>
                          <span>{feedback.scores.situation}/10</span>
                        </div>
                        <Progress value={feedback.scores.situation * 10} />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Task</span>
                          <span>{feedback.scores.task}/10</span>
                        </div>
                        <Progress value={feedback.scores.task * 10} />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Action</span>
                          <span>{feedback.scores.action}/10</span>
                        </div>
                        <Progress value={feedback.scores.action * 10} />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Result</span>
                          <span>{feedback.scores.result}/10</span>
                        </div>
                        <Progress value={feedback.scores.result * 10} />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">Overall</span>
                          <span className="font-medium">{feedback.scores.overall}/10</span>
                        </div>
                        <Progress value={feedback.scores.overall * 10} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium mb-2">Analysis</h3>
                    <div className="space-y-2 text-sm">
                      <p><strong>Completeness:</strong> {feedback.analysis.completeness}</p>
                      <p><strong>Specificity:</strong> {feedback.analysis.specificity}</p>
                      <p><strong>Relevance:</strong> {feedback.analysis.relevance}</p>
                      <p><strong>Impact:</strong> {feedback.analysis.impact}</p>
                      <p><strong>Communication:</strong> {feedback.analysis.communication}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium mb-2">Strengths</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {feedback.feedback.strengths.map((strength: string, index: number) => (
                        <li key={index} className="text-sm flex items-start">
                          <Check className="h-4 w-4 text-green-500 mr-2 mt-1 flex-shrink-0" />
                          <span>{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium mb-2">Areas for Improvement</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {feedback.feedback.improvements.map((improvement: string, index: number) => (
                        <li key={index} className="text-sm flex items-start">
                          <AlertCircle className="h-4 w-4 text-amber-500 mr-2 mt-1 flex-shrink-0" />
                          <span>{improvement}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium mb-2">Suggestions</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {feedback.feedback.suggestions.map((suggestion: string, index: number) => (
                        <li key={index} className="text-sm">{suggestion}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
