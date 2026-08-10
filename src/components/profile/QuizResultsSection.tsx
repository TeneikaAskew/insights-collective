import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CareerTrack,
  SkillLevel,
  experienceLevelForOptionId,
  getTrackPersona,
  toMatchPercentage,
} from '@/data/careerQuizData';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Brain, BarChart3, Database, Presentation, ArrowRight, Award } from 'lucide-react';
import { useCareerCoach } from '@/hooks/useCareerCoach';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

import { createLogger } from '@/utils/logger';

const logger = createLogger('QuizResultsSection');

interface QuizResult {
  track: CareerTrack;
  score: number;
  persona: any;
}

/** A score set is only worth showing if at least one track scored above zero. */
const hasAnyScore = (scores: Partial<Record<CareerTrack, number>> | null | undefined): boolean =>
  !!scores && Object.values(scores).some((score) => typeof score === 'number' && score > 0);

/** Raw track scores → the top three cards, normalized against each track's real ceiling. */
const toTopTracks = (scores: Record<CareerTrack, number>): QuizResult[] =>
  Object.entries(scores)
    // Normalize BEFORE ranking. Raw scores are not comparable across tracks —
    // that is the whole reason they are normalized for display — so ranking on
    // them made the order disagree with the numbers beside it: Analytics 20/23
    // is 87% and Data Engineering 17/19 is 89%, yet the higher raw score put
    // Analytics first and gave it the "Top Match" badge over the better match.
    .map(([track, score]) => ({
      track: track as CareerTrack,
      score: toMatchPercentage(track as CareerTrack, score),
      persona: getTrackPersona(track as CareerTrack),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

const QuizResultsSection = () => {
  const [quizResults, setQuizResults] = useState<QuizResult[] | null>(null);
  const [rawScores, setRawScores] = useState<Record<CareerTrack, number> | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [experienceLevel, setExperienceLevel] = useState<SkillLevel | null>(null);
  const [hasResults, setHasResults] = useState<boolean>(false);
  const [isLoadingResults, setIsLoadingResults] = useState<boolean>(true);
  const navigate = useNavigate();
  const { initiateCareerCoachChat } = useCareerCoach();
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadQuizResults();
    
    // Add event listener to refresh results when storage changes
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
    // Keyed on the id, not the user object: any provider that hands back a new
    // object identity per render would otherwise re-run this load on every
    // render it causes, and each load sets state — a loop that never settles on
    // a result and leaves the card showing "Loading your quiz results…".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === 'quizScores') {
      loadQuizResults();
    }
  };

  const loadQuizResults = async () => {
    setIsLoadingResults(true);
    try {
      let scores: Record<CareerTrack, number> | null = null;
      let attemptId: string | null = null;
      let level: SkillLevel | null = null;

      // localStorage carries scores and nothing else — no attempt id, no
      // recorded experience — so for a signed-in reader it is a cache of one
      // third of the answer. Using it to skip the query cost the other two
      // thirds on every mount after the first: the level fell back to "not
      // recorded" for someone who had recorded it, and the coach button, having
      // no attempt to attach to, went back to storing a duplicate row. For a
      // signed-in reader the database is the source of truth; localStorage is
      // the fallback for the anonymous case, where the quiz was taken on the
      // home page and never persisted at all.
      const storedScores = localStorage.getItem('quizScores');
      if (storedScores) {
        const parsed = JSON.parse(storedScores) as Record<CareerTrack, number>;
        if (hasAnyScore(parsed)) {
          logger.log('Found valid quiz scores in localStorage');
          scores = parsed;
        }
      }

      if (user) {
        logger.log('Checking Supabase for quiz results for user:', user.id);

        // Deliberately more than one row. `initiateCareerCoachChat` writes an
        // attempt from whatever scores it is handed, and this profile page used
        // to hand it an all-zero object whenever localStorage had been cleared —
        // so accounts hold attempts whose four result columns are 0. Taking
        // strictly the newest row meant one such write permanently replaced a
        // real result with three cards reading "Match Score: 0% / Level:
        // Beginner". Scan back and use the newest attempt that actually scored.
        const { data: attempts, error } = await supabase
          .from('career_quiz_attempts')
          .select(
            'id, created_at, self_reported_experience, result_ai_ml_score, result_analytics_score, result_data_engineering_score, result_business_intelligence_score',
          )
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) {
          logger.error('Error fetching quiz results from Supabase:', error);
          throw error;
        }

        for (const attempt of attempts || []) {
          const attemptScores: Record<CareerTrack, number> = {
            'AI/ML': attempt.result_ai_ml_score || 0,
            'Analytics': attempt.result_analytics_score || 0,
            'Data Engineering': attempt.result_data_engineering_score || 0,
            'Business Intelligence': attempt.result_business_intelligence_score || 0,
          };
          if (hasAnyScore(attemptScores)) {
            logger.log('Found scored quiz attempt in Supabase:', attempt.id);
            scores = attemptScores;
            attemptId = attempt.id;
            // Null for every attempt taken before the experience question
            // existed, which renders as "not recorded" rather than a guess.
            level = experienceLevelForOptionId((attempt as any).self_reported_experience);
            // Save to localStorage for future reference.
            localStorage.setItem('quizScores', JSON.stringify(attemptScores));
            break;
          }
        }
      }

      if (scores) {
        const topTracks = toTopTracks(scores);
        logger.log('Setting quiz results:', topTracks);
        setRawScores(scores);
        setAttemptId(attemptId);
        setExperienceLevel(level);
        setQuizResults(topTracks);
        setHasResults(true);
      } else {
        logger.log('No valid quiz results found');
        setRawScores(null);
        setAttemptId(null);
        setExperienceLevel(null);
        setQuizResults(null);
        setHasResults(false);
      }
    } catch (error) {
      logger.error('Error loading quiz results:', error);
      setRawScores(null);
      setAttemptId(null);
      setExperienceLevel(null);
      setQuizResults(null);
      setHasResults(false);
      toast({
        title: "Error",
        description: "Could not load your quiz results. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingResults(false);
    }
  };

  const getTrackIcon = (track: CareerTrack) => {
    switch (track) {
      case 'AI/ML':
        return <Brain className="h-5 w-5 text-primary" />;
      case 'Analytics':
        return <BarChart3 className="h-5 w-5 text-primary" />;
      case 'Data Engineering':
        return <Database className="h-5 w-5 text-primary" />;
      case 'Business Intelligence':
        return <Presentation className="h-5 w-5 text-primary" />;
      default:
        return <BarChart3 className="h-5 w-5 text-primary" />;
    }
  };

  const getCareerRoleId = (track: CareerTrack): string => {
    switch (track) {
      case 'AI/ML':
        return 'machine-learning-engineer';
      case 'Analytics':
        return 'data-analyst';
      case 'Data Engineering':
        return 'data-engineer';
      case 'Business Intelligence':
        return 'bi-analyst';
      default:
        return 'data-scientist';
    }
  };

  /**
   * The quiz lives on its own route rather than at a hash on the home page.
   *
   * `navigate('/#quiz-section')` could never work from here: no element with
   * that id has ever existed, and `/` sends any signed-in visitor straight to
   * `/dashboard`. Every person with results to retake is signed in by
   * definition, so the button bounced them to the dashboard — which, arriving
   * with no visible change on a page that already looked like the app, read as
   * the button doing nothing at all.
   */
  const handleTakeQuiz = () => {
    navigate('/career-quiz');
  };

  const getStoredScores = (): Record<CareerTrack, number> => {
    if (rawScores) return rawScores;

    const storedScores = localStorage.getItem('quizScores');
    if (storedScores) {
      try {
        return JSON.parse(storedScores) as Record<CareerTrack, number>;
      } catch {
        // Corrupt value; fall through to the empty set below.
      }
    }

    return {
      'AI/ML': 0,
      'Analytics': 0,
      'Data Engineering': 0,
      'Business Intelligence': 0
    };
  };

  /**
   * The answers behind the loaded scores, when the browser still has them.
   *
   * This returned a hardcoded `{}` before, so opening the coach from the
   * profile wrote an attempt with every question column null — and, paired with
   * the empty score object above, an all-zero attempt that then became the
   * newest row for the account.
   */
  const getStoredAnswers = (): Record<number, number | string> => {
    const storedAnswers = localStorage.getItem('quizAnswers');
    if (storedAnswers) {
      try {
        return JSON.parse(storedAnswers) as Record<number, number | string>;
      } catch {
        // Corrupt value; the coach still opens, just without question detail.
      }
    }
    return {};
  };

  return (
    <div>
      {isLoadingResults ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-pulse text-center">
            <p className="text-muted-foreground">Loading your quiz results...</p>
          </div>
        </div>
      ) : hasResults && quizResults ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {quizResults.map((result, index) => (
              <div 
                key={result.track} 
                className={`relative p-3 sm:p-4 rounded-lg border min-h-[180px] flex flex-col ${
                  index === 0 ? 'border-primary/50 bg-primary/5' : 'border-muted'
                }`}
              >
                {/* Header with icon and title */}
                <div className="mb-2">
                  <div className="flex items-center gap-2 mb-1">
                    {getTrackIcon(result.track)}
                    <h3 className="font-medium text-sm sm:text-base">{result.track}</h3>
                  </div>
                  {/* Top Match badge - show below title on larger screens */}
                  {index === 0 && (
                    <div className="hidden sm:block">
                      <span className="inline-flex text-xs bg-primary/20 text-primary font-medium px-2 py-1 rounded-full">
                        Top Match
                      </span>
                    </div>
                  )}
                </div>

                {/* Match score only.
                    "Level" used to sit here too, computed from this very
                    percentage, so three cards showed three skill levels derived
                    from how appealing the person found each track. Experience
                    is one fact about them, so it is stated once below. */}
                <div className="flex-1 space-y-1 mb-3">
                  <div className="text-sm text-muted-foreground">
                    Match Score: <span className="font-medium text-foreground">{result.score}%</span>
                  </div>
                </div>

                {/* Bottom section with button and mobile badge */}
                <div className="mt-auto space-y-2">
                  {/* Top Match badge - show at bottom on mobile */}
                  {index === 0 && (
                    <div className="sm:hidden flex justify-center">
                      <span className="text-xs bg-primary/20 text-primary font-medium px-2 py-1 rounded-full">
                        Top Match
                      </span>
                    </div>
                  )}
                  
                  <Button variant="outline" size="sm" className="w-full justify-between text-xs sm:text-sm" asChild>
                    <a href={`/explore-data-careers?role=${getCareerRoleId(result.track)}`}>
                      <span className="hidden sm:inline">Explore Career</span>
                      <span className="sm:hidden">Explore</span>
                      <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 ml-1" />
                    </a>
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <p className="text-sm text-muted-foreground" data-testid="experience-level">
            Experience level:{' '}
            <span className="font-medium text-foreground">
              {experienceLevel ?? 'not recorded'}
            </span>
            {!experienceLevel && ' — retake the quiz to record it'}
          </p>

          <div className="flex flex-wrap gap-2 justify-end mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTakeQuiz}
            >
              Retake Quiz
            </Button>
            <Button
              size="sm"
              onClick={() =>
                // The attempt these results came from, so the coach attaches to
                // it instead of storing a fresh row on every click.
                initiateCareerCoachChat(getStoredAnswers(), getStoredScores(), attemptId ?? undefined)
              }
            >
              Chat with Career Coach
            </Button>
          </div>
        </div>
      ) : (
        <Alert>
          <AlertDescription className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-muted-foreground" />
              <p>You haven't taken the career path quiz yet. Take the quiz to discover which data career paths align with your skills and interests.</p>
            </div>
            <div className="flex justify-between">
              <Button onClick={handleTakeQuiz}>Take Career Quiz</Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default QuizResultsSection;