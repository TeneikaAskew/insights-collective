import React from 'react';
import { ResumeAnalysis } from '@/components/assistants/types';
import OverallScoreCard from './OverallScoreCard';

interface ResumeAnalysisDisplayProps {
  analysis: ResumeAnalysis | null;
  onStartCareerChat: () => void;
  userId?: string; // Add userId prop
}

const ResumeAnalysisDisplay: React.FC<ResumeAnalysisDisplayProps> = ({
  analysis,
  onStartCareerChat,
  userId
}) => {
  if (!analysis) return null;
  
  // Add default values to prevent undefined errors
  const {
    resume_percent = 0,
    letter_grade = 'C',
    themes = [],
    elevator_pitch = '',
    explanation = '',
  } = analysis || {};
  
  return (
    <div className="space-y-6">
      {/* Overall Resume Score Card */}
      <OverallScoreCard 
        letterGrade={letter_grade}
        resumePercent={resume_percent}
        elevatorPitch={elevator_pitch}
        themes={themes || []}
        explanation={explanation}
        onStartCareerChat={onStartCareerChat}
        userId={userId} // Pass userId
      />
    </div>
  );
};

export default ResumeAnalysisDisplay;