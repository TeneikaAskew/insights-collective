
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CareerTrack, getSkillLevel, getTrackPersona } from '@/data/careerQuizData';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Brain, BarChart3, Database, Presentation, ArrowRight, Award } from 'lucide-react';
import { useCareerCoach } from '@/hooks/useCareerCoach';

interface QuizResult {
  track: CareerTrack;
  score: number;
  level: string;
  persona: any;
}

const QuizResultsSection = () => {
  const [quizResults, setQuizResults] = useState<QuizResult[] | null>(null);
  const [hasResults, setHasResults] = useState<boolean>(false);
  const navigate = useNavigate();
  const { initiateCareerCoachChat } = useCareerCoach();

  useEffect(() => {
    loadQuizResults();
    // Add event listener to refresh results when storage changes
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === 'quizScores') {
      loadQuizResults();
    }
  };

  const loadQuizResults = () => {
    try {
      const storedScores = localStorage.getItem('quizScores');
      
      if (storedScores) {
        const scores = JSON.parse(storedScores) as Record<CareerTrack, number>;
        
        // Verify if we have valid scores
        const hasValidScores = Object.values(scores).some(score => score > 0);
        
        if (!hasValidScores) {
          console.log("Quiz scores found but all values are zero");
          setHasResults(false);
          setQuizResults(null);
          return;
        }
        
        const topTracks = Object.entries(scores)
          .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
          .slice(0, 3)
          .map(([track, score]) => ({
            track: track as CareerTrack,
            score: Math.round(score),
            level: getSkillLevel(Math.round(score)),
            persona: getTrackPersona(track as CareerTrack)
          }));
        
        console.log("Quiz results loaded:", topTracks);
        setQuizResults(topTracks);
        setHasResults(true);
      } else {
        console.log("No quiz scores found in localStorage");
        setHasResults(false);
        setQuizResults(null);
      }
    } catch (error) {
      console.error("Error loading quiz results:", error);
      setHasResults(false);
      setQuizResults(null);
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

  // For debugging - will be removed in production
  const debugQuizResults = () => {
    const mockScores: Record<CareerTrack, number> = {
      'AI/ML': 85,
      'Analytics': 72,
      'Data Engineering': 60,
      'Business Intelligence': 45
    };
    localStorage.setItem('quizScores', JSON.stringify(mockScores));
    loadQuizResults();
  };

  return (
    <div>
      {hasResults && quizResults ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {quizResults.map((result, index) => (
              <div 
                key={result.track} 
                className={`p-4 rounded-lg border ${
                  index === 0 ? 'border-primary/50 bg-primary/5' : 'border-muted'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {getTrackIcon(result.track)}
                  <h3 className="font-medium">{result.track}</h3>
                  {index === 0 && (
                    <span className="ml-auto text-xs bg-primary/20 text-primary font-medium px-2 py-1 rounded-full">
                      Top Match
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground mb-1">
                  Match Score: <span className="font-medium text-foreground">{result.score}%</span>
                </div>
                <div className="text-sm text-muted-foreground mb-3">
                  Level: <span className="font-medium text-foreground">{result.level}</span>
                </div>
                <Button variant="outline" size="sm" className="w-full justify-between" asChild>
                  <a href={`/explore-data-careers?role=${getCareerRoleId(result.track)}`}>
                    Explore Career <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </Button>
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
              {/* Debug button only for development - remove in production */}
              {process.env.NODE_ENV === 'development' && (
                <Button variant="outline" onClick={debugQuizResults} size="sm">
                  Debug: Load Results
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default QuizResultsSection;
