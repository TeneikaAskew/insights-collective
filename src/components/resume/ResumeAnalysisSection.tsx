import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResumeAnalysis } from '@/components/assistants/types';
import OverallScoreCard from './OverallScoreCard';
import BulletPointsAnalysisCard from './BulletPointsAnalysisCard';
import ResumeAnalysisDisplay from './ResumeAnalysisDisplay';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileCheck, ChartBar, Target, Briefcase, Award } from 'lucide-react';
import ATSScoreCard from './ATSScoreCard';

interface ResumeAnalysisSectionProps {
  loading: boolean;
  isAnalyzing: boolean;
  analysis: ResumeAnalysis | null;
  resume: any;
  handleStartCareerChat: () => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  hasAnalysis?: boolean; 
}

const ResumeAnalysisSection: React.FC<ResumeAnalysisSectionProps> = ({
  loading,
  isAnalyzing,
  analysis,
  resume,
  handleStartCareerChat,
  handleFileChange,
  hasAnalysis = false
}) => {
  return (
    <Card className="shadow-lg border-t-4 border-t-[#9b87f5]">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-2xl font-bold">Resume Analysis</CardTitle>
            <CardDescription className="text-base">
              Get personalized insights and recommendations based on your resume and career goals.
            </CardDescription>
          </div>
          {analysis && (
            <div className="flex items-center bg-[#9b87f5]/10 rounded-full px-4 py-1">
              <Award className="h-4 w-4 text-[#9b87f5] mr-2" />
              <span className="text-sm font-medium text-[#9b87f5]">Industry-Leading Analysis</span>
            </div>
          )}
        </div>
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
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid grid-cols-4 mb-6">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <ChartBar className="h-4 w-4" />
                <span>Overview</span>
              </TabsTrigger>
              <TabsTrigger value="storytelling" className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                <span>Storytelling</span>
              </TabsTrigger>
              <TabsTrigger value="ats" className="flex items-center gap-2">
                <FileCheck className="h-4 w-4" />
                <span>ATS Score</span>
              </TabsTrigger>
              <TabsTrigger value="career" className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                <span>Career Fit</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-0">
              <ResumeAnalysisDisplay 
                analysis={analysis}
                onStartCareerChat={handleStartCareerChat}
                hasAnalysis={hasAnalysis}
              />
            </TabsContent>
            
            <TabsContent value="storytelling" className="mt-0">
              <BulletPointsAnalysisCard 
                bullets={analysis.bullets || []}
                isAnalyzing={isAnalyzing}
              />
            </TabsContent>
            
            <TabsContent value="ats" className="mt-0">
              <ATSScoreCard analysis={analysis} />
            </TabsContent>
            
            <TabsContent value="career" className="mt-0">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Career Path Alignment</CardTitle>
                    <CardDescription>
                      How well your resume aligns with your target career path and industry expectations
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="bg-accent/20 border border-accent rounded-md p-4">
                      <p className="font-medium mb-2">Target Industry Recommendation:</p>
                      <p className="text-sm">{analysis.themes?.[0] || "Upload your resume to receive personalized career recommendations."}</p>
                    </div>
                    
                    <Button 
                      onClick={handleStartCareerChat}
                      className="w-full gap-2"
                    >
                      Explore Career Opportunities
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
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
          <div className="text-center p-8 bg-gradient-to-b from-transparent to-muted/20 rounded-lg">
            <div className="max-w-md mx-auto">
              <h3 className="text-xl font-semibold mb-2">Unlock Your Career Potential</h3>
              <p className="text-muted-foreground mb-6">
                Upload your resume to receive personalized career advice, ATS optimization scores, and specific improvements to land your dream job.
              </p>
              
              <input 
                type="file" 
                accept=".pdf,.docx" 
                id="resume-upload-alt" 
                className="hidden" 
                onChange={handleFileChange}
              />
              <Button size="lg" asChild className="bg-[#9b87f5] hover:bg-[#8B5CF6] text-white">
                <label htmlFor="resume-upload-alt" className="flex items-center gap-2 cursor-pointer">
                  <FileCheck className="h-5 w-5" />
                  Upload Resume
                </label>
              </Button>
              <p className="text-xs text-muted-foreground mt-4">
                Supports PDF and Word documents. Your data is secure and private.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ResumeAnalysisSection;
