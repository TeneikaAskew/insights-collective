
import React from 'react';
import { ResumeAnalysis } from '@/components/assistants/types';
import OverallScoreCard from './OverallScoreCard';

interface ResumeAnalysisDisplayProps {
  analysis: ResumeAnalysis | null;
  onStartCareerChat: () => void;
}

const ResumeAnalysisDisplay: React.FC<ResumeAnalysisDisplayProps> = ({
  analysis,
  onStartCareerChat
}) => {
  if (!analysis) return null;
  
  const {
    resume_percent,
    letter_grade,
    themes,
    elevator_pitch,
    explanation
  } = analysis;
  
  return (
    <div className="space-y-6">
      {/* Overall Resume Score - without the bullet points analysis */}
      <OverallScoreCard 
        letterGrade={letter_grade}
        resumePercent={resume_percent}
        elevatorPitch={elevator_pitch}
        themes={themes}
        explanation={explanation}
        onStartCareerChat={onStartCareerChat}
      />
    </div>
  );
};

export default ResumeAnalysisDisplay;
