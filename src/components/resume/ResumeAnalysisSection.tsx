import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResumeAnalysis } from '@/components/assistants/types';
import type { Resume } from '../../hooks/resume/useResume'; // Adjusted import path
import BulletPointsAnalysisCard from './BulletPointsAnalysisCard';
import ResumeAnalysisDisplay from './ResumeAnalysisDisplay';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileCheck, ChartBar, Target, MessageCircle, RefreshCw, RotateCcw } from 'lucide-react';
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
  isPollingForImprovements?: boolean; // New prop for polling state
  handleRefreshData?: () => Promise<void>; // New prop for refresh functionality
  handleReanalyze?: () => Promise<void>; // Re-analyze with fresh AI call

  // Props for upload functionality, passed to ResumeAnalysisDisplay
  resumeFile: File | null;
  pdfPreviewUrl: string | null;
  uploading: boolean; // True if file upload to storage is in progress
  handleUpload: () => Promise<void>;
  handleDelete: () => Promise<void>;
  handleDownload: () => void;
  fileError: string | null;
  isExtracting?: boolean;
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
  isPollingForImprovements = false,
  handleRefreshData,
  handleReanalyze,
  isExtracting = false,
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
          <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-end">
            {analysis && (
              <div className="hidden sm:flex items-center bg-[#9b87f5]/10 rounded-full px-3 py-1">
                <span className="text-xs sm:text-sm font-medium text-[#9b87f5]">Industry-Leading Analysis</span>
              </div>
            )}
            {handleRefreshData && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefreshData} 
                disabled={loading || isAnalyzing || isPollingForImprovements}
                className="whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3"
              >
                <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${loading || isAnalyzing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh Data</span>
                <span className="sm:hidden">Refresh</span>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col">
        {showTabs ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col flex-grow">
            <TabsList className="grid grid-cols-2 sm:grid-cols-4 mb-6">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <ChartBar className="h-4 w-4" />
                <span>Overview</span>
              </TabsTrigger>
              <TabsTrigger 
                value="storytelling" 
                className="flex items-center gap-2" 
                disabled={!analysis || !Array.isArray(analysis.bullets) || analysis.bullets.length === 0}
              >
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

            <div className="flex-grow flex flex-col" style={{ minHeight: 0 }}>
              <TabsContent value="overview" className="mt-0 flex-grow h-full">
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
                  handleReanalyze={handleReanalyze}
                  uploading={uploading}
                  isAnalyzing={isAnalyzing}
                  isPollingForImprovements={isPollingForImprovements}
                  pdfPreviewUrl={pdfPreviewUrl}
                  fileError={fileError}
                  isExtracting={isExtracting}
                />
              </TabsContent>
              
              {analysis && ( // Conditionally render other tabs only if analysis exists
                <>
                  <TabsContent value="storytelling" className="mt-0 flex-grow h-full">
                    <BulletPointsAnalysisCard
                      bullets={analysis.bullets || []}
                      isAnalyzing={isAnalyzing || isPollingForImprovements} // Pass both loading states
                    />
                  </TabsContent>
                  <TabsContent value="ats" className="mt-0 flex-grow h-full">
                    <ATSScoreCard analysis={analysis} />
                  </TabsContent>
                  <TabsContent value="chat" className="mt-0 flex-grow h-full">
                    <div className="h-full flex flex-col">
                      {analysis && <ResumeChat resumeAnalysis={analysis} />}
                    </div>
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
            handleReanalyze={handleReanalyze}
            uploading={uploading}
            isAnalyzing={isAnalyzing}
            pdfPreviewUrl={pdfPreviewUrl}
            fileError={fileError}
            isExtracting={isExtracting}
          />
        )}
        
        {/* Only show chat outside of tabs when analysis exists but tabs are not shown */}
        {analysis && !showTabs && showCareerChat && (
          <div className="h-full flex flex-col" style={{ height: '60vh', maxHeight: '500px' }}>
            <ResumeChat resumeAnalysis={analysis} />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ResumeAnalysisSection;
