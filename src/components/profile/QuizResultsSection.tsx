import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CareerTrack, getSkillLevel, getTrackPersona } from '@/data/careerQuizData';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Brain, BarChart3, Database, Presentation, ArrowRight, Award } from 'lucide-react';
import { useCareerCoach } from '@/hooks/useCareerCoach';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface QuizResult {
  track: CareerTrack;
  score: number;
  level: string;
  persona: any;
}

const QuizResultsSection = () => {
  const [quizResults, setQuizResults] = useState<QuizResult[] | null>(null);
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
  }, [user]);

  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === 'quizScores') {
      loadQuizResults();
    }
  };

  const loadQuizResults = async () => {
    setIsLoadingResults(true);
    try {
      // First, check localStorage for immediate results
      let hasValidScores = false;
      let topTracks: QuizResult[] = [];
      
      const storedScores = localStorage.getItem('quizScores');
      
      if (storedScores) {
        const scores = JSON.parse(storedScores) as Record<CareerTrack, number>;
        
        // Verify if we have valid scores in localStorage
        hasValidScores = Object.values(scores).some(score => score > 0);
        
        if (hasValidScores) {
          console.log("Found valid quiz scores in localStorage");
          topTracks = Object.entries(scores)
            .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
            .slice(0, 3)
            .map(([track, score]) => ({
              track: track as CareerTrack,
              score: Math.round(score * 5), // Transform from 20-point scale to 100-point scale
              level: getSkillLevel(Math.round(score * 5)),
              persona: getTrackPersona(track as CareerTrack)
            }));
        }
      }
      
      // If user is authenticated, try to fetch from Supabase
      if (user && (!hasValidScores || topTracks.length === 0)) {
        console.log("Checking Supabase for quiz results for user:", user.id);
        
        const { data: quizAttempt, error } = await supabase
          .from('career_quiz_attempts')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (error) {
          console.error("Error fetching quiz results from Supabase:", error);
        }
        
        if (quizAttempt) {
          console.log("Found quiz results in Supabase:", quizAttempt);
          
          // Create scores object from Supabase data
          const supabaseScores: Record<CareerTrack, number> = {
            'AI/ML': quizAttempt.result_ai_ml_score || 0,
            'Analytics': quizAttempt.result_analytics_score || 0,
            'Data Engineering': quizAttempt.result_data_engineering_score || 0,
            'Business Intelligence': quizAttempt.result_business_intelligence_score || 0
          };
          
          // Save to localStorage for future reference
          localStorage.setItem('quizScores', JSON.stringify(supabaseScores));
          
          // Generate top tracks
          topTracks = Object.entries(supabaseScores)
            .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
            .slice(0, 3)
            .map(([track, score]) => ({
              track: track as CareerTrack,
              score: Math.round(score * 5), // Transform from 20-point scale to 100-point scale
              level: getSkillLevel(Math.round(score * 5)),
              persona: getTrackPersona(track as CareerTrack)
            }));
          
          hasValidScores = true;
        }
      }
      
      if (hasValidScores && topTracks.length > 0) {
        console.log("Setting quiz results:", topTracks);
        setQuizResults(topTracks);
        setHasResults(true);
      } else {
        console.log("No valid quiz results found");
        setQuizResults(null);
        setHasResults(false);
      }
    } catch (error) {
      console.error("Error loading quiz results:", error);
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

  const handleTakeQuiz = () => {
    navigate('/#quiz-section');
  };

  const getDefaultScores = (): Record<CareerTrack, number> => {
    const storedScores = localStorage.getItem('quizScores');
    if (storedScores) {
      return JSON.parse(storedScores) as Record<CareerTrack, number>;
    }
    
    return {
      'AI/ML': 0,
      'Analytics': 0,
      'Data Engineering': 0,
      'Business Intelligence': 0
    };
  };

  const getDefaultAnswers = (): Record<number, number | string> => {
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

                {/* Score and level info */}
                <div className="flex-1 space-y-1 mb-3">
                  <div className="text-sm text-muted-foreground">
                    Match Score: <span className="font-medium text-foreground">{result.score}%</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Level: <span className="font-medium text-foreground">{result.level}</span>
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
          
          <div className="flex gap-2 justify-end mt-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleTakeQuiz}
            >
              Retake Quiz
            </Button>
            <Button 
              size="sm"
              onClick={() => initiateCareerCoachChat(getDefaultAnswers(), getDefaultScores())} 
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