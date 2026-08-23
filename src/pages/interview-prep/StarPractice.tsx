
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useRateLimitedInvoke } from '@/hooks/useRateLimitedInvoke';
import { useUser } from '@/hooks/use-user';
import { supabase } from '@/integrations/supabase/client';
import { Spinner } from '@/components/ui/spinner';
import { Check, AlertCircle, ChevronLeft, ChevronRight, RotateCw, Star } from 'lucide-react';
import { LocalStorageUtils } from '@/utils/localStorageUtils';
import { functionErrorMessage } from '@/lib/functionErrorMessage';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';

import { createLogger } from '@/utils/logger';

const logger = createLogger('StarPractice');

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

type StarStep = 'situation' | 'task' | 'action' | 'result';

const STAR_STEPS: StarStep[] = ['situation', 'task', 'action', 'result'];

// Soft Studio step accents: Situation lavender, Task teal, Action peach, Result green.
const STEP_STYLES: Record<StarStep, { label: string; prompt: string; bar: string; hintBox: string; hintText: string; recapBorder: string }> = {
  situation: {
    label: 'Situation',
    prompt: 'Where and when did this happen?',
    bar: 'bg-ss-lav',
    hintBox: 'bg-ss-lav-chip border-ss-lav',
    hintText: 'text-ss-lav-deep',
    recapBorder: 'border-l-ss-lav',
  },
  task: {
    label: 'Task',
    prompt: 'What was your responsibility?',
    bar: 'bg-ss-teal',
    hintBox: 'bg-ss-teal-chip border-ss-teal',
    hintText: 'text-ss-teal',
    recapBorder: 'border-l-ss-teal',
  },
  action: {
    label: 'Action',
    prompt: 'What did you do?',
    bar: 'bg-ss-peach',
    hintBox: 'bg-ss-warn-chip border-ss-peach',
    hintText: 'text-ss-peach-deep',
    recapBorder: 'border-l-ss-peach',
  },
  result: {
    label: 'Result',
    prompt: 'What was the outcome?',
    bar: 'bg-ss-good',
    hintBox: 'bg-ss-good-chip border-ss-good',
    hintText: 'text-ss-good',
    recapBorder: 'border-l-ss-good',
  },
};

