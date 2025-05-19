import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/use-user';
import { supabase } from '@/integrations/supabase/client';
import { Spinner } from '@/components/ui/spinner';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Check, AlertCircle, Link as LinkIcon, RefreshCw, ExternalLink } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { LocalStorageUtils } from '@/utils/localStorageUtils';
import { Link } from 'react-router-dom';

interface StudyGuide {
  id: string;
  competencies: {
    technical: string[];
    behavioral: string[];
  };
  questions: {
    id: string;
    type: 'behavioral' | 'technical';
    question: string;
    targetCompetency: string;
  }[];
  technical_checklist: {
    skill: string;
    importance: 'high' | 'medium' | 'low';
    resources?: string[];
  }[];
}

export default function JobDescription() {
  const { toast } = useToast();
  const { user } = useUser();
  const [jobUrl, setJobUrl] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [studyGuide, setStudyGuide] = useState<StudyGuide | null>(null);
  const [activeTab, setActiveTab] = useState('description');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      // Try to load study guide from local storage
      const cachedStudyGuide = LocalStorageUtils.getStudyGuide(user.id);
      if (cachedStudyGuide) {
        console.log('Loaded study guide from local storage');
        setStudyGuide(cachedStudyGuide);
        // Only switch to study guide tab if there's data
        setActiveTab('study-guide');
      }
      setIsLoading(false);
    }
  }, [user]);

  const handleUrlExtract = async () => {
    if (!jobUrl) {
      toast({
        title: 'URL Required',
        description: 'Please enter a job posting URL',
        variant: 'destructive',
      });
      return;
    }

    setIsExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-job-description', {
        body: { url: jobUrl }
      });

      if (error) throw error;

      if (data?.jobDescription) {
        setJobDescription(data.jobDescription);
        toast({
          title: 'Description Extracted',
          description: 'Job description was successfully extracted',
        });
      } else {
        toast({
          title: 'Extraction Failed',
          description: 'Could not extract job description from URL',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error extracting job description:', error);
      toast({
        title: 'Extraction Error',
        description: 'An error occurred while extracting the job description',
        variant: 'destructive',
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleAnalyze = async () => {
    if (!jobDescription.trim()) {
      toast({
        title: 'Description Required',
        description: 'Please enter or extract a job description',
        variant: 'destructive',
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      // First save the job description
      const { data: jobData, error: jobError } = await supabase
        .from('job_descriptions')
        .insert({
          user_id: user?.id,
          source_type: jobUrl ? 'url' : 'manual',
          source_url: jobUrl || null,
          raw_text: jobDescription,
        })
        .select()
        .single();

      if (jobError) throw jobError;

      // Generate study guide
      const { data: guideData, error: guideError } = await supabase
        .functions.invoke('generate-study-guide', {
          body: { jobDescriptionId: jobData.id }
        });

      if (guideError) throw guideError;

      // Save study guide to local storage for future access
      if (user && guideData) {
        LocalStorageUtils.saveStudyGuide(user.id, guideData);
      }

      setStudyGuide(guideData);
      setActiveTab('study-guide');
      toast({
        title: 'Analysis Complete',
        description: 'Your personalized study guide has been generated',
      });
    } catch (error) {
      console.error('Error analyzing job description:', error);
      toast({
        title: 'Analysis Error',
        description: 'An error occurred while analyzing the job description',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    if (user) {
      // Clear the study guide from local storage
      window.localStorage.removeItem(`study_guide_${user.id}`);
      setStudyGuide(null);
      setActiveTab('description');
      toast({
        title: 'Reset Complete',
        description: 'Your study guide has been reset',
      });
    }
  };

  // Helper function to get the practice URL based on question type
  const getPracticeUrl = (question: any) => {
    if (question.type === 'behavioral') {
      return `/interview-prep/star-practice?questionId=${question.id}`;
    } else {
      return `/interview-prep/code-practice?questionId=${question.id}`;
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

  return (
    <AppLayout>
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Job Description Analysis</h1>
          <p className="text-muted-foreground">
            Analyze job descriptions to get personalized study guides and practice materials.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="description">Job Description</TabsTrigger>
              <TabsTrigger value="study-guide" disabled={!studyGuide}>
                Study Guide
              </TabsTrigger>
            </TabsList>
            
            {studyGuide && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleReset}
                className="flex items-center gap-1"
              >
                <RefreshCw className="h-4 w-4" />
                Reset
              </Button>
            )}
          </div>

          <TabsContent value="description">
            <Card>
              <CardHeader>
                <CardTitle>Job Description</CardTitle>
                <CardDescription>
                  Enter a job posting URL or paste the job description directly.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex gap-4">
                      <Input
                        placeholder="https://example.com/jobs/123"
                        value={jobUrl}
                        onChange={(e) => setJobUrl(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        onClick={handleUrlExtract}
                        disabled={isExtracting || !jobUrl}
                        variant="secondary"
                      >
                        {isExtracting ? (
                          <>
                            <Spinner size="sm" className="mr-2" />
                            Extracting...
                          </>
                        ) : (
                          <>
                            <LinkIcon className="h-4 w-4 mr-2" />
                            Extract
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Paste a job posting URL and click extract to automatically import the job description
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Textarea
                      placeholder="Or paste the job description here..."
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      className="min-h-[300px]"
                    />
                    <p className="text-sm text-muted-foreground">
                      The more detailed the job description, the better the analysis will be
                    </p>
                  </div>

                  <Button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || !jobDescription.trim()}
                    className="w-full"
                  >
                    {isAnalyzing ? (
                      <>
                        <Spinner size="sm" className="mr-2" />
                        Analyzing...
                      </>
                    ) : (
                      'Analyze Description'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="study-guide">
            {studyGuide && (
              <div className="space-y-8">
                <Card>
                  <CardHeader>
                    <CardTitle>Required Competencies</CardTitle>
                    <CardDescription>
                      Key technical and behavioral competencies identified from the job description.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Technical Competencies</h3>
                        <div className="flex flex-wrap gap-2">
                          {studyGuide.competencies.technical.map((comp, index) => (
                            <Badge key={index} variant="secondary">
                              {comp}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Behavioral Competencies</h3>
                        <div className="flex flex-wrap gap-2">
                          {studyGuide.competencies.behavioral.map((comp, index) => (
                            <Badge key={index} variant="secondary">
                              {comp}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Practice Questions</CardTitle>
                    <CardDescription>
                      Curated questions to help you prepare for the interview.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Behavioral Questions</h3>
                        <ul className="space-y-4">
                          {studyGuide.questions
                            .filter((q) => q.type === 'behavioral')
                            .map((question) => (
                              <li key={question.id} className="space-y-1">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-medium">{question.question}</p>
                                    <p className="text-sm text-muted-foreground">
                                      Target Competency: {question.targetCompetency}
                                    </p>
                                  </div>
                                  <Link to={`/interview-prep/star-practice?questionId=${question.id}`}>
                                    <Button variant="outline" size="sm" className="flex items-center gap-1">
                                      <ExternalLink className="h-3 w-3" />
                                      Practice
                                    </Button>
                                  </Link>
                                </div>
                              </li>
                            ))}
                        </ul>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Technical Questions</h3>
                        <ul className="space-y-4">
                          {studyGuide.questions
                            .filter((q) => q.type === 'technical')
                            .map((question) => (
                              <li key={question.id} className="space-y-1">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-medium">{question.question}</p>
                                    <p className="text-sm text-muted-foreground">
                                      Target Competency: {question.targetCompetency}
                                    </p>
                                  </div>
                                  <Link to={`/interview-prep/code-practice?questionId=${question.id}`}>
                                    <Button variant="outline" size="sm" className="flex items-center gap-1">
                                      <ExternalLink className="h-3 w-3" />
                                      Practice
                                    </Button>
                                  </Link>
                                </div>
                              </li>
                            ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Technical Skills Checklist</CardTitle>
                    <CardDescription>
                      Track your preparation progress for required technical skills.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-4">
                      {studyGuide.technical_checklist.map((item, index) => (
                        <li key={index} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{item.skill}</p>
                              <Badge variant="outline" className="mt-1">
                                {item.importance} priority
                              </Badge>
                            </div>
                            {item.resources && item.resources.length > 0 && (
                              <Button variant="ghost" size="sm">
                                View Resources
                              </Button>
                            )}
                          </div>
                          <Progress value={0} className="h-2" />
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
