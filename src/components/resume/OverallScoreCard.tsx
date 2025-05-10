
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';

import { OverallScoreHeader } from './scorecard/OverallScoreHeader';
import { ElevatorPitchDisplay } from './scorecard/ElevatorPitchDisplay';
import { ImprovementThemesList } from './scorecard/ImprovementThemesList';
import { ExpertAnalysisDisplay } from './scorecard/ExpertAnalysisDisplay';
import { CoachingCallToAction } from './scorecard/CoachingCallToAction';
import { ScoreCardFooter } from './scorecard/ScoreCardFooter';

interface OverallScoreCardProps {
  letterGrade: string;
  resumePercent: number;
  elevatorPitch: string;
  themes: string[];
  explanation: string;
  onStartCareerChat: () => void;
  hasAnalysis?: boolean;
  userId?: string;
}

const OverallScoreCard: React.FC<OverallScoreCardProps> = ({
  letterGrade,
  resumePercent,
  elevatorPitch,
  themes,
  explanation,
  onStartCareerChat,
  hasAnalysis = false,
  userId
}) => {
  // The 'hasRoast' state and its related useEffect remain here as they are specific to this top-level card
  // and not directly tied to one of the smaller display components.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [hasRoast, setHasRoast] = useState(false); // Kept for conceptual integrity, though not directly used in UI by new components.

  useEffect(() => {
    console.log("Checking if roast exists yet for: ", userId);
    if (userId) {
      const checkForRoast = async () => {
        try {
          const { data, error } = await supabase
            .from('resumes')
            .select('initial_assessment')
            .eq('user_id', userId)
            .order('uploaded_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          console.log("user: ", userId, " - Roast data", data);
            
          if (!error && data?.initial_assessment) {
            setHasRoast(true);
            // If hasRoast was meant to influence UI, this is where you'd connect it.
            // For now, it's a self-contained check.
          }
        } catch (error) {
          console.error("Error checking for roast:", error);
        }
      };
      
      checkForRoast();
    }
  }, [userId]);

  return (
    <Card className="border-t-2 border-t-[#9b87f5]">
      <CardHeader className="pb-2">
        <OverallScoreHeader letterGrade={letterGrade} resumePercent={resumePercent} />
      </CardHeader>
      <CardContent className="space-y-4">
        <ElevatorPitchDisplay elevatorPitch={elevatorPitch} />
        <ImprovementThemesList themes={themes} />
        <Separator />
        <ExpertAnalysisDisplay explanation={explanation} />
        <CoachingCallToAction 
          onStartCareerChat={onStartCareerChat} 
          hasAnalysis={hasAnalysis} 
        />
      </CardContent>
      <CardFooter className="bg-muted/20 pt-3 pb-3 px-6">
        <ScoreCardFooter />
      </CardFooter>
    </Card>
  );
};

export default OverallScoreCard;
