import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { MessageSquare, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useResumeAnalysis } from '@/hooks/useResumeAnalysis';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';

import { createLogger } from '@/utils/logger';

const logger = createLogger('handleButtonClick');

  interface OverallScoreCardProps {
    letterGrade: string;
    resumePercent: number;
    elevatorPitch: string;
    themes: string[];
    explanation: string;
    onStartCareerChat: () => void;
    hasAnalysis?: boolean;
    analysisDate?: string;
  }

  const OverallScoreCard: React.FC<OverallScoreCardProps> = ({
    letterGrade,
    resumePercent,
    elevatorPitch,
    themes,
    explanation,
    onStartCareerChat,
    hasAnalysis = false,
    analysisDate
  }) => {
    const [isFlashing, setIsFlashing] = useState(false);
    const [hasBeenClicked, setHasBeenClicked] = useState(false);
    const [hasRoast, setHasRoast] = useState(false);
    const flashIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const { careerAlignments } = useResumeAnalysis();
    
    // Get userId from the auth context
    const { user } = useAuth();
    const userId = user?.id;
    
    // logger.log('[OverallScoreCard] User ID:', userId);
    // logger.log('[OverallScoreCard] Resume analysis data:', localStorage.getItem(`resume_analysis_${userId}`));
    // logger.log('[OverallScoreCard] Resume text data:', localStorage.getItem(`resume_text_${userId}`));
    // logger.log('[OverallScoreCard] Resume data:', localStorage.getItem(`resume_data_${userId}`));
  
    
  // Check for roast (keep existing functionality)
  useEffect(() => {
    logger.log("Checking if roast exists yet for: ", userId);
    if (userId) {
      const checkForRoast = async () => {
        try {
          const {
            data,
            error
          } = await supabase.from('resumes').select('resume_roast').eq('user_id', userId).order('uploaded_at', {
            ascending: false
          }).limit(1).maybeSingle();
          logger.log("user: ", userId, " - Roast data", data);
          if (!error && data?.resume_roast) {
            setHasRoast(true);
          }
        } catch (error) {
          logger.error("Error checking for roast:", error);
        }
      };
      checkForRoast();
    }
  }, [userId]);

  // Setup flashing effect with interval (keep existing functionality)
  useEffect(() => {
    logger.log("Does the analysis exist? ", hasAnalysis);
    if (!hasAnalysis || hasBeenClicked) {
      if (flashIntervalRef.current) {
        clearInterval(flashIntervalRef.current);
      }
      return;
    }
    ;
    if (flashIntervalRef.current) {
      clearInterval(flashIntervalRef.current);
    }
    flashIntervalRef.current = setInterval(() => {
      setIsFlashing(prev => !prev);
    }, 1000);
    return () => {
      if (flashIntervalRef.current) {
        clearInterval(flashIntervalRef.current);
      }
    };
  }, [hasAnalysis, hasBeenClicked]);
  
  const handleButtonClick = () => {
    setHasBeenClicked(true);
    if (flashIntervalRef.current) {
      clearInterval(flashIntervalRef.current);
      setIsFlashing(false);
    }
    onStartCareerChat();
  };
  
  const getLetterGradeColor = (grade: string) => {
    switch (grade) {
      case 'A':
        return "text-green-600";
      case 'B':
        return "text-emerald-600";
      case 'C':
        return "text-yellow-600";
      case 'D':
        return "text-orange-600";
      default:
        return "text-red-600";
    }
  };
  
  const getButtonClass = () => {
    if (hasAnalysis && hasBeenClicked) {
      return 'bg-green-600 hover:bg-green-700';
    } else if (hasAnalysis && isFlashing && !hasBeenClicked) {
      return 'bg-teal-600 hover:bg-teal-700';
    } else {
      return 'bg-blue-600 hover:bg-blue-700';
    }
  };
  
  return <Card className="border-t-2 border-t-[#9b87f5]">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <div>
            <CardTitle>Resume Grade</CardTitle>
            <CardDescription>
              Overall assessment based on industry standards
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <Progress value={resumePercent} className="h-2 w-16" />
              <span className="text-xs text-muted-foreground">{Number(resumePercent).toFixed(2)}%</span>
            </div>
            <div className={`text-4xl font-bold ${getLetterGradeColor(letterGrade)} bg-muted/20 h-16 w-16 rounded-full flex items-center justify-center`}>
              {letterGrade}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-accent/10 border-l-4 border-[#9b87f5] rounded-md p-4">
          <p className="font-medium mb-1">Elevator Pitch:</p>
          <p className="text-sm italic">{elevatorPitch || "No elevator pitch available."}</p>
        </div>
        
        <div className="space-y-3">
          <h3 className="font-medium mb-2">Key Improvement Themes</h3>
          {themes && themes.length > 0 ? <ul className="space-y-1 text-sm pl-4 list-disc text-left">
              {themes.map((theme, index) => <li key={index}>{theme}</li>)}
            </ul> : <p className="text-sm text-muted-foreground">
              No key improvement themes available.
            </p>}
        </div>
        
        <Separator />
        
        <div>
          <h3 className="font-medium mb-2">Expert Analysis:</h3>
          <p className="text-sm">{explanation || "No expert analysis available."}</p>
        </div>
        {careerAlignments && careerAlignments.length > 0 && <div className="space-y-2">
                    {careerAlignments.map((alignment, index) => <Alert key={index} className={`${index === 0 ? "bg-accent/20 border border-accent" : "bg-slate-50 border border-slate-200"}`}>
                        <AlertDescription>
                          {alignment.description}
                        </AlertDescription>
                      </Alert>)}
                  </div>}
        
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="p-4">
            <div className="flex flex-col items-center text-center gap-2">
              <MessageSquare className="h-6 w-6 text-blue-600" />
              <div className="w-full">
                <h4 className="font-medium text-blue-900">Get Personalized Coaching and a Resume Roast!</h4>
                <p className="text-sm text-blue-700 mb-3">
                  Speak with our AI career coach for detailed guidance on how to address these improvement areas.
                </p>
                <Button onClick={handleButtonClick} className={`w-full gap-2 transition-colors duration-300 ${getButtonClass()}`}>
                  <MessageSquare className="h-4 w-4" />
                  {hasAnalysis && hasBeenClicked ? 'Continue Career Chat' : 'Start Career Chat'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </CardContent>
      <CardFooter className="bg-muted/20 pt-3 pb-3 px-6">
        <div className="flex justify-between items-center w-full">
          <p className="text-xs text-muted-foreground">
            {analysisDate ? new Date(analysisDate).toLocaleDateString() : new Date().toLocaleDateString()} Analysis
          </p>
          <Button size="sm" variant="ghost" className="h-8 gap-1">
            <Download className="h-3.5 w-3.5" />
            <span className="text-xs">Export Report</span>
          </Button>
        </div>
      </CardFooter>
    </Card>;
};
export default OverallScoreCard;
