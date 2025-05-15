import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  BrainCircuit, 
  MessageSquarePlus, 
  Lightbulb, 
  FileText, 
  Loader2,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CareerActionPlan } from '@/components/assistants/CareerActionPlan';
import { CareerQuizResults } from '@/components/assistants/CareerQuizResults';
import { CareerPathway } from '@/components/assistants/CareerPathway';
import { CareerPathwayResults } from '@/components/assistants/CareerPathwayResults';
import { AssistantConversation } from '@/components/assistants/AssistantConversation';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Separator } from "@/components/ui/separator"

const AssistantInterface = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [careerReport, setCareerReport] = useState<any>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [adviceQuality, setAdviceQuality] = useState<number | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [isFeedbackUseful, setIsFeedbackUseful] = useState<boolean | null>(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [shouldRequestReport, setShouldRequestReport] = useState(false);

  const quizAttemptId = searchParams.get('quiz');
  const sessionId = searchParams.get('session');
  const pathwaySessionId = searchParams.get('pathwaySession');

  const fetchCareerReport = useCallback(async () => {
    if (!quizAttemptId) return;

    setIsLoadingReport(true);
    try {
      const { data, error } = await supabase
        .from('career_quiz_attempts')
        .select('*')
        .eq('id', quizAttemptId)
        .single();

      if (error) {
        console.error("Error fetching career report:", error);
        toast({
          title: "Error",
          description: "Failed to load career report. Please try again.",
          variant: "destructive"
        });
      } else {
        setCareerReport(data);
      }
    } finally {
      setIsLoadingReport(false);
    }
  }, [quizAttemptId, toast]);

  useEffect(() => {
    fetchCareerReport();
  }, [fetchCareerReport]);

  useEffect(() => {
    // Request a report if none exists yet or if explicitly requested
    if (!careerReport && shouldRequestReport && !isLoadingReport) {
      toast({
        title: "Analyzing your data...",
        description: "We're generating your personalized career report based on your quiz results.",
        variant: "default"
      });

      fetchCareerReport();
    }
  }, [careerReport, shouldRequestReport, isLoadingReport]);

  const handleRequestReport = () => {
    setShouldRequestReport(true);
  };
  
  const handleStartNewQuiz = () => {
    navigate('/career-quiz');
  };

  const handleStartNewPathway = () => {
    navigate('/career-pathway');
  };

  const handleEvaluationClick = async () => {
    toast({
      title: "Evaluating Advice Quality...",
      description: "Our AI is analyzing the quality of the career advice provided.",
      variant: "default"
    });
    setIsEvaluating(true);
    try {
      // Simulate AI evaluation (replace with actual API call)
      await new Promise(resolve => setTimeout(resolve, 2000));
      setAdviceQuality(Math.floor(Math.random() * 100)); // Simulate a score
    } catch (error) {
      console.error("Error evaluating advice quality:", error);
      toast({
        title: "Evaluation Failed",
        description: "Failed to evaluate the advice quality. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!conversationId) {
      toast({
        title: "Error",
        description: "No conversation ID found. Please start a conversation first.",
        variant: "destructive"
      });
      return;
    }

    if (isFeedbackUseful === null) {
      toast({
        title: "Error",
        description: "Please indicate whether the advice was helpful or not.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmittingFeedback(true);
    try {
      const { error } = await supabase
        .from('user_feedback')
        .insert({
          user_id: user?.id,
          page_path: '/assistant',
          feedback_text: feedbackText,
          is_useful: isFeedbackUseful,
        });

      if (error) {
        console.error("Error submitting feedback:", error);
        toast({
          title: "Feedback Failed",
          description: "Failed to submit feedback. Please try again.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Feedback Submitted",
          description: "Thank you for your feedback!",
        });
        setFeedbackText('');
        setIsFeedbackUseful(null);
      }
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold">Your AI Career Assistant</h1>
        <p className="text-muted-foreground">
          Get personalized career advice and explore potential pathways.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Career Quiz Results and Action Plan */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Career Quiz Results</CardTitle>
              <CardDescription>
                Based on your quiz, here are your potential career paths.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingReport ? (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-[250px]" />
                  <Skeleton className="h-4 w-[200px]" />
                  <Skeleton className="h-4 w-[220px]" />
                </div>
              ) : careerReport ? (
                <CareerQuizResults report={careerReport} />
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">
                    No quiz results found. Take the career quiz to get personalized recommendations.
                  </p>
                  <Button onClick={handleStartNewQuiz} variant="secondary" className="mt-4">
                    <BrainCircuit className="mr-2 h-4 w-4" />
                    Take Career Quiz
                  </Button>
                </div>
              )}
              {!careerReport && !isLoadingReport && (
                <Button onClick={handleRequestReport} variant="outline" className="w-full mt-4">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generate Report
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Career Action Plan</CardTitle>
              <CardDescription>
                Follow these steps to achieve your career goals.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CareerActionPlan quizAttemptId={quizAttemptId} />
            </CardContent>
          </Card>
        </div>

        {/* Right Column: AI Assistant and Career Pathway */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Career Assistant</CardTitle>
              <CardDescription>
                Get personalized career advice from our AI assistant.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AssistantConversation 
                quizAttemptId={quizAttemptId} 
                onConversationIdChange={setConversationId}
              />
              <div className="mt-4">
                <Button onClick={handleEvaluationClick} disabled={isEvaluating} variant="secondary">
                  {isEvaluating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Evaluating...
                    </>
                  ) : (
                    <>
                      <Lightbulb className="mr-2 h-4 w-4" />
                      Evaluate Advice Quality
                    </>
                  )}
                </Button>
                {adviceQuality !== null && (
                  <div className="mt-2">
                    <Badge variant="outline">
                      Advice Quality: {adviceQuality}%
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Career Pathway Exploration</CardTitle>
              <CardDescription>
                Explore potential career pathways based on your interests.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pathwaySessionId ? (
                <CareerPathwayResults sessionId={pathwaySessionId} />
              ) : (
                <>
                  <CareerPathway />
                  <div className="text-center py-4">
                    <p className="text-muted-foreground">
                      Not sure where to start? Take the career pathway quiz to explore potential career paths.
                    </p>
                    <Button onClick={handleStartNewPathway} variant="secondary" className="mt-4">
                      <FileText className="mr-2 h-4 w-4" />
                      Take Career Pathway Quiz
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold mb-4">Feedback</h2>
        <Card>
          <CardHeader>
            <CardTitle>Help us improve your experience</CardTitle>
            <CardDescription>
              Your feedback is valuable in making this tool better.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-4">
              <div>
                <Label htmlFor="is-useful">Was this advice helpful?</Label>
                <div className="flex items-center space-x-4 mt-2">
                  <Button
                    variant="outline"
                    className="flex items-center"
                    onClick={() => setIsFeedbackUseful(true)}
                    disabled={isSubmittingFeedback}
                  >
                    <ThumbsUp className="mr-2 h-4 w-4" />
                    Yes
                  </Button>
                  <Button
                    variant="outline"
                    className="flex items-center"
                    onClick={() => setIsFeedbackUseful(false)}
                    disabled={isSubmittingFeedback}
                  >
                    <ThumbsDown className="mr-2 h-4 w-4" />
                    No
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="feedback">Additional Feedback</Label>
                <Textarea
                  id="feedback"
                  placeholder="Tell us more about your experience..."
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  disabled={isSubmittingFeedback}
                />
              </div>
            </div>
            <Button onClick={handleSubmitFeedback} disabled={isSubmittingFeedback}>
              {isSubmittingFeedback ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Feedback"
              )}
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default AssistantInterface;
