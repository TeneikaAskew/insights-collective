
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
  // Add console log to debug analysis data
  console.log("ResumeAnalysisDisplay - Current analysis data:", analysis);
  
  if (!analysis) {
    console.log("ResumeAnalysisDisplay - No analysis data available");
    return null;
  }
  
  // Add default values to prevent undefined errors
  const {
    resume_percent = 0,
    letter_grade = 'C',
    themes = [],
    elevator_pitch = '',
    explanation = '',
    bullets = []
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
      />
    </div>
  );
};

export default ResumeAnalysisDisplay;
