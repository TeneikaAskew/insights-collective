
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
import { Check, AlertCircle, Link as LinkIcon, RefreshCw, ExternalLink, ChevronLeft } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { LocalStorageUtils } from '@/utils/localStorageUtils';
import { Link, useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();
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
          <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 shadow-md border-purple-100">
            <CardContent className="flex items-center justify-center py-8">
              <Spinner size="lg" className="text-purple-600" />
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-8 relative">
        <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-br from-purple-100/30 via-indigo-100/20 to-blue-100/30 rounded-xl -z-10"></div>
        
        <div className="mb-8 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-2xl -z-10"></div>
          <div className="flex items-center gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={() => navigate('/interview-prep')} 
              className="border-indigo-200 bg-white/90 hover:bg-indigo-50 shadow-sm text-indigo-700">
              <ChevronLeft className="h-4 w-4 mr-1 text-indigo-600" />
              Back to Interview Prep
            </Button>
          </div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent">
            Job Description Analysis
          </h1>
          <p className="text-muted-foreground font-medium text-indigo-600/80">
            Analyze job descriptions to get personalized study guides and practice materials
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <div className="flex items-center justify-between">
            <TabsList className="bg-white/70 backdrop-blur-sm shadow-md border border-purple-100">
              <TabsTrigger 
                value="description" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white"
              >
                Job Description
              </TabsTrigger>
              <TabsTrigger 
                value="study-guide" 
                disabled={!studyGuide}
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white"
              >
                Study Guide
              </TabsTrigger>
            </TabsList>
            
            {studyGuide && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleReset}
                className="flex items-center gap-1 border-indigo-200 bg-white shadow-sm hover:bg-red-50 hover:text-red-600"
              >
                <RefreshCw className="h-4 w-4" />
                Reset
              </Button>
            )}
          </div>

          <TabsContent value="description">
            <Card className="border-indigo-100 shadow-lg overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100">
                <CardTitle className="text-indigo-800">Job Description</CardTitle>
                <CardDescription className="text-indigo-600">
                  Enter a job posting URL or paste the job description directly.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6 bg-white">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex gap-4">
                      <Input
                        placeholder="https://example.com/jobs/123"
                        value={jobUrl}
                        onChange={(e) => setJobUrl(e.target.value)}
                        className="flex-1 border-indigo-200 focus-visible:ring-indigo-300"
                      />
                      <Button
                        onClick={handleUrlExtract}
                        disabled={isExtracting || !jobUrl}
                        variant="secondary"
                        className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600"
                      >
                        {isExtracting ? (
                          <>
                            <Spinner size="sm" className="mr-2 text-white" />
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
                      className="min-h-[300px] border-indigo-200 focus-visible:ring-indigo-300 bg-white/90"
                    />
                    <p className="text-sm text-muted-foreground">
                      The more detailed the job description, the better the analysis will be
                    </p>
                  </div>

                  <Button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || !jobDescription.trim()}
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-md hover:shadow-lg transition-all"
                  >
                    {isAnalyzing ? (
                      <>
                        <Spinner size="sm" className="mr-2 text-white" />
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
                <Card className="border-purple-100 shadow-lg overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100">
                    <CardTitle className="text-purple-800">Required Competencies</CardTitle>
                    <CardDescription className="text-purple-600">
                      Key technical and behavioral competencies identified from the job description.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="bg-white pt-6">
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-2 text-indigo-700 flex items-center">
                          <span className="w-2 h-6 bg-gradient-to-b from-indigo-400 to-indigo-600 rounded-full mr-2"></span>
                          Technical Competencies
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {studyGuide.competencies.technical.map((comp, index) => (
                            <Badge key={index} variant="secondary" className="bg-indigo-100 text-indigo-700 border border-indigo-200 hover:bg-indigo-200 transition-colors">
                              {comp}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-2 text-purple-700 flex items-center">
                          <span className="w-2 h-6 bg-gradient-to-b from-purple-400 to-purple-600 rounded-full mr-2"></span>
                          Behavioral Competencies
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {studyGuide.competencies.behavioral.map((comp, index) => (
                            <Badge key={index} variant="secondary" className="bg-purple-100 text-purple-700 border border-purple-200 hover:bg-purple-200 transition-colors">
                              {comp}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-purple-100 shadow-lg overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100">
                    <CardTitle className="text-purple-800">Practice Questions</CardTitle>
                    <CardDescription className="text-purple-600">
                      Curated questions to help you prepare for the interview.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 bg-white">
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-4 text-purple-700 flex items-center">
                          <span className="w-2 h-6 bg-gradient-to-b from-purple-400 to-purple-600 rounded-full mr-2"></span>
                          Behavioral Questions
                        </h3>
                        <ul className="space-y-4">
                          {studyGuide.questions
                            .filter((q) => q.type === 'behavioral')
                            .map((question) => (
                              <li key={question.id} className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-100 hover:shadow-md transition-all">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-medium text-purple-800">{question.question}</p>
                                    <p className="text-sm text-purple-600 mt-1">
                                      Target Competency: <span className="font-medium">{question.targetCompetency}</span>
                                    </p>
                                  </div>
                                  <Link to={`/interview-prep/star-practice?questionId=${question.id}`}>
                                    <Button variant="outline" size="sm" className="flex items-center gap-1 bg-white border-purple-200 text-purple-700 hover:bg-purple-50">
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
                        <h3 className="text-lg font-semibold mb-4 text-indigo-700 flex items-center">
                          <span className="w-2 h-6 bg-gradient-to-b from-indigo-400 to-indigo-600 rounded-full mr-2"></span>
                          Technical Questions
                        </h3>
                        <ul className="space-y-4">
                          {studyGuide.questions
                            .filter((q) => q.type === 'technical')
                            .map((question) => (
                              <li key={question.id} className="p-4 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg border border-indigo-100 hover:shadow-md transition-all">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-medium text-indigo-800">{question.question}</p>
                                    <p className="text-sm text-indigo-600 mt-1">
                                      Target Competency: <span className="font-medium">{question.targetCompetency}</span>
                                    </p>
                                  </div>
                                  <Link to={`/interview-prep/code-practice?questionId=${question.id}`}>
                                    <Button variant="outline" size="sm" className="flex items-center gap-1 bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50">
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

                <Card className="border-teal-100 shadow-lg overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-teal-50 to-green-50 border-b border-teal-100">
                    <CardTitle className="text-teal-800">Technical Skills Checklist</CardTitle>
                    <CardDescription className="text-teal-600">
                      Track your preparation progress for required technical skills.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 bg-white">
                    <ul className="space-y-4">
                      {studyGuide.technical_checklist.map((item, index) => (
                        <li key={index} className="p-4 bg-gradient-to-r from-teal-50/50 to-emerald-50/50 rounded-lg border border-teal-100 hover:shadow-md transition-all">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="font-medium text-teal-800">{item.skill}</p>
                              <Badge 
                                variant="outline" 
                                className={`mt-1 ${
                                  item.importance === 'high' 
                                    ? 'bg-red-100 text-red-800 border-red-200' 
                                    : item.importance === 'medium'
                                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                                    : 'bg-blue-100 text-blue-800 border-blue-200'
                                }`}
                              >
                                {item.importance} priority
                              </Badge>
                            </div>
                            {item.resources && item.resources.length > 0 && (
                              <Button variant="ghost" size="sm" className="text-teal-700 hover:text-teal-900 hover:bg-teal-50">
                                View Resources
                              </Button>
                            )}
                          </div>
                          <Progress value={0} className="h-2 bg-teal-100" indicatorClassName="bg-gradient-to-r from-teal-500 to-emerald-500" />
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
