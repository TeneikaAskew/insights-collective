
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
      console.log("Initializing streak from localStorage");
      const streakValue = localStorage.getItem('starPracticeStreak');
      console.log("Found streak value:", streakValue);
      return parseInt(streakValue || '0', 10);
    } catch (e) {
      console.error('Error accessing localStorage for streak:', e);
      return 0;
    }
  });
  
  const [lastPracticeDate, setLastPracticeDate] = useState(() => {
    try {
      console.log("Initializing lastPracticeDate from localStorage");
      const dateValue = localStorage.getItem('starPracticeLastDate');
      console.log("Found lastPracticeDate value:", dateValue);
      return dateValue || '';
    } catch (e) {
      console.error('Error accessing localStorage for last practice date:', e);
      return '';
    }
  });

  // Set up effect to load questions when component mounts
  useEffect(() => {
    console.log("Component mounted, loading questions for user:", user?.id);
    loadQuestions();
    checkAndUpdateStreak();
  }, [user]);

  // Set initial question index based on URL parameter if available
  useEffect(() => {
    if (questionId && questions.length > 0) {
      console.log("URL contains questionId:", questionId, "looking for matching question");
      const index = questions.findIndex(q => q.id === questionId);
      if (index !== -1) {
        console.log(`Found matching question at index ${index}, setting currentQuestionIndex`);
        setCurrentQuestionIndex(index);
      } else {
        console.log("No matching question found for questionId:", questionId);
      }
    }
  }, [questionId, questions]);

  // Load saved responses for the current question whenever it changes
  useEffect(() => {
    if (user?.id && questions.length > 0) {
      console.log("Current question changed or questions loaded, loading saved response");
      loadSavedResponse();
    }
  }, [currentQuestionIndex, questions, user]);

  const checkAndUpdateStreak = () => {
    const today = new Date().toLocaleDateString();
    console.log("Checking streak. Last practice date:", lastPracticeDate, "Today:", today);
    
    if (lastPracticeDate && lastPracticeDate !== today) {
      const lastDate = new Date(lastPracticeDate);
      const currentDate = new Date(today);
      
      // Check if the last practice was yesterday
      const timeDiff = currentDate.getTime() - lastDate.getTime();
      const daysDiff = timeDiff / (1000 * 3600 * 24);
      console.log("Days difference:", daysDiff);
      
      if (daysDiff > 1.5) {
        // Reset streak if more than 1.5 days have passed (to account for time zones)
        console.log("More than 1.5 days passed, resetting streak to 1");
        setStreak(1);
      } else if (daysDiff >= 0.5) {
        // Increment streak if it's a new day
        console.log("New day detected, incrementing streak");
        setStreak(prev => prev + 1);
      }
    } else if (!lastPracticeDate) {
      // First time practicing
      console.log("First time practicing, setting streak to 1");
      setStreak(1);
    }
    
    // Update localStorage
    try {
      // Update last practice date
      console.log("Updating localStorage with new streak:", streak, "and date:", today);
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

      console.log("Study guides loaded:", studyGuides);

      if (studyGuides?.questions) {
        const behavioralQuestions = studyGuides.questions.filter(
          (q: any) => q.type === 'behavioral'
        );
        console.log("Filtered behavioral questions:", behavioralQuestions);
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

  const loadSavedResponse = async () => {
    if (!user?.id || questions.length === 0) return;
    
    try {
      const currentQuestion = questions[currentQuestionIndex];
      console.log("[StarPractice] Loading saved response for question:", currentQuestion.id);
      
      // First check localStorage for saved responses with feedback
      const savedResponses = LocalStorageUtils.getSavedStarResponses(user.id);
      console.log("[StarPractice] Saved responses from localStorage:", savedResponses);
      if (savedResponses && savedResponses[currentQuestion.id]) {
        const savedData = savedResponses[currentQuestion.id];
        console.log("[StarPractice] Found saved response with feedback in localStorage:", savedData);
        setResponse(savedData.response);
        setFeedback(savedData.feedback);
        setHasSubmittedResponse(true);
        setIsFlipped(false);
        return;
      }
      
      // If no saved response with feedback found, check for draft
      console.log("[StarPractice] No saved response with feedback found, checking for draft");
      const savedDraft = LocalStorageUtils.getStarResponseDraftForQuestion(user.id, currentQuestion.id);
      console.log("[StarPractice] Draft found:", savedDraft);
      if (savedDraft) {
        setResponse(savedDraft);
        setHasSubmittedResponse(false);
        setFeedback(null);
        setIsFlipped(false);
        return;
      }
      
      // As a last resort, check the database for any submitted response
      console.log("[StarPractice] No response found in localStorage, checking database");
      const { data: dbResponses, error } = await supabase
        .from('star_responses')
        .select('*')
        .eq('user_id', user.id)
        .eq('question_id', currentQuestion.id)
        .order('submitted_at', { ascending: false })
        .limit(1);
        
      if (error) {
        console.error("[StarPractice] Error fetching responses from database:", error);
      } else if (dbResponses && dbResponses.length > 0) {
        console.log("[StarPractice] Found response in database:", dbResponses[0]);
        setResponse({
          situation: dbResponses[0].situation,
          task: dbResponses[0].task,
          action: dbResponses[0].action,
          result: dbResponses[0].result,
        });
        
        if (dbResponses[0].ai_feedback) {
          console.log("[StarPractice] Response has feedback:", dbResponses[0].ai_feedback);
          setFeedback(dbResponses[0].ai_feedback);
          setHasSubmittedResponse(true);
          
          // Also save to localStorage for future use
          const allResponses = LocalStorageUtils.getSavedStarResponses(user.id) || {};
          allResponses[currentQuestion.id] = {
            response: {
              situation: dbResponses[0].situation,
              task: dbResponses[0].task,
              action: dbResponses[0].action,
              result: dbResponses[0].result,
            },
            feedback: dbResponses[0].ai_feedback,
            timestamp: new Date().getTime()
          };
          LocalStorageUtils.saveSavedStarResponses(user.id, allResponses);
          console.log("[StarPractice] Saved database response to localStorage for future use");
        } else {
          console.log("[StarPractice] Database response has no feedback");
          setHasSubmittedResponse(false);
          setFeedback(null);
        }
      } else {
        // Reset to empty response if no saved data found anywhere
        console.log("[StarPractice] No saved response found anywhere, resetting to empty");
        setResponse({
          situation: '',
          task: '',
          action: '',
          result: '',
        });
        setFeedback(null);
        setHasSubmittedResponse(false);
      }
      
      setIsFlipped(false);
    } catch (error) {
      console.error('[StarPractice] Error loading saved response:', error);
    }
  };

  const saveResponseDraft = () => {
    if (!user?.id || questions.length === 0) return;
    
    try {
      const currentQuestion = questions[currentQuestionIndex];
      console.log("Saving draft for question:", currentQuestion.id, response);
      LocalStorageUtils.saveStarResponseDraftForQuestion(user.id, currentQuestion.id, response as any);
      console.log("Draft saved successfully");
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
      console.log("Submitting STAR response for question:", currentQuestion.id);
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
      console.log("Saved response:", savedResponse);

      // Get AI feedback
      console.log("Calling evaluate-star-response function with responseId:", savedResponse.id);
      const { data: evaluatedResponse, error: evalError } = await supabase
        .functions.invoke('evaluate-star-response', {
          body: { responseId: savedResponse.id },
        });

      if (evalError) throw evalError;
      
      console.log("Received function response:", evaluatedResponse);
      
      if (evaluatedResponse && evaluatedResponse.ai_feedback) {
        console.log("Setting feedback state with:", evaluatedResponse.ai_feedback);
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
          console.log("Saved feedback to localStorage:", allResponses[currentQuestion.id]);
        }
        
        setIsFlipped(true);
        setHasSubmittedResponse(true);
        toast({
          title: 'Response Submitted',
          description: 'Your STAR response has been evaluated.',
        });
      } else {
        console.error("No feedback received in evaluation response:", evaluatedResponse);
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
    console.log("Flipping card. Current state:", isFlipped, "Setting to:", !isFlipped);
    console.log("Current feedback:", feedback);
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
    console.log(`Updating ${field} field with new value:`, value);
    const updatedResponse = { ...response, [field]: value };
    setResponse(updatedResponse);
    
    // Debounce the save - in a real app, you might want to use a proper debounce function
    if (user?.id && questions[currentQuestionIndex]) {
      const timeoutId = setTimeout(() => {
        console.log("Auto-saving draft after debounce");
        LocalStorageUtils.saveStarResponseDraftForQuestion(
          user.id, 
          questions[currentQuestionIndex].id, 
          updatedResponse as any
        );
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
  };

  // Debug logging in useEffect to track state changes
  useEffect(() => {
    console.log("Response state updated:", response);
  }, [response]);

  useEffect(() => {
    console.log("Feedback state updated:", feedback);
  }, [feedback]);

  useEffect(() => {
    console.log("isFlipped state updated:", isFlipped);
  }, [isFlipped]);

  useEffect(() => {
    console.log("hasSubmittedResponse state updated:", hasSubmittedResponse);
  }, [hasSubmittedResponse]);

  useEffect(() => {
    if (isFlipped) {
      console.log("Card is flipped, feedback should be showing:", feedback);
    }
  }, [isFlipped, feedback]);

  if (loading) {
    return (
      <AppLayout>
        <div className="container mx-auto py-8">
          <Card className="border-slate-200 shadow-md">
            <CardContent className="flex items-center justify-center py-12">
              <Spinner size="lg" className="text-primary" />
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
          <Card className="border-amber-200 shadow-md bg-amber-50/30">
            <CardHeader className="border-b border-amber-100">
              <CardTitle className="text-amber-900">No Questions Available</CardTitle>
              <CardDescription className="text-amber-700">
                Please analyze a job description first to get personalized STAR questions.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <Button 
                onClick={handleBackToInterviewPrep} 
                variant="outline"
                className="mt-2 border-amber-200 text-amber-700 hover:bg-amber-50"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
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
      <div className="container mx-auto py-8 relative">
        <div className="absolute inset-0 bg-slate-50/50 rounded-xl -z-10"></div>
        
        <div className="flex items-center mb-6">
          <Button 
            variant="outline" 
            onClick={handleBackToInterviewPrep} 
            className="mr-4 border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-800">
              STAR Response Practice
            </h1>
            <p className="text-slate-600">
              Practice answering behavioral interview questions using the STAR method.
            </p>
          </div>
        </div>

        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <Badge 
              variant="outline" 
              className="mr-2 bg-white border-slate-200 text-slate-700 px-3 py-1"
            >
              Question {currentQuestionIndex + 1} of {questions.length}
            </Badge>
            <Badge className="bg-primary/90 text-white border-none">
              {currentQuestion.type}
            </Badge>
          </div>
          <div className="flex items-center bg-amber-50 px-4 py-2 rounded-full border border-amber-100">
            <Star className="h-4 w-4 text-amber-500 mr-2" />
            <span className="font-medium text-amber-700">Streak: {streak} day{streak !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className="space-y-8">
          {/* Main card (Question/Response) */}
          <Card className="bg-white shadow-md border-slate-100 overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-slate-800">Question: {currentQuestion.question}</CardTitle>
                  <CardDescription className="text-slate-600">
                    Target Competency: {currentQuestion.targetCompetency}
                  </CardDescription>
                </div>
                {/* Update Response button if already answered */}
                {hasSubmittedResponse && (
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={() => {
                      setHasSubmittedResponse(false);
                      setFeedback(null);
                      setCurrentStarStep('situation');
                    }}
                    className="gap-1 bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  >
                    <RotateCw className="h-4 w-4 mr-1" />
                    Update Response
                  </Button>
                )}
              </div>
              {!hasSubmittedResponse && (
                <div>
                  <div className="flex justify-between text-sm mt-2 mb-1">
                    <span className="text-slate-700 font-medium">STAR Progress</span>
                    <span className="text-primary font-medium">{currentStarStep.charAt(0).toUpperCase() + currentStarStep.slice(1)}</span>
                  </div>
                  <Progress value={progressPercentage} className="h-2" />
                </div>
              )}
            </CardHeader>
            <CardContent className="p-6">
              {!hasSubmittedResponse ? (
                <div className="space-y-4">
                  {currentStarStep === 'situation' && (
                    <div className="space-y-2">
                      <label className="text-lg font-medium flex items-center text-slate-800">
                        Situation
                        <span className="text-sm font-normal text-slate-600 ml-2 bg-slate-50 px-2 py-0.5 rounded-full">
                          (Where and when did this happen?)
                        </span>
                      </label>
                      <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-md border-l-4 border-primary/40">
                        {getStepTip('situation')}
                      </p>
                      <Textarea
                        placeholder="Describe the situation..."
                        value={response.situation}
                        onChange={(e) => handleResponseChange('situation', e.target.value)}
                        rows={5}
                        className="w-full border-slate-200 focus:border-primary/40 shadow-sm focus:ring-primary/20"
                      />
                    </div>
                  )}
                  {currentStarStep === 'task' && (
                    <div className="space-y-2">
                      <label className="text-lg font-medium flex items-center text-slate-800">
                        Task
                        <span className="text-sm font-normal text-slate-600 ml-2 bg-slate-50 px-2 py-0.5 rounded-full">
                          (What was your responsibility?)
                        </span>
                      </label>
                      <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-md border-l-4 border-secondary/40">
                        {getStepTip('task')}
                      </p>
                      <Textarea
                        placeholder="What was your task or goal?"
                        value={response.task}
                        onChange={(e) => handleResponseChange('task', e.target.value)}
                        rows={5}
                        className="w-full border-slate-200 focus:border-secondary/40 shadow-sm focus:ring-secondary/20"
                      />
                    </div>
                  )}
                  {currentStarStep === 'action' && (
                    <div className="space-y-2">
                      <label className="text-lg font-medium flex items-center text-slate-800">
                        Action
                        <span className="text-sm font-normal text-slate-600 ml-2 bg-slate-50 px-2 py-0.5 rounded-full">
                          (What did you do?)
                        </span>
                      </label>
                      <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-md border-l-4 border-blue-300">
                        {getStepTip('action')}
                      </p>
                      <Textarea
                        placeholder="What actions did you take?"
                        value={response.action}
                        onChange={(e) => handleResponseChange('action', e.target.value)}
                        rows={5}
                        className="w-full border-slate-200 focus:border-blue-300 shadow-sm focus:ring-blue-100"
                      />
                    </div>
                  )}
                  {currentStarStep === 'result' && (
                    <div className="space-y-2">
                      <label className="text-lg font-medium flex items-center text-slate-800">
                        Result
                        <span className="text-sm font-normal text-slate-600 ml-2 bg-slate-50 px-2 py-0.5 rounded-full">
                          (What was the outcome?)
                        </span>
                      </label>
                      <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-md border-l-4 border-emerald-300">
                        {getStepTip('result')}
                      </p>
                      <Textarea
                        placeholder="What were the results?"
                        value={response.result}
                        onChange={(e) => handleResponseChange('result', e.target.value)}
                        rows={5}
                        className="w-full border-slate-200 focus:border-emerald-300 shadow-sm focus:ring-emerald-100"
                      />
                    </div>
                  )}
                  <div className="flex justify-between pt-4">
                    <Button
                      variant="outline"
                      onClick={moveToPreviousStep}
                      disabled={currentStarStep === 'situation'}
                      className="border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      <ChevronLeft className="h-4 w-4 mr-2" />
                      Previous
                    </Button>
                    {currentStarStep === 'result' ? (
                      <Button
                        onClick={handleSubmit}
                        disabled={submitting || !allStepsFilled()}
                        className="bg-primary hover:bg-primary/90 text-white shadow-sm"
                      >
                        {submitting ? <Spinner size="sm" className="mr-2" /> : null}
                        Submit Response
                      </Button>
                    ) : (
                      <Button
                        onClick={moveToNextStep}
                        disabled={!currentStepFilled()}
                        className="bg-primary hover:bg-primary/90 text-white shadow-sm"
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
                      className="text-slate-600 hover:text-slate-700 hover:bg-slate-50"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous Question
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={handleNext}
                      disabled={currentQuestionIndex === questions.length - 1}
                      size="sm"
                      className="text-slate-600 hover:text-slate-700 hover:bg-slate-50"
                    >
                      Next Question
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-5 bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <div className="bg-white p-4 rounded-md border border-slate-100 shadow-sm">
                      <h3 className="font-medium text-slate-800">Situation</h3>
                      <p className="text-sm text-slate-700 mt-2">{response.situation}</p>
                    </div>
                    <div className="bg-white p-4 rounded-md border border-slate-100 shadow-sm">
                      <h3 className="font-medium text-slate-800">Task</h3>
                      <p className="text-sm text-slate-700 mt-2">{response.task}</p>
                    </div>
                    <div className="bg-white p-4 rounded-md border border-slate-100 shadow-sm">
                      <h3 className="font-medium text-slate-800">Action</h3>
                      <p className="text-sm text-slate-700 mt-2">{response.action}</p>
                    </div>
                    <div className="bg-white p-4 rounded-md border border-slate-100 shadow-sm">
                      <h3 className="font-medium text-slate-800">Result</h3>
                      <p className="text-sm text-slate-700 mt-2">{response.result}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-4">
                    <Button
                      variant="ghost"
                      onClick={handlePrevious}
                      disabled={currentQuestionIndex === 0}
                      size="sm"
                      className="text-slate-600 hover:text-slate-700 hover:bg-slate-50"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous Question
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={handleNext}
                      disabled={currentQuestionIndex === questions.length - 1}
                      size="sm"
                      className="text-slate-600 hover:text-slate-700 hover:bg-slate-50"
                    >
                      Next Question
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Feedback card */}
          {feedback && hasSubmittedResponse && (
            <Card className="bg-white border-blue-100 shadow-md overflow-hidden">
              <CardHeader className="bg-blue-50/50 border-b border-blue-100/50">
                <div className="flex items-center">
                  <Star className="h-5 w-5 text-blue-500 mr-2" />
                  <CardTitle className="text-slate-800 font-display">AI Feedback</CardTitle>
                </div>
                <CardDescription className="text-slate-600">
                  Analysis of your STAR response
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div className="bg-white rounded-lg p-4 border border-slate-100 shadow-sm">
                    <h3 className="text-sm font-medium mb-3 text-slate-800">Component Scores</h3>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-700">Situation</span>
                          <span className="font-medium text-slate-800">{feedback.scores.situation}/10</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary/80 rounded-full"
                            style={{ width: `${feedback.scores.situation * 10}%` }}
                          ></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-700">Task</span>
                          <span className="font-medium text-slate-800">{feedback.scores.task}/10</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-secondary/80 rounded-full"
                            style={{ width: `${feedback.scores.task * 10}%` }}
                          ></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-700">Action</span>
                          <span className="font-medium text-slate-800">{feedback.scores.action}/10</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-400 rounded-full"
                            style={{ width: `${feedback.scores.action * 10}%` }}
                          ></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-700">Result</span>
                          <span className="font-medium text-slate-800">{feedback.scores.result}/10</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-400 rounded-full"
                            style={{ width: `${feedback.scores.result * 10}%` }}
                          ></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-slate-800">Overall</span>
                          <span className="font-medium text-slate-800">{feedback.scores.overall}/10</span>
                        </div>
                        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
                            style={{ width: `${feedback.scores.overall * 10}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-slate-100 shadow-sm">
                    <h3 className="text-sm font-medium mb-3 text-slate-800">Analysis</h3>
                    <div className="space-y-2 text-sm">
                      <p className="p-2 bg-slate-50 rounded text-slate-700">
                        <strong>Completeness:</strong> {feedback.analysis.completeness}
                      </p>
                      <p className="p-2 bg-slate-50 rounded text-slate-700">
                        <strong>Specificity:</strong> {feedback.analysis.specificity}
                      </p>
                      <p className="p-2 bg-slate-50 rounded text-slate-700">
                        <strong>Relevance:</strong> {feedback.analysis.relevance}
                      </p>
                      <p className="p-2 bg-slate-50 rounded text-slate-700">
                        <strong>Impact:</strong> {feedback.analysis.impact}
                      </p>
                      <p className="p-2 bg-slate-50 rounded text-slate-700">
                        <strong>Communication:</strong> {feedback.analysis.communication}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-green-50/30 p-4 rounded-lg border border-green-100 shadow-sm">
                      <h3 className="text-sm font-medium mb-3 text-green-800">Strengths</h3>
                      <ul className="space-y-2">
                        {feedback.feedback.strengths.map((strength: string, index: number) => (
                          <li key={index} className="text-sm flex items-start">
                            <Check className="h-4 w-4 text-green-500 mr-2 mt-1 flex-shrink-0" />
                            <span className="text-slate-700">{strength}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-amber-50/30 p-4 rounded-lg border border-amber-100 shadow-sm">
                      <h3 className="text-sm font-medium mb-3 text-amber-800">Areas for Improvement</h3>
                      <ul className="space-y-2">
                        {feedback.feedback.improvements.map((improvement: string, index: number) => (
                          <li key={index} className="text-sm flex items-start">
                            <AlertCircle className="h-4 w-4 text-amber-500 mr-2 mt-1 flex-shrink-0" />
                            <span className="text-slate-700">{improvement}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="bg-blue-50/30 p-4 rounded-lg border border-blue-100 shadow-sm">
                    <h3 className="text-sm font-medium mb-3 text-blue-800">Suggestions</h3>
                    <ul className="space-y-2">
                      {feedback.feedback.suggestions.map((suggestion: string, index: number) => (
                        <li key={index} className="text-sm flex items-start">
                          <div className="h-5 w-5 bg-blue-100 rounded-full flex items-center justify-center mr-2 mt-1 flex-shrink-0">
                            <span className="text-blue-700 text-xs font-bold">{index + 1}</span>
                          </div>
                          <span className="text-slate-700">{suggestion}</span>
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
    </AppLayout>
  );
}
