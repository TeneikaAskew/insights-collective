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
import { Checkbox } from '@/components/ui/checkbox';
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
  const [checkedSkills, setCheckedSkills] = useState<Set<string>>(new Set());

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

  const handleSkillCheck = (skill: string, checked: boolean) => {
    const newCheckedSkills = new Set(checkedSkills);
    if (checked) {
      newCheckedSkills.add(skill);
    } else {
      newCheckedSkills.delete(skill);
    }
    setCheckedSkills(newCheckedSkills);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="container mx-auto py-8">
          <Card className="shadow-md border-purple-200/50">
            <CardContent className="flex items-center justify-center py-8">
              <Spinner size="lg" className="text-primary" />
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-8 relative">
        <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 rounded-xl -z-10"></div>
        
        <div className="mb-8 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-2xl -z-10"></div>
          <div className="flex items-center gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={() => navigate('/interview-prep')} 
              className="border-primary/20 bg-white/90 hover:bg-primary/5 shadow-sm text-primary/90">
              <ChevronLeft className="h-4 w-4 mr-1 text-primary" />
              Back to Interview Prep
            </Button>
          </div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Job Description Analysis
          </h1>
          <p className="text-muted-foreground font-medium">
            Analyze job descriptions to get personalized study guides and practice materials
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <div className="flex items-center justify-between">
            <TabsList className="bg-white/70 backdrop-blur-sm shadow-md border border-border/30">
              <TabsTrigger 
                value="description" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary data-[state=active]:text-primary-foreground"
              >
                Job Description
              </TabsTrigger>
              <TabsTrigger 
                value="study-guide" 
                disabled={!studyGuide}
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary data-[state=active]:text-primary-foreground"
              >
                Study Guide
              </TabsTrigger>
            </TabsList>
            
            {studyGuide && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleReset}
                className="flex items-center gap-1 border-border/30 bg-white shadow-sm hover:bg-destructive/10 hover:text-destructive"
              >
                <RefreshCw className="h-4 w-4" />
                Reset
              </Button>
            )}
          </div>

          <TabsContent value="description">
            <Card className="border-border/30 shadow-md overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-card/80 to-card border-b border-border/20">
                <CardTitle className="text-foreground">Job Description</CardTitle>
                <CardDescription>
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
                        className="flex-1 border-border/30 focus-visible:ring-primary/30"
                      />
                      <Button
                        onClick={handleUrlExtract}
                        disabled={isExtracting || !jobUrl}
                        variant="secondary"
                        className="text-secondary-foreground hover:opacity-90"
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
                      className="min-h-[300px] border-border/30 focus-visible:ring-primary/30 bg-white/90"
                    />
                    <p className="text-sm text-muted-foreground">
                      The more detailed the job description, the better the analysis will be
                    </p>
                  </div>

                  <Button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || !jobDescription.trim()}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-md transition-all"
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
                <Card className="border-border/30 shadow-md overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-card/80 to-card/90 border-b border-border/20">
                    <CardTitle className="text-foreground">Required Competencies</CardTitle>
                    <CardDescription>
                      Key technical and behavioral competencies identified from the job description.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="bg-white pt-6">
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-2 text-foreground flex items-center">
                          <span className="w-2 h-6 bg-gradient-to-b from-primary/60 to-primary rounded-full mr-2"></span>
                          Technical Competencies
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {studyGuide.competencies.technical.map((comp, index) => (
                            <Badge key={index} variant="secondary" className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors">
                              {comp}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-2 text-foreground flex items-center">
                          <span className="w-2 h-6 bg-gradient-to-b from-secondary/60 to-secondary rounded-full mr-2"></span>
                          Behavioral Competencies
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {studyGuide.competencies.behavioral.map((comp, index) => (
                            <Badge key={index} variant="secondary" className="bg-secondary/10 text-secondary border border-secondary/20 hover:bg-secondary/20 transition-colors">
                              {comp}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/30 shadow-md overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-card/80 to-card/90 border-b border-border/20">
                    <CardTitle className="text-foreground">Practice Questions</CardTitle>
                    <CardDescription>
                      Curated questions to help you prepare for the interview.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 bg-white">
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-4 text-foreground flex items-center">
                          <span className="w-2 h-6 bg-gradient-to-b from-secondary/60 to-secondary rounded-full mr-2"></span>
                          Behavioral Questions
                        </h3>
                        <ul className="space-y-4">
                          {studyGuide.questions
                            .filter((q) => q.type === 'behavioral')
                            .map((question) => (
                              <li key={question.id} className="p-4 bg-gradient-to-r from-secondary/5 to-white rounded-lg border border-border/30 hover:shadow-md transition-all">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-medium text-foreground">{question.question}</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                      Target Competency: <span className="font-medium">{question.targetCompetency}</span>
                                    </p>
                                  </div>
                                  <Link to={`/interview-prep/star-practice?questionId=${question.id}`}>
                                    <Button variant="outline" size="sm" className="flex items-center gap-1 bg-white border-secondary/20 text-secondary hover:bg-secondary/10">
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
                        <h3 className="text-lg font-semibold mb-4 text-foreground flex items-center">
                          <span className="w-2 h-6 bg-gradient-to-b from-primary/60 to-primary rounded-full mr-2"></span>
                          Technical Questions
                        </h3>
                        <ul className="space-y-4">
                          {studyGuide.questions
                            .filter((q) => q.type === 'technical')
                            .map((question) => (
                              <li key={question.id} className="p-4 bg-gradient-to-r from-primary/5 to-white rounded-lg border border-border/30 hover:shadow-md transition-all">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-medium text-foreground">{question.question}</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                      Target Competency: <span className="font-medium">{question.targetCompetency}</span>
                                    </p>
                                  </div>
                                  <Link to={`/interview-prep/code-practice?questionId=${question.id}`}>
                                    <Button variant="outline" size="sm" className="flex items-center gap-1 bg-white border-primary/20 text-primary hover:bg-primary/10">
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

                <Card className="border-border/30 shadow-md overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-card/80 to-card/90 border-b border-border/20">
                    <CardTitle className="text-foreground">Technical Skills Checklist</CardTitle>
                    <CardDescription>
                      Check off skills as you prepare and study for the interview.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 bg-white">
                    <div className="space-y-3 text-left">
                      {studyGuide.technical_checklist.map((item, index) => (
                        <div key={index} className="flex items-center space-x-3 p-3 bg-gradient-to-r from-gray-50/80 to-white rounded-lg border border-border/20 hover:shadow-sm transition-all">
                          <Checkbox
                            id={`skill-${index}`}
                            checked={checkedSkills.has(item.skill)}
                            onCheckedChange={(checked) => handleSkillCheck(item.skill, checked as boolean)}
                            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                          />
                          <div className="flex-1 text-left">
                            <label 
                              htmlFor={`skill-${index}`} 
                              className={`font-medium cursor-pointer transition-colors ${
                                checkedSkills.has(item.skill) ? 'text-muted-foreground line-through' : 'text-foreground'
                              }`}
                            >
                              {item.skill}
                            </label>
                            <div className="mt-1">
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${
                                  item.importance === 'high' 
                                    ? 'bg-destructive/10 text-destructive/90 border-destructive/20' 
                                    : item.importance === 'medium'
                                    ? 'bg-amber-100/50 text-amber-800 border-amber-200'
                                    : 'bg-gray-100 text-gray-700 border-gray-200'
                                }`}
                              >
                                {item.importance} priority
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                      {studyGuide.technical_checklist.length > 0 && (
                        <div className="pt-3 border-t border-border/20">
                          <p className="text-sm text-muted-foreground text-center">
                            {checkedSkills.size} of {studyGuide.technical_checklist.length} skills prepared
                          </p>
                        </div>
                      )}
                    </div>
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
