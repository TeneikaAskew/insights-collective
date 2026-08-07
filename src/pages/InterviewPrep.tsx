
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/use-user';
import { supabase } from '@/integrations/supabase/client';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Star, Code, Users, CheckCircle, BarChart, Brain, Check, LucideIcon } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { LocalStorageUtils } from '@/utils/localStorageUtils';

import { createLogger } from '@/utils/logger';

const logger = createLogger('InterviewPrep');

interface StudyGuideQuestion {
  id: string;
  type: 'behavioral' | 'technical';
  question: string;
  targetCompetency?: string;
}

interface StudyGuide {
  id: string;
  created_at: string;
  competencies: {
    technical: string[];
    behavioral: string[];
  };
  questions: StudyGuideQuestion[];
}

type StepTone = 'good' | 'lav' | 'peach' | 'muted';

const toneChip: Record<StepTone, string> = {
  good: 'bg-ss-good-chip text-ss-good',
  lav: 'bg-ss-lav-chip text-ss-lav-deep',
  peach: 'bg-ss-warn-chip text-ss-peach-deep',
  muted: 'bg-ss-track text-muted-foreground',
};

const toneNode: Record<StepTone, string> = {
  good: 'border-ss-good text-ss-good',
  lav: 'border-ss-lav-deep text-ss-lav-deep',
  peach: 'border-ss-peach-deep text-ss-peach-deep',
  muted: 'border-border text-muted-foreground',
};

interface StepDef {
  key: string;
  num: string;
  icon: LucideIcon;
  navTitle: string;
  title: string;
  description: string;
  helps: string;
  bullets: string[];
  stats: Array<{ icon: LucideIcon; headline: string; detail: string; color: string }>;
  pill: string;
}

const STEPS: StepDef[] = [
  {
    key: 'job-description',
    num: '01',
    icon: Briefcase,
    navTitle: 'Analyze the job',
    title: 'Job Description Analysis',
    description: 'Analyze job descriptions to get personalized study guides and practice materials tailored to your target role.',
    helps: 'Our AI-powered job description analyzer helps you:',
    bullets: [
      'Identify key technical and behavioral competencies employers are looking for',
      'Generate personalized interview questions based on the specific role',
      'Create a focused study guide to prepare efficiently',
      'Highlight skills gaps to prioritize your interview preparation',
    ],
    stats: [
      { icon: BarChart, headline: '73% of successful candidates', detail: 'Customize their preparation based on the specific job description', color: 'text-ss-lav-deep' },
      { icon: Brain, headline: 'Targeted preparation', detail: 'Focuses your study time on what matters most to hiring managers', color: 'text-ss-teal' },
    ],
    pill: 'Most popular feature',
  },
  {
    key: 'star-practice',
    num: '02',
    icon: Star,
    navTitle: 'Practice STAR stories',
    title: 'STAR Response Practice',
    description: 'Master behavioral questions by practicing the Situation, Task, Action, Result (STAR) method with AI feedback.',
    helps: 'Our STAR Method practice tool helps you:',
    bullets: [
      'Structure your answers effectively with the proven STAR format',
      'Receive instant feedback on your responses from our AI coach',
      'Improve your storytelling ability to engage interviewers',
      'Build a library of polished responses to common questions',
    ],
    stats: [
      { icon: BarChart, headline: '89% of hiring managers', detail: 'Say behavioral questions reveal more about candidates than technical questions', color: 'text-ss-lav-deep' },
      { icon: Brain, headline: 'STAR method is proven', detail: 'To help candidates deliver clear, concise, and compelling answers', color: 'text-ss-teal' },
    ],
    pill: 'Highest improvement rate',
  },
  {
    key: 'code-practice',
    num: '03',
    icon: Code,
    navTitle: 'Drill code challenges',
    title: 'Code Challenge Practice',
    description: 'Strengthen your technical coding skills with real-time feedback and industry-relevant practice problems.',
    helps: 'Our code practice platform helps you:',
    bullets: [
      'Solve common technical interview challenges in a realistic environment',
      'Get detailed feedback on both correctness and code quality',
      'Learn optimal approaches through guided solutions',
      'Track your progress and identify areas for improvement',
    ],
    stats: [
      { icon: BarChart, headline: '94% of technical roles', detail: 'Include at least one coding challenge in the interview process', color: 'text-ss-lav-deep' },
      { icon: Brain, headline: 'Regular practice', detail: 'Is the most reliable predictor of success in technical interviews', color: 'text-ss-teal' },
    ],
    pill: 'Includes real interview questions',
  },
  {
    key: 'mock-interviews',
    num: '04',
    icon: Users,
    navTitle: 'Book a mock interview',
    title: 'Mock Interviews',
    description: 'Practice with peers in realistic interview simulations and receive structured feedback to improve.',
    helps: 'Our mock interview platform helps you:',
    bullets: [
      'Experience realistic interview conditions to reduce anxiety',
      'Get feedback from peers who understand the technical requirements',
      'Practice both as an interviewer and interviewee to gain perspective',
      'Improve your communication skills and ability to explain complex concepts',
    ],
    stats: [
      { icon: BarChart, headline: '65% improvement', detail: 'In interview performance after just two mock interview sessions', color: 'text-ss-lav-deep' },
      { icon: Brain, headline: 'Real-time pressure', detail: 'Helps build the mental resilience needed for actual interviews', color: 'text-ss-teal' },
    ],
    pill: 'Community favorite',
  },
];

