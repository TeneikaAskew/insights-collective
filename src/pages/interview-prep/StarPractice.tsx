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
import { Check, AlertCircle, ChevronLeft, ChevronRight, History as HistoryIcon } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';

interface StarResponse {
  id: string;
  question_id: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  ai_feedback: {
    overall_score: number;
    structure_score: number;
    content_score: number;
    clarity_score: number;
    strengths: string[];
    areas_for_improvement: string[];
    suggestions: string[];
  };
  submitted_at: string;
}

interface Question {
  id: string;
  question: string;
  targetCompetency: string;
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

  useEffect(() => {
    loadQuestions();
    loadResponses();
  }, []);

  const loadQuestions = async () => {
    try {
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
      setResponses(data || []);
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

      // Update responses list
      setResponses(prev => [{ ...responseData, ai_feedback: feedbackData }, ...prev]);
      
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
              <Button onClick={() => window.history.back()}>Go Back</Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const currentQuestionIndex = questions.findIndex(q => q.id === selectedQuestion?.id);
  const currentQuestion = questions[currentQuestionIndex];

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
          <TabsList>
            <TabsTrigger value="practice">Practice</TabsTrigger>
            <TabsTrigger value="history">Response History</TabsTrigger>
          </TabsList>

          <TabsContent value="practice">
            <div className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle>Question</CardTitle>
                  <CardDescription>
                    Answer the following behavioral question using the STAR method.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {currentQuestion ? (
                    <div className="space-y-4">
                      <p className="text-lg font-medium">{currentQuestion.question}</p>
                      <Badge variant="outline">
                        Competency: {currentQuestion.targetCompetency}
                      </Badge>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">
                      No practice questions available. Please analyze a job description first.
                    </p>
                  )}
                </CardContent>
              </Card>

              {currentQuestion && (
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

                    <Button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="w-full"
                    >
                      {isSubmitting ? (
                        <>
                          <Spinner size="sm" className="mr-2" />
                          Submitting...
                        </>
                      ) : (
                        'Submit for Feedback'
                      )}
                    </Button>
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
                          {questions.find(q => q.id === response.question_id)?.question}
                        </CardTitle>
                        <CardDescription>
                          Submitted on {new Date(response.submitted_at).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      {response.ai_feedback && (
                        <div className="flex items-center gap-2">
                          <Badge variant={response.ai_feedback.overall_score >= 8 ? 'default' : 'secondary'}>
                            Score: {response.ai_feedback.overall_score}/10
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
                          
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <p className="text-sm font-medium">Structure</p>
                              <Badge variant="outline">
                                {response.ai_feedback.structure_score}/10
                              </Badge>
                            </div>
                            <div>
                              <p className="text-sm font-medium">Content</p>
                              <Badge variant="outline">
                                {response.ai_feedback.content_score}/10
                              </Badge>
                            </div>
                            <div>
                              <p className="text-sm font-medium">Clarity</p>
                              <Badge variant="outline">
                                {response.ai_feedback.clarity_score}/10
                              </Badge>
                            </div>
                          </div>

                          <div>
                            <h4 className="text-sm font-medium mb-2">Strengths</h4>
                            <ul className="list-disc list-inside space-y-1">
                              {response.ai_feedback.strengths.map((strength, index) => (
                                <li key={index} className="text-sm text-muted-foreground">
                                  {strength}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div>
                            <h4 className="text-sm font-medium mb-2">Areas for Improvement</h4>
                            <ul className="list-disc list-inside space-y-1">
                              {response.ai_feedback.areas_for_improvement.map((area, index) => (
                                <li key={index} className="text-sm text-muted-foreground">
                                  {area}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div>
                            <h4 className="text-sm font-medium mb-2">Suggestions</h4>
                            <ul className="list-disc list-inside space-y-1">
                              {response.ai_feedback.suggestions.map((suggestion, index) => (
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
