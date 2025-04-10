
import React from 'react';
import { ResumeAnalysis } from '@/components/assistants/types';
import OverallScoreCard from './OverallScoreCard';
import BulletPointsAnalysisCard from './BulletPointsAnalysisCard';

interface ResumeAnalysisDisplayProps {
  analysis: ResumeAnalysis | null;
  onStartCareerChat: () => void;
}

const ResumeAnalysisDisplay: React.FC<ResumeAnalysisDisplayProps> = ({
  analysis,
  onStartCareerChat
}) => {
  if (!analysis) return null;
  
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
      
      {/* Bullet Points Analysis Card - if we have bullet points */}
      {bullets && bullets.length > 0 && (
        <BulletPointsAnalysisCard bullets={bullets} />
      )}
    </div>
  );
};

export default ResumeAnalysisDisplay;