const QUOTES: Record<string, { text: string; author: string } | null> = {
  'job-description': {
    text: '“By analyzing the job description, I discovered key requirements I had missed. The custom study guide helped me prepare specific examples that impressed the interviewer.”',
    author: 'MARIA S. — DATA ANALYST',
  },
  'star-practice': null, // renders the before/after comparison instead
  'code-practice': {
    text: '“The code challenges were incredibly similar to what I faced in my actual interviews. After practicing here, I felt confident and passed the technical rounds at three top companies.”',
    author: 'ALEX K. — SOFTWARE ENGINEER',
  },
  'mock-interviews': {
    text: '“The feedback I received from my mock interview partner helped me identify verbal tics and knowledge gaps I wasn\'t aware of. This single change transformed my interview performance.”',
    author: 'JAMIE T. — DATA SCIENTIST',
  },
};

export default function InterviewPrep() {
  const { toast } = useToast();
  const { user } = useUser();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [studyGuides, setStudyGuides] = useState<StudyGuide[]>([]);
  const [activeStep, setActiveStep] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      logger.log('Loading study guides for user:', user.id);
      loadStudyGuides();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadStudyGuides = async () => {
    try {
      if (user) {
        const cachedStudyGuide = LocalStorageUtils.getStudyGuide(user.id);
        if (cachedStudyGuide) {
          logger.log('Found study guide in local storage');
          setStudyGuides([cachedStudyGuide]);
          setLoading(false);
          return;
        }
      }

      if (user && user.id) {
        logger.log('Fetching study guides from Supabase for user:', user.id);
        const { data: guides, error } = await supabase
          .from('study_guides')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          logger.error('Error loading study guides:', error);
          throw error;
        }

        logger.log('Study guides loaded from database:', guides?.length || 0);
        setStudyGuides((guides || []) as unknown as StudyGuide[]);

        if (guides && guides.length > 0 && user) {
          LocalStorageUtils.saveStudyGuide(user.id, guides[0]);
        }
      }
    } catch (error) {
      logger.error('Error loading study guides:', error);
      toast({
        title: 'Error',
        description: 'Failed to load study guides.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AppLayout fullWidth>
        <div className="ss-wash min-h-full px-6 py-8">
          <div className="mx-auto max-w-7xl">
            <Card className="ss-card">
              <CardContent className="flex items-center justify-center py-8">
                <Spinner size="lg" />
              </CardContent>
            </Card>
          </div>
        </div>
      </AppLayout>
    );
  }

  const hasStudyGuides = !!(user && (
    (studyGuides && studyGuides.length > 0) ||
    (user && LocalStorageUtils.getStudyGuide(user.id))
  ));

  const guide: StudyGuide | null =
    (studyGuides && studyGuides[0]) || (user ? LocalStorageUtils.getStudyGuide(user.id) : null) || null;
  const nextQuestion = guide?.questions?.find?.((q) => q.type === 'behavioral') || null;

  // The step to highlight (and open by default): once a study guide exists,
  // STAR practice is the natural next step.
  const selectedKey = activeStep ?? (hasStudyGuides ? 'star-practice' : 'job-description');
  const step = STEPS.find((s) => s.key === selectedKey) ?? STEPS[0];

  const stepState = (key: string): { label: string; tone: StepTone; done?: boolean } => {
    switch (key) {
      case 'job-description':
        return hasStudyGuides ? { label: 'Complete', tone: 'good', done: true } : { label: 'Start here', tone: 'lav' };
      case 'star-practice':
        return hasStudyGuides ? { label: 'Up next', tone: 'lav' } : { label: 'Unlocks after analysis', tone: 'muted' };
      case 'code-practice':
        return { label: 'Available', tone: 'muted' };
      default:
        return { label: 'Available', tone: 'peach' };
    }
  };

  const stepCta = (key: string): { label: string; disabled: boolean; to: string } => {
    switch (key) {
      case 'job-description':
        return { label: hasStudyGuides ? 'View Study Guide' : 'Analyze New Job Description', disabled: false, to: '/interview-prep/job-description' };
      case 'star-practice':
        return { label: hasStudyGuides ? 'Start STAR Practice' : 'Analyze Job Description First', disabled: !hasStudyGuides, to: '/interview-prep/star-practice' };
      case 'code-practice':
        return { label: 'Start Code Practice', disabled: false, to: '/interview-prep/code-practice' };
      default:
        return { label: 'Schedule Mock Interview', disabled: false, to: '/interview-prep/mock-interviews' };
    }
  };

  const cta = stepCta(step.key);
  const quote = QUOTES[step.key];

  return (
    <AppLayout fullWidth>
      <div className="ss-wash min-h-full px-4 sm:px-6 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">Interview Preparation</h1>
            <p className="text-muted-foreground text-lg max-w-3xl">
              Prepare for your interviews with our comprehensive tools and resources designed to help
              you stand out from other candidates and secure your dream job.
            </p>
          </div>

          {/* Stepper — doubles as the section navigation */}
          <div className="relative" role="tablist" aria-label="Interview prep steps">
            <div className="absolute left-[12%] right-[12%] top-6 h-0.5 bg-ss-lav/40" aria-hidden="true" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-6">
              {STEPS.map((s) => {
                const st = stepState(s.key);
                const active = s.key === selectedKey;
                return (
                  <button
                    key={s.key}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveStep(s.key)}
                    className="relative flex flex-col items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl py-1 group"
                  >
                    <span
                      className={`flex h-12 w-12 items-center justify-center rounded-full border-2 bg-card font-bold transition-all ${
                        active
                          ? 'bg-ss-lav-deep border-ss-lav-deep text-white ring-4 ring-ss-lav/30'
                          : toneNode[st.tone]
                      }`}
                    >
                      {st.done && !active ? <Check className="h-5 w-5" /> : s.num}
                    </span>
                    <span className={`text-sm ${active ? 'font-bold text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`}>
                      {s.navTitle}
                    </span>
                    <span className={`rounded-full px-3 py-0.5 text-xs font-medium ${toneChip[st.tone]}`}>
                      {st.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Overview + why-this-matters for the selected step */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="ss-card md:col-span-2">
              <CardContent className="p-6 sm:p-8 space-y-5">
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ss-lav-chip font-bold text-ss-lav-deep">
                    {step.num}
                  </span>
                  <div>
                    <h2 className="text-2xl font-bold">{step.title}</h2>
                    <p className="text-muted-foreground">{step.description}</p>
                  </div>
                </div>

                <div className="text-left">
                  <p className="mb-3">{step.helps}</p>
                  <ul className="space-y-2.5 list-none">
                    {step.bullets.map((b) => (
                      <li key={b} className="flex items-start">
                        <span className="mr-3 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ss-good-chip">
                          <CheckCircle className="h-3.5 w-3.5 text-ss-good" />
                        </span>
                        <span className="text-foreground/85">{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {quote ? (
                  <div className="ss-card-warm rounded-2xl border-l-4 border-ss-peach p-5">
                    <p className="ss-serif text-[15px] leading-relaxed">{quote.text}</p>
                    <p className="mt-3 text-xs font-medium tracking-widest text-ss-peach-deep">{quote.author}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-border bg-background p-4">
                      <h3 className="text-sm font-medium mb-1">Before STAR Practice:</h3>
                      <p className="text-xs text-muted-foreground italic">
                        "I helped my team finish a project and it went well."
                      </p>
                    </div>
                    <div className="rounded-2xl bg-ss-good-chip p-4">
                      <h3 className="text-sm font-medium mb-1 text-ss-good">After STAR Practice:</h3>
                      <p className="text-xs text-foreground/75 italic">
                        "When our team faced a tight deadline (S), I was tasked with coordinating resources (T).
                        I implemented a new project tracking system (A), which resulted in delivering 2 weeks
                        early and saving $50K (R)."
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <Button
                    onClick={() => navigate(cta.to)}
                    className="w-full sm:w-auto rounded-full font-bold"
                    size="lg"
                    disabled={cta.disabled}
                  >
                    {cta.label}
                  </Button>
                  {cta.disabled && (
                    <p className="text-sm text-muted-foreground mt-2">
                      You need to analyze a job description first to get practice questions.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="ss-card ss-card-warm md:col-span-1">
              <CardContent className="p-6 sm:p-7 space-y-5">
                <h3 className="text-lg font-bold">Why this matters</h3>
                {step.stats.map(({ icon: Icon, headline, detail, color }) => (
                  <div key={headline} className="flex items-start space-x-3">
                    <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${color}`} />
                    <div className="flex-1">
                      <p className="text-sm font-bold">{headline}</p>
                      <p className="text-xs text-muted-foreground">{detail}</p>
                    </div>
                  </div>
                ))}
                <span className="inline-block rounded-full bg-ss-lav-chip px-3 py-1 text-xs font-medium text-ss-lav-deep">
                  {step.pill}
                </span>
              </CardContent>
            </Card>
          </div>

          {/* Continue where you left off — only when real study-guide data exists */}
          {hasStudyGuides && nextQuestion && (
            <Card className="ss-card">
              <CardContent className="p-6 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <h3 className="text-xl font-bold">Continue where you left off</h3>
                  <span className="rounded-full bg-ss-warn-chip px-3 py-1 text-xs font-medium text-ss-peach-deep">
                    From your study guide
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  STAR Practice
                  {nextQuestion.targetCompetency ? ` · Target competency: ${nextQuestion.targetCompetency}` : ''}
                </p>
                <div className="rounded-2xl bg-background border border-border p-5 mb-5">
                  <p className="ss-serif text-[16px] leading-relaxed">“{nextQuestion.question}”</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => navigate(`/interview-prep/star-practice?questionId=${nextQuestion.id}`)}
                    className="rounded-full font-bold"
                  >
                    Resume practice
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/interview-prep/job-description')}
                    className="rounded-full font-bold"
                  >
                    View study guide
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
