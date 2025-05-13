
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResumeAnalysis } from '@/components/assistants/types';
import type { Resume } from '../../hooks/resume/useResume'; // Adjusted import path
import BulletPointsAnalysisCard from './BulletPointsAnalysisCard';
import ResumeAnalysisDisplay from './ResumeAnalysisDisplay';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileCheck, ChartBar, Target, MessageCircle } from 'lucide-react';
import ATSScoreCard from './ATSScoreCard';
import ResumeChat from './ResumeChat';

interface ResumeAnalysisSectionProps {
  loading: boolean; // True if initial resume/analysis data is loading
  isAnalyzing: boolean; // True if AI analysis is in progress
  analysis: ResumeAnalysis | null;
  resume: Resume | null;
  handleStartCareerChat: () => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  hasAnalysis?: boolean;
  showCareerChat: boolean;

  // Props for upload functionality, passed to ResumeAnalysisDisplay
  resumeFile: File | null;
  pdfPreviewUrl: string | null;
  uploading: boolean; // True if file upload to storage is in progress
  handleUpload: () => Promise<void>;
  handleDelete: () => Promise<void>;
  handleDownload: () => void;
  fileError: string | null;
}

const ResumeAnalysisSection: React.FC<ResumeAnalysisSectionProps> = ({
  loading,
  isAnalyzing,
  analysis,
  resume,
  handleStartCareerChat,
  handleFileChange,
  hasAnalysis = false,
  resumeFile,
  pdfPreviewUrl,
  uploading,
  handleUpload,
  handleDelete,
  handleDownload,
  fileError,
  showCareerChat,
}) => {
  // State to track active tab
  const [activeTab, setActiveTab] = useState("overview");
  
  // Function to handle starting career chat
  const handleCareerChatStart = () => {
    handleStartCareerChat();
    setActiveTab("chat");
  };

  if (loading && !resume && !analysis && !resumeFile && !fileError) {
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
            <div className="flex items-center bg-muted rounded-full px-4 py-1 h-8 w-48 animate-pulse" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 animate-pulse">
            <div className="h-40 bg-muted rounded w-full mb-6"></div> {/* Placeholder for upload card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-4">
                <div className="h-48 bg-muted rounded"></div>
              </div>
              <div className="md:col-span-1 space-y-4">
                <div className="h-32 bg-muted rounded"></div>
                <div className="h-32 bg-muted rounded"></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const showTabs = !!analysis; // Show tabs only if analysis data is present.

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
          {analysis && ( // Show award badge only if analysis is available
            <div className="flex items-center bg-[#9b87f5]/10 rounded-full px-4 py-1">
              <span className="text-sm font-medium text-[#9b87f5]">Industry-Leading Analysis</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col">
        {showTabs ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col flex-grow">
            <TabsList className="grid grid-cols-2 sm:grid-cols-4 mb-6"> {/* Changed from 5 to 4 columns to remove career fit */}
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <ChartBar className="h-4 w-4" />
                <span>Overview</span>
              </TabsTrigger>
              <TabsTrigger value="storytelling" className="flex items-center gap-2" disabled={!analysis?.bullets?.length}>
                <Target className="h-4 w-4" />
                <span>Storytelling</span>
              </TabsTrigger>
              <TabsTrigger value="ats" className="flex items-center gap-2" disabled={!analysis}>
                <FileCheck className="h-4 w-4" />
                <span>ATS Score</span>
              </TabsTrigger>
              <TabsTrigger value="chat" className="flex items-center gap-2" disabled={!analysis}>
                <MessageCircle className="h-4 w-4" />
                <span>Chat</span>
              </TabsTrigger>
            </TabsList>

            <div className="flex-grow flex flex-col">
              <TabsContent value="overview" className="mt-0 flex-grow">
                <ResumeAnalysisDisplay
                  analysis={analysis}
                  onStartCareerChat={handleCareerChatStart}
                  hasAnalysis={hasAnalysis}
                  resume={resume}
                  resumeFile={resumeFile}
                  handleFileChange={handleFileChange}
                  handleUpload={handleUpload}
                  handleDelete={handleDelete}
                  handleDownload={handleDownload}
                  uploading={uploading}
                  isAnalyzing={isAnalyzing}
                  pdfPreviewUrl={pdfPreviewUrl}
                  fileError={fileError}
                />
              </TabsContent>
              
              {analysis && ( // Conditionally render other tabs only if analysis exists
                <>
                  <TabsContent value="storytelling" className="mt-0 flex-grow">
                    <BulletPointsAnalysisCard
                      bullets={analysis.bullets || []}
                      isAnalyzing={isAnalyzing} // Pass isAnalyzing if needed by this component
                    />
                  </TabsContent>
                  <TabsContent value="ats" className="mt-0 flex-grow">
                    <ATSScoreCard analysis={analysis} />
                  </TabsContent>
                  <TabsContent value="chat" className="mt-0 flex-grow flex flex-col h-full">
                    {analysis && <ResumeChat resumeAnalysis={analysis} />}
                  </TabsContent>
                </>
              )}
            </div>
          </Tabs>
        ) : (
          // If no analysis, ResumeAnalysisDisplay will show the upload UI
          <ResumeAnalysisDisplay
            analysis={null}
            onStartCareerChat={handleCareerChatStart}
            hasAnalysis={false}
            resume={resume}
            resumeFile={resumeFile}
            handleFileChange={handleFileChange}
            handleUpload={handleUpload}
            handleDelete={handleDelete}
            handleDownload={handleDownload}
            uploading={uploading}
            isAnalyzing={isAnalyzing}
            pdfPreviewUrl={pdfPreviewUrl}
            fileError={fileError}
          />
        )}
        
        {/* Only show chat outside of tabs when analysis exists but tabs are not shown */}
        {analysis && !showTabs && showCareerChat && <ResumeChat resumeAnalysis={analysis} />}
      </CardContent>
    </Card>
  );
};

export default ResumeAnalysisSection;
