
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResumeAnalysis } from '@/components/assistants/types';
import OverallScoreCard from './OverallScoreCard';
import BulletPointsAnalysisCard from './BulletPointsAnalysisCard';

interface ResumeAnalysisSectionProps {
  loading: boolean;
  isAnalyzing: boolean;
  analysis: ResumeAnalysis | null;
  resume: any;
  handleStartCareerChat: () => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const ResumeAnalysisSection: React.FC<ResumeAnalysisSectionProps> = ({
  loading,
  isAnalyzing,
  analysis,
  resume,
  handleStartCareerChat,
  handleFileChange
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resume Analysis</CardTitle>
        <CardDescription>
          Get personalized insights and recommendations based on your resume and career goals.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading || isAnalyzing ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-4 bg-muted rounded w-3/4 mb-6"></div>
            <div className="h-3 bg-muted rounded w-full mb-1"></div>
            <div className="h-3 bg-muted rounded w-5/6 mb-1"></div>
            <div className="h-3 bg-muted rounded w-4/6 mb-6"></div>
            
            <div className="h-4 bg-muted rounded w-3/4 mb-6"></div>
            <div className="h-3 bg-muted rounded w-full mb-1"></div>
            <div className="h-3 bg-muted rounded w-5/6 mb-6"></div>
            
            <div className="h-4 bg-muted rounded w-3/4 mb-6"></div>
            <div className="h-3 bg-muted rounded w-full mb-1"></div>
            <div className="h-3 bg-muted rounded w-full mb-1"></div>
            <div className="h-3 bg-muted rounded w-3/4"></div>
          </div>
        ) : analysis ? (
          <div className="space-y-6">
            {/* Overall Resume Score Card */}
            <OverallScoreCard 
              letterGrade={analysis.letter_grade || 'C'}
              resumePercent={analysis.resume_percent || 0}
              elevatorPitch={analysis.elevator_pitch || ''}
              themes={analysis.themes || []}
              explanation={analysis.explanation || ''}
              onStartCareerChat={handleStartCareerChat}
            />
            
         
          </div>
        ) : resume?.analysis ? (
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Strengths</h3>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {resume.analysis.strengths && resume.analysis.strengths.map((strength: string, i: number) => (
                  <li key={i}>{strength}</li>
                ))}
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium mb-2">Areas for Improvement</h3>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {resume.analysis.improvements && resume.analysis.improvements.map((improvement: string, i: number) => (
                  <li key={i}>{improvement}</li>
                ))}
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium mb-2">Career Alignment</h3>
              <p className="text-sm">
                {resume.analysis.careerAlignment}
              </p>
            </div>
            
            <div className="flex-col items-start space-y-2 p-0 pt-4">
              <p className="text-sm text-muted-foreground">
                Your resume has been analyzed. You can chat with our AI assistant for more personalized advice.
              </p>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleStartCareerChat}
              >
                Start Career Chat
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center p-6">
            <p className="text-muted-foreground mb-4">
              Upload your resume to receive personalized career advice and analysis.
            </p>
            
            <input 
              type="file" 
              accept=".pdf,.docx" 
              id="resume-upload-alt" 
              className="hidden" 
              onChange={handleFileChange}
            />
            <Button asChild>
              <label htmlFor="resume-upload-alt">Upload Resume</label>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ResumeAnalysisSection;
