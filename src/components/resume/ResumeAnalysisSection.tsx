
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ResumeAnalysisDisplay from './ResumeAnalysisDisplay';
import { ResumeAnalysis } from '@/components/assistants/types';

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
          <ResumeAnalysisDisplay 
            analysis={analysis} 
            onStartCareerChat={handleStartCareerChat}
          />
        ) : resume?.analysis ? (
          <ResumeAnalysisDisplay 
            analysis={resume.analysis} 
            onStartCareerChat={handleStartCareerChat}
          />
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
