
import React from 'react';
import { ResumeAnalysis } from '@/components/assistants/types';
import OverallScoreCard from './OverallScoreCard';
import BulletPointsAnalysisCard from './BulletPointsAnalysisCard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, TrendingUp, Sparkles, File, FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ResumeAnalysisDisplayProps {
  analysis: ResumeAnalysis | null;
  onStartCareerChat: () => void;
  userId?: string;
  hasAnalysis?: boolean;
  handleFileChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  resumeFile?: File | null;
  pdfPreviewUrl?: string | null;
}

const ResumeAnalysisDisplay: React.FC<ResumeAnalysisDisplayProps> = ({
  analysis,
  onStartCareerChat,
  userId,
  hasAnalysis,
  handleFileChange,
  resumeFile,
  pdfPreviewUrl
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

      {/* Resume Upload Bar */}
      {handleFileChange && (
        <div className="bg-white border rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">Update Your Resume</h3>
            <input 
              type="file" 
              accept=".pdf,.docx" 
              id="resume-upload-inline" 
              className="hidden" 
              onChange={handleFileChange}
            />
            <Button size="sm" variant="outline" asChild className="flex items-center gap-1">
              <label htmlFor="resume-upload-inline">
                <FileUp className="h-4 w-4" />
                <span>Upload</span>
              </label>
            </Button>
          </div>
        </div>
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
            {/* Resume Preview Above Key Insights */}
            {pdfPreviewUrl && (
              <div className="mb-4 border rounded">
                <iframe
                  src={pdfPreviewUrl}
                  title="Resume Preview" 
                  className="w-full aspect-[8.5/4]"
                />
              </div>
            )}
            
            {resumeFile?.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && (
              <div className="mb-4 border rounded p-3 bg-gray-50 flex items-center">
                <File className="h-5 w-5 text-blue-600 mr-2" />
                <span className="text-sm truncate">{resumeFile.name}</span>
              </div>
            )}
          
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
