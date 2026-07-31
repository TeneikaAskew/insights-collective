import React, { useState, useEffect } from 'react';
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
    const [hasBeenClicked, setHasBeenClicked] = useState(false);
    const [hasRoast, setHasRoast] = useState(false);
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

  const handleButtonClick = () => {
    setHasBeenClicked(true);
    onStartCareerChat();
  };

  const getLetterGradeColor = (grade: string) => {
    switch (grade) {
      case 'A':
      case 'B':
        return "text-ss-good bg-ss-good-chip";
      case 'C':
        return "text-ss-warn bg-ss-warn-chip";
      default:
        return "text-ss-bad bg-ss-bad-chip";
    }
  };

  return <Card className="ss-card">
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
              <Progress value={resumePercent} className="h-2 w-16 bg-ss-track" indicatorClassName="bg-ss-lav" />
              <span className="text-xs text-muted-foreground">{Number(resumePercent).toFixed(2)}%</span>
            </div>
            <div className={`text-4xl font-bold ${getLetterGradeColor(letterGrade)} h-16 w-16 rounded-full flex items-center justify-center`}>
              {letterGrade}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="ss-card-warm border-l-4 border-ss-peach rounded-2xl p-4">
          <p className="font-medium mb-1">Elevator Pitch:</p>
          <p className="ss-serif text-[15px] leading-relaxed">{elevatorPitch || "No elevator pitch available."}</p>
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
                    {careerAlignments.map((alignment, index) => <Alert key={index} className={`${index === 0 ? "bg-ss-good-chip border border-ss-good/30" : "bg-muted/40 border border-border"}`}>
                        <AlertDescription>
                          {alignment.description}
                        </AlertDescription>
                      </Alert>)}
                  </div>}

        <Card className="rounded-[26px] border-0 bg-gradient-to-br from-ss-lav-deep via-ss-lav to-ss-lav text-primary-foreground shadow-md">
          <CardContent className="p-5">
            <div className="flex flex-col items-center text-center gap-2">
              <MessageSquare className="h-6 w-6 text-white" />
              <div className="w-full">
                <h4 className="font-bold text-white">Get Personalized Coaching and a Resume Roast!</h4>
                <p className="text-sm text-white/85 mb-3">
                  Speak with our AI career coach for detailed guidance on how to address these improvement areas.
                </p>
                <Button
                  onClick={handleButtonClick}
                  className={`w-full gap-2 rounded-full font-bold transition-colors duration-300 ${
                    hasAnalysis && hasBeenClicked
                      ? 'bg-ss-good-chip text-ss-good hover:bg-ss-good-chip/90'
                      : 'bg-white text-ss-lav-deep hover:bg-white/90'
                  }`}
                >
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
