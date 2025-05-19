
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
import { Check, AlertCircle, ChevronLeft, ChevronRight, RotateCw, Star, ArrowLeft } from 'lucide-react';
import { LocalStorageUtils } from '@/utils/localStorageUtils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import '../../../src/components/interview-prep/flashcard.css';

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
  preparationTips: string;
}

export default function StarPractice() {
  const { toast } = useToast();
  const { user } = useUser();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const questionId = searchParams.get('questionId');
  
  // State variables
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
  const [isFlipped, setIsFlipped] = useState(false);
  const [currentStarStep, setCurrentStarStep] = useState<'situation' | 'task' | 'action' | 'result'>('situation');
  const [hasSubmittedResponse, setHasSubmittedResponse] = useState(false);
  
  // Fix the localStorage usage with proper methods
  const [streak, setStreak] = useState(() => {
    try {
      return parseInt(localStorage.getItem('starPracticeStreak') || '0', 10);
    } catch (e) {
      console.error('Error accessing localStorage for streak:', e);
      return 0;
    }
  });
  
  const [lastPracticeDate, setLastPracticeDate] = useState(() => {
    try {
      return localStorage.getItem('starPracticeLastDate') || '';
    } catch (e) {
      console.error('Error accessing localStorage for last practice date:', e);
      return '';
    }
  });

  // Set up effect to load questions when component mounts
  useEffect(() => {
    loadQuestions();
    checkAndUpdateStreak();
  }, [user]);

  // Set initial question index based on URL parameter if available
  useEffect(() => {
    if (questionId && questions.length > 0) {
      const index = questions.findIndex(q => q.id === questionId);
      if (index !== -1) {
        setCurrentQuestionIndex(index);
      }
    }
  }, [questionId, questions]);

  // Load saved responses for the current question whenever it changes
  useEffect(() => {
    if (user?.id && questions.length > 0) {
      loadSavedResponse();
    }
  }, [currentQuestionIndex, questions, user]);

  const checkAndUpdateStreak = () => {
    const today = new Date().toLocaleDateString();
    
    if (lastPracticeDate && lastPracticeDate !== today) {
      const lastDate = new Date(lastPracticeDate);
      const currentDate = new Date(today);
      
      // Check if the last practice was yesterday
      const timeDiff = currentDate.getTime() - lastDate.getTime();
      const daysDiff = timeDiff / (1000 * 3600 * 24);
      
      if (daysDiff > 1.5) {
        // Reset streak if more than 1.5 days have passed (to account for time zones)
        setStreak(1);
      } else if (daysDiff >= 0.5) {
        // Increment streak if it's a new day
        setStreak(prev => prev + 1);
      }
    } else if (!lastPracticeDate) {
      // First time practicing
      setStreak(1);
    }
    
    // Update localStorage
    try {
      // Update last practice date
      setLastPracticeDate(today);
      localStorage.setItem('starPracticeLastDate', today);
      localStorage.setItem('starPracticeStreak', streak.toString());
    } catch (e) {
      console.error('Error saving to localStorage:', e);
    }
  };

  const loadQuestions = async () => {
    if (!user?.id) {
      console.log("User ID is undefined, cannot load questions");
      setLoading(false);
      return;
    }

    try {
      console.log("Loading study guides for user:", user.id);
      
      const { data: studyGuides, error } = await supabase
        .from('study_guides')
        .select('questions')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;

      if (studyGuides?.questions) {
        const behavioralQuestions = studyGuides.questions.filter(
          (q: any) => q.type === 'behavioral'
        );
        setQuestions(behavioralQuestions);
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

  const loadSavedResponse = () => {
    if (!user?.id || questions.length === 0) return;
    
    try {
      const currentQuestion = questions[currentQuestionIndex];
      const savedDraft = LocalStorageUtils.getStarResponseDraftForQuestion(user.id, currentQuestion.id);
      
      if (savedDraft) {
        console.log("Loading saved draft for question:", currentQuestion.id);
        setResponse(savedDraft);
      } else {
        // Reset to empty response if no saved draft exists
        setResponse({
          situation: '',
          task: '',
          action: '',
          result: '',
        });
      }
      
      // Reset feedback and flip state
      setFeedback(null);
      setIsFlipped(false);
      setHasSubmittedResponse(false);
      
    } catch (error) {
      console.error('Error loading saved response:', error);
    }
  };

  const saveResponseDraft = () => {
    if (!user?.id || questions.length === 0) return;
    
    try {
      const currentQuestion = questions[currentQuestionIndex];
      LocalStorageUtils.saveStarResponseDraftForQuestion(user.id, currentQuestion.id, response as any);
    } catch (error) {
      console.error('Error saving response draft:', error);
    }
  };

  const handleSubmit = async () => {
    if (!user || questions.length === 0) return;

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
      
      if (evaluatedResponse && evaluatedResponse.ai_feedback) {
        setFeedback(evaluatedResponse.ai_feedback);
        
        // Also save the feedback to localStorage
        if (user.id) {
          const allResponses = LocalStorageUtils.getSavedStarResponses(user.id) || {};
          allResponses[currentQuestion.id] = {
            response: response,
            feedback: evaluatedResponse.ai_feedback,
            timestamp: new Date().getTime()
          };
          LocalStorageUtils.saveSavedStarResponses(user.id, allResponses);
        }
        
        setIsFlipped(true);
        setHasSubmittedResponse(true);
        toast({
          title: 'Response Submitted',
          description: 'Your STAR response has been evaluated.',
        });
      } else {
        throw new Error("No feedback received from evaluation");
      }
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

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      // Save current response before moving
      saveResponseDraft();
      
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setCurrentStarStep('situation');
      
      // The loadSavedResponse will be triggered by the useEffect
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      // Save current response before moving
      saveResponseDraft();
      
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setCurrentStarStep('situation');
      
      // The loadSavedResponse will be triggered by the useEffect
    }
  };

  const handleBackToInterviewPrep = () => {
    // Save current response before navigating away
    saveResponseDraft();
    navigate('/interview-prep');
  };

  const getStepTip = (step: 'situation' | 'task' | 'action' | 'result') => {
    switch (step) {
      case 'situation':
        return "Set the scene with specific details about when and where. Be concise but descriptive.";
      case 'task':
        return "Explain your responsibility or goal in this situation. What needed to be accomplished?";
      case 'action':
        return "Detail the specific steps you took. Use 'I' statements to highlight your contribution.";
      case 'result':
        return "Share measurable outcomes and what you learned. Quantify results when possible.";
    }
  };

  const moveToNextStep = () => {
    // Save response draft when moving between steps
    saveResponseDraft();
    
    switch (currentStarStep) {
      case 'situation':
        setCurrentStarStep('task');
        break;
      case 'task':
        setCurrentStarStep('action');
        break;
      case 'action':
        setCurrentStarStep('result');
        break;
      case 'result':
        // Ready to submit
        break;
    }
  };

  const moveToPreviousStep = () => {
    switch (currentStarStep) {
      case 'task':
        setCurrentStarStep('situation');
        break;
      case 'action':
        setCurrentStarStep('task');
        break;
      case 'result':
        setCurrentStarStep('action');
        break;
      case 'situation':
        // Already at first step
        break;
    }
  };

  const allStepsFilled = () => {
    return Boolean(
      response.situation?.trim() && 
      response.task?.trim() && 
      response.action?.trim() && 
      response.result?.trim()
    );
  };

  const currentStepFilled = () => {
    return Boolean(response[currentStarStep]?.trim());
  };

  // Save response when input changes
  const handleResponseChange = (field: 'situation' | 'task' | 'action' | 'result', value: string) => {
    const updatedResponse = { ...response, [field]: value };
    setResponse(updatedResponse);
    
    // Debounce the save - in a real app, you might want to use a proper debounce function
    if (user?.id && questions[currentQuestionIndex]) {
      const timeoutId = setTimeout(() => {
        LocalStorageUtils.saveStarResponseDraftForQuestion(
          user.id, 
          questions[currentQuestionIndex].id, 
          updatedResponse as any
        );
      }, 1000);
      
      return () => clearTimeout(timeoutId);
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
              <Button onClick={handleBackToInterviewPrep}>Go Back</Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const starStepIndex = ['situation', 'task', 'action', 'result'].indexOf(currentStarStep);
  const progressPercentage = ((starStepIndex + 1) / 4) * 100;

  return (
    <AppLayout>
      <div className="container mx-auto py-8">
        <div className="flex items-center mb-6">
          <Button variant="ghost" onClick={handleBackToInterviewPrep} className="mr-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">STAR Response Practice</h1>
            <p className="text-muted-foreground">
              Practice answering behavioral interview questions using the STAR method.
            </p>
          </div>
        </div>

        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <Badge variant="outline" className="mr-2">Question {currentQuestionIndex + 1} of {questions.length}</Badge>
            <Badge>{currentQuestion.type}</Badge>
          </div>
          <div className="flex items-center">
            <Star className="h-4 w-4 text-yellow-400 mr-1" />
            <span className="font-medium">Streak: {streak} day{streak !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className="space-y-6">
          <div className="perspective-1000" style={{ minHeight: '500px' }}>
            <div className={`relative w-full h-full ${isFlipped ? 'card-flip-enter-active' : 'card-flip-exit-active'}`}>
              {/* Front side of the card (Question) */}
              <div className={`absolute w-full h-full backface-hidden ${isFlipped ? 'hidden' : ''}`}>
                <Card className="h-full">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Question: {currentQuestion.question}</CardTitle>
                        <CardDescription>
                          Target Competency: {currentQuestion.targetCompetency}
                        </CardDescription>
                      </div>
                      
                      {/* Flip button */}
                      {hasSubmittedResponse && (
                        <Button 
                          variant="secondary" 
                          size="sm"
                          onClick={handleFlip}
                          className="gap-1"
                        >
                          <RotateCw className="h-4 w-4 mr-1" />
                          View Feedback
                        </Button>
                      )}
                    </div>
                    {!isFlipped && !hasSubmittedResponse && (
                      <div>
                        <div className="flex justify-between text-sm mt-2 mb-1">
                          <span>STAR Progress</span>
                          <span>{currentStarStep.charAt(0).toUpperCase() + currentStarStep.slice(1)}</span>
                        </div>
                        <Progress value={progressPercentage} />
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    {!hasSubmittedResponse ? (
                      <div className="space-y-4">
                        {currentStarStep === 'situation' && (
                          <div className="space-y-2">
                            <label className="text-lg font-medium flex items-center">
                              Situation
                              <span className="text-sm font-normal text-muted-foreground ml-2">
                                (Where and when did this happen?)
                              </span>
                            </label>
                            <p className="text-sm text-muted-foreground mb-1">{getStepTip('situation')}</p>
                            <Textarea
                              placeholder="Describe the situation..."
                              value={response.situation}
                              onChange={(e) => handleResponseChange('situation', e.target.value)}
                              rows={5}
                              className="w-full"
                            />
                          </div>
                        )}

                        {currentStarStep === 'task' && (
                          <div className="space-y-2">
                            <label className="text-lg font-medium flex items-center">
                              Task
                              <span className="text-sm font-normal text-muted-foreground ml-2">
                                (What was your responsibility?)
                              </span>
                            </label>
                            <p className="text-sm text-muted-foreground mb-1">{getStepTip('task')}</p>
                            <Textarea
                              placeholder="What was your task or goal?"
                              value={response.task}
                              onChange={(e) => handleResponseChange('task', e.target.value)}
                              rows={5}
                              className="w-full"
                            />
                          </div>
                        )}

                        {currentStarStep === 'action' && (
                          <div className="space-y-2">
                            <label className="text-lg font-medium flex items-center">
                              Action
                              <span className="text-sm font-normal text-muted-foreground ml-2">
                                (What did you do?)
                              </span>
                            </label>
                            <p className="text-sm text-muted-foreground mb-1">{getStepTip('action')}</p>
                            <Textarea
                              placeholder="What actions did you take?"
                              value={response.action}
                              onChange={(e) => handleResponseChange('action', e.target.value)}
                              rows={5}
                              className="w-full"
                            />
                          </div>
                        )}

                        {currentStarStep === 'result' && (
                          <div className="space-y-2">
                            <label className="text-lg font-medium flex items-center">
                              Result
                              <span className="text-sm font-normal text-muted-foreground ml-2">
                                (What was the outcome?)
                              </span>
                            </label>
                            <p className="text-sm text-muted-foreground mb-1">{getStepTip('result')}</p>
                            <Textarea
                              placeholder="What were the results?"
                              value={response.result}
                              onChange={(e) => handleResponseChange('result', e.target.value)}
                              rows={5}
                              className="w-full"
                            />
                          </div>
                        )}

                        <div className="flex justify-between pt-4">
                          <Button
                            variant="outline"
                            onClick={moveToPreviousStep}
                            disabled={currentStarStep === 'situation'}
                          >
                            <ChevronLeft className="h-4 w-4 mr-2" />
                            Previous
                          </Button>
                          
                          {currentStarStep === 'result' ? (
                            <Button
                              onClick={handleSubmit}
                              disabled={submitting || !allStepsFilled()}
                            >
                              {submitting ? <Spinner size="sm" className="mr-2" /> : null}
                              Submit Response
                            </Button>
                          ) : (
                            <Button
                              onClick={moveToNextStep}
                              disabled={!currentStepFilled()}
                            >
                              Next
                              <ChevronRight className="h-4 w-4 ml-2" />
                            </Button>
                          )}
                        </div>
                        
                        <div className="flex justify-between items-center pt-4">
                          <Button
                            variant="ghost"
                            onClick={handlePrevious}
                            disabled={currentQuestionIndex === 0}
                            size="sm"
                          >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Previous Question
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={handleNext}
                            disabled={currentQuestionIndex === questions.length - 1}
                            size="sm"
                          >
                            Next Question
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-3">
                          <div>
                            <h3 className="font-medium">Situation</h3>
                            <p className="text-sm">{response.situation}</p>
                          </div>
                          <div>
                            <h3 className="font-medium">Task</h3>
                            <p className="text-sm">{response.task}</p>
                          </div>
                          <div>
                            <h3 className="font-medium">Action</h3>
                            <p className="text-sm">{response.action}</p>
                          </div>
                          <div>
                            <h3 className="font-medium">Result</h3>
                            <p className="text-sm">{response.result}</p>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-4">
                          <Button
                            variant="ghost"
                            onClick={handlePrevious}
                            disabled={currentQuestionIndex === 0}
                            size="sm"
                          >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Previous Question
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={handleNext}
                            disabled={currentQuestionIndex === questions.length - 1}
                            size="sm"
                          >
                            Next Question
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Back side of the card (Feedback) */}
              <div className={`absolute w-full h-full backface-hidden transform rotate-y-180 ${!isFlipped ? 'hidden' : ''}`}>
                {feedback && (
                  <Card className="h-full overflow-auto">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>AI Feedback</CardTitle>
                          <CardDescription>Analysis of your STAR response</CardDescription>
                        </div>
                        
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleFlip}
                          className="gap-1"
                        >
                          <RotateCw className="h-4 w-4 mr-1" />
                          Back to Question
                        </Button>
                      </div>
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
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
