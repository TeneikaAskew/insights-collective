
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/use-user';
import { supabase } from '@/integrations/supabase/client';
import { Spinner } from '@/components/ui/spinner';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Check, AlertCircle, ChevronLeft, ChevronRight, Flip, Star, ArrowLeft } from 'lucide-react';
import { LocalStorageUtils } from '@/utils/localStorageUtils';
import { useSearchParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';

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
  const [isFlipped, setIsFlipped] = useState(false);
  const [activeSTARSection, setActiveSTARSection] = useState<'situation' | 'task' | 'action' | 'result'>('situation');
  const [completedSections, setCompletedSections] = useState<Set<string>>(new Set());
  const [sessionStreak, setSessionStreak] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);

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

  // Check if all sections have content
  useEffect(() => {
    const newCompletedSections = new Set(completedSections);
    
    if (response.situation?.trim()) newCompletedSections.add('situation');
    else newCompletedSections.delete('situation');
    
    if (response.task?.trim()) newCompletedSections.add('task');
    else newCompletedSections.delete('task');
    
    if (response.action?.trim()) newCompletedSections.add('action');
    else newCompletedSections.delete('action');
    
    if (response.result?.trim()) newCompletedSections.add('result');
    else newCompletedSections.delete('result');
    
    setCompletedSections(newCompletedSections);
  }, [response]);

  const findAndSetTargetQuestion = (questionId: string) => {
    const index = questions.findIndex(q => q.id === questionId);
    if (index !== -1) {
      setCurrentQuestionIndex(index);
      setIsFlipped(false);
      
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

  const handleSTARSectionChange = (section: 'situation' | 'task' | 'action' | 'result') => {
    setActiveSTARSection(section);
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

      // Show confetti and increment streak
      setShowConfetti(true);
      setSessionStreak(prev => prev + 1);
      
      // Automatically flip to show feedback
      setIsFlipped(true);

      toast({
        title: 'Response Submitted',
        description: 'Your STAR response has been evaluated.',
      });
      
      setTimeout(() => {
        setShowConfetti(false);
      }, 3000);
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
  const allSectionsCompleted = completedSections.size === 4;
  const progressPercentage = Math.round((completedSections.size / 4) * 100);

  return (
    <AppLayout>
      <div className="container mx-auto py-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Button variant="outline" size="sm" onClick={() => navigate('/interview-prep')}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Interview Prep
              </Button>
            </div>
            <h1 className="text-4xl font-bold mb-2">STAR Response Practice</h1>
            <p className="text-muted-foreground">
              Practice answering behavioral interview questions using the STAR method.
            </p>
          </div>
          
          <div className="flex flex-col items-center">
            <div className="flex items-center justify-center bg-purple-50 dark:bg-purple-900/20 p-3 rounded-full h-16 w-16 mb-1">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{sessionStreak}</div>
            </div>
            <span className="text-sm text-muted-foreground">Question Streak</span>
          </div>
        </div>

        <div className="grid gap-8 grid-cols-1 lg:grid-cols-12">
          {/* Progress bar and navigation */}
          <div className="lg:col-span-12 flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevious}
                disabled={currentQuestionIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <span className="text-sm font-medium">
                Question {currentQuestionIndex + 1} of {questions.length}
              </span>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleNext}
                disabled={currentQuestionIndex === questions.length - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            
            {!isFlipped && (
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">{progressPercentage}% Complete</span>
                <div className="w-32">
                  <Progress value={progressPercentage} className="h-2" />
                </div>
              </div>
            )}
          </div>

          {/* Main flashcard area */}
          <div className="lg:col-span-12">
            <div className="perspective-1000 w-full h-full">
              <motion.div 
                className="relative w-full h-full"
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.6 }}
                style={{ transformStyle: 'preserve-3d' }}
              >
                {/* Front of card */}
                <motion.div 
                  className={`absolute w-full h-full backface-hidden ${isFlipped ? 'invisible' : 'visible'}`}
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  <Card className="h-full shadow-lg">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <CardTitle className="text-2xl mb-1">{currentQuestion?.question}</CardTitle>
                          <CardDescription className="text-base flex items-center">
                            <span className="mr-2">Target Competency:</span>
                            <Badge variant="secondary" className="font-normal">
                              {currentQuestion?.targetCompetency}
                            </Badge>
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
                            <Flip className="h-4 w-4 mr-1" />
                            View Feedback
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pb-6">
                      {/* STAR Tab Navigation */}
                      <div className="mb-4 grid grid-cols-4 gap-2">
                        {(['situation', 'task', 'action', 'result'] as const).map((section) => (
                          <Button
                            key={section}
                            variant={activeSTARSection === section ? "default" : "outline"}
                            className={`capitalize ${
                              completedSections.has(section) && activeSTARSection !== section 
                                ? "border-green-500 dark:border-green-400"
                                : ""
                            }`}
                            onClick={() => handleSTARSectionChange(section)}
                          >
                            {section}
                            {completedSections.has(section) && (
                              <Check className="h-3 w-3 ml-1 text-green-500" />
                            )}
                          </Button>
                        ))}
                      </div>
                      
                      {/* Current section active textarea */}
                      <div className="mb-4">
                        <label className="text-sm font-medium mb-1 block capitalize">
                          {activeSTARSection}
                          {activeSTARSection === 'situation' && " - Describe the context and background"}
                          {activeSTARSection === 'task' && " - What was your responsibility?"}
                          {activeSTARSection === 'action' && " - What steps did you take?"}
                          {activeSTARSection === 'result' && " - What was the outcome?"}
                        </label>
                        <Textarea
                          placeholder={
                            activeSTARSection === 'situation' 
                              ? "Set the scene and provide context..." 
                              : activeSTARSection === 'task'
                              ? "Describe your specific responsibility or goal..."
                              : activeSTARSection === 'action'
                              ? "Explain what actions you took to address the situation..."
                              : "Share the outcomes and results of your actions..."
                          }
                          value={response[activeSTARSection] || ''}
                          onChange={(e) => setResponse({ ...response, [activeSTARSection]: e.target.value })}
                          rows={6}
                          className="resize-none"
                        />
                      </div>

                      {/* Tips and guidance */}
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md mb-4">
                        <h4 className="text-sm font-medium flex items-center mb-1 text-blue-700 dark:text-blue-300">
                          <Star className="h-4 w-4 mr-2" />
                          Tips for {activeSTARSection.charAt(0).toUpperCase() + activeSTARSection.slice(1)}
                        </h4>
                        <p className="text-sm text-blue-600 dark:text-blue-200">
                          {activeSTARSection === 'situation' && 
                            "Be specific about when and where this happened. Provide enough context so the interviewer understands the challenge."}
                          {activeSTARSection === 'task' && 
                            "Clearly explain what your responsibility was in this situation. What were you trying to accomplish?"}
                          {activeSTARSection === 'action' && 
                            "Focus on the specific steps YOU took, not what your team did. Use active verbs and be detailed about your contribution."}
                          {activeSTARSection === 'result' && 
                            "Quantify your results if possible (e.g., increased efficiency by 20%). Mention what you learned and how it helped you grow professionally."}
                        </p>
                      </div>
                      
                      {/* Navigation and submission buttons */}
                      <div className="grid grid-cols-2 gap-2 mt-6">
                        <Button
                          variant="outline"
                          onClick={() => {
                            const sections = ['situation', 'task', 'action', 'result'] as const;
                            const currentIndex = sections.indexOf(activeSTARSection);
                            if (currentIndex > 0) {
                              setActiveSTARSection(sections[currentIndex - 1]);
                            }
                          }}
                          disabled={activeSTARSection === 'situation'}
                        >
                          Previous Section
                        </Button>
                        
                        {activeSTARSection !== 'result' ? (
                          <Button
                            onClick={() => {
                              const sections = ['situation', 'task', 'action', 'result'] as const;
                              const currentIndex = sections.indexOf(activeSTARSection);
                              if (currentIndex < sections.length - 1) {
                                setActiveSTARSection(sections[currentIndex + 1]);
                              }
                            }}
                          >
                            Next Section
                          </Button>
                        ) : (
                          <Button
                            onClick={handleSubmit}
                            disabled={submitting || !allSectionsCompleted}
                          >
                            {submitting ? <Spinner size="sm" className="mr-2" /> : null}
                            Submit Response
                          </Button>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter className="pt-0 pb-4">
                      {currentQuestion?.preparationTips && (
                        <p className="text-sm text-muted-foreground italic">
                          <span className="font-medium">Preparation tip:</span> {currentQuestion.preparationTips}
                        </p>
                      )}
                    </CardFooter>
                  </Card>
                </motion.div>

                {/* Back of card (Feedback) */}
                <motion.div 
                  className={`absolute w-full h-full backface-hidden ${isFlipped ? 'visible' : 'invisible'}`} 
                  style={{ 
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)'
                  }}
                >
                  {feedback && (
                    <Card className="h-full shadow-lg">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <CardTitle className="flex items-center">
                              AI Feedback
                              <Badge className="ml-2 bg-purple-600">
                                Score: {feedback.scores.overall}/10
                              </Badge>
                            </CardTitle>
                            <CardDescription>
                              Analysis of your STAR response
                            </CardDescription>
                          </div>
                          
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleFlip}
                            className="gap-1"
                          >
                            <Flip className="h-4 w-4 mr-1" />
                            Back to Question
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="overflow-auto max-h-[60vh] pb-6">
                        <div className="space-y-6">
                          <div>
                            <h3 className="text-sm font-medium mb-2">Component Scores</h3>
                            <div className="space-y-2">
                              <div>
                                <div className="flex justify-between text-sm mb-1">
                                  <span>Situation</span>
                                  <span>{feedback.scores.situation}/10</span>
                                </div>
                                <Progress 
                                  value={feedback.scores.situation * 10} 
                                  className={`h-2 ${feedback.scores.situation >= 8 ? 'bg-green-500' : feedback.scores.situation >= 5 ? 'bg-amber-500' : 'bg-red-500'}`}
                                />
                              </div>
                              <div>
                                <div className="flex justify-between text-sm mb-1">
                                  <span>Task</span>
                                  <span>{feedback.scores.task}/10</span>
                                </div>
                                <Progress 
                                  value={feedback.scores.task * 10}
                                  className={`h-2 ${feedback.scores.task >= 8 ? 'bg-green-500' : feedback.scores.task >= 5 ? 'bg-amber-500' : 'bg-red-500'}`}
                                />
                              </div>
                              <div>
                                <div className="flex justify-between text-sm mb-1">
                                  <span>Action</span>
                                  <span>{feedback.scores.action}/10</span>
                                </div>
                                <Progress 
                                  value={feedback.scores.action * 10}
                                  className={`h-2 ${feedback.scores.action >= 8 ? 'bg-green-500' : feedback.scores.action >= 5 ? 'bg-amber-500' : 'bg-red-500'}`}
                                />
                              </div>
                              <div>
                                <div className="flex justify-between text-sm mb-1">
                                  <span>Result</span>
                                  <span>{feedback.scores.result}/10</span>
                                </div>
                                <Progress 
                                  value={feedback.scores.result * 10}
                                  className={`h-2 ${feedback.scores.result >= 8 ? 'bg-green-500' : feedback.scores.result >= 5 ? 'bg-amber-500' : 'bg-red-500'}`}
                                />
                              </div>
                              <div className="mt-2 pt-2 border-t">
                                <div className="flex justify-between text-sm mb-1">
                                  <span className="font-medium">Overall</span>
                                  <span className="font-medium">{feedback.scores.overall}/10</span>
                                </div>
                                <Progress 
                                  value={feedback.scores.overall * 10}
                                  className={`h-3 ${feedback.scores.overall >= 8 ? 'bg-green-500' : feedback.scores.overall >= 5 ? 'bg-amber-500' : 'bg-red-500'}`}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-100 dark:border-gray-800">
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
                      <CardFooter className="pt-0 border-t flex justify-between">
                        {currentQuestionIndex < questions.length - 1 ? (
                          <Button onClick={handleNext} className="w-full mt-4">
                            Practice Next Question
                            <ChevronRight className="h-4 w-4 ml-2" />
                          </Button>
                        ) : (
                          <Button onClick={() => navigate('/interview-prep')} className="w-full mt-4">
                            Back to Interview Prep
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  )}
                </motion.div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Confetti effect when submitting */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50">
          {/* This would be replaced with a proper confetti library in a full implementation */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1, opacity: [0, 1, 0] }}
              transition={{ duration: 1.5 }}
              className="text-4xl"
            >
              🎉
            </motion.div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
