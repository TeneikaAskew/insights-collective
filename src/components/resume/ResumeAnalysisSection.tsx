
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BulletPointsAnalysisCard from './BulletPointsAnalysisCard';
import ResumeAnalysisDisplay from './ResumeAnalysisDisplay';
import { ResumeAnalysis } from '@/components/assistants/types';
import type { Resume } from '@/hooks/resume/useResume';

interface ResumeAnalysisSectionProps {
  analysis: ResumeAnalysis | null;
  resume: Resume | null;
  loading: boolean;
  isAnalyzing: boolean;
  hasAnalysis: boolean;
  handleStartCareerChat: () => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  resumeFile: File | null;
  pdfPreviewUrl: string | null;
  uploading: boolean;
  handleUpload: () => Promise<void>;
  handleDelete: () => Promise<void>;
  handleDownload: () => void;
  fileError: string | null;
}

const ResumeAnalysisSection: React.FC<ResumeAnalysisSectionProps> = ({
  analysis,
  resume,
  loading,
  isAnalyzing,
  hasAnalysis,
  handleStartCareerChat,
  handleFileChange,
  resumeFile,
  pdfPreviewUrl,
  uploading,
  handleUpload,
  handleDelete,
  handleDownload,
  fileError,
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="bullets" disabled={!analysis}>Bullet Points</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <ResumeAnalysisDisplay
          analysis={analysis}
          resume={resume}
          onStartCareerChat={handleStartCareerChat}
          handleFileChange={handleFileChange}
          hasAnalysis={hasAnalysis}
          resumeFile={resumeFile}
          pdfPreviewUrl={pdfPreviewUrl}
          uploading={uploading}
          handleUpload={handleUpload}
          handleDelete={handleDelete}
          handleDownload={handleDownload}
          isAnalyzing={isAnalyzing}
          fileError={fileError}
        />
      </TabsContent>
      <TabsContent value="bullets">
        <div id="bullet-points-analysis">
          {analysis?.bullets && (
            <BulletPointsAnalysisCard bullets={analysis.bullets} />
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
};

export default ResumeAnalysisSection;
