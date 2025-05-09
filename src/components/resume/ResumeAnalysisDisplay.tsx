
import React from 'react';
import { ResumeAnalysis } from '@/components/assistants/types';
import OverallScoreCard from './OverallScoreCard';
import BulletPointsAnalysisCard from './BulletPointsAnalysisCard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, TrendingUp, Sparkles } from 'lucide-react';

interface ResumeAnalysisDisplayProps {
  analysis: ResumeAnalysis | null;
  onStartCareerChat: () => void;
  userId?: string;
  hasAnalysis?: boolean;
}

const ResumeAnalysisDisplay: React.FC<ResumeAnalysisDisplayProps> = ({
  analysis,
  onStartCareerChat,
  userId,
  hasAnalysis
}) => {
  if (!analysis) return null;
  
  // Add default values to prevent undefined errors
  const {
    resume_percent = 0,
    letter_grade = 'C',
    themes = [],
    elevator_pitch = '',
    explanation = '',
    bullets = [],
  } = analysis || {};
  
  // Determine if the resume needs serious improvement
  const needsImprovement = resume_percent < 60 || letter_grade === 'D' || letter_grade === 'F';
  
  // Find top strengths and weaknesses from bullets
  const topBullets = bullets?.slice(0, 5) || [];
  const highestScoringBullet = [...topBullets].sort((a, b) => (b?.bullet_total || 0) - (a?.bullet_total || 0))[0];
  const lowestScoringBullet = [...topBullets].sort((a, b) => (a?.bullet_total || 0) - (b?.bullet_total || 0))[0];
  
  return (
    <div className="space-y-6">
      {needsImprovement && (
        <Alert variant="destructive" className="bg-red-50 text-red-800 border-red-200">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800">Critical Improvements Needed</AlertTitle>
          <AlertDescription className="text-red-700">
            Your resume may be getting filtered out by ATS systems. Follow the action plan to significantly improve your chances.
          </AlertDescription>
        </Alert>
      )}
      
      {resume_percent >= 85 && (
        <Alert className="bg-green-50 text-green-800 border-green-200">
          <Sparkles className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Excellent Resume</AlertTitle>
          <AlertDescription className="text-green-700">
            Your resume ranks in the top tier. The recommendations will help you perfect it even further.
          </AlertDescription>
        </Alert>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <OverallScoreCard 
            letterGrade={letter_grade}
            resumePercent={resume_percent}
            elevatorPitch={elevator_pitch}
            themes={themes || []}
            explanation={explanation}
            onStartCareerChat={onStartCareerChat}
            userId={userId} 
            hasAnalysis={hasAnalysis} 
          />
        </div>
        
        <div className="md:col-span-1">
          <div className="bg-white border rounded-lg p-4 h-full">
            <h3 className="font-medium flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-[#9b87f5]" />
              <span>Key Insights</span>
            </h3>
            
            <div className="space-y-4">
              {highestScoringBullet && (
                <div className="border-l-4 border-green-400 pl-3 py-1">
                  <p className="text-xs text-muted-foreground mb-1">STRONGEST POINT</p>
                  <p className="text-sm line-clamp-2">{highestScoringBullet.original}</p>
                </div>
              )}
              
              {lowestScoringBullet && (
                <div className="border-l-4 border-amber-400 pl-3 py-1">
                  <p className="text-xs text-muted-foreground mb-1">NEEDS IMPROVEMENT</p>
                  <p className="text-sm line-clamp-2">{lowestScoringBullet.original}</p>
                </div>
              )}
              
              <div className="border-l-4 border-blue-400 pl-3 py-1">
                <p className="text-xs text-muted-foreground mb-1">INDUSTRY ALIGNMENT</p>
                <p className="text-sm">{(resume_percent > 75) ? 'Strong' : (resume_percent > 60) ? 'Fair' : 'Weak'} industry alignment</p>
              </div>
              
              <div className="border-l-4 border-purple-400 pl-3 py-1">
                <p className="text-xs text-muted-foreground mb-1">STORYTELLING QUALITY</p>
                <p className="text-sm">{bullets ? bullets.length : 0} bullet points analyzed</p>
                <p className="text-xs text-muted-foreground">Average quality score: {bullets ? 
                  Math.round(bullets.reduce((sum, bullet) => sum + (bullet?.bullet_total || 0), 0) / (bullets.length || 1)) 
                  : 0}/45</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResumeAnalysisDisplay;
