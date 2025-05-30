
import React, { useState, useEffect } from 'react';
import { useAuthenticatedNavigation } from '@/hooks/useAuthenticatedNavigation';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { useToast } from '@/hooks/use-toast';
import { useResume } from '@/hooks/resume/useResume';
import { useResumeAnalysis } from '@/hooks/resume/useResumeAnalysis';
import ResumeAnalysisSection from '@/components/resume/ResumeAnalysisSection';
import OnboardingGuide from '@/components/onboarding/OnboardingGuide';
import PageHeader from '@/components/common/PageHeader';
import { usePageOnboarding } from '@/hooks/usePageOnboarding';

const Resume = () => {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { navigateWithAuth } = useAuthenticatedNavigation();
  const [showCareerChat, setShowCareerChat] = useState(false);
  
  // Use page onboarding hook
  usePageOnboarding();

  useEffect(() => {
    if (!isAuthenticated) {
      navigateWithAuth('/login', { 
        requireAuth: true, 
        message: "Please log in to access Resume Analysis", 
        title: "Authentication Required" 
      });
    }
  }, [isAuthenticated, navigateWithAuth]);

  const {
    resumeFile,
    pdfPreviewUrl,
    uploading,
    fileError,
    handleFileChange,
    handleUpload,
    handleDelete,
    handleDownload,
    clearError
  } = useResume();

  const {
    analysis,
    resume,
    loading,
    isAnalyzing,
    isPollingForImprovements,
    hasAnalysis,
    refreshData
  } = useResumeAnalysis();

  const handleStartCareerChat = () => {
    setShowCareerChat(true);
  };

  if (!user) return null;

  return (
    <AppLayout>
      <OnboardingGuide tourId="resume" />
      <div className="space-y-6">
        <PageHeader
          title="Resume Analyzer"
          description="Get AI-powered analysis and optimization suggestions for your resume"
          tourId="resume"
        />

        <div data-tour="resume-main">
          <ResumeAnalysisSection
            loading={loading}
            isAnalyzing={isAnalyzing}
            analysis={analysis}
            resume={resume}
            handleStartCareerChat={handleStartCareerChat}
            handleFileChange={handleFileChange}
            hasAnalysis={hasAnalysis}
            resumeFile={resumeFile}
            pdfPreviewUrl={pdfPreviewUrl}
            uploading={uploading}
            handleUpload={handleUpload}
            handleDelete={handleDelete}
            handleDownload={handleDownload}
            fileError={fileError}
            showCareerChat={showCareerChat}
            isPollingForImprovements={isPollingForImprovements}
            handleRefreshData={refreshData}
          />
        </div>
      </div>
    </AppLayout>
  );
};

export default Resume;