export default function StarPractice() {
  const { toast } = useToast();
  const invokeWithRateLimit = useRateLimitedInvoke();
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
  // Scores are on the assessment rubric's own 1-5 scale, and evaluate-star-response
  // stamps score_scale so the bars know what to divide by. Feedback saved before
  // that switch carries no stamp and was stored out of 10, so it keeps its old
  // denominator instead of being redrawn as an impossible 8/5.
  const scoreScale = typeof feedback?.score_scale === 'number' ? feedback.score_scale : 10;
  const [isFlipped, setIsFlipped] = useState(false);
  const [currentStarStep, setCurrentStarStep] = useState<StarStep>('situation');
  const [hasSubmittedResponse, setHasSubmittedResponse] = useState(false);

  // Fix the localStorage usage with proper methods
  const [streak, setStreak] = useState(() => {
    try {
      logger.log("Initializing streak from localStorage");
      const streakValue = localStorage.getItem('starPracticeStreak');
      logger.log("Found streak value:", streakValue);
      return parseInt(streakValue || '0', 10);
    } catch (e) {
      logger.error('Error accessing localStorage for streak:', e);
      return 0;
    }
  });

  const [lastPracticeDate, setLastPracticeDate] = useState(() => {
    try {
      logger.log("Initializing lastPracticeDate from localStorage");
      const dateValue = localStorage.getItem('starPracticeLastDate');
      logger.log("Found lastPracticeDate value:", dateValue);
      return dateValue || '';
    } catch (e) {
      logger.error('Error accessing localStorage for last practice date:', e);
      return '';
    }
  });

  // Set up effect to load questions when component mounts
  useEffect(() => {
    logger.log("Component mounted, loading questions for user:", user?.id);
    loadQuestions();
    checkAndUpdateStreak();
  }, [user]);

  // Set initial question index based on URL parameter if available
  useEffect(() => {
    if (questionId && questions.length > 0) {
      logger.log("URL contains questionId:", questionId, "looking for matching question");
      const index = questions.findIndex(q => q.id === questionId);
      if (index !== -1) {
        logger.log(`Found matching question at index ${index}, setting currentQuestionIndex`);
        setCurrentQuestionIndex(index);
      } else {
        logger.log("No matching question found for questionId:", questionId);
      }
    }
  }, [questionId, questions]);

  // Load saved responses for the current question whenever it changes
  useEffect(() => {
    if (user?.id && questions.length > 0) {
      logger.log("Current question changed or questions loaded, loading saved response");
      loadSavedResponse();
    }
  }, [currentQuestionIndex, questions, user]);

  const checkAndUpdateStreak = () => {
    const today = new Date().toLocaleDateString();
    logger.log("Checking streak. Last practice date:", lastPracticeDate, "Today:", today);

    if (lastPracticeDate && lastPracticeDate !== today) {
      const lastDate = new Date(lastPracticeDate);
      const currentDate = new Date(today);

      // Check if the last practice was yesterday
      const timeDiff = currentDate.getTime() - lastDate.getTime();
      const daysDiff = timeDiff / (1000 * 3600 * 24);
      logger.log("Days difference:", daysDiff);

      if (daysDiff > 1.5) {
        // Reset streak if more than 1.5 days have passed (to account for time zones)
        logger.log("More than 1.5 days passed, resetting streak to 1");
        setStreak(1);
      } else if (daysDiff >= 0.5) {
        // Increment streak if it's a new day
        logger.log("New day detected, incrementing streak");
        setStreak(prev => prev + 1);
      }
    } else if (!lastPracticeDate) {
      // First time practicing
      logger.log("First time practicing, setting streak to 1");
      setStreak(1);
    }

    // Update localStorage
    try {
      // Update last practice date
      logger.log("Updating localStorage with new streak:", streak, "and date:", today);
      setLastPracticeDate(today);
      localStorage.setItem('starPracticeLastDate', today);
      localStorage.setItem('starPracticeStreak', streak.toString());
    } catch (e) {
      logger.error('Error saving to localStorage:', e);
    }
  };

  const loadQuestions = async () => {
    if (!user?.id) {
      logger.log("User ID is undefined, cannot load questions");
      setLoading(false);
      return;
    }

    try {
      logger.log("Loading study guides for user:", user.id);

      // maybeSingle, not single. A user who has not generated a study guide has
      // no row, and single() turns that into an HTTP 406 (PGRST116) which the
      // throw below converted into a red "Failed to load questions. Please try
      // again." toast — telling someone something broke when in fact they have
      // simply not made one yet. Retrying could never have helped.
      const { data: studyGuides, error } = await supabase
        .from('study_guides')
        .select('questions')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      logger.log("Study guides loaded:", studyGuides);

      if (studyGuides?.questions) {
        const behavioralQuestions = (studyGuides.questions as any[]).filter(
          (q: any) => q.type === 'behavioral'
        );
        logger.log("Filtered behavioral questions:", behavioralQuestions);
        setQuestions(behavioralQuestions);
      }
    } catch (error) {
      logger.error('Error loading questions:', error);
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
      logger.log("[StarPractice] Loading saved response for question:", currentQuestion.id);

      // First check localStorage for saved responses with feedback
      const savedResponses = LocalStorageUtils.getSavedStarResponses(user.id);
      logger.log("[StarPractice] Saved responses from localStorage:", savedResponses);
      if (savedResponses && savedResponses[currentQuestion.id]) {
        const savedData = savedResponses[currentQuestion.id];
        // This cache is read before the database and returns early, so a blob
        // left here from before the 1-5 switch would shadow the row forever —
        // and it was scored out of 10. Skipping it falls through to the DB,
        // which re-scores on the next submit.
        if (typeof savedData.feedback?.score_scale !== 'number') {
          logger.log("[StarPractice] Ignoring cached feedback with no score_scale:", currentQuestion.id);
        } else {
          logger.log("[StarPractice] Found saved response with feedback in localStorage:", savedData);
          setResponse(savedData.response);
          setFeedback(savedData.feedback);
          setHasSubmittedResponse(true);
          setIsFlipped(false);
          return;
        }
      }

      // If no saved response with feedback found, check for draft
      logger.log("[StarPractice] No saved response with feedback found, checking for draft");
      const savedDraft = LocalStorageUtils.getStarResponseDraftForQuestion(user.id, currentQuestion.id);
      logger.log("[StarPractice] Draft found:", savedDraft);
      if (savedDraft) {
        setResponse(savedDraft);
        setHasSubmittedResponse(false);
        setFeedback(null);
        setIsFlipped(false);
        return;
      }

      // As a last resort, check the database for any submitted response
      logger.log("[StarPractice] No response found in localStorage, checking database");
      const { data: dbResponses, error } = await supabase
        .from('star_responses')
        .select('*')
        .eq('user_id', user.id)
        .eq('question_id', currentQuestion.id)
        .order('submitted_at', { ascending: false })
        .limit(1);

      if (error) {
        logger.error("[StarPractice] Error fetching responses from database:", error);
      } else if (dbResponses && dbResponses.length > 0) {
        logger.log("[StarPractice] Found response in database:", dbResponses[0]);
        setResponse({
          situation: dbResponses[0].situation,
          task: dbResponses[0].task,
          action: dbResponses[0].action,
          result: dbResponses[0].result,
        });

        if (dbResponses[0].ai_feedback) {
          logger.log("[StarPractice] Response has feedback:", dbResponses[0].ai_feedback);
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
          logger.log("[StarPractice] Saved database response to localStorage for future use");
        } else {
          logger.log("[StarPractice] Database response has no feedback");
          setHasSubmittedResponse(false);
          setFeedback(null);
        }
      } else {
        // Reset to empty response if no saved data found anywhere
        logger.log("[StarPractice] No saved response found anywhere, resetting to empty");
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
      logger.error('[StarPractice] Error loading saved response:', error);
    }
  };

  const saveResponseDraft = () => {
    if (!user?.id || questions.length === 0) return;

    try {
      const currentQuestion = questions[currentQuestionIndex];
      logger.log("Saving draft for question:", currentQuestion.id, response);
      LocalStorageUtils.saveStarResponseDraftForQuestion(user.id, currentQuestion.id, response as any);
      logger.log("Draft saved successfully");
    } catch (error) {
      logger.error('Error saving response draft:', error);
    }
  };

  const handleSubmit = async () => {
    if (!user || questions.length === 0) return;

    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return;

    setSubmitting(true);
    try {
      logger.log("Submitting STAR response for question:", currentQuestion.id);

      // Reuse this question's row rather than inserting another. The answer is
      // saved before the model is called — deliberately, so an AI outage cannot
      // lose what the user typed — but that meant every failed evaluation left a
      // scoreless row behind and every retry added one more. Six such rows exist
      // from a single afternoon, five of them the same answer minutes apart.
      const { data: existing, error: lookupError } = await supabase
        .from('star_responses')
        .select('id')
        .eq('user_id', user.id)
        .eq('question_id', currentQuestion.id)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lookupError) throw lookupError;

      const { data: savedResponse, error: saveError } = existing
        ? await supabase
            .from('star_responses')
            .update({ ...response, ai_feedback: null, submitted_at: new Date().toISOString() })
            .eq('id', existing.id)
            .select()
            .maybeSingle()
        : await supabase
            .from('star_responses')
            .insert({
              user_id: user.id,
              question_id: currentQuestion.id,
              ...response,
            })
            .select()
            .maybeSingle();

      if (saveError) throw saveError;
      if (!savedResponse) throw new Error('Could not save your response. Please try again.');
      logger.log("Saved response:", savedResponse);

      // Get AI feedback
      logger.log("Calling evaluate-star-response function with responseId:", savedResponse.id);
      const evaluatedResponse = await invokeWithRateLimit<{ ai_feedback?: unknown }>(
        'evaluate-star-response',
        { responseId: savedResponse.id },
      );

      logger.log("Received function response:", evaluatedResponse);

      if (evaluatedResponse && evaluatedResponse.ai_feedback) {
        logger.log("Setting feedback state with:", evaluatedResponse.ai_feedback);
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
          logger.log("Saved feedback to localStorage:", allResponses[currentQuestion.id]);
        }

        setIsFlipped(true);
        setHasSubmittedResponse(true);
        toast({
          title: 'Response Submitted',
          description: 'Your STAR response has been evaluated.',
        });
      } else {
        logger.error("No feedback received in evaluation response:", evaluatedResponse);
        throw new Error("No feedback received from evaluation");
      }
    } catch (error) {
      logger.error('Error submitting response:', error);
      // The function says which way it failed — cut off, unreadable, a score
      // outside the scale — and that body sits unread on `error.context`.
      // Showing "try again" for all of them made every failure look identical.
      const serverMessage = await functionErrorMessage(error);
      toast({
        title: 'Error',
        description: serverMessage ?? 'Failed to submit response. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
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

  const getStepTip = (step: StarStep) => {
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
  const handleResponseChange = (field: StarStep, value: string) => {
    logger.log(`Updating ${field} field with new value:`, value);
    const updatedResponse = { ...response, [field]: value };
    setResponse(updatedResponse);

    // Debounce the save - in a real app, you might want to use a proper debounce function
    if (user?.id && questions[currentQuestionIndex]) {
      const timeoutId = setTimeout(() => {
        logger.log("Auto-saving draft after debounce");
        LocalStorageUtils.saveStarResponseDraftForQuestion(
          user.id,
          questions[currentQuestionIndex].id,
          updatedResponse as any
        );
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  };

  // Jump directly to a step from the segment bar (draft is saved on the way).
  const handleStepSelect = (step: StarStep) => {
    saveResponseDraft();
    setCurrentStarStep(step);
  };

  // Debug logging in useEffect to track state changes
  useEffect(() => {
    logger.log("Response state updated:", response);
  }, [response]);

  useEffect(() => {
    logger.log("Feedback state updated:", feedback);
  }, [feedback]);

  useEffect(() => {
    logger.log("isFlipped state updated:", isFlipped);
  }, [isFlipped]);

  useEffect(() => {
    logger.log("hasSubmittedResponse state updated:", hasSubmittedResponse);
  }, [hasSubmittedResponse]);

  useEffect(() => {
    if (isFlipped) {
      logger.log("Card is flipped, feedback should be showing:", feedback);
    }
  }, [isFlipped, feedback]);

  if (loading) {
    return (
      <AppLayout fullWidth>
        <div className="ss-wash min-h-full px-4 sm:px-6 py-8">
          <div className="mx-auto max-w-7xl">
            <Card className="ss-card">
              <CardContent className="flex items-center justify-center py-12">
                <Spinner size="lg" className="text-primary" />
              </CardContent>
            </Card>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (questions.length === 0) {
    return (
      <AppLayout fullWidth>
        <div className="ss-wash min-h-full px-4 sm:px-6 py-8">
          <div className="mx-auto max-w-7xl">
            <Card className="ss-card bg-ss-warn-chip border-ss-warn/30">
              <CardHeader>
                <CardTitle className="text-ss-peach-deep">No Questions Available</CardTitle>
                <CardDescription>
                  Please analyze a job description first to get personalized STAR questions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleBackToInterviewPrep}
                  variant="outline"
                  className="rounded-full font-bold"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Go Back
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </AppLayout>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const starStepIndex = STAR_STEPS.indexOf(currentStarStep);
  const stepStyle = STEP_STYLES[currentStarStep];

  const questionNav = (
    <div className="flex justify-between items-center pt-4">
      <Button
        variant="ghost"
        onClick={handlePrevious}
        disabled={currentQuestionIndex === 0}
        size="sm"
        className="rounded-full font-bold text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Previous Question
      </Button>
      <Button
        variant="ghost"
        onClick={handleNext}
        disabled={currentQuestionIndex === questions.length - 1}
        size="sm"
        className="rounded-full font-bold text-muted-foreground hover:text-foreground"
      >
        Next Question
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );

  return (
    <AppLayout fullWidth>
      <div className="ss-wash min-h-full px-4 sm:px-6 py-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBackToInterviewPrep}
                className="rounded-full font-bold"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Interview prep
              </Button>
              <span className="text-sm text-muted-foreground">· Step 02</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">STAR Response Practice</h1>
            <p className="text-muted-foreground text-lg">
              Practice answering behavioral interview questions using the STAR method.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
            {/* Left column: question + composition (or recap) */}
            <div className="lg:col-span-3 space-y-6">
              <Card className="ss-card">
                <CardContent className="p-6 sm:p-7">
                  <div className="flex items-center gap-2 flex-wrap mb-4">
                    <span className="rounded-full bg-ss-lav-chip px-3 py-1 text-xs font-medium text-ss-lav-deep">
                      Question {currentQuestionIndex + 1} of {questions.length}
                    </span>
                    <span className="rounded-full bg-ss-track px-3 py-1 text-xs font-medium text-muted-foreground capitalize">
                      {currentQuestion.type}
                    </span>
                    <span className="ml-auto flex items-center rounded-full bg-ss-warn-chip px-3 py-1 text-xs font-medium text-ss-peach-deep">
                      <Star className="h-3.5 w-3.5 mr-1.5" />
                      Streak: {streak} day{streak !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="ss-serif text-lg leading-relaxed mb-2">“{currentQuestion.question}”</p>
                  <p className="text-sm text-muted-foreground">
                    Target Competency:{' '}
                    <span className="font-bold text-ss-lav-deep">{currentQuestion.targetCompetency}</span>
                  </p>
                </CardContent>
              </Card>

              {!hasSubmittedResponse ? (
                <Card className="ss-card">
                  <CardContent className="p-6 sm:p-7">
                    {/* Step segments — click to jump; drafts save on the way */}
                    <div className="grid grid-cols-4 gap-3 mb-5" role="tablist" aria-label="STAR steps">
                      {STAR_STEPS.map((step, i) => (
                        <button
                          key={step}
                          role="tab"
                          aria-selected={step === currentStarStep}
                          onClick={() => handleStepSelect(step)}
                          className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg p-0.5"
                        >
                          <span
                            className={`block h-2 rounded-full mb-1.5 ${
                              i <= starStepIndex ? STEP_STYLES[step].bar : 'bg-ss-track'
                            }`}
                          />
                          <span
                            className={`text-sm ${
                              step === currentStarStep ? 'font-bold text-foreground' : 'text-muted-foreground'
                            }`}
                          >
                            {STEP_STYLES[step].label}
                          </span>
                        </button>
                      ))}
                    </div>

                    <Textarea
                      placeholder={
                        currentStarStep === 'situation' ? 'Describe the situation...'
                        : currentStarStep === 'task' ? 'What was your task or goal?'
                        : currentStarStep === 'action' ? 'What actions did you take?'
                        : 'What were the results?'
                      }
                      value={response[currentStarStep] || ''}
                      onChange={(e) => handleResponseChange(currentStarStep, e.target.value)}
                      rows={7}
                      className="w-full rounded-xl"
                    />

                    <div className="flex justify-between pt-5 gap-3 flex-wrap">
                      <Button
                        variant="outline"
                        onClick={moveToPreviousStep}
                        disabled={currentStarStep === 'situation'}
                        className="rounded-full font-bold"
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                      </Button>
                      {currentStarStep === 'result' ? (
                        <Button
                          onClick={handleSubmit}
                          disabled={submitting || !allStepsFilled()}
                          className="rounded-full font-bold"
                        >
                          {submitting ? <Spinner size="sm" className="mr-2" /> : null}
                          Submit Response
                        </Button>
                      ) : (
                        <Button
                          onClick={moveToNextStep}
                          disabled={!currentStepFilled()}
                          className="rounded-full font-bold"
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      )}
                    </div>
                    {questionNav}
                  </CardContent>
                </Card>
              ) : (
                <Card className="ss-card">
                  <CardContent className="p-6 sm:p-7">
                    <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
                      <h2 className="text-lg font-bold">Your response</h2>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setHasSubmittedResponse(false);
                          setFeedback(null);
                          setCurrentStarStep('situation');
                          // Drop the cached feedback too. Clearing only React
                          // state meant navigating away without resubmitting
                          // resurrected the old evaluation from localStorage.
                          if (user?.id && currentQuestion) {
                            const cached = LocalStorageUtils.getSavedStarResponses(user.id) || {};
                            delete cached[currentQuestion.id];
                            LocalStorageUtils.saveSavedStarResponses(user.id, cached);
                          }
                        }}
                        className="rounded-full font-bold"
                      >
                        <RotateCw className="h-4 w-4 mr-1" />
                        Update Response
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {STAR_STEPS.map((step) => (
                        <div
                          key={step}
                          className={`rounded-2xl border border-border border-l-4 ${STEP_STYLES[step].recapBorder} bg-card p-4`}
                        >
                          {feedback?.scores?.[step] != null && (
                            <span className="float-right rounded-full bg-ss-track px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                              {feedback.scores[step]}/{scoreScale}
                            </span>
                          )}
                          <h3 className={`text-xs font-bold tracking-widest uppercase ${STEP_STYLES[step].hintText}`}>
                            {STEP_STYLES[step].label}
                          </h3>
                          <p className="text-sm text-foreground/80 mt-2">{response[step]}</p>
                        </div>
                      ))}
                    </div>
                    {questionNav}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right rail: coach while composing, AI feedback after submit */}
            <div className="lg:col-span-2 lg:sticky lg:top-6 space-y-6">
              {feedback && hasSubmittedResponse ? (
                <Card className="ss-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-center">
                      <Star className="h-5 w-5 text-ss-lav-deep mr-2" />
                      <CardTitle>AI Feedback</CardTitle>
                    </div>
                    <CardDescription>Analysis of your STAR response</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {/* Feedback saved before evaluate-star-response rejected
                        score-less payloads can be missing `scores` entirely; the
                        bars below read it unconditionally, so without this the
                        whole rail throws and the user loses the written feedback
                        too. */}
                    {feedback.scores ? (
                    <div>
                      {STAR_STEPS.map((step) => (
                        <div key={step} className="mb-3">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">{STEP_STYLES[step].label}</span>
                            <span className="font-bold">{feedback.scores[step]}/{scoreScale}</span>
                          </div>
                          <div className="h-2 w-full bg-ss-track rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${STEP_STYLES[step].bar}`}
                              style={{ width: `${(feedback.scores[step] / scoreScale) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                      <div className="pt-3 mt-1 border-t border-border">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-bold">Overall</span>
                          <span className="font-bold">{feedback.scores.overall}/{scoreScale}</span>
                        </div>
                        <div className="h-3 w-full bg-ss-track rounded-full overflow-hidden">
                          <div
                            className="h-full bg-ss-lav-deep rounded-full"
                            style={{ width: `${(feedback.scores.overall / scoreScale) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                    ) : null}

                    <div className="rounded-2xl bg-background border border-border p-4">
                      <h3 className="text-sm font-bold mb-3">Analysis</h3>
                      <div className="space-y-2 text-sm text-foreground/80">
                        <p><strong>Completeness:</strong> {feedback.analysis.completeness}</p>
                        <p><strong>Specificity:</strong> {feedback.analysis.specificity}</p>
                        <p><strong>Relevance:</strong> {feedback.analysis.relevance}</p>
                        <p><strong>Impact:</strong> {feedback.analysis.impact}</p>
                        <p><strong>Communication:</strong> {feedback.analysis.communication}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-ss-good-chip p-4">
                      <h3 className="text-sm font-bold mb-3 text-ss-good">Strengths</h3>
                      <ul className="space-y-2">
                        {feedback.feedback.strengths.map((strength: string, index: number) => (
                          <li key={index} className="text-sm flex items-start">
                            <Check className="h-4 w-4 text-ss-good mr-2 mt-0.5 flex-shrink-0" />
                            <span className="text-foreground/80">{strength}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-2xl bg-ss-warn-chip p-4">
                      <h3 className="text-sm font-bold mb-3 text-ss-peach-deep">Areas for Improvement</h3>
                      <ul className="space-y-2">
                        {feedback.feedback.improvements.map((improvement: string, index: number) => (
                          <li key={index} className="text-sm flex items-start">
                            <AlertCircle className="h-4 w-4 text-ss-warn mr-2 mt-0.5 flex-shrink-0" />
                            <span className="text-foreground/80">{improvement}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-2xl bg-ss-lav-chip p-4">
                      <h3 className="text-sm font-bold mb-3 text-ss-lav-deep">Suggestions</h3>
                      <ul className="space-y-2">
                        {feedback.feedback.suggestions.map((suggestion: string, index: number) => (
                          <li key={index} className="text-sm flex items-start">
                            <span className="h-5 w-5 bg-card rounded-full flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">
                              <span className="text-ss-lav-deep text-xs font-bold">{index + 1}</span>
                            </span>
                            <span className="text-foreground/80">{suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="ss-card ss-card-warm">
                  <CardHeader className="pb-3">
                    <CardTitle>Your coach</CardTitle>
                    <CardDescription>Following you, step by step.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {STAR_STEPS.map((step) =>
                        step === currentStarStep ? (
                          <div
                            key={step}
                            className={`rounded-xl border-l-4 p-3 text-sm ${STEP_STYLES[step].hintBox}`}
                          >
                            <b className={STEP_STYLES[step].hintText}>{STEP_STYLES[step].label}.</b>{' '}
                            <span className="text-foreground/85">{getStepTip(step)}</span>
                          </div>
                        ) : (
                          <div
                            key={step}
                            className="flex items-center gap-2.5 px-1 py-1.5 text-sm text-muted-foreground"
                          >
                            <span
                              className={`h-2 w-2 rounded-sm flex-shrink-0 ${
                                response[step]?.trim() ? STEP_STYLES[step].bar : 'bg-ss-track'
                              }`}
                            />
                            {STEP_STYLES[step].label}
                            <span className="text-xs">— {STEP_STYLES[step].prompt}</span>
                          </div>
                        )
                      )}
                    </div>
                    <p className="ss-serif text-sm text-ss-peach-deep mt-4">
                      Aim for ninety seconds spoken aloud — with at least one number.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
