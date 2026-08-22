import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useRateLimitedInvoke } from '@/hooks/useRateLimitedInvoke';
import { useUser } from '@/hooks/use-user';
import { supabase } from '@/integrations/supabase/client';
import { functionErrorMessage } from '@/lib/functionErrorMessage';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { FileSearch, Link as LinkIcon, RefreshCw, ExternalLink, ChevronLeft } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import AppLayout from '@/components/layout/AppLayout';
import { LocalStorageUtils } from '@/utils/localStorageUtils';
import { Link, useNavigate } from 'react-router-dom';

import { createLogger } from '@/utils/logger';

const logger = createLogger('JobDescription');

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

const priorityBadgeClass = (importance: 'high' | 'medium' | 'low') =>
  importance === 'high'
    ? 'bg-ss-bad-chip text-ss-bad border-ss-bad/30'
    : importance === 'medium'
    ? 'bg-ss-warn-chip text-ss-warn border-ss-warn/30'
    : 'bg-ss-track text-muted-foreground border-border';

export default function JobDescription() {
  const { toast } = useToast();
  const invokeWithRateLimit = useRateLimitedInvoke();
  const { user } = useUser();
  const navigate = useNavigate();
  const [jobUrl, setJobUrl] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [studyGuide, setStudyGuide] = useState<StudyGuide | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [checkedSkills, setCheckedSkills] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      // Try to load study guide from local storage
      const cachedStudyGuide = LocalStorageUtils.getStudyGuide(user.id);
      if (cachedStudyGuide) {
        logger.log('Loaded study guide from local storage');
        setStudyGuide(cachedStudyGuide);
      }
    }
    // Always clear the loading state — logged-out visitors previously hung
    // on the spinner forever because this only ran for signed-in users.
    setIsLoading(false);
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
      logger.error('Error extracting job description:', error);
      const serverMessage = await functionErrorMessage(error);
      toast({
        title: 'Extraction Error',
        description: serverMessage ?? 'An error occurred while extracting the job description',
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
      const guideData = await invokeWithRateLimit<Record<string, unknown>>(
        'generate-study-guide',
        { jobDescriptionId: jobData.id },
      );

      // Save study guide to local storage for future access
      if (user && guideData) {
        LocalStorageUtils.saveStudyGuide(user.id, guideData);
      }

      setStudyGuide(guideData);
      toast({
        title: 'Analysis Complete',
        description: 'Your personalized study guide has been generated',
      });
    } catch (error) {
      logger.error('Error analyzing job description:', error);
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

  const nextSkill = studyGuide?.technical_checklist
    ?.filter((item) => !checkedSkills.has(item.skill))
    .sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 };
      return rank[a.importance] - rank[b.importance];
    })[0];

  const checklistTotal = studyGuide?.technical_checklist?.length ?? 0;
  const preparedPct = checklistTotal > 0 ? (checkedSkills.size / checklistTotal) * 100 : 0;

  if (isLoading) {
    return (
      <AppLayout fullWidth>
        <div className="ss-wash min-h-full px-4 sm:px-6 py-8">
          <div className="mx-auto max-w-7xl">
            <Card className="ss-card">
              <CardContent className="flex items-center justify-center py-8">
                <Spinner size="lg" className="text-primary" />
              </CardContent>
            </Card>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout fullWidth>
      <div className="ss-wash min-h-full px-4 sm:px-6 py-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/interview-prep')}
                className="rounded-full font-bold"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Interview prep
              </Button>
              <span className="text-sm text-muted-foreground">· Step 01</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">Job Description Analysis</h1>
            <p className="text-muted-foreground text-lg">
              Analyze job descriptions to get personalized study guides and practice materials
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
            {/* Left rail: input + progress (sticky on desktop) */}
            <div className="lg:col-span-2 lg:sticky lg:top-6 space-y-6">
              <Card className="ss-card">
                <CardHeader>
                  <CardTitle>{studyGuide ? 'Analyze another posting' : 'Paste a job posting'}</CardTitle>
                  <CardDescription>
                    Enter a job posting URL or paste the job description directly.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex gap-3 flex-wrap">
                      <Input
                        placeholder="https://example.com/jobs/123"
                        value={jobUrl}
                        onChange={(e) => setJobUrl(e.target.value)}
                        className="flex-1 min-w-[12rem] rounded-xl"
                      />
                      <Button
                        onClick={handleUrlExtract}
                        disabled={isExtracting || !jobUrl}
                        variant="outline"
                        className="rounded-full font-bold"
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
                      className="min-h-[260px] rounded-xl"
                    />
                    <p className="text-sm text-muted-foreground">
                      The more detailed the job description, the better the analysis will be
                    </p>
                  </div>

                  <Button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || !jobDescription.trim()}
                    className="w-full rounded-full font-bold"
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
                </CardContent>
              </Card>

              {studyGuide && checklistTotal > 0 && (
                <Card className="ss-card ss-card-warm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Your progress</CardTitle>
                    <CardDescription>From this study guide.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 mb-3">
                      <div className="h-2 flex-1 rounded-full bg-ss-track overflow-hidden">
                        <div
                          className="h-full rounded-full bg-ss-lav transition-all"
                          style={{ width: `${preparedPct}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        <b className="text-foreground">{checkedSkills.size}</b>/{checklistTotal}
                      </span>
                    </div>
                    {nextSkill && (
                      <p className="text-sm text-muted-foreground">
                        Next: <b className="text-foreground">{nextSkill.skill}</b> — highest-priority
                        unprepared skill.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right column: the living study guide */}
            <div className="lg:col-span-3 space-y-6">
              {studyGuide ? (
                <>
                  <div className="flex items-center gap-3 flex-wrap rounded-2xl bg-ss-lav-chip px-5 py-3">
                    <p className="text-sm font-bold text-ss-lav-deep">Your study guide</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleReset}
                      className="ml-auto rounded-full font-bold hover:text-ss-bad"
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Reset
                    </Button>
                  </div>

                  <Card className="ss-card">
                    <CardHeader>
                      <CardTitle>Required Competencies</CardTitle>
                      <CardDescription>
                        Key technical and behavioral competencies identified from the job description.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div>
                        <h3 className="text-xs font-bold tracking-widest text-muted-foreground mb-3">
                          TECHNICAL
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {studyGuide.competencies.technical.map((comp, index) => (
                            <Badge
                              key={index}
                              className="bg-ss-lav-chip text-ss-lav-deep border border-ss-lav/30 rounded-full px-3 py-1 font-medium hover:bg-ss-lav-chip"
                            >
                              {comp}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-xs font-bold tracking-widest text-muted-foreground mb-3">
                          BEHAVIORAL
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {studyGuide.competencies.behavioral.map((comp, index) => (
                            <Badge
                              key={index}
                              className="bg-ss-teal-chip text-ss-teal border border-ss-teal/30 rounded-full px-3 py-1 font-medium hover:bg-ss-teal-chip"
                            >
                              {comp}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="ss-card">
                    <CardHeader>
                      <CardTitle>Practice Questions</CardTitle>
                      <CardDescription>
                        Curated questions to help you prepare — each deep-links into the matching practice tool.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div>
                        <h3 className="text-xs font-bold tracking-widest text-muted-foreground mb-3">
                          BEHAVIORAL — STAR PRACTICE
                        </h3>
                        <ul className="space-y-3">
                          {studyGuide.questions
                            .filter((q) => q.type === 'behavioral')
                            .map((question) => (
                              <li
                                key={question.id}
                                className="p-4 bg-background rounded-2xl border border-border hover:shadow-sm transition-all"
                              >
                                <div className="flex justify-between items-center gap-4 flex-wrap sm:flex-nowrap">
                                  <div>
                                    <p className="text-foreground">{question.question}</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                      Target Competency:{' '}
                                      <span className="font-bold text-ss-lav-deep">{question.targetCompetency}</span>
                                    </p>
                                  </div>
                                  <Link to={`/interview-prep/star-practice?questionId=${question.id}`}>
                                    <Button variant="outline" size="sm" className="flex items-center gap-1 rounded-full font-bold">
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
                        <h3 className="text-xs font-bold tracking-widest text-muted-foreground mb-3">
                          TECHNICAL — CODE PRACTICE
                        </h3>
                        <ul className="space-y-3">
                          {studyGuide.questions
                            .filter((q) => q.type === 'technical')
                            .map((question) => (
                              <li
                                key={question.id}
                                className="p-4 bg-background rounded-2xl border border-border hover:shadow-sm transition-all"
                              >
                                <div className="flex justify-between items-center gap-4 flex-wrap sm:flex-nowrap">
                                  <div>
                                    <p className="text-foreground">{question.question}</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                      Target Competency:{' '}
                                      <span className="font-bold text-ss-lav-deep">{question.targetCompetency}</span>
                                    </p>
                                  </div>
                                  <Link to={`/interview-prep/code-practice?questionId=${question.id}`}>
                                    <Button variant="outline" size="sm" className="flex items-center gap-1 rounded-full font-bold">
                                      <ExternalLink className="h-3 w-3" />
                                      Practice
                                    </Button>
                                  </Link>
                                </div>
                              </li>
                            ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="ss-card">
                    <CardHeader>
                      <CardTitle>Technical Skills Checklist</CardTitle>
                      <CardDescription>
                        Check off skills as you prepare and study for the interview.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-left">
                        {studyGuide.technical_checklist.map((item, index) => (
                          <div
                            key={index}
                            className="flex items-center space-x-3 py-3 border-b border-border last:border-b-0"
                          >
                            <Checkbox
                              id={`skill-${index}`}
                              checked={checkedSkills.has(item.skill)}
                              onCheckedChange={(checked) => handleSkillCheck(item.skill, checked as boolean)}
                              className="rounded-md border-ss-lav data-[state=checked]:bg-ss-lav data-[state=checked]:border-ss-lav"
                            />
                            <label
                              htmlFor={`skill-${index}`}
                              className={`flex-1 cursor-pointer transition-colors ${
                                checkedSkills.has(item.skill)
                                  ? 'text-muted-foreground line-through decoration-ss-lav/50'
                                  : 'text-foreground'
                              }`}
                            >
                              {item.skill}
                            </label>
                            <Badge
                              variant="outline"
                              className={`text-xs uppercase tracking-wide rounded-full ${priorityBadgeClass(item.importance)}`}
                            >
                              {item.importance}
                            </Badge>
                          </div>
                        ))}
                        {checklistTotal > 0 && (
                          <div className="pt-4 flex items-center gap-4">
                            <div className="h-2 flex-1 rounded-full bg-ss-track overflow-hidden">
                              <div
                                className="h-full rounded-full bg-ss-lav transition-all"
                                style={{ width: `${preparedPct}%` }}
                              />
                            </div>
                            <p className="text-sm text-muted-foreground">
                              <b className="text-foreground">{checkedSkills.size}</b> of {checklistTotal} skills prepared
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card className="ss-card h-full">
                  <CardContent className="flex flex-col items-center justify-center text-center py-16 px-8">
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-ss-lav-chip mb-4">
                      <FileSearch className="h-7 w-7 text-ss-lav-deep" />
                    </span>
                    <h3 className="text-xl font-bold mb-2">Your study guide will appear here</h3>
                    <p className="text-muted-foreground max-w-md">
                      Paste a job description on the left and analyze it — you'll get the role's
                      competencies, tailored practice questions, and a prioritized skills checklist.
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
