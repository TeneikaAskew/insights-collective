// ABOUTME: Dev-only preview of the Soft Studio resume page rendered with fixture
// ABOUTME: data — no auth or backend needed. Registered in App.tsx behind import.meta.env.DEV.
import React from 'react';
import ResumeAnalysisSection from '@/components/resume/ResumeAnalysisSection';
import {
  fixtureResumeAnalysis,
  fixtureResume,
} from '@/test/fixtures/resumeAnalysis';
import type { Resume } from '@/hooks/resume/useResume';

const noop = () => {};
const noopAsync = async () => {};

const SoftStudioPreview: React.FC = () => {
  return (
    <div
      className="soft-studio ss-wash mx-auto py-8 space-y-6 px-6 max-w-full min-h-screen"
      data-testid="soft-studio-preview"
    >
      <ResumeAnalysisSection
        loading={false}
        isAnalyzing={false}
        isPollingForImprovements={false}
        analysis={fixtureResumeAnalysis}
        resume={fixtureResume as unknown as Resume}
        handleStartCareerChat={noop}
        handleFileChange={noop}
        hasAnalysis
        resumeFile={null}
        pdfPreviewUrl={null}
        uploading={false}
        handleUpload={noopAsync}
        handleDelete={noopAsync}
        handleDownload={noop}
        handleRefreshData={noopAsync}
        handleReanalyze={noopAsync}
        fileError={null}
        showCareerChat={false}
      />
    </div>
  );
};

export default SoftStudioPreview;
